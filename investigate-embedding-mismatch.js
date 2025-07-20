#!/usr/bin/env node

/**
 * Investigation Script: Embedding Mismatch Issue
 * 
 * This script investigates why only 8 chunks out of 1187 have embeddings loaded,
 * despite the progressive embedding service claiming success.
 */

console.log('🔍 EMBEDDING MISMATCH INVESTIGATION');
console.log('====================================');

console.log('\n📊 PROBLEM SUMMARY:');
console.log('- Total chunks in database: 1187');
console.log('- Chunks with embeddings: 8');
console.log('- Progressive embedding service: Claims success');
console.log('- Issue: Major disconnect between loaded embeddings and database chunks');

console.log('\n🕵️ ROOT CAUSE ANALYSIS:');

console.log('\n1. **ID MISMATCH HYPOTHESIS:**');
console.log('   ❓ Progressive embeddings have different chunk IDs than database chunks');
console.log('   ❓ Progressive embeddings use: `chunkId` field');
console.log('   ❓ Database chunks use: `id` field');
console.log('   ❓ Mapping logic may be incorrect');

console.log('\n2. **CONTENT MISMATCH HYPOTHESIS:**');
console.log('   ❓ Progressive embeddings match by content hash/content');
console.log('   ❓ Database chunks have different content than expected');
console.log('   ❓ Content processing differs between systems');

console.log('\n3. **INDEX MISMATCH HYPOTHESIS:**');
console.log('   ❓ Progressive embeddings match by chunk index');
console.log('   ❓ Database chunks have different indexing scheme');
console.log('   ❓ Off-by-one errors or different counting logic');

console.log('\n4. **DOCUMENT ID MISMATCH HYPOTHESIS:**');
console.log('   ❓ Progressive embeddings use different document IDs');
console.log('   ❓ Database chunks use different document ID format');
console.log('   ❓ Document ID normalization issues');

console.log('\n🔍 KEY CODE SECTIONS TO EXAMINE:');

console.log('\n**A. Progressive Embedding Data Structure:**');
console.log('```typescript');
console.log('interface PreComputedEmbedding {');
console.log('  documentId: string;');
console.log('  chunkId: string;        // ← Key field');
console.log('  content: string;');
console.log('  contentHash: string;');
console.log('  embedding: number[];');
console.log('  metadata: {');
console.log('    chunkIndex: number;   // ← Alternative key field');
console.log('    documentTitle: string;');
console.log('  };');
console.log('}');
console.log('```');

console.log('\n**B. Database Chunk Data Structure:**');
console.log('```typescript');
console.log('interface DocumentChunk {');
console.log('  id: string;            // ← Key field (different name!)');
console.log('  documentId: string;');
console.log('  content: string;');
console.log('  embedding: number[];');
console.log('  metadata: {');
console.log('    chunkIndex: number;  // ← Alternative key field');
console.log('  };');
console.log('}');
console.log('```');

console.log('\n**C. Mapping Logic in VoyVectorStore:**');
console.log('```typescript');
console.log('// In addDocument() method:');
console.log('const progressiveEmbeddings = await this.progressiveEmbedding.getDocumentEmbeddings(documentId);');
console.log('');
console.log('if (progressiveEmbeddings) {');
console.log('  // Map progressive embeddings to existing chunks (match by content or index)');
console.log('  for (let i = 0; i < chunks.length && i < progressiveEmbeddings.length; i++) {');
console.log('    chunks[i].embedding = progressiveEmbeddings[i].embedding;  // ← INDEX-based mapping!');
console.log('  }');
console.log('}');
console.log('```');

console.log('\n🚨 SUSPECTED ISSUES:');

console.log('\n**Issue #1: Field Name Mismatch**');
console.log('❌ PreComputedEmbedding.chunkId vs DocumentChunk.id');
console.log('❌ No direct ID mapping attempted');
console.log('❌ Only index-based mapping used');

console.log('\n**Issue #2: Index-based Mapping Fragility**');
console.log('❌ Assumes progressive embeddings are in same order as chunks');
console.log('❌ No verification of content match');
console.log('❌ Silent failures if order differs');

console.log('\n**Issue #3: Document ID Format Differences**');
console.log('❌ Progressive embeddings may use different document ID format');
console.log('❌ No normalization or mapping of document IDs');
console.log('❌ Chunks might be created with different document ID than expected');

console.log('\n**Issue #4: Content Processing Differences**');
console.log('❌ Progressive embeddings created from original documents');
console.log('❌ Database chunks created from processed/chunked content');
console.log('❌ Content may differ due to processing differences');

console.log('\n🔧 INVESTIGATION STEPS:');

console.log('\n**Step 1: Examine Progressive Embedding Data**');
console.log('- Log actual progressive embedding chunkIds');
console.log('- Log actual progressive embedding documentIds');
console.log('- Log progressive embedding content samples');
console.log('- Log progressive embedding count per document');

console.log('\n**Step 2: Examine Database Chunk Data**');
console.log('- Log actual database chunk IDs');
console.log('- Log actual database chunk documentIds');
console.log('- Log database chunk content samples');
console.log('- Log database chunk count per document');

console.log('\n**Step 3: Compare ID Formats**');
console.log('- Check if progressive chunkId matches database chunk.id');
console.log('- Check if progressive documentId matches database chunk.documentId');
console.log('- Look for systematic ID format differences');

console.log('\n**Step 4: Compare Content**');
console.log('- Check if progressive content matches database chunk content');
console.log('- Look for content processing differences');
console.log('- Check content hashing differences');

console.log('\n**Step 5: Test Different Mapping Strategies**');
console.log('- Try ID-based mapping (chunkId to chunk.id)');
console.log('- Try content-based mapping (match by content hash)');
console.log('- Try hybrid mapping (ID first, content fallback)');

console.log('\n🎯 DEBUGGING CODE TO ADD:');

console.log('\n**In Progressive Embedding Service:**');
console.log('```javascript');
console.log('console.log(`📦 Progressive embedding data for ${documentId}:`);');
console.log('console.log(`   Count: ${progressiveEmbeddings.length}`);');
console.log('for (let i = 0; i < Math.min(3, progressiveEmbeddings.length); i++) {');
console.log('  const pe = progressiveEmbeddings[i];');
console.log('  console.log(`   [${i}] chunkId: "${pe.chunkId}"`);');
console.log('  console.log(`   [${i}] documentId: "${pe.documentId}"`);');
console.log('  console.log(`   [${i}] content: "${pe.content.substring(0, 50)}..."`);');
console.log('  console.log(`   [${i}] chunkIndex: ${pe.metadata.chunkIndex}`);');
console.log('}');
console.log('```');

console.log('\n**In VoyVectorStore addDocument:**');
console.log('```javascript');
console.log('console.log(`🔍 Database chunks for ${documentId}:`);');
console.log('console.log(`   Count: ${chunks.length}`);');
console.log('for (let i = 0; i < Math.min(3, chunks.length); i++) {');
console.log('  const chunk = chunks[i];');
console.log('  console.log(`   [${i}] id: "${chunk.id}"`);');
console.log('  console.log(`   [${i}] documentId: "${chunk.documentId}"`);');
console.log('  console.log(`   [${i}] content: "${chunk.content.substring(0, 50)}..."`);');
console.log('  console.log(`   [${i}] chunkIndex: ${chunk.metadata.chunkIndex}`);');
console.log('}');
console.log('```');

console.log('\n**Enhanced Mapping Logic:**');
console.log('```javascript');
console.log('if (progressiveEmbeddings) {');
console.log('  console.log(`🔄 Attempting to map ${progressiveEmbeddings.length} progressive embeddings to ${chunks.length} chunks`);');
console.log('  ');
console.log('  let mappedCount = 0;');
console.log('  ');
console.log('  // Strategy 1: Try ID-based mapping');
console.log('  const chunkById = new Map(chunks.map(c => [c.id, c]));');
console.log('  for (const pe of progressiveEmbeddings) {');
console.log('    const matchingChunk = chunkById.get(pe.chunkId);');
console.log('    if (matchingChunk) {');
console.log('      matchingChunk.embedding = pe.embedding;');
console.log('      mappedCount++;');
console.log('      console.log(`✅ ID match: ${pe.chunkId} -> chunk ${matchingChunk.id}`);');
console.log('    } else {');
console.log('      console.log(`❌ No ID match for: ${pe.chunkId}`);');
console.log('    }');
console.log('  }');
console.log('  ');
console.log('  // Strategy 2: Try index-based mapping for unmapped chunks');
console.log('  if (mappedCount < progressiveEmbeddings.length) {');
console.log('    console.log(`🔄 Trying index-based mapping for remaining embeddings...`);');
console.log('    for (let i = 0; i < Math.min(chunks.length, progressiveEmbeddings.length); i++) {');
console.log('      if (chunks[i].embedding.length === 0) {');
console.log('        chunks[i].embedding = progressiveEmbeddings[i].embedding;');
console.log('        mappedCount++;');
console.log('        console.log(`✅ Index match: progressive[${i}] -> chunk[${i}] (${chunks[i].id})`);');
console.log('      }');
console.log('    }');
console.log('  }');
console.log('  ');
console.log('  console.log(`📊 Mapping summary: ${mappedCount}/${progressiveEmbeddings.length} embeddings mapped to chunks`);');
console.log('}');
console.log('```');

console.log('\n✅ EXPECTED OUTCOMES:');

console.log('\n**If ID mismatch is the issue:**');
console.log('- Progressive chunkIds will not match database chunk.ids');
console.log('- Index-based mapping will only work for perfectly ordered data');
console.log('- Most embeddings will remain unmapped');

console.log('\n**If content mismatch is the issue:**');
console.log('- Progressive content will differ from database chunk content');
console.log('- Content hashes will not match');
console.log('- Need content-based similarity mapping');

console.log('\n**If document ID mismatch is the issue:**');
console.log('- Progressive documentIds will not match chunk.documentIds');
console.log('- Progressive embeddings will not be found for documents');
console.log('- Need document ID normalization');

console.log('\n**If order mismatch is the issue:**');
console.log('- Index-based mapping will map wrong embeddings to wrong chunks');
console.log('- Need smarter mapping strategy');
console.log('- Content verification needed');

console.log('\n🚀 NEXT STEPS:');
console.log('1. Add the debugging code above to VoyVectorStore.ts');
console.log('2. Add debugging code to ProgressiveEmbeddingService.ts');
console.log('3. Run the app and examine the logs');
console.log('4. Compare progressive embedding data vs database chunk data');
console.log('5. Implement the enhanced mapping logic');
console.log('6. Test and verify the fix');

console.log('\n📊 SUCCESS METRICS:');
console.log('✅ Progressive embeddings data logged correctly');
console.log('✅ Database chunk data logged correctly');
console.log('✅ ID/content/index mismatches identified');
console.log('✅ Enhanced mapping logic implemented');
console.log('✅ >90% of chunks have embeddings loaded');
console.log('✅ Search functionality works correctly');