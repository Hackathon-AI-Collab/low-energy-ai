import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentChunk, DocumentMetadata } from './voyVectorStore';

export interface StoredDocument {
  id: string;
  title: string;
  content: string;
  type: string;
  version: number;
  hash: string;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
  importance: number;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: {
    chunkIndex: number;
    startPosition: number;
    endPosition: number;
    importance: number;
    similarityScore?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export class DocumentStorageService {
  private static instance: DocumentStorageService;
  private documentsKey = 'leai_documents';
  private chunksKey = 'leai_chunks';
  private maxStorageSize = 5 * 1024 * 1024; // Reduced to 5MB limit
  private maxChunksPerSave = 50; // Save chunks in batches

  private constructor() {}

  static getInstance(): DocumentStorageService {
    if (!DocumentStorageService.instance) {
      DocumentStorageService.instance = new DocumentStorageService();
    }
    return DocumentStorageService.instance;
  }

  // Compress embedding by reducing precision and removing zeros
  private compressEmbedding(embedding: number[]): string {
    return embedding
      .map(val => Math.round(val * 1000) / 1000) // Round to 3 decimal places
      .filter(val => val !== 0) // Remove zeros
      .join(',');
  }

  // Decompress embedding back to full array
  private decompressEmbedding(compressed: string, dimension: number = 384): number[] {
    const values = compressed.split(',').map(val => parseFloat(val) || 0);
    const embedding = new Array(dimension).fill(0);
    
    // Fill in non-zero values (this is a simplified approach)
    for (let i = 0; i < Math.min(values.length, dimension); i++) {
      embedding[i] = values[i];
    }
    
    return embedding;
  }

  // Save documents to AsyncStorage
  async saveDocuments(documents: Map<string, DocumentMetadata>): Promise<void> {
    try {
      const documentsArray: StoredDocument[] = Array.from(documents.values()).map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        version: doc.version,
        hash: doc.hash,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        chunkCount: doc.chunkCount,
        importance: doc.importance,
        content: '' // We don't store full content in documents table to save space
      }));

      const documentsJson = JSON.stringify(documentsArray);
      console.log(`DocumentStorage: Saving ${documentsArray.length} documents (${documentsJson.length} bytes)`);
      
      if (documentsJson.length > this.maxStorageSize) {
        throw new Error(`Documents exceed storage limit: ${documentsJson.length} bytes > ${this.maxStorageSize} bytes`);
      }

      await AsyncStorage.setItem(this.documentsKey, documentsJson);
      console.log('DocumentStorage: Documents saved successfully');
    } catch (error) {
      console.error('DocumentStorage: Failed to save documents:', error);
      throw error;
    }
  }

  // Load documents from AsyncStorage
  async loadDocuments(): Promise<Map<string, DocumentMetadata>> {
    try {
      const documentsJson = await AsyncStorage.getItem(this.documentsKey);
      if (!documentsJson) {
        console.log('DocumentStorage: No documents found in storage');
        return new Map();
      }

      const documentsArray: StoredDocument[] = JSON.parse(documentsJson);
      const documents = new Map<string, DocumentMetadata>();

      for (const storedDoc of documentsArray) {
        const document: DocumentMetadata = {
          id: storedDoc.id,
          title: storedDoc.title,
          type: storedDoc.type,
          version: storedDoc.version,
          hash: storedDoc.hash,
          createdAt: new Date(storedDoc.createdAt),
          updatedAt: new Date(storedDoc.updatedAt),
          chunkCount: storedDoc.chunkCount,
          importance: storedDoc.importance,
          chunks: new Map() // Will be populated when chunks are loaded
        };
        documents.set(storedDoc.id, document);
      }

      console.log(`DocumentStorage: Loaded ${documents.size} documents`);
      return documents;
    } catch (error) {
      console.error('DocumentStorage: Failed to load documents:', error);
      return new Map();
    }
  }

  // Save chunks to AsyncStorage with compression and batching
  async saveChunks(chunks: Map<string, DocumentChunk>): Promise<void> {
    try {
      const chunksArray: StoredChunk[] = Array.from(chunks.values()).map(chunk => ({
        id: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        embedding: chunk.embedding, // Keep original for now, will compress in batches
        metadata: chunk.metadata,
        createdAt: chunk.createdAt.toISOString(),
        updatedAt: chunk.updatedAt.toISOString()
      }));

      // Check if we need to clear storage first
      const currentSize = await this.getCurrentStorageSize();
      const estimatedSize = JSON.stringify(chunksArray).length;
      
      if (currentSize + estimatedSize > this.maxStorageSize) {
        console.warn('DocumentStorage: Storage limit approaching, clearing old data...');
        await this.clearOldestData();
      }

      // Save in batches to avoid memory issues
      const batchSize = this.maxChunksPerSave;
      for (let i = 0; i < chunksArray.length; i += batchSize) {
        const batch = chunksArray.slice(i, i + batchSize);
        const batchKey = `${this.chunksKey}_batch_${Math.floor(i / batchSize)}`;
        
        const batchJson = JSON.stringify(batch);
        console.log(`DocumentStorage: Saving batch ${Math.floor(i / batchSize) + 1} with ${batch.length} chunks (${batchJson.length} bytes)`);
        
        await AsyncStorage.setItem(batchKey, batchJson);
      }

      // Save batch metadata
      const batchCount = Math.ceil(chunksArray.length / batchSize);
      await AsyncStorage.setItem(`${this.chunksKey}_metadata`, JSON.stringify({ batchCount, totalChunks: chunksArray.length }));

      console.log('DocumentStorage: Chunks saved successfully in batches');
    } catch (error) {
      console.error('DocumentStorage: Failed to save chunks:', error);
      throw error;
    }
  }

  // Load chunks from AsyncStorage with batch loading
  async loadChunks(): Promise<Map<string, DocumentChunk>> {
    try {
      // Load batch metadata
      const metadataJson = await AsyncStorage.getItem(`${this.chunksKey}_metadata`);
      if (!metadataJson) {
        console.log('DocumentStorage: No chunks found in storage');
        return new Map();
      }

      const metadata = JSON.parse(metadataJson);
      const chunks = new Map<string, DocumentChunk>();

      // Load all batches
      for (let i = 0; i < metadata.batchCount; i++) {
        const batchKey = `${this.chunksKey}_batch_${i}`;
        const batchJson = await AsyncStorage.getItem(batchKey);
        
        if (batchJson) {
          const batchArray: StoredChunk[] = JSON.parse(batchJson);
          
          for (const storedChunk of batchArray) {
            const chunk: DocumentChunk = {
              id: storedChunk.id,
              documentId: storedChunk.documentId,
              content: storedChunk.content,
              embedding: storedChunk.embedding,
              metadata: storedChunk.metadata,
              createdAt: new Date(storedChunk.createdAt),
              updatedAt: new Date(storedChunk.updatedAt)
            };
            chunks.set(storedChunk.id, chunk);
          }
        }
      }

      console.log(`DocumentStorage: Loaded ${chunks.size} chunks from ${metadata.batchCount} batches`);
      return chunks;
    } catch (error) {
      console.error('DocumentStorage: Failed to load chunks:', error);
      return new Map();
    }
  }

  // Save both documents and chunks
  async saveAll(documents: Map<string, DocumentMetadata>, chunks: Map<string, DocumentChunk>): Promise<void> {
    try {
      await Promise.all([
        this.saveDocuments(documents),
        this.saveChunks(chunks)
      ]);
      console.log('DocumentStorage: All data saved successfully');
    } catch (error) {
      console.error('DocumentStorage: Failed to save all data:', error);
      throw error;
    }
  }

  // Load both documents and chunks
  async loadAll(): Promise<{ documents: Map<string, DocumentMetadata>, chunks: Map<string, DocumentChunk> }> {
    try {
      const [documents, chunks] = await Promise.all([
        this.loadDocuments(),
        this.loadChunks()
      ]);

      // Link chunks to their documents
      for (const [chunkId, chunk] of chunks.entries()) {
        const document = documents.get(chunk.documentId);
        if (document) {
          document.chunks.set(chunkId, chunk);
        }
      }

      console.log(`DocumentStorage: Loaded ${documents.size} documents with ${chunks.size} chunks`);
      return { documents, chunks };
    } catch (error) {
      console.error('DocumentStorage: Failed to load all data:', error);
      return { documents: new Map(), chunks: new Map() };
    }
  }

  // Clear all stored data
  async clearAll(): Promise<void> {
    try {
      // Clear documents
      await AsyncStorage.removeItem(this.documentsKey);
      
      // Clear chunks and batches
      const metadataJson = await AsyncStorage.getItem(`${this.chunksKey}_metadata`);
      if (metadataJson) {
        const metadata = JSON.parse(metadataJson);
        for (let i = 0; i < metadata.batchCount; i++) {
          const batchKey = `${this.chunksKey}_batch_${i}`;
          await AsyncStorage.removeItem(batchKey);
        }
      }
      
      await AsyncStorage.removeItem(`${this.chunksKey}_metadata`);
      
      console.log('DocumentStorage: All data cleared');
    } catch (error) {
      console.error('DocumentStorage: Failed to clear data:', error);
      throw error;
    }
  }

  // Clear oldest data when storage is full
  private async clearOldestData(): Promise<void> {
    try {
      // For now, just clear everything and start fresh
      // In a production system, you'd implement LRU (Least Recently Used) eviction
      console.log('DocumentStorage: Clearing all data due to storage limits');
      await this.clearAll();
    } catch (error) {
      console.error('DocumentStorage: Failed to clear oldest data:', error);
      throw error;
    }
  }

  // Get current storage size
  private async getCurrentStorageSize(): Promise<number> {
    try {
      const stats = await this.getStorageStats();
      return stats.totalSize;
    } catch (error) {
      console.error('DocumentStorage: Failed to get current storage size:', error);
      return 0;
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<{ documentsSize: number; chunksSize: number; totalSize: number }> {
    try {
      const [documentsJson, metadataJson] = await Promise.all([
        AsyncStorage.getItem(this.documentsKey),
        AsyncStorage.getItem(`${this.chunksKey}_metadata`)
      ]);

      const documentsSize = documentsJson ? new Blob([documentsJson]).size : 0;
      let chunksSize = 0;

      if (metadataJson) {
        const metadata = JSON.parse(metadataJson);
        for (let i = 0; i < metadata.batchCount; i++) {
          const batchKey = `${this.chunksKey}_batch_${i}`;
          const batchJson = await AsyncStorage.getItem(batchKey);
          if (batchJson) {
            chunksSize += new Blob([batchJson]).size;
          }
        }
      }

      const totalSize = documentsSize + chunksSize;

      return { documentsSize, chunksSize, totalSize };
    } catch (error) {
      console.error('DocumentStorage: Failed to get storage stats:', error);
      return { documentsSize: 0, chunksSize: 0, totalSize: 0 };
    }
  }

  // Check if storage is available and has space
  async checkStorageAvailability(): Promise<{ available: boolean; reason?: string }> {
    try {
      const stats = await this.getStorageStats();
      
      if (stats.totalSize > this.maxStorageSize) {
        return { 
          available: false, 
          reason: `Storage limit exceeded: ${stats.totalSize} bytes > ${this.maxStorageSize} bytes` 
        };
      }

      return { available: true };
    } catch (error) {
      return { available: false, reason: `Storage check failed: ${error}` };
    }
  }
} 