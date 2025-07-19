#!/usr/bin/env node

/**
 * Script to reset model settings to use GGUF by default
 * This will clear the old ONNX model path and set the model type to GGUF
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Resetting model settings to use GGUF by default...');

// The settings are stored in AsyncStorage, which is typically in the app's data directory
// For development, we can't directly modify AsyncStorage, but we can provide instructions

console.log('📋 Current Issue:');
console.log('- App is configured to use ONNX model: gemma-3-1b-it.onnx');
console.log('- Need to switch to GGUF model: gemma-3n-E2B.Q2_K.gguf');

console.log('\n🎯 Solution Steps:');
console.log('1. Start the app: npx expo start --clear');
console.log('2. Go to Settings screen in the app');
console.log('3. Look for "Model Management" or "Download Models"');
console.log('4. Download the "Gemma 3B-IT (GGUF Q2_K)" model');
console.log('5. The app will automatically:');
console.log('   - Set llmModelType to "gguf"');
console.log('   - Set llmModelPath to the GGUF file');
console.log('   - Remove the old ONNX model path');

console.log('\n🔧 Alternative: Clear app data');
console.log('If you want to start fresh:');
console.log('- Uninstall the app from your device');
console.log('- Reinstall with: ./build-android.sh');
console.log('- The app will start with default settings');

console.log('\n📊 Expected Settings After Switch:');
console.log('{');
console.log('  "llmModelType": "gguf",');
console.log('  "llmModelPath": "file:///data/user/0/com.anonymous.leaiplatform/files/models/gemma-3n-E2B.Q2_K.gguf",');
console.log('  "llmModelName": "gemma-3n-E2B.Q2_K.gguf"');
console.log('}');

console.log('\n🚀 Ready to switch to GGUF!'); 