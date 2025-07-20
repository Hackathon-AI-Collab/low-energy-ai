import { SentenceTransformer } from './sentenceTransformer';
import { BackgroundEmbeddingService } from './backgroundEmbeddingService';
import { ProgressiveEmbeddingService } from './progressiveEmbeddingService';
import { generateContentHash } from './preComputedEmbeddingService';
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
  private static instance: VoyVectorStore;
  private documents: Map<string, DocumentMetadata> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();
  private storageService: SQLiteStorageService;
  private sentenceTransformer: SentenceTransformer | null = null;
  private backgroundEmbedding: BackgroundEmbeddingService;
  private progressiveEmbedding: ProgressiveEmbeddingService;
  private isInitialized = false;

  private constructor() {
    this.storageService = SQLiteStorageService.getInstance();
    this.backgroundEmbedding = BackgroundEmbeddingService.getInstance();
    this.progressiveEmbedding = ProgressiveEmbeddingService.getInstance();
  }

  static getInstance(): VoyVectorStore {
    if (!VoyVectorStore.instance) {
      VoyVectorStore.instance = new VoyVectorStore();
    }
    return VoyVectorStore.instance;
  }

  // Initialize the vector store and load data from SQLite
  async initialize(): Promise<void> {
    try {
      console.log('Voy Vector Store: Initializing...');
      
      // Initialize SQLite storage and progressive embedding service
      await this.storageService.initialize();
      const hasProgressiveEmbeddings = await this.progressiveEmbedding.initialize();
      
      if (hasProgressiveEmbeddings) {
        console.log('📦 Progressive embeddings ready - memory-safe loading available');
      } else {
        console.log('🔄 No pre-computed embeddings - will generate dynamically');
      }
      
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
      
      console.log(`📄 Voy Vector Store: Adding document "${document.title}" with ${documentChunks.length} chunks`);
      
      // Add document
      this.documents.set(document.id, document);
      
      // Add chunks and count embeddings
      let chunksWithEmbeddings = 0;
      for (const chunk of documentChunks) {
        this.chunks.set(chunk.id, chunk);
        if (chunk.embedding && chunk.embedding.length > 0) {
          chunksWithEmbeddings++;
        }
      }
      
      // Update document's chunk count
      document.chunkCount = documentChunks.length;
      
      // Save to SQLite
      await this.storageService.saveAll(this.documents, this.chunks);
      
      console.log(`✅ Voy Vector Store: Successfully added document "${document.title}"`);
      console.log(`   📊 Chunks: ${documentChunks.length} total, ${chunksWithEmbeddings} with embeddings`);
      
      // Log document category for search debugging
      const category = this.determineDocumentCategory(document.title);
      console.log(`   🏷️  Category: ${category}`);
      
    } catch (error) {
      console.error('❌ Voy Vector Store: Failed to add document:', error);
      throw error;
    }
  }
  
  // Helper to determine document category for debugging
  private determineDocumentCategory(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('tccc') || titleLower.includes('tactical combat')) {
      return 'TCCC/Military Medical';
    } else if (titleLower.includes('who') || titleLower.includes('world health')) {
      return 'WHO/Medical';
    } else if (titleLower.includes('fema') || titleLower.includes('usr') || titleLower.includes('search')) {
      return 'FEMA/Search & Rescue';
    } else if (titleLower.includes('insarag') || titleLower.includes('coordination')) {
      return 'International/Coordination';
    } else {
      return 'Other';
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
      let chunks = this.chunkContent(content, documentId);
      document.chunkCount = chunks.length;
      
      // Try to use progressive pre-computed embeddings first
      const documentHash = generateContentHash(content);
      console.log(`🔍 Checking for progressive embeddings for "${title}"`);
      
      try {
        const progressiveEmbeddings = await this.progressiveEmbedding.getDocumentEmbeddings(documentId);
        
        if (progressiveEmbeddings) {
          console.log(`📦 Using progressive pre-computed embeddings for "${title}" (${progressiveEmbeddings.length} chunks)`);
          
          // Map progressive embeddings to existing chunks using proper ID matching
          console.log(`🔗 Mapping ${progressiveEmbeddings.length} progressive embeddings to ${chunks.length} chunks for "${title}"`);
          
          // Create a map of embedding chunkId -> embedding for efficient lookup
          const embeddingMap = new Map();
          for (const embedding of progressiveEmbeddings) {
            if (embedding.chunkId) {
              embeddingMap.set(embedding.chunkId, embedding.embedding);
            }
          }
          
          let mappedCount = 0;
          let unmappedChunks = [];
          
          // First pass: Try to match by chunk ID
          for (const chunk of chunks) {
            if (chunk.id && embeddingMap.has(chunk.id)) {
              chunk.embedding = embeddingMap.get(chunk.id);
              mappedCount++;
            } else {
              unmappedChunks.push(chunk);
            }
          }
          
          console.log(`✅ ID-based mapping: ${mappedCount}/${chunks.length} chunks mapped successfully`);
          
          // Second pass: For unmapped chunks, try index-based mapping as fallback
          if (unmappedChunks.length > 0) {
            console.log(`🔄 Attempting index-based fallback for ${unmappedChunks.length} unmapped chunks`);
            
            let fallbackMapped = 0;
            for (let i = 0; i < unmappedChunks.length && i < progressiveEmbeddings.length; i++) {
              if (!unmappedChunks[i].embedding) { // Only if not already mapped
                unmappedChunks[i].embedding = progressiveEmbeddings[i].embedding;
                fallbackMapped++;
              }
            }
            
            console.log(`📍 Fallback mapping: ${fallbackMapped} additional chunks mapped`);
            mappedCount += fallbackMapped;
          }
          
          console.log(`📊 Final mapping result: ${mappedCount}/${chunks.length} chunks have embeddings (${((mappedCount/chunks.length)*100).toFixed(1)}%)`);
          
          if (mappedCount < chunks.length * 0.8) {
            console.warn(`⚠️ Low embedding coverage for "${title}": only ${mappedCount}/${chunks.length} chunks have embeddings`);
          }
        } else {
          console.log(`🔄 No progressive embeddings found, generating fresh embeddings for "${title}"`);
          // Will generate embeddings dynamically in addDocumentWithChunks
        }
      } catch (error) {
        console.warn(`⚠️ Progressive embedding loading failed for "${title}":`, error);
        console.log(`🔄 Falling back to dynamic embedding generation`);
      }

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
      const documentChunkCounts = new Map<string, number>();
      const documentSimilarityStats = new Map<string, { total: number; sum: number; max: number }>();
      
      for (const chunk of this.chunks.values()) {
        const document = this.documents.get(chunk.documentId);
        const docTitle = document?.title || chunk.documentId;
        
        // Count chunks per document
        documentChunkCounts.set(docTitle, (documentChunkCounts.get(docTitle) || 0) + 1);
        
        if (chunk.embedding && chunk.embedding.length > 0) {
          if (chunk.embedding.length === queryEmbedding.length) {
            try {
              const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
              similarities.push({ chunk, similarity });
              
              // Track similarity stats per document
              const stats = documentSimilarityStats.get(docTitle) || { total: 0, sum: 0, max: 0 };
              stats.total++;
              stats.sum += similarity;
              stats.max = Math.max(stats.max, similarity);
              documentSimilarityStats.set(docTitle, stats);
              
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
      
      // Log document statistics to debug TCCC dominance
      console.log('\n📊 Document Analysis:');
      console.log('┌─────────────────────────────┬─────────┬──────────┬─────────┬─────────┐');
      console.log('│ Document                    │ Chunks  │ Max Sim  │ Avg Sim │ Status  │');
      console.log('├─────────────────────────────┼─────────┼──────────┼─────────┼─────────┤');
      
      for (const [docTitle, chunkCount] of documentChunkCounts.entries()) {
        const stats = documentSimilarityStats.get(docTitle);
        const maxSim = stats?.max.toFixed(4) || '0.0000';
        const avgSim = stats ? (stats.sum / stats.total).toFixed(4) : '0.0000';
        const status = stats ? (stats.total > 0 ? '✅ Embedded' : '❌ No Embed') : '❌ No Embed';
        
        console.log(`│ ${docTitle.padEnd(27)} │ ${chunkCount.toString().padStart(7)} │ ${maxSim.padStart(8)} │ ${avgSim.padStart(7)} │ ${status.padEnd(7)} │`);
      }
      console.log('└─────────────────────────────┴─────────┴──────────┴─────────┴─────────┘');
      
      // Highlight if TCCC is dominating
      const tcccStats = documentSimilarityStats.get('Tccc Handbook V5');
      if (tcccStats && tcccStats.max > 0.7) {
        console.log(`\n⚠️  TCCC DOMINANCE DETECTED:`);
        console.log(`   - TCCC max similarity: ${tcccStats.max.toFixed(4)}`);
        console.log(`   - TCCC average similarity: ${(tcccStats.sum / tcccStats.total).toFixed(4)}`);
        console.log(`   - This might explain why TCCC appears in all results`);
      }
      
      console.log(`📊 Search results: ${similarities.length} compatible chunks, ${incompatibleChunks.length} incompatible chunks`);
      
      if (similarities.length === 0) {
        console.warn('⚠️ No chunks with compatible embeddings found, returning empty results');
        return [];
      }
      
      // Sort by similarity and return top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      // Add document diversity - avoid returning all chunks from same document
      const diverseResults = this.ensureDocumentDiversity(similarities, topK);
      
      const topChunks = diverseResults.map(item => {
        item.chunk.metadata.similarityScore = item.similarity;
        return item.chunk;
      });
      
      console.log(`Voy Vector Store: Found ${topChunks.length} similar chunks with diversity`);
      
      // Log detailed results for debugging
      console.log('🔍 Top search results:');
      for (let i = 0; i < Math.min(topChunks.length, 5); i++) {
        const chunk = topChunks[i];
        const document = this.documents.get(chunk.documentId);
        const similarity = chunk.metadata.similarityScore?.toFixed(4) || 'N/A';
        console.log(`   ${i + 1}. Document: ${document?.title || chunk.documentId} | Similarity: ${similarity}`);
        console.log(`      Content: "${chunk.content.substring(0, 100)}..."`);
      }
      
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
      
      // If we don't have embeddings, try to generate them
      if (chunksWithEmbeddings.length === 0) {
        console.error('❌ Voy Vector Store: No embeddings found - attempting to generate ONNX embeddings...');
        const allChunks = Array.from(this.chunks.values());
        
        try {
          await this.generateChunkEmbeddings(allChunks);
          
          // Re-check embeddings after generation
          const updatedChunksWithEmbeddings = Array.from(this.chunks.values()).filter(chunk => 
            chunk.embedding && chunk.embedding.length > 0
          );
          console.log(`📊 Voy Vector Store: After ONNX generation, found ${updatedChunksWithEmbeddings.length} chunks with embeddings`);
          
          if (updatedChunksWithEmbeddings.length > 0) {
            console.log('✅ Voy Vector Store: Successfully generated ONNX embeddings, proceeding with search');
            chunksWithEmbeddings.length = 0; // Clear the array
            chunksWithEmbeddings.push(...updatedChunksWithEmbeddings); // Add the new embeddings
          } else {
            console.error('❌ Voy Vector Store: ONNX embedding generation failed completely - no search results possible');
            console.error('❌ Please check that the ONNX model is properly loaded and working');
            return [];
          }
        } catch (error) {
          console.error('❌ Voy Vector Store: ONNX embedding generation failed:', error);
          console.error('❌ Cannot perform search without proper embeddings');
          return [];
        }
      }
      
      // ONNX-ONLY SEARCH - NO HASH FALLBACK
      const sentenceTransformer = this.getSentenceTransformer();
      if (!sentenceTransformer) {
        console.error('❌ Voy Vector Store: No sentence transformer available, cannot perform search');
        return [];
      }
      
      if (!sentenceTransformer.isReady()) {
        console.error('❌ Voy Vector Store: Sentence transformer not ready (ONNX model not loaded)');
        return [];
      }
      
      if (chunksWithEmbeddings.length === 0) {
        console.error('❌ Voy Vector Store: No ONNX embeddings available, cannot perform search');
        return [];
      }
      
      console.log('✅ Voy Vector Store: Using ONNX embedding-based search ONLY (no hash fallback)');
      
      try {
        console.log('🔍 Voy Vector Store: Generating query embedding...');
        const queryEmbedding = await this.backgroundEmbedding.generateEmbedding(query, 100); // High priority for queries
        console.log(`📏 Query embedding dimension: ${queryEmbedding.length}`);
        
        // Check if we have any chunks with compatible dimensions
        const compatibleChunks = chunksWithEmbeddings.filter(chunk => 
          chunk.embedding.length === queryEmbedding.length
        );
        
        console.log(`📊 Voy Vector Store: Found ${compatibleChunks.length} chunks with compatible dimensions out of ${chunksWithEmbeddings.length} total chunks with embeddings`);
        
        if (compatibleChunks.length === 0) {
          console.error('❌ Voy Vector Store: No chunks with compatible embedding dimensions found');
          return [];
        }
        
        // Search using embeddings ONLY
        const results = await this.searchSimilarChunks(queryEmbedding, limit);
        console.log(`✅ Voy Vector Store: Found ${results.length} results using embedding search`);
        
        // Log the top results for debugging
        for (let i = 0; i < Math.min(results.length, 3); i++) {
          const result = results[i];
          const document = this.documents.get(result.documentId);
          console.log(`📄 Result ${i + 1}: ${document?.title || result.documentId} (similarity: ${result.metadata.similarityScore?.toFixed(4)})`);
        }
        
        return results;
        
      } catch (error) {
        console.error('❌ Voy Vector Store: Error in ONNX embedding search:', error);
        console.error('❌ Hash fallback is disabled - returning empty results');
        console.error('❌ Please ensure ONNX model is properly loaded and working');
        return [];
      }
      
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
      // Pure RAG - no importance-based sorting, return in document order
      return Array.from(this.documents.values());
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

  // Pure RAG approach - no hardcoded importance scoring
  // Let the embedding model and cosine similarity do the work
  private calculateImportance(content: string): number {
    return 1.0; // Neutral importance, let semantic search handle relevance
  }

  // Remove the helper methods - no longer needed for pure RAG
  // private calculateKeywordScore(content: string): number { ... }
  // private calculateStructuralScore(content: string): number { ... }
  // private calculateSemanticScore(content: string): number { ... }

  private chunkContent(content: string, documentId: string): DocumentChunk[] {
    console.log('📄 Voy Vector Store: Starting document chunking...');
    console.log(`📄 Document ID: ${documentId}`);
    console.log(`📄 Content length: ${content.length} characters`);
    
    const chunks: DocumentChunk[] = [];
    
    // Improved chunking strategy
    const semanticChunks = this.createSemanticChunks(content);
    
    console.log(`🔤 Created ${semanticChunks.length} semantic chunks`);
    
    for (let i = 0; i < semanticChunks.length; i++) {
      const chunkContent = semanticChunks[i];
      const startPosition = content.indexOf(chunkContent);
      
      console.log(`📄 Creating chunk ${i} (${chunkContent.length} chars)`);
      console.log(`📄 Chunk preview: "${chunkContent.substring(0, 100)}${chunkContent.length > 100 ? '...' : ''}"`);
      
      const chunk: DocumentChunk = {
        id: `${documentId}_chunk_${i}`,
        documentId,
        content: chunkContent,
        embedding: [], // Will be generated later
        metadata: {
          chunkIndex: i,
          startPosition,
          endPosition: startPosition + chunkContent.length,
          importance: this.calculateImportance(chunkContent)
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      chunks.push(chunk);
    }
    
    console.log(`✅ Voy Vector Store: Created ${chunks.length} semantic chunks`);
    
    // Generate embeddings for all chunks
    console.log('🔍 Voy Vector Store: Starting embedding generation for chunks...');
    this.generateChunkEmbeddings(chunks);
    
    return chunks;
  }

  // Create semantic chunks - simple approach: just break into coherent sections
  private createSemanticChunks(content: string): string[] {
    console.log('🔍 Creating semantic chunks...');
    console.log(`📄 Input content length: ${content.length}`);
    
    const chunks: string[] = [];
    const chunkSize = 800; // Target chunk size
    const overlap = 100;   // Overlap between chunks
    
    // Clean the content first
    const cleanedContent = content
      .replace(/---\s*## Page \d+/g, '') // Remove page markers
      .replace(/\n+/g, ' ') // Replace multiple newlines with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log(`📄 Cleaned content length: ${cleanedContent.length}`);
    
    // Split into sentences for better chunk boundaries
    const sentences = cleanedContent.split(/(?<=[.!?])\s+/);
    console.log(`📄 Split into ${sentences.length} sentences`);
    
    let currentChunk = '';
    let chunkCount = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      // If adding this sentence would exceed chunk size, save current chunk
      if (currentChunk.length > 0 && (currentChunk.length + trimmedSentence.length) > chunkSize) {
        chunks.push(currentChunk.trim());
        chunkCount++;
        console.log(`📄 Added chunk ${chunkCount} (${currentChunk.length} chars): "${currentChunk.substring(0, 100)}..."`);
        
        // Start new chunk with overlap from previous chunk
        const words = currentChunk.trim().split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 5)); // Roughly 100 chars of overlap
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
    }
    
    // Add the final chunk if it has content
    if (currentChunk.trim().length > 50) {
      chunks.push(currentChunk.trim());
      chunkCount++;
      console.log(`📄 Added final chunk ${chunkCount} (${currentChunk.length} chars): "${currentChunk.substring(0, 100)}..."`);
    }
    
    console.log(`📄 Successfully created ${chunks.length} chunks from document`);
    return chunks;
  }
  
  // Basic cleanup of chunk content
  private cleanChunkContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }
  
  // Fallback regular chunking method
  private createRegularChunks(content: string): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    let currentChunk = '';
    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (currentChunk.length + cleanSentence.length > 600) {
        if (currentChunk.length > 50) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = cleanSentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + cleanSentence;
      }
    }
    
    if (currentChunk.length > 50) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Split large chunks into smaller, more manageable pieces
  private splitLargeChunk(chunk: string): string[] {
    const subChunks: string[] = [];
    const sentences = this.splitIntoSentences(chunk);
    
    let currentSubChunk = '';
    
    for (const sentence of sentences) {
      const newSubChunk = currentSubChunk + (currentSubChunk ? ' ' : '') + sentence;
      
      if (newSubChunk.length > 600) {
        if (currentSubChunk.length > 0) {
          subChunks.push(currentSubChunk.trim());
          currentSubChunk = sentence;
        } else {
          // Single sentence is too long, split it
          const words = sentence.split(' ');
          const midPoint = Math.floor(words.length / 2);
          const firstHalf = words.slice(0, midPoint).join(' ');
          const secondHalf = words.slice(midPoint).join(' ');
          
          if (firstHalf.length > 0) subChunks.push(firstHalf);
          if (secondHalf.length > 0) subChunks.push(secondHalf);
        }
      } else {
        currentSubChunk = newSubChunk;
      }
    }
    
    if (currentSubChunk.length > 0) {
      subChunks.push(currentSubChunk.trim());
    }
    
    return subChunks;
  }

  // Improved sentence splitting that handles markdown and special cases
  private splitIntoSentences(text: string): string[] {
    // Clean up the text
    let cleanedText = text
      .replace(/\n+/g, ' ') // Replace multiple newlines with space
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    // Split on sentence endings, but be more careful
    const sentences = cleanedText
      .split(/(?<=[.!?])\s+(?=[A-Z])/) // Split on sentence endings followed by capital letter
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 10 && sentence.length < 1000); // Filter out very short or very long sentences
    
    return sentences;
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
          const embedding = await this.backgroundEmbedding.generateEmbedding(chunk.content, 50); // Medium priority for chunks
          chunk.embedding = embedding;
          console.log(`✅ Voy Vector Store: Successfully generated ONNX embedding for chunk ${i + 1}`);
          console.log(`📏 Embedding dimension: ${embedding.length}`);
          
          // Validate embedding quality (ONNX embeddings should have values in reasonable range)
          const avgValue = embedding.reduce((sum, val) => sum + Math.abs(val), 0) / embedding.length;
          console.log(`📊 Embedding quality check - Average absolute value: ${avgValue.toFixed(6)}`);
          
          if (avgValue < 0.01) {
            console.warn(`⚠️ Embedding seems too small (avg: ${avgValue.toFixed(6)}) - might be poor quality`);
          } else {
            console.log(`✅ Embedding quality looks good (avg: ${avgValue.toFixed(6)})`);
          }
          
        } catch (error) {
          console.error(`❌ Voy Vector Store: Failed to generate ONNX embedding for chunk ${i + 1}:`, error);
          console.error(`❌ This chunk will be excluded from search results`);
          // Leave embedding empty - chunk will be excluded from search
          chunk.embedding = [];
        }
      }
      
      console.log(`✅ Voy Vector Store: Completed embedding generation for ${chunks.length} chunks`);
      
    } catch (error) {
      console.error('❌ Voy Vector Store: Failed to generate chunk embeddings:', error);
    }
  }

  // Ensure document diversity in search results
  private ensureDocumentDiversity(
    similarities: { chunk: DocumentChunk; similarity: number }[],
    topK: number
  ): { chunk: DocumentChunk; similarity: number }[] {
    const diverseResults: { chunk: DocumentChunk; similarity: number }[] = [];
    const documentChunkCounts = new Map<string, number>();
    const maxChunksPerDocument = Math.max(1, Math.floor(topK / 3)); // At most 1/3 from same document
    
    console.log(`🔍 Applying diversity filter: max ${maxChunksPerDocument} chunks per document`);
    
    for (const item of similarities) {
      const documentId = item.chunk.documentId;
      const currentCount = documentChunkCounts.get(documentId) || 0;
      
      // Always include the first result, then apply diversity
      if (diverseResults.length === 0 || currentCount < maxChunksPerDocument) {
        diverseResults.push(item);
        documentChunkCounts.set(documentId, currentCount + 1);
        
        if (diverseResults.length >= topK) {
          break;
        }
      }
    }
    
    // If we don't have enough diverse results, fill remaining with best scores
    if (diverseResults.length < topK) {
      const remainingSlots = topK - diverseResults.length;
      const usedChunkIds = new Set(diverseResults.map(item => item.chunk.id));
      
      for (const item of similarities) {
        if (!usedChunkIds.has(item.chunk.id)) {
          diverseResults.push(item);
          if (diverseResults.length >= topK) {
            break;
          }
        }
      }
    }
    
    // Log diversity statistics
    const documentStats = new Map<string, number>();
    diverseResults.forEach(item => {
      const documentId = item.chunk.documentId;
      const document = this.documents.get(documentId);
      const title = document?.title || documentId;
      documentStats.set(title, (documentStats.get(title) || 0) + 1);
    });
    
    console.log('📊 Result diversity:');
    for (const [title, count] of documentStats.entries()) {
      console.log(`   - ${title}: ${count} chunk(s)`);
    }
    
    return diverseResults;
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

  // Get embedding generation progress
  getEmbeddingProgress() {
    return this.backgroundEmbedding.getProgress();
  }

  // Get background embedding queue status  
  getEmbeddingQueueStatus() {
    return this.backgroundEmbedding.getQueueStatus();
  }
} 