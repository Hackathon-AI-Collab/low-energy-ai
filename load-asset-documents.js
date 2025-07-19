#!/usr/bin/env node

/**
 * Asset Document Loader Script
 * Helps load the medical and emergency documents from assets into the vector store
 */

console.log('📚 Asset Document Loader');
console.log('========================');

console.log('\n📋 Available Documents:');

const documents = [
  { id: 'who-prehospital-trauma', title: 'WHO Prehospital Trauma Care', category: 'medical', size: 168 },
  { id: 'tccc-handbook-v5', title: 'TCCC Handbook v5', category: 'medical', size: 150 },
  { id: 'tccc-quick-ref', title: 'TCCC Quick Reference', category: 'medical', size: 90 },
  { id: 'who-blue-book', title: 'WHO Blue Book', category: 'medical', size: 321 },
  { id: 'who-field-guide-limb-injuries', title: 'WHO Field Guide: Limb Injuries', category: 'medical', size: 289 },
  { id: 'who-highly-infectious-response', title: 'WHO Highly Infectious Response', category: 'medical', size: 434 },
  { id: 'who-injury-surveillance', title: 'WHO Injury Surveillance', category: 'medical', size: 185 },
  { id: 'who-medical-evacuation-2025', title: 'WHO Medical Evacuation 2025', category: 'medical', size: 322 },
  { id: 'who-pocket-book', title: 'WHO Pocket Book', category: 'medical', size: 697 },
  { id: 'usr-tpam', title: 'USR TPAM', category: 'emergency', size: 113 },
  { id: 'fema-ics-fog-2016', title: 'FEMA ICS Field Operations Guide 2016', category: 'emergency', size: 480 },
  { id: 'fema-incident-rehab-2008', title: 'FEMA Incident Rehabilitation 2008', category: 'emergency', size: 516 },
  { id: 'fema-usr-fog', title: 'FEMA USR Field Operations Guide', category: 'search-rescue', size: 60 },
  { id: 'fema-usr-ops', title: 'FEMA USR Operations', category: 'search-rescue', size: 192 },
  { id: 'insarag-coordination', title: 'INSARAG Coordination', category: 'coordination', size: 205 },
  { id: 'emap-usr-standard', title: 'EMAP USR Standard', category: 'search-rescue', size: 110 }
];

// Group by category
const byCategory = {
  medical: documents.filter(d => d.category === 'medical'),
  emergency: documents.filter(d => d.category === 'emergency'),
  'search-rescue': documents.filter(d => d.category === 'search-rescue'),
  coordination: documents.filter(d => d.category === 'coordination')
};

Object.entries(byCategory).forEach(([category, docs]) => {
  console.log(`\n🏥 ${category.toUpperCase()} (${docs.length} documents):`);
  docs.forEach(doc => {
    console.log(`  • ${doc.title} (${doc.size}KB)`);
  });
});

console.log('\n📊 Summary:');
console.log(`Total Documents: ${documents.length}`);
console.log(`Total Size: ${documents.reduce((sum, doc) => sum + doc.size, 0)}KB`);

console.log('\n🚀 How to Load Documents:');

console.log('\n1. **In the App**:');
console.log('   - Go to Knowledge Base screen');
console.log('   - Tap "Load Asset Documents" button');
console.log('   - Confirm the loading process');
console.log('   - Wait for completion (may take a few minutes)');

console.log('\n2. **What Happens**:');
console.log('   - Documents are read from assets/documents/');
console.log('   - Content is chunked into smaller pieces');
console.log('   - Chunks are stored in SQLite database');
console.log('   - Documents become searchable in the RAG system');

console.log('\n3. **After Loading**:');
console.log('   - Documents appear in Knowledge Base with "ASSET" badge');
console.log('   - You can ask questions about medical procedures');
console.log('   - RAG system will find relevant information');
console.log('   - LLM will generate responses based on document content');

console.log('\n💡 Example Queries After Loading:');

console.log('\n**Medical Queries**:');
console.log('- "What is the MARCH algorithm in TCCC?"');
console.log('- "How do I treat a limb injury in the field?"');
console.log('- "What are the steps for medical evacuation?"');
console.log('- "How do I respond to highly infectious disease?"');

console.log('\n**Emergency Response Queries**:');
console.log('- "What is the Incident Command System?"');
console.log('- "How do I set up incident rehabilitation?"');
console.log('- "What are USR field operations?"');

console.log('\n**Search & Rescue Queries**:');
console.log('- "What are the INSARAG coordination guidelines?"');
console.log('- "How do I conduct urban search and rescue?"');
console.log('- "What are the EMAP USR standards?"');

console.log('\n✅ Ready to Load!');
console.log('The documents are comprehensive medical and emergency response guidelines');
console.log('that will make your LEAI platform extremely useful for field operations.'); 