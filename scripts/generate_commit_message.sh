#!/usr/bin/env bash
set -euo pipefail

max_files=3

status_lines="$(git diff --cached --name-status)"
if [[ -z "$status_lines" ]]; then
  echo "auto: no changes"
  exit 0
fi

files=()

while IFS=$'\t' read -r status first_file second_file _; do
  file="$first_file"

  case "$status" in
    R*|C*)
      file="${second_file:-$first_file}"
      ;;
  esac

  [[ -z "${file:-}" ]] && continue
  files+=("${file##*/}")
done <<< "$status_lines"

file_count="${#files[@]}"
if [[ "$file_count" -eq 0 ]]; then
  echo "auto: no changes"
  exit 0
fi

display_count="$file_count"
if [[ "$display_count" -gt "$max_files" ]]; then
  display_count="$max_files"
fi

message=""
index=0
while [[ "$index" -lt "$display_count" ]]; do
  if [[ -z "$message" ]]; then
    message="${files[$index]}"
  else
    message="${message}, ${files[$index]}"
  fi
  index="$((index + 1))"
done

if [[ "$file_count" -gt "$max_files" ]]; then
  message="${message} 等 ${file_count} 个文件"
fi

printf 'auto: %s\n' "$message"
