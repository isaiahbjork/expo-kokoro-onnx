module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        alias: {
          'stream': 'stream-browserify',
          'buffer': 'buffer',
          'path': 'path-browserify',
          'fs': 'react-native-fs',
          'crypto': 'crypto-browserify',
        },
      }],
      "babel-plugin-transform-import-meta"
    ],
  };
}; 