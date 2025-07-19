import { SentenceTransformer } from './sentenceTransformer';
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
  private sentenceTransformer: SentenceTransformer | null = null;
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
      
      // Initialize sentence transformer
      await this.initializeSentenceTransformer();
      
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

  // Initialize sentence transformer
  private async initializeSentenceTransformer(): Promise<void> {
    try {
      console.log('Voy Vector Store: Initializing sentence transformer...');
      this.sentenceTransformer = new SentenceTransformer();
      await this.sentenceTransformer.initialize();
      console.log('Voy Vector Store: Sentence transformer initialized successfully');
    } catch (error) {
      console.error('Voy Vector Store: Failed to initialize sentence transformer:', error);
      this.sentenceTransformer = null;
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
      console.log(`📏 Query embedding dimension: ${queryEmbedding.length}`);
      
      const similarities: { chunk: DocumentChunk; similarity: number }[] = [];
      const incompatibleChunks: DocumentChunk[] = [];
      
      // Calculate similarities with all chunks
      for (const chunk of this.chunks.values()) {
        if (chunk.embedding && chunk.embedding.length > 0) {
          console.log(`🔍 Checking chunk ${chunk.id} with embedding dimension: ${chunk.embedding.length}`);
          
          if (chunk.embedding.length === queryEmbedding.length) {
            try {
              const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
              similarities.push({ chunk, similarity });
              console.log(`✅ Chunk ${chunk.id} similarity: ${similarity.toFixed(4)}`);
            } catch (error) {
              console.error(`❌ Error calculating similarity for chunk ${chunk.id}:`, error);
              incompatibleChunks.push(chunk);
            }
          } else {
            console.warn(`⚠️ Chunk ${chunk.id} has incompatible embedding dimension: ${chunk.embedding.length} vs query: ${queryEmbedding.length}`);
            incompatibleChunks.push(chunk);
          }
        } else {
          console.warn(`⚠️ Chunk ${chunk.id} has no embedding`);
        }
      }
      
      console.log(`📊 Search results: ${similarities.length} compatible chunks, ${incompatibleChunks.length} incompatible chunks`);
      
      if (similarities.length === 0) {
        console.warn('⚠️ No chunks with compatible embeddings found, returning empty results');
        return [];
      }
      
      // Sort by similarity and return top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      const topChunks = similarities.slice(0, topK).map(item => {
        item.chunk.metadata.similarityScore = item.similarity;
        return item.chunk;
      });
      
      console.log(`Voy Vector Store: Found ${topChunks.length} similar chunks`);
      
      // Log warning if there were incompatible chunks
      if (incompatibleChunks.length > 0) {
        console.warn(`⚠️ ${incompatibleChunks.length} chunks were skipped due to incompatible embedding dimensions. Consider regenerating embeddings for consistent dimensions.`);
      }
      
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
      
      console.log(`🔍 Voy Vector Store: Searching documents for "${query}" (limit: ${limit})`);
      
      // Check if we have any chunks
      if (this.chunks.size === 0) {
        console.log('⚠️ Voy Vector Store: No chunks available for search');
        return [];
      }
      
      // Check if we have embeddings
      const chunksWithEmbeddings = Array.from(this.chunks.values()).filter(chunk => 
        chunk.embedding && chunk.embedding.length > 0
      );
      
      console.log(`📊 Voy Vector Store: Found ${chunksWithEmbeddings.length} chunks with embeddings out of ${this.chunks.size} total chunks`);
      
      if (chunksWithEmbeddings.length > 0) {
        console.log('✅ Voy Vector Store: Using embedding-based search');
        
        // Generate query embedding
        const sentenceTransformer = this.getSentenceTransformer();
        if (sentenceTransformer) {
          console.log('🔍 Voy Vector Store: Generating query embedding...');
          const queryEmbedding = await sentenceTransformer.generateEmbedding(query);
          console.log(`📏 Query embedding dimension: ${queryEmbedding.length}`);
          
          // Check if we have any chunks with compatible dimensions
          const compatibleChunks = chunksWithEmbeddings.filter(chunk => 
            chunk.embedding.length === queryEmbedding.length
          );
          
          console.log(`📊 Voy Vector Store: Found ${compatibleChunks.length} chunks with compatible dimensions out of ${chunksWithEmbeddings.length} total chunks with embeddings`);
          
          if (compatibleChunks.length > 0) {
            // Search using embeddings
            const results = await this.searchSimilarChunks(queryEmbedding, limit);
            console.log(`✅ Voy Vector Store: Found ${results.length} results using embedding search`);
            return results;
          } else {
            console.warn('⚠️ Voy Vector Store: No chunks with compatible embedding dimensions found, falling back to text search');
          }
        } else {
          console.warn('⚠️ Voy Vector Store: No sentence transformer available for embedding search');
        }
      } else {
        console.log('⚠️ Voy Vector Store: No embeddings available, using text-based search');
      }
      
      // Text-based search as fallback
      console.log('🔍 Voy Vector Store: Using text-based search fallback');
      const queryLower = query.toLowerCase();
      const results: { chunk: DocumentChunk; score: number }[] = [];
      
      for (const chunk of this.chunks.values()) {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;
        
        // Simple text matching
        const queryWords = queryLower.split(/\s+/);
        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            score += 1;
          }
        }
        
        if (score > 0) {
          results.push({ chunk, score });
        }
      }
      
      // Sort by score and return top results
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, limit).map(item => {
        item.chunk.metadata.similarityScore = item.score / Math.max(...results.map(r => r.score));
        return item.chunk;
      });
      
      console.log(`✅ Voy Vector Store: Found ${topResults.length} results using text search`);
      return topResults;
      
    } catch (error) {
      console.error('❌ Voy Vector Store: Search failed:', error);
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
  getSentenceTransformer(): SentenceTransformer | null {
    return this.sentenceTransformer;
  }

  // Reinitialize sentence transformer (compatibility method)
  async reinitializeSentenceTransformer(): Promise<void> {
    console.log('Voy Vector Store: Reinitializing sentence transformer...');
    await this.initializeSentenceTransformer();
  }

  // Check embedding status and provide detailed information
  async checkEmbeddingStatus(): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    embeddingMethod: 'onnx' | 'hash' | 'none';
    sentenceTransformerStatus: any;
    embeddingDimension: number;
    modelName: string;
    isModelLoaded: boolean;
  }> {
    try {
      await this.ensureInitialized();
      
      const totalChunks = this.chunks.size;
      const chunksWithEmbeddings = Array.from(this.chunks.values()).filter(chunk => 
        chunk.embedding && chunk.embedding.length > 0
      ).length;
      
      const sentenceTransformer = this.getSentenceTransformer();
      let embeddingMethod: 'onnx' | 'hash' | 'none' = 'none';
      let sentenceTransformerStatus = null;
      let embeddingDimension = 0;
      let modelName = 'none';
      let isModelLoaded = false;
      
      if (sentenceTransformer) {
        try {
          sentenceTransformerStatus = sentenceTransformer.getCurrentModelStatus();
          embeddingDimension = sentenceTransformer.getDimension();
          modelName = sentenceTransformer.getModelName();
          isModelLoaded = sentenceTransformer.isModelReady();
          
          if (isModelLoaded) {
            embeddingMethod = 'onnx';
          } else {
            embeddingMethod = 'hash';
          }
        } catch (error) {
          console.error('Error getting sentence transformer status:', error);
          embeddingMethod = 'none';
        }
      }
      
      console.log('📊 Voy Vector Store: Embedding Status Report');
      console.log(`📄 Total chunks: ${totalChunks}`);
      console.log(`🔍 Chunks with embeddings: ${chunksWithEmbeddings}`);
      console.log(`📊 Embedding coverage: ${totalChunks > 0 ? ((chunksWithEmbeddings / totalChunks) * 100).toFixed(1) : 0}%`);
      console.log(`🤖 Embedding method: ${embeddingMethod}`);
      console.log(`📏 Embedding dimension: ${embeddingDimension}`);
      console.log(`🏷️ Model name: ${modelName}`);
      console.log(`✅ Model loaded: ${isModelLoaded}`);
      
      return {
        totalChunks,
        chunksWithEmbeddings,
        embeddingMethod,
        sentenceTransformerStatus,
        embeddingDimension,
        modelName,
        isModelLoaded
      };
      
    } catch (error) {
      console.error('❌ Voy Vector Store: Failed to check embedding status:', error);
      return {
        totalChunks: 0,
        chunksWithEmbeddings: 0,
        embeddingMethod: 'none',
        sentenceTransformerStatus: null,
        embeddingDimension: 0,
        modelName: 'none',
        isModelLoaded: false
      };
    }
  }

  // Verify embeddings stored in SQLite
  async verifyStoredEmbeddings(): Promise<any> {
    try {
      console.log('🔍 Voy Vector Store: Verifying stored embeddings...');
      
      const storageService = SQLiteStorageService.getInstance();
      const verificationResults = await storageService.verifyEmbeddings();
      
      // Also check current embedding status
      const currentStatus = await this.checkEmbeddingStatus();
      
      console.log('📊 Voy Vector Store: Combined Embedding Verification Report');
      console.log('=' .repeat(50));
      
      // Current status
      console.log('\n🔍 Current System Status:');
      console.log(`🤖 Model loaded: ${currentStatus.isModelLoaded}`);
      console.log(`🏷️ Model name: ${currentStatus.modelName}`);
      console.log(`📏 Expected dimension: ${currentStatus.embeddingDimension}`);
      console.log(`🔧 Current method: ${currentStatus.embeddingMethod}`);
      
      // Stored embeddings
      console.log('\n💾 Stored Embeddings Analysis:');
      console.log(`📄 Total chunks in DB: ${verificationResults.totalChunks}`);
      console.log(`🔍 Chunks with embeddings: ${verificationResults.chunksWithEmbeddings}`);
      console.log(`🤖 ONNX embeddings: ${verificationResults.embeddingQuality.onnxEmbeddings}`);
      console.log(`🔧 Hash embeddings: ${verificationResults.embeddingQuality.hashEmbeddings}`);
      console.log(`❌ Invalid embeddings: ${verificationResults.embeddingQuality.invalidEmbeddings}`);
      console.log(`📏 Average dimension: ${verificationResults.embeddingQuality.averageDimension.toFixed(2)}`);
      console.log(`📊 Dimension consistency: ${verificationResults.embeddingQuality.dimensionConsistency}`);
      
      // Calculate coverage
      const coverage = verificationResults.totalChunks > 0 
        ? (verificationResults.chunksWithEmbeddings / verificationResults.totalChunks) * 100 
        : 0;
      
      const onnxCoverage = verificationResults.chunksWithEmbeddings > 0
        ? (verificationResults.embeddingQuality.onnxEmbeddings / verificationResults.chunksWithEmbeddings) * 100
        : 0;
      
      console.log(`📊 Embedding coverage: ${coverage.toFixed(1)}%`);
      console.log(`🤖 ONNX coverage: ${onnxCoverage.toFixed(1)}%`);
      
      // Assessment
      console.log('\n📋 Assessment:');
      if (onnxCoverage > 80) {
        console.log('✅ EXCELLENT: Most embeddings are from ONNX model');
      } else if (onnxCoverage > 50) {
        console.log('⚠️ GOOD: Mixed ONNX and hash embeddings');
      } else if (onnxCoverage > 20) {
        console.log('⚠️ FAIR: Some ONNX embeddings, mostly hash');
      } else {
        console.log('❌ POOR: Mostly hash embeddings, ONNX model may not be working');
      }
      
      if (coverage < 50) {
        console.log('⚠️ WARNING: Low embedding coverage - many chunks missing embeddings');
      }
      
      if (!currentStatus.isModelLoaded) {
        console.log('⚠️ WARNING: ONNX model not loaded - using hash fallback');
      }
      
      return {
        currentStatus,
        storedEmbeddings: verificationResults,
        assessment: {
          coverage,
          onnxCoverage,
          quality: onnxCoverage > 80 ? 'excellent' : onnxCoverage > 50 ? 'good' : onnxCoverage > 20 ? 'fair' : 'poor'
        }
      };
      
    } catch (error) {
      console.error('❌ Voy Vector Store: Failed to verify stored embeddings:', error);
      return {
        currentStatus: null,
        storedEmbeddings: null,
        assessment: { coverage: 0, onnxCoverage: 0, quality: 'error' }
      };
    }
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
    console.log('📄 Voy Vector Store: Starting document chunking...');
    console.log(`📄 Document ID: ${documentId}`);
    console.log(`📄 Content length: ${content.length} characters`);
    
    const chunks: DocumentChunk[] = [];
    const sentences = this.splitIntoSentences(content);
    
    console.log(`🔤 Split into ${sentences.length} sentences`);
    
    let chunkIndex = 0;
    let currentChunk = '';
    let startPosition = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const newChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      // If adding this sentence would make the chunk too long, save current chunk
      if (newChunk.length > 1000 && currentChunk.length > 0) {
        console.log(`📄 Creating chunk ${chunkIndex} (${currentChunk.length} chars)`);
        
        const chunk: DocumentChunk = {
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          content: currentChunk,
          embedding: [], // Will be generated later
          metadata: {
            chunkIndex,
            startPosition,
            endPosition: startPosition + currentChunk.length,
            importance: this.calculateImportance(currentChunk)
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        chunks.push(chunk);
        
        // Start new chunk
        currentChunk = sentence;
        startPosition = startPosition + currentChunk.length + 1;
        chunkIndex++;
      } else {
        currentChunk = newChunk;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.length > 0) {
      console.log(`📄 Creating final chunk ${chunkIndex} (${currentChunk.length} chars)`);
      
      const chunk: DocumentChunk = {
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        content: currentChunk,
        embedding: [], // Will be generated later
        metadata: {
          chunkIndex,
          startPosition,
          endPosition: startPosition + currentChunk.length,
          importance: this.calculateImportance(currentChunk)
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      chunks.push(chunk);
    }
    
    console.log(`✅ Voy Vector Store: Created ${chunks.length} chunks`);
    
    // Generate embeddings for all chunks
    console.log('🔍 Voy Vector Store: Starting embedding generation for chunks...');
    this.generateChunkEmbeddings(chunks);
    
    return chunks;
  }

  // Generate embeddings for chunks using sentence transformer
  async generateChunkEmbeddings(chunks: DocumentChunk[]): Promise<void> {
    try {
      console.log(`🔍 Voy Vector Store: Generating embeddings for ${chunks.length} chunks...`);
      
      // Get sentence transformer instance
      const sentenceTransformer = this.getSentenceTransformer();
      if (!sentenceTransformer) {
        console.warn('⚠️ Voy Vector Store: No sentence transformer available, skipping embeddings');
        return;
      }
      
      console.log('🔍 Voy Vector Store: Using sentence transformer for embedding generation');
      
      // Generate embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🔍 Voy Vector Store: Generating embedding for chunk ${i + 1}/${chunks.length}`);
        console.log(`📄 Chunk content preview: "${chunk.content.substring(0, 100)}${chunk.content.length > 100 ? '...' : ''}"`);
        
        try {
          const embedding = await sentenceTransformer.generateEmbedding(chunk.content);
          chunk.embedding = embedding;
          console.log(`✅ Voy Vector Store: Successfully generated embedding for chunk ${i + 1}`);
          console.log(`📏 Embedding dimension: ${embedding.length}`);
        } catch (error) {
          console.error(`❌ Voy Vector Store: Failed to generate embedding for chunk ${i + 1}:`, error);
          // Continue with other chunks
        }
      }
      
      console.log(`✅ Voy Vector Store: Completed embedding generation for ${chunks.length} chunks`);
      
    } catch (error) {
      console.error('❌ Voy Vector Store: Failed to generate chunk embeddings:', error);
    }
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