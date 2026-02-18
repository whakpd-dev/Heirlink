# HeirLink Backend — production image
# Build: docker build -t heirlink-backend .
# Run:   docker run -p 3000:3000 --env-file .env heirlink-backend

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# ---

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Миграции применяются при старте контейнера (нужен DATABASE_URL)
CMD npx prisma migrate deploy && node dist/main.js
