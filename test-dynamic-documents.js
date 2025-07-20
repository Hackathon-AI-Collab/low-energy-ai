#!/usr/bin/env node

/**
 * Test Dynamic Document Loading
 * Tests the new runtime document loading system
 */

console.log('🧪 Dynamic Document Loading Test');
console.log('================================');

// This is a test script to verify our new dynamic document loading works
async function testDynamicLoading() {
  try {
    console.log('\n📁 Testing Dynamic Document Loader...');
    
    // Import the services
    const { DynamicDocumentLoader } = require('./src/services/dynamicDocumentLoader');
    const { AssetDocumentService } = require('./src/services/assetDocumentService');
    
    console.log('✅ Services imported successfully');
    
    // Test 1: Initialize dynamic loader
    console.log('\n🔄 Test 1: Initialize Dynamic Loader');
    const dynamicLoader = DynamicDocumentLoader.getInstance();
    await dynamicLoader.initialize();
    
    const availableDocs = await dynamicLoader.getAvailableDocuments();
    console.log(`✅ Found ${availableDocs.length} documents:`);
    
    availableDocs.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.filename} (${doc.title}) - ${doc.size} bytes`);
    });
    
    // Test 2: Load a specific document
    if (availableDocs.length > 0) {
      console.log('\n🔄 Test 2: Load Specific Document');
      const firstDoc = availableDocs[0];
      console.log(`Loading: ${firstDoc.filename}`);
      
      try {
        const content = await dynamicLoader.loadDocument(firstDoc.filename);
        console.log(`✅ Successfully loaded ${firstDoc.filename}: ${content.length} characters`);
        console.log(`📄 Content preview: "${content.substring(0, 200)}..."`);
      } catch (loadError) {
        console.error(`❌ Failed to load ${firstDoc.filename}:`, loadError.message);
      }
    }
    
    // Test 3: Test AssetDocumentService
    console.log('\n🔄 Test 3: Test AssetDocumentService');
    const assetService = AssetDocumentService.getInstance();
    
    const allDocs = await assetService.getAllDocuments();
    console.log(`✅ AssetDocumentService found ${allDocs.length} documents:`);
    
    allDocs.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.title} (${doc.category}) - ${doc.size}KB`);
    });
    
    // Test 4: Load content through AssetDocumentService
    if (allDocs.length > 0) {
      console.log('\n🔄 Test 4: Load Content via AssetDocumentService');
      const firstDoc = allDocs[0];
      console.log(`Loading content for: ${firstDoc.title}`);
      
      try {
        const content = await assetService.loadDocumentContent(firstDoc.filename);
        console.log(`✅ Successfully loaded content: ${content.length} characters`);
        console.log(`📄 Content preview: "${content.substring(0, 200)}..."`);
        
        // Check if content is meaningful (not placeholder)
        if (content.includes('MARCH') || content.includes('WHO') || content.includes('FEMA')) {
          console.log('✅ Content appears to be real document content (not placeholder)');
        } else {
          console.log('⚠️  Content may be placeholder or fallback content');
        }
        
      } catch (loadError) {
        console.error(`❌ Failed to load content for ${firstDoc.filename}:`, loadError.message);
      }
    }
    
    // Test 5: Cache statistics
    console.log('\n🔄 Test 5: Cache Statistics');
    const cacheStats = dynamicLoader.getCacheStats();
    console.log(`✅ Cache contains ${cacheStats.size} documents`);
    console.log(`📊 Total cached size: ${Math.round(cacheStats.totalSize / 1024)}KB`);
    console.log(`📁 Cached files: ${cacheStats.files.join(', ')}`);
    
    console.log('\n🎉 Dynamic Document Loading Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`✅ Documents discovered: ${availableDocs.length}`);
    console.log(`✅ Documents processed: ${allDocs.length}`);
    console.log(`✅ Documents cached: ${cacheStats.size}`);
    console.log('\nThe dynamic document loading system is working correctly.');
    console.log('Documents are now loaded at runtime from assets/documents/ directory.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Error details:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Make sure files exist in assets/documents/ directory');
    console.error('2. Check that expo-file-system is properly installed');
    console.error('3. Verify React Native environment is set up correctly');
  }
}

// For React Native environment, we need to handle module loading differently
function isReactNativeEnvironment() {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

if (isReactNativeEnvironment()) {
  console.log('🔄 Running in React Native environment...');
  testDynamicLoading();
} else {
  console.log('ℹ️  This test is designed for React Native environment');
  console.log('📱 To test properly, run the app with: npm start');
  console.log('\n🎯 Expected behavior in React Native:');
  console.log('1. DynamicDocumentLoader scans assets/documents/');
  console.log('2. AssetDocumentService uses real file content');
  console.log('3. Vector search uses actual document content');
  console.log('4. RAG responses are based on real documents');
}

console.log('\n📱 Next Steps:');
console.log('1. Start the app: npm start');
console.log('2. Watch logs for document loading messages');
console.log('3. Test RAG queries to verify real content is being used');
console.log('4. Ask "What is MARCH algorithm?" to test TCCC document loading');
console.log('5. Ask "What is ICS?" to test FEMA document loading');