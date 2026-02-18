# Архитектура HeirLink

## Обзор системы

HeirLink состоит из трех основных компонентов:

1. **Mobile App** (React Native/Expo)
2. **Backend API** (NestJS)
3. **AI Service** (FastAPI)

## Поток данных

### Обычный пост

```
User (Mobile) 
  → Upload Media 
  → Backend API 
  → Media Storage (S3/CDN)
  → Save to Database
  → Notify Followers
  → Display in Feed
```

### Smart Album - Оживление фото

```
User (Mobile)
  → Select Photo
  → Upload to Backend
  → Backend queues task
  → AI Service receives task
  → Process with AnimateDiff
  → Save result to Storage
  → Webhook to Backend
  → Backend updates DB
  → Push notification to User
  → Display in Smart Album
```

### Smart Album - Восстановление фото

```
User (Mobile)
  → Select Old Photo
  → Upload to Backend
  → Backend queues task
  → AI Service receives task
  → Process with ESRGAN
  → Save result to Storage
  → Webhook to Backend
  → Backend updates DB
  → Push notification to User
  → Display before/after comparison
```

### Smart Album - Анализ фото

```
User (Mobile)
  → Upload Photo
  → Backend sends to AI Service
  → AI Service analyzes with:
    - CLIP (scene understanding)
    - BLIP (captioning)
    - Vision API (objects, faces)
    - Geocoding (if location data)
  → Return analysis JSON
  → Backend saves to DB
  → Display in Smart Album
```

## Технологические решения

### Почему React Native/Expo?

- Кроссплатформенность (iOS + Android)
- Быстрая разработка
- Большое сообщество
- Готовые библиотеки для камеры/галереи

### Почему NestJS?

- TypeScript из коробки
- Модульная архитектура
- Встроенная валидация
- Легкая интеграция с Prisma

### Почему FastAPI для AI?

- Асинхронность
- Автоматическая документация
- Легкая интеграция с Python ML библиотеками
- Высокая производительность

### Почему PostgreSQL?

- Надежность
- JSON поддержка (для AI анализа)
- Отличная производительность
- Prisma поддержка

## Безопасность

- JWT токены для аутентификации
- Хеширование паролей (bcrypt)
- Валидация всех входных данных
- Rate limiting
- CORS настройки
- Защита от SQL инъекций (Prisma)

## Масштабирование

### Горизонтальное масштабирование

- Backend: Несколько инстансов за load balancer
- AI Service: Отдельные воркеры для разных задач
- Database: Read replicas для чтения
- Media: CDN для быстрой доставки

### Вертикальное масштабирование

- AI Service: GPU серверы для обработки
- Database: Больше RAM и CPU
- Redis: Кластер для кэширования

## Мониторинг

- Логирование (Winston для Node, стандартный для Python)
- Метрики (Prometheus + Grafana)
- Трассировка ошибок (Sentry)
- Health checks для всех сервисов
