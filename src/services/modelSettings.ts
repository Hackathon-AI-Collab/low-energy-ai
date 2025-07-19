
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ModelSettings {
  // LLM Model Settings
  llmModelPath?: string;
  llmModelType: 'gguf' | 'fallback'; // Removed 'onnx' - only GGUF supported for LLM
  llmModelName?: string;
  
  // Sentence Transformer Settings
  sentenceTransformerPath?: string;
  sentenceTransformerModel: 'xenova' | 'local' | 'hash';
  sentenceTransformerName?: string;
  sentenceTransformerDimension: number;
  
  // Similarity Calculation Settings
  similarityMethod: 'cos_sim' | 'auto';
  
  // Performance Settings
  useCache: boolean;
  cacheSize: number;
  batchSize: number;
  
  // Advanced Settings
  allowRemoteModels: boolean;
  allowLocalModels: boolean;
  useBrowserCache: boolean;
}

type SettingsChangeCallback = (settings: ModelSettings) => void;

export class ModelSettingsService {
  private static instance: ModelSettingsService;
  private settings: ModelSettings;
  private storageKey = 'leai_model_settings';
  private callbacks: SettingsChangeCallback[] = [];

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.loadSettings().catch(error => {
      console.warn('Failed to load settings in constructor:', error);
    });
  }

  static getInstance(): ModelSettingsService {
    if (!ModelSettingsService.instance) {
      ModelSettingsService.instance = new ModelSettingsService();
    }
    return ModelSettingsService.instance;
  }

  // Add callback for settings changes
  addSettingsChangeCallback(callback: SettingsChangeCallback): void {
    this.callbacks.push(callback);
  }

  // Remove callback
  removeSettingsChangeCallback(callback: SettingsChangeCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  // Notify all callbacks of settings change
  private notifySettingsChanged(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.settings);
      } catch (error) {
        console.warn('Error in settings change callback:', error);
      }
    });
  }

  private getDefaultSettings(): ModelSettings {
    return {
      // LLM defaults - Use GGUF mode for llama.rn integration (no ONNX support)
      llmModelType: 'gguf',
      llmModelName: 'simulated-llm',
      llmModelPath: undefined, // Don't set a path to avoid loading non-existent files
      
      // Sentence Transformer defaults - Use Xenova by default
      sentenceTransformerModel: 'xenova',
      sentenceTransformerName: 'Xenova/all-MiniLM-L6-v2',
      sentenceTransformerDimension: 384,
      
      // Similarity calculation - Use cos_sim by default
      similarityMethod: 'cos_sim',
      
      // Performance
      useCache: true,
      cacheSize: 1000,
      batchSize: 10,
      
      // Advanced
      allowRemoteModels: true,
      allowLocalModels: true,
      useBrowserCache: false // Disabled for React Native compatibility
    };
  }

  private async loadSettings(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.getDefaultSettings(), ...parsed };
        console.log('Loaded model settings:', this.settings);
      }
    } catch (error) {
      console.warn('Failed to load model settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      console.log('Saved model settings:', this.settings);
      this.notifySettingsChanged();
    } catch (error) {
      console.warn('Failed to save model settings:', error);
    }
  }

  getSettings(): ModelSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<ModelSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings().catch(error => {
      console.warn('Failed to save settings:', error);
    });
  }

  // LLM Model Methods
  setLLMModelPath(path: string): void {
    console.log('Setting LLM model path:', path);
    
    // Fix duplicate path issue
    let cleanPath = path;
    if (path.includes('file:///data/user/0/com.anonymous.leaiplatform/files/models/file:///data/user/0/com.anonymous.leaiplatform/files/models/')) {
      cleanPath = path.replace('file:///data/user/0/com.anonymous.leaiplatform/files/models/file:///data/user/0/com.anonymous.leaiplatform/files/models/', 'file:///data/user/0/com.anonymous.leaiplatform/files/models/');
      console.log('ModelSettings: Fixed duplicate path:', cleanPath);
    }
    
    this.settings.llmModelPath = cleanPath;
    
    // Determine model type based on file extension
    console.log('ModelSettings: Checking model type for path:', cleanPath);
    console.log('ModelSettings: Path includes .gguf:', cleanPath.includes('.gguf'));
    
    if (cleanPath.includes('.gguf')) {
      this.settings.llmModelType = 'gguf';
      console.log('ModelSettings: Detected GGUF model, setting type to gguf');
    } else {
      this.settings.llmModelType = 'gguf'; // Default to GGUF for llama.rn (no ONNX support)
      console.log('ModelSettings: No .gguf extension detected, defaulting to gguf');
    }
    
    console.log('ModelSettings: Final model type set to:', this.settings.llmModelType);
    
    this.saveSettings().catch(error => {
      console.warn('Failed to save LLM model path:', error);
    });
  }

  getLLMModelPath(): string | undefined {
    return this.settings.llmModelPath;
  }

  setLLMModelType(type: 'gguf' | 'fallback'): void {
    console.log('Setting LLM model type:', type);
    this.settings.llmModelType = type;
    this.saveSettings().catch(error => {
      console.warn('Failed to save LLM model type:', error);
    });
  }

  getLLMModelType(): 'gguf' | 'fallback' {
    return this.settings.llmModelType;
  }

  // Sentence Transformer Methods
  setSentenceTransformerPath(path: string): void {
    this.settings.sentenceTransformerPath = path;
    this.settings.sentenceTransformerModel = 'local';
    this.saveSettings().catch(error => {
      console.warn('Failed to save sentence transformer path:', error);
    });
  }

  getSentenceTransformerPath(): string | undefined {
    return this.settings.sentenceTransformerPath;
  }

  setSentenceTransformerModel(model: 'xenova' | 'local' | 'hash'): void {
    this.settings.sentenceTransformerModel = model;
    this.saveSettings().catch(error => {
      console.warn('Failed to save sentence transformer model:', error);
    });
  }

  getSentenceTransformerModel(): 'xenova' | 'local' | 'hash' {
    return this.settings.sentenceTransformerModel;
  }

  setSentenceTransformerName(name: string): void {
    this.settings.sentenceTransformerName = name;
    this.saveSettings().catch(error => {
      console.warn('Failed to save sentence transformer name:', error);
    });
  }

  getSentenceTransformerName(): string {
    return this.settings.sentenceTransformerName || 'Xenova/all-MiniLM-L6-v2';
  }

  // Similarity Method
  setSimilarityMethod(method: 'cos_sim' | 'auto'): void {
    this.settings.similarityMethod = method;
    this.saveSettings().catch(error => {
      console.warn('Failed to save similarity method:', error);
    });
  }

  getSimilarityMethod(): 'cos_sim' | 'auto' {
    return this.settings.similarityMethod;
  }

  // Performance Settings
  setUseCache(useCache: boolean): void {
    this.settings.useCache = useCache;
    this.saveSettings().catch(error => {
      console.warn('Failed to save use cache setting:', error);
    });
  }

  getUseCache(): boolean {
    return this.settings.useCache;
  }

  setCacheSize(size: number): void {
    this.settings.cacheSize = size;
    this.saveSettings().catch(error => {
      console.warn('Failed to save cache size:', error);
    });
  }

  getCacheSize(): number {
    return this.settings.cacheSize;
  }

  // Advanced Settings
  setAllowRemoteModels(allow: boolean): void {
    this.settings.allowRemoteModels = allow;
    this.saveSettings().catch(error => {
      console.warn('Failed to save allow remote models setting:', error);
    });
  }

  getAllowRemoteModels(): boolean {
    return this.settings.allowRemoteModels;
  }

  setAllowLocalModels(allow: boolean): void {
    this.settings.allowLocalModels = allow;
    this.saveSettings().catch(error => {
      console.warn('Failed to save allow local models setting:', error);
    });
  }

  getAllowLocalModels(): boolean {
    return this.settings.allowLocalModels;
  }

  // Method to get available downloaded models
  async getAvailableModels(): Promise<{ llm: string[], sentenceTransformer: string[] }> {
    try {
      const modelDownloadService = (await import('./modelDownloadService')).ModelDownloadService.getInstance();
      const downloadedModels = await modelDownloadService.getDownloadedModels();
      
      console.log('ModelSettings: All downloaded models:', downloadedModels);
      
      const llmModels = downloadedModels.filter(model => 
        model.includes('phi') || model.includes('llama') || model.includes('llm') || model.includes('gguf') || model.includes('gemma')
      );
      
      const sentenceTransformerModels = downloadedModels.filter(model => 
        model.includes('all-MiniLM') || model.includes('sentence')
      );
      
      console.log('ModelSettings: Detected LLM models:', llmModels);
      console.log('ModelSettings: Detected sentence transformer models:', sentenceTransformerModels);
      
      return { llm: llmModels, sentenceTransformer: sentenceTransformerModels };
    } catch (error) {
      console.warn('Failed to get available models:', error);
      return { llm: [], sentenceTransformer: [] };
    }
  }

  // Utility Methods
  isLLMReady(): boolean {
    const ready = this.settings.llmModelType === 'gguf' && !!this.settings.llmModelPath;
    console.log('ModelSettings: isLLMReady check:', {
      modelType: this.settings.llmModelType,
      modelPath: this.settings.llmModelPath,
      ready: ready
    });
    return ready;
  }

  isSentenceTransformerReady(): boolean {
    return this.settings.sentenceTransformerModel === 'local' && !!this.settings.sentenceTransformerPath;
  }

  getModelInfo(): {
    llm: { type: string; path?: string; ready: boolean };
    sentenceTransformer: { type: string; path?: string; ready: boolean };
    similarity: string;
  } {
    return {
      llm: {
        type: this.settings.llmModelType,
        path: this.settings.llmModelPath,
        ready: this.isLLMReady()
      },
      sentenceTransformer: {
        type: this.settings.sentenceTransformerModel,
        path: this.settings.sentenceTransformerPath,
        ready: this.isSentenceTransformerReady()
      },
      similarity: this.settings.similarityMethod
    };
  }

  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings().catch(error => {
      console.warn('Failed to reset settings:', error);
    });
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(settingsJson: string): boolean {
    try {
      const parsed = JSON.parse(settingsJson);
      this.settings = { ...this.getDefaultSettings(), ...parsed };
      this.saveSettings().catch(error => {
        console.warn('Failed to import settings:', error);
      });
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
} 