export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  documentId: string;
  chunkIndex: number;
}

export interface Document {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

export class VectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();
  private documents: Map<string, Document> = new Map();

  constructor() {
    console.log('VectorStore initialized with in-memory storage');
  }

  async addChunk(chunk: DocumentChunk) {
    this.chunks.set(chunk.id, chunk);
    console.log(`Added chunk ${chunk.id} for document ${chunk.documentId}`);
  }

  async addDocument(documentId: string, title: string, type: string) {
    const document: Document = {
      id: documentId,
      title,
      type,
      createdAt: new Date().toISOString()
    };
    this.documents.set(documentId, document);
    console.log(`Added document ${documentId}: ${title}`);
  }

  async searchSimilar(queryEmbedding: number[], limit: number = 5): Promise<DocumentChunk[]> {
    // Simple implementation: return first N chunks
    // In a real implementation, this would use cosine similarity
    const chunks = Array.from(this.chunks.values());
    return chunks.slice(0, limit);
  }

  async getAllDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
    const chunks = Array.from(this.chunks.values())
      .filter(chunk => chunk.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    return chunks;
  }

  async clearAll() {
    this.chunks.clear();
    this.documents.clear();
    console.log('VectorStore cleared');
  }

  getStats() {
    return {
      documents: this.documents.size,
      chunks: this.chunks.size
    };
  }
}
