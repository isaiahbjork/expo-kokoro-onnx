const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and node_modules directories
const projectRoot = __dirname;
const nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

const config = getDefaultConfig(__dirname);

// 1. Watch all files (including those in node_modules) for kokoro-js
config.watchFolders = [
  ...nodeModulesPaths,
];

// 2. Allow importing from outside of node_modules
config.resolver.nodeModulesPaths = nodeModulesPaths;

// 3. Configure extraNodeModules to provide browser polyfills
config.resolver.extraNodeModules = {
  ...require('node-libs-react-native'),
  'stream': require.resolve('stream-browserify'),
  'buffer': require.resolve('buffer'),
  'path': require.resolve('path-browserify'),
  'fs': require.resolve('react-native-fs'),
  'crypto': require.resolve('crypto-browserify'),
  'http': require.resolve('@tradle/react-native-http'),
  'https': require.resolve('https-browserify'),
  'os': require.resolve('os-browserify/browser.js'),
  'url': require.resolve('url'),
  'zlib': require.resolve('browserify-zlib'),
};

// 4. Add specific transformations for problematic modules
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config; 