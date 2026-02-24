#!/usr/bin/env bash
# Deploy backend to a remote server via SSH.
#
# Required env vars (or set defaults below):
#   SSH_HOST   — server IP/hostname
#   SSH_USER   — SSH user (default: root)
#   REMOTE_PATH — path on server (default: /root/HeirLink)
#
# First-time setup:
#   ssh-copy-id $SSH_USER@$SSH_HOST

set -euo pipefail

SSH_HOST="${SSH_HOST:?Set SSH_HOST env var}"
SSH_USER="${SSH_USER:-root}"
REMOTE_PATH="${REMOTE_PATH:-/root/HeirLink}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

echo "Deploying to ${SSH_USER}@${SSH_HOST} (${REMOTE_PATH})..."

if ! ssh ${SSH_OPTS} "${SSH_USER}@${SSH_HOST}" "test -d ${REMOTE_PATH}"; then
  echo "Error: directory ${REMOTE_PATH} not found on server."
  echo "Clone the repo first:"
  echo "  ssh ${SSH_USER}@${SSH_HOST} 'git clone <REPO_URL> ${REMOTE_PATH}'"
  exit 1
fi

ssh ${SSH_OPTS} "${SSH_USER}@${SSH_HOST}" bash -s <<REMOTE_SCRIPT
  set -euo pipefail
  cd "${REMOTE_PATH}"
  git pull
  cd backend
  npm ci --omit=dev
  npx prisma generate
  npm run build
  npx prisma migrate deploy
  pm2 restart heirlink-backend --update-env || pm2 start dist/main.js --name heirlink-backend
REMOTE_SCRIPT

echo "Done. Health check: curl https://\${SSH_HOST}/api/health"
