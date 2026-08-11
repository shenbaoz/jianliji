#!/bin/sh
set -eu

archive=${1:?usage: ship-latest-20260810.sh <release-archive>}
app_dir=/www/wwwroot/znhil-resume-app
data_dir=/www/wwwroot/resume-fit-isolated-20260728/data
live_container=resume-fit-isolated
stamp=$(date +%Y%m%d-%H%M%S)
staging="$app_dir/.latest-staging-$stamp"
backup_dist="$app_dir/dist.backup-$stamp"
backup_container="$live_container-backup-$stamp"
build_container="znhil-latest-build-$stamp"
test_container="znhil-latest-test-$stamp"
new_image="znhil-resume-latest:$stamp"
runtime_env="/root/znhil-latest-$stamp.env"
test_env="/root/znhil-latest-test-$stamp.env"

healthcheck() {
  port=$1
  attempts=0
  while [ "$attempts" -lt 40 ]; do
    if curl -fsS "http://127.0.0.1:$port/api/health" | grep -q '"ok":true'; then return 0; fi
    attempts=$((attempts + 1)); sleep 1
  done
  return 1
}

rollback() {
  docker rm -f "$live_container" >/dev/null 2>&1 || true
  docker rename "$backup_container" "$live_container"
  docker start "$live_container" >/dev/null
  if [ -d "$app_dir/dist" ]; then mv "$app_dir/dist" "$app_dir/dist.failed-$stamp"; fi
  mv "$backup_dist" "$app_dir/dist"
}

mkdir "$staging"
tar -xzf "$archive" -C "$staging"
test -f "$staging/dist/index.html"
test -f "$staging/server/index.mjs"
test -f "$staging/server/app.mjs"

docker inspect "$live_container" --format '{{range .Config.Env}}{{println .}}{{end}}' > "$runtime_env"
chmod 600 "$runtime_env"
sed 's/^BACKEND_PORT=.*/BACKEND_PORT=3199/' "$runtime_env" > "$test_env"
chmod 600 "$test_env"
# The live container predates the current production-config minimum; keep this
# one-time staging credential isolated from the production env file.
printf '\nADMIN_PASSWORD=staging-only-20260810-password-very-long\n' >> "$test_env"
old_image=$(docker inspect "$live_container" --format '{{.Config.Image}}')

docker create --name "$build_container" "$old_image" sleep infinity >/dev/null
docker cp "$staging/dist/." "$build_container:/app/dist"
docker cp "$staging/server/." "$build_container:/app/server"
docker cp "$staging/package.json" "$build_container:/app/package.json"
docker cp "$staging/package-lock.json" "$build_container:/app/package-lock.json"
docker start "$build_container" >/dev/null
docker exec "$build_container" node --check server/index.mjs
docker exec "$build_container" node --check server/app.mjs
docker exec "$build_container" node --check server/aiProvider.mjs
docker exec "$build_container" node --check server/pdfEditor.mjs
docker stop "$build_container" >/dev/null
docker commit --change 'CMD ["node","server/index.mjs"]' "$build_container" "$new_image" >/dev/null
docker rm "$build_container" >/dev/null

docker run -d --name "$test_container" --network host --env-file "$test_env" -v "$data_dir:/app/data" "$new_image" >/dev/null
if ! healthcheck 3199; then
  docker logs --tail 80 "$test_container" || true
  docker rm -f "$test_container" >/dev/null 2>&1 || true
  echo STAGING_HEALTH_FAILED
  exit 1
fi
docker rm -f "$test_container" >/dev/null

mv "$app_dir/dist" "$backup_dist"
mv "$staging/dist" "$app_dir/dist"
chown -R www:www "$app_dir/dist"
docker stop "$live_container" >/dev/null
docker rename "$live_container" "$backup_container"
if ! docker run -d --name "$live_container" --restart unless-stopped --network host --env-file "$runtime_env" -v "$data_dir:/app/data" "$new_image" >/dev/null; then
  rollback
  echo CONTAINER_START_FAILED_ROLLED_BACK
  exit 1
fi
if ! healthcheck 3102 || ! curl -fsS https://znhil.xyz/ | grep -q 'app-'; then
  docker logs --tail 80 "$live_container" || true
  rollback
  echo PRODUCTION_HEALTH_FAILED_ROLLED_BACK
  exit 1
fi

cp -a "$staging/server/." "$app_dir/server/"
cp -a "$staging/package.json" "$app_dir/package.json"
cp -a "$staging/package-lock.json" "$app_dir/package-lock.json"
printf 'DEPLOYED stamp=%s image=%s backup_container=%s backup_dist=%s\n' "$stamp" "$new_image" "$backup_container" "$backup_dist"
