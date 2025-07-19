#!/usr/bin/env node

/**
 * ONNX Debug Test Script
 * Helps debug ONNX issues with detailed logging
 */

console.log('🔍 ONNX Debug Test Script');
console.log('=========================');

console.log('\n📋 Enhanced Debugging Added:');

console.log('\n1. **Detailed Model Status Check:**');
console.log('   ✅ isModelLoaded status');
console.log('   ✅ Model object existence');
console.log('   ✅ Tokenizer existence');
console.log('   ✅ Model name and dimension');
console.log('   ✅ Model type and path');

console.log('\n2. **ONNX Runtime Loading Debug:**');
console.log('   ✅ InferenceSession availability');
console.log('   ✅ Tensor class availability');
console.log('   ✅ onnxRuntimeLoaded status');
console.log('   ✅ Detailed error messages');

console.log('\n3. **Model Loading Process Debug:**');
console.log('   ✅ Model path validation');
console.log('   ✅ ONNX Runtime loading');
console.log('   ✅ Model session creation');
console.log('   ✅ Input/output names');

console.log('\n4. **Embedding Generation Debug:**');
console.log('   ✅ Tokenization process');
console.log('   ✅ Tensor creation steps');
console.log('   ✅ Model inference execution');
console.log('   ✅ Output processing');

console.log('\n🚀 **To Debug ONNX Issues:**');

console.log('\n📱 **Step 1: Regenerate Embeddings**');
console.log('1. Start the app: npm start');
console.log('2. Navigate to Knowledge Base screen');
console.log('3. Press "📚 Load Documents" button');
console.log('4. Select "Regenerate" when prompted');
console.log('5. Monitor console for detailed logs');

console.log('\n📊 **Expected Debug Output:**');

console.log('\n🔍 **Model Loading Phase:**');
console.log('- "🔍 Local model loading attempt:"');
console.log('- "  - Model type: local"');
console.log('- "  - Model path: [path]"');
console.log('- "🔄 Loading ONNX Runtime..."');
console.log('- "🔍 ONNX Runtime loading result:"');
console.log('- "  - InferenceSession available: true/false"');
console.log('- "  - Tensor available: true/false"');

console.log('\n🔍 **Embedding Generation Phase:**');
console.log('- "🔍 Detailed Model Status Check:"');
console.log('- "  - isModelLoaded: true/false"');
console.log('- "  - model exists: true/false"');
console.log('- "  - tokenizer exists: true/false"');
console.log('- "✅ Using ONNX Runtime model for embedding generation" (if working)');
console.log('- "⚠️ Model not loaded, using hash-based embedding" (if failing)');

console.log('\n🔍 **ONNX Inference Phase (if working):**');
console.log('- "🔄 Tokenizing text..."');
console.log('- "🔤 Tokenization complete. Input shape: [shape]"');
console.log('- "🔄 Converting to ONNX format..."');
console.log('- "✅ Input tensor created"');
console.log('- "✅ Attention mask tensor created"');
console.log('- "✅ Token type IDs tensor created"');
console.log('- "🔄 Running model inference..."');
console.log('- "✅ Model inference completed"');
console.log('- "🔍 Model output keys: [keys]"');
console.log('- "📏 Normalized embedding dimension: 384"');

console.log('\n🔍 **Error Detection (if failing):**');
console.log('- "❌ Failed to load local ONNX model:"');
console.log('- "❌ Error details: [error message]"');
console.log('- "❌ Error stack: [stack trace]"');
console.log('- "⚠️ ONNX Runtime Tensor not available"');
console.log('- "❌ Failed to create input tensor:"');

console.log('\n🔧 **Common Issues to Look For:**');

console.log('\n1. **ONNX Runtime Not Available:**');
console.log('   - "InferenceSession available: false"');
console.log('   - "Tensor available: false"');
console.log('   - Solution: Check onnxruntime-react-native installation');

console.log('\n2. **Model File Issues:**');
console.log('   - "Model path: null" or "Model path: undefined"');
console.log('   - "Failed to load local ONNX model: File not found"');
console.log('   - Solution: Check model file path and existence');

console.log('\n3. **Model Format Issues:**');
console.log('   - "Failed to create input tensor:"');
console.log('   - "Model input names: []"');
console.log('   - Solution: Check ONNX model format and compatibility');

console.log('\n4. **Tokenization Issues:**');
console.log('   - "Failed to create input tensor:"');
console.log('   - "Input data type: [unexpected type]"');
console.log('   - Solution: Check tokenizer output format');

console.log('\n📱 **Next Steps After Debugging:**');

console.log('\n✅ **If ONNX Works:**');
console.log('- You should see 384-dimensional embeddings');
console.log('- ONNX coverage should be 100%');
console.log('- Quality should be "EXCELLENT"');

console.log('\n⚠️ **If ONNX Still Fails:**');
console.log('- Look for specific error messages in logs');
console.log('- Check if model file exists and is accessible');
console.log('- Verify ONNX Runtime installation');
console.log('- Consider using hash embeddings temporarily');

console.log('\n🔍 **Key Debug Questions:**');
console.log('1. Is the model file accessible?');
console.log('2. Is ONNX Runtime properly installed?');
console.log('3. Are the model input/output formats correct?');
console.log('4. Is the tokenizer working properly?');
console.log('5. Are there any platform-specific issues?');

console.log('\n✅ **Run the regeneration and check the detailed logs!**');
console.log('The enhanced debugging will show exactly where the ONNX process is failing.'); 