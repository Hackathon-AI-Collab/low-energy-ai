#!/usr/bin/env node

/**
 * Verify Document Loading Test
 * Check that all documents are being loaded into the vector store
 */

console.log('📋 Document Loading Verification');
console.log('================================');

console.log('\n🔍 What to check in your app logs:');

console.log('\n1. **Dynamic Document Discovery:**');
console.log('   Look for: "DynamicDocumentLoader: Found X documents"');
console.log('   Expected: Should find 16 documents');

console.log('\n2. **Document Loading Messages:**');
console.log('   Look for these specific documents being loaded:');
console.log('   ✅ "Successfully loaded fema_usr_ops.md: XXXX characters"');
console.log('   ✅ "Successfully loaded usr_tpam.md: XXXX characters"');
console.log('   ✅ "Successfully loaded insarag_coordination.md: XXXX characters"');
console.log('   ✅ "Successfully loaded emap_usr_standard.md: XXXX characters"');
console.log('   ✅ "Successfully loaded tccc_handbook_v5.md: XXXX characters"');

console.log('\n3. **Vector Store Population:**');
console.log('   Look for: "📄 Voy Vector Store: Adding document [title]"');
console.log('   Expected categories:');
console.log('   - 🏷️ Category: FEMA/Search & Rescue');
console.log('   - 🏷️ Category: TCCC/Military Medical');
console.log('   - 🏷️ Category: WHO/Medical');
console.log('   - 🏷️ Category: International/Coordination');

console.log('\n4. **Search Diversity Working:**');
console.log('   When you search "search and rescue procedures", look for:');
console.log('   - 🔍 Applying diversity filter: max X chunks per document');
console.log('   - 📊 Result diversity: Multiple different documents');

console.log('\n5. **Expected Search Results for Different Queries:**');

const testQueries = [
  {
    query: 'search and rescue procedures',
    expected: ['FEMA USR Operations', 'USR TPAM', 'INSARAG Coordination', 'EMAP USR Standard'],
    avoid: ['TCCC Handbook only', 'All same document']
  },
  {
    query: 'MARCH algorithm',
    expected: ['TCCC Handbook V5', 'TCCC Quick Reference'],
    avoid: ['FEMA documents', 'WHO documents only']
  },
  {
    query: 'WHO medical guidelines',
    expected: ['WHO Prehospital Trauma', 'WHO Pocket Book', 'WHO Blue Book'],
    avoid: ['TCCC documents', 'FEMA documents']
  },
  {
    query: 'incident command system',
    expected: ['FEMA ICS FOG 2016', 'FEMA Incident Rehab'],
    avoid: ['Medical documents', 'Search rescue only']
  }
];

testQueries.forEach((test, index) => {
  console.log(`\n📝 Test ${index + 1}: "${test.query}"`);
  console.log(`   ✅ Should find: ${test.expected.join(', ')}`);
  console.log(`   ❌ Should avoid: ${test.avoid.join(', ')}`);
});

console.log('\n🎯 Success Indicators:');
console.log('✅ All 16 documents loaded successfully');
console.log('✅ Documents categorized correctly (FEMA/Search & Rescue, TCCC/Medical, etc.)');
console.log('✅ Search results show document diversity');
console.log('✅ Query "search and rescue" finds USR/FEMA documents');
console.log('✅ Query "MARCH algorithm" finds TCCC documents');
console.log('✅ No single document dominates all search results');

console.log('\n🚨 Red Flags:');
console.log('❌ Only TCCC documents loading');
console.log('❌ Search always returns same 2-3 documents');
console.log('❌ No "FEMA/Search & Rescue" category logs');
console.log('❌ Diversity filter not being applied');

console.log('\n📱 To Test:');
console.log('1. npm start');
console.log('2. Wait for all documents to load');
console.log('3. Try each test query above');
console.log('4. Check logs match success indicators');
console.log('5. Verify search results are diverse and relevant');

console.log('\n🔧 Current Status:');
console.log('✅ Document diversity algorithm added');
console.log('✅ Enhanced logging for debugging');
console.log('✅ Dynamic document loading working');
console.log('🔄 Need to verify all documents are being embedded properly');

console.log('\n💡 If you still see issues:');
console.log('- Check if USR documents are being loaded with embeddings');
console.log('- Verify embedding quality (ONNX vs hash fallback)');
console.log('- Look for dimension compatibility issues');
console.log('- Confirm document content is meaningful (not just headers)');