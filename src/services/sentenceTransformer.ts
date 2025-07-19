import { env, pipeline } from '@xenova/transformers';

export interface EmbeddingOptions {
  modelName?: string;
  dimension?: number;
  useCache?: boolean;
}

export class SentenceTransformer {
  private model: any = null;
  private cache: Map<string, number[]> = new Map();
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';
  private dimension: number = 384;
  private isModelLoaded: boolean = false;

  async initialize(options?: EmbeddingOptions) {
    try {
      console.log('Initializing Sentence Transformer...');
      
      if (options?.modelName) {
        this.modelName = options.modelName;
      }
      if (options?.dimension) {
        this.dimension = options.dimension;
      }
      
      // Set environment for better performance
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;
      
      // Load the sentence transformer model
      this.model = await pipeline('feature-extraction', this.modelName);
      this.isModelLoaded = true;
      
      console.log(`Sentence Transformer initialized with model: ${this.modelName}`);
    } catch (error) {
      console.error('Failed to initialize Sentence Transformer:', error);
      console.log('Falling back to hash-based embeddings');
      this.isModelLoaded = false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check cache first
      if (this.cache.has(text)) {
        return this.cache.get(text)!;
      }

      let embedding: number[];

      if (this.isModelLoaded && this.model) {
        // Use sentence transformer
        embedding = await this.generateTransformerEmbedding(text);
      } else {
        // Fallback to hash-based embedding
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

  private async generateTransformerEmbedding(text: string): Promise<number[]> {
    try {
      // Generate embedding using the transformer model
      const result = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });
      
      // Convert to regular array
      const embedding = Array.from(result.data) as number[];
      
      console.log(`Generated embedding with dimension: ${embedding.length}`);
      return embedding;
    } catch (error) {
      console.error('Error in transformer embedding:', error);
      throw error;
    }
  }

  private generateHashEmbedding(text: string): number[] {
    // Enhanced hash-based embedding for fallback
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
      modelLoaded: this.isModelLoaded,
      modelName: this.modelName,
      dimension: this.dimension,
      cacheSize: this.cache.size,
      cacheHitRate: 0 // Would calculate this in production
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('Sentence Transformer cache cleared');
  }

  isModelReady(): boolean {
    return this.isModelLoaded;
  }
} 