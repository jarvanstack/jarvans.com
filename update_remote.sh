#!/usr/bin/env bash
set -euo pipefail

remote_host="root@djv2.bmft.tech"
remote_dir="/root/app/jarvans.com"

# 使用公钥登录不需要密码；远端命令执行完成后 SSH 会自动退出。
ssh -p 22 "$remote_host" "cd '$remote_dir' && git pull origin master:master"
