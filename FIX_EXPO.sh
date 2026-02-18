#!/usr/bin/env bash
# ========================================
# Исправление для запуска Expo на macOS
# ========================================
# Запусти один раз: sudo bash FIX_EXPO.sh
# После этого: cd mobile && npm start
# ========================================

echo "=== Исправление Expo для macOS ==="
echo ""

# Получаем имя пользователя (не root)
if [ -n "$SUDO_USER" ]; then
    USER_NAME="$SUDO_USER"
    USER_HOME=$(eval echo ~$SUDO_USER)
else
    USER_NAME=$(whoami)
    USER_HOME="$HOME"
fi

echo "Пользователь: $USER_NAME"
echo "Home: $USER_HOME"
echo ""

# 1. Исправляем права на ~/.local/state (для Watchman)
if [ -d "$USER_HOME/.local/state" ]; then
    echo "[1/2] Исправляю права на $USER_HOME/.local/state ..."
    chown -R "$USER_NAME:staff" "$USER_HOME/.local/state"
    echo "      Готово."
else
    echo "[1/2] Создаю $USER_HOME/.local/state ..."
    mkdir -p "$USER_HOME/.local/state"
    chown -R "$USER_NAME:staff" "$USER_HOME/.local/state"
    echo "      Готово."
fi

# 2. Повышаем лимит файлов
echo "[2/2] Повышаю лимит открытых файлов..."
launchctl limit maxfiles 65536 200000
echo "      Готово."

echo ""
echo "=== ГОТОВО! ==="
echo ""
echo "Теперь:"
echo "  1. Закрой этот терминал"
echo "  2. Открой новый терминал"
echo "  3. Запусти:"
echo "     cd /Volumes/alim/HeirLink/mobile && npm start"
echo ""
