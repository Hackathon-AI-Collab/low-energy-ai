import { DocumentProcessor } from './documentProcessor';
import { LLMService } from './llmService';
import { VectorStore } from './vectorStore';

export class RAGPipeline {
  private llmService: LLMService;
  private vectorStore: VectorStore;
  private documentProcessor: DocumentProcessor;

  constructor() {
    this.llmService = new LLMService();
    this.vectorStore = new VectorStore();
    this.documentProcessor = new DocumentProcessor();
  }

  async initialize(modelPath?: string) {
    if (modelPath) {
      await this.llmService.initialize(modelPath);
    }
    console.log('RAG Pipeline initialized');
  }

  async processQuery(query: string): Promise<string> {
    try {
      console.log('Processing query:', query);
      
      // Generate query embedding
      const queryEmbedding = await this.documentProcessor.generateEmbedding(query);
      
      // Retrieve relevant context
      const relevantChunks = await this.vectorStore.searchSimilar(queryEmbedding, 3);
      
      // Build prompt with context
      let context = '';
      if (relevantChunks.length > 0) {
        context = relevantChunks.map(chunk => chunk.content).join('\n\n');
      }
      
      const prompt = context 
        ? `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:`
        : `Question: ${query}\n\nAnswer:`;
      
      console.log('Generated prompt:', prompt);
      
      // Generate response
      const response = await this.llmService.generateResponse(prompt);
      
      console.log('Generated response:', response);
      return response;
    } catch (error) {
      console.error('RAG pipeline error:', error);
      return 'Sorry, I encountered an error processing your query. Please try again.';
    }
  }

  async addDocument(filePath: string): Promise<void> {
    try {
      console.log('Adding document:', filePath);
      
      // Process the document
      const { document, chunks } = await this.documentProcessor.processDocument(filePath);
      
      // Add document to vector store
      await this.vectorStore.addDocument(document.id, document.title, document.type);
      
      // Add chunks to vector store
      for (const chunk of chunks) {
        await this.vectorStore.addChunk(chunk);
      }
      
      console.log(`Successfully added document: ${document.title} with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async getAllDocuments() {
    return await this.vectorStore.getAllDocuments();
  }

  async getDocumentChunks(documentId: string) {
    return await this.vectorStore.getChunksByDocument(documentId);
  }

  getStats() {
    return this.vectorStore.getStats();
  }

  isModelLoaded(): boolean {
    return this.llmService.isModelLoaded();
  }
}
