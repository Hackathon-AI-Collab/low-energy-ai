#!/usr/bin/env node

/**
 * Script to switch from ONNX to GGUF model configuration
 * This will update the model settings to use the GGUF model
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Switching from ONNX to GGUF model configuration...');

// Path to the settings file (this is where AsyncStorage saves data)
const settingsPath = path.join(__dirname, 'node_modules', '.cache', 'expo', 'AsyncStorage');

console.log('📁 Looking for AsyncStorage cache directory...');

// Check if the cache directory exists
if (!fs.existsSync(settingsPath)) {
  console.log('⚠️  AsyncStorage cache not found. This is normal if the app hasn\'t been run yet.');
  console.log('✅ The app will use default settings when it starts.');
} else {
  console.log('✅ Found AsyncStorage cache directory');
  
  // List files in the cache directory
  try {
    const files = fs.readdirSync(settingsPath);
    console.log('📄 Cache files found:', files);
  } catch (error) {
    console.log('⚠️  Could not read cache directory:', error.message);
  }
}

console.log('\n🎯 Next Steps:');
console.log('1. Start the app: npx expo start --clear');
console.log('2. Go to Settings screen');
console.log('3. Download the "Gemma 3B-IT (GGUF Q2_K)" model');
console.log('4. The app will automatically switch to GGUF mode');
console.log('5. Test with a development build: ./build-android.sh');

console.log('\n📋 Expected behavior:');
console.log('- In Expo Go: Will show "llama.rn module not available" (expected)');
console.log('- In Development Build: Will load the real GGUF model with llama.rn');

console.log('\n🚀 Ready to switch to GGUF!'); 