import { ModelSettingsService } from './modelSettings';

// Try to import ONNX Runtime, but handle the case where it's not available
let InferenceSession: any = null;
let Tensor: any = null;

try {
  const onnxRuntime = require('onnxruntime-react-native');
  InferenceSession = onnxRuntime.InferenceSession;
  Tensor = onnxRuntime.Tensor;
} catch (error) {
  console.warn('ONNX Runtime not available:', error);
  // ONNX Runtime will be null, and we'll use hash-based embeddings
}

// Simple local tokenizer that doesn't require network downloads
class LocalTokenizer {
  private vocab: Map<string, number> = new Map();
  private maxLength: number = 512;

  constructor() {
    // Initialize with basic vocabulary
    this.initializeBasicVocab();
  }

  private initializeBasicVocab() {
    // Add basic tokens
    this.vocab.set('[PAD]', 0);
    this.vocab.set('[UNK]', 1);
    this.vocab.set('[CLS]', 2);
    this.vocab.set('[SEP]', 3);
    this.vocab.set('[MASK]', 4);
    
    // Add common words and characters
    let tokenId = 5;
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'medical', 'emergency', 'procedure', 'treatment', 'patient', 'doctor', 'nurse', 'hospital',
      'search', 'rescue', 'equipment', 'guideline', 'protocol', 'tccc', 'march', 'tourniquet',
      'airway', 'breathing', 'circulation', 'bleeding', 'shock', 'trauma', 'wound', 'injury'
    ];
    
    commonWords.forEach(word => {
      this.vocab.set(word.toLowerCase(), tokenId++);
    });
    
    // Add individual characters
    for (let i = 32; i <= 126; i++) {
      const char = String.fromCharCode(i);
      if (!this.vocab.has(char)) {
        this.vocab.set(char, tokenId++);
      }
    }
  }

  async tokenize(text: string) {
    const tokens = text.toLowerCase().split(/\s+/);
    const inputIds = [this.vocab.get('[CLS]') || 2];
    const attentionMask = [1];
    
    for (const token of tokens) {
      if (inputIds.length >= this.maxLength - 1) break;
      
      const tokenId = this.vocab.get(token) || this.vocab.get('[UNK]') || 1;
      inputIds.push(tokenId);
      attentionMask.push(1);
    }
    
    inputIds.push(this.vocab.get('[SEP]') || 3);
    attentionMask.push(1);
    
    // Pad to max length
    while (inputIds.length < this.maxLength) {
      inputIds.push(this.vocab.get('[PAD]') || 0);
      attentionMask.push(0);
    }
    
    return {
      input_ids: {
        data: new Int32Array(inputIds),
        dims: [1, inputIds.length]
      },
      attention_mask: {
        data: new Int32Array(attentionMask),
        dims: [1, attentionMask.length]
      }
    };
  }
}

export interface EmbeddingOptions {
  modelName?: string;
  dimension?: number;
  useCache?: boolean;
  modelPath?: string;
  similarityMethod?: 'cos_sim' | 'manual' | 'auto';
}

export class SentenceTransformer {
  private model: any = null;
  private tokenizer: any = null;
  private cache: Map<string, number[]> = new Map();
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';
  private dimension: number = 384;
  private isModelLoaded: boolean = false;
  private settings: ModelSettingsService;
  private isReactNative: boolean = false;

  constructor() {
    this.settings = ModelSettingsService.getInstance();
    // Detect React Native environment
    this.isReactNative = typeof navigator === 'undefined' || navigator.product === 'ReactNative';
  }

  async initialize(options?: EmbeddingOptions) {
    try {
      console.log('Initializing Sentence Transformer with revised architecture...');
      
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
      
      // Determine model type
      const modelType = this.settings.getSentenceTransformerModel();
      
      if (modelType === 'hash') {
        console.log('Using hash-based embeddings (no model loading)');
        this.isModelLoaded = false;
        return;
      }
      
      // Initialize local tokenizer (no network required)
      try {
        this.tokenizer = new LocalTokenizer();
        console.log('Local tokenizer initialized successfully');
      } catch (error) {
        console.error('Failed to initialize local tokenizer:', error);
        this.tokenizer = null;
      }
      
      // Check if we can use ONNX Runtime for model inference
      if (modelType === 'local') {
        const modelPath = this.settings.getSentenceTransformerPath();
        if (!modelPath) {
          console.warn('Local model path not set, using hash-based embeddings');
          this.isModelLoaded = false;
        } else if (!InferenceSession) {
          console.warn('ONNX Runtime not available, using hash-based embeddings');
          this.isModelLoaded = false;
        } else {
          try {
            this.model = await InferenceSession.create(modelPath as string);
            this.isModelLoaded = true;
            console.log(`Loaded local ONNX model from: ${modelPath}`);
          } catch (error) {
            console.error('Failed to load local ONNX model:', error);
            this.isModelLoaded = false;
          }
        }
      } else {
        console.log('Using hash-based embeddings (no local model specified)');
        this.isModelLoaded = false;
      }
      
      console.log(`Sentence Transformer initialized with model: ${this.modelName}`);
    } catch (error) {
      console.error('Failed to initialize Sentence Transformer:', error);
      console.log('Falling back to hash-based embeddings');
      this.isModelLoaded = false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // If we have a model and tokenizer, try to use ONNX Runtime
    if (this.isModelLoaded && this.model && this.tokenizer && Tensor) {
      try {
        // Tokenize the text using local tokenizer
        const inputs = await this.tokenizer.tokenize(text);

        // Convert to ONNX format
        const inputTensor = new Tensor('int32', inputs.input_ids.data, inputs.input_ids.dims);
        const attentionMask = new Tensor('int32', inputs.attention_mask.data, inputs.attention_mask.dims);

        // Run inference
        const results = await this.model.run({
          input_ids: inputTensor,
          attention_mask: attentionMask
        });

        // Extract embeddings (assuming the model outputs embeddings directly)
        const embeddings = results.embeddings || results.last_hidden_state;
        const embeddingArray = Array.from(embeddings.data as Float32Array);

        // Normalize to unit vector
        const magnitude = Math.sqrt(embeddingArray.reduce((sum, val) => sum + val * val, 0));
        return embeddingArray.map(val => val / magnitude);

      } catch (error) {
        console.error('Error generating embedding with ONNX model:', error);
        return this.generateHashEmbedding(text);
      }
    }

    // Fallback to hash-based embedding
    return this.generateHashEmbedding(text);
  }

  private generateHashEmbedding(text: string): number[] {
    // Enhanced hash-based embedding
    const hash = this.simpleHash(text);
    const embedding = new Array(this.dimension).fill(0);
    
    // Use hash to generate pseudo-random but deterministic embedding
    for (let i = 0; i < this.dimension; i++) {
      const seed = hash + i * 31;
      embedding[i] = Math.sin(seed) * 0.5 + 0.5; // Normalize to [0,1]
    }
    
    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
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

  async calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  isReady(): boolean {
    return this.isModelLoaded || true; // Always ready with hash fallback
  }

  getDimension(): number {
    return this.dimension;
  }

  getModelName(): string {
    return this.modelName;
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

  // Debug method to check current model status
  getCurrentModelStatus(): {
    modelType: string;
    modelPath?: string;
    isModelLoaded: boolean;
    modelName: string;
    dimension: number;
  } {
    return {
      modelType: this.settings.getSentenceTransformerModel(),
      modelPath: this.settings.getSentenceTransformerPath(),
      isModelLoaded: this.isModelLoaded,
      modelName: this.modelName,
      dimension: this.dimension
    };
  }

  // Method to reinitialize with current settings
  async reinitialize(): Promise<void> {
    console.log('Reinitializing Sentence Transformer with current settings...');
    await this.initialize();
  }
} 