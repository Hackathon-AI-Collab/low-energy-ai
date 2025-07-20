// Progressive embedding service to load embeddings in memory-safe chunks
// Prevents OutOfMemoryError by loading embeddings on-demand with smart caching

import { PreComputedEmbedding, EmbeddingManifest } from './preComputedEmbeddingService';

export interface ProgressiveLoadingConfig {
  maxMemoryUsageMB: number;
  maxConcurrentLoads: number;
  preloadTopDocuments: string[];
  memoryPressureThreshold: number;
}

export class ProgressiveEmbeddingService {
  private static instance: ProgressiveEmbeddingService;
  private config: ProgressiveLoadingConfig;
  private loadingQueue: Map<string, Promise<PreComputedEmbedding[] | null>> = new Map();
  private isInitialized = false;

  private constructor() {
    this.config = {
      maxMemoryUsageMB: 50, // Conservative limit for React Native
      maxConcurrentLoads: 2,
      preloadTopDocuments: [
        'emap_usr_standard',
        'fema_ics_fog_2016', 
        'fema_incident_rehab_2008',
        'fema_usr_fog',
        'fema_usr_ops',
        'insarag_coordination',
        'tccc_handbook_v5',
        'tccc_quick_ref',
        'usr_tpam',
        'who_blue_book',
        'who_field_guide_limb_injuries',
        'who_highly_infectious_response',
        'who_injury_surveillance',
        'who_medical_evacuation_2025',
        'who_pocket_book',
        'who_prehospital_trauma'
      ], // All 16 documents for complete coverage
      memoryPressureThreshold: 0.8 // Clear cache when 80% of limit reached
    };
  }

  static getInstance(): ProgressiveEmbeddingService {
    if (!ProgressiveEmbeddingService.instance) {
      ProgressiveEmbeddingService.instance = new ProgressiveEmbeddingService();
    }
    return ProgressiveEmbeddingService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('🔄 ProgressiveEmbeddingService: Initializing with true background loading...');
      console.log('📦 Pre-computed embeddings will be loaded in background AFTER app starts');
      console.log('💡 No upfront memory allocation - everything happens on-demand');
      
      // No upfront loading - just mark as initialized
      this.isInitialized = true;
      
      // Start background preloading after a longer delay to ensure UI is fully loaded
      console.log(`⏰ ProgressiveEmbeddingService: Background preload scheduled to start in 5 seconds...`);
      console.log(`📝 ProgressiveEmbeddingService: Will preload: ${this.config.preloadTopDocuments.join(', ')}`);
      
      setTimeout(() => {
        console.log(`🚀 ProgressiveEmbeddingService: 5 second delay complete, starting background preload...`);
        this.startBackgroundPreloading();
      }, 5000); // 5 second delay to let app fully initialize
      
      return true; // Always return true - we have background loading capability

    } catch (error) {
      console.error('❌ ProgressiveEmbeddingService: Initialization failed:', error);
      this.isInitialized = true;
      return false;
    }
  }

  private async startBackgroundPreloading() {
    // Preload most important documents in background
    setTimeout(async () => {
      console.log(`🌟 ================================`);
      console.log(`🌟 STARTING BACKGROUND EMBEDDING PRELOAD`);
      console.log(`🌟 Target documents: ${this.config.preloadTopDocuments.join(', ')}`);
      console.log(`🌟 Memory limit: ${this.config.maxMemoryUsageMB}MB`);
      console.log(`🌟 ================================`);
      
      const preloadStartTime = Date.now();
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < this.config.preloadTopDocuments.length; i++) {
        const docId = this.config.preloadTopDocuments[i];
        
        console.log(`📦 [BACKGROUND] Processing ${i + 1}/${this.config.preloadTopDocuments.length}: ${docId}`);
        
        // Check memory pressure before each load
        if (this.checkMemoryPressure()) {
          console.log(`⚠️ [BACKGROUND] Memory pressure detected, stopping background preloading`);
          console.log(`📊 [BACKGROUND] Stopped after ${successCount} successful, ${failCount} failed loads`);
          break;
        }
        
        try {
          const loadStartTime = Date.now();
          const embeddings = await this.getDocumentEmbeddings(docId);
          const loadTime = Date.now() - loadStartTime;
          
          if (embeddings) {
            successCount++;
            console.log(`✅ [BACKGROUND] Successfully preloaded ${docId} in ${loadTime}ms`);
            console.log(`📊 [BACKGROUND] Progress: ${successCount + failCount}/${this.config.preloadTopDocuments.length} complete`);
            
            // Show current cache status
            const status = this.getStatus();
            console.log(`💾 [BACKGROUND] Cache status: ${status.cachedDocuments} docs, ${status.memoryUsageMB}MB used`);
          } else {
            failCount++;
            console.warn(`⚠️ [BACKGROUND] Failed to preload ${docId} - no embeddings returned`);
          }
          
          // Delay between background loads to prevent overwhelming
          if (i < this.config.preloadTopDocuments.length - 1) {
            console.log(`⏱️ [BACKGROUND] Waiting 1 second before next preload...`);
            await this.delay(1000);
          }
          
        } catch (error) {
          failCount++;
          console.error(`❌ [BACKGROUND] Failed to preload ${docId}:`, error);
        }
      }
      
      const totalPreloadTime = Date.now() - preloadStartTime;
      
      console.log(`🎉 ================================`);
      console.log(`🎉 BACKGROUND PRELOAD COMPLETED`);
      console.log(`🎉 Total time: ${totalPreloadTime}ms`);
      console.log(`🎉 Successful: ${successCount} documents`);
      console.log(`🎉 Failed: ${failCount} documents`);
      console.log(`🎉 Final cache: ${this.embeddingsCache.size} documents`);
      console.log(`🎉 Memory used: ${(this.memoryUsageEstimate / 1024 / 1024).toFixed(1)}MB`);
      console.log(`🎉 ================================`);
      
      // Show what's actually cached
      if (this.embeddingsCache.size > 0) {
        console.log(`📚 [BACKGROUND] Cached documents:`);
        for (const [docId, embeddings] of this.embeddingsCache.entries()) {
          const sizeMB = (embeddings.length * 1800 / 1024 / 1024).toFixed(1);
          console.log(`   - ${docId}: ${embeddings.length} embeddings (${sizeMB}MB)`);
        }
      }
      
    }, 5000); // Start after a 5-second delay to let UI fully load
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private checkMemoryPressure(): boolean {
    const maxBytes = this.config.maxMemoryUsageMB * 1024 * 1024;
    const threshold = maxBytes * this.config.memoryPressureThreshold;
    const pressure = this.memoryUsageEstimate > threshold;
    
    if (pressure) {
      console.log(`⚠️ [MEMORY] Pressure detected: ${(this.memoryUsageEstimate / 1024 / 1024).toFixed(1)}MB > ${(threshold / 1024 / 1024).toFixed(1)}MB`);
    }
    
    return pressure;
  }

  async getDocumentEmbeddings(documentId: string): Promise<PreComputedEmbedding[] | null> {
    // Load embedding on-demand using direct require() with memory management
    return await this.loadEmbeddingOnDemand(documentId);
  }
  
  private async loadEmbeddingOnDemand(documentId: string): Promise<PreComputedEmbedding[] | null> {
    // Check if already loading
    if (this.loadingQueue.has(documentId)) {
      console.log(`⏳ ${documentId} already loading, waiting...`);
      return await this.loadingQueue.get(documentId)!;
    }
    
    // Check cache first
    if (this.embeddingsCache.has(documentId)) {
      console.log(`📦 Using cached embeddings for ${documentId}`);
      return this.embeddingsCache.get(documentId)!;
    }
    
    // Start loading
    const loadPromise = this.performControlledLoad(documentId);
    this.loadingQueue.set(documentId, loadPromise);
    
    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadingQueue.delete(documentId);
    }
  }
  
  private async performControlledLoad(documentId: string): Promise<PreComputedEmbedding[] | null> {
    const startTime = Date.now();
    console.log(`🚀 [${documentId}] Starting controlled embedding load...`);
    
    try {
      console.log(`📦 [${documentId}] Loading pre-computed embeddings - Step 1: Preparation`);
      
      // Log memory status before loading
      const beforeMemory = this.getMemoryStatus();
      console.log(`💾 [${documentId}] Memory before load: ${beforeMemory.usedMB}MB / ${beforeMemory.limitMB}MB (${beforeMemory.usagePercent}%)`);
      
      // Force garbage collection before loading
      if (global.gc) {
        console.log(`🧹 [${documentId}] Running garbage collection before load...`);
        global.gc();
        console.log(`✅ [${documentId}] Garbage collection completed`);
      }
      
      // Wait a bit for GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Load the embeddings using static require mapping - but only ONE document at a time
      let embeddings: PreComputedEmbedding[] | null = null;
      
      try {
        console.log(`📥 [${documentId}] Step 2: Dynamic import starting...`);
        const importStartTime = Date.now();
        
        const embeddingData = await this.getEmbeddingData(documentId);
        const importTime = Date.now() - importStartTime;
        
        console.log(`⏱️ [${documentId}] Import completed in ${importTime}ms`);
        
        if (embeddingData && Array.isArray(embeddingData)) {
          embeddings = embeddingData;
          const avgEmbeddingLength = embeddings.length > 0 ? embeddings[0].embedding?.length || 0 : 0;
          console.log(`✅ [${documentId}] Successfully loaded ${embeddings.length} embeddings`);
          console.log(`📏 [${documentId}] Embedding dimension: ${avgEmbeddingLength}`);
          console.log(`📄 [${documentId}] Sample content: "${embeddings[0]?.content?.substring(0, 100) || 'N/A'}..."`);
        } else if (embeddingData === null) {
          console.warn(`⚠️ [${documentId}] Document not found in embedding collection`);
          return null;
        } else {
          console.warn(`⚠️ [${documentId}] Invalid embedding data format - expected array, got ${typeof embeddingData}`);
          return null;
        }
      } catch (error) {
        console.error(`❌ [${documentId}] Failed to load pre-computed embeddings:`, error);
        console.error(`❌ [${documentId}] Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 300)
        });
        return null;
      }
      
      if (embeddings) {
        console.log(`🗂️ [${documentId}] Step 3: Cache management...`);
        // Manage cache size to prevent OOM
        await this.manageCache(documentId, embeddings);
        
        const afterMemory = this.getMemoryStatus();
        const totalTime = Date.now() - startTime;
        
        console.log(`💾 [${documentId}] Memory after load: ${afterMemory.usedMB}MB / ${afterMemory.limitMB}MB (${afterMemory.usagePercent}%)`);
        console.log(`⚡ [${documentId}] Total load time: ${totalTime}ms`);
        console.log(`✅ [${documentId}] Load completed successfully!`);
        
        return embeddings;
      }
      
      console.warn(`⚠️ [${documentId}] No embeddings to return`);
      return null;
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [${documentId}] Error in controlled load after ${totalTime}ms:`, error);
      return null;
    }
  }
  
  private getMemoryStatus() {
    return {
      usedMB: Math.round(this.memoryUsageEstimate / 1024 / 1024 * 100) / 100,
      limitMB: this.config.maxMemoryUsageMB,
      usagePercent: Math.round(this.memoryUsageEstimate / (this.config.maxMemoryUsageMB * 1024 * 1024) * 100)
    };
  }
  
  // Truly lazy loading using async dynamic imports
  private async getEmbeddingData(documentId: string): Promise<PreComputedEmbedding[] | null> {
    try {
      console.log(`📦 Attempting dynamic import for ${documentId}...`);
      
      // Use dynamic import which is truly lazy
      let embeddingModule;
      
      switch (documentId) {
        case 'emap_usr_standard':
          embeddingModule = await import('../../assets/embeddings/emap_usr_standard.json');
          break;
        case 'fema_ics_fog_2016':
          embeddingModule = await import('../../assets/embeddings/fema_ics_fog_2016.json');
          break;
        case 'fema_incident_rehab_2008':
          embeddingModule = await import('../../assets/embeddings/fema_incident_rehab_2008.json');
          break;
        case 'fema_usr_fog':
          embeddingModule = await import('../../assets/embeddings/fema_usr_fog.json');
          break;
        case 'fema_usr_ops':
          embeddingModule = await import('../../assets/embeddings/fema_usr_ops.json');
          break;
        case 'insarag_coordination':
          embeddingModule = await import('../../assets/embeddings/insarag_coordination.json');
          break;
        case 'tccc_handbook_v5':
          embeddingModule = await import('../../assets/embeddings/tccc_handbook_v5.json');
          break;
        case 'tccc_quick_ref':
          embeddingModule = await import('../../assets/embeddings/tccc_quick_ref.json');
          break;
        case 'usr_tpam':
          embeddingModule = await import('../../assets/embeddings/usr_tpam.json');
          break;
        case 'who_blue_book':
          embeddingModule = await import('../../assets/embeddings/who_blue_book.json');
          break;
        case 'who_field_guide_limb_injuries':
          embeddingModule = await import('../../assets/embeddings/who_field_guide_limb_injuries.json');
          break;
        case 'who_highly_infectious_response':
          embeddingModule = await import('../../assets/embeddings/who_highly_infectious_response.json');
          break;
        case 'who_injury_surveillance':
          embeddingModule = await import('../../assets/embeddings/who_injury_surveillance.json');
          break;
        case 'who_medical_evacuation_2025':
          embeddingModule = await import('../../assets/embeddings/who_medical_evacuation_2025.json');
          break;
        case 'who_pocket_book':
          embeddingModule = await import('../../assets/embeddings/who_pocket_book.json');
          break;
        case 'who_prehospital_trauma':
          embeddingModule = await import('../../assets/embeddings/who_prehospital_trauma.json');
          break;
        default:
          console.warn(`📦 Unknown document ID: ${documentId}`);
          return null;
      }
      
      // Extract the actual data from the module
      const embeddingData = embeddingModule.default || embeddingModule;
      
      if (Array.isArray(embeddingData)) {
        return embeddingData;
      } else {
        console.warn(`⚠️ Embedding data is not an array for ${documentId}`);
        return null;
      }
      
    } catch (error) {
      console.error(`❌ Dynamic import failed for ${documentId}:`, error);
      return null;
    }
  }
  
  private embeddingsCache = new Map<string, PreComputedEmbedding[]>();
  private memoryUsageEstimate = 0;
  
  private async manageCache(documentId: string, embeddings: PreComputedEmbedding[]): Promise<void> {
    // Estimate memory usage
    const estimatedBytes = embeddings.length * 1800; // ~1800 bytes per embedding
    const estimatedMB = estimatedBytes / 1024 / 1024;
    
    console.log(`💾 [CACHE] Storing ${documentId}: ${estimatedMB.toFixed(1)}MB (${embeddings.length} embeddings)`);
    console.log(`📊 [CACHE] Before storage: ${(this.memoryUsageEstimate / 1024 / 1024).toFixed(1)}MB used, ${this.embeddingsCache.size} docs cached`);
    
    // If this would exceed our memory limit, clear old cache entries
    const maxBytes = this.config.maxMemoryUsageMB * 1024 * 1024;
    
    if (this.memoryUsageEstimate + estimatedBytes > maxBytes && this.embeddingsCache.size > 0) {
      console.log(`⚠️ [CACHE] Would exceed limit (${((this.memoryUsageEstimate + estimatedBytes) / 1024 / 1024).toFixed(1)}MB >= ${this.config.maxMemoryUsageMB}MB), evicting old entries...`);
    }
    
    while (this.memoryUsageEstimate + estimatedBytes > maxBytes && this.embeddingsCache.size > 0) {
      // Remove oldest entry
      const oldestKey = this.embeddingsCache.keys().next().value;
      const oldEmbeddings = this.embeddingsCache.get(oldestKey)!;
      this.embeddingsCache.delete(oldestKey);
      
      const removedBytes = oldEmbeddings.length * 1800;
      this.memoryUsageEstimate -= removedBytes;
      
      console.log(`🧹 [CACHE] Evicted ${oldestKey} (${(removedBytes / 1024 / 1024).toFixed(1)}MB, ${oldEmbeddings.length} embeddings) to make room`);
      
      // Force garbage collection after eviction
      if (global.gc) {
        console.log(`🧹 [CACHE] Running garbage collection after eviction...`);
        global.gc();
      }
    }
    
    // Add to cache
    this.embeddingsCache.set(documentId, embeddings);
    this.memoryUsageEstimate += estimatedBytes;
    
    console.log(`✅ [CACHE] Successfully stored ${documentId} in cache`);
    console.log(`📊 [CACHE] After storage: ${(this.memoryUsageEstimate / 1024 / 1024).toFixed(1)}MB used, ${this.embeddingsCache.size} docs cached`);
    console.log(`📊 [CACHE] Memory utilization: ${((this.memoryUsageEstimate / maxBytes) * 100).toFixed(1)}% of ${this.config.maxMemoryUsageMB}MB limit`);
    
    // Show current cache contents
    console.log(`📚 [CACHE] Current cache contents:`);
    let totalSize = 0;
    for (const [cachedDocId, cachedEmbeddings] of this.embeddingsCache.entries()) {
      const sizeMB = (cachedEmbeddings.length * 1800 / 1024 / 1024);
      totalSize += sizeMB;
      console.log(`   - ${cachedDocId}: ${cachedEmbeddings.length} embeddings (${sizeMB.toFixed(1)}MB)`);
    }
    console.log(`📊 [CACHE] Total verified size: ${totalSize.toFixed(1)}MB`);
  }


  // Get embeddings for multiple documents (progressive batch loading)
  async getBatchEmbeddings(documentIds: string[]): Promise<Map<string, PreComputedEmbedding[]>> {
    const results = new Map<string, PreComputedEmbedding[]>();
    
    console.log(`📦 Progressive batch loading for ${documentIds.length} documents...`);
    
    for (const docId of documentIds) {
      try {
        const embeddings = await this.getDocumentEmbeddings(docId);
        if (embeddings) {
          results.set(docId, embeddings);
        }
        
        // Small delay between documents
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.warn(`Failed to load embeddings for ${docId}:`, error);
      }
    }
    
    console.log(`✅ Progressive batch loaded ${results.size}/${documentIds.length} documents`);
    return results;
  }

  // Update configuration
  updateConfig(newConfig: Partial<ProgressiveLoadingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Progressive loading config updated:', this.config);
  }

  // Get current status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      manifestAvailable: true, // We know we have embeddings
      controlledLoading: true,
      memoryUsageMB: Math.round(this.memoryUsageEstimate / 1024 / 1024 * 100) / 100,
      memoryLimitMB: this.config.maxMemoryUsageMB,
      memoryUsagePercent: Math.round(this.memoryUsageEstimate / (this.config.maxMemoryUsageMB * 1024 * 1024) * 100),
      cachedDocuments: this.embeddingsCache.size,
      activeLoads: this.loadingQueue.size,
      totalDocuments: 16 // We know we have 16 documents
    };
  }

  // Check compatibility with current model
  isCompatible(dimension: number, modelName: string): boolean {
    // Our embeddings are 384-dimensional from sentence-transformers/all-MiniLM-L6-v2
    return dimension === 384 && modelName.includes('all-MiniLM-L6-v2');
  }

  // Force cleanup
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up progressive embedding service...');
    this.embeddingsCache.clear();
    this.memoryUsageEstimate = 0;
    this.loadingQueue.clear();
    this.isInitialized = false;
    
    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }
  }
}