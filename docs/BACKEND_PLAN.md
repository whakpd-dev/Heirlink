# План разработки бэкенда HeirLink

Документ задаёт порядок и объём работ по бэкенду. Выполнять по шагам; после каждого блока — тесты и при необходимости деплой.

---

## Текущее состояние

| Модуль    | Статус | Что есть |
|-----------|--------|----------|
| Auth      | ✅     | register, login, refresh, GET /auth/me, JWT |
| Posts     | ✅     | create, findAll, feed, findByUser, findOne, delete, like |
| Prisma    | ✅     | User, Post, Media, Like, Comment, Follow, Story, SmartAlbumItem, AiAnalysis |
| Users     | ✅     | GET /users/:id (профиль + stats + isFollowing), PATCH /users/me, follow/unfollow, followers/following |
| Comments  | ✅     | create, list, update, delete по комментариям к постам |
| Stories   | ✅     | create, feed, me, delete, TTL 24h |
| Upload    | ✅     | POST /upload (локальное хранилище), GET /uploads/:type/:filename |
| SmartAlbum| ❌     | Нет API под AI-сервис |

---

## Фаза 1: Пользователи и профиль ✅

### 1.1 UsersModule

- [x] **UsersModule, UsersService, UsersController**
- [x] **GET /users/:id** — публичный профиль по id (id, username, avatarUrl, bio, createdAt; без email). С опциональным JWT — isFollowing, isViewer.
- [x] **PATCH /users/me** (JWT) — обновление своего профиля: avatarUrl, bio (UpdateProfileDto + class-validator).
- [x] В GET /users/:id: postsCount, followersCount, followingCount.
- [x] OptionalJwtAuthGuard для публичного профиля с опциональным токеном.

### 1.2 Подписки (Follow)

- [x] **Follow** в UsersService/UsersController.
- [x] **POST /users/:id/follow** (JWT) — подписаться (идемпотентно).
- [x] **DELETE /users/:id/follow** (JWT) — отписаться.
- [x] **GET /users/:id/followers** — список подписчиков (пагинация, id/username/avatarUrl).
- [x] **GET /users/:id/following** — список подписок.
- [x] Запрет подписки на себя (BadRequestException); upsert для идемпотентности.

---

## Фаза 2: Комментарии

### 2.1 CommentsModule

- [ ] **CommentsModule, CommentsService, CommentsController**
- [ ] **POST /posts/:postId/comments** (JWT) — создание комментария (text, опционально parentId для ответа).
- [ ] **GET /posts/:postId/comments** — список комментариев поста (пагинация, сортировка по дате; дерево или flat с parentId).
- [ ] **PATCH /comments/:id** (JWT) — редактирование своего комментария (только text).
- [ ] **DELETE /comments/:id** (JWT) — удаление своего комментария (или soft delete).
- [ ] DTO: CreateCommentDto, UpdateCommentDto. Валидация (макс. длина text).
- [ ] В ответах комментариев отдавать user: { id, username, avatarUrl }.

---

## Фаза 3: Загрузка медиа (Upload)

### 3.1 Хранилище файлов

- [ ] Выбор стратегии: **локальная папка** (upload/) или **S3-совместимое хранилище** (MinIO/AWS).
- [ ] **UploadModule**: сервис, который принимает file(s), сохраняет, возвращает URL (и при необходимости thumbnail URL).
- [ ] Эндпоинт **POST /upload** (JWT) или **POST /upload/image**, **POST /upload/video** — multipart/form-data, лимиты размера, проверка MIME.
- [ ] Генерация уникальных имён файлов; при S3 — пресеты/пути (avatars/, posts/, stories/).
- [ ] Опционально: генерация thumbnail для видео (ffmpeg) или отложенная задача.

### 3.2 Связка с постами и профилем

- [ ] **Posts**: CreatePostDto принимать либо URL медиа (как сейчас), либо **file IDs/URLs после upload** (клиент сначала upload, потом создаёт пост с полученными URL).
- [ ] **PATCH /users/me**: возможность загрузки аватара через multipart или передача avatarUrl после upload.

---

## Фаза 4: Stories

### 4.1 StoriesModule

- [ ] **StoriesModule, StoriesService, StoriesController**
- [ ] **POST /stories** (JWT) — создание истории: media (url или upload), type (photo/video). Записывать expiresAt (например createdAt + 24h).
- [ ] **GET /stories** (JWT) — лента историй: сгруппировать по пользователям (друзья/подписки), для каждого — последние активные, с флагом "просмотрено" при необходимости.
- [ ] **GET /stories/me** (JWT) — свои активные истории.
- [ ] **DELETE /stories/:id** (JWT) — удаление своей истории.
- [ ] Cron или периодическая задача: удаление записей с expiresAt < now (или пометка isExpired).

### 4.2 Схема и медиа

- [ ] Использовать существующую модель Story (и Media при необходимости). При расхождении — миграция Prisma.
- [ ] Ответы API включают mediaUrl, type, expiresAt, user (id, username, avatarUrl).

---

## Фаза 5: Дополнительные фичи постов и ленты

### 5.1 Сохранённые посты (Saved / Bookmarks)

- [x] В Prisma: модель **SavedPost** (userId, postId, createdAt).
- [x] **POST /posts/:id/save** (JWT), **DELETE /posts/:id/save** (JWT).
- [x] **GET /posts/saved** (JWT) — список сохранённых постов (пагинация).
- [x] В ленте/постах при запросе с JWT отдавать флаг **isSaved** для текущего пользователя.

### 5.2 Улучшение ленты и постов

- [x] **GET /posts/feed**: только посты от подписок (following); пагинация; сортировка по дате.
- [x] **GET /posts/:id**: с опциональным JWT отдавать isLiked, isSaved; количество лайков и комментариев.
- [x] Единый формат ответа поста: user, media[], likesCount, commentsCount, isLiked, isSaved (если есть JWT).

---

## Фаза 6: Уведомления (опционально, но желательно)

### 6.1 Модель и API

- [x] Prisma: модель **Notification** (userId, type, actorId, postId?, commentId?, read, createdAt).
- [x] Типы: like, comment, follow, comment_reply.
- [x] **GET /notifications** (JWT) — список уведомлений пользователя (пагинация).
- [x] **PATCH /notifications/:id/read**, **POST /notifications/read-all** (JWT).
- [x] Создание уведомлений: в PostsService (like), CommentsService (comment, comment_reply), UsersService (follow).

---

## Фаза 7: Поиск и рекомендации

### 7.1 Поиск

- [x] **GET /search/users?q=** (JWT опционально) — поиск пользователей по username (Prisma contains, mode: insensitive).
- [x] **GET /search/posts?q=** — по caption (ILIKE).
- [x] Лимиты, пагинация, санитизация запроса (trim, макс. длина 100).

### 7.2 Рекомендации (упрощённо)

- [x] **GET /users/suggestions** (JWT) — предложения "подписаться": пользователи, на которых подписаны ваши подписки (исключая себя и уже подписанных).
- [x] При отсутствии данных — топ по количеству подписчиков (following._count desc).

---

## Фаза 8: Smart Album и интеграция с AI

### 8.1 SmartAlbumModule

- [x] **POST /smart-album/upload** (JWT) — принять mediaUrl в body (UploadMediaDto), создать SmartAlbumJob (pending), вызвать ai-service POST /api/analyze; вернуть jobId (202 Accepted).
- [x] **GET /smart-album/jobs/:jobId** (JWT) — статус задачи (pending/processing/done/failed); при processing опционально опрос ai-service GET /api/task/:taskId.
- [x] **GET /smart-album/items** (JWT) — список своих SmartAlbumItem (пагинация).
- [x] **GET /smart-album/items/:id** (JWT) — один элемент с aiAnalysis, lifeMomentTags, locationData, originalMediaId, restored/animated при наличии.
- [x] Модель **SmartAlbumJob** в Prisma (userId, status, mediaUrl, aiTaskId?, resultItemId?, errorMessage?).
- [x] Вызов ai-service по AI_SERVICE_URL (HTTP), сохранение результата в SmartAlbumItem при status completed.

### 8.2 Согласование с ai-service

- [x] Контракт: вход media_id (URL), выход /api/analyze — status completed + analysis (event_type, emotions, estimated_date, location и т.д.); /api/task/:taskId для polling.
- [ ] Очередь (Redis/Bull) — опционально; пока простой HTTP-вызов с фоновым обновлением при GET job.

---

## Фаза 9: Качество и инфраструктура

### 9.1 Валидация и DTO

- [x] DTO с class-validator в модулях (auth, comments, smart-album, upload, users и т.д.).
- [x] Глобальный ValidationPipe в main.ts (whitelist, forbidNonWhitelisted, transform).
- [x] Единый формат ошибок (HttpExceptionFilter + AllExceptionsFilter): { statusCode, error, message }.

### 9.2 Безопасность и лимиты

- [x] Rate limiting (ThrottlerModule): по IP, 10 req/1s и 200 req/60s глобально.
- [x] CORS: FRONTEND_URL или * (настроить origin для продакшена в .env).
- [x] Поиск: санитизация запроса (trim, макс. длина), Prisma contains — без сырого SQL.

### 9.3 Документация и здоровье

- [x] Swagger/OpenAPI: **GET /api/docs** — описание API (DocumentBuilder, addBearerAuth), UI через swagger-ui-express.
- [x] **GET /api/health** — проверка БД (Prisma.$queryRaw\`SELECT 1\`), опционально ping AI_SERVICE_URL/health; ответ { status: ok|degraded, db, ai?, timestamp }.

### 9.4 Тесты

- [ ] Unit-тесты для сервисов (auth, users, posts, comments, stories, follow).
- [x] E2E заготовка: test/app.e2e-spec.ts (GET /api, GET /api/health с моком AppService), скрипт **npm run test:e2e** (jest --config ./test/jest-e2e.json).

---

## Порядок выполнения (кратко)

1. **Фаза 1** — Users + Follow (профиль, подписки, счётчики).
2. **Фаза 2** — Comments (комментарии к постам).
3. **Фаза 3** — Upload (файлы для постов, аватаров, историй).
4. **Фаза 4** — Stories (создание, лента, удаление, TTL).
5. **Фаза 5** — Saved posts + доработка feed/one post.
6. **Фаза 6** — Notifications (модель + API + создание событий).
7. **Фаза 7** — Search + suggestions.
8. **Фаза 8** — Smart Album + AI.
9. **Фаза 9** — Валидация, безопасность, документация, тесты.

После каждой фазы: миграции при изменении схемы, проверка API, при необходимости обновление мобильного клиента.

---

## План по мобильному приложению (отдельный документ)

**docs/MOBILE_PLAN.md** — экраны, статус интеграции с API, приоритеты (лента, пост, поиск, активность, профиль, создание поста, Smart Album), офлайн, push, медиатека.
