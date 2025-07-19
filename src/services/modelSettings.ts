export interface ModelSettings {
  // LLM Model Settings
  llmModelPath?: string;
  llmModelType: 'onnx' | 'fallback';
  llmModelName?: string;
  
  // Sentence Transformer Settings
  sentenceTransformerPath?: string;
  sentenceTransformerModel: 'xenova' | 'local' | 'hash';
  sentenceTransformerName?: string;
  sentenceTransformerDimension: number;
  
  // Similarity Calculation Settings
  similarityMethod: 'cos_sim' | 'manual' | 'auto';
  
  // Performance Settings
  useCache: boolean;
  cacheSize: number;
  batchSize: number;
  
  // Advanced Settings
  allowRemoteModels: boolean;
  allowLocalModels: boolean;
  useBrowserCache: boolean;
}

export class ModelSettingsService {
  private static instance: ModelSettingsService;
  private settings: ModelSettings;
  private storageKey = 'leai_model_settings';

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.loadSettings();
  }

  static getInstance(): ModelSettingsService {
    if (!ModelSettingsService.instance) {
      ModelSettingsService.instance = new ModelSettingsService();
    }
    return ModelSettingsService.instance;
  }

  private getDefaultSettings(): ModelSettings {
    return {
      // LLM defaults
      llmModelType: 'fallback',
      llmModelName: 'gemma-3n-E2B-it',
      
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
      useBrowserCache: true
    };
  }

  private loadSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.settings = { ...this.getDefaultSettings(), ...parsed };
        }
      }
    } catch (error) {
      console.warn('Failed to load model settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      }
    } catch (error) {
      console.warn('Failed to save model settings:', error);
    }
  }

  getSettings(): ModelSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<ModelSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  // LLM Model Methods
  setLLMModelPath(path: string): void {
    this.settings.llmModelPath = path;
    this.settings.llmModelType = 'onnx';
    this.saveSettings();
  }

  getLLMModelPath(): string | undefined {
    return this.settings.llmModelPath;
  }

  setLLMModelType(type: 'onnx' | 'fallback'): void {
    this.settings.llmModelType = type;
    this.saveSettings();
  }

  getLLMModelType(): 'onnx' | 'fallback' {
    return this.settings.llmModelType;
  }

  // Sentence Transformer Methods
  setSentenceTransformerPath(path: string): void {
    this.settings.sentenceTransformerPath = path;
    this.settings.sentenceTransformerModel = 'local';
    this.saveSettings();
  }

  getSentenceTransformerPath(): string | undefined {
    return this.settings.sentenceTransformerPath;
  }

  setSentenceTransformerModel(model: 'xenova' | 'local' | 'hash'): void {
    this.settings.sentenceTransformerModel = model;
    this.saveSettings();
  }

  getSentenceTransformerModel(): 'xenova' | 'local' | 'hash' {
    return this.settings.sentenceTransformerModel;
  }

  setSentenceTransformerName(name: string): void {
    this.settings.sentenceTransformerName = name;
    this.saveSettings();
  }

  getSentenceTransformerName(): string {
    return this.settings.sentenceTransformerName || 'Xenova/all-MiniLM-L6-v2';
  }

  // Similarity Method
  setSimilarityMethod(method: 'cos_sim' | 'manual' | 'auto'): void {
    this.settings.similarityMethod = method;
    this.saveSettings();
  }

  getSimilarityMethod(): 'cos_sim' | 'manual' | 'auto' {
    return this.settings.similarityMethod;
  }

  // Performance Settings
  setUseCache(useCache: boolean): void {
    this.settings.useCache = useCache;
    this.saveSettings();
  }

  getUseCache(): boolean {
    return this.settings.useCache;
  }

  setCacheSize(size: number): void {
    this.settings.cacheSize = size;
    this.saveSettings();
  }

  getCacheSize(): number {
    return this.settings.cacheSize;
  }

  // Advanced Settings
  setAllowRemoteModels(allow: boolean): void {
    this.settings.allowRemoteModels = allow;
    this.saveSettings();
  }

  getAllowRemoteModels(): boolean {
    return this.settings.allowRemoteModels;
  }

  setAllowLocalModels(allow: boolean): void {
    this.settings.allowLocalModels = allow;
    this.saveSettings();
  }

  getAllowLocalModels(): boolean {
    return this.settings.allowLocalModels;
  }

  // Utility Methods
  isLLMReady(): boolean {
    return this.settings.llmModelType === 'onnx' && !!this.settings.llmModelPath;
  }

  isSentenceTransformerReady(): boolean {
    return this.settings.sentenceTransformerModel !== 'hash';
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
    this.saveSettings();
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(settingsJson: string): boolean {
    try {
      const parsed = JSON.parse(settingsJson);
      this.settings = { ...this.getDefaultSettings(), ...parsed };
      this.saveSettings();
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
} 