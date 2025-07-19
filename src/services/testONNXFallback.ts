import { SentenceTransformer } from './sentenceTransformer';

export async function testONNXFallback() {
  console.log('Testing ONNX Runtime fallback...');
  
  try {
    // Initialize sentence transformer
    const transformer = new SentenceTransformer();
    await transformer.initialize();
    
    console.log('✅ Sentence transformer initialized');
    console.log(`Model loaded: ${transformer.isModelReady()}`);
    console.log(`Ready: ${transformer.isReady()}`);
    
    // Test embedding generation
    const testText = "Testing ONNX fallback with hash-based embeddings.";
    const embedding = await transformer.generateEmbedding(testText);
    
    console.log('✅ Embedding generated');
    console.log(`Embedding length: ${embedding.length}`);
    console.log(`First few values: ${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);
    
    // Test similarity calculation
    const text1 = "Medical emergency procedures";
    const text2 = "Emergency medical protocols";
    
    const embedding1 = await transformer.generateEmbedding(text1);
    const embedding2 = await transformer.generateEmbedding(text2);
    
    const similarity = await transformer.calculateSimilarity(embedding1, embedding2);
    
    console.log('✅ Similarity calculation completed');
    console.log(`Similarity score: ${similarity.toFixed(4)}`);
    
    // Verify that we get a reasonable similarity score
    if (similarity >= 0 && similarity <= 1) {
      console.log('✅ Similarity score is within valid range');
    } else {
      console.log('⚠️ Similarity score is outside valid range');
    }
    
    console.log('🎉 ONNX fallback test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ ONNX fallback test failed:', error);
    return false;
  }
} 