#!/usr/bin/env bash
# Деплой бэкенда на сервер по SSH (5.129.198.32).
#
# Первый раз настройте вход по ключу (пароль введёте один раз):
#   ssh-copy-id root@5.129.198.32
#
# На сервере должны быть: репозиторий в $REMOTE_PATH, backend/.env, Docker.
# Использование:
#   ./scripts/deploy-to-server.sh

set -e

SSH_HOST="${SSH_HOST:-5.129.198.32}"
SSH_USER="${SSH_USER:-root}"
REMOTE_PATH="${REMOTE_PATH:-/root/HeirLink}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

echo "Deploying to $SSH_USER@$SSH_HOST ($REMOTE_PATH)..."

# Проверка доступа
if ! ssh $SSH_OPTS "$SSH_USER@$SSH_HOST" "test -d $REMOTE_PATH"; then
  echo "Error: directory $REMOTE_PATH not found on server."
  echo "Create it and clone the repo first, e.g.:"
  echo "  ssh $SSH_USER@$SSH_HOST 'git clone https://github.com/YOUR_USER/HeirLink.git $REMOTE_PATH'"
  exit 1
fi

# Команды на сервере: обновить код, собрать образ, перезапустить контейнер
ssh $SSH_OPTS "$SSH_USER@$SSH_HOST" "cd $REMOTE_PATH && git pull && docker build -t heirlink-backend ./backend && docker stop heirlink-backend 2>/dev/null || true && docker rm heirlink-backend 2>/dev/null || true && docker run -d --name heirlink-backend -p 3000:3000 --env-file $REMOTE_PATH/backend/.env --restart unless-stopped heirlink-backend"

echo "Done. Check: curl http://$SSH_HOST:3000/api/health"
