import { EnhancedLLM } from './enhancedLLM';
import { SampleDocumentService } from './sampleDocuments';
import { SimpleRAG } from './simpleRAG';

export interface RAGResponse {
  text: string;
  confidence: number;
  modelUsed: 'enhanced' | 'simple' | 'fallback';
  processingTime: number;
  contextUsed: string[];
  documentsReferenced: string[];
}

export class EnhancedRAG {
  private enhancedLLM: EnhancedLLM;
  private simpleRAG: SimpleRAG;
  private documents: any[] = [];

  constructor() {
    this.enhancedLLM = new EnhancedLLM();
    this.simpleRAG = new SimpleRAG();
  }

  async initialize(modelPath?: string) {
    try {
      console.log('Initializing Enhanced RAG Pipeline...');
      
      // Initialize both LLM systems
      await Promise.all([
        this.enhancedLLM.initialize(modelPath),
        this.simpleRAG.initialize()
      ]);
      
      // Load documents
      this.documents = SampleDocumentService.getAllDocuments();
      
      console.log('Enhanced RAG Pipeline initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Enhanced RAG:', error);
      throw error;
    }
  }

  async processQuery(query: string): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      console.log('Processing query with Enhanced RAG:', query);
      
      // Find relevant documents
      const relevantDocs = this.findRelevantDocuments(query);
      
      if (relevantDocs.length === 0) {
        return {
          text: `I don't have specific information about "${query}". However, I can help you with medical guidelines (TCCC), search and rescue procedures, and medical equipment information. Please try asking about these topics.`,
          confidence: 0.3,
          modelUsed: 'fallback',
          processingTime: Date.now() - startTime,
          contextUsed: [],
          documentsReferenced: []
        };
      }
      
      // Prepare context from relevant documents
      const context = this.prepareContext(relevantDocs);
      const documentTitles = relevantDocs.map(doc => doc.title);
      
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
            documentsReferenced: documentTitles
          };
        } catch (error) {
          console.warn('Enhanced LLM failed, falling back to Simple RAG:', error);
        }
      }
      
      // Fallback to Simple RAG
      const simpleResponse = await this.simpleRAG.processQuery(query);
      
      return {
        text: simpleResponse,
        confidence: 0.8,
        modelUsed: 'simple',
        processingTime: Date.now() - startTime,
        contextUsed: [context.substring(0, 200) + '...'],
        documentsReferenced: documentTitles
      };
      
    } catch (error) {
      console.error('Enhanced RAG error:', error);
      
      return {
        text: 'Sorry, I encountered an error processing your query. Please try again.',
        confidence: 0.0,
        modelUsed: 'fallback',
        processingTime: Date.now() - startTime,
        contextUsed: [],
        documentsReferenced: []
      };
    }
  }

  private findRelevantDocuments(query: string): any[] {
    const lowerQuery = query.toLowerCase();
    const relevantDocs: any[] = [];
    
    for (const doc of this.documents) {
      let score = 0;
      
      // Check title relevance
      if (doc.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }
      
      // Check content relevance
      const content = doc.content.toLowerCase();
      const queryWords = lowerQuery.split(' ');
      
      for (const word of queryWords) {
        if (word.length > 2 && content.includes(word)) {
          score += 1;
        }
      }
      
      // Special handling for medical/TCCC queries
      if ((lowerQuery.includes('medical') || lowerQuery.includes('tccc') || lowerQuery.includes('march')) && 
          doc.id === 'tccc-guidelines') {
        score += 20;
      }
      
      // Special handling for search/rescue queries
      if ((lowerQuery.includes('search') || lowerQuery.includes('rescue') || lowerQuery.includes('sar')) && 
          doc.id === 'search-rescue') {
        score += 20;
      }
      
      // Special handling for equipment queries
      if ((lowerQuery.includes('equipment') || lowerQuery.includes('tourniquet') || lowerQuery.includes('airway')) && 
          doc.id === 'medical-equipment') {
        score += 20;
      }
      
      if (score > 0) {
        relevantDocs.push({ ...doc, score });
      }
    }
    
    // Sort by relevance score
    relevantDocs.sort((a, b) => b.score - a.score);
    
    return relevantDocs.slice(0, 2); // Return top 2 most relevant
  }

  private prepareContext(relevantDocs: any[]): string {
    return relevantDocs.map(doc => 
      `Document: ${doc.title}\nContent: ${doc.content.substring(0, 1000)}`
    ).join('\n\n');
  }

  async addDocument(documentId: string, title: string, content: string): Promise<void> {
    try {
      // Add to both systems
      await this.enhancedLLM.addDocument(documentId, content);
      
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

  getStats() {
    return {
      documents: this.documents.length,
      chunks: this.documents.reduce((total, doc) => total + Math.ceil(doc.content.length / 500), 0),
      enhancedLLMReady: this.enhancedLLM.isModelReady(),
      simpleRAGReady: true
    };
  }

  getModelInfo() {
    return {
      enhancedLLM: this.enhancedLLM.getModelInfo(),
      simpleRAG: {
        isLoaded: true,
        modelType: 'Keyword Search',
        capabilities: ['document-retrieval', 'keyword-matching']
      }
    };
  }
} 