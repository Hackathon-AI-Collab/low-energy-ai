import { EnhancedLLM } from './enhancedLLM';
import { SampleDocumentService } from './sampleDocuments';
import { DocumentChunk, VectorStore } from './vectorStore';

export interface AdvancedRAGResponse {
  text: string;
  confidence: number;
  modelUsed: 'enhanced' | 'simple' | 'fallback';
  processingTime: number;
  contextUsed: string[];
  documentsReferenced: string[];
  similarityScores: number[];
  chunkCount: number;
}

export class AdvancedRAG {
  private enhancedLLM: EnhancedLLM;
  private vectorStore: VectorStore;
  private documents: any[] = [];

  constructor() {
    this.enhancedLLM = new EnhancedLLM();
    this.vectorStore = new VectorStore();
  }

  async initialize(modelPath?: string) {
    try {
      console.log('Initializing Advanced RAG Pipeline...');
      
      // Initialize both systems
      await Promise.all([
        this.enhancedLLM.initialize(modelPath),
        this.vectorStore.initialize()
      ]);
      
      // Load documents
      this.documents = SampleDocumentService.getAllDocuments();
      
      console.log('Advanced RAG Pipeline initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Advanced RAG:', error);
      throw error;
    }
  }

  async processQuery(query: string): Promise<AdvancedRAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log('Processing query with Advanced RAG:', query);
      
      // Use VectorStore to find relevant chunks
      const relevantChunks = await this.vectorStore.searchDocuments(query, 3);
      
      if (relevantChunks.length === 0) {
        return {
          text: `I don't have specific information about "${query}". However, I can help you with medical guidelines (TCCC), search and rescue procedures, and medical equipment information. Please try asking about these topics.`,
          confidence: 0.3,
          modelUsed: 'fallback',
          processingTime: Date.now() - startTime,
          contextUsed: [],
          documentsReferenced: [],
          similarityScores: [],
          chunkCount: 0
        };
      }
      
      // Prepare context from relevant chunks
      const context = this.prepareContextFromChunks(relevantChunks);
      const documentTitles = this.getDocumentTitles(relevantChunks);
      const similarityScores = relevantChunks.map(chunk => 
        this.calculateSimilarity(query, chunk.content)
      );
      
      // Try enhanced LLM first
      if (this.enhancedLLM.isModelReady()) {
        try {
          const llmResponse = await this.enhancedLLM.generateResponse(query, context);
          
          return {
            text: llmResponse.text,
            confidence: llmResponse.confidence,
            modelUsed: 'enhanced',
            processingTime: Date.now() - startTime,
            contextUsed: [context.substring(0, 200) + '...'],
            documentsReferenced: documentTitles,
            similarityScores,
            chunkCount: relevantChunks.length
          };
        } catch (error) {
          console.warn('Enhanced LLM failed, falling back to VectorStore search:', error);
        }
      }
      
      // Fallback to VectorStore-based response generation
      const response = this.generateResponseFromChunks(query, relevantChunks);
      
      return {
        text: response,
        confidence: Math.max(...similarityScores) * 0.9, // Scale confidence by similarity
        modelUsed: 'simple',
        processingTime: Date.now() - startTime,
        contextUsed: [context.substring(0, 200) + '...'],
        documentsReferenced: documentTitles,
        similarityScores,
        chunkCount: relevantChunks.length
      };
      
    } catch (error) {
      console.error('Advanced RAG error:', error);
      
      return {
        text: 'Sorry, I encountered an error processing your query. Please try again.',
        confidence: 0.0,
        modelUsed: 'fallback',
        processingTime: Date.now() - startTime,
        contextUsed: [],
        documentsReferenced: [],
        similarityScores: [],
        chunkCount: 0
      };
    }
  }

  private prepareContextFromChunks(chunks: DocumentChunk[]): string {
    return chunks.map(chunk => 
      `Document: ${this.getDocumentTitle(chunk.documentId)}\nContent: ${chunk.content}`
    ).join('\n\n');
  }

  private getDocumentTitles(chunks: DocumentChunk[]): string[] {
    const titles = new Set<string>();
    for (const chunk of chunks) {
      titles.add(this.getDocumentTitle(chunk.documentId));
    }
    return Array.from(titles);
  }

  private getDocumentTitle(documentId: string): string {
    const doc = this.documents.find(d => d.id === documentId);
    return doc ? doc.title : 'Unknown Document';
  }

  private calculateSimilarity(query: string, content: string): number {
    // Simple keyword-based similarity for now
    const queryWords = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    
    let matches = 0;
    for (const word of queryWords) {
      if (word.length > 2 && contentLower.includes(word)) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
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
      await this.vectorStore.addDocument(documentId, title, content);
      
      // Add to local documents array
      this.documents.push({
        id: documentId,
        title,
        content,
        type: 'markdown'
      });
      
      console.log(`Added document: ${title}`);
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async getStats() {
    const vectorStoreStats = await this.vectorStore.getStats();
    
    return {
      documents: vectorStoreStats.documents,
      chunks: vectorStoreStats.chunks,
      totalSize: vectorStoreStats.totalSize,
      enhancedLLMReady: this.enhancedLLM.isModelReady(),
      vectorStoreReady: true
    };
  }

  async getModelInfo() {
    return {
      enhancedLLM: this.enhancedLLM.getModelInfo(),
      vectorStore: {
        isLoaded: true,
        modelType: 'Vector Search + Similarity',
        capabilities: ['semantic-search', 'document-retrieval', 'similarity-ranking']
      }
    };
  }
} 