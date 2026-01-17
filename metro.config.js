const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add database files as bundleable assets
// tiles.db is the SQLite database containing all GIS tile data
config.resolver.assetExts.push('db');

module.exports = config;
