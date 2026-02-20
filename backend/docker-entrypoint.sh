#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy || echo "[entrypoint] WARNING: Migration failed, continuing..."

echo "[entrypoint] Starting application..."
exec node dist/main.js
