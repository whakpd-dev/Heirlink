# Инструкция по запуску HeirLink

## 🚀 Быстрый старт

### 1. Предварительные требования

- Node.js 18+ 
- Python 3.10+
- PostgreSQL 14+
- Redis 6+
- Docker (опционально, для упрощения)

### 2. Клонирование и установка

```bash
# Перейти в директорию проекта
cd /Volumes/alim/HeirLink

# Установить зависимости для mobile
cd mobile
npm install

# Установить зависимости для backend
cd ../backend
npm install

# Установить зависимости для AI service
cd ../ai-service
pip install -r requirements.txt
```

### 3. Настройка окружения

#### Backend (.env)

```bash
cd backend
cp .env.example .env
```

Отредактируйте `.env`:
```env
DATABASE_URL="postgresql://heirlink:heirlink_dev@localhost:5432/heirlink_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
REDIS_URL="redis://localhost:6379"
PORT=3000
```

#### Mobile (.env)

```bash
cd mobile
cp .env.example .env
```

Для Android эмулятора используйте `10.0.2.2` вместо `localhost`:
```env
API_URL="http://10.0.2.2:3000"
API_BASE_URL="http://10.0.2.2:3000/api"
```

#### AI Service (.env)

```bash
cd ai-service
cp .env.example .env
```

### 4. Настройка базы данных

#### Вариант 1: Docker (рекомендуется)

```bash
# Запустить PostgreSQL и Redis
docker-compose up -d postgres redis

# Подождать несколько секунд для запуска
```

#### Вариант 2: Локальная установка

Установите PostgreSQL и Redis локально и создайте базу данных:

```sql
CREATE DATABASE heirlink_db;
CREATE USER heirlink WITH PASSWORD 'heirlink_dev';
GRANT ALL PRIVILEGES ON DATABASE heirlink_db TO heirlink;
```

### 5. Миграции базы данных

```bash
cd backend

# Генерация Prisma Client
npm run prisma:generate

# Применение миграций
npm run prisma:migrate

# (Опционально) Открыть Prisma Studio для просмотра данных
npm run prisma:studio
```

### 6. Запуск сервисов

#### Terminal 1: Backend

```bash
cd backend
npm run dev
```

Backend будет доступен на `http://localhost:3000`

#### Terminal 2: AI Service

```bash
cd ai-service
uvicorn main:app --reload
```

AI Service будет доступен на `http://localhost:8000`

#### Terminal 3: Mobile

```bash
cd mobile
npm start
```

Затем:
- Нажмите `i` для iOS симулятора
- Нажмите `a` для Android эмулятора
- Или отсканируйте QR код в Expo Go приложении

### 7. Проверка работы

#### Backend Health Check

```bash
curl http://localhost:3000/health
```

Должен вернуть:
```json
{"status":"ok","timestamp":"..."}
```

#### AI Service Health Check

```bash
curl http://localhost:8000/health
```

Должен вернуть:
```json
{"status":"healthy"}
```

#### Mobile App

1. Откройте приложение
2. Зарегистрируйте новый аккаунт
3. Войдите в систему
4. Должна открыться главная лента

## 🐛 Решение проблем

### Ошибка подключения к базе данных

- Убедитесь, что PostgreSQL запущен
- Проверьте `DATABASE_URL` в `.env`
- Проверьте права доступа пользователя

### Ошибка подключения к Redis

- Убедитесь, что Redis запущен
- Проверьте `REDIS_URL` в `.env`

### Mobile не может подключиться к API

- **iOS симулятор**: используйте `http://localhost:3000`
- **Android эмулятор**: используйте `http://10.0.2.2:3000`
- **Физическое устройство**: используйте IP адрес вашего компьютера в локальной сети

Найти IP адрес:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

Затем используйте `http://YOUR_IP:3000` в `.env`

### Prisma ошибки

```bash
# Очистить и перегенерировать
cd backend
rm -rf node_modules/.prisma
npm run prisma:generate
```

## 📝 Следующие шаги

После успешного запуска:

1. ✅ Аутентификация работает
2. ✅ Можно создавать посты
3. ✅ Можно просматривать ленту
4. 🔄 Реализовать загрузку медиа
5. 🔄 Реализовать Stories
6. 🔄 Реализовать Smart Album функции

## 🎯 Полезные команды

```bash
# Backend
npm run dev              # Запуск в режиме разработки
npm run prisma:studio    # Открыть Prisma Studio
npm run build            # Сборка для продакшена

# Mobile
npm start                # Запуск Expo
npm run ios              # Запуск на iOS
npm run android          # Запуск на Android

# AI Service
uvicorn main:app --reload    # Запуск в режиме разработки
uvicorn main:app --host 0.0.0.0 --port 8000  # Запуск на всех интерфейсах
```

## 📚 Документация

- [План разработки](./DEVELOPMENT_PLAN.md)
- [Архитектура](./docs/ARCHITECTURE.md)
- [Следующие шаги](./NEXT_STEPS.md)
