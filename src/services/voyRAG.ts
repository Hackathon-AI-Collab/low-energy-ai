import { LLMService } from './llmService';
import { ModelSettingsService } from './modelSettings';
import { DocumentChunk, VoyVectorStore } from './voyVectorStore';

export interface VoyRAGResponse {
  text: string;
  confidence: number;
  modelUsed: 'enhanced' | 'simple' | 'fallback';
  processingTime: number;
  contextUsed: string[];
  documentsReferenced: string[];
  similarityScores: number[];
  chunkCount: number;
  embeddingModel: string;
  searchEngine: 'voy' | 'local';
}

export class VoyRAG {
  private llmService: LLMService;
  private voyVectorStore: VoyVectorStore;
  private settings: ModelSettingsService;
  private settingsCallback: (settings: any) => void;

  constructor() {
    this.llmService = new LLMService();
    this.voyVectorStore = new VoyVectorStore();
    this.settings = ModelSettingsService.getInstance();
    
    // Set up settings change listener
    this.settingsCallback = this.handleSettingsChange.bind(this);
    this.settings.addSettingsChangeCallback(this.settingsCallback);
  }

  private handleSettingsChange(settings: any): void {
    console.log('Voy RAG: Settings changed, checking for LLM updates...');
    console.log('Voy RAG: Full settings received:', JSON.stringify(settings, null, 2));
    
    const newLLMModelPath = settings.llmModelPath;
    const newLLMModelType = settings.llmModelType;
    
    console.log('Voy RAG: New LLM model path:', newLLMModelPath, 'Type:', newLLMModelType);
    
    // If LLM settings changed, reinitialize LLM service
    if (newLLMModelPath || newLLMModelType === 'gguf') {
      console.log('Voy RAG: LLM settings changed, reinitializing LLM service...');
      this.reinitializeLLMService().catch(error => {
        console.error('Voy RAG: Failed to reinitialize LLM service after settings change:', error);
      });
    }
  }

  async initialize(modelPath?: string) {
    try {
      console.log('Initializing Voy RAG Pipeline...');
      
      // Initialize both systems
      await Promise.all([
        this.llmService.initialize(),
        this.voyVectorStore.initialize()
      ]);
      
      console.log('Voy RAG Pipeline initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Voy RAG:', error);
      throw error;
    }
  }

  async processQuery(query: string): Promise<VoyRAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log('Processing query with Voy RAG:', query);
      
      // Use Voy VectorStore to find relevant chunks
      const relevantChunks = await this.voyVectorStore.searchDocuments(query, 3);
      
      // Debug: Check LLM service status
      console.log('Voy RAG: Checking LLM service status...');
      console.log('Voy RAG: LLM service ready:', this.llmService.isModelReady());
      console.log('Voy RAG: LLM service info:', this.llmService.getModelInfo());
      
      // If no relevant chunks found, try using LLM directly
      if (relevantChunks.length === 0) {
        console.log('Voy RAG: No relevant chunks found, trying LLM service directly');
        
        if (this.llmService.isModelReady()) {
          try {
            console.log('Voy RAG: Using LLM service for direct response');
            const llmResponse = await this.llmService.generateResponse(query);
            
            return {
              text: llmResponse.text,
              confidence: llmResponse.confidence,
              modelUsed: 'enhanced',
              processingTime: Date.now() - startTime,
              contextUsed: [],
              documentsReferenced: [],
              similarityScores: [],
              chunkCount: 0,
              embeddingModel: this.getEmbeddingModelInfo(),
              searchEngine: 'local'
            };
          } catch (error) {
            console.warn('LLM service failed for direct response:', error);
          }
        }
        
        // If LLM also fails, return fallback
        return {
          text: `I don't have specific information about "${query}". However, I can help you with medical guidelines (TCCC), search and rescue procedures, and technical information. Please try asking about these topics.`,
          confidence: 0.3,
          modelUsed: 'fallback',
          processingTime: Date.now() - startTime,
          contextUsed: [],
          documentsReferenced: [],
          similarityScores: [],
          chunkCount: 0,
          embeddingModel: 'none',
          searchEngine: 'local'
        };
      }
      
      // Prepare context from relevant chunks
      const context = this.prepareContextFromChunks(relevantChunks);
      const documentTitles = await this.getDocumentTitles(relevantChunks);
      const similarityScores = relevantChunks.map(chunk => 
        chunk.metadata.similarityScore || 0
      );
      
      // Determine search engine used
      const searchEngine = this.determineSearchEngine(relevantChunks);
      
      // Try LLM service first
      if (this.llmService.isModelReady()) {
        try {
          console.log('Voy RAG: Using LLM service for response generation');
          const llmResponse = await this.llmService.generateResponse(query, context);
          
          return {
            text: llmResponse.text,
            confidence: llmResponse.confidence,
            modelUsed: 'enhanced',
            processingTime: Date.now() - startTime,
            contextUsed: [context.substring(0, 200) + '...'],
            documentsReferenced: documentTitles,
            similarityScores,
            chunkCount: relevantChunks.length,
            embeddingModel: this.getEmbeddingModelInfo(),
            searchEngine
          };
        } catch (error) {
          console.warn('Enhanced LLM failed, falling back to Voy search:', error);
        }
      } else {
        console.log('Voy RAG: LLM service not ready, using fallback response generation');
      }
      
      // Fallback to Voy-based response generation
      const response = this.generateResponseFromChunks(query, relevantChunks);
      
      return {
        text: response,
        confidence: Math.max(...similarityScores) * 0.9, // Scale confidence by similarity
        modelUsed: 'simple',
        processingTime: Date.now() - startTime,
        contextUsed: [context.substring(0, 200) + '...'],
        documentsReferenced: documentTitles,
        similarityScores,
        chunkCount: relevantChunks.length,
        embeddingModel: this.getEmbeddingModelInfo(),
        searchEngine
      };
      
    } catch (error) {
      console.error('Voy RAG error:', error);
      
      return {
        text: 'Sorry, I encountered an error processing your query. Please try again.',
        confidence: 0.0,
        modelUsed: 'fallback',
        processingTime: Date.now() - startTime,
        contextUsed: [],
        documentsReferenced: [],
        similarityScores: [],
        chunkCount: 0,
        embeddingModel: 'none',
        searchEngine: 'local'
      };
    }
  }

  private prepareContextFromChunks(chunks: DocumentChunk[]): string {
    return chunks.map(chunk => 
      `Document: ${this.getDocumentTitle(chunk.documentId)}\nContent: ${chunk.content}`
    ).join('\n\n');
  }

  private async getDocumentTitles(chunks: DocumentChunk[]): Promise<string[]> {
    const titles = new Set<string>();
    for (const chunk of chunks) {
      const title = await this.getDocumentTitle(chunk.documentId);
      titles.add(title);
    }
    return Array.from(titles);
  }

  private async getDocumentTitle(documentId: string): Promise<string> {
    try {
      const documents = await this.voyVectorStore.getAllDocuments();
      const doc = documents.find(d => d.id === documentId);
      return doc ? doc.title : 'Unknown Document';
    } catch (error) {
      console.error('Error getting document title:', error);
      return 'Unknown Document';
    }
  }

  private determineSearchEngine(chunks: DocumentChunk[]): 'voy' | 'local' {
    // If chunks have similarity scores, they likely came from Voy
    const hasSimilarityScores = chunks.some(chunk => chunk.metadata.similarityScore !== undefined);
    return hasSimilarityScores ? 'voy' : 'local';
  }

  private generateResponseFromChunks(query: string, chunks: DocumentChunk[]): string {
    const lowerQuery = query.toLowerCase();
    
    // Special handling for medical/TCCC queries
    if (lowerQuery.includes('medical') || lowerQuery.includes('tccc') || lowerQuery.includes('march')) {
      const tcccChunks = chunks.filter(chunk => 
        chunk.documentId === 'tccc-guidelines'
      );
      if (tcccChunks.length > 0) {
        return this.generateMedicalResponse(tcccChunks, query);
      }
    }
    
    // Special handling for search/rescue queries
    if (lowerQuery.includes('search') || lowerQuery.includes('rescue') || lowerQuery.includes('sar')) {
      const rescueChunks = chunks.filter(chunk => 
        chunk.documentId === 'search-rescue'
      );
      if (rescueChunks.length > 0) {
        return this.generateRescueResponse(rescueChunks, query);
      }
    }
    
    // Special handling for equipment queries
    if (lowerQuery.includes('equipment') || lowerQuery.includes('tourniquet') || lowerQuery.includes('airway')) {
      const equipmentChunks = chunks.filter(chunk => 
        chunk.documentId === 'medical-equipment'
      );
      if (equipmentChunks.length > 0) {
        return this.generateEquipmentResponse(equipmentChunks, query);
      }
    }
    
    // Generic response
    return this.generateGenericResponse(chunks, query);
  }

  private generateMedicalResponse(chunks: DocumentChunk[], query: string): string {
    const content = chunks.map(chunk => chunk.content).join(' ');
    
    if (query.toLowerCase().includes('march')) {
      return `Based on TCCC guidelines, the MARCH algorithm is the primary assessment framework:

M - Massive Hemorrhage: Control bleeding using tourniquets for extremity bleeding
A - Airway: Ensure airway patency and protection
R - Respiration: Address breathing issues and chest injuries
C - Circulation: Assess and treat shock
H - Hypothermia/Head injury: Prevent hypothermia and assess neurological status

${content.substring(0, 300)}...`;
    }
    
    return `Based on TCCC guidelines: ${content.substring(0, 400)}...`;
  }

  private generateRescueResponse(chunks: DocumentChunk[], query: string): string {
    const content = chunks.map(chunk => chunk.content).join(' ');
    
    return `Based on search and rescue procedures: ${content.substring(0, 400)}...

Key priorities include scene safety, victim assessment, and systematic search patterns.`;
  }

  private generateEquipmentResponse(chunks: DocumentChunk[], query: string): string {
    const content = chunks.map(chunk => chunk.content).join(' ');
    
    return `Based on medical equipment guidelines: ${content.substring(0, 400)}...

Always ensure proper training and maintenance for all medical equipment.`;
  }

  private generateGenericResponse(chunks: DocumentChunk[], query: string): string {
    const content = chunks.map(chunk => chunk.content).join(' ');
    
    return `Based on the available information: ${content.substring(0, 400)}...

For more specific guidance, please ask about medical procedures, search and rescue, or equipment usage.`;
  }

  async addDocument(documentId: string, title: string, content: string): Promise<void> {
    try {
      await this.voyVectorStore.addDocument(documentId, title, content);
      console.log(`Added document: ${title}`);
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async getStats() {
    const vectorStoreStats = await this.voyVectorStore.getStats();
    const sentenceTransformerStats = this.voyVectorStore.getSentenceTransformer().getStats();
    
    return {
      documents: vectorStoreStats.documents,
      chunks: vectorStoreStats.chunks,
      totalSize: vectorStoreStats.totalSize,
      indexSize: vectorStoreStats.indexSize,
      llmServiceReady: this.llmService.isModelReady(),
      voyVectorStoreReady: true,
      embeddingModel: sentenceTransformerStats.modelName,
      embeddingModelLoaded: sentenceTransformerStats.modelLoaded
    };
  }

  async getModelInfo() {
    return {
      llmService: this.llmService.getModelInfo(),
      voyVectorStore: {
        isLoaded: true,
        modelType: 'Voy Search + Sentence Transformer',
        capabilities: ['semantic-search', 'vector-similarity', 'document-retrieval']
      },
      sentenceTransformer: this.voyVectorStore.getSentenceTransformer().getStats()
    };
  }

  private getEmbeddingModelInfo(): string {
    const stats = this.voyVectorStore.getSentenceTransformer().getStats();
    const currentStatus = this.voyVectorStore.getSentenceTransformer().getCurrentModelStatus();
    
    if (currentStatus.isModelLoaded) {
      return `${currentStatus.modelName} (ONNX)`;
    } else if (currentStatus.modelType === 'local') {
      return `${currentStatus.modelName} (Local - Not Loaded)`;
    } else {
      return `${currentStatus.modelName} (${currentStatus.modelType})`;
    }
  }

  // Method to reinitialize sentence transformer after model download
  async reinitializeSentenceTransformer(): Promise<void> {
    try {
      console.log('Reinitializing sentence transformer in Voy RAG...');
      await this.voyVectorStore.reinitializeSentenceTransformer();
      console.log('Sentence transformer reinitialized successfully');
    } catch (error) {
      console.error('Failed to reinitialize sentence transformer:', error);
    }
  }

  // Method to reinitialize both sentence transformer and LLM service after model download
  async reinitializeAfterModelDownload(): Promise<void> {
    try {
      console.log('Reinitializing Voy RAG after model download...');
      
      // Reinitialize sentence transformer
      await this.voyVectorStore.reinitializeSentenceTransformer();
      console.log('Sentence transformer reinitialized successfully');
      
      // Reinitialize LLM service
      await this.llmService.reinitialize();
      console.log('LLM service reinitialized successfully');
      
      console.log('Voy RAG reinitialization completed');
    } catch (error) {
      console.error('Failed to reinitialize Voy RAG:', error);
    }
  }

  // Method to reinitialize LLM service specifically
  async reinitializeLLMService(): Promise<void> {
    try {
      console.log('Reinitializing LLM service in Voy RAG...');
      await this.llmService.reinitialize();
      console.log('LLM service reinitialized successfully');
    } catch (error) {
      console.error('Failed to reinitialize LLM service:', error);
    }
  }

  // Cleanup method to remove settings callback
  destroy(): void {
    this.settings.removeSettingsChangeCallback(this.settingsCallback);
    this.llmService.destroy();
  }


} 