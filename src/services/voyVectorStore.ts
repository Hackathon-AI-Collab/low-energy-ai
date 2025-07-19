import { SentenceTransformer } from './sentenceTransformer';

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
  chunks: Map<string, DocumentChunk>; // Added chunks property
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    chunkId: string;
    documentTitle: string;
    similarity: number;
  };
}

export class VoyVectorStore {
  private sentenceTransformer: SentenceTransformer;
  private documents: Map<string, DocumentMetadata> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();
  private dimension: number = 384;

  constructor() {
    this.sentenceTransformer = new SentenceTransformer();
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Voy Vector Store...');
      
      // Initialize sentence transformer
      await this.sentenceTransformer.initialize();
      
      console.log('Voy Vector Store initialized with local search only');
      console.log('Voy Vector Store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Voy Vector Store:', error);
      throw error;
    }
  }

  async addDocument(documentId: string, title: string, content: string, type: string = 'markdown'): Promise<void> {
    try {

      // Generate document hash
      const hash = await this.generateHash(content);
      
      // Process document into chunks
      const chunks = this.chunkContent(content, documentId);
      
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
        importance: this.calculateImportance(content),
        chunks: new Map() // Initialize chunks map
      };
      
      this.documents.set(documentId, document);
      
      // Add chunks to Voy index
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
        document.chunks.set(chunk.id, enhancedChunk); // Add chunk to document's chunks map
        
        // Generate embedding for the chunk
        const embedding = await this.sentenceTransformer.generateEmbedding(chunk.content);
        enhancedChunk.embedding = embedding;
        
        // Add to Voy index if available
        // if (this.voy) { // Removed voy-search dependency
        //   try {
        //     await this.voy.add({
        //       id: chunk.id,
        //       vector: new Float32Array(embedding),
        //       metadata: {
        //         documentId: chunk.documentId,
        //         content: chunk.content,
        //         title: document.title,
        //         type: document.type,
        //         importance: enhancedChunk.metadata.importance
        //       }
        //     } as any);
        //   } catch (error) {
        //     console.warn('Failed to add to Voy index, continuing with local storage:', error);
        //   }
        // }
      }
      
      console.log(`Added document: ${title} with ${chunks.length} chunks to Voy index`);
    } catch (error) {
      console.error('Error adding document to Voy Vector Store:', error);
      throw error;
    }
  }

  async searchDocuments(query: string, limit: number = 5): Promise<DocumentChunk[]> {
    try {
      const queryEmbedding = await this.sentenceTransformer.generateEmbedding(query);
      const results: SearchResult[] = [];

      // Search through all documents
      for (const [docId, doc] of this.documents.entries()) {
        for (const [chunkId, chunk] of doc.chunks.entries()) {
          const similarity = await this.sentenceTransformer.calculateSimilarity(
            queryEmbedding, 
            chunk.embedding
          );
          
          results.push({
            id: `${docId}_${chunkId}`,
            content: chunk.content,
            metadata: {
              documentId: docId,
              chunkId: chunkId,
              documentTitle: doc.title,
              similarity: similarity
            }
          });
        }
      }

      // Sort by similarity and return top K results
      results.sort((a, b) => b.metadata.similarity - a.metadata.similarity);
      
      // Convert to DocumentChunk format
      const chunks: DocumentChunk[] = [];
      for (const result of results.slice(0, limit)) {
        const chunk = this.chunks.get(result.id);
        if (chunk) {
          chunks.push({
            ...chunk,
            metadata: {
              ...chunk.metadata,
              similarityScore: result.metadata.similarity
            }
          });
        }
      }
      
      return chunks;

    } catch (error) {
      console.error('Error in vector search:', error);
      return [];
    }
  }

  private async localSimilaritySearch(query: string, limit: number): Promise<DocumentChunk[]> {
    // Fallback to local similarity search
    const queryEmbedding = await this.sentenceTransformer.generateEmbedding(query);
    
    const chunksWithScores = await Promise.all(
      Array.from(this.chunks.values()).map(async chunk => ({
        ...chunk,
        similarityScore: await this.sentenceTransformer.calculateSimilarity(queryEmbedding, chunk.embedding)
      }))
    );
    
    return chunksWithScores
      .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
      .slice(0, limit)
      .map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          similarityScore: chunk.similarityScore
        }
      }));
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
    const chunksToRemove: string[] = [];
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        chunksToRemove.push(chunkId);
        this.chunks.delete(chunkId);
      }
    }
    
    // Remove from Voy index if available
    // if (this.voy) { // Removed voy-search dependency
    //   for (const chunkId of chunksToRemove) {
    //     try {
    //       await this.voy.remove(chunkId as any);
    //     } catch (error) {
    //       console.warn('Failed to remove from Voy index:', error);
    //     }
    //   }
    // }
    
    console.log(`Deleted document: ${documentId} and ${chunksToRemove.length} chunks`);
  }

  async getStats(): Promise<{ documents: number; chunks: number; totalSize: number; indexSize: number }> {
    const totalSize = Array.from(this.chunks.values())
      .reduce((sum, chunk) => sum + chunk.content.length, 0);
    
    let indexSize = 0;
    // if (this.voy) { // Removed voy-search dependency
    //   try {
    //     indexSize = await this.voy.size();
    //   } catch (error) {
    //     console.warn('Could not get Voy index size:', error);
    //   }
    // }
    
    return {
      documents: this.documents.size,
      chunks: this.chunks.size,
      totalSize,
      indexSize
    };
  }

  async clearAll(): Promise<void> {
    // Clear Voy index if available
    // if (this.voy) { // Removed voy-search dependency
    //   try {
    //     await this.voy.clear();
    //   } catch (error) {
    //     console.warn('Failed to clear Voy index:', error);
    //   }
    // }
    
    // Clear local storage
    this.documents.clear();
    this.chunks.clear();
    
    console.log('Voy Vector Store cleared');
  }

  private chunkContent(content: string, documentId: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const chunkSize = 500;
    const chunkOverlap = 100;
    
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
            importance: 1.0 // Will be calculated later
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        chunks.push(chunk);

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + ' ' + sentence;
        startPosition = startPosition + currentChunk.length - overlapText.length;
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
          importance: 1.0 // Will be calculated later
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

  private getOverlapText(text: string): string {
    const words = text.split(' ');
    const overlapWords = words.slice(-Math.floor(100 / 10));
    return overlapWords.join(' ');
  }

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

  private calculateChunkImportance(chunk: string, index: number, totalChunks: number): number {
    let importance = 1.0;
    
    if (index === 0 || index === totalChunks - 1) {
      importance += 0.5;
    }
    
    importance += Math.min(chunk.length / 500, 1.0);
    
    return Math.min(importance, 5.0);
  }

  getSentenceTransformer(): SentenceTransformer {
    return this.sentenceTransformer;
  }
} 