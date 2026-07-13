#!/usr/bin/env bash
set -euo pipefail

remote_host="root@djv2.bmft.tech"
remote_dir="/root/app/jarvans.com"
branch="master"
compose_file="docker-compose-nginx.yaml"
container_name="jarvans_com_nginx"
site_url="https://www.jarvans.com/"
redirect_url="https://jarvans.com/"

local_revision="$(git rev-parse HEAD)"

echo "Deploying ${local_revision} to ${remote_host}..."

# Pass the deployment commands on stdin so every step runs in the same remote
# shell and any failure stops the deployment immediately.
ssh -p 22 "$remote_host" bash -s -- \
  "$remote_dir" \
  "$branch" \
  "$local_revision" \
  "$compose_file" \
  "$container_name" <<'REMOTE_SCRIPT'
set -euo pipefail

remote_dir="$1"
branch="$2"
expected_revision="$3"
compose_file="$4"
container_name="$5"

cd "$remote_dir"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Remote worktree is dirty; refusing to overwrite server changes." >&2
  git status --short >&2
  exit 1
fi

git fetch origin "$branch"
git merge --ff-only FETCH_HEAD

actual_revision="$(git rev-parse HEAD)"
if [[ "$actual_revision" != "$expected_revision" ]]; then
  echo "Deployment revision mismatch." >&2
  echo "Expected: $expected_revision" >&2
  echo "Actual:   $actual_revision" >&2
  echo "Push the local commit before running this script." >&2
  exit 1
fi

docker compose -f "$compose_file" up -d
docker exec "$container_name" nginx -t
docker exec "$container_name" nginx -s reload
REMOTE_SCRIPT

# A revision query parameter bypasses intermediary/browser caches during the
# deployment check without changing the site's public URLs.
headers_file="$(mktemp)"
redirect_headers_file="$(mktemp)"
trap 'rm -f "$headers_file" "$redirect_headers_file"' EXIT
curl --fail --silent --show-error --max-time 15 \
  --dump-header "$headers_file" \
  --output /dev/null \
  "${site_url}?deployment=${local_revision}"

if ! grep -Eiq '^cache-control:[[:space:]]*no-cache([,[:space:]]|$)' "$headers_file"; then
  echo "Website cache policy was not applied after deployment." >&2
  sed -n '/^[Cc]ache-[Cc]ontrol:/p' "$headers_file" >&2
  exit 1
fi

redirect_status="$(curl --silent --show-error --max-time 15 \
  --dump-header "$redirect_headers_file" \
  --output /dev/null \
  --write-out '%{http_code}' \
  "$redirect_url")"

if [[ "$redirect_status" != "308" ]] \
  || ! grep -Fiq "location: $site_url" "$redirect_headers_file" \
  || ! grep -Eiq '^clear-site-data:[[:space:]]*"cache",[[:space:]]*"storage"' "$redirect_headers_file"; then
  echo "Bare-domain canonical redirect was not applied after deployment." >&2
  sed -n '1,/^[[:space:]]*$/p' "$redirect_headers_file" >&2
  exit 1
fi

echo "Deployment complete: ${local_revision}"
echo "Verified: ${site_url}"
