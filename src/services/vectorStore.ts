import { DocumentProcessor } from './documentProcessor';
import { SampleDocumentService } from './sampleDocuments';

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
}

export class VectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();
  private documents: Map<string, DocumentMetadata> = new Map();
  private documentProcessor: DocumentProcessor;

  constructor() {
    this.documentProcessor = new DocumentProcessor();
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Vector Store...');
      
      // Load sample documents for now
      await this.loadSampleDocuments();
      
      console.log('Vector Store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Vector Store:', error);
      throw error;
    }
  }

  private async loadSampleDocuments(): Promise<void> {
    const sampleDocs = SampleDocumentService.getAllDocuments();
    
    for (const doc of sampleDocs) {
      await this.addDocument(doc.id, doc.title, doc.content, doc.type);
    }
  }

  async addDocument(documentId: string, title: string, content: string, type: string = 'markdown'): Promise<void> {
    try {
      // Generate document hash
      const hash = await this.generateHash(content);
      
      // Process document into chunks
      const chunks = this.documentProcessor['chunkContent'](content, documentId);
      
      // Create document metadata
      const document: DocumentMetadata = {
        id: documentId,
        title,
        type,
        version: 1,
        hash,
        createdAt: new Date(),
        updatedAt: new Date(),
        chunkCount: chunks.length,
        importance: this.calculateImportance(content)
      };
      
      this.documents.set(documentId, document);
      
      // Add chunks
      for (const chunk of chunks) {
        const enhancedChunk: DocumentChunk = {
          ...chunk,
          metadata: {
            ...chunk.metadata,
            importance: this.calculateChunkImportance(chunk.content, chunk.metadata.chunkIndex, chunks.length)
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.chunks.set(chunk.id, enhancedChunk);
      }
      
      console.log(`Added document: ${title} with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Error adding document to vector store:', error);
      throw error;
    }
  }

  async searchDocuments(query: string, limit: number = 5): Promise<DocumentChunk[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.documentProcessor.generateEmbedding(query);
      
      // Calculate similarity scores for all chunks
      const chunksWithScores = Array.from(this.chunks.values()).map(chunk => ({
        ...chunk,
        similarityScore: this.calculateSimilarity(queryEmbedding, chunk.embedding)
      }));
      
      // Sort by similarity score and return top results
      return chunksWithScores
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata | null> {
    return this.documents.get(documentId) || null;
  }

  async getAllDocuments(): Promise<DocumentMetadata[]> {
    return Array.from(this.documents.values()).sort((a, b) => b.importance - a.importance);
  }

  async deleteDocument(documentId: string): Promise<void> {
    // Remove document
    this.documents.delete(documentId);
    
    // Remove all chunks for this document
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(chunkId);
      }
    }
    
    console.log(`Deleted document: ${documentId}`);
  }

  async getStats(): Promise<{ documents: number; chunks: number; totalSize: number }> {
    const totalSize = Array.from(this.chunks.values())
      .reduce((sum, chunk) => sum + chunk.content.length, 0);
    
    return {
      documents: this.documents.size,
      chunks: this.chunks.size,
      totalSize
    };
  }

  private calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    // Simple cosine similarity
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private async generateHash(content: string): Promise<string> {
    // Simple hash for now
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private calculateImportance(content: string): number {
    // Simple importance calculation based on content length and keywords
    const medicalKeywords = ['tccc', 'march', 'tourniquet', 'hemorrhage', 'airway', 'rescue', 'emergency'];
    const lowerContent = content.toLowerCase();
    
    let score = Math.min(content.length / 1000, 5); // Base score from length
    
    for (const keyword of medicalKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 2;
      }
    }
    
    return Math.min(score, 10); // Cap at 10
  }

  private calculateChunkImportance(chunk: string, index: number, totalChunks: number): number {
    // First and last chunks are more important
    let importance = 1.0;
    
    if (index === 0 || index === totalChunks - 1) {
      importance += 0.5;
    }
    
    // Longer chunks might be more important
    importance += Math.min(chunk.length / 500, 1.0);
    
    return Math.min(importance, 5.0);
  }
}
