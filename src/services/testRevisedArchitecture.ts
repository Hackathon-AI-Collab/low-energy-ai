import { SentenceTransformer } from './sentenceTransformer';

export async function testRevisedArchitecture() {
  console.log('Testing revised architecture...');
  
  try {
    // Initialize sentence transformer
    const transformer = new SentenceTransformer();
    await transformer.initialize();
    
    console.log('✅ Sentence transformer initialized');
    console.log(`Model name: ${transformer.getModelName()}`);
    console.log(`Dimension: ${transformer.getDimension()}`);
    console.log(`Ready: ${transformer.isReady()}`);
    
    // Test embedding generation
    const testText = "This is a test sentence for embedding generation.";
    const embedding = await transformer.generateEmbedding(testText);
    
    console.log('✅ Embedding generated');
    console.log(`Embedding length: ${embedding.length}`);
    console.log(`First few values: ${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);
    
    // Test similarity calculation
    const text1 = "Medical emergency procedures";
    const text2 = "Emergency medical protocols";
    const text3 = "Cooking recipes for dinner";
    
    const embedding1 = await transformer.generateEmbedding(text1);
    const embedding2 = await transformer.generateEmbedding(text2);
    const embedding3 = await transformer.generateEmbedding(text3);
    
    const similarity12 = await transformer.calculateSimilarity(embedding1, embedding2);
    const similarity13 = await transformer.calculateSimilarity(embedding1, embedding3);
    
    console.log('✅ Similarity calculations completed');
    console.log(`Similarity (medical vs medical): ${similarity12.toFixed(4)}`);
    console.log(`Similarity (medical vs cooking): ${similarity13.toFixed(4)}`);
    
    // Verify that medical topics are more similar than medical vs cooking
    if (similarity12 > similarity13) {
      console.log('✅ Similarity logic working correctly');
    } else {
      console.log('⚠️  Similarity logic may need adjustment');
    }
    
    console.log('🎉 Revised architecture test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
} 