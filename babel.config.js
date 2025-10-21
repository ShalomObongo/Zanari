module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Add other plugins here as needed
      // 'react-native-reanimated/plugin' will be added when reanimated is installed
    ],
  };
};