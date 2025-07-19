import { SentenceTransformer } from './sentenceTransformer';
import { DocumentChunk, DocumentMetadata } from './voyVectorStore';

export interface UploadProgress {
  stage: 'processing' | 'chunking' | 'embedding' | 'saving' | 'complete';
  progress: number;
  message: string;
}

export interface UploadResult {
  success: boolean;
  documentId?: string;
  error?: string;
  stats?: {
    chunks: number;
    processingTime: number;
  };
}

export class DocumentUploadService {
  private sentenceTransformer: SentenceTransformer;

  constructor() {
    this.sentenceTransformer = new SentenceTransformer();
  }

  // Initialize the service
  async initialize(): Promise<void> {
    try {
      console.log('DocumentUploadService: Initializing...');
      await this.sentenceTransformer.initialize();
      console.log('DocumentUploadService: Initialized successfully');
    } catch (error) {
      console.error('DocumentUploadService: Failed to initialize:', error);
      throw error;
    }
  }

  // Upload a text document
  async uploadTextDocument(
    title: string,
    content: string,
    type: string = 'text',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const startTime = Date.now();
    
    try {
      console.log(`DocumentUploadService: Uploading text document "${title}" (${content.length} characters)`);
      
      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error('Document content cannot be empty');
      }

      if (content.length > 1000000) { // 1MB limit
        throw new Error('Document content is too large (max 1MB)');
      }

      // Generate document ID and hash
      const documentId = this.generateDocumentId(title);
      const hash = await this.generateHash(content);

      // Update progress
      onProgress?.({
        stage: 'processing',
        progress: 10,
        message: 'Processing document...'
      });

      // Create document metadata
      const document: DocumentMetadata = {
        id: documentId,
        title,
        type,
        version: 1,
        hash,
        createdAt: new Date(),
        updatedAt: new Date(),
        chunkCount: 0,
        importance: this.calculateImportance(content),
        chunks: new Map()
      };

      // Update progress
      onProgress?.({
        stage: 'chunking',
        progress: 30,
        message: 'Chunking document...'
      });

      // Chunk the content
      const chunks = this.chunkContent(content, documentId);
      document.chunkCount = chunks.length;

      // Update progress
      onProgress?.({
        stage: 'embedding',
        progress: 50,
        message: `Generating embeddings for ${chunks.length} chunks...`
      });

      // Generate embeddings for chunks
      const documentChunks: DocumentChunk[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Generate embedding
        const embedding = await this.sentenceTransformer.generateEmbedding(chunk.content);
        
        const enhancedChunk: DocumentChunk = {
          ...chunk,
          embedding,
          metadata: {
            ...chunk.metadata,
            importance: this.calculateChunkImportance(chunk.content, chunk.metadata.chunkIndex, chunks.length)
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        documentChunks.push(enhancedChunk);
        
        // Update progress
        const embeddingProgress = 50 + (i / chunks.length) * 40;
        onProgress?.({
          stage: 'embedding',
          progress: embeddingProgress,
          message: `Generated embedding ${i + 1}/${chunks.length}`
        });
      }

      // Update progress
      onProgress?.({
        stage: 'saving',
        progress: 90,
        message: 'Saving to storage...'
      });

      // Return the document and chunks for the caller to save
      const processingTime = Date.now() - startTime;
      
      console.log(`DocumentUploadService: Successfully processed document "${title}" in ${processingTime}ms`);
      
      // Update progress
      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Upload complete!'
      });

      return {
        success: true,
        documentId,
        stats: {
          chunks: documentChunks.length,
          processingTime
        }
      };

    } catch (error) {
      console.error('DocumentUploadService: Failed to upload text document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Upload a file document
  async uploadFileDocument(
    title: string,
    fileContent: string,
    fileName: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Determine file type from extension
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    const type = this.getFileType(fileExtension);
    
    return this.uploadTextDocument(title, fileContent, type, onProgress);
  }

  // Chunk content into smaller pieces
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

  // Split text into sentences
  private splitIntoSentences(text: string): string[] {
    return text
      .replace(/\n+/g, ' ')
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 10);
  }

  // Get overlap text for chunking
  private getOverlapText(text: string): string {
    const words = text.split(' ');
    const overlapWords = words.slice(-Math.floor(100 / 10));
    return overlapWords.join(' ');
  }

  // Generate document ID
  private generateDocumentId(title: string): string {
    const timestamp = Date.now();
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${sanitizedTitle}-${timestamp}`;
  }

  // Generate hash for content
  private async generateHash(content: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // Calculate document importance
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

  // Calculate chunk importance
  private calculateChunkImportance(chunk: string, index: number, totalChunks: number): number {
    let importance = 1.0;
    
    if (index === 0 || index === totalChunks - 1) {
      importance += 0.5;
    }
    
    importance += Math.min(chunk.length / 500, 1.0);
    
    return Math.min(importance, 5.0);
  }

  // Get file type from extension
  private getFileType(extension: string): string {
    const typeMap: { [key: string]: string } = {
      'txt': 'text',
      'md': 'markdown',
      'pdf': 'pdf',
      'doc': 'document',
      'docx': 'document',
      'rtf': 'document',
      'html': 'html',
      'htm': 'html',
      'json': 'json',
      'xml': 'xml',
      'csv': 'csv'
    };
    
    return typeMap[extension] || 'text';
  }

  // Validate file content
  validateFileContent(content: string, fileName: string): { valid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'File content is empty' };
    }

    if (content.length > 1000000) { // 1MB limit
      return { valid: false, error: 'File is too large (max 1MB)' };
    }

    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    const supportedExtensions = ['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'html', 'htm', 'json', 'xml', 'csv'];
    
    if (!supportedExtensions.includes(fileExtension)) {
      return { valid: false, error: `Unsupported file type: ${fileExtension}` };
    }

    return { valid: true };
  }
} 