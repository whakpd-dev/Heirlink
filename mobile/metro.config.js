const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Отключаем Watchman (он не работает из-за проблем с правами на ~/.local/state)
// Metro будет использовать FSEventsWatcher на macOS
config.resolver = config.resolver || {};
config.resolver.useWatchman = false;

module.exports = config;
