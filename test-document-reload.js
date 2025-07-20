#!/usr/bin/env node

/**
 * Document Reload Test Script
 * Check if document reloading is working and TCCC documents are loaded
 */

console.log('🔍 Document Reload Test Script');
console.log('=============================');

console.log('\n🐛 **Problem Identified:**');
console.log('❌ Still getting FEMA/WHO documents for "march algorithm" query');
console.log('❌ TCCC documents not appearing in search results');
console.log('❌ Document reloading may not be working');

console.log('\n🔍 **Debug Steps:**');

console.log('\n📊 **Step 1: Check Document Reloading**');
console.log('Look for these logs when app starts:');
console.log('- "DocumentLoader: Found X existing documents"');
console.log('- "DocumentLoader: Found X TCCC documents, checking content..."');
console.log('- "DocumentLoader: TCCC documents missing proper MARCH algorithm content, clearing and reloading"');
console.log('- "DocumentLoader: No TCCC documents found, clearing and reloading"');
console.log('- "Voy Vector Store: Clearing all data"');

console.log('\n📊 **Step 2: Check TCCC Document Loading**');
console.log('Look for these logs:');
console.log('- "DocumentLoader: Loading document: tccc_handbook_v5.md"');
console.log('- "DocumentLoader: Successfully loaded: TCCC Handbook v5"');
console.log('- "DocumentLoader: Loading document: tccc_quick_ref.md"');
console.log('- "DocumentLoader: Successfully loaded: TCCC Quick Reference"');

console.log('\n📊 **Step 3: Check Content Generation**');
console.log('Look for these logs:');
console.log('- "DocumentLoader: Generated X characters for tccc_handbook_v5.md"');
console.log('- "DocumentLoader: Generated X characters for tccc_quick_ref.md"');
console.log('- Check if content contains "What is the MARCH Algorithm?"');

console.log('\n📊 **Step 4: Check Vector Store**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Adding document \\"TCCC Handbook v5\\""');
console.log('- "Voy Vector Store: Adding document \\"TCCC Quick Reference\\""');
console.log('- "Voy Vector Store: Successfully added document \\"TCCC Handbook v5\\""');

console.log('\n📊 **Step 5: Check Embedding Generation**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Generating embeddings for X chunks"');
console.log('- "Voy Vector Store: Successfully generated embeddings"');
console.log('- "Voy Vector Store: Found X chunks with embeddings"');

console.log('\n📊 **Step 6: Check Search Results**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Using embedding-based search ONLY"');
console.log('- "📄 Result 1: TCCC Handbook v5 (similarity: X.XXXX)"');
console.log('- "📄 Result 2: TCCC Quick Reference (similarity: X.XXXX)"');

console.log('\n🔧 **Potential Issues:**');

console.log('\n1. **Document Reloading Not Triggered:**');
console.log('   - Existing documents may have old content');
console.log('   - Content check may not be working');
console.log('   - Clear all documents manually');

console.log('\n2. **TCCC Documents Not Loading:**');
console.log('   - Check if tccc_handbook_v5.md and tccc_quick_ref.md are in the list');
console.log('   - Check for loading errors');
console.log('   - Verify content generation');

console.log('\n3. **Content Generation Issues:**');
console.log('   - Check if new content is being generated');
console.log('   - Verify "What is the MARCH Algorithm?" is included');
console.log('   - Check content length');

console.log('\n4. **Embedding Issues:**');
console.log('   - Check if embeddings are generated for new content');
console.log('   - Verify embedding dimensions');
console.log('   - Check similarity calculations');

console.log('\n🔍 **Manual Debug Commands:**');

console.log('\n1. **Force Document Reload:**');
console.log('   - Clear app data/cache');
console.log('   - Restart app completely');
console.log('   - Watch for "clearing and reloading" logs');

console.log('\n2. **Check Document Content:**');
console.log('   - Look for "Generated X characters for tccc_" logs');
console.log('   - Verify content contains MARCH algorithm text');
console.log('   - Check if content is realistic');

console.log('\n3. **Check Vector Store:**');
console.log('   - Look for "Adding document \\"TCCC\\"" logs');
console.log('   - Verify TCCC documents are in the store');
console.log('   - Check chunk generation');

console.log('\n4. **Check Search Process:**');
console.log('   - Look for "Using embedding-based search ONLY"');
console.log('   - Check if TCCC documents appear in results');
console.log('   - Verify similarity scores');

console.log('\n🎯 **Expected Behavior After Fix:**');

console.log('\n✅ **Document Reloading:**');
console.log('- Should clear existing documents');
console.log('- Should load TCCC documents with new content');
console.log('- Should generate embeddings for new content');

console.log('\n✅ **Search Results:**');
console.log('- Should find TCCC Handbook v5 first');
console.log('- Should find TCCC Quick Reference second');
console.log('- Should have high similarity scores (>0.8)');

console.log('\n✅ **RAG Response:**');
console.log('- Should include MARCH algorithm explanation');
console.log('- Should reference TCCC documents');
console.log('- Should provide accurate information');

console.log('\n📱 **To Test:**');
console.log('1. Clear app data/cache completely');
console.log('2. Restart app: npm start');
console.log('3. Watch logs for document reloading');
console.log('4. Check TCCC document loading');
console.log('5. Ask: "What is march algorithm?"');
console.log('6. Verify TCCC documents in results'); 