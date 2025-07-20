import { SQLiteVectorStorage } from './sqliteVectorStorage';
import { ProgressiveEmbeddingService } from './progressiveEmbeddingService';
import { AssetDocumentService } from './assetDocumentService';
import { DocumentChunk, DocumentMetadata } from './voyVectorStore';

/**
 * Service to load documents and embeddings into SQLiteVectorStorage
 * Replaces the old document loading pipeline with vector storage
 */
export class VectorDocumentLoader {
  private static instance: VectorDocumentLoader | null = null;
  private vectorStorage: SQLiteVectorStorage;
  private progressiveEmbedding: ProgressiveEmbeddingService;
  private assetDocuments: AssetDocumentService;
  private isInitialized = false;

  constructor() {
    this.vectorStorage = new SQLiteVectorStorage();
    this.progressiveEmbedding = ProgressiveEmbeddingService.getInstance();
    this.assetDocuments = AssetDocumentService.getInstance();

    console.log('📚 VectorDocumentLoader: Service created');
  }

  static getInstance(): VectorDocumentLoader {
    if (!VectorDocumentLoader.instance) {
      VectorDocumentLoader.instance = new VectorDocumentLoader();
    }
    return VectorDocumentLoader.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 VectorDocumentLoader: Initializing...');

      await this.vectorStorage.initialize();
      console.log('✅ VectorDocumentLoader: Vector storage ready');

      this.isInitialized = true;
      console.log('✅ VectorDocumentLoader: Initialization complete');

    } catch (error) {
      console.error('❌ VectorDocumentLoader: Initialization failed:', error);
      throw error;
    }
  }

  async loadAllDocuments(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('📚 VectorDocumentLoader: Starting to load all documents...');

      // Get list of all documents from manifest
      const documentList = [
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
      ];

      let successCount = 0;
      let totalChunks = 0;

      for (const documentId of documentList) {
        try {
          console.log(`📄 VectorDocumentLoader: Processing ${documentId}...`);

          // Load embeddings for this document
          const embeddings = await this.progressiveEmbedding.getDocumentEmbeddings(documentId);
          
          if (!embeddings || embeddings.length === 0) {
            console.warn(`⚠️ VectorDocumentLoader: No embeddings found for ${documentId}`);
            continue;
          }

          console.log(`✅ VectorDocumentLoader: Loaded ${embeddings.length} embeddings for ${documentId}`);

          // Create document metadata
          const document: DocumentMetadata = {
            id: documentId,
            title: this.formatDocumentTitle(documentId),
            type: 'markdown',
            version: 1,
            hash: this.generateDocumentHash(documentId),
            createdAt: new Date(),
            updatedAt: new Date(),
            chunkCount: embeddings.length,
            importance: 1.0,
            chunks: new Map()
          };

          // Save document
          await this.vectorStorage.saveDocument(document);

          // Convert embeddings to chunks and save
          const chunks: DocumentChunk[] = embeddings.map((embedding, index) => ({
            id: embedding.chunkId || `${documentId}_chunk_${index}`,
            documentId: documentId,
            content: embedding.content,
            embedding: embedding.embedding,
            metadata: {
              chunkIndex: index,
              startPosition: 0,
              endPosition: embedding.content.length,
              importance: 1.0
            },
            createdAt: new Date(),
            updatedAt: new Date()
          }));

          await this.vectorStorage.saveChunks(chunks);

          successCount++;
          totalChunks += chunks.length;
          console.log(`✅ VectorDocumentLoader: Saved ${chunks.length} chunks for ${documentId}`);

        } catch (error) {
          console.error(`❌ VectorDocumentLoader: Failed to process ${documentId}:`, error);
        }
      }

      const stats = await this.vectorStorage.getDocumentStats();
      console.log(`🎉 VectorDocumentLoader: Loading complete!`);
      console.log(`📊 Final stats: ${stats.documents} documents, ${stats.chunksWithEmbeddings}/${stats.chunks} chunks with embeddings`);
      console.log(`✅ Successfully processed: ${successCount}/${documentList.length} documents`);
      console.log(`📈 Total chunks loaded: ${totalChunks}`);

    } catch (error) {
      console.error('❌ VectorDocumentLoader: Failed to load documents:', error);
      throw error;
    }
  }

  private formatDocumentTitle(documentId: string): string {
    return documentId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateDocumentHash(documentId: string): string {
    // Simple hash generation for document ID
    let hash = 0;
    for (let i = 0; i < documentId.length; i++) {
      const char = documentId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  async getLoadingStats(): Promise<{
    documentsTotal: number;
    documentsLoaded: number;
    chunksTotal: number;
    chunksWithEmbeddings: number;
    loadingProgress: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const stats = await this.vectorStorage.getDocumentStats();
    const expectedDocuments = 16; // We know we have 16 documents
    const expectedChunks = 7279; // From manifest

    return {
      documentsTotal: expectedDocuments,
      documentsLoaded: stats.documents,
      chunksTotal: stats.chunks,
      chunksWithEmbeddings: stats.chunksWithEmbeddings,
      loadingProgress: (stats.documents / expectedDocuments) * 100
    };
  }

  async clearAllData(): Promise<void> {
    console.log('🗑️ VectorDocumentLoader: Clearing all data...');
    
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.vectorStorage.clearAllData();
    console.log('✅ VectorDocumentLoader: All data cleared');
  }
}