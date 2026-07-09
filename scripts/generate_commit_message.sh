#!/usr/bin/env bash
set -euo pipefail

max_files=8
max_hunks=5
max_change_lines=8

status_lines="$(git diff --cached --name-status)"
if [[ -z "$status_lines" ]]; then
  echo "update: no staged changes"
  exit 0
fi

changed_files="$(printf '%s\n' "$status_lines" | awk '{print $NF}')"
file_count="$(printf '%s\n' "$changed_files" | sed '/^$/d' | wc -l | tr -d ' ')"

status_action() {
  case "$1" in
    A*) printf 'add' ;;
    D*) printf 'remove' ;;
    R*) printf 'rename' ;;
    C*) printf 'copy' ;;
    *) printf 'update' ;;
  esac
}

file_scope() {
  case "$1" in
    docs/_sidebar*|docs/_navbar.md|docs/gitbook-summary.yaml)
      printf 'docs navigation'
      ;;
    docs/*.md)
      printf 'documentation'
      ;;
    Makefile|scripts/*|*.sh)
      printf 'commit automation'
      ;;
    docker-compose*.yaml|docker-compose*.yml|*.yaml|*.yml|*.json|*.toml|*.mk)
      printf 'configuration'
      ;;
    README.md)
      printf 'readme'
      ;;
    *)
      printf 'project files'
      ;;
  esac
}

path_label() {
  local file="$1"
  local base="${file##*/}"
  base="${base%.*}"
  printf '%s' "$base" | tr '_-' '  ' | awk '{$1=$1; print}'
}

markdown_title() {
  local file="$1"
  git show ":$file" 2>/dev/null | awk '
    /^[[:space:]]*#{1,6}[[:space:]]+/ {
      line = $0
      sub(/^[[:space:]]*#{1,6}[[:space:]]+/, "", line)
      sub(/[[:space:]]+$/, "", line)
      print line
      exit
    }
  '
}

file_label() {
  local file="$1"
  local title=""

  case "$file" in
    docs/_sidebar*|docs/_navbar.md|docs/gitbook-summary.yaml)
      printf 'docs navigation'
      ;;
    *.md)
      title="$(markdown_title "$file")"
      if [[ -n "$title" ]]; then
        printf '%s' "$title"
      else
        path_label "$file"
      fi
      ;;
    Makefile|scripts/git_update.sh|scripts/generate_commit_message.sh)
      printf 'commit automation'
      ;;
    scripts/*|*.sh)
      path_label "$file"
      ;;
    docker-compose*.yaml|docker-compose*.yml)
      printf 'docker compose configuration'
      ;;
    *)
      path_label "$file"
      ;;
  esac
}

contains_item() {
  local needle="$1"
  shift
  local item

  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done

  return 1
}

join_with_and() {
  local items=("$@")

  if [[ "${#items[@]}" -eq 0 ]]; then
    return
  elif [[ "${#items[@]}" -eq 1 ]]; then
    printf '%s' "${items[0]}"
  elif [[ "${#items[@]}" -eq 2 ]]; then
    printf '%s and %s' "${items[0]}" "${items[1]}"
  else
    printf '%s, %s and %s more' "${items[0]}" "${items[1]}" "$((${#items[@]} - 2))"
  fi
}

subject_type="chore"
actions=()
scopes=()
labels=()

while IFS=$'\t' read -r status file _; do
  [[ -z "${file:-}" ]] && continue

  action="$(status_action "$status")"
  scope="$(file_scope "$file")"
  label="$(file_label "$file")"

  contains_item "$action" "${actions[@]+"${actions[@]}"}" || actions+=("$action")
  contains_item "$scope" "${scopes[@]+"${scopes[@]}"}" || scopes+=("$scope")
  contains_item "$label" "${labels[@]+"${labels[@]}"}" || labels+=("$label")

  case "$file" in
    docs/*)
      if [[ "$subject_type" != "chore" ]]; then
        :
      else
        subject_type="docs"
      fi
      ;;
  esac
done <<< "$status_lines"

subject_action="${actions[0]:-update}"
if [[ "${#actions[@]}" -gt 1 ]]; then
  subject_action="update"
fi

subject_detail="$(join_with_and "${labels[@]:0:3}")"
if [[ -z "$subject_detail" || "${#labels[@]}" -gt 3 ]]; then
  subject_detail="$(join_with_and "${scopes[@]:0:3}")"
fi
[[ -z "$subject_detail" ]] && subject_detail="project files"

subject="${subject_type}: ${subject_action} ${subject_detail}"

{
  printf '%s\n\n' "$subject"
  printf 'Changed files (%s):\n' "$file_count"
  printf '%s\n' "$status_lines" | head -n "$max_files" | awk '{
    status=$1
    file=$NF
    label=status
    if (status == "A") label="add"
    else if (status == "M") label="update"
    else if (status == "D") label="remove"
    else if (status ~ /^R/) label="rename"
    else if (status ~ /^C/) label="copy"
    printf "- %s %s\n", label, file
  }'
  if [[ "$file_count" -gt "$max_files" ]]; then
    printf -- '- and %s more\n' "$((file_count - max_files))"
  fi

  hunk_summary="$(git diff --cached --unified=0 --no-ext-diff -- . \
    | awk -v limit="$max_hunks" '
      /^diff --git / {
        file=$4
        sub(/^b\//, "", file)
        next
      }
      /^@@ / {
        if (file != "" && count < limit) {
          line=$0
          sub(/^@@ /, "", line)
          sub(/ @@.*/, "", line)
          printf "- %s %s\n", file, line
          count++
        }
      }
    ')"

  if [[ -n "$hunk_summary" ]]; then
    printf '\nContent summary:\n'
    printf '%s\n' "$hunk_summary"
  fi

  change_summary="$(git diff --cached --unified=0 --no-ext-diff -- . \
    | awk -v limit="$max_change_lines" '
      /^diff --git / {
        file=$4
        sub(/^b\//, "", file)
        next
      }
      /^Binary files / {
        if (count < limit) {
          print "- " file ": binary file changed"
          count++
        }
        next
      }
      /^[+-][^+-]/ {
        if (count < limit) {
          line=$0
          sign=substr(line, 1, 1)
          text=substr(line, 2)
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", text)
          if (length(text) > 100) {
            text=substr(text, 1, 97) "..."
          }
          if (text != "") {
            printf "- %s %s: %s\n", file, sign, text
            count++
          }
        }
      }
    ')"

  if [[ -n "$change_summary" ]]; then
    printf '\nChange details:\n'
    printf '%s\n' "$change_summary"
  fi
} 
