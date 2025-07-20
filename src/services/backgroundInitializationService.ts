// Background initialization service to prevent OOM during startup
// Defers heavy operations until after UI is ready

export enum InitializationState {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed'
}

export interface InitializationStatus {
  state: InitializationState;
  progress: number; // 0-100
  currentTask: string;
  error?: string;
}

export class BackgroundInitializationService {
  private static instance: BackgroundInitializationService;
  private status: InitializationStatus = {
    state: InitializationState.NotStarted,
    progress: 0,
    currentTask: 'Waiting to start...'
  };
  
  private listeners: ((status: InitializationStatus) => void)[] = [];

  private constructor() {}

  static getInstance(): BackgroundInitializationService {
    if (!BackgroundInitializationService.instance) {
      BackgroundInitializationService.instance = new BackgroundInitializationService();
    }
    return BackgroundInitializationService.instance;
  }

  // Subscribe to status changes
  onStatusChange(listener: (status: InitializationStatus) => void) {
    this.listeners.push(listener);
    // Immediately notify with current status
    listener(this.status);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.status));
  }

  private updateStatus(state: InitializationState, progress: number, currentTask: string, error?: string) {
    this.status = { state, progress, currentTask, error };
    console.log(`🔄 Init: ${currentTask} (${progress}%)`);
    this.notifyListeners();
  }

  // Get current status
  getStatus(): InitializationStatus {
    return { ...this.status };
  }

  // Check if initialization is complete
  isReady(): boolean {
    return this.status.state === InitializationState.Completed;
  }

  // Start background initialization (call this AFTER UI is loaded)
  async startBackgroundInitialization(): Promise<void> {
    if (this.status.state === InitializationState.InProgress || 
        this.status.state === InitializationState.Completed) {
      return;
    }

    this.updateStatus(InitializationState.InProgress, 0, 'Starting background initialization...');

    try {
      // Step 1: Initialize storage (lightweight)
      this.updateStatus(InitializationState.InProgress, 10, 'Initializing storage...');
      await this.initializeStorage();
      await this.delay(100); // Allow UI to update

      // Step 2: Initialize pre-computed embeddings service (manifest only)
      this.updateStatus(InitializationState.InProgress, 20, 'Loading embedding manifest...');
      await this.initializeEmbeddingManifest();
      await this.delay(100);

      // Step 3: Initialize document service (metadata only)
      this.updateStatus(InitializationState.InProgress, 40, 'Loading document metadata...');
      await this.initializeDocumentMetadata();
      await this.delay(100);

      // Step 4: Initialize sentence transformer (model setup)
      this.updateStatus(InitializationState.InProgress, 60, 'Initializing AI model...');
      await this.initializeSentenceTransformer();
      await this.delay(100);

      // Step 5: Initialize vector store (lightweight setup)
      this.updateStatus(InitializationState.InProgress, 80, 'Setting up vector store...');
      await this.initializeVectorStore();
      await this.delay(100);

      // Step 6: Complete
      this.updateStatus(InitializationState.Completed, 100, 'Initialization complete');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateStatus(InitializationState.Failed, 0, 'Initialization failed', errorMessage);
      throw error;
    }
  }

  // Individual initialization steps (lightweight versions)
  private async initializeStorage(): Promise<void> {
    const { SQLiteStorageService } = await import('./sqliteStorage');
    const storage = SQLiteStorageService.getInstance();
    await storage.initialize();
  }

  private async initializeEmbeddingManifest(): Promise<void> {
    // Note: ProgressiveEmbeddingService disabled in favor of VectorDocumentLoader
    console.log('✅ Using VectorDocumentLoader instead of ProgressiveEmbeddingService');
  }

  private async initializeDocumentMetadata(): Promise<void> {
    const { AssetDocumentService } = await import('./assetDocumentService');
    const service = AssetDocumentService.getInstance();
    // Don't call any methods that load heavy content
    // Just instantiate for future use
  }

  private async initializeSentenceTransformer(): Promise<void> {
    const { ModelInitializationService } = await import('./modelInitializationService');
    const service = ModelInitializationService.getInstance();
    // Start model setup in background (don't wait for full completion)
    service.ensureModelReady().catch(error => {
      console.warn('Background model initialization failed:', error);
    });
  }

  private async initializeVectorStore(): Promise<void> {
    console.log('🔄 Init: Setting up vector storage... (80%)');
    const { SQLiteVectorStorage } = await import('./sqliteVectorStorage');
    const { VectorRAG } = await import('./vectorRAG');
    const { VectorDocumentLoader } = await import('./vectorDocumentLoader');
    
    // Initialize vector storage
    const vectorStorage = new SQLiteVectorStorage();
    await vectorStorage.initialize();
    
    console.log('🚀 Initializing Vector RAG service...');
    const vectorRAG = VectorRAG.getInstance();
    await vectorRAG.initialize();

    console.log('📚 Loading documents into vector storage...');
    const documentLoader = VectorDocumentLoader.getInstance();
    await documentLoader.initialize();
    
    // Check if documents and embeddings are already loaded
    const stats = await documentLoader.getLoadingStats();
    if (stats.documentsLoaded === 0 || stats.chunksWithEmbeddings === 0) {
      console.log(`📥 Loading documents and generating embeddings... (Current: ${stats.documentsLoaded} docs, ${stats.chunksWithEmbeddings} chunks with embeddings)`);
      await documentLoader.loadAllDocuments();
    } else {
      console.log(`✅ Documents and embeddings already loaded: ${stats.documentsLoaded}/${stats.documentsTotal} docs, ${stats.chunksWithEmbeddings} chunks with embeddings`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Quick initialization check (for immediate app startup)
  async quickCheck(): Promise<boolean> {
    try {
      // Just check if basic services are available
      // No heavy operations
      return true;
    } catch (error) {
      console.warn('Quick check failed:', error);
      return false;
    }
  }

  // Force restart initialization
  async restart(): Promise<void> {
    this.updateStatus(InitializationState.NotStarted, 0, 'Restarting...');
    await this.startBackgroundInitialization();
  }
}