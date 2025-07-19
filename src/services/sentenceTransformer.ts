import { cos_sim, env, pipeline } from '@xenova/transformers';
import { ModelSettingsService } from './modelSettings';

export interface EmbeddingOptions {
  modelName?: string;
  dimension?: number;
  useCache?: boolean;
  modelPath?: string;
  similarityMethod?: 'cos_sim' | 'manual' | 'auto';
}

export class SentenceTransformer {
  private model: any = null;
  private cache: Map<string, number[]> = new Map();
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';
  private dimension: number = 384;
  private isModelLoaded: boolean = false;
  private settings: ModelSettingsService;

  constructor() {
    this.settings = ModelSettingsService.getInstance();
  }

  async initialize(options?: EmbeddingOptions) {
    try {
      console.log('Initializing Sentence Transformer...');
      
      // Load settings
      const settings = this.settings.getSettings();
      
      // Override with options if provided
      if (options?.modelName) {
        this.modelName = options.modelName;
      } else {
        this.modelName = this.settings.getSentenceTransformerName();
      }
      
      if (options?.dimension) {
        this.dimension = options.dimension;
      } else {
        this.dimension = settings.sentenceTransformerDimension;
      }
      
      // Set environment based on settings
      env.allowLocalModels = settings.allowLocalModels;
      env.allowRemoteModels = settings.allowRemoteModels;
      env.useBrowserCache = settings.useBrowserCache;
      
      // Determine model type
      const modelType = this.settings.getSentenceTransformerModel();
      
      if (modelType === 'hash') {
        console.log('Using hash-based embeddings (no model loading)');
        this.isModelLoaded = false;
        return;
      }
      
      if (modelType === 'local') {
        const modelPath = this.settings.getSentenceTransformerPath();
        if (!modelPath) {
          console.warn('Local model path not set, falling back to hash-based');
          this.isModelLoaded = false;
          return;
        }
        
        // Load local model
        try {
          this.model = await pipeline('feature-extraction', modelPath as string);
          this.isModelLoaded = true;
          console.log(`Loaded local sentence transformer from: ${modelPath}`);
        } catch (error) {
          console.error('Failed to load local model:', error);
          this.isModelLoaded = false;
        }
      } else {
        // Load Xenova model
        try {
          this.model = await pipeline('feature-extraction', this.modelName);
          this.isModelLoaded = true;
          console.log(`Loaded Xenova sentence transformer: ${this.modelName}`);
        } catch (error) {
          console.error('Failed to load Xenova model:', error);
          this.isModelLoaded = false;
        }
      }
      
      console.log(`Sentence Transformer initialized with model: ${this.modelName}`);
    } catch (error) {
      console.error('Failed to initialize Sentence Transformer:', error);
      console.log('Falling back to hash-based embeddings');
      this.isModelLoaded = false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check cache first if enabled
      if (this.settings.getUseCache() && this.cache.has(text)) {
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

      // Cache the result if enabled
      if (this.settings.getUseCache()) {
        this.cache.set(text, embedding);
        
        // Limit cache size
        const maxSize = this.settings.getCacheSize();
        if (this.cache.size > maxSize) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }
      
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
    const similarityMethod = this.settings.getSimilarityMethod();
    
    // Auto mode: try cos_sim first, fallback to manual
    if (similarityMethod === 'auto' || similarityMethod === 'cos_sim') {
      try {
        // Try to use cos_sim from transformers if available
        if (typeof cos_sim === 'function') {
          // Convert to tensors for cos_sim
          const tensor1 = new Float32Array(embedding1);
          const tensor2 = new Float32Array(embedding2);
          
          // Use cos_sim from transformers
          const similarity = cos_sim(Array.from(tensor1), Array.from(tensor2));
          const result = Array.isArray(similarity) ? similarity[0] : similarity;
          
          console.log(`Used cos_sim for similarity calculation: ${result}`);
          return result;
        }
      } catch (error) {
        console.warn('cos_sim failed, using manual cosine similarity:', error);
      }
    }
    
    // Manual mode or cos_sim fallback
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
    
    const result = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    console.log(`Used manual cosine similarity: ${result}`);
    return result;
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    const batchSize = this.settings.getSettings().batchSize;
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }

  getStats() {
    const settings = this.settings.getSettings();
    return {
      modelLoaded: this.isModelLoaded,
      modelName: this.modelName,
      dimension: this.dimension,
      cacheSize: this.cache.size,
      cacheHitRate: 0, // Would calculate this in production
      modelType: settings.sentenceTransformerModel,
      modelPath: settings.sentenceTransformerPath,
      similarityMethod: settings.similarityMethod,
      useCache: settings.useCache,
      cacheSizeLimit: settings.cacheSize
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('Sentence Transformer cache cleared');
  }

  isModelReady(): boolean {
    return this.isModelLoaded;
  }

  getModelType(): string {
    return this.settings.getSentenceTransformerModel();
  }

  getSimilarityMethod(): string {
    return this.settings.getSimilarityMethod();
  }
} 