import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export interface ModelSettings {
  llmModelName?: string;
  llmModelType: 'gguf' | 'fallback';
  sentenceTransformerName?: string;
  sentenceTransformerModel: 'xenova' | 'local' | 'hash';
  sentenceTransformerDimension: number;
  similarityMethod: 'cos_sim' | 'auto';
  useCache: boolean;
  cacheSize: number;
  batchSize: number;
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
    this.loadSettings().catch(error => console.warn('Failed to load settings:', error));
  }

  static getInstance(): ModelSettingsService {
    if (!ModelSettingsService.instance) {
      ModelSettingsService.instance = new ModelSettingsService();
    }
    return ModelSettingsService.instance;
  }

  addSettingsChangeCallback(callback: SettingsChangeCallback): void {
    this.callbacks.push(callback);
  }

  removeSettingsChangeCallback(callback: SettingsChangeCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) this.callbacks.splice(index, 1);
  }

  private notifySettingsChanged(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.getSettings());
      } catch (error) {
        console.warn('Error in settings change callback:', error);
      }
    });
  }

  private getDefaultSettings(): ModelSettings {
    return {
      llmModelType: 'fallback',
      llmModelName: 'simulated-llm',
      sentenceTransformerModel: 'xenova',
      sentenceTransformerName: 'Xenova/all-MiniLM-L6-v2',
      sentenceTransformerDimension: 384,
      similarityMethod: 'cos_sim',
      useCache: true,
      cacheSize: 1000,
      batchSize: 10,
      allowRemoteModels: true,
      allowLocalModels: true,
      useBrowserCache: false,
    };
  }

  private async loadSettings(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.getDefaultSettings(), ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load model settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.settings));
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
    this.saveSettings();
  }

  setLLMModelPath(path: string): void {
    this.settings.llmModelName = path.split('/').pop();
    this.settings.llmModelType = 'gguf';
    this.saveSettings();
  }

  getLLMModelPath(): string | undefined {
    if (this.settings.llmModelName && this.settings.llmModelType === 'gguf' && this.settings.llmModelName.endsWith('.gguf')) {
      return `${FileSystem.documentDirectory}models/${this.settings.llmModelName}`;
    }
    return undefined;
  }

  setLLMModelType(type: 'gguf' | 'fallback'): void {
    this.settings.llmModelType = type;
    this.saveSettings();
  }

  getLLMModelType(): 'gguf' | 'fallback' {
    return this.settings.llmModelType;
  }

  setSentenceTransformerPath(path: string): void {
    this.settings.sentenceTransformerName = path.split('/').pop();
    this.settings.sentenceTransformerModel = 'local';
    this.saveSettings();
  }

  getSentenceTransformerPath(): string | undefined {
    if (this.settings.sentenceTransformerName && this.settings.sentenceTransformerModel === 'local' && this.settings.sentenceTransformerName.endsWith('.onnx')) {
      return `${FileSystem.documentDirectory}models/${this.settings.sentenceTransformerName}`;
    }
    return undefined;
  }

  setSentenceTransformerModel(model: 'xenova' | 'local' | 'hash'): void {
    this.settings.sentenceTransformerModel = model;
    this.saveSettings();
  }

  getSentenceTransformerModel(): 'xenova' | 'local' | 'hash' {
    return this.settings.sentenceTransformerModel;
  }

  async getAvailableModels(): Promise<{ llm: string[], sentenceTransformer: string[] }> {
    try {
      const modelDownloadService = (await import('./modelDownloadService')).ModelDownloadService.getInstance();
      const downloadedModels = await modelDownloadService.getDownloadedModels();
      
      const llmModels = downloadedModels.filter(model => model.endsWith('.gguf'));
      const sentenceTransformerModels = downloadedModels.filter(model => model.endsWith('.onnx'));
      
      return { llm: llmModels, sentenceTransformer: sentenceTransformerModels };
    } catch (error) {
      console.warn('Failed to get available models:', error);
      return { llm: [], sentenceTransformer: [] };
    }
  }

  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
  }
}