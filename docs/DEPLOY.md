# Деплой HeirLink Backend

API доступен по адресу `https://api.whakcomp.ru/api`. Сервер: **5.129.198.32** (root).

**Если правки в коде не видны в приложении** — убедись, что бэкенд на сервере обновлён: выполни деплой (см. ниже). Мобильное приложение дергает API с сервера; пока там старая сборка, фиксы (профиль, пользователи, поиск) работать не будут.

## Быстрый деплой одной командой

После однократной настройки SSH-ключа:

```bash
# Один раз: скопировать ключ на сервер (пароль введёте в терминале)
ssh-copy-id root@5.129.198.32

# Деплой (обновить код на сервере, собрать образ, перезапустить контейнер)
./scripts/deploy-to-server.sh
```

На сервере должны быть: клонированный репозиторий в `/root/HeirLink`, файл `backend/.env` с `DATABASE_URL`, `JWT_SECRET` и т.д., установленный Docker. Если папки ещё нет — зайдите по SSH и выполните клонирование репозитория в `/root/HeirLink`, создайте `backend/.env` из `backend/.env.example`.

## Требования на сервере

- Docker и Docker Compose (или только Docker)
- PostgreSQL (доступен по `DATABASE_URL`)
- Redis (по `REDIS_URL`, опционально для очередей)
- Переменные окружения из `backend/.env.example`

## 1. Локальная сборка и проверка

```bash
cd backend
cp .env.example .env
# Заполните .env (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_URL и т.д.)

docker build -t heirlink-backend .
docker run --rm -p 3000:3000 --env-file .env heirlink-backend
```

Проверка: `curl http://localhost:3000/api/health`

## 2. Деплой на сервер (вариант A: Docker на сервере)

На сервере, где уже подняты PostgreSQL и Redis:

```bash
# Перейти в каталог проекта
cd /path/to/HeirLink

# Собрать образ
docker build -t heirlink-backend ./backend

# Остановить старый контейнер (если был)
docker stop heirlink-backend 2>/dev/null; docker rm heirlink-backend 2>/dev/null

# Запустить с вашим .env (на сервере должен быть .env с DATABASE_URL и др.)
docker run -d \
  --name heirlink-backend \
  -p 3000:3000 \
  --env-file /path/to/backend/.env \
  --restart unless-stopped \
  heirlink-backend
```

При старте контейнер сам выполнит `prisma migrate deploy` (в т.ч. миграцию `add_messages` для чата).

## 3. Деплой на сервер (вариант B: docker-compose)

Если на сервере используется docker-compose (PostgreSQL и Redis в нём же):

```bash
cd /path/to/HeirLink
# В .env backend должны быть DATABASE_URL=postgresql://...@postgres:5432/... и REDIS_URL=redis://redis:6379
docker compose build backend
docker compose up -d backend
```

Таблица `messages` появится после первого запуска (миграция применится в `CMD`).

## 4. Обновление (релиз новой версии)

```bash
cd /path/to/HeirLink
git pull
docker build -t heirlink-backend ./backend
docker stop heirlink-backend && docker rm heirlink-backend
docker run -d --name heirlink-backend -p 3000:3000 --env-file ./backend/.env --restart unless-stopped heirlink-backend
```

Или с docker-compose:

```bash
git pull
docker compose build backend && docker compose up -d backend
```

## 5. Переменные окружения (production)

Обязательные:

- `DATABASE_URL` — PostgreSQL (например `postgresql://user:pass@host:5432/dbname?schema=public`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — секреты для токенов
- `PORT` — порт приложения (по умолчанию 3000)

Рекомендуемые:

- `REDIS_URL` — Redis (очереди, кэш)
- `NODE_ENV=production`
- `FRONTEND_URL` — разрешённый origin для CORS (URL мобильного приложения или сайта)
- Для загрузки медиа: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`
- Для Grok AI: `XAI_API_KEY` (ключ из x.ai)

## 6. Проверка после деплоя

- Health: `curl https://api.whakcomp.ru/api/health`
- Чаты: `GET https://api.whakcomp.ru/api/messages/conversations` с заголовком `Authorization: Bearer <token>`

Если эндпоинт `/api/messages/conversations` возвращает 200 (или пустой список), чат задеплоен.
