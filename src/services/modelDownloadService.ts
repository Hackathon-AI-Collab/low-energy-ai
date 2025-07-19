import * as FileSystem from 'expo-file-system';
import { ModelSettingsService } from './modelSettings';

export interface DownloadProgressData {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

export interface ModelDownloadOptions {
  modelName: string;
  modelType: 'sentence-transformer' | 'llm';
  url: string;
  fileName: string;
  onProgress?: (progress: DownloadProgressData) => void;
  onComplete?: (filePath: string) => void;
  onError?: (error: Error) => void;
}

export class ModelDownloadService {
  private static instance: ModelDownloadService;
  private settings: ModelSettingsService;
  private downloadDirectory: string;

  private constructor() {
    this.settings = ModelSettingsService.getInstance();
    this.downloadDirectory = `${FileSystem.documentDirectory}models/`;
    this.initialize();
  }

  static getInstance(): ModelDownloadService {
    if (!ModelDownloadService.instance) {
      ModelDownloadService.instance = new ModelDownloadService();
    }
    return ModelDownloadService.instance;
  }

  async initialize(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.downloadDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.downloadDirectory, { intermediates: true });
    }
  }

  async downloadModel(options: ModelDownloadOptions): Promise<string> {
    const { modelName, url, fileName, onProgress, onComplete, onError } = options;
    const filePath = `${this.downloadDirectory}${fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (fileInfo.exists) {
      console.log(`Model ${modelName} already exists.`);
      this.updateModelSettings(options.modelType, filePath);
      onComplete?.(filePath);
      return filePath;
    }

    try {
      console.log(`Starting download of ${modelName} from ${url}`);
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        filePath,
        {},
        (downloadProgress) => {
          const percentage = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite * 100).toFixed(1);
          console.log(`[${modelName}] Progress: ${downloadProgress.totalBytesWritten} / ${downloadProgress.totalBytesExpectedToWrite} (${percentage}%)`);
          onProgress?.(downloadProgress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      const uri = result?.uri || filePath;
      
      console.log(`Successfully downloaded ${modelName} to ${uri}`);
      this.updateModelSettings(options.modelType, uri);
      onComplete?.(uri);
      return uri;
      
    } catch (error) {
      console.error(`Failed to download ${modelName}:`, error);
      onError?.(error instanceof Error ? error : new Error('Download failed'));
      throw error;
    }
  }

  private updateModelSettings(modelType: 'llm' | 'sentence-transformer', filePath: string): void {
    if (modelType === 'sentence-transformer') {
      this.settings.setSentenceTransformerPath(filePath);
      this.settings.setSentenceTransformerModel('local');
    } else if (modelType === 'llm') {
      this.settings.setLLMModelPath(filePath);
      this.settings.setLLMModelType('gguf');
    }
  }

  async getAvailableModels(): Promise<Array<{ name: string; type: 'llm' | 'sentence-transformer'; url: string; fileName: string; size?: number }>> {
    return [
      {
        name: 'Xenova/all-MiniLM-L6-v2 (ONNX)',
        type: 'sentence-transformer',
        url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
        fileName: 'all-MiniLM-L6-v2.onnx',
        size: 90 * 1024 * 1024,
      },
      {
        name: 'Phi-3-mini-4k-instruct (GGUF Q4)',
        type: 'llm',
        url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
        fileName: 'Phi-3-mini-4k-instruct-q4.gguf',
        size: 2.2 * 1024 * 1024 * 1024,
      },
      {
        name: 'Gemma 3B-IT (GGUF Q2_K)',
        type: 'llm',
        url: 'https://huggingface.co/mradermacher/gemma-3n-E2B-GGUF/resolve/main/gemma-3n-E2B.Q2_K.gguf',
        fileName: 'gemma-3n-E2B.Q2_K.gguf',
        size: 1.89 * 1024 * 1024 * 1024,
      }
    ];
  }

  async getDownloadedModels(): Promise<string[]> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.downloadDirectory);
      return files.map(file => `${this.downloadDirectory}${file}`);
    } catch (error) {
      return [];
    }
  }

  async deleteModel(fileName: string): Promise<void> {
    const filePath = `${this.downloadDirectory}${fileName}`;
    try {
      await FileSystem.deleteAsync(filePath);
      console.log(`Deleted model: ${fileName}`);
    } catch (error) {
      console.error(`Failed to delete model ${fileName}:`, error);
      throw error;
    }
  }
}
