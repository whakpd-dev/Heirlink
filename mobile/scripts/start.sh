#!/usr/bin/env bash
# Запуск Expo с QR-кодом для телефона и обходом EMFILE на macOS
cd "$(dirname "$0")/.."

# Чтобы Metro нашёл Watchman (иначе падает в NodeWatcher с EMFILE)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Исправление: Watchman не может писать в /Users/alim/.local/state (root)
# Используем альтернативную директорию
export WATCHMAN_STATE_DIR="$HOME/.watchman-state"
mkdir -p "$WATCHMAN_STATE_DIR" 2>/dev/null

# Повысить лимит открытых файлов (если система разрешает)
ulimit -n 65536 2>/dev/null

# Без CI — показывается QR-код и работает hot reload
export CI=false

exec npx expo start --lan "$@"
