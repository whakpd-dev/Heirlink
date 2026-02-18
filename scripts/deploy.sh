#!/usr/bin/env bash
# Сборка и деплой бэкенда HeirLink
# Использование: ./scripts/deploy.sh [run]
#   без аргументов — только сборка образа
#   run — собрать и запустить контейнер (нужен backend/.env)

set -e
cd "$(dirname "$0")/.."
BACKEND_DIR="backend"
IMAGE_NAME="heirlink-backend"

echo "Building $IMAGE_NAME..."
docker build -t "$IMAGE_NAME" "$BACKEND_DIR"

if [[ "${1:-}" == "run" ]]; then
  if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    echo "Create $BACKEND_DIR/.env from .env.example and set DATABASE_URL, JWT_SECRET, etc."
    exit 1
  fi
  echo "Stopping old container (if any)..."
  docker stop "$IMAGE_NAME" 2>/dev/null || true
  docker rm "$IMAGE_NAME" 2>/dev/null || true
  echo "Starting $IMAGE_NAME on port 3000..."
  docker run -d --name "$IMAGE_NAME" -p 3000:3000 --env-file "$BACKEND_DIR/.env" --restart unless-stopped "$IMAGE_NAME"
  echo "Done. Check: curl http://localhost:3000/api/health"
else
  echo "Image $IMAGE_NAME built. To run locally: ./scripts/deploy.sh run"
  echo "To deploy on server: see docs/DEPLOY.md"
fi
