#!/bin/sh
# Word 导出增强版部署脚本
# 基于 deploy-znhil-release.sh + deploy-znhil-refining-release.sh
# 新增：Python 依赖安装（PyMuPDF + pdf2docx）用于 Word 导出
set -eu

archive=${1:?usage: deploy-znhil-word-release.sh <release-archive>}
app_dir=/www/wwwroot/znhil-resume-app
data_dir=/www/wwwroot/resume-fit-isolated-20260728/data
live_container=resume-fit-isolated
stamp=$(date +%Y%m%d-%H%M%S)
staging="$app_dir/.word-staging-$stamp"
backup_dist="$app_dir/dist.backup-$stamp"
backup_container="$live_container-backup-$stamp"
build_container="znhil-word-build-$stamp"
test_container="znhil-word-test-$stamp"
new_image="znhil-resume-word:$stamp"
runtime_env="/root/znhil-word-runtime-$stamp.env"
test_env="/root/znhil-word-test-$stamp.env"
patch_script="/root/patch-production-ai-route.mjs"

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

echo "=== 1/8 解压发布包 ==="
mkdir "$staging"
tar -xzf "$archive" -C "$staging"
test -f "$staging/dist/index.html"
test -f "$staging/server/index.mjs"
test -f "$staging/server/app.mjs"
test -f "$staging/server/wordEditor.mjs"
test -f "$staging/server/vendor/pdf2docx_convert.py"
test -f "$staging/package.json"
test -f "$staging/package-lock.json"
test -f "$staging/requirements-pdf.txt"
echo "OK: 发布包完整性检查通过"

# 如果 /root/patch-production-ai-route.mjs 不存在，从发布包里取
if [ ! -f "$patch_script" ]; then
  echo "=== 补丁脚本不在 /root/，从发布包提取 ==="
  cp "$staging/deploy/patch-production-ai-route.mjs" "$patch_script"
fi
test -f "$patch_script"

echo "=== 2/8 提取运行时环境 ==="
old_image=$(docker inspect "$live_container" --format '{{.Config.Image}}')
docker inspect "$live_container" --format '{{range .Config.Env}}{{println .}}{{end}}' > "$runtime_env"
chmod 600 "$runtime_env"
sed 's/^BACKEND_PORT=.*/BACKEND_PORT=3199/' "$runtime_env" > "$test_env"
chmod 600 "$test_env"
echo "OK: 旧镜像=$old_image"

echo "=== 3/8 补丁生产版 AI 路由 ==="
docker cp "$live_container:/app/server/app.mjs" "$staging/production-app.mjs"
node "$patch_script" "$staging/production-app.mjs"
echo "OK: AI 路由补丁已应用"

echo "=== 4/8 构建新镜像（含 npm + Python 依赖）==="
docker create --name "$build_container" "$old_image" sleep infinity >/dev/null
docker start "$build_container" >/dev/null

# 复制前端产物
docker cp "$staging/dist/." "$build_container:/app/dist"

# 复制服务端代码（含 wordEditor.mjs、basicInfoMerge.mjs、vendor Python 脚本）
docker cp "$staging/server/." "$build_container:/app/server"

# 复制配置文件
docker cp "$staging/package.json" "$build_container:/app/package.json"
docker cp "$staging/package-lock.json" "$build_container:/app/package-lock.json"
docker cp "$staging/requirements-pdf.txt" "$build_container:/app/requirements-pdf.txt"

# 复制补丁后的 app.mjs（覆盖 docker cp server/. 带进来的原始版）
docker cp "$staging/production-app.mjs" "$build_container:/app/server/app.mjs"

# 安装 npm 依赖（使用国内镜像加速）
echo "--- 安装 npm 依赖 ---"
docker exec "$build_container" npm ci --omit=dev --no-audit --no-fund \
  --registry=https://registry.npmmirror.com --fetch-retries=2 --fetch-timeout=120000

# 安装 Python 依赖（Word 导出必需）
echo "--- 安装 Python 依赖 ---"
# 检测包管理器并安装 pip（Alpine 用 apk，Debian 用 apt-get）
docker exec "$build_container" sh -lc '
  if command -v pip3 >/dev/null 2>&1; then
    echo "pip3 already available"
  elif command -v pip >/dev/null 2>&1; then
    echo "pip already available"
  elif command -v apk >/dev/null 2>&1; then
    echo "Alpine: installing python3 + py3-pip"
    apk add --no-cache python3 py3-pip
  elif command -v apt-get >/dev/null 2>&1; then
    echo "Debian: installing python3 + python3-pip"
    apt-get update -qq && apt-get install -y --no-install-recommends python3 python3-pip python3-venv
  else
    echo "WARNING: 无法识别包管理器，Python 依赖可能安装失败"
    exit 0
  fi
'
# 安装 pymupdf + pdf2docx（使用国内镜像加速）
docker exec "$build_container" sh -lc '
  pip3 install --break-system-packages -i https://pypi.tuna.tsinghua.edu.cn/simple \
    PyMuPDF==1.28.0 pdf2docx==0.5.8 2>/dev/null \
  || pip3 install -i https://pypi.tuna.tsinghua.edu.cn/simple \
    PyMuPDF==1.28.0 pdf2docx==0.5.8 2>/dev/null \
  || pip3 install PyMuPDF==1.28.0 pdf2docx==0.5.8 \
  || echo "WARNING: Python 依赖安装失败，Word 导出将降级为纯文本模式"
'
# 验证 Python 依赖
docker exec "$build_container" sh -lc '
  python3 -c "import pymupdf; import pdf2docx; print(\"Python deps OK: pymupdf=\" + pymupdf.__version__)" 2>/dev/null \
  || echo "WARNING: Python 依赖验证失败，Word 导出将降级为纯文本模式"
'

docker stop "$build_container" >/dev/null
docker commit --change 'CMD ["node","server/index.mjs"]' "$build_container" "$new_image" >/dev/null
docker rm "$build_container" >/dev/null
echo "OK: 新镜像构建完成=$new_image"

echo "=== 5/8 测试容器健康检查（端口 3199）==="
docker run -d \
  --name "$test_container" \
  --network host \
  --env-file "$test_env" \
  -v "$data_dir:/app/data" \
  "$new_image" >/dev/null

if ! healthcheck 3199; then
  echo "FAIL: 测试容器健康检查失败"
  docker logs --tail 60 "$test_container" || true
  docker stop "$test_container" >/dev/null 2>&1 || true
  docker rm "$test_container" >/dev/null 2>&1 || true
  echo "STAGING_HEALTH_FAILED"
  exit 1
fi
echo "OK: 测试容器健康检查通过"

echo "=== 6/8 PDF 编辑器冒烟测试 ==="
docker exec "$test_container" sh -lc '
  mkdir -p /tmp/pdf-smoke && : > /tmp/pdf-smoke/source.pdf
  node --input-type=module -e "
    import { createEditedPdf } from \"./server/pdfEditor.mjs\";
    const name = await createEditedPdf({
      originalResumeFileUrl: \"/api/resume-files/source.pdf\",
      text: \"张三\\n核心优势\\n- 负责内容整理与优化\\n教育经历\\n某大学 本科\",
      uploadDir: \"/tmp/pdf-smoke\"
    });
    if (!name.endsWith(\".pdf\")) process.exit(1);
    console.log(\"PDF smoke test OK\");
  " 2>&1 || echo "WARNING: PDF 冒烟测试未通过（非阻断）"
'

docker stop "$test_container" >/dev/null
docker rm "$test_container" >/dev/null

echo "=== 7/8 替换生产容器 ==="
# 备份当前 dist
mv "$app_dir/dist" "$backup_dist"
mv "$staging/dist" "$app_dir/dist"
chown -R www:www "$app_dir/dist"

# 停止并备份旧容器
docker stop "$live_container" >/dev/null
docker rename "$live_container" "$backup_container"

# 启动新容器
if ! docker run -d \
  --name "$live_container" \
  --restart unless-stopped \
  --network host \
  --env-file "$runtime_env" \
  -v "$data_dir:/app/data" \
  "$new_image" >/dev/null; then
  echo "FAIL: 新容器启动失败，执行回滚"
  docker rename "$backup_container" "$live_container"
  docker start "$live_container" >/dev/null
  mv "$app_dir/dist" "$app_dir/dist.failed-$stamp"
  mv "$backup_dist" "$app_dir/dist"
  echo "CONTAINER_START_FAILED_ROLLED_BACK"
  exit 1
fi

# 生产健康检查
if ! healthcheck 3102; then
  echo "FAIL: 生产容器健康检查失败，执行回滚"
  docker logs --tail 60 "$live_container" || true
  docker stop "$live_container" >/dev/null 2>&1 || true
  docker rm "$live_container" >/dev/null 2>&1 || true
  docker rename "$backup_container" "$live_container"
  docker start "$live_container" >/dev/null
  mv "$app_dir/dist" "$app_dir/dist.failed-$stamp"
  mv "$backup_dist" "$app_dir/dist"
  echo "PRODUCTION_HEALTH_FAILED_ROLLED_BACK"
  exit 1
fi
echo "OK: 生产容器已启动且健康检查通过"

echo "=== 8/8 同步源码文件 ==="
for directory in src public deploy; do
  if [ -d "$staging/$directory" ]; then
    cp -a "$staging/$directory/." "$app_dir/$directory/"
  fi
done

cp -a "$staging/production-app.mjs" "$app_dir/server/app.mjs"

for file in package.json package-lock.json index.html admin.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ecosystem.config.cjs README.md DESIGN.md DEPLOYMENT.md RELEASE_CHECKLIST.md THIRD_PARTY_NOTICES.md .env.example requirements-pdf.txt; do
  if [ -f "$staging/$file" ]; then
    cp -a "$staging/$file" "$app_dir/$file"
  fi
done

# 清理临时文件
rm -f "$runtime_env" "$test_env"
rm -rf "$staging"

echo ""
echo "========================================"
echo "DEPLOYED SUCCESSFULLY"
echo "  stamp:       $stamp"
echo "  image:       $new_image"
echo "  backup:      $backup_container"
echo "  dist_backup: $backup_dist"
echo "  health:      http://127.0.0.1:3102/api/health"
echo "  site:        https://znhil.xyz/"
echo "========================================"
echo ""
echo "验证命令："
echo "  curl http://127.0.0.1:3102/api/health"
echo "  curl -I https://znhil.xyz/"
echo ""
echo "如需回滚："
echo "  docker stop $live_container && docker rm $live_container"
echo "  docker rename $backup_container $live_container && docker start $live_container"
echo "  mv $backup_dist $app_dir/dist"
