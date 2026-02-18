# План мобильного приложения HeirLink

Документ описывает экраны, интеграцию с API и дальнейшие шаги для React Native (Expo) приложения.

---

## Текущее состояние

### Экраны

| Экран | Статус | API |
|-------|--------|-----|
| Auth (Login, Register) | ✅ | register, login, refresh |
| Feed | ✅ | getFeed, пагинация, pull-to-refresh; PostCard с данными и like/save API |
| PostDetail | ✅ | getPost, getComments, like/save, createComment — данные с API |
| Explore | ✅ | searchUsers, searchPosts (debounce), вкладки Люди/Посты; getSuggestions — рекомендации |
| Create | ✅ | до 10 фото (галерея/камера), uploadFile → createPost (медиа, подпись) |
| Activity | ✅ | getNotifications, markRead, markAllRead; тап → пост/профиль |
| Profile | ✅ | getMe, getUserProfile, getPostsByUser, follow/unfollow; EditProfile (bio, аватар) |
| Settings | ✅ | тёмная тема, выход; «Редактировать профиль» → Profile; «О приложении» → About |
| SmartAlbum | ✅ | upload → smartAlbumUpload, опрос job, список, деталь (SmartAlbumItem) |
| Stories (rail + viewer) | ✅ | getStoriesFeed, getMyStories, createStory; просмотр, добавление |
| LocalMedia | ✅ | локальная медиатека |

### API-сервис (api.ts)

Реализованы методы для: auth, posts (feed, save/unsave, saved), comments, users (profile, follow, followers/following, suggestions), notifications, search (users, posts), smart-album, health.

---

## Приоритеты интеграции

### 1. Лента (Feed)

- [x] При монтировании и pull-to-refresh вызывать `apiService.getFeed(page, limit)`.
- [x] Рендерить список постов из ответа (user, media, likesCount, commentsCount, isLiked, isSaved).
- [x] Пагинация: подгрузка при скролле (next page).
- [x] При нажатии на пост — переход в PostDetail с `postId`. PostCard: like/save через API, переход к комментариям/посту.

### 2. Деталь поста (PostDetail)

- [x] Загрузка поста по `postId`: `apiService.getPost(postId)` (с JWT — isLiked, isSaved).
- [x] Список комментариев: `apiService.getComments(postId)`, создание: `createComment` (ответы parentId — API готов, UI опционально).
- [x] Кнопки лайк / сохранить: `likePost`, `savePost` / `unsavePost` с обновлением локального состояния.

### 3. Поиск (Explore)

- [x] Поле ввода: при вводе (debounce 400ms) вызывать `apiService.searchUsers(q)` и `apiService.searchPosts(q)`.
- [x] Вкладки «Люди» / «Посты»: отображать результаты (люди — список с подписаться; посты — сетка, тап → PostDetail).
- [x] Блок рекомендаций при пустом поиске: `apiService.getSuggestions(limit)` — предложения подписаться.

### 4. Активность (Activity)

- [x] Загрузка уведомлений: `apiService.getNotifications(page, limit)`.
- [x] Отображение по типам: like, comment, follow, comment_reply (actor.username, текст, время, postId при наличии).
- [x] «Прочитать все»: `apiService.markAllNotificationsRead()`.
- [x] При тапе на уведомление — переход к посту (postId) или профилю (actor.id).

### 5. Профиль

- [x] Данные пользователя и счётчики с бэкенда (getUserProfile).
- [x] Сетка постов: `apiService.getPostsByUser(userId)` (свой или чужой по route.params.userId).
- [x] Вкладка «Сохранённые»: `apiService.getSavedPosts(page)` — сетка сохранённых постов (только свой профиль).
- [x] Чужой профиль: по userId в params — подписаться/отписаться, только вкладка «Посты», кнопка «Назад».
- [x] Редактирование профиля: экран EditProfile (аватар через upload type=avatars, био), updateProfile, обновление Redux (setUser).

### 6. Создание поста (Create)

- [x] Выбор медиа (галерея/камера), загрузка: `apiService.uploadFile()` → `apiService.createPost({ caption, media })`.
- [x] Поддержка caption (location опционально в API).

### 7. Smart Album

- [x] Загрузка медиа: pick → uploadFile → `smartAlbumUpload(mediaUrl)` → jobId.
- [x] Опрос статуса: `getSmartAlbumJob(jobId)` до done/failed.
- [x] Список: `getSmartAlbumItems()`, деталь: экран SmartAlbumItem с `getSmartAlbumItem(id)` (aiAnalysis, lifeMomentTags, locationData).

---

## Дальнейшие шаги (офлайн, push, UX)

### Офлайн

- [ ] Кэширование ленты и постов (AsyncStorage или SQLite) с TTL.
- [ ] Очередь действий (лайк, комментарий) при отсутствии сети с синхронизацией при появлении сети.

### Push-уведомления

- [ ] Expo Notifications: регистрация устройства, получение токена.
- [ ] Передача токена на бэкенд (эндпоинт для сохранения device token).
- [ ] Отправка push при новых like, comment, follow (бэкенд или сервис).

### Медиатека и доступ

- [ ] Полноценный доступ к медиатеке (development build при ограничениях Expo Go).
- [x] Выбор нескольких фото для поста (до 10, галерея с allowsMultipleSelection, камера добавляет одно).

### Общее

- [x] Обработка 401: выход из аккаунта и редирект на логин при истечении refresh (apiService.setOnUnauthorized → dispatch(logout)).
- [x] Индикаторы успеха: Toast (CreateScreen, SmartAlbum) при успешной публикации/добавлении. Ошибки по-прежнему через Alert.
- [x] Поддержка тёмной темы из настроек (ThemeContext, AsyncStorage, переключатель в Settings).

---

## Навигация

- **Main**: вкладки Feed, Explore, Create, Activity, Profile.
- **Feed**: FeedScreen → PostDetail, StoriesViewer.
- **Profile**: ProfileScreen → EditProfile, PostDetail, Settings, About, SmartAlbum, SmartAlbumItem, LocalMedia.
- Роуты и параметры (postId, userId) согласованы с бэкендом.

После каждой итерации: проверка на устройстве/симуляторе, при необходимости обновление бэкенда (деплой).
