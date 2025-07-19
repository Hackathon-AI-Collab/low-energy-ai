import * as FileSystem from 'expo-file-system';
import { ModelSettingsService } from './modelSettings';

export interface ModelDownloadOptions {
  modelName: string;
  modelType: 'sentence-transformer' | 'llm' | 'tokenizer';
  url: string;
  fileName: string;
  expectedSize?: number;
  onProgress?: (progress: number) => void;
  onComplete?: (filePath: string) => void;
  onError?: (error: Error) => void;
}

export interface DownloadProgress {
  modelName: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  status: 'downloading' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

export class ModelDownloadService {
  private static instance: ModelDownloadService;
  private settings: ModelSettingsService;
  private downloads: Map<string, DownloadProgress> = new Map();
  private downloadDirectory: string;

  private constructor() {
    this.settings = ModelSettingsService.getInstance();
    this.downloadDirectory = `${FileSystem.documentDirectory}models/`;
  }

  static getInstance(): ModelDownloadService {
    if (!ModelDownloadService.instance) {
      ModelDownloadService.instance = new ModelDownloadService();
    }
    return ModelDownloadService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Create models directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.downloadDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.downloadDirectory, { intermediates: true });
        console.log('Created models directory:', this.downloadDirectory);
      }
    } catch (error) {
      console.error('Failed to initialize model download service:', error);
    }
  }

  async downloadModel(options: ModelDownloadOptions): Promise<string> {
    const { modelName, url, fileName, onProgress, onComplete, onError } = options;
    
    // Check if model already exists
    const filePath = `${this.downloadDirectory}${fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    
    if (fileInfo.exists) {
      console.log(`Model ${modelName} already exists at ${filePath}`);
      onComplete?.(filePath);
      return filePath;
    }

    // Initialize download progress
    const downloadId = `${modelName}-${Date.now()}`;
    this.downloads.set(downloadId, {
      modelName,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      status: 'downloading'
    });

    try {
      console.log(`Starting download of ${modelName} from ${url}`);
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        filePath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const downloadInfo = this.downloads.get(downloadId);
          
          if (downloadInfo) {
            downloadInfo.progress = progress;
            downloadInfo.downloadedBytes = downloadProgress.totalBytesWritten;
            downloadInfo.totalBytes = downloadProgress.totalBytesExpectedToWrite;
          }
          
          onProgress?.(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      const uri = result?.uri || filePath;
      
      // Update download status
      const downloadInfo = this.downloads.get(downloadId);
      if (downloadInfo) {
        downloadInfo.status = 'completed';
        downloadInfo.progress = 1;
      }

      console.log(`Successfully downloaded ${modelName} to ${uri}`);
      onComplete?.(uri);
      
      // Update settings with the downloaded model path
      this.updateModelSettings(modelName, uri);
      
      // Notify that settings have changed (for reinitialization)
      this.notifySettingsChanged(modelName);
      
      return uri;
      
    } catch (error) {
      console.error(`Failed to download ${modelName}:`, error);
      
      // Update download status
      const downloadInfo = this.downloads.get(downloadId);
      if (downloadInfo) {
        downloadInfo.status = 'error';
        downloadInfo.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      onError?.(error instanceof Error ? error : new Error('Download failed'));
      throw error;
    } finally {
      // Clean up download info after a delay
      setTimeout(() => {
        this.downloads.delete(downloadId);
      }, 5000);
    }
  }

  private updateModelSettings(modelName: string, filePath: string): void {
    try {
      if (modelName.includes('sentence-transformer') || modelName.includes('all-MiniLM')) {
        this.settings.setSentenceTransformerPath(filePath);
        this.settings.setSentenceTransformerModel('local');
        console.log(`Updated sentence transformer settings: ${filePath}`);
      } else if (modelName.includes('llm') || modelName.includes('phi') || modelName.includes('llama')) {
        this.settings.setLLMModelPath(filePath);
        this.settings.setLLMModelType('onnx');
        console.log(`Updated LLM settings: ${filePath}`);
      }
    } catch (error) {
      console.error('Failed to update model settings:', error);
    }
  }

  private notifySettingsChanged(modelName: string): void {
    // This method can be used to notify other services that settings have changed
    // For now, we'll just log it
    console.log(`Settings updated for ${modelName}. Services may need to reinitialize.`);
    
    // If this is a sentence transformer model, we should reinitialize the Voy RAG
    if (modelName.includes('sentence-transformer') || modelName.includes('all-MiniLM')) {
      this.reinitializeVoyRAG();
    }
  }

  private async reinitializeVoyRAG(): Promise<void> {
    try {
      // Import and reinitialize Voy RAG
      const { VoyRAG } = await import('./voyRAG');
      const voyRAG = new VoyRAG();
      await voyRAG.reinitializeSentenceTransformer();
      console.log('Voy RAG sentence transformer reinitialized after model download');
    } catch (error) {
      console.error('Failed to reinitialize Voy RAG:', error);
    }
  }

  async getAvailableModels(): Promise<Array<{ name: string; type: string; url: string; fileName: string; size?: number }>> {
    return [
      {
        name: 'Xenova/all-MiniLM-L6-v2 (Sentence Transformer)',
        type: 'sentence-transformer',
        url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/model.onnx',
        fileName: 'all-MiniLM-L6-v2.onnx',
        size: 90 * 1024 * 1024 // ~90MB
      },
      {
        name: 'Phi-3-mini (LLM)',
        type: 'llm',
        url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct/resolve/main/model.onnx',
        fileName: 'phi-3-mini.onnx',
        size: 1500 * 1024 * 1024 // ~1.5GB
      },
      {
        name: 'Llama-3.1-8B (LLM)',
        type: 'llm',
        url: 'https://huggingface.co/meta-llama/Meta-Llama-3.1-8B/resolve/main/model.onnx',
        fileName: 'llama-3.1-8b.onnx',
        size: 8000 * 1024 * 1024 // ~8GB
      }
    ];
  }

  async getDownloadProgress(modelName: string): Promise<DownloadProgress | null> {
    for (const [_, download] of this.downloads) {
      if (download.modelName === modelName) {
        return download;
      }
    }
    return null;
  }

  async getAllDownloads(): Promise<DownloadProgress[]> {
    return Array.from(this.downloads.values());
  }

  async cancelDownload(modelName: string): Promise<void> {
    for (const [downloadId, download] of this.downloads) {
      if (download.modelName === modelName && download.status === 'downloading') {
        download.status = 'cancelled';
        console.log(`Cancelled download of ${modelName}`);
        break;
      }
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

  async getDownloadedModels(): Promise<string[]> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.downloadDirectory);
      return files.filter(file => file.endsWith('.onnx'));
    } catch (error) {
      console.error('Failed to get downloaded models:', error);
      return [];
    }
  }

  async getModelInfo(fileName: string): Promise<{ size: number; lastModified: Date } | null> {
    try {
      const filePath = `${this.downloadDirectory}${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists) {
        return {
          size: fileInfo.size || 0,
          lastModified: new Date(fileInfo.modificationTime || Date.now())
        };
      }
      return null;
    } catch (error) {
      console.error(`Failed to get model info for ${fileName}:`, error);
      return null;
    }
  }
} 