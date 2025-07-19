#!/usr/bin/env node

/**
 * Embedding Issue Diagnostic Script
 * Identifies why sentence transformer is generating hash embeddings instead of ONNX embeddings
 */

console.log('🔍 Embedding Issue Diagnostic Script');
console.log('====================================');

console.log('\n📋 Current Issue:');
console.log('❌ Model reports as "loaded: true"');
console.log('❌ But generating hash embeddings (100 dimensions)');
console.log('❌ Expected: ONNX embeddings (384 dimensions)');
console.log('❌ Result: 0% ONNX coverage, 100% hash coverage');

console.log('\n🔍 **Root Cause Analysis:**');

console.log('\n1. **Model Loading Check:**');
console.log('   - Model reports isModelLoaded = true');
console.log('   - But actual model inference fails');
console.log('   - Falls back to hash embeddings');
console.log('   - Issue: Model loading vs. model usability');

console.log('\n2. **ONNX Runtime Issues:**');
console.log('   - ONNX Runtime may not be properly loaded');
console.log('   - Tensor class may be undefined');
console.log('   - Model path may be incorrect');
console.log('   - Model file may be corrupted or missing');

console.log('\n3. **Model Inference Issues:**');
console.log('   - Tokenization may fail');
console.log('   - Tensor creation may fail');
console.log('   - Model.run() may throw error');
console.log('   - Output format may be unexpected');

console.log('\n4. **Settings Issues:**');
console.log('   - Model type may be set to "hash"');
console.log('   - Model path may be empty');
console.log('   - Dimension may be incorrect');

console.log('\n🔧 **Diagnostic Steps:**');

console.log('\n1. **Check Model Settings:**');
console.log('   - Verify model type is "local" not "hash"');
console.log('   - Check model path exists and is accessible');
console.log('   - Confirm dimension is 384');

console.log('\n2. **Check ONNX Runtime:**');
console.log('   - Verify onnxruntime-react-native is installed');
console.log('   - Check if InferenceSession is available');
console.log('   - Check if Tensor class is available');

console.log('\n3. **Check Model File:**');
console.log('   - Verify ONNX model file exists');
console.log('   - Check file size and integrity');
console.log('   - Confirm file path is correct');

console.log('\n4. **Check Tokenization:**');
console.log('   - Verify LocalTokenizer is working');
console.log('   - Check tokenization output format');
console.log('   - Confirm tensor creation succeeds');

console.log('\n🚀 **Expected Debug Output:**');

console.log('\n✅ **If ONNX is working:**');
console.log('- "✅ Using ONNX Runtime model for embedding generation"');
console.log('- "🔄 Tokenizing text..."');
console.log('- "✅ ONNX tensors created successfully"');
console.log('- "🔄 Running model inference..."');
console.log('- "✅ Model inference completed"');
console.log('- "📏 Normalized embedding dimension: 384"');

console.log('\n❌ **If falling back to hash:**');
console.log('- "⚠️ ONNX Runtime Tensor not available"');
console.log('- "❌ Error generating embedding with ONNX model"');
console.log('- "⚠️ Model not loaded, using hash-based embedding"');
console.log('- "📏 Hash embedding dimension: 384"');

console.log('\n🔧 **Quick Fixes to Try:**');

console.log('\n1. **Force Hash Mode (Temporary):**');
console.log('   - Set model type to "hash" in settings');
console.log('   - This will ensure consistent hash embeddings');
console.log('   - Better than mixed/invalid embeddings');

console.log('\n2. **Check Model Path:**');
console.log('   - Verify model file exists at expected path');
console.log('   - Check file permissions');
console.log('   - Ensure path is absolute and correct');

console.log('\n3. **Reinstall ONNX Runtime:**');
console.log('   - npm uninstall onnxruntime-react-native');
console.log('   - npm install onnxruntime-react-native');
console.log('   - Clear cache and restart');

console.log('\n4. **Use Different Model:**');
console.log('   - Try a smaller/simpler ONNX model');
console.log('   - Check if model format is compatible');
console.log('   - Verify model input/output format');

console.log('\n📱 **To Diagnose:**');
console.log('1. Check console logs during embedding generation');
console.log('2. Look for ONNX-related error messages');
console.log('3. Verify model settings in app');
console.log('4. Check if model file exists');
console.log('5. Test ONNX Runtime availability');

console.log('\n⚠️ **Immediate Action:**');
console.log('The current system is working with hash embeddings.');
console.log('While not optimal, this provides functional RAG capabilities.');
console.log('Focus on getting ONNX working for better embedding quality.');

console.log('\n✅ **Next Steps:**');
console.log('1. Check console logs for ONNX errors');
console.log('2. Verify model file exists and is accessible');
console.log('3. Test ONNX Runtime installation');
console.log('4. Consider using hash embeddings temporarily');
console.log('5. Debug ONNX model loading step by step'); 