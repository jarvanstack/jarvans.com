#!/usr/bin/env bash
set -euo pipefail

message_file_arg=""
message_file_arg_is_temp=false

if [[ "${1:-}" == "--message-file" ]]; then
  message_file_arg="${2:-}"
elif [[ $# -gt 0 ]]; then
  message_file_arg="$(mktemp)"
  message_file_arg_is_temp=true
  printf '%s\n' "$1" > "$message_file_arg"
fi

git add -A

if git diff --cached --quiet; then
  echo "No changes to commit."
  git push origin master
  exit 0
fi

message_file="$(mktemp)"
cleanup() {
  rm -f "$message_file"
  if [[ "$message_file_arg_is_temp" == true ]]; then
    rm -f "$message_file_arg"
  fi
}
trap cleanup EXIT

if [[ -n "$message_file_arg" ]]; then
  cp "$message_file_arg" "$message_file"
else
  ./scripts/generate_commit_message.sh > "$message_file"
fi

echo "Commit message:"
sed 's/^/  /' "$message_file"

git commit -F "$message_file"
git push origin master
