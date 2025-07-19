import { SentenceTransformer } from './sentenceTransformer';
import { VoyVectorStore } from './voyVectorStore';

export async function simpleAppTest() {
  console.log('🧪 Running simple app test...');
  
  try {
    // Test 1: Sentence Transformer
    console.log('Testing sentence transformer...');
    const transformer = new SentenceTransformer();
    await transformer.initialize();
    
    const testEmbedding = await transformer.generateEmbedding('test query');
    console.log(`✅ Sentence transformer: ${testEmbedding.length}-dimensional embedding`);
    
    // Test 2: Voy Vector Store
    console.log('Testing voy vector store...');
    const vectorStore = new VoyVectorStore();
    await vectorStore.initialize();
    
    const stats = await vectorStore.getStats();
    console.log(`✅ Voy vector store: ${stats.documents} documents, ${stats.chunks} chunks`);
    
    // Test 3: Search functionality
    console.log('Testing search functionality...');
    const searchResults = await vectorStore.searchDocuments('medical emergency', 2);
    console.log(`✅ Search: Found ${searchResults.length} relevant chunks`);
    
    console.log('🎉 Simple app test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Simple app test failed:', error);
    return false;
  }
} 