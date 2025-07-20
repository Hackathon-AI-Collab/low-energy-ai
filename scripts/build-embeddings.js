#!/usr/bin/env node

/**
 * Build Embeddings Script
 * 
 * This script optimizes embeddings for production builds:
 * 1. Compresses embeddings using binary format
 * 2. Splits large files to enable lazy loading
 * 3. Generates compressed chunks for better performance
 * 
 * Usage:
 *   npm run build:embeddings
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);

const CHUNK_SIZE_LIMIT = 1024 * 1024; // 1MB per chunk
const EMBEDDINGS_DIR = path.join(__dirname, '../assets/embeddings');
const BUILD_DIR = path.join(__dirname, '../assets/embeddings-optimized');

async function optimizeEmbeddings() {
  console.log('🔄 Starting embedding optimization for production...');
  
  try {
    // Create build directory
    await fs.mkdir(BUILD_DIR, { recursive: true });
    
    // Load manifest
    const manifestPath = path.join(EMBEDDINGS_DIR, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    
    console.log(`📊 Processing ${manifest.totalDocuments} documents with ${manifest.totalChunks} chunks`);
    
    const optimizedManifest = {
      ...manifest,
      format: 'optimized',
      compression: 'gzip',
      chunkSizeLimit: CHUNK_SIZE_LIMIT,
      optimizedAt: new Date().toISOString()
    };
    
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    
    // Process each document
    for (const [docId, docInfo] of Object.entries(manifest.documents)) {
      console.log(`📄 Optimizing: ${docInfo.title}`);
      
      const originalPath = path.join(EMBEDDINGS_DIR, `${docId}.json`);
      const originalData = await fs.readFile(originalPath, 'utf-8');
      const embeddings = JSON.parse(originalData);
      
      const originalSize = Buffer.from(originalData).length;
      totalOriginalSize += originalSize;
      
      // Strategy 1: Single compressed file (for smaller documents)
      if (originalSize < CHUNK_SIZE_LIMIT) {
        const compressed = await gzip(originalData);
        const outputPath = path.join(BUILD_DIR, `${docId}.json.gz`);
        await fs.writeFile(outputPath, compressed);
        
        totalOptimizedSize += compressed.length;
        console.log(`  ├─ Single file: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(compressed.length / 1024 / 1024).toFixed(1)}MB (${Math.round(100 - (compressed.length / originalSize) * 100)}% reduction)`);
        
        optimizedManifest.documents[docId] = {
          ...docInfo,
          format: 'single',
          compressed: true,
          originalSize,
          optimizedSize: compressed.length,
          chunks: 1
        };
        
      } else {
        // Strategy 2: Split into chunks (for larger documents)
        console.log(`  ├─ Splitting large document into chunks...`);
        
        const chunksPerFile = Math.ceil(CHUNK_SIZE_LIMIT / (originalSize / embeddings.length));
        const fileChunks = [];
        
        for (let i = 0; i < embeddings.length; i += chunksPerFile) {
          const chunk = embeddings.slice(i, i + chunksPerFile);
          const chunkData = JSON.stringify(chunk);
          const compressed = await gzip(chunkData);
          
          const chunkIndex = Math.floor(i / chunksPerFile);
          const chunkPath = path.join(BUILD_DIR, `${docId}.chunk${chunkIndex}.json.gz`);
          await fs.writeFile(chunkPath, compressed);
          
          fileChunks.push({
            index: chunkIndex,
            embeddingCount: chunk.length,
            size: compressed.length
          });
          
          totalOptimizedSize += compressed.length;
        }
        
        console.log(`  ├─ Split into ${fileChunks.length} chunks: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(fileChunks.reduce((sum, c) => sum + c.size, 0) / 1024 / 1024).toFixed(1)}MB`);
        
        optimizedManifest.documents[docId] = {
          ...docInfo,
          format: 'chunked',
          compressed: true,
          originalSize,
          optimizedSize: fileChunks.reduce((sum, c) => sum + c.size, 0),
          chunks: fileChunks
        };
      }
    }
    
    // Save optimized manifest
    const optimizedManifestPath = path.join(BUILD_DIR, 'manifest.json');
    await fs.writeFile(optimizedManifestPath, JSON.stringify(optimizedManifest, null, 2));
    
    // Generate stats
    const compressionRatio = Math.round(100 - (totalOptimizedSize / totalOriginalSize) * 100);
    
    console.log(`\n✅ Embedding optimization complete!`);
    console.log(`📊 Compression Results:`);
    console.log(`   Original size: ${(totalOriginalSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Optimized size: ${(totalOptimizedSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Compression ratio: ${compressionRatio}%`);
    console.log(`   Output directory: ${BUILD_DIR}`);
    
    // Create integration script
    const integrationScript = `
# Integration Instructions

## 1. Update app.json
Replace the embeddings path:
\`\`\`json
"assets": [
  "./assets/images/",
  "./assets/documents/",
  "./assets/embeddings-optimized/"
]
\`\`\`

## 2. Update preComputedEmbeddingService.ts
The service will need to handle:
- Gzip decompression
- Chunked loading for large documents
- Progressive loading for better performance

## 3. Build Process Integration
Add to package.json:
\`\`\`json
"scripts": {
  "build:embeddings": "node scripts/build-embeddings.js",
  "prebuild": "npm run build:embeddings"
}
\`\`\`

## 4. Size Impact
- Original embeddings: ${(totalOriginalSize / 1024 / 1024).toFixed(1)}MB
- Optimized embeddings: ${(totalOptimizedSize / 1024 / 1024).toFixed(1)}MB  
- Bundle size reduction: ${compressionRatio}%
`;
    
    await fs.writeFile(path.join(BUILD_DIR, 'INTEGRATION.md'), integrationScript);
    
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Review ${BUILD_DIR}/INTEGRATION.md`);
    console.log(`   2. Update preComputedEmbeddingService.ts for compressed format`);
    console.log(`   3. Add build:embeddings to your CI/CD pipeline`);
    console.log(`   4. Test the optimized embeddings in the app`);
    
  } catch (error) {
    console.error('❌ Embedding optimization failed:', error);
    process.exit(1);
  }
}

// Run optimization
if (require.main === module) {
  optimizeEmbeddings();
}

module.exports = { optimizeEmbeddings };