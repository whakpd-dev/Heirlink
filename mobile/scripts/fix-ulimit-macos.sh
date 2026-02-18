#!/usr/bin/env bash
# Один раз выполнить: sudo bash scripts/fix-ulimit-macos.sh
# После этого закрыть и открыть терминал, затем npm start будет работать без EMFILE.

echo "=== Исправление для Expo/Metro на macOS ==="

# 1. Повысить лимит открытых файлов
launchctl limit maxfiles 65536 200000
echo "[1/2] Лимит файлов повышен"

# 2. Исправить права на директорию Watchman (она принадлежит root)
if [ -d "/Users/$SUDO_USER/.local/state" ]; then
    chown -R "$SUDO_USER:staff" "/Users/$SUDO_USER/.local/state"
    echo "[2/2] Права на ~/.local/state исправлены"
else
    mkdir -p "/Users/$SUDO_USER/.local/state"
    chown -R "$SUDO_USER:staff" "/Users/$SUDO_USER/.local/state"
    echo "[2/2] Директория ~/.local/state создана"
fi

echo ""
echo "=== Готово! ==="
echo "Закрой и заново открой терминал, затем:"
echo "  cd /Volumes/alim/HeirLink/mobile && npm start"
