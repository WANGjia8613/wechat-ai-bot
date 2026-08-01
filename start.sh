#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""

cleanup() {
  echo ""
  echo "[start.sh] 正在停止服务..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID"
  fi
}
trap cleanup EXIT INT TERM

echo "[start.sh] 检查后端依赖..."
cd "$ROOT/backend"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi

echo "[start.sh] 检查前端依赖..."
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi

echo "[start.sh] 启动后端 (端口 3001)..."
cd "$ROOT/backend"
node src/index.js &
BACKEND_PID=$!

echo "[start.sh] 启动前端 (端口 5173)..."
cd "$ROOT/frontend"
exec npm run dev
