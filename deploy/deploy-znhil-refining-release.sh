#!/bin/sh
set -eu

archive=${1:?usage: deploy-znhil-refining-release.sh <release-archive>}
app_dir=/www/wwwroot/znhil-resume-app
data_dir=/www/wwwroot/resume-fit-isolated-20260728/data
live_container=resume-fit-isolated
stamp=$(date +%Y%m%d-%H%M%S)
staging="$app_dir/.refining-staging-$stamp"
backup_dist="$app_dir/dist.backup-$stamp"
backup_container="$live_container-backup-$stamp"
build_container="znhil-refining-build-$stamp"
test_container="znhil-refining-test-$stamp"
old_image=$(docker inspect "$live_container" --format '{{.Config.Image}}')
new_image="znhil-resume-refining:$stamp"
runtime_env="/root/znhil-refining-$stamp.env"
test_env="/root/znhil-refining-test-$stamp.env"

healthcheck() {
  port=$1
  attempts=0
  while [ "$attempts" -lt 30 ]; do
    if curl -fsS "http://127.0.0.1:$port/api/health" | grep -q '"ok":true'; then return 0; fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

mkdir "$staging"
tar -xzf "$archive" -C "$staging"
test -f "$staging/dist/index.html"
test -f "$staging/package.json"
test -f "$staging/package-lock.json"

docker inspect "$live_container" --format '{{range .Config.Env}}{{println .}}{{end}}' > "$runtime_env"
chmod 600 "$runtime_env"
sed 's/^BACKEND_PORT=.*/BACKEND_PORT=3199/' "$runtime_env" > "$test_env"
chmod 600 "$test_env"

docker create --name "$build_container" "$old_image" sleep infinity >/dev/null
docker cp "$staging/dist/." "$build_container:/app/dist"
docker cp "$staging/package.json" "$build_container:/app/package.json"
docker cp "$staging/package-lock.json" "$build_container:/app/package-lock.json"
docker start "$build_container" >/dev/null
docker exec "$build_container" npm ci --omit=dev --no-audit --no-fund --registry=https://registry.npmmirror.com --fetch-retries=2 --fetch-timeout=120000
docker stop "$build_container" >/dev/null
docker commit --change 'CMD ["node","server/index.mjs"]' "$build_container" "$new_image" >/dev/null
docker rm "$build_container" >/dev/null

docker run -d --name "$test_container" --network host --env-file "$test_env" -v "$data_dir:/app/data" "$new_image" >/dev/null
if ! healthcheck 3199; then
  docker logs --tail 60 "$test_container" || true
  docker stop "$test_container" >/dev/null 2>&1 || true
  docker rm "$test_container" >/dev/null 2>&1 || true
  echo STAGING_HEALTH_FAILED
  exit 1
fi

docker exec "$test_container" sh -lc 'mkdir -p /tmp/pdf-smoke && : > /tmp/pdf-smoke/source.pdf && node --input-type=module -e "import { createEditedPdf } from \"./server/pdfEditor.mjs\"; const name = await createEditedPdf({ originalResumeFileUrl: \"/api/resume-files/source.pdf\", text: \"张三\\n核心优势\\n- 负责内容整理与优化\\n教育经历\\n某大学 本科\", uploadDir: \"/tmp/pdf-smoke\" }); if (!name.endsWith(\".pdf\")) process.exit(1);"'

docker stop "$test_container" >/dev/null
docker rm "$test_container" >/dev/null
mv "$app_dir/dist" "$backup_dist"
mv "$staging/dist" "$app_dir/dist"
chown -R www:www "$app_dir/dist"

docker stop "$live_container" >/dev/null
docker rename "$live_container" "$backup_container"
if ! docker run -d --name "$live_container" --restart unless-stopped --network host --env-file "$runtime_env" -v "$data_dir:/app/data" "$new_image" >/dev/null; then
  docker rename "$backup_container" "$live_container"
  docker start "$live_container" >/dev/null
  mv "$app_dir/dist" "$app_dir/dist.failed-$stamp"
  mv "$backup_dist" "$app_dir/dist"
  echo CONTAINER_START_FAILED_ROLLED_BACK
  exit 1
fi
if ! healthcheck 3102; then
  docker logs --tail 60 "$live_container" || true
  docker stop "$live_container" >/dev/null 2>&1 || true
  docker rm "$live_container" >/dev/null 2>&1 || true
  docker rename "$backup_container" "$live_container"
  docker start "$live_container" >/dev/null
  mv "$app_dir/dist" "$app_dir/dist.failed-$stamp"
  mv "$backup_dist" "$app_dir/dist"
  echo PRODUCTION_HEALTH_FAILED_ROLLED_BACK
  exit 1
fi

cp -a "$staging/package.json" "$app_dir/package.json"
cp -a "$staging/package-lock.json" "$app_dir/package-lock.json"
printf 'DEPLOYED stamp=%s image=%s backup_container=%s backup_dist=%s\n' "$stamp" "$new_image" "$backup_container" "$backup_dist"
