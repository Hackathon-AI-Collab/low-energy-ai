import { SampleDocument, SampleDocumentService } from './sampleDocuments';

export interface Document {
  id: string;
  title: string;
  type: string;
  createdAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: {
    chunkIndex: number;
    startPosition: number;
    endPosition: number;
  };
}

export class DocumentProcessor {
  private chunkSize: number = 500;
  private chunkOverlap: number = 100;

  async processDocument(filePath: string): Promise<{ document: Document; chunks: DocumentChunk[] }> {
    try {
      // For hackathon demo, we'll use sample documents
      const sampleDoc = this.getSampleDocumentFromPath(filePath);
      if (sampleDoc) {
        return this.processSampleDocument(sampleDoc);
      }

      // Fallback for actual file processing
      const content = await this.readFile(filePath);
      const document: Document = {
        id: this.generateId(),
        title: this.extractTitle(filePath),
        type: this.getFileType(filePath),
        createdAt: new Date()
      };

      const chunks = this.chunkContent(content, document.id);
      return { document, chunks };
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  private getSampleDocumentFromPath(filePath: string): SampleDocument | undefined {
    if (filePath.includes('tccc')) {
      return SampleDocumentService.getDocumentById('tccc-guidelines');
    } else if (filePath.includes('search') || filePath.includes('rescue')) {
      return SampleDocumentService.getDocumentById('search-rescue');
    } else if (filePath.includes('medical') || filePath.includes('equipment')) {
      return SampleDocumentService.getDocumentById('medical-equipment');
    }
    return undefined;
  }

  private processSampleDocument(sampleDoc: SampleDocument): { document: Document; chunks: DocumentChunk[] } {
    const document: Document = {
      id: sampleDoc.id,
      title: sampleDoc.title,
      type: sampleDoc.type,
      createdAt: new Date()
    };

    const chunks = this.chunkContent(sampleDoc.content, document.id);
    return { document, chunks };
  }

  private chunkContent(content: string, documentId: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = this.splitIntoSentences(content);
    let currentChunk = '';
    let chunkIndex = 0;
    let startPosition = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      if (potentialChunk.length > this.chunkSize && currentChunk) {
        // Create chunk
        const chunk: DocumentChunk = {
          id: `${documentId}-chunk-${chunkIndex}`,
          documentId,
          content: currentChunk.trim(),
          embedding: this.generateHashEmbedding(currentChunk.trim()),
          metadata: {
            chunkIndex,
            startPosition,
            endPosition: startPosition + currentChunk.length
          }
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
        embedding: this.generateHashEmbedding(currentChunk.trim()),
        metadata: {
          chunkIndex,
          startPosition,
          endPosition: startPosition + currentChunk.length
        }
      };
      chunks.push(chunk);
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - can be improved with NLP libraries
    return text
      .replace(/\n+/g, ' ')
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 10);
  }

  private getOverlapText(text: string): string {
    const words = text.split(' ');
    const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 10));
    return overlapWords.join(' ');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // For hackathon demo, use a simple hash-based embedding
    // In production, this would use a proper embedding model
    return this.generateHashEmbedding(text);
  }

  private generateHashEmbedding(text: string): number[] {
    // Simple hash-based embedding for demo purposes
    const hash = this.simpleHash(text);
    const embedding: number[] = [];
    
    for (let i = 0; i < 384; i++) { // Standard embedding size
      const seed = hash + i * 31;
      embedding.push((Math.sin(seed) + 1) / 2); // Normalize to 0-1
    }
    
    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async readFile(filePath: string): Promise<string> {
    // Placeholder for file reading
    // In a real implementation, this would read from the file system
    throw new Error('File reading not implemented for hackathon demo');
  }

  private extractTitle(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }

  private getFileType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'txt':
        return 'text';
      case 'pdf':
        return 'pdf';
      default:
        return 'unknown';
    }
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Method to load all sample documents
  async loadSampleDocuments(): Promise<{ document: Document; chunks: DocumentChunk[] }[]> {
    const sampleDocs = SampleDocumentService.getAllDocuments();
    const results = [];

    for (const sampleDoc of sampleDocs) {
      const result = this.processSampleDocument(sampleDoc);
      results.push(result);
    }

    return results;
  }
}
