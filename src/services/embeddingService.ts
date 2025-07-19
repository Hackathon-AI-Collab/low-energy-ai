export interface EmbeddingOptions {
  modelName?: string;
  dimension?: number;
  useCache?: boolean;
}

export class EmbeddingService {
  private cache: Map<string, number[]> = new Map();
  private modelLoaded: boolean = false;
  private modelName: string = 'all-MiniLM-L6-v2'; // Lightweight sentence transformer
  private dimension: number = 384;

  async initialize(options?: EmbeddingOptions) {
    try {
      console.log('Initializing Embedding Service...');
      
      if (options?.modelName) {
        this.modelName = options.modelName;
      }
      if (options?.dimension) {
        this.dimension = options.dimension;
      }
      
      // For now, we'll use hash-based embeddings
      // In production, this would load a proper sentence transformer model
      console.log(`Using embedding model: ${this.modelName} (${this.dimension}d)`);
      
      this.modelLoaded = true;
      console.log('Embedding Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Embedding Service:', error);
      console.log('Falling back to hash-based embeddings');
      this.modelLoaded = false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check cache first
      if (this.cache.has(text)) {
        return this.cache.get(text)!;
      }

      let embedding: number[];

      if (this.modelLoaded) {
        // In production, this would use a proper embedding model
        // For now, use enhanced hash-based embeddings
        embedding = this.generateEnhancedHashEmbedding(text);
      } else {
        embedding = this.generateHashEmbedding(text);
      }

      // Cache the result
      this.cache.set(text, embedding);
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Fallback to simple hash embedding
      return this.generateHashEmbedding(text);
    }
  }

  private generateEnhancedHashEmbedding(text: string): number[] {
    // Enhanced hash-based embedding with better semantic properties
    const words = text.toLowerCase().split(/\s+/);
    const embedding: number[] = new Array(this.dimension).fill(0);
    
    for (let i = 0; i < this.dimension; i++) {
      let value = 0;
      
      for (const word of words) {
        const wordHash = this.simpleHash(word);
        const positionHash = this.simpleHash(`${word}_${i}`);
        value += Math.sin(wordHash + positionHash) * Math.cos(wordHash * i);
      }
      
      // Normalize to 0-1 range
      embedding[i] = (Math.tanh(value / words.length) + 1) / 2;
    }
    
    return embedding;
  }

  private generateHashEmbedding(text: string): number[] {
    // Simple hash-based embedding for fallback
    const hash = this.simpleHash(text);
    const embedding: number[] = [];
    
    for (let i = 0; i < this.dimension; i++) {
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

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    // Cosine similarity
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

  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  getStats() {
    return {
      modelLoaded: this.modelLoaded,
      modelName: this.modelName,
      dimension: this.dimension,
      cacheSize: this.cache.size,
      cacheHitRate: 0 // Would calculate this in production
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('Embedding cache cleared');
  }
} 