import * as SQLite from 'expo-sqlite';
import { DocumentChunk, DocumentMetadata } from './voyVectorStore';

export interface StoredDocument {
  id: string;
  title: string;
  content: string;
  type: string;
  version: number;
  hash: string;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
  importance: number;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: string; // JSON string of embedding array
  chunkIndex: number;
  startPosition: number;
  endPosition: number;
  importance: number;
  similarityScore?: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  version: number;
  hash: string;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
  importance: number;
}

interface ChunkRow {
  id: string;
  documentId: string;
  content: string;
  embedding: string;
  chunkIndex: number;
  startPosition: number;
  endPosition: number;
  importance: number;
  similarityScore?: number;
  createdAt: string;
  updatedAt: string;
}

export class SQLiteStorageService {
  private static instance: SQLiteStorageService;
  private db: SQLite.SQLiteDatabase | null = null;
  private dbName = 'leai_documents.db';
  private isInitialized = false;

  private constructor() {}

  static getInstance(): SQLiteStorageService {
    if (!SQLiteStorageService.instance) {
      SQLiteStorageService.instance = new SQLiteStorageService();
    }
    return SQLiteStorageService.instance;
  }

  // Initialize database and create tables
  async initialize(): Promise<void> {
    try {
      console.log('SQLiteStorage: Initializing database...');
      
      // Check if already initialized
      if (this.isInitialized && this.db) {
        console.log('SQLiteStorage: Database already initialized');
        return;
      }

      // Open database
      this.db = await SQLite.openDatabaseAsync(this.dbName);
      
      if (!this.db) {
        throw new Error('Failed to open SQLite database');
      }

      console.log('SQLiteStorage: Database opened successfully');
      
      // Create documents table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          type TEXT NOT NULL,
          version INTEGER DEFAULT 1,
          hash TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          chunkCount INTEGER DEFAULT 0,
          importance REAL DEFAULT 1.0
        );
      `);

      console.log('SQLiteStorage: Documents table created/verified');

      // Create chunks table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS chunks (
          id TEXT PRIMARY KEY,
          documentId TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding TEXT NOT NULL,
          chunkIndex INTEGER NOT NULL,
          startPosition INTEGER NOT NULL,
          endPosition INTEGER NOT NULL,
          importance REAL DEFAULT 1.0,
          similarityScore REAL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      console.log('SQLiteStorage: Chunks table created/verified');

      // Create indexes for better performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks (documentId);
        CREATE INDEX IF NOT EXISTS idx_chunks_importance ON chunks (importance);
        CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (type);
      `);

      console.log('SQLiteStorage: Indexes created/verified');

      // Test database connection
      const testResult = await this.db.getFirstAsync('SELECT 1 as test;');
      if (!testResult) {
        throw new Error('Database connection test failed');
      }

      this.isInitialized = true;
      console.log('SQLiteStorage: Database initialized successfully');
    } catch (error) {
      console.error('SQLiteStorage: Failed to initialize database:', error);
      this.db = null;
      this.isInitialized = false;
      throw error;
    }
  }

  // Ensure database is initialized
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.db) {
      console.log('SQLiteStorage: Database not initialized, initializing now...');
      await this.initialize();
    }
  }

  // Save documents to SQLite
  async saveDocuments(documents: Map<string, DocumentMetadata>): Promise<void> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database not available');
      }

      console.log(`SQLiteStorage: Saving ${documents.size} documents...`);
      
      // Clear existing documents first
      await this.db.execAsync('DELETE FROM documents;');

      // Insert documents without transaction for now
      for (const document of documents.values()) {
        const sql = `
          INSERT INTO documents (
            id, title, content, type, version, hash, 
            createdAt, updatedAt, chunkCount, importance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        
        const values = [
          document.id,
          document.title,
          '', // We don't store full content in documents table
          document.type,
          document.version,
          document.hash,
          document.createdAt.toISOString(),
          document.updatedAt.toISOString(),
          document.chunkCount,
          document.importance
        ];
        
        const finalSql = sql.replace(/\?/g, () => {
          const value = values.shift();
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          return String(value);
        });
        
        await this.db.execAsync(finalSql);
      }
      
      console.log('SQLiteStorage: Documents saved successfully');
    } catch (error) {
      console.error('SQLiteStorage: Failed to save documents:', error);
      throw error;
    }
  }

  // Load documents from SQLite
  async loadDocuments(): Promise<Map<string, DocumentMetadata>> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database not available');
      }

      console.log('SQLiteStorage: Loading documents...');
      
      const result = await this.db.getAllAsync(`
        SELECT * FROM documents ORDER BY createdAt DESC;
      `) as DocumentRow[];

      const documents = new Map<string, DocumentMetadata>();

      for (const row of result) {
        const document: DocumentMetadata = {
          id: row.id,
          title: row.title,
          type: row.type,
          version: row.version,
          hash: row.hash,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
          chunkCount: row.chunkCount,
          importance: row.importance,
          chunks: new Map() // Will be populated when chunks are loaded
        };
        documents.set(row.id, document);
      }

      console.log(`SQLiteStorage: Loaded ${documents.size} documents`);
      return documents;
    } catch (error) {
      console.error('SQLiteStorage: Failed to load documents:', error);
      return new Map();
    }
  }

  // Save chunks to SQLite
  async saveChunks(chunks: Map<string, DocumentChunk>): Promise<void> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database not available');
      }

      console.log(`SQLiteStorage: Saving ${chunks.size} chunks...`);
      
      // Clear existing chunks first
      await this.db.execAsync('DELETE FROM chunks;');

      // Insert chunks in batches without transaction
      const batchSize = 50; // Reduced batch size for better reliability
      const chunksArray = Array.from(chunks.values());
      
      for (let i = 0; i < chunksArray.length; i += batchSize) {
        const batch = chunksArray.slice(i, i + batchSize);
        
        for (const chunk of batch) {
          const sql = `
            INSERT INTO chunks (
              id, documentId, content, embedding, chunkIndex, 
              startPosition, endPosition, importance, similarityScore,
              createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;
          
          const values = [
            chunk.id,
            chunk.documentId,
            chunk.content,
            JSON.stringify(chunk.embedding), // Store embedding as JSON string
            chunk.metadata.chunkIndex,
            chunk.metadata.startPosition,
            chunk.metadata.endPosition,
            chunk.metadata.importance,
            chunk.metadata.similarityScore || null,
            chunk.createdAt.toISOString(),
            chunk.updatedAt.toISOString()
          ];
          
          const finalSql = sql.replace(/\?/g, () => {
            const value = values.shift();
            if (typeof value === 'string') {
              return `'${value.replace(/'/g, "''")}'`;
            }
            if (value === null) {
              return 'NULL';
            }
            return String(value);
          });
          
          await this.db.execAsync(finalSql);
        }
        
        console.log(`SQLiteStorage: Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunksArray.length / batchSize)}`);
      }
      
      console.log('SQLiteStorage: Chunks saved successfully');
    } catch (error) {
      console.error('SQLiteStorage: Failed to save chunks:', error);
      throw error;
    }
  }

  // Load chunks from SQLite
  async loadChunks(): Promise<Map<string, DocumentChunk>> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database not available');
      }

      console.log('SQLiteStorage: Loading chunks...');
      
      const result = await this.db.getAllAsync(`
        SELECT * FROM chunks ORDER BY documentId, chunkIndex;
      `) as ChunkRow[];

      const chunks = new Map<string, DocumentChunk>();

      for (const row of result) {
        const chunk: DocumentChunk = {
          id: row.id,
          documentId: row.documentId,
          content: row.content,
          embedding: JSON.parse(row.embedding), // Parse embedding from JSON string
          metadata: {
            chunkIndex: row.chunkIndex,
            startPosition: row.startPosition,
            endPosition: row.endPosition,
            importance: row.importance,
            similarityScore: row.similarityScore
          },
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt)
        };
        chunks.set(row.id, chunk);
      }

      console.log(`SQLiteStorage: Loaded ${chunks.size} chunks`);
      return chunks;
    } catch (error) {
      console.error('SQLiteStorage: Failed to load chunks:', error);
      return new Map();
    }
  }

  // Save both documents and chunks
  async saveAll(documents: Map<string, DocumentMetadata>, chunks: Map<string, DocumentChunk>): Promise<void> {
    try {
      await this.ensureInitialized();
      
      await Promise.all([
        this.saveDocuments(documents),
        this.saveChunks(chunks)
      ]);
      console.log('SQLiteStorage: All data saved successfully');
    } catch (error) {
      console.error('SQLiteStorage: Failed to save all data:', error);
      throw error;
    }
  }

  // Load both documents and chunks
  async loadAll(): Promise<{ documents: Map<string, DocumentMetadata>, chunks: Map<string, DocumentChunk> }> {
    try {
      await this.ensureInitialized();
      
      const [documents, chunks] = await Promise.all([
        this.loadDocuments(),
        this.loadChunks()
      ]);

      // Link chunks to their documents
      for (const [chunkId, chunk] of chunks.entries()) {
        const document = documents.get(chunk.documentId);
        if (document) {
          document.chunks.set(chunkId, chunk);
        }
      }

      console.log(`SQLiteStorage: Loaded ${documents.size} documents with ${chunks.size} chunks`);
      return { documents, chunks };
    } catch (error) {
      console.error('SQLiteStorage: Failed to load all data:', error);
      return { documents: new Map(), chunks: new Map() };
    }
  }

  // Clear all stored data
  async clearAll(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database not available');
      }

      console.log('SQLiteStorage: Clearing all data...');
      
      // Clear data without transaction
      await this.db.execAsync('DELETE FROM chunks;');
      await this.db.execAsync('DELETE FROM documents;');
      
      console.log('SQLiteStorage: All data cleared');
    } catch (error) {
      console.error('SQLiteStorage: Failed to clear data:', error);
      throw error;
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<{ documentsCount: number; chunksCount: number; totalSize: number }> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database not available');
      }

      const [documentsResult, chunksResult] = await Promise.all([
        this.db.getFirstAsync('SELECT COUNT(*) as count FROM documents;'),
        this.db.getFirstAsync('SELECT COUNT(*) as count FROM chunks;')
      ]);

      const documentsCount = (documentsResult as any)?.count || 0;
      const chunksCount = (chunksResult as any)?.count || 0;

      // Estimate total size (rough calculation)
      const totalSize = (documentsCount * 1024) + (chunksCount * 2048); // Rough estimate

      return { documentsCount, chunksCount, totalSize };
    } catch (error) {
      console.error('SQLiteStorage: Failed to get storage stats:', error);
      return { documentsCount: 0, chunksCount: 0, totalSize: 0 };
    }
  }

  // Check if storage is available
  async checkStorageAvailability(): Promise<{ available: boolean; reason?: string }> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        return { available: false, reason: 'Database not available' };
      }

      // Try a simple query to check if database is accessible
      await this.db.getFirstAsync('SELECT 1;');
      return { available: true };
    } catch (error) {
      return { available: false, reason: `Database error: ${error}` };
    }
  }

  // Close database connection
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.closeAsync();
        console.log('SQLiteStorage: Database connection closed');
      } catch (error) {
        console.error('SQLiteStorage: Failed to close database:', error);
      } finally {
        this.db = null;
        this.isInitialized = false;
      }
    }
  }

  // Get database file size
  async getDatabaseSize(): Promise<number> {
    try {
      // This is a simplified approach - in a real app you'd use expo-file-system
      // to get the actual file size
      const stats = await this.getStorageStats();
      return stats.totalSize;
    } catch (error) {
      console.error('SQLiteStorage: Failed to get database size:', error);
      return 0;
    }
  }
} 