import { ModelDownloadService } from './modelDownloadService';
import { ModelSettingsService } from './modelSettings';
import * as FileSystem from 'expo-file-system';

export interface ModelStatus {
  isInitialized: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  error?: string;
}

export class ModelInitializationService {
  private static instance: ModelInitializationService;
  private settings: ModelSettingsService;
  private downloadService: ModelDownloadService;
  private status: ModelStatus = {
    isInitialized: false,
    isDownloading: false,
    downloadProgress: 0
  };
  private initializationPromise: Promise<boolean> | null = null;

  private constructor() {
    this.settings = ModelSettingsService.getInstance();
    this.downloadService = ModelDownloadService.getInstance();
  }

  static getInstance(): ModelInitializationService {
    if (!ModelInitializationService.instance) {
      ModelInitializationService.instance = new ModelInitializationService();
    }
    return ModelInitializationService.instance;
  }

  getStatus(): ModelStatus {
    return { ...this.status };
  }

  async ensureModelReady(): Promise<boolean> {
    // If already initialized, return immediately
    if (this.status.isInitialized) {
      return true;
    }

    // If already initializing, wait for that process
    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    // Start initialization process
    this.initializationPromise = this.initializeModel();
    return await this.initializationPromise;
  }

  private async initializeModel(): Promise<boolean> {
    try {
      console.log('🚀 ModelInitializationService: Starting model initialization...');
      
      const modelPath = this.settings.getSentenceTransformerPath();
      console.log(`📍 Checking model at path: ${modelPath}`);

      // Check if we need to download the model
      let needsDownload = false;
      if (typeof modelPath !== 'string' || !modelPath) {
        console.log('❌ No model path set or invalid path - model needs to be downloaded');
        needsDownload = true;
      } else {
        try {
          const fileInfo = await FileSystem.getInfoAsync(modelPath);
          if (!fileInfo.exists) {
            console.log('❌ Model file does not exist - model needs to be downloaded');
            needsDownload = true;
          } else {
            console.log('✅ Model file exists, checking size...');
            console.log(`📏 Model file size: ${fileInfo.size} bytes`);
            
            // Check if file size is reasonable (ONNX model should be ~90MB)
            if (!fileInfo.size || fileInfo.size < 10 * 1024 * 1024) {
              console.log('❌ Model file is too small - probably corrupted');
              needsDownload = true;
            }
          }
        } catch (error) {
          console.error('❌ Error checking model file:', error);
          needsDownload = true;
        }
      }

      // Download model if needed
      if (needsDownload) {
        console.log('📥 Starting model download...');
        this.status.isDownloading = true;
        this.status.downloadProgress = 0;

        try {
          const downloadedPath = await this.downloadService.downloadModel({
            modelName: 'Xenova/all-MiniLM-L6-v2 (ONNX)',
            modelType: 'sentence-transformer',
            url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
            fileName: 'all-MiniLM-L6-v2.onnx',
            onProgress: (progress) => {
              this.status.downloadProgress = Math.round(
                (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
              );
              console.log(`📥 Model download progress: ${this.status.downloadProgress}%`);
            }
          });

          console.log(`✅ Model downloaded successfully to: ${downloadedPath}`);
          this.status.isDownloading = false;
          this.status.downloadProgress = 100;

        } catch (error) {
          console.error('❌ Model download failed:', error);
          this.status.isDownloading = false;
          this.status.error = error instanceof Error ? error.message : 'Download failed';
          return false;
        }
      }

      // Verify the model is now available
      const finalModelPath = this.settings.getSentenceTransformerPath();
      if (!finalModelPath) {
        throw new Error('Model path still not set after download');
      }

      const finalCheck = await FileSystem.getInfoAsync(finalModelPath);
      if (!finalCheck.exists) {
        throw new Error('Model file still does not exist after download');
      }

      console.log('✅ Model initialization complete');
      console.log(`📍 Final model path: ${finalModelPath}`);
      console.log(`📏 Final model size: ${finalCheck.size} bytes`);

      this.status.isInitialized = true;
      this.status.error = undefined;
      return true;

    } catch (error) {
      console.error('❌ Model initialization failed:', error);
      this.status.error = error instanceof Error ? error.message : 'Initialization failed';
      this.status.isInitialized = false;
      return false;
    } finally {
      this.initializationPromise = null;
    }
  }

  // Reset the initialization state (useful for retrying)
  reset(): void {
    this.status = {
      isInitialized: false,
      isDownloading: false,
      downloadProgress: 0
    };
    this.initializationPromise = null;
  }
}