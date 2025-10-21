// Learn more https://docs.expo.dev/guides/monorepos
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for TypeScript path mapping
config.resolver.alias = {
  '@': './src',
};

// Configure SVG transformer while preserving other transformers
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Enable unstable_allowRequireContext for better module resolution
config.transformer.unstable_allowRequireContext = true;

// Add source map support for better debugging
config.transformer.minifierConfig = {
  output: {
    ascii_only: true,
  },
};

// Configure asset resolution
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

module.exports = config;