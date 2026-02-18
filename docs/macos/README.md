# Один раз настроить macOS (чтобы Expo не падал с EMFILE)

Выполни **один раз** в терминале (попросит пароль):

```bash
sudo launchctl limit maxfiles 65536 200000
```

Закрой и заново открой терминал. После этого `npm start` в папке mobile будет работать без ошибки «too many open files».

---

**Постоянно (после перезагрузки не сбрасывается):**

```bash
sudo cp /Volumes/alim/HeirLink/docs/macos/limit.maxfiles.plist /Library/LaunchDaemons/
sudo chmod 644 /Library/LaunchDaemons/limit.maxfiles.plist
```

Перезагрузи Mac — лимит будет применяться при каждой загрузке.
