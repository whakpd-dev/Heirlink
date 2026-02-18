# Выкладка HeirLink в TestFlight (iOS)

Бандл для Apple: **com.domainname.heirlinkdev**

## 1. Подготовка в Apple

1. **App Store Connect** → [appstoreconnect.apple.com](https://appstoreconnect.apple.com)  
   Создай приложение с Bundle ID **com.domainname.heirlinkdev** (если ещё не создано).

2. **Apple Developer**  
   Убедись, что в аккаунте есть:
   - Apple ID (email)
   - Team ID (в Membership)
   - App Store Connect App ID (числовой ID приложения в App Store Connect → приложение → General → App Information).

## 2. Подстановка данных в eas.json

В `eas.json` в блоке `submit.production.ios` замени плейсхолдеры:

- **appleId** — твой Apple ID (email).
- **ascAppId** — App Store Connect App ID (число, например `1234567890`).
- **appleTeamId** — Team ID (строка, например `ABCD1234`).

Либо не заполняй их в файле и вводи при запуске `eas submit` по запросу.

## 3. Сборка под App Store

Из папки `mobile`:

```bash
cd mobile
eas build --platform ios --profile production
```

Дождись окончания сборки в EAS (ссылку можно открыть в терминале).

## 4. Отправка в TestFlight

**Вариант A — сразу после сборки:**

```bash
eas submit --platform ios --profile production
```

EAS предложит выбрать последний успешный iOS‑билд и отправит его в App Store Connect.

**Вариант B — из дашборда EAS:**

1. Зайди на [expo.dev](https://expo.dev) → твой проект → Builds.
2. Выбери последний iOS production‑билд.
3. Нажми **Submit to App Store** и следуй шагам (при необходимости укажи Apple ID, Team ID, App ID).

## 5. В App Store Connect

После загрузки билда:

1. Зайди в App Store Connect → приложение → **TestFlight**.
2. Дождись обработки билда (обычно 5–15 минут).
3. Укажи **Export Compliance** и прочие метаданные, если запросит.
4. Добавь тестеров (внутренние/внешние) и раздай доступ.

## Требования

- Аккаунт Apple Developer (платный).
- Установленный EAS CLI: `npm i -g eas-cli`.
- Авторизация: `eas login`.
