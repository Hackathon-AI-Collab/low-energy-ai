#!/usr/bin/env node

/**
 * Document Debug Script
 * Check what documents are loaded and their content
 */

console.log('🔍 Document Debug Script');
console.log('========================');

console.log('\n🐛 **Problem Identified:**');
console.log('❌ Query: "What is march algorithm?"');
console.log('❌ Retrieved: FEMA Incident Rehabilitation, WHO Injury Surveillance, WHO Medical Evacuation');
console.log('❌ Expected: TCCC Handbook v5, TCCC Quick Reference');
console.log('❌ Issue: Embeddings working but wrong documents found');

console.log('\n🔍 **Root Cause Analysis:**');

console.log('\n1. **Document Loading Issue:**');
console.log('   - TCCC documents may not be loaded');
console.log('   - TCCC documents may have wrong content');
console.log('   - TCCC documents may not contain "MARCH" keyword');

console.log('\n2. **Content Issue:**');
console.log('   - TCCC documents may have placeholder content');
console.log('   - MARCH algorithm content may be missing');
console.log('   - Document titles may not match expectations');

console.log('\n3. **Search Issue:**');
console.log('   - TCCC documents may have lower similarity scores');
console.log('   - FEMA/WHO documents may be more semantically similar');
console.log('   - Need to check actual document content');

console.log('\n🔧 **Debug Steps:**');

console.log('\n📊 **Step 1: Check Document Loading**');
console.log('Look for these logs:');
console.log('- "DocumentLoader: Successfully loaded: TCCC Handbook v5"');
console.log('- "DocumentLoader: Successfully loaded: TCCC Quick Reference"');
console.log('- "Voy Vector Store: Initialized with X documents and Y chunks"');

console.log('\n📊 **Step 2: Check Document Content**');
console.log('Look for these logs:');
console.log('- "DocumentLoader: Generated content for: tccc_handbook_v5.md"');
console.log('- "DocumentLoader: Generated content for: tccc_quick_ref.md"');
console.log('- Check if content contains "MARCH" keyword');

console.log('\n📊 **Step 3: Check All Documents**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Adding document \\"TCCC Handbook v5\\""');
console.log('- "Voy Vector Store: Adding document \\"TCCC Quick Reference\\""');
console.log('- "Voy Vector Store: Adding document \\"FEMA Incident Rehabilitation 2008\\""');

console.log('\n📊 **Step 4: Check Search Results**');
console.log('Look for these logs:');
console.log('- "Voy Vector Store: Found X results using embedding search"');
console.log('- "📄 Result 1: [document title] (similarity: X.XXXX)"');
console.log('- Check if TCCC documents appear in results');

console.log('\n🎯 **Expected vs Actual Behavior:**');

console.log('\n✅ **Expected for "march algorithm" query:**');
console.log('- Should find TCCC Handbook v5 (similarity: 0.8+)');
console.log('- Should find TCCC Quick Reference (similarity: 0.8+)');
console.log('- Should NOT find FEMA/WHO documents');

console.log('\n❌ **Actual behavior:**');
console.log('- Finding FEMA Incident Rehabilitation (similarity: 0.8981)');
console.log('- Finding WHO Injury Surveillance (similarity: 0.8694)');
console.log('- Finding WHO Medical Evacuation (similarity: 0.8577)');
console.log('- TCCC documents not appearing in top results');

console.log('\n🔍 **Debug Commands to Run:**');

console.log('\n1. **Check Document Loading:**');
console.log('   Look for: "DocumentLoader: Successfully loaded: TCCC"');
console.log('   If missing: TCCC documents not loaded');

console.log('\n2. **Check Document Content:**');
console.log('   Look for: "DocumentLoader: Generated content for: tccc_"');
console.log('   Check if content contains "MARCH Algorithm"');

console.log('\n3. **Check All Documents:**');
console.log('   Look for: "Voy Vector Store: Adding document \\"TCCC\\""');
console.log('   Verify TCCC documents are in the vector store');

console.log('\n4. **Check Search Results:**');
console.log('   Look for: "📄 Result X: TCCC"');
console.log('   If not found: TCCC documents have low similarity');

console.log('\n🔧 **Potential Fixes:**');

console.log('\n1. **If TCCC documents not loaded:**');
console.log('   - Check DocumentLoader for TCCC file loading');
console.log('   - Verify tccc_handbook_v5.md and tccc_quick_ref.md exist');
console.log('   - Check for loading errors');

console.log('\n2. **If TCCC documents have wrong content:**');
console.log('   - Check content generation in DocumentLoader');
console.log('   - Verify MARCH algorithm content is included');
console.log('   - Ensure realistic content for TCCC documents');

console.log('\n3. **If TCCC documents have low similarity:**');
console.log('   - Check embedding generation for TCCC documents');
console.log('   - Verify TCCC content is properly embedded');
console.log('   - Check if content is too generic');

console.log('\n4. **If FEMA/WHO documents have high similarity:**');
console.log('   - Check if FEMA/WHO content is too generic');
console.log('   - Verify document content is realistic');
console.log('   - Check if embeddings are working correctly');

console.log('\n📱 **To Debug:**');
console.log('1. Start app: npm start');
console.log('2. Watch logs for document loading');
console.log('3. Check document content generation');
console.log('4. Ask: "What is march algorithm?"');
console.log('5. Check search results');
console.log('6. Verify TCCC documents are loaded');

console.log('\n🎯 **Success Criteria:**');
console.log('✅ TCCC documents loaded successfully');
console.log('✅ TCCC documents contain MARCH algorithm content');
console.log('✅ TCCC documents appear in search results');
console.log('✅ TCCC documents have high similarity scores');
console.log('✅ Accurate RAG responses about MARCH algorithm'); 