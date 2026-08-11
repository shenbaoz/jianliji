#!/bin/sh
set -u

candidate="/www/wwwroot/znhil-resume-app/deploy/nginx-znhil.conf"
target="/www/server/panel/vhost/nginx/znhil.xyz.conf"
backup="/www/wwwroot/znhil-resume-app/znhil.xyz.conf.before-20260730"
log="/www/wwwroot/znhil-resume-app/nginx-apply.log"
nginx="/www/server/nginx/sbin/nginx"

cp "$candidate" "$target"
if "$nginx" -t >"$log" 2>&1; then
  "$nginx" -s reload >>"$log" 2>&1
  echo "APPLIED" >>"$log"
else
  cp "$backup" "$target"
  "$nginx" -t >>"$log" 2>&1
  echo "ROLLED_BACK" >>"$log"
  exit 1
fi
