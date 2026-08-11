#!/bin/sh
set -eu

archive=${1:?usage: deploy-znhil-release.sh <release-archive>}
app_dir=/www/wwwroot/znhil-resume-app
data_dir=/www/wwwroot/resume-fit-isolated-20260728/data
live_container=resume-fit-isolated
stamp=$(date +%Y%m%d-%H%M%S)
staging="$app_dir/.deploy-staging-$stamp"
backup_dist="$app_dir/dist.backup-$stamp"
backup_container="$live_container-backup-$stamp"
build_container="znhil-build-$stamp"
test_container="znhil-test-$stamp"
new_image="znhil-resume-release:$stamp"
runtime_env="/root/znhil-runtime-$stamp.env"
test_env="/root/znhil-runtime-test-$stamp.env"

healthcheck() {
  port=$1
  attempts=0
  while [ "$attempts" -lt 30 ]; do
    if curl -fsS "http://127.0.0.1:$port/api/health" | grep -q '"ok":true'; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

mkdir "$staging"
tar -xzf "$archive" -C "$staging"
test -f "$staging/dist/index.html"
test -f "$staging/server/index.mjs"
test -f "$staging/server/app.mjs"
test -f "$staging/src/components/ProductShell.tsx"
test -f /root/patch-production-ai-route.mjs

old_image=$(docker inspect "$live_container" --format '{{.Config.Image}}')
docker inspect "$live_container" --format '{{range .Config.Env}}{{println .}}{{end}}' > "$runtime_env"
chmod 600 "$runtime_env"
sed 's/^BACKEND_PORT=.*/BACKEND_PORT=3199/' "$runtime_env" > "$test_env"
chmod 600 "$test_env"

docker cp "$live_container:/app/server/app.mjs" "$staging/production-app.mjs"
node /root/patch-production-ai-route.mjs "$staging/production-app.mjs"

docker create --name "$build_container" "$old_image" >/dev/null
docker cp "$staging/dist/." "$build_container:/app/dist"
docker cp "$staging/production-app.mjs" "$build_container:/app/server/app.mjs"
docker commit --change 'CMD ["node","server/index.mjs"]' "$build_container" "$new_image" >/dev/null
docker rm "$build_container" >/dev/null

docker run -d \
  --name "$test_container" \
  --network host \
  --env-file "$test_env" \
  -v "$data_dir:/app/data" \
  "$new_image" >/dev/null

if ! healthcheck 3199; then
  docker logs --tail 40 "$test_container" || true
  docker stop "$test_container" >/dev/null 2>&1 || true
  docker rm "$test_container" >/dev/null 2>&1 || true
  echo "STAGING_HEALTH_FAILED"
  exit 1
fi

docker stop "$test_container" >/dev/null
docker rm "$test_container" >/dev/null

mv "$app_dir/dist" "$backup_dist"
mv "$staging/dist" "$app_dir/dist"
chown -R www:www "$app_dir/dist"

docker stop "$live_container" >/dev/null
docker rename "$live_container" "$backup_container"

if ! docker run -d \
  --name "$live_container" \
  --restart unless-stopped \
  --network host \
  --env-file "$runtime_env" \
  -v "$data_dir:/app/data" \
  "$new_image" >/dev/null; then
  docker rename "$backup_container" "$live_container"
  docker start "$live_container" >/dev/null
  mv "$app_dir/dist" "$app_dir/dist.failed-$stamp"
  mv "$backup_dist" "$app_dir/dist"
  echo "CONTAINER_START_FAILED_ROLLED_BACK"
  exit 1
fi

if ! healthcheck 3102; then
  docker logs --tail 40 "$live_container" || true
  docker stop "$live_container" >/dev/null 2>&1 || true
  docker rm "$live_container" >/dev/null 2>&1 || true
  docker rename "$backup_container" "$live_container"
  docker start "$live_container" >/dev/null
  mv "$app_dir/dist" "$app_dir/dist.failed-$stamp"
  mv "$backup_dist" "$app_dir/dist"
  echo "PRODUCTION_HEALTH_FAILED_ROLLED_BACK"
  exit 1
fi

for directory in src public deploy docs; do
  if [ -d "$staging/$directory" ]; then
    cp -a "$staging/$directory/." "$app_dir/$directory/"
  fi
done

cp -a "$staging/production-app.mjs" "$app_dir/server/app.mjs"

for file in package.json package-lock.json index.html admin.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ecosystem.config.cjs README.md DESIGN.md DEPLOYMENT.md RELEASE_CHECKLIST.md THIRD_PARTY_NOTICES.md .env.example; do
  if [ -f "$staging/$file" ]; then
    cp -a "$staging/$file" "$app_dir/$file"
  fi
done

printf 'DEPLOYED stamp=%s image=%s backup_container=%s backup_dist=%s\n' "$stamp" "$new_image" "$backup_container" "$backup_dist"
