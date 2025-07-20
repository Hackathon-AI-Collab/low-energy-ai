import { VoyVectorStore } from './voyVectorStore';
import { DynamicDocumentLoader } from './dynamicDocumentLoader';

export interface AssetDocument {
  id: string;
  title: string;
  filename: string;
  category: 'medical' | 'emergency' | 'search-rescue' | 'coordination';
  size: number;
  description: string;
}

export class AssetDocumentService {
  private static instance: AssetDocumentService;
  private documents: AssetDocument[] = [];
  private isInitialized = false;

  private constructor() {
    // Initialize will be called async when needed
  }

  static getInstance(): AssetDocumentService {
    if (!AssetDocumentService.instance) {
      AssetDocumentService.instance = new AssetDocumentService();
    }
    return AssetDocumentService.instance;
  }

  // Ensure documents are initialized from filesystem
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDocuments();
      this.isInitialized = true;
    }
  }

  // Initialize documents dynamically from filesystem
  private async initializeDocuments(): Promise<void> {
    console.log('AssetDocumentService: Initializing documents from filesystem...');
    
    try {
      const dynamicLoader = DynamicDocumentLoader.getInstance();
      const availableDocs = await dynamicLoader.getAvailableDocuments();
      
      this.documents = availableDocs.map(docInfo => ({
        id: docInfo.filename.replace('.md', ''),
        title: docInfo.title,
        filename: docInfo.filename,
        category: this.determineCategory(docInfo.filename),
        size: Math.round(docInfo.size / 1024), // Convert to KB
        description: `${docInfo.title} - Loaded from assets/documents`
      }));
      
      console.log(`AssetDocumentService: Initialized with ${this.documents.length} documents from filesystem`);
      
    } catch (error) {
      console.error('AssetDocumentService: Failed to initialize from filesystem:', error);
      
      // Fallback to empty list - graceful degradation
      this.documents = [];
    }
  }

  // Determine document category based on filename
  private determineCategory(filename: string): AssetDocument['category'] {
    if (filename.includes('who_') || filename.includes('tccc_')) {
      return 'medical';
    } else if (filename.includes('fema_')) {
      return 'emergency';
    } else if (filename.includes('usr_') || filename.includes('emap_')) {
      return 'search-rescue';
    } else if (filename.includes('insarag_')) {
      return 'coordination';
    } else {
      return 'emergency'; // default
    }
  }

  // Get all available documents
  async getAllDocuments(): Promise<AssetDocument[]> {
    await this.ensureInitialized();
    return [...this.documents];
  }

  // Get documents by category
  async getDocumentsByCategory(category: AssetDocument['category']): Promise<AssetDocument[]> {
    await this.ensureInitialized();
    return this.documents.filter(doc => doc.category === category);
  }

  // Get document by ID
  async getDocumentById(id: string): Promise<AssetDocument | undefined> {
    await this.ensureInitialized();
    return this.documents.find(doc => doc.id === id);
  }


  // Load document content dynamically from assets/documents directory
  async loadDocumentContent(filename: string): Promise<string> {
    try {
      console.log(`AssetDocumentService: Loading document content for: ${filename}`);
      
      // Use the dynamic document loader to get actual file content
      const dynamicLoader = DynamicDocumentLoader.getInstance();
      const content = await dynamicLoader.loadDocument(filename);
      
      if (content && content.length > 50) {
        console.log(`AssetDocumentService: Successfully loaded ${content.length} characters from ${filename}`);
        return content;
      } else {
        throw new Error(`Document ${filename} appears to be empty or too short`);
      }
      
    } catch (error) {
      console.error(`AssetDocumentService: Failed to load document ${filename}:`, error);
      throw error;
    }
  }

  // Load and process all documents into the vector store
  async loadAllDocumentsToVectorStore(): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      console.log('AssetDocumentService: Loading all documents to vector store...');
      
      await this.ensureInitialized();
      
      const vectorStore = new VoyVectorStore();
      await vectorStore.initialize();

      // Load all documents in parallel for better performance
      console.log(`AssetDocumentService: Loading ${this.documents.length} documents in parallel...`);
      
      const loadPromises = this.documents.map(async (doc) => {
        try {
          console.log(`AssetDocumentService: Loading document: ${doc.title}`);
          
          const content = await this.loadDocumentContent(doc.filename);
          
          // Add document to vector store
          await vectorStore.addDocument(doc.id, doc.title, content, 'markdown');
          
          console.log(`AssetDocumentService: Successfully loaded: ${doc.title}`);
          return { success: true, doc: doc.title };
          
        } catch (error) {
          const errorMsg = `Failed to load ${doc.title}: ${error}`;
          console.error(errorMsg);
          return { success: false, error: errorMsg, doc: doc.title };
        }
      });

      // Wait for all documents to load
      const loadResults = await Promise.all(loadPromises);
      
      // Process results
      for (const result of loadResults) {
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          if (result.error) {
            results.errors.push(result.error);
          }
        }
      }

      console.log(`AssetDocumentService: Completed loading documents. Success: ${results.success}, Failed: ${results.failed}`);
      
    } catch (error) {
      console.error('AssetDocumentService: Failed to initialize vector store:', error);
      results.errors.push(`Vector store initialization failed: ${error}`);
      results.failed = this.documents.length;
    }

    return results;
  }

  // Load specific document to vector store
  async loadDocumentToVectorStore(documentId: string): Promise<boolean> {
    try {
      const doc = await this.getDocumentById(documentId);
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      console.log(`AssetDocumentService: Loading document: ${doc.title}`);
      
      const content = await this.loadDocumentContent(doc.filename);
      
      const vectorStore = new VoyVectorStore();
      await vectorStore.initialize();
      
      await vectorStore.addDocument(doc.id, doc.title, content, 'markdown');
      
      console.log(`AssetDocumentService: Successfully loaded: ${doc.title}`);
      return true;
      
    } catch (error) {
      console.error(`AssetDocumentService: Failed to load document ${documentId}:`, error);
      return false;
    }
  }

  // Get document statistics
  async getDocumentStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    totalSize: number;
  }> {
    await this.ensureInitialized();
    
    const byCategory: Record<string, number> = {};
    let totalSize = 0;

    for (const doc of this.documents) {
      byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
      totalSize += doc.size;
    }

    return {
      total: this.documents.length,
      byCategory,
      totalSize
    };
  }

  // Check if documents are loaded in vector store
  async checkDocumentsInVectorStore(): Promise<{
    loaded: string[];
    missing: string[];
    total: number;
  }> {
    try {
      await this.ensureInitialized();
      
      const vectorStore = new VoyVectorStore();
      await vectorStore.initialize();
      
      const storedDocs = await vectorStore.getAllDocuments();
      const storedIds = new Set(storedDocs.map(doc => doc.id));
      
      const loaded: string[] = [];
      const missing: string[] = [];
      
      for (const doc of this.documents) {
        if (storedIds.has(doc.id)) {
          loaded.push(doc.id);
        } else {
          missing.push(doc.id);
        }
      }

      return {
        loaded,
        missing,
        total: this.documents.length
      };
      
    } catch (error) {
      console.error('AssetDocumentService: Failed to check documents in vector store:', error);
      return {
        loaded: [],
        missing: this.documents.map(doc => doc.id),
        total: this.documents.length
      };
    }
  }

  // Refresh document list (useful for sync feature)
  async refreshDocuments(): Promise<void> {
    console.log('AssetDocumentService: Refreshing document list...');
    this.documents = [];
    this.isInitialized = false;
    
    // Also refresh the dynamic loader
    const dynamicLoader = DynamicDocumentLoader.getInstance();
    await dynamicLoader.refreshDocuments();
    
    // Re-initialize
    await this.ensureInitialized();
  }

  // Get dynamic loader instance (for advanced operations)
  getDynamicLoader(): DynamicDocumentLoader {
    return DynamicDocumentLoader.getInstance();
  }
}