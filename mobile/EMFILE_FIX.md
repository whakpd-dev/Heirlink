# Ошибка «EMFILE: too many open files, watch»

## В чём проблема

1. **Metro** (сборщик Expo/React Native) следит за файлами проекта, чтобы при изменении кода перезапускать сборку.
2. Для этого он может использовать:
   - **Watchman** — одна программа следит за всеми файлами, Metro общается с ней по одному соединению (мало дескрипторов).
   - **NodeWatcher** — запасной вариант: Node.js открывает по одному «наблюдателю» на каждую папку/файл (много дескрипторов).
3. Если **Watchman не подключается** (не в PATH, ошибка при проверке и т.п.), Metro переключается на **NodeWatcher**.
4. В **macOS** по умолчанию один процесс может открыть мало файлов (часто 256 или 1024).
5. В проекте тысячи файлов (особенно в `node_modules`), NodeWatcher пытается открыть слишком много — система выдаёт **EMFILE** и процесс падает.

Итого: падение в **NodeWatcher** значит, что либо Watchman не используется, либо лимит открытых файлов в системе слишком маленький.

---

## Решение 1: Повысить лимит (работает всегда)

Выполни в терминале **один раз** (попросит пароль):

```bash
sudo launchctl limit maxfiles 65536 200000
```

После этого **закрой и заново открой терминал** и запусти:

```bash
cd /Volumes/alim/HeirLink/mobile
npm start
```

Действует до перезагрузки Mac. После перезагрузки команду нужно выполнить снова (или использовать решение 2).

---

## Решение 2: Постоянный лимит (после перезагрузки не сбрасывается)

1. Создай файл (попросит пароль):

```bash
sudo tee /Library/LaunchDaemons/limit.maxfiles.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>limit.maxfiles</string>
    <key>ProgramArguments</key>
    <array>
        <string>launchctl</string>
        <string>limit</string>
        <string>maxfiles</string>
        <string>524288</string>
        <string>524288</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
```

2. Установи права:

```bash
sudo chmod 644 /Library/LaunchDaemons/limit.maxfiles.plist
```

3. **Перезагрузи Mac** — после этого лимит будет повышаться при каждой загрузке.

---

## Решение 3: Чтобы Metro использовал Watchman

Если Watchman установлен (`brew install watchman`), но Metro всё равно падает в NodeWatcher:

1. Проверь, что команда доступна в том же терминале, откуда запускаешь `npm start`:

   ```bash
   which watchman
   watchman list-capabilities
   ```

2. Если при запуске из **Cursor/VS Code** `watchman` не находится — запускай `npm start` из **обычного Terminal.app** (там PATH часто полнее).

3. Очисти состояние Watchman и кэш Metro и запусти снова:

   ```bash
   watchman watch-del-all
   cd /Volumes/alim/HeirLink/mobile
   npm start -- --clear
   ```

---

## Кратко

| Причина | Что делать |
|--------|------------|
| Лимит файлов в macOS маленький | Решение 1 или 2 |
| Watchman не используется (не в PATH / ошибка) | Решение 3 или всё равно повысить лимит (1 или 2) |

На практике чаще всего достаточно **решения 1** (или 2, если не хочешь повторять после каждой перезагрузки).
