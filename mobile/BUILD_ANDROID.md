# Сборка APK для Android

## Локальная сборка (рекомендуется)

**Требования:** установлены Android SDK (`ANDROID_HOME` или `~/Library/Android/sdk` на macOS), Java 17.

```bash
cd mobile
npm run build:apk
```

Готовый APK будет:
- `mobile/build/HeirLink-preview.apk`
- или `mobile/android/app/build/outputs/apk/release/app-release.apk`

Первая сборка занимает 5–10 минут (скачиваются зависимости).

## Через EAS (облако)

Когда сбросится лимит бесплатного плана (см. [billing](https://expo.dev/accounts/alimwhak/settings/billing)):

```bash
cd mobile
npx eas build --profile preview --platform android
```

Скачать APK можно по ссылке из письма или в [expo.dev](https://expo.dev) → проект → Builds.

## Переменные окружения

В сборке используется `EXPO_PUBLIC_API_URL` из `eas.json` (preview/production) или из `.env` при локальной сборке. По умолчанию: `https://api.whakcomp.ru`.
