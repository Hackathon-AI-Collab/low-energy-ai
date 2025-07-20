#!/usr/bin/env node

/**
 * Debug Vector Search Issues
 * Diagnose why "search and rescue procedures" returns TCCC documents
 */

console.log('🔍 Vector Search Debug Script');
console.log('=============================');

async function debugVectorSearch() {
  try {
    console.log('\n📊 Problem Analysis:');
    console.log('Query: "Search and rescue procedures"');
    console.log('Expected: FEMA USR, INSARAG, EMAP documents');  
    console.log('Actual: TCCC Handbook, TCCC Quick Ref documents');
    console.log('Issue: Wrong documents being retrieved by vector search');

    console.log('\n🔍 Potential Root Causes:');
    
    console.log('\n1. **Document Loading Issues:**');
    console.log('   ❓ Are search and rescue documents being loaded?');
    console.log('   ❓ Is their content being processed correctly?');
    console.log('   ❓ Are they being added to the vector store?');
    
    console.log('\n2. **Embedding Issues:**');
    console.log('   ❓ Are TCCC documents getting better embeddings?');
    console.log('   ❓ Are search and rescue documents getting poor embeddings?');
    console.log('   ❓ Is the ONNX model working or falling back to hash?');
    
    console.log('\n3. **Vector Search Algorithm Issues:**');
    console.log('   ❓ Is cosine similarity calculation working correctly?');
    console.log('   ❓ Are embedding dimensions compatible?');
    console.log('   ❓ Is the search returning diverse results?');

    console.log('\n📋 Debug Steps to Take:');
    
    console.log('\n🔍 Step 1: Check Document Loading');
    console.log('Look for these logs when app starts:');
    console.log('✅ "Successfully loaded fema_usr_ops.md: XXXX characters"');
    console.log('✅ "Successfully loaded usr_tpam.md: XXXX characters"');
    console.log('✅ "Successfully loaded insarag_coordination.md: XXXX characters"');
    console.log('✅ "Successfully loaded emap_usr_standard.md: XXXX characters"');
    
    console.log('\n🔍 Step 2: Check Vector Store Population');
    console.log('Look for these logs:');
    console.log('✅ "Voy Vector Store: Successfully added document \\"FEMA USR Operations\\""');
    console.log('✅ "Voy Vector Store: Successfully added document \\"USR TPAM\\""');
    console.log('✅ "Found X documents with embeddings out of Y total chunks"');
    
    console.log('\n🔍 Step 3: Check Embedding Quality');
    console.log('Look for these logs:');
    console.log('✅ "Using ONNX model embedding generation successful"');
    console.log('❌ "Using hash-based embedding generation" (fallback - not ideal)');
    console.log('✅ "Query embedding dimension: 384" (should match chunk dimensions)');
    
    console.log('\n🔍 Step 4: Check Search Process');
    console.log('When you query "search and rescue procedures", look for:');
    console.log('✅ "VoyVectorStore: Found X similar chunks"');
    console.log('✅ "Result 1: [Document Name] (similarity: X.XXXX)"');
    console.log('✅ "Result 2: [Document Name] (similarity: X.XXXX)"');

    console.log('\n🎯 Expected Search Results for "search and rescue procedures":');
    console.log('1. **FEMA USR Operations** - Contains "Urban Search and Rescue"');
    console.log('2. **USR TPAM** - Contains "US&R Response System"');
    console.log('3. **INSARAG Coordination** - Contains "International Search and Rescue"');
    console.log('4. **EMAP USR Standard** - Contains "Urban Search and Rescue standards"');
    
    console.log('\n❌ Should NOT return:');
    console.log('- TCCC Handbook (military medical, not search and rescue)');
    console.log('- TCCC Quick Ref (military medical, not search and rescue)');

    console.log('\n🔧 Debugging Commands:');
    
    console.log('\n📱 1. Start app and watch logs:');
    console.log('   npm start');
    console.log('   Look for document loading messages');
    
    console.log('\n🧪 2. Test specific queries:');
    console.log('   Query: "urban search and rescue"');
    console.log('   Query: "FEMA disaster response"'); 
    console.log('   Query: "structural collapse operations"');
    console.log('   Query: "victim extraction procedures"');
    
    console.log('\n🔍 3. Check document content:');
    console.log('   Verify search and rescue documents contain relevant keywords');
    console.log('   Confirm TCCC documents are about medical care, not rescue');

    console.log('\n🛠️ Likely Fixes Needed:');
    
    console.log('\n1. **If documents not loading:**');
    console.log('   - Check DynamicDocumentLoader is finding the files');
    console.log('   - Verify file paths and permissions');
    console.log('   - Check for loading errors in logs');
    
    console.log('\n2. **If documents loading but not in vector store:**'); 
    console.log('   - Check AssetDocumentService.loadAllDocumentsToVectorStore()');
    console.log('   - Verify VoyVectorStore.addDocument() calls');
    console.log('   - Look for chunking and embedding errors');
    
    console.log('\n3. **If embeddings are poor quality:**');
    console.log('   - Check if ONNX model is working (not hash fallback)');
    console.log('   - Verify sentence transformer initialization');
    console.log('   - Check embedding dimensions are consistent');
    
    console.log('\n4. **If search algorithm issues:**');
    console.log('   - Check cosine similarity calculation');
    console.log('   - Verify searchSimilarChunks() is working correctly');
    console.log('   - Check if search is returning diverse results');

    console.log('\n🚀 Testing Strategy:');
    
    console.log('\n📊 Test Matrix:');
    console.log('┌─────────────────────────────┬─────────────────────────────┐');
    console.log('│ Query                       │ Expected Top Documents      │');
    console.log('├─────────────────────────────┼─────────────────────────────┤');
    console.log('│ "search and rescue"         │ FEMA USR, USR TPAM         │');
    console.log('│ "MARCH algorithm"           │ TCCC Handbook, TCCC Quick   │');
    console.log('│ "WHO medical guidelines"    │ WHO documents               │');
    console.log('│ "incident command system"   │ FEMA ICS documents          │');
    console.log('│ "structural collapse"       │ FEMA USR, EMAP documents    │');
    console.log('└─────────────────────────────┴─────────────────────────────┘');

    console.log('\n✅ Success Criteria:');
    console.log('- All document types are loaded and embedded');
    console.log('- Queries return semantically relevant documents'); 
    console.log('- Search and rescue queries find USR/FEMA/INSARAG docs');
    console.log('- Medical queries find TCCC/WHO docs');
    console.log('- No single document type dominates all results');

    console.log('\n📱 Next Steps:');
    console.log('1. Run: npm start');
    console.log('2. Watch document loading logs carefully');
    console.log('3. Test the query matrix above');
    console.log('4. Check if search results match expectations');
    console.log('5. Report back with specific log messages and results');

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugVectorSearch();