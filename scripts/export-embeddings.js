#!/usr/bin/env node

/**
 * Export Embeddings Script
 * 
 * This script generates pre-computed embeddings from the current documents
 * using the actual ONNX model and exports them as JSON files to be shipped with the app.
 * 
 * Usage:
 *   node scripts/export-embeddings.js
 * 
 * Output:
 *   - assets/embeddings/manifest.json
 *   - assets/embeddings/{documentId}.json (for each document)
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// ONNX Model setup for Node.js
let embeddingPipeline = null;
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;

// Mock implementations for Node.js environment
const mockServices = {
  // Simple content hash for Node.js
  generateContentHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  },

  // Simple chunking algorithm (matching the app's logic)
  chunkContent(content, documentId) {
    const chunkSize = 800;
    const overlap = 100;
    const chunks = [];
    
    // Clean the content
    const cleanedContent = content
      .replace(/---\s*## Page \d+/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into sentences
    const sentences = cleanedContent.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      if (currentChunk.length > 0 && (currentChunk.length + trimmedSentence.length) > chunkSize) {
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          content: currentChunk.trim(),
          chunkIndex,
          embedding: [] // Will be filled by embedding generation
        });
        chunkIndex++;
        
        // Start new chunk with overlap
        const words = currentChunk.trim().split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 5));
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim().length > 50) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        content: currentChunk.trim(),
        chunkIndex,
        embedding: []
      });
    }
    
    return chunks;
  }
};

async function loadDocuments() {
  const documentsDir = path.join(__dirname, '../assets/documents');
  const files = await fs.readdir(documentsDir);
  const documents = [];
  
  for (const file of files) {
    if (file.endsWith('.md')) {
      const filePath = path.join(documentsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const documentId = file.replace('.md', '');
      
      documents.push({
        id: documentId,
        title: file.replace('.md', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        filename: file,
        content,
        contentHash: mockServices.generateContentHash(content)
      });
    }
  }
  
  return documents;
}

// Initialize the ONNX embedding pipeline using dynamic import
async function initializeEmbeddingModel() {
  if (!embeddingPipeline) {
    console.log(`🔄 Loading ONNX model: ${MODEL_NAME}...`);
    try {
      // Use dynamic import for ES module
      const { pipeline } = await import('@xenova/transformers');
      
      embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
        quantized: false,
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            console.log(`  ├─ Downloading: ${progress.name} (${Math.round(progress.progress)}%)`);
          } else if (progress.status === 'loading') {
            console.log(`  ├─ Loading: ${progress.name}`);
          }
        }
      });
      console.log('✅ ONNX model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load ONNX model:', error);
      throw error;
    }
  }
  return embeddingPipeline;
}

// Generate real embeddings using ONNX model
async function generateEmbedding(text) {
  try {
    const pipeline = await initializeEmbeddingModel();
    const result = await pipeline(text, { pooling: 'mean', normalize: true });
    
    // Extract the embedding array from the result
    let embedding;
    if (result && result.data) {
      embedding = Array.from(result.data);
    } else if (Array.isArray(result)) {
      embedding = result;
    } else {
      throw new Error('Unexpected embedding result format');
    }
    
    // Validate dimension
    if (embedding.length !== EMBEDDING_DIMENSION) {
      console.warn(`Warning: Expected ${EMBEDDING_DIMENSION}D embedding, got ${embedding.length}D`);
    }
    
    return embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

async function exportEmbeddings() {
  try {
    console.log('🚀 Starting embedding export process...');
    
    // Load documents
    const documents = await loadDocuments();
    console.log(`📚 Found ${documents.length} documents to process`);
    
    // Create embeddings directory
    const embeddingsDir = path.join(__dirname, '../assets/embeddings');
    await fs.mkdir(embeddingsDir, { recursive: true });
    
    // Initialize the ONNX model first
    await initializeEmbeddingModel();
    
    // Process each document
    const manifest = {
      version: '1.0.0',
      modelName: 'all-MiniLM-L6-v2',
      modelVersion: '1.0.0', 
      dimension: EMBEDDING_DIMENSION,
      totalDocuments: documents.length,
      totalChunks: 0,
      createdAt: new Date().toISOString(),
      documents: {}
    };
    
    for (const doc of documents) {
      console.log(`📄 Processing: ${doc.title}`);
      
      // Chunk the document
      const chunks = mockServices.chunkContent(doc.content, doc.id);
      console.log(`  ├─ Created ${chunks.length} chunks`);
      
      // Generate embeddings for each chunk
      const embeddingsData = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`  ├─ Generating embedding ${i + 1}/${chunks.length}`);
        
        try {
          const embedding = await generateEmbedding(chunk.content);
          
          embeddingsData.push({
            documentId: doc.id,
            chunkId: chunk.id,
            content: chunk.content,
            contentHash: mockServices.generateContentHash(chunk.content),
            embedding: embedding,
            metadata: {
              chunkIndex: chunk.chunkIndex,
              documentTitle: doc.title,
              modelVersion: '1.0.0',
              createdAt: new Date().toISOString()
            }
          });
        } catch (error) {
          console.error(`  ├─ Failed to generate embedding for chunk ${i + 1}:`, error);
          throw error;
        }
      }
      
      // Save embeddings for this document
      const embeddingFilePath = path.join(embeddingsDir, `${doc.id}.json`);
      await fs.writeFile(embeddingFilePath, JSON.stringify(embeddingsData, null, 2));
      console.log(`  └─ Saved to ${doc.id}.json`);
      
      // Update manifest
      manifest.documents[doc.id] = {
        title: doc.title,
        filename: doc.filename,
        chunkCount: chunks.length,
        contentHash: doc.contentHash
      };
      manifest.totalChunks += chunks.length;
    }
    
    // Save manifest
    const manifestPath = path.join(embeddingsDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`✅ Export complete!`);
    console.log(`📊 Summary:`);
    console.log(`   Documents: ${manifest.totalDocuments}`);
    console.log(`   Chunks: ${manifest.totalChunks}`);
    console.log(`   Output: ${embeddingsDir}`);
    console.log(`   Files: manifest.json + ${Object.keys(manifest.documents).length} embedding files`);
    
    const totalSizeMB = (await getTotalSize(embeddingsDir) / 1024 / 1024).toFixed(1);
    
    console.log(`\n🔧 Next steps:`);
    console.log(`   1. Run 'npm run build:embeddings' to optimize for production`);
    console.log(`   2. Test the app to ensure pre-computed embeddings load correctly`);
    console.log(`   3. Total size: ${totalSizeMB}MB (will be compressed during build)`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Helper function to calculate total directory size
async function getTotalSize(dirPath) {
  let totalSize = 0;
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);
    totalSize += stats.size;
  }
  
  return totalSize;
}

// Run the export
if (require.main === module) {
  exportEmbeddings();
}

module.exports = { exportEmbeddings };