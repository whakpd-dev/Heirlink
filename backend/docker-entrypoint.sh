#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy
echo "[entrypoint] Migrations applied successfully."

echo "[entrypoint] Starting application..."
exec node dist/main.js
