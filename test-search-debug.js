#!/usr/bin/env node

/**
 * Search Debug Test Script
 * Debug why RAG is retrieving wrong documents for queries
 */

console.log('🔍 Search Debug Test Script');
console.log('===========================');

console.log('\n🐛 **Problem Identified:**');
console.log('❌ Query: "What is march algorithm?"');
console.log('❌ Retrieved: FEMA Incident Rehabilitation, WHO Injury Surveillance, WHO Medical Evacuation');
console.log('❌ Expected: TCCC Handbook v5, TCCC Quick Reference (documents about MARCH)');
console.log('❌ Issue: Semantic search not finding relevant documents');

console.log('\n🔍 **Possible Root Causes:**');

console.log('\n1. **Embedding Issues:**');
console.log('   - Documents not properly embedded');
console.log('   - Embedding dimension mismatches');
console.log('   - Fallback to text search instead of semantic search');
console.log('   - ONNX model not loaded properly');

console.log('\n2. **Document Loading Issues:**');
console.log('   - TCCC documents not loaded');
console.log('   - Wrong content in documents');
console.log('   - Document titles not matching expectations');

console.log('\n3. **Search Algorithm Issues:**');
console.log('   - Text search not finding "march" keyword');
console.log('   - Semantic search not working');
console.log('   - Similarity calculation problems');

console.log('\n🔧 **Debug Steps:**');

console.log('\n📊 **Step 1: Check Document Loading**');
console.log('Look for these logs:');
console.log('- "DocumentLoader: Successfully loaded: TCCC Handbook v5"');
console.log('- "DocumentLoader: Successfully loaded: TCCC Quick Reference"');
console.log('- "DocumentLoader: Successfully loaded: WHO Prehospital Trauma Care"');
console.log('- "DocumentLoader: Successfully loaded: FEMA ICS Field Operations Guide 2016"');

console.log('\n📊 **Step 2: Check Embedding Status**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Found X chunks with embeddings out of Y total chunks"');
console.log('- "Voy Vector Store: Using embedding-based search"');
console.log('- "Voy Vector Store: Using text-based search fallback"');
console.log('- "Sentence transformer initialized successfully"');

console.log('\n📊 **Step 3: Check Search Process**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Searching documents for \\"What is march algorithm?\\""');
console.log('- "Voy Vector Store: Generating query embedding..."');
console.log('- "Query embedding dimension: 384"');
console.log('- "Found X chunks with compatible dimensions"');

console.log('\n📊 **Step 4: Check Retrieved Documents**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Found X results using embedding search"');
console.log('- "Voy RAG: Found X relevant chunks"');
console.log('- "Document: [actual document title]"');

console.log('\n🎯 **Expected vs Actual Behavior:**');

console.log('\n✅ **Expected for "march algorithm" query:**');
console.log('- Should find TCCC documents (TCCC Handbook v5, TCCC Quick Reference)');
console.log('- Should use semantic search (not text fallback)');
console.log('- Should have high similarity scores for TCCC documents');
console.log('- Should return MARCH algorithm explanation');

console.log('\n❌ **Actual behavior:**');
console.log('- Finding FEMA and WHO documents instead');
console.log('- May be using text search fallback');
console.log('- Low relevance to the query');

console.log('\n🔍 **Debug Commands to Run:**');

console.log('\n1. **Check Document Loading:**');
console.log('   Look for: "DocumentLoader: Successfully loaded: TCCC"');
console.log('   If missing: TCCC documents not loaded properly');

console.log('\n2. **Check Embedding Status:**');
console.log('   Look for: "Voy Vector Store: Using embedding-based search"');
console.log('   If not found: Using text search fallback');

console.log('\n3. **Check Search Results:**');
console.log('   Look for: "Voy Vector Store: Found X results using embedding search"');
console.log('   If text search: "Voy Vector Store: Found X results using text search"');

console.log('\n4. **Check Document Content:**');
console.log('   Verify TCCC documents contain "MARCH" keyword');
console.log('   Check if content is realistic (not placeholder)');

console.log('\n🔧 **Potential Fixes:**');

console.log('\n1. **If TCCC documents not loaded:**');
console.log('   - Check DocumentLoader for TCCC file loading');
console.log('   - Verify tccc_handbook_v5.md and tccc_quick_ref.md exist');
console.log('   - Check for loading errors');

console.log('\n2. **If using text search fallback:**');
console.log('   - Check ONNX model loading');
console.log('   - Verify embedding generation');
console.log('   - Check dimension compatibility');

console.log('\n3. **If embeddings not working:**');
console.log('   - Reinitialize sentence transformer');
console.log('   - Check ONNX model status');
console.log('   - Verify embedding dimensions');

console.log('\n4. **If content is wrong:**');
console.log('   - Check document content generation');
console.log('   - Verify realistic content for TCCC documents');
console.log('   - Ensure MARCH algorithm content is included');

console.log('\n📱 **To Debug:**');
console.log('1. Start app: npm start');
console.log('2. Watch logs for document loading');
console.log('3. Check embedding status');
console.log('4. Ask: "What is march algorithm?"');
console.log('5. Check search method used');
console.log('6. Verify retrieved documents');

console.log('\n🎯 **Success Criteria:**');
console.log('✅ TCCC documents loaded successfully');
console.log('✅ Using embedding-based search (not text fallback)');
console.log('✅ Finding TCCC documents for MARCH queries');
console.log('✅ High similarity scores for relevant documents');
console.log('✅ Accurate RAG responses about MARCH algorithm'); 