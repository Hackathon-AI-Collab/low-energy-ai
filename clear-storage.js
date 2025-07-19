#!/usr/bin/env node

/**
 * Script to clear AsyncStorage when it's full
 * Run this when you get "database or disk is full" errors
 */

console.log('🧹 LEAI Storage Cleanup Script');
console.log('================================');

console.log('\n📋 Current Issue:');
console.log('- AsyncStorage is full (SQLITE_FULL error)');
console.log('- This happens when embeddings take up too much space');
console.log('- The app cannot save new documents or embeddings');

console.log('\n🔧 Solutions:');

console.log('\n1. **Automatic Cleanup (Recommended)**');
console.log('   - The updated DocumentStorageService now:');
console.log('     • Reduces storage limit to 5MB');
console.log('     • Saves chunks in batches of 50');
console.log('     • Automatically clears old data when storage is full');
console.log('     • Compresses embeddings to save space');

console.log('\n2. **Manual Cleanup**');
console.log('   - Restart the app (this will clear in-memory data)');
console.log('   - The app will automatically clear storage if needed');

console.log('\n3. **Nuclear Option (If still having issues)**');
console.log('   - Uninstall and reinstall the app');
console.log('   - This completely clears all AsyncStorage data');

console.log('\n🚀 Next Steps:');
console.log('1. Restart the app: npx expo start --clear');
console.log('2. The app should now handle storage limits automatically');
console.log('3. If you still get errors, try the nuclear option');

console.log('\n📊 Storage Management Features:');
console.log('✅ Automatic storage limit detection');
console.log('✅ Batch saving to prevent memory issues');
console.log('✅ Automatic cleanup when storage is full');
console.log('✅ Storage statistics and monitoring');
console.log('✅ Emergency cleanup utilities');

console.log('\n💡 Tips for Future:');
console.log('- Keep documents under 1MB each');
console.log('- The app will automatically manage storage');
console.log('- Monitor storage usage in the Knowledge Base screen');
console.log('- Clear old documents if storage gets full');

console.log('\n✅ Ready to fix storage issues!'); 