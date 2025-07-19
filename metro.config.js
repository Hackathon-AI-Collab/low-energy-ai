const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration to ignore problematic files
config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Ignore problematic files that cause bundling issues
// But allow ONNX Runtime React Native
config.resolver.blockList = [
  /node_modules\/voy-search\/.*\.wasm$/,
  /.*voy_search_bg\.wasm$/,
  // Allow ONNX Runtime React Native but block other problematic bindings
  /.*napi-v3\/.*\/onnxruntime_binding\.node$/,
  /.*bin\/napi-v3\/.*\/onnxruntime_binding\.node$/,
];

// Add transformer configuration
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Add resolver alias to handle problematic modules
config.resolver.alias = {
  ...config.resolver.alias,
  'onnxruntime-node': 'onnxruntime-react-native',
};

// Add resolver extensions to handle different file types
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs'];

// Add asset extensions to handle markdown files
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'md',
  'txt'
];

module.exports = config; 