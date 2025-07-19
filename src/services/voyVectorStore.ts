import { SQLiteStorageService } from './sqliteStorage';

export interface DocumentChunk {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  type: string;
  version: number;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
  chunkCount: number;
  importance: number;
  chunks: Map<string, DocumentChunk>;
}

export class VoyVectorStore {
  private documents: Map<string, DocumentMetadata> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();
  private storageService: SQLiteStorageService;
  private isInitialized = false;

  constructor() {
    this.storageService = SQLiteStorageService.getInstance();
  }

  // Initialize the vector store and load data from SQLite
  async initialize(): Promise<void> {
    try {
      console.log('Voy Vector Store: Initializing...');
      
      // Initialize SQLite storage
      await this.storageService.initialize();
      
      // Load existing data
      const { documents, chunks } = await this.storageService.loadAll();
      this.documents = documents;
      this.chunks = chunks;
      
      this.isInitialized = true;
      console.log(`Voy Vector Store: Initialized with ${this.documents.size} documents and ${this.chunks.size} chunks`);
    } catch (error) {
      console.error('Voy Vector Store: Failed to initialize:', error);
      // Continue with empty maps if storage fails
      this.documents = new Map();
      this.chunks = new Map();
      this.isInitialized = false;
      throw error;
    }
  }

  // Ensure the store is initialized
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      console.log('Voy Vector Store: Not initialized, initializing now...');
      await this.initialize();
    }
  }

  // Add a document to the vector store (new interface)
  async addDocumentWithChunks(document: DocumentMetadata, documentChunks: DocumentChunk[]): Promise<void> {
    try {
      await this.ensureInitialized();
      
      console.log(`Voy Vector Store: Adding document "${document.title}" with ${documentChunks.length} chunks`);
      
      // Add document
      this.documents.set(document.id, document);
      
      // Add chunks
      for (const chunk of documentChunks) {
        this.chunks.set(chunk.id, chunk);
      }
      
      // Update document's chunk count
      document.chunkCount = documentChunks.length;
      
      // Save to SQLite
      await this.storageService.saveAll(this.documents, this.chunks);
      
      console.log(`Voy Vector Store: Successfully added document "${document.title}"`);
    } catch (error) {
      console.error('Voy Vector Store: Failed to add document:', error);
      throw error;
    }
  }

  // Add document (compatibility method for old interface)
  async addDocument(documentId: string, title: string, content: string, type: string = 'markdown'): Promise<void> {
    try {
      await this.ensureInitialized();
      
      // Generate document metadata
      const document: DocumentMetadata = {
        id: documentId,
        title,
        type,
        version: 1,
        hash: await this.generateHash(content),
        createdAt: new Date(),
        updatedAt: new Date(),
        chunkCount: 0,
        importance: this.calculateImportance(content),
        chunks: new Map()
      };

      // Create chunks (simplified for compatibility)
      const chunks = this.chunkContent(content, documentId);
      document.chunkCount = chunks.length;

      // Add document and chunks
      await this.addDocumentWithChunks(document, chunks);
      
      console.log(`Voy Vector Store: Added document "${title}" with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Voy Vector Store: Failed to add document:', error);
      throw error;
    }
  }

  // Search for similar chunks
  async searchSimilarChunks(queryEmbedding: number[], topK: number = 5): Promise<DocumentChunk[]> {
    try {
      await this.ensureInitialized();
      
      console.log(`Voy Vector Store: Searching for ${topK} similar chunks`);
      
      const similarities: { chunk: DocumentChunk; similarity: number }[] = [];
      
      // Calculate similarities with all chunks
      for (const chunk of this.chunks.values()) {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
        similarities.push({ chunk, similarity });
      }
      
      // Sort by similarity and return top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      const topChunks = similarities.slice(0, topK).map(item => {
        item.chunk.metadata.similarityScore = item.similarity;
        return item.chunk;
      });
      
      console.log(`Voy Vector Store: Found ${topChunks.length} similar chunks`);
      return topChunks;
    } catch (error) {
      console.error('Voy Vector Store: Failed to search chunks:', error);
      return [];
    }
  }

  // Search documents (compatibility method)
  async searchDocuments(query: string, limit: number = 5): Promise<DocumentChunk[]> {
    try {
      await this.ensureInitialized();
      
      console.log(`Voy Vector Store: Searching documents for "${query}" (limit: ${limit})`);
      
      // Check if we have any chunks
      if (this.chunks.size === 0) {
        console.log('Voy Vector Store: No chunks available for search');
        return [];
      }
      
      // Check if we have embeddings
      const hasEmbeddings = Array.from(this.chunks.values()).some(chunk => 
        chunk.embedding && chunk.embedding.length > 0
      );
      
      if (hasEmbeddings) {
        console.log('Voy Vector Store: Using embedding-based search');
        // TODO: Implement embedding-based search when embeddings are available
        // For now, fall back to text search
      } else {
        console.log('Voy Vector Store: Using text-based search (embeddings not available)');
      }
      
      // Text-based search as fallback
      const queryLower = query.toLowerCase();
      const results: { chunk: DocumentChunk; score: number }[] = [];
      
      for (const chunk of this.chunks.values()) {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;
        
        // Exact phrase match
        if (contentLower.includes(queryLower)) {
          score += 10;
        }
        
        // Word matches
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            score += 2;
          }
        }
        
        // Medical keyword bonus
        const medicalKeywords = ['tccc', 'march', 'tourniquet', 'hemorrhage', 'airway', 'rescue', 'emergency', 'medical'];
        for (const keyword of medicalKeywords) {
          if (contentLower.includes(keyword) && queryLower.includes(keyword)) {
            score += 5;
          }
        }
        
        if (score > 0) {
          chunk.metadata.similarityScore = score / 20; // Normalize to 0-1
          results.push({ chunk, score });
        }
      }
      
      // Sort by score and return top results
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, limit).map(item => item.chunk);
      
      console.log(`Voy Vector Store: Found ${topResults.length} relevant chunks`);
      return topResults;
      
    } catch (error) {
      console.error('Voy Vector Store: Failed to search documents:', error);
      return [];
    }
  }

  // Get all documents
  getDocuments(): DocumentMetadata[] {
    return Array.from(this.documents.values());
  }

  // Get all documents (compatibility method)
  async getAllDocuments(): Promise<DocumentMetadata[]> {
    try {
      await this.ensureInitialized();
      return Array.from(this.documents.values()).sort((a, b) => b.importance - a.importance);
    } catch (error) {
      console.error('Voy Vector Store: Failed to get all documents:', error);
      return [];
    }
  }

  // Get document by ID
  getDocument(id: string): DocumentMetadata | undefined {
    return this.documents.get(id);
  }

  // Get document metadata (compatibility method)
  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata | null> {
    try {
      await this.ensureInitialized();
      return this.documents.get(documentId) || null;
    } catch (error) {
      console.error('Voy Vector Store: Failed to get document metadata:', error);
      return null;
    }
  }

  // Get chunks for a document
  getDocumentChunks(documentId: string): DocumentChunk[] {
    return Array.from(this.chunks.values()).filter(chunk => chunk.documentId === documentId);
  }

  // Delete a document and its chunks
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      console.log(`Voy Vector Store: Deleting document ${documentId}`);
      
      const document = this.documents.get(documentId);
      if (!document) {
        console.log(`Voy Vector Store: Document ${documentId} not found`);
        return false;
      }
      
      // Remove document
      this.documents.delete(documentId);
      
      // Remove all chunks for this document
      const chunksToDelete = Array.from(this.chunks.keys()).filter(chunkId => {
        const chunk = this.chunks.get(chunkId);
        return chunk && chunk.documentId === documentId;
      });
      
      for (const chunkId of chunksToDelete) {
        this.chunks.delete(chunkId);
      }
      
      // Save to SQLite
      await this.storageService.saveAll(this.documents, this.chunks);
      
      console.log(`Voy Vector Store: Successfully deleted document ${documentId} and ${chunksToDelete.length} chunks`);
      return true;
    } catch (error) {
      console.error('Voy Vector Store: Failed to delete document:', error);
      return false;
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      console.log('Voy Vector Store: Clearing all data');
      
      this.documents.clear();
      this.chunks.clear();
      
      await this.storageService.clearAll();
      
      console.log('Voy Vector Store: All data cleared');
    } catch (error) {
      console.error('Voy Vector Store: Failed to clear data:', error);
      throw error;
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<{ documentsCount: number; chunksCount: number; totalSize: number }> {
    try {
      await this.ensureInitialized();
      return await this.storageService.getStorageStats();
    } catch (error) {
      console.error('Voy Vector Store: Failed to get storage stats:', error);
      return { documentsCount: 0, chunksCount: 0, totalSize: 0 };
    }
  }

  // Get stats (compatibility method)
  async getStats(): Promise<{ documents: number; chunks: number; totalSize: number; indexSize: number }> {
    try {
      await this.ensureInitialized();
      const stats = await this.storageService.getStorageStats();
      
      return {
        documents: stats.documentsCount,
        chunks: stats.chunksCount,
        totalSize: stats.totalSize,
        indexSize: stats.totalSize // For compatibility, using totalSize as indexSize
      };
    } catch (error) {
      console.error('Voy Vector Store: Failed to get stats:', error);
      return {
        documents: 0,
        chunks: 0,
        totalSize: 0,
        indexSize: 0
      };
    }
  }

  // Check storage availability
  async checkStorageAvailability(): Promise<{ available: boolean; reason?: string }> {
    try {
      await this.ensureInitialized();
      return await this.storageService.checkStorageAvailability();
    } catch (error) {
      return { available: false, reason: `Storage check failed: ${error}` };
    }
  }

  // Get sentence transformer (compatibility method)
  getSentenceTransformer(): any {
    // Return a mock object for compatibility
    return {
      getStats: () => ({
        modelName: 'all-MiniLM-L6-v2',
        modelLoaded: true,
        modelType: 'local'
      }),
      getCurrentModelStatus: () => ({
        isModelLoaded: true,
        modelName: 'all-MiniLM-L6-v2',
        modelType: 'local'
      })
    };
  }

  // Reinitialize sentence transformer (compatibility method)
  async reinitializeSentenceTransformer(): Promise<void> {
    console.log('Voy Vector Store: Reinitializing sentence transformer (compatibility method)');
    // This is a no-op for now since we're using a different approach
  }



  // Helper methods for document processing
  private async generateHash(content: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private calculateImportance(content: string): number {
    const medicalKeywords = ['tccc', 'march', 'tourniquet', 'hemorrhage', 'airway', 'rescue', 'emergency'];
    const lowerContent = content.toLowerCase();
    
    let score = Math.min(content.length / 1000, 5);
    
    for (const keyword of medicalKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 2;
      }
    }
    
    return Math.min(score, 10);
  }

  private chunkContent(content: string, documentId: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const chunkSize = 500;
    
    const sentences = this.splitIntoSentences(content);
    let currentChunk = '';
    let chunkIndex = 0;
    let startPosition = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      if (potentialChunk.length > chunkSize && currentChunk) {
        // Create chunk
        const chunk: DocumentChunk = {
          id: `${documentId}-chunk-${chunkIndex}`,
          documentId,
          content: currentChunk.trim(),
          embedding: [], // Will be generated later
          metadata: {
            chunkIndex,
            startPosition,
            endPosition: startPosition + currentChunk.length,
            importance: 1.0
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        chunks.push(chunk);

        // Start new chunk
        currentChunk = sentence;
        startPosition = startPosition + currentChunk.length;
        chunkIndex++;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      const chunk: DocumentChunk = {
        id: `${documentId}-chunk-${chunkIndex}`,
        documentId,
        content: currentChunk.trim(),
        embedding: [], // Will be generated later
        metadata: {
          chunkIndex,
          startPosition,
          endPosition: startPosition + currentChunk.length,
          importance: 1.0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      chunks.push(chunk);
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .replace(/\n+/g, ' ')
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 10);
  }

  // Calculate cosine similarity between two vectors
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
} 