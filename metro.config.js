const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  ...nodeModulesPaths,
];

module.exports = config; 