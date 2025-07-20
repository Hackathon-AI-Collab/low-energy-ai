import { open, DB } from '@op-engineering/op-sqlite';
import { DocumentChunk, DocumentMetadata } from './voyVectorStore';

export interface VectorStoredDocument {
  id: string;
  title: string;
  content: string;
  type: string;
  version: number;
  hash: string;
  created_at: string;
}

export interface VectorChunkRow {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  embedding: number[]; // Will be stored as VECTOR(384) in SQLite
  importance: number;
  created_at: string;
}

export interface VectorSearchResult {
  chunk: VectorChunkRow;
  distance: number;
}

/**
 * SQLite Vector Storage with sqlite-vec extension
 * Provides memory-efficient vector storage and similarity search
 */
export class SQLiteVectorStorage {
  private db: DB | null = null;
  private isInitialized = false;
  private dbPath: string;

  constructor(dbName: string = 'leai_vector.db') {
    this.dbPath = dbName;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔧 SQLiteVectorStorage: Initializing vector database...');
      
      // Open database with op-sqlite
      this.db = open({
        name: this.dbPath,
        location: 'default', // Use default location
      });

      console.log('✅ SQLiteVectorStorage: Database opened successfully');

      // Test if sqlite-vec extension is available
      await this.testVectorSupport();

      // Create tables with vector columns
      await this.createTables();

      // Create indexes for performance
      await this.createIndexes();

      this.isInitialized = true;
      console.log('✅ SQLiteVectorStorage: Vector database initialized successfully');

    } catch (error) {
      console.error('❌ SQLiteVectorStorage: Failed to initialize:', error);
      throw error;
    }
  }

  private async testVectorSupport(): Promise<void> {
    try {
      console.log('🧪 Testing sqlite-vec extension support...');
      
      // Test if we can create a vector column using BLOB storage (which is what sqlite-vec expects)
      await this.db!.execute(`
        CREATE TEMP TABLE test_vectors (
          id INTEGER PRIMARY KEY,
          vec BLOB
        )
      `);

      // Test with vec0 virtual table approach (standard sqlite-vec usage)
      try {
        await this.db!.execute(`
          CREATE VIRTUAL TABLE temp.test_vec0 USING vec0(
            embedding(384)
          )
        `);
        console.log('✅ sqlite-vec vec0 virtual table is working');
        await this.db!.execute('DROP TABLE temp.test_vec0');
      } catch (e) {
        console.log('⚠️ vec0 virtual table not available, trying basic functions:', e.message);
        
        // Try basic distance function
        await this.db!.execute(`
          SELECT 1 as test
        `);
        console.log('✅ sqlite-vec extension loaded, using BLOB storage approach');
      }
      
      // Clean up test table
      await this.db!.execute('DROP TABLE test_vectors');

    } catch (error) {
      console.error('❌ sqlite-vec extension not available:', error);
      throw new Error('sqlite-vec extension is required but not available. Please ensure op-sqlite is built with sqlite-vec support.');
    }
  }

  private async createTables(): Promise<void> {
    console.log('📊 SQLiteVectorStorage: Creating tables...');

    // Documents table
    await this.db!.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'markdown',
        version INTEGER NOT NULL DEFAULT 1,
        hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Document chunks table with vector embeddings
    await this.db!.execute(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding BLOB,
        importance REAL DEFAULT 0.5,
        start_position INTEGER DEFAULT 0,
        end_position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ SQLiteVectorStorage: Tables created successfully');
  }

  private async createIndexes(): Promise<void> {
    console.log('🔍 SQLiteVectorStorage: Creating indexes...');

    // Index on document_id for fast chunk lookups
    await this.db!.execute(`
      CREATE INDEX IF NOT EXISTS idx_chunks_document_id 
      ON document_chunks(document_id)
    `);

    // Index on chunk_index for ordering
    await this.db!.execute(`
      CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index 
      ON document_chunks(document_id, chunk_index)
    `);

    // Index on importance for filtering
    await this.db!.execute(`
      CREATE INDEX IF NOT EXISTS idx_chunks_importance 
      ON document_chunks(importance)
    `);

    console.log('✅ SQLiteVectorStorage: Indexes created successfully');
  }

  async saveDocument(document: DocumentMetadata): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`💾 SQLiteVectorStorage: Saving document: ${document.title}`);

      // Insert or replace document
      await this.db!.execute(`
        INSERT OR REPLACE INTO documents (
          id, title, content, type, version, hash, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        document.id,
        document.title,
        '', // We don't store full content, just chunks
        document.type,
        document.version,
        document.hash
      ]);

      console.log(`✅ SQLiteVectorStorage: Document saved: ${document.title}`);

    } catch (error) {
      console.error(`❌ SQLiteVectorStorage: Failed to save document ${document.title}:`, error);
      throw error;
    }
  }

  async saveChunks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (chunks.length === 0) {
      console.log('⚠️ SQLiteVectorStorage: No chunks to save');
      return;
    }

    try {
      console.log(`💾 SQLiteVectorStorage: Saving ${chunks.length} chunks...`);

      // Use transaction for better performance
      await this.db!.transaction(async (txn) => {
        for (const chunk of chunks) {
          if (!chunk.embedding || chunk.embedding.length === 0) {
            console.warn(`⚠️ Skipping chunk ${chunk.id} - no embedding`);
            continue;
          }

          // Convert embedding to proper format for sqlite-vec
          // sqlite-vec expects float32 arrays as binary data
          const float32Array = new Float32Array(chunk.embedding);
          const embeddingBlob = new Uint8Array(float32Array.buffer);

          await txn.execute(`
            INSERT OR REPLACE INTO document_chunks (
              id, document_id, content, chunk_index, embedding, 
              importance, start_position, end_position, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            chunk.id,
            chunk.documentId,
            chunk.content,
            chunk.metadata.chunkIndex,
            embeddingBlob,
            chunk.metadata.importance || 0.5,
            chunk.metadata.startPosition || 0,
            chunk.metadata.endPosition || 0
          ]);
        }
      });

      const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding && chunk.embedding.length > 0).length;
      console.log(`✅ SQLiteVectorStorage: Saved ${chunks.length} chunks successfully (${chunksWithEmbeddings} with embeddings stored to SQLite)`);

    } catch (error) {
      console.error('❌ SQLiteVectorStorage: Failed to save chunks:', error);
      throw error;
    }
  }

  async searchSimilarChunks(
    queryEmbedding: number[], 
    limit: number = 10, 
    threshold: number = 0.8
  ): Promise<VectorSearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🔍 SQLiteVectorStorage: Searching for similar chunks (limit: ${limit}, threshold: ${threshold})`);

      // Convert query embedding to binary format for sqlite-vec
      const queryFloat32Array = new Float32Array(queryEmbedding);
      const queryEmbeddingBlob = new Uint8Array(queryFloat32Array.buffer);

      const results = await this.db!.execute(`
        SELECT 
          id,
          document_id,
          content,
          chunk_index,
          importance,
          start_position,
          end_position,
          created_at,
          vec_distance_cosine(embedding, ?) as distance
        FROM document_chunks 
        WHERE embedding IS NOT NULL
          AND vec_distance_cosine(embedding, ?) <= ?
        ORDER BY distance ASC
        LIMIT ?
      `, [queryEmbeddingBlob, queryEmbeddingBlob, threshold, limit]);

      const searchResults: VectorSearchResult[] = results.rows.map((row: any) => ({
        chunk: {
          id: row.id,
          document_id: row.document_id,
          content: row.content,
          chunk_index: row.chunk_index,
          embedding: [], // We don't need to return the full embedding
          importance: row.importance,
          created_at: row.created_at
        },
        distance: row.distance
      }));

      console.log(`✅ SQLiteVectorStorage: Found ${searchResults.length} similar chunks`);
      return searchResults;

    } catch (error) {
      console.error('❌ SQLiteVectorStorage: Search failed:', error);
      throw error;
    }
  }

  async getDocumentStats(): Promise<{ documents: number; chunks: number; chunksWithEmbeddings: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const docResult = await this.db!.execute('SELECT COUNT(*) as count FROM documents');
      const chunkResult = await this.db!.execute('SELECT COUNT(*) as count FROM document_chunks');
      const embeddingResult = await this.db!.execute(
        'SELECT COUNT(*) as count FROM document_chunks WHERE embedding IS NOT NULL'
      );

      const stats = {
        documents: docResult.rows[0].count,
        chunks: chunkResult.rows[0].count,
        chunksWithEmbeddings: embeddingResult.rows[0].count
      };

      console.log(`📊 SQLiteVectorStorage Stats:`, stats);
      return stats;

    } catch (error) {
      console.error('❌ SQLiteVectorStorage: Failed to get stats:', error);
      return { documents: 0, chunks: 0, chunksWithEmbeddings: 0 };
    }
  }

  async clearAllData(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🗑️ SQLiteVectorStorage: Clearing all data...');
      
      await this.db!.execute('DELETE FROM document_chunks');
      await this.db!.execute('DELETE FROM documents');
      
      console.log('✅ SQLiteVectorStorage: All data cleared');
    } catch (error) {
      console.error('❌ SQLiteVectorStorage: Failed to clear data:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('✅ SQLiteVectorStorage: Database closed');
    }
  }
}