import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import * as pako from 'pako';
import { getManifest, getEmbeddingsForDocument } from './embeddingsRegistry';

export interface PreComputedEmbedding {
  documentId: string;
  chunkId: string;
  content: string;
  contentHash: string;
  embedding: number[];
  metadata: {
    chunkIndex: number;
    documentTitle: string;
    modelVersion: string;
    createdAt: string;
  };
}

export interface EmbeddingManifest {
  version: string;
  modelName: string;
  modelVersion: string;
  dimension: number;
  totalDocuments: number;
  totalChunks: number;
  createdAt: string;
  format?: string; // 'legacy' or 'optimized'
  compression?: string; // 'none' or 'gzip'
  chunkSizeLimit?: number;
  optimizedAt?: string;
  documents: {
    [documentId: string]: {
      title: string;
      filename: string;
      chunkCount: number;
      contentHash: string;
      format?: 'single' | 'chunked';
      compressed?: boolean;
      originalSize?: number;
      optimizedSize?: number;
      chunks?: Array<{
        index: number;
        embeddingCount: number;
        size: number;
      }> | number;
    };
  };
}

export class PreComputedEmbeddingService {
  private static instance: PreComputedEmbeddingService;
  private manifest: EmbeddingManifest | null = null;
  private embeddingsCache: Map<string, PreComputedEmbedding[]> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): PreComputedEmbeddingService {
    if (!PreComputedEmbeddingService.instance) {
      PreComputedEmbeddingService.instance = new PreComputedEmbeddingService();
    }
    return PreComputedEmbeddingService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('🔄 PreComputedEmbeddingService: Initializing...');
      
      // Try to load the manifest
      const manifestLoaded = await this.loadManifest();
      if (!manifestLoaded) {
        console.log('📦 No pre-computed embeddings found - will generate dynamically');
        this.isInitialized = true;
        return false;
      }

      console.log(`✅ PreComputedEmbeddingService: Found embeddings v${this.manifest!.version}`);
      console.log(`📊 ${this.manifest!.totalDocuments} documents, ${this.manifest!.totalChunks} chunks`);
      
      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ PreComputedEmbeddingService: Initialization failed:', error);
      this.isInitialized = true;
      return false;
    }
  }

  private async loadManifest(): Promise<boolean> {
    try {
      // Load manifest directly from registry (no async needed)
      this.manifest = getManifest();
      if (this.manifest) {
        console.log('📦 Loaded manifest from registry - pre-computed embeddings available');
        console.log(`📦 Found ${this.manifest.totalDocuments} documents with ${this.manifest.totalChunks} chunks`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('📦 Failed to load manifest from registry:', error);
      return false;
    }
  }

  async getDocumentEmbeddings(documentId: string): Promise<PreComputedEmbedding[] | null> {
    if (!this.manifest) return null;

    // Check cache first
    if (this.embeddingsCache.has(documentId)) {
      return this.embeddingsCache.get(documentId)!;
    }

    try {
      console.log(`📦 Loading pre-computed embeddings for: ${documentId}`);
      
      const docInfo = this.manifest.documents[documentId];
      if (!docInfo) {
        console.warn(`📦 Document ${documentId} not found in manifest`);
        return null;
      }

      let embeddings: PreComputedEmbedding[];
      
      // Handle optimized format with compression and chunking
      if (this.manifest.format === 'optimized' && docInfo.format) {
        embeddings = await this.loadOptimizedEmbeddings(documentId, docInfo);
      } else {
        // Legacy format - single JSON file
        embeddings = await this.loadLegacyEmbeddings(documentId);
      }
        
      // Cache the embeddings
      this.embeddingsCache.set(documentId, embeddings);
      
      console.log(`✅ Loaded ${embeddings.length} pre-computed embeddings for ${documentId}`);
      return embeddings;
      
    } catch (error) {
      console.warn(`📦 Failed to load pre-computed embeddings for ${documentId}:`, error);
      return null;
    }
  }

  private async loadLegacyEmbeddings(documentId: string): Promise<PreComputedEmbedding[]> {
    try {
      // Load embeddings directly from registry (no async needed)
      const embeddings = getEmbeddingsForDocument(documentId);
      if (!embeddings) {
        throw new Error(`No embeddings found for document: ${documentId}`);
      }
      
      console.log(`📦 Loaded ${embeddings.length} pre-computed embeddings for ${documentId}`);
      return embeddings;
    } catch (error) {
      throw new Error(`Failed to load embeddings for ${documentId}: ${error}`);
    }
  }

  private async loadOptimizedEmbeddings(documentId: string, docInfo: any): Promise<PreComputedEmbedding[]> {
    if (docInfo.format === 'single') {
      // Single compressed file
      return await this.loadCompressedFile(documentId);
    } else if (docInfo.format === 'chunked') {
      // Multiple compressed chunks
      return await this.loadChunkedFiles(documentId, docInfo.chunks);
    } else {
      throw new Error(`Unknown format: ${docInfo.format}`);
    }
  }

  private async loadCompressedFile(documentId: string): Promise<PreComputedEmbedding[]> {
    // For now, fall back to uncompressed legacy embeddings until we solve the asset compression issue
    console.log(`📦 Loading legacy embeddings for ${documentId} (compressed loading not yet implemented)`);
    return await this.loadLegacyEmbeddings(documentId);
  }

  private async loadChunkedFiles(documentId: string, chunks: Array<{index: number; embeddingCount: number; size: number}>): Promise<PreComputedEmbedding[]> {
    // For now, fall back to uncompressed legacy embeddings until we solve the asset compression issue
    console.log(`📦 Loading legacy embeddings for ${documentId} (chunked compressed loading not yet implemented)`);
    return await this.loadLegacyEmbeddings(documentId);
  }

  async getAllPreComputedEmbeddings(): Promise<Map<string, PreComputedEmbedding[]>> {
    if (!this.manifest) return new Map();

    const results = new Map<string, PreComputedEmbedding[]>();
    
    console.log(`📦 Loading all pre-computed embeddings for ${Object.keys(this.manifest.documents).length} documents...`);
    
    for (const documentId of Object.keys(this.manifest.documents)) {
      const embeddings = await this.getDocumentEmbeddings(documentId);
      if (embeddings) {
        results.set(documentId, embeddings);
      }
    }
    
    console.log(`✅ Loaded pre-computed embeddings for ${results.size} documents`);
    return results;
  }

  // Check if document needs re-embedding (content changed)
  async needsRecompute(documentId: string, currentContentHash: string): Promise<boolean> {
    if (!this.manifest) return true;
    
    const docInfo = this.manifest.documents[documentId];
    if (!docInfo) return true;
    
    const needsUpdate = docInfo.contentHash !== currentContentHash;
    if (needsUpdate) {
      console.log(`🔄 Document ${documentId} content changed, needs re-embedding`);
    }
    
    return needsUpdate;
  }

  // Validate embedding compatibility
  isCompatible(dimension: number, modelName: string): boolean {
    if (!this.manifest) return false;
    
    const compatible = this.manifest.dimension === dimension && 
                      this.manifest.modelName === modelName;
    
    if (!compatible) {
      console.log(`⚠️ Pre-computed embeddings incompatible:`);
      console.log(`  Expected: ${modelName} (${dimension}D)`);
      console.log(`  Found: ${this.manifest.modelName} (${this.manifest.dimension}D)`);
    }
    
    return compatible;
  }

  getManifest(): EmbeddingManifest | null {
    return this.manifest;
  }

  getStats(): { available: boolean; version?: string; documents?: number; chunks?: number } {
    if (!this.manifest) {
      return { available: false };
    }
    
    return {
      available: true,
      version: this.manifest.version,
      documents: this.manifest.totalDocuments,
      chunks: this.manifest.totalChunks
    };
  }
}

// Export utility function to generate content hash
export function generateContentHash(content: string): string {
  // Simple hash function for content verification
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}