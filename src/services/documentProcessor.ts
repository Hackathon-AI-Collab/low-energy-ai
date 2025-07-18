import * as FileSystem from 'expo-file-system';

export interface Document {
  id: string;
  title: string;
  content: string;
  type: 'markdown' | 'txt';
  createdAt: Date;
}

export class DocumentProcessor {
  async loadDocument(filePath: string): Promise<Document> {
    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      const fileName = filePath.split('/').pop() || 'unknown';
      
      return {
        id: Date.now().toString(),
        title: fileName,
        content,
        type: filePath.endsWith('.md') ? 'markdown' : 'txt',
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Error loading document:', error);
      throw new Error(`Failed to load document: ${filePath}`);
    }
  }

  chunkDocument(document: Document, chunkSize: number = 500): string[] {
    const words = document.content.split(' ');
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    
    return chunks;
  }

  // Simple embedding generation for hackathon
  // In a real implementation, this would use a sentence transformer model
  async generateEmbedding(text: string): Promise<number[]> {
    // Create a simple hash-based embedding for demo purposes
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Return a 3-dimensional embedding for simplicity
    return [
      Math.abs(hash) % 100,
      Math.abs(hash * 2) % 100,
      Math.abs(hash * 3) % 100
    ];
  }

  async processDocument(filePath: string): Promise<{
    document: Document;
    chunks: Array<{
      id: string;
      content: string;
      embedding: number[];
      documentId: string;
      chunkIndex: number;
    }>;
  }> {
    const document = await this.loadDocument(filePath);
    const textChunks = this.chunkDocument(document);
    
    const chunks = await Promise.all(
      textChunks.map(async (chunk, index) => {
        const embedding = await this.generateEmbedding(chunk);
        return {
          id: `${document.id}_chunk_${index}`,
          content: chunk,
          embedding,
          documentId: document.id,
          chunkIndex: index
        };
      })
    );

    return { document, chunks };
  }
}
