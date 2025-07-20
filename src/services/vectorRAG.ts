import { LLMService } from './llmService';
import { ModelSettingsService } from './modelSettings';
import { SQLiteVectorStorage, VectorSearchResult } from './sqliteVectorStorage';
import { SentenceTransformer } from './sentenceTransformer';

export interface VectorRAGResponse {
  text: string;
  confidence: number;
  modelUsed: 'enhanced' | 'simple' | 'fallback';
  processingTime: number;
  contextUsed: string[];
  documentsReferenced: string[];
  similarityScores: number[];
  chunkCount: number;
  embeddingModel: string;
  searchEngine: 'sqlite-vec';
}

/**
 * Vector RAG service using SQLite with sqlite-vec extension
 * Memory-efficient alternative to Voy-search
 */
export class VectorRAG {
  private static instance: VectorRAG | null = null;
  private llmService: LLMService;
  private vectorStorage: SQLiteVectorStorage;
  private embeddingService: SentenceTransformer;
  private settings: ModelSettingsService;
  private settingsCallback: (settings: any) => void;
  private isInitialized = false;

  constructor() {
    this.llmService = new LLMService();
    this.vectorStorage = new SQLiteVectorStorage();
    this.embeddingService = new SentenceTransformer();
    this.settings = ModelSettingsService.getInstance();
    
    // Set up settings change listener
    this.settingsCallback = this.handleSettingsChange.bind(this);
    this.settings.addSettingsChangeCallback(this.settingsCallback);

    console.log('🚀 VectorRAG: Service created with SQLite vector storage');
  }

  static getInstance(): VectorRAG {
    if (!VectorRAG.instance) {
      VectorRAG.instance = new VectorRAG();
    }
    return VectorRAG.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 VectorRAG: Initializing vector storage...');
      
      await this.vectorStorage.initialize();
      await this.embeddingService.initialize();
      
      this.isInitialized = true;
      console.log('✅ VectorRAG: Initialization complete');

      // Log storage stats
      const stats = await this.vectorStorage.getDocumentStats();
      console.log(`📊 VectorRAG: Ready with ${stats.documents} documents, ${stats.chunksWithEmbeddings}/${stats.chunks} chunks with embeddings`);

    } catch (error) {
      console.error('❌ VectorRAG: Initialization failed:', error);
      throw error;
    }
  }

  private handleSettingsChange(newSettings: any): void {
    console.log('⚙️ VectorRAG: Settings updated:', newSettings);
    // Handle any settings-dependent reinitialization if needed
  }

  async query(userQuery: string): Promise<VectorRAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 VectorRAG: Processing query: "${userQuery}"`);

      if (!this.isInitialized) {
        await this.initialize();
      }

      // Generate embedding for the user query
      console.log('🧠 VectorRAG: Generating query embedding...');
      const queryEmbedding = await this.embeddingService.generateEmbedding(userQuery);
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        throw new Error('Failed to generate query embedding');
      }

      console.log(`📏 VectorRAG: Query embedding generated (${queryEmbedding.length} dimensions)`);

      // Search for similar chunks using SQL vector search
      console.log('🔍 VectorRAG: Searching for relevant chunks...');
      const searchResults = await this.vectorStorage.searchSimilarChunks(
        queryEmbedding,
        10, // limit
        0.8 // similarity threshold
      );

      console.log(`📊 VectorRAG: Found ${searchResults.length} relevant chunks`);

      if (searchResults.length === 0) {
        return this.createEmptyResponse(startTime);
      }

      // Log search results for debugging
      searchResults.forEach((result, index) => {
        console.log(`📄 VectorRAG: Chunk ${index + 1} (distance: ${result.distance.toFixed(3)}): "${result.chunk.content.substring(0, 100)}..."`);
      });

      // Build context from search results
      const contextParts: string[] = [];
      const documentsReferenced: string[] = [];
      const similarityScores: number[] = [];

      for (const result of searchResults) {
        // Convert distance to similarity score (1 - distance for cosine)
        const similarityScore = 1 - result.distance;
        similarityScores.push(similarityScore);

        // Add document reference if not already included
        if (!documentsReferenced.includes(result.chunk.document_id)) {
          documentsReferenced.push(result.chunk.document_id);
        }

        // Clean and format context with document reference
        const cleanContent = this.cleanChunkContent(result.chunk.content);
        const contextPart = `Document: ${result.chunk.document_id}\nContent: ${cleanContent}`;
        contextParts.push(contextPart);
      }

      const context = contextParts.join('\n\n');
      console.log(`📝 VectorRAG: Built context (${context.length} chars) from ${documentsReferenced.length} documents`);

      // Generate response using LLM
      console.log('🤖 VectorRAG: Generating LLM response...');
      const llmResponse = await this.llmService.generateResponse(userQuery, context);

      const processingTime = Date.now() - startTime;
      console.log(`⚡ VectorRAG: Query completed in ${processingTime}ms`);

      return {
        text: llmResponse.text,
        confidence: this.calculateConfidence(similarityScores),
        modelUsed: llmResponse.modelUsed,
        processingTime,
        contextUsed: contextParts,
        documentsReferenced,
        similarityScores,
        chunkCount: searchResults.length,
        embeddingModel: 'all-MiniLM-L6-v2',
        searchEngine: 'sqlite-vec'
      };

    } catch (error) {
      console.error('❌ VectorRAG: Query failed:', error);
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: `I apologize, but I encountered an error while processing your query: ${error.message}. Please try again.`,
        confidence: 0,
        modelUsed: 'fallback',
        processingTime,
        contextUsed: [],
        documentsReferenced: [],
        similarityScores: [],
        chunkCount: 0,
        embeddingModel: 'all-MiniLM-L6-v2',
        searchEngine: 'sqlite-vec'
      };
    }
  }

  private createEmptyResponse(startTime: number): VectorRAGResponse {
    console.log('📭 VectorRAG: No relevant chunks found');
    
    return {
      text: "I couldn't find any relevant information in the knowledge base to answer your question. Please try rephrasing your question or asking about topics covered in the loaded documents.",
      confidence: 0,
      modelUsed: 'fallback',
      processingTime: Date.now() - startTime,
      contextUsed: [],
      documentsReferenced: [],
      similarityScores: [],
      chunkCount: 0,
      embeddingModel: 'all-MiniLM-L6-v2',
      searchEngine: 'sqlite-vec'
    };
  }

  private cleanChunkContent(content: string): string {
    return content
      // Remove excessive dots/periods (table of contents artifacts)
      .replace(/\.{4,}/g, '')
      // Remove lines with mostly dots and spaces
      .replace(/^[.\s]+$/gm, '')
      // Replace multiple spaces with single space
      .replace(/[ \t]+/g, ' ')
      // Replace multiple newlines with max 2 newlines
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      // Remove trailing whitespace from lines
      .replace(/[ \t]+$/gm, '')
      // Remove leading whitespace from lines
      .replace(/^[ \t]+/gm, '')
      // Limit to reasonable length for context
      .substring(0, 500)
      .trim();
  }

  private calculateConfidence(similarityScores: number[]): number {
    if (similarityScores.length === 0) {
      return 0;
    }

    // Calculate confidence based on similarity scores
    const avgSimilarity = similarityScores.reduce((sum, score) => sum + score, 0) / similarityScores.length;
    const maxSimilarity = Math.max(...similarityScores);
    
    // Weight both average and maximum similarity
    const confidence = (avgSimilarity * 0.6 + maxSimilarity * 0.4);
    
    return Math.min(confidence, 1.0);
  }

  async getStats(): Promise<{ documents: number; chunks: number; chunksWithEmbeddings: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.vectorStorage.getDocumentStats();
  }

  async clearAllData(): Promise<void> {
    console.log('🗑️ VectorRAG: Clearing all vector data...');
    
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.vectorStorage.clearAllData();
    console.log('✅ VectorRAG: All data cleared');
  }

  destroy(): void {
    if (this.settingsCallback) {
      this.settings.removeSettingsChangeCallback(this.settingsCallback);
    }
    
    this.vectorStorage.close();
    console.log('🔚 VectorRAG: Service destroyed');
  }
}