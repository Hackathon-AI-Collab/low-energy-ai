import { Platform } from 'react-native';
import { ModelSettingsService } from './modelSettings';

// llama.rn will be imported conditionally when needed
let LlamaContext: any = null;
let initLlama: any = null;
let llamaRnLoaded = false;

async function loadLlamaRn() {
  if (llamaRnLoaded) return;
  
  try {
    console.log('LLM Service: Attempting to import llama.rn...');
    
    // Try dynamic import first
    try {
      const llamaRn = await import('llama.rn');
      console.log('LLM Service: Dynamic import successful');
      console.log('LLM Service: Module structure:', Object.keys(llamaRn));
      
      if (llamaRn.LlamaContext) {
        LlamaContext = llamaRn.LlamaContext;
        console.log('LLM Service: LlamaContext loaded successfully');
      } else {
        console.warn('LLM Service: LlamaContext not found in exports');
      }
      if (llamaRn.initLlama) {
        initLlama = llamaRn.initLlama;
        console.log('LLM Service: initLlama loaded successfully');
      } else {
        console.warn('LLM Service: initLlama not found in exports');
      }
    } catch (dynamicError) {
      console.log('LLM Service: Dynamic import failed, trying require...');
      
      // Fallback to require
      const llamaRn = require('llama.rn');
      console.log('LLM Service: Require import successful');
      console.log('LLM Service: Module structure:', Object.keys(llamaRn));
      
      if (llamaRn.LlamaContext) {
        LlamaContext = llamaRn.LlamaContext;
        console.log('LLM Service: LlamaContext loaded successfully');
      } else {
        console.warn('LLM Service: LlamaContext not found in exports');
      }
      if (llamaRn.initLlama) {
        initLlama = llamaRn.initLlama;
        console.log('LLM Service: initLlama loaded successfully');
      } else {
        console.warn('LLM Service: initLlama not found in exports');
      }
    }
    
    console.log('LLM Service: llama.rn imported successfully');
    console.log('LLM Service: LlamaContext available:', !!LlamaContext);
    console.log('LLM Service: initLlama available:', !!initLlama);
    
    llamaRnLoaded = true;
  } catch (error) {
    console.warn('LLM Service: llama.rn not available:', error);
    if (error instanceof Error) {
      console.warn('LLM Service: Error details:', error.message);
      console.warn('LLM Service: Error stack:', error.stack);
    }
    // llama.rn will be null, and we'll use simulated mode
  }
}

export interface LLMResponse {
  text: string;
  confidence: number;
  modelUsed: 'llama.rn' | 'simulated' | 'fallback';
  processingTime: number;
  tokensGenerated: number;
}

export interface LLMConfig {
  maxNewTokens: number;
  temperature: number;
  topP: number;
}

export class LLMService {
  private llamaContext: any = null;
  private isModelLoaded: boolean = false;
  private modelPath: string | null = null;
  private settings: ModelSettingsService;
  private config: LLMConfig;
  private settingsCallback: (settings: any) => void;

  constructor() {
    this.settings = ModelSettingsService.getInstance();
    this.config = {
      maxNewTokens: 128,
      temperature: 0.7,
      topP: 0.9,
    };
    this.settingsCallback = this.handleSettingsChange.bind(this);
    this.settings.addSettingsChangeCallback(this.settingsCallback);
  }

  private handleSettingsChange(settings: any): void {
    const newModelPath = settings.llmModelPath;
    const newModelType = settings.llmModelType;

    if (newModelPath !== this.modelPath || newModelType === 'gguf') {
      console.log('LLM Service: Model path or type changed, reinitializing...');
      this.reinitialize().catch(error => {
        console.error('LLM Service: Failed to reinitialize after settings change:', error);
      });
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing LLM Service with llama.rn...');
      const modelPath = this.settings.getLLMModelPath();
      const modelType = this.settings.getLLMModelType();

      if (modelType === 'gguf' && modelPath) {
        await this.loadLlamaModel(modelPath);
      } else {
        console.log('No GGUF model configured, using simulated mode.');
        this.isModelLoaded = false;
      }
    } catch (error) {
      console.error('Failed to initialize LLM Service:', error);
      this.isModelLoaded = false;
    }
  }

  private async loadLlamaModel(modelPath: string): Promise<void> {
    try {
      // First try to load llama.rn
      await loadLlamaRn();
      
      if (!initLlama) {
        throw new Error('llama.rn module not available - requires development build');
      }

      const { getInfoAsync } = await import('expo-file-system');
      const fileInfo = await getInfoAsync(modelPath);
      if (!fileInfo.exists) {
        throw new Error(`Model file does not exist at path: ${modelPath}`);
      }

      const formattedPath = Platform.OS === 'android' && modelPath.startsWith('file://') 
        ? modelPath.substring(7) 
        : modelPath;

      this.llamaContext = await initLlama({
        model: formattedPath,
        n_ctx: 2048,
      });
      
      this.modelPath = modelPath;
      this.isModelLoaded = true;
      console.log('✅ LLM Service: REAL GGUF model loaded successfully via llama.rn.');
      
      // Log available methods on the context
      console.log('LLM Service: Context methods:', Object.getOwnPropertyNames(this.llamaContext));
      console.log('LLM Service: Context prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.llamaContext)));

    } catch (error) {
      console.warn('⚠️ LLM Service: Failed to load REAL GGUF model. This is expected if the native module is not linked (i.e., you need to create a new development build).');
      console.log('LLM Service: Full error details:', error);
      this.isModelLoaded = false;
      console.warn('LLM Service: Switched to simulated mode due to loading error.');
    }
  }

  async generateResponse(prompt: string, context?: string): Promise<LLMResponse> {
    console.log("--- Starting LLM Response Generation ---");
    if (!this.isModelLoaded || !this.llamaContext) {
      console.log(">> Entering SIMULATED mode: Model not loaded or context not available.");
      return this.generateSimulatedResponse(prompt);
    }
    
    console.log(">> Entering REAL GGUF mode (llama.rn).");
    return this.generateLlamaResponse(prompt, context);
  }

  private async generateLlamaResponse(prompt: string, context?: string): Promise<LLMResponse> {
    const startTime = Date.now();
    if (!this.llamaContext) {
      return this.generateFallbackResponse(prompt, "Llama context is not available.");
    }

    try {
      const fullPrompt = this.constructPrompt(prompt, context);

      // Ensure prompt is a valid string and all parameters are properly typed
      if (!fullPrompt || typeof fullPrompt !== 'string') {
        throw new Error('Invalid prompt: must be a non-empty string');
      }

      console.log('LLM Service: Attempting completion with prompt length:', fullPrompt.length);
      console.log('LLM Service: Prompt preview:', fullPrompt.substring(0, 100) + '...');

      const params = {
        prompt: fullPrompt,
        n_predict: this.config.maxNewTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
      };

      console.log('LLM Service: Calling completion with params:', JSON.stringify(params));
      const result = await this.llamaContext.completion(params);
      console.log('LLM Service: Full response from model:', JSON.stringify(result, null, 2));

      const generatedText = result.text.trim();
      const processingTime = Date.now() - startTime;

      console.log(`✅ GGUF Result: "${generatedText.substring(0, 50)}..." (${processingTime}ms)`);

      return {
        text: generatedText,
        confidence: 0.95,
        modelUsed: 'llama.rn',
        processingTime,
        tokensGenerated: result.tokens_predicted,
      };

    } catch (error) {
      console.error('🚨 REAL GGUF (llama.rn) inference failed:', error);
      return this.generateFallbackResponse(prompt, "I encountered an error trying to use the AI model.");
    }
  }

  private constructPrompt(prompt: string, context?: string): string {
    // Simplify the prompt to avoid potential issues
    if (context) {
      return `Context: ${context}\n\nQuestion: ${prompt}\n\nAnswer:`;
    } else {
      return `${prompt}\n\nAnswer:`;
    }
  }

  private generateSimulatedResponse(prompt: string, context?: string): Promise<LLMResponse> {
    const startTime = Date.now();
    const response = this.generateContextualResponse(prompt, context);
    const processingTime = Date.now() - startTime;

    console.log(`🟡 SIMULATED Result: "${response.substring(0, 50)}..." (${processingTime}ms)`);

    return Promise.resolve({
      text: `[Simulated] ${response}`,
      confidence: 0.8,
      modelUsed: 'simulated',
      processingTime,
      tokensGenerated: response.split(' ').length,
    });
  }

  private generateFallbackResponse(prompt: string, context?: string): Promise<LLMResponse> {
    const startTime = Date.now();
    const response = this.generateContextualResponse(prompt, context);
    const processingTime = Date.now() - startTime;

    console.log(`🔴 FALLBACK Result: "${response.substring(0, 50)}..." (${processingTime}ms)`);

    return Promise.resolve({
      text: `[Fallback] ${response}`,
      confidence: 0.7,
      modelUsed: 'fallback',
      processingTime,
      tokensGenerated: response.split(' ').length,
    });
  }

  private generateContextualResponse(prompt: string, context?: string): string {
    const lowerPrompt = prompt.toLowerCase();
    if (context) {
      return `Based on the provided context, the answer regarding "${prompt.substring(0, 20)}..." is likely related to the information found in the retrieved documents.`;
    }
    if (lowerPrompt.includes('medical') || lowerPrompt.includes('tccc')) {
      return 'The MARCH algorithm is the standard for tactical combat casualty care.';
    }
    return `I understand you're asking about: "${prompt}". I can help with medical, search & rescue, and technical info.`;
  }

  async reinitialize(): Promise<void> {
    if (this.llamaContext) {
      try {
        await this.llamaContext.free();
      } catch (error) {
        console.warn('Error freeing llama context:', error);
      }
    }
    this.llamaContext = null;
    this.isModelLoaded = false;
    await this.initialize();
  }

  isModelReady(): boolean {
    return this.isModelLoaded && this.llamaContext !== null;
  }

  getModelInfo() {
    return {
      type: 'llama.rn',
      path: this.modelPath,
      loaded: this.isModelLoaded,
    };
  }

  destroy(): void {
    if (this.llamaContext) {
      try {
        this.llamaContext.free();
      } catch (error) {
        console.warn('Error freeing llama context:', error);
      }
    }
    this.llamaContext = null;
    this.isModelLoaded = false;
    this.settings.removeSettingsChangeCallback(this.settingsCallback);
  }
}