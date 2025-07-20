import { ModelSettingsService } from './modelSettings';
import { ModelInitializationService } from './modelInitializationService';
import * as FileSystem from 'expo-file-system';

// ONNX Runtime will be imported conditionally when needed
let InferenceSession: any = null;
let Tensor: any = null;
let onnxRuntimeLoaded = false;

async function loadONNXRuntime() {
  if (onnxRuntimeLoaded) return;
  
  try {
    console.log('Sentence Transformer: Attempting to import ONNX Runtime...');
    const onnxRuntime = require('onnxruntime-react-native');
    InferenceSession = onnxRuntime.InferenceSession;
    Tensor = onnxRuntime.Tensor;
    onnxRuntimeLoaded = true;
    console.log('Sentence Transformer: ONNX Runtime imported successfully');
  } catch (error) {
    console.warn('Sentence Transformer: ONNX Runtime not available:', error);
    if (error instanceof Error) {
      console.warn('Sentence Transformer: Error details:', error.message);
    }
    // ONNX Runtime will be null, and system will fail (hash embeddings disabled)
  }
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
    const tokenTypeIds = [0]; // All tokens are from the first sequence
    
    for (const token of tokens) {
      if (inputIds.length >= this.maxLength - 1) break;
      
      const tokenId = this.vocab.get(token) || this.vocab.get('[UNK]') || 1;
      inputIds.push(tokenId);
      attentionMask.push(1);
      tokenTypeIds.push(0); // All tokens are from the first sequence
    }
    
    inputIds.push(this.vocab.get('[SEP]') || 3);
    attentionMask.push(1);
    tokenTypeIds.push(0);
    
    // Pad to max length
    while (inputIds.length < this.maxLength) {
      inputIds.push(this.vocab.get('[PAD]') || 0);
      attentionMask.push(0);
      tokenTypeIds.push(0);
    }
    
    return {
      input_ids: {
        data: new BigInt64Array(inputIds.map(id => BigInt(id))),
        dims: [1, inputIds.length]
      },
      attention_mask: {
        data: new BigInt64Array(attentionMask.map(mask => BigInt(mask))),
        dims: [1, attentionMask.length]
      },
      token_type_ids: {
        data: new BigInt64Array(tokenTypeIds.map(id => BigInt(id))),
        dims: [1, tokenTypeIds.length]
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
  private modelInitService: ModelInitializationService;
  private isReactNative: boolean = false;

  constructor() {
    this.settings = ModelSettingsService.getInstance();
    this.modelInitService = ModelInitializationService.getInstance();
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
        console.error('Hash embeddings disabled - model type "hash" not supported');
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
        console.log('🔍 Local model loading attempt:');
        console.log(`  - Model type: ${modelType}`);
        console.log(`  - Model path: ${modelPath}`);
        console.log(`  - Model path exists: ${!!modelPath}`);
        
        if (typeof modelPath !== 'string' || !modelPath) {
          console.error('Local model path not set or invalid - attempting to download ONNX model');
          this.isModelLoaded = false;
          
          // Try to download the missing ONNX model
          try {
            console.log('🔄 Downloading missing all-MiniLM-L6-v2.onnx model...');
            const { ModelDownloadService } = await import('./modelDownloadService');
            const downloadService = ModelDownloadService.getInstance();
            
            const downloadPath = await downloadService.downloadModel({
              modelName: 'Xenova/all-MiniLM-L6-v2 (ONNX)',
              modelType: 'sentence-transformer',
              url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
              fileName: 'all-MiniLM-L6-v2.onnx',
              onProgress: (progress) => {
                const percent = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
                console.log(`📥 Downloading ONNX model: ${percent}%`);
              }
            });
            
            console.log(`✅ ONNX model downloaded to: ${downloadPath}`);
            console.log('🔄 Reinitializing sentence transformer with downloaded model...');
            
            // Reinitialize with the downloaded model
            await this.initialize();
            return;
            
          } catch (downloadError) {
            console.error('❌ Failed to download ONNX model:', downloadError);
            this.isModelLoaded = false;
          }
        } else {
          // Check if the model file actually exists
          try {
            const fileInfo = await FileSystem.getInfoAsync(modelPath);
            
            if (!fileInfo.exists) {
              console.error(`❌ ONNX model file not found at: ${modelPath}`);
              console.log('🔄 Attempting to download missing ONNX model...');
              
              const { ModelDownloadService } = await import('./modelDownloadService');
              const downloadService = ModelDownloadService.getInstance();
              
              const downloadPath = await downloadService.downloadModel({
                modelName: 'Xenova/all-MiniLM-L6-v2 (ONNX)',
                modelType: 'sentence-transformer',
                url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
                fileName: 'all-MiniLM-L6-v2.onnx',
                onProgress: (progress) => {
                  const percent = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
                  console.log(`📥 Downloading ONNX model: ${percent}%`);
                }
              });
              
              console.log(`✅ ONNX model downloaded to: ${downloadPath}`);
              console.log('🔄 Reinitializing sentence transformer with downloaded model...');
              
              // Reinitialize with the downloaded model
              await this.initialize();
              return;
            }
          } catch (downloadError) {
            console.error('❌ Failed to check/download ONNX model:', downloadError);
            this.isModelLoaded = false;
            return;
          }
          
          // Try to load ONNX Runtime if not already loaded
          console.log('🔄 Loading ONNX Runtime...');
          await loadONNXRuntime();
          
          console.log('🔍 ONNX Runtime loading result:');
          console.log(`  - InferenceSession available: ${!!InferenceSession}`);
          console.log(`  - Tensor available: ${!!Tensor}`);
          console.log(`  - onnxRuntimeLoaded: ${onnxRuntimeLoaded}`);
          
          if (!InferenceSession) {
            console.error('ONNX Runtime not available - hash embeddings disabled');
            this.isModelLoaded = false;
          } else {
            try {
              console.log('🔄 Creating ONNX model session...');
              console.log(`  - Model path: ${modelPath}`);
              console.log(`  - Model path type: ${typeof modelPath}`);
              
              this.model = await InferenceSession.create(modelPath as string);
              this.isModelLoaded = true;
              console.log(`✅ Loaded local ONNX model from: ${modelPath}`);
              console.log('🔍 Model session details:');
              console.log(`  - Model input names: ${this.model.inputNames}`);
              console.log(`  - Model output names: ${this.model.outputNames}`);
            } catch (error) {
              console.error('❌ Failed to load local ONNX model:', error);
              console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
              console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
              this.isModelLoaded = false;
            }
          }
        }
      } else {
        console.error('Hash embeddings disabled (no local model specified)');
        console.log(`  - Model type: ${modelType}`);
        this.isModelLoaded = false;
      }
      
      console.log(`Sentence Transformer initialized with model: ${this.modelName}`);
    } catch (error) {
      console.error('Failed to initialize Sentence Transformer:', error);
      console.error('Hash embeddings disabled - initialization failed');
      this.isModelLoaded = false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    console.log('🔍 Sentence Transformer: Starting embedding generation...');
    console.log(`📝 Text length: ${text.length} characters`);
    console.log(`📝 Text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    // Ensure model is ready before generating embeddings
    console.log('🔄 Ensuring model is ready...');
    const modelReady = await this.modelInitService.ensureModelReady();
    if (!modelReady) {
      const status = this.modelInitService.getStatus();
      throw new Error(`Model not ready: ${status.error || 'Unknown error'}`);
    }
    
    // If model was just initialized, reinitialize the sentence transformer
    if (!this.isModelLoaded) {
      console.log('🔄 Model was just downloaded, reinitializing sentence transformer...');
      await this.initialize();
    }
    
    // Detailed model status check
    console.log('🔍 Detailed Model Status Check:');
    console.log(`  - isModelLoaded: ${this.isModelLoaded}`);
    console.log(`  - model exists: ${!!this.model}`);
    console.log(`  - tokenizer exists: ${!!this.tokenizer}`);
    console.log(`  - modelName: ${this.modelName}`);
    console.log(`  - dimension: ${this.dimension}`);
    console.log(`  - modelType: ${this.settings.getSentenceTransformerModel()}`);
    console.log(`  - modelPath: ${this.settings.getSentenceTransformerPath()}`);
    
    // Check if we have a model and tokenizer
    if (this.isModelLoaded && this.model && this.tokenizer) {
      console.log('✅ Using ONNX Runtime model for embedding generation');
      console.log(`🤖 Model: ${this.modelName}`);
      console.log(`📏 Expected dimension: ${this.dimension}`);
      
      // Ensure ONNX Runtime is loaded
      console.log('🔄 Loading ONNX Runtime...');
      await loadONNXRuntime();
      
      console.log('🔍 ONNX Runtime Status:');
      console.log(`  - InferenceSession available: ${!!InferenceSession}`);
      console.log(`  - Tensor available: ${!!Tensor}`);
      console.log(`  - onnxRuntimeLoaded: ${onnxRuntimeLoaded}`);
      
      if (!Tensor) {
        console.error('❌ ONNX Runtime Tensor not available - REFUSING to generate embedding');
        console.log('🔍 ONNX Runtime Error Details:');
        try {
          const onnxRuntime = require('onnxruntime-react-native');
          console.log(`  - onnxruntime-react-native loaded: ${!!onnxRuntime}`);
          console.log(`  - InferenceSession: ${!!onnxRuntime.InferenceSession}`);
          console.log(`  - Tensor: ${!!onnxRuntime.Tensor}`);
        } catch (error) {
          console.error('  - Failed to require onnxruntime-react-native:', error);
        }
        throw new Error('ONNX Runtime Tensor not available and hash embeddings are disabled');
      }
      
      try {
        console.log('🔄 Tokenizing text...');
        // Tokenize the text using local tokenizer
        const inputs = await this.tokenizer.tokenize(text);
        console.log(`🔤 Tokenization complete. Input shape: ${inputs.input_ids.dims.join('x')}`);
        console.log(`🔤 Input data type: ${inputs.input_ids.data.constructor.name}`);
        console.log(`🔤 Input data length: ${inputs.input_ids.data.length}`);

        console.log('🔄 Converting to ONNX format...');
        // Convert to ONNX format with detailed error checking
        let inputTensor, attentionMask, tokenTypeIds;
        
        try {
          inputTensor = new Tensor('int64', inputs.input_ids.data, inputs.input_ids.dims);
          console.log('✅ Input tensor created');
        } catch (error) {
          console.error('❌ Failed to create input tensor:', error);
          throw error;
        }
        
        try {
          attentionMask = new Tensor('int64', inputs.attention_mask.data, inputs.attention_mask.dims);
          console.log('✅ Attention mask tensor created');
        } catch (error) {
          console.error('❌ Failed to create attention mask tensor:', error);
          throw error;
        }
        
        try {
          tokenTypeIds = new Tensor('int64', inputs.token_type_ids.data, inputs.token_type_ids.dims);
          console.log('✅ Token type IDs tensor created');
        } catch (error) {
          console.error('❌ Failed to create token type IDs tensor:', error);
          throw error;
        }
        
        console.log('✅ ONNX tensors created successfully');

        console.log('🔄 Running model inference...');
        console.log('🔍 Model input keys:', Object.keys({
          input_ids: inputTensor,
          attention_mask: attentionMask,
          token_type_ids: tokenTypeIds
        }));
        
        // Run inference
        const results = await this.model.run({
          input_ids: inputTensor,
          attention_mask: attentionMask,
          token_type_ids: tokenTypeIds
        });
        console.log('✅ Model inference completed');
        console.log('🔍 Model output keys:', Object.keys(results));

        // Extract embeddings (assuming the model outputs embeddings directly)
        const embeddings = results.embeddings || results.last_hidden_state;
        console.log('🔍 Embedding tensor type:', embeddings.constructor.name);
        console.log('🔍 Embedding tensor dims:', embeddings.dims);
        console.log('🔍 Embedding tensor data type:', embeddings.data.constructor.name);
        
        // Handle different tensor shapes
        let embeddingArray: number[];
        
        if (embeddings.dims.length === 3) {
          // 3D tensor: [batch_size, sequence_length, hidden_dim]
          // Extract the CLS token embedding (first token) or mean pooling
          console.log('🔍 Processing 3D tensor output...');
          const [batchSize, seqLength, hiddenDim] = embeddings.dims;
          console.log(`📊 Tensor shape: [${batchSize}, ${seqLength}, ${hiddenDim}]`);
          
          const rawData = Array.from(embeddings.data as Float32Array);
          console.log(`📊 Raw tensor data length: ${rawData.length}`);
          
          // Extract the CLS token embedding (first token in sequence)
          // For [1, 512, 384], we want the first 384 values (CLS token)
          embeddingArray = rawData.slice(0, hiddenDim);
          console.log(`📊 Extracted CLS token embedding length: ${embeddingArray.length}`);
          
          // Alternative: Use mean pooling across sequence length
          // This averages the embeddings across all tokens
          if (seqLength > 1) {
            console.log('🔍 Using mean pooling across sequence...');
            const pooledEmbedding = new Array(hiddenDim).fill(0);
            
            for (let i = 0; i < hiddenDim; i++) {
              let sum = 0;
              for (let j = 0; j < seqLength; j++) {
                const index = j * hiddenDim + i;
                sum += rawData[index];
              }
              pooledEmbedding[i] = sum / seqLength;
            }
            
            embeddingArray = pooledEmbedding;
            console.log(`📊 Mean pooled embedding length: ${embeddingArray.length}`);
          }
          
        } else if (embeddings.dims.length === 2) {
          // 2D tensor: [batch_size, hidden_dim] - already the right shape
          console.log('🔍 Processing 2D tensor output...');
          embeddingArray = Array.from(embeddings.data as Float32Array);
          console.log(`📊 2D tensor embedding length: ${embeddingArray.length}`);
          
        } else {
          // 1D tensor or other shape - flatten and use
          console.log('🔍 Processing 1D tensor output...');
          embeddingArray = Array.from(embeddings.data as Float32Array);
          console.log(`📊 1D tensor embedding length: ${embeddingArray.length}`);
        }
        
        console.log(`📊 Final embedding array length: ${embeddingArray.length}`);

        // Normalize to unit vector
        const magnitude = Math.sqrt(embeddingArray.reduce((sum, val) => sum + val * val, 0));
        const normalizedEmbedding = embeddingArray.map(val => val / magnitude);
        console.log(`📏 Normalized embedding dimension: ${normalizedEmbedding.length}`);
        console.log(`📊 Embedding magnitude: ${magnitude.toFixed(6)}`);
        console.log(`📊 First 5 values: [${normalizedEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
        
        console.log('✅ ONNX model embedding generation successful');
        return normalizedEmbedding;

      } catch (error) {
        console.error('❌ Error generating embedding with ONNX model:', error);
        console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('❌ REFUSING to fall back to hash embeddings');
        throw new Error(`ONNX embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.error('❌ ONNX model not loaded - REFUSING to generate hash embeddings');
      console.log(`🔧 Model loaded: ${this.isModelLoaded}`);
      console.log(`🔧 Model available: ${!!this.model}`);
      console.log(`🔧 Tokenizer available: ${!!this.tokenizer}`);
      
      // Additional debugging for model loading issues
      if (!this.isModelLoaded) {
        console.error('🔍 Model loading failed. Checking settings...');
        console.error(`  - Model type: ${this.settings.getSentenceTransformerModel()}`);
        console.error(`  - Model path: ${this.settings.getSentenceTransformerPath()}`);
        console.error(`  - Model name: ${this.settings.getSentenceTransformerName()}`);
      }
      
      throw new Error('ONNX model not available and hash embeddings are disabled. Please ensure the sentence transformer model is properly loaded.');
    }
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
    return this.isModelLoaded; // Only ready if ONNX model is loaded
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