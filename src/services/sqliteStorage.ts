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

      // Insert documents
      for (const document of documents.values()) {
        const sql = `
          INSERT INTO documents (
            id, title, content, type, version, hash, 
            createdAt, updatedAt, chunkCount, importance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        
        const params = [
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
        
        await this.db.runAsync(sql, params);
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

      // Insert chunks in batches
      const batchSize = 10; // Reduced batch size for better reliability with large embeddings
      const chunksArray = Array.from(chunks.values());
      
      for (let i = 0; i < chunksArray.length; i += batchSize) {
        const batch = chunksArray.slice(i, i + batchSize);
        
        // Use transaction for each batch
        await this.db.execAsync('BEGIN TRANSACTION;');
        
        try {
          for (const chunk of batch) {
            // Optimize embedding storage for ONNX vectors
            let embeddingToStore = chunk.embedding;
            
            // Check embedding size and optimize if needed
            const embeddingJson = JSON.stringify(chunk.embedding);
            const embeddingSize = embeddingJson.length;
            
            console.log(`SQLiteStorage: Chunk ${chunk.id} embedding size: ${embeddingSize} bytes, dimension: ${chunk.embedding.length}`);
            
            if (embeddingSize > 500000) { // 500KB limit instead of 1MB for better performance
              console.warn(`SQLiteStorage: Large embedding detected for chunk ${chunk.id} (${embeddingSize} bytes)`);
              
              // For ONNX embeddings (384 dimensions), try to compress or optimize
              if (chunk.embedding.length === 384) {
                console.log(`SQLiteStorage: Processing ONNX embedding with ${chunk.embedding.length} dimensions`);
                
                // Round to fewer decimal places to reduce size while preserving quality
                embeddingToStore = chunk.embedding.map(val => Math.round(val * 10000) / 10000); // 4 decimal places
                const optimizedJson = JSON.stringify(embeddingToStore);
                console.log(`SQLiteStorage: Optimized embedding size: ${optimizedJson.length} bytes`);
                
                if (optimizedJson.length > 500000) {
                  console.warn(`SQLiteStorage: Still too large after optimization, using first 384 dimensions for ONNX`);
                  // For ONNX embeddings, keep first 384 dimensions (the actual model output dimension)
                  embeddingToStore = chunk.embedding.slice(0, 384);
                }
              } else {
                // For other embeddings, truncate to reasonable size
                console.log(`SQLiteStorage: Truncating non-ONNX embedding from ${chunk.embedding.length} to 200 dimensions`);
                embeddingToStore = chunk.embedding.slice(0, 200);
              }
            }
            
            const sql = `
              INSERT INTO chunks (
                id, documentId, content, embedding, chunkIndex, 
                startPosition, endPosition, importance, similarityScore,
                createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            
            const params = [
              chunk.id,
              chunk.documentId,
              chunk.content,
              JSON.stringify(embeddingToStore),
              chunk.metadata.chunkIndex,
              chunk.metadata.startPosition,
              chunk.metadata.endPosition,
              chunk.metadata.importance,
              chunk.metadata.similarityScore || null,
              chunk.createdAt.toISOString(),
              chunk.updatedAt.toISOString()
            ];
            
            await this.db.runAsync(sql, params);
          }
          
          await this.db.execAsync('COMMIT;');
          console.log(`SQLiteStorage: Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunksArray.length / batchSize)}`);
          
        } catch (batchError) {
          await this.db.execAsync('ROLLBACK;');
          console.error(`SQLiteStorage: Failed to save batch ${Math.floor(i / batchSize) + 1}:`, batchError);
          throw batchError;
        }
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

  // Verify embedding quality and source
  async verifyEmbeddings(): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    embeddingQuality: {
      onnxEmbeddings: number;
      hashEmbeddings: number;
      invalidEmbeddings: number;
      averageDimension: number;
      dimensionConsistency: boolean;
    };
    sampleEmbeddings: Array<{
      chunkId: string;
      dimension: number;
      firstValues: number[];
      embeddingType: 'onnx' | 'hash' | 'invalid';
      confidence: number;
    }>;
  }> {
    try {
      await this.ensureInitialized();
      
      if (!this.db) {
        throw new Error('Database not available');
      }

      console.log('🔍 SQLiteStorage: Starting embedding verification...');
      
      // Get all chunks with embeddings
      const chunks = await this.db.getAllAsync<ChunkRow>(`
        SELECT id, content, embedding, chunkIndex, documentId 
        FROM chunks 
        WHERE embedding IS NOT NULL AND embedding != ''
        ORDER BY chunkIndex
        LIMIT 100
      `);

      console.log(`📊 SQLiteStorage: Found ${chunks.length} chunks with embeddings`);

      const results = {
        totalChunks: chunks.length,
        chunksWithEmbeddings: 0,
        embeddingQuality: {
          onnxEmbeddings: 0,
          hashEmbeddings: 0,
          invalidEmbeddings: 0,
          averageDimension: 0,
          dimensionConsistency: true
        },
        sampleEmbeddings: [] as Array<{
          chunkId: string;
          dimension: number;
          firstValues: number[];
          embeddingType: 'onnx' | 'hash' | 'invalid';
          confidence: number;
        }>
      };

      let totalDimension = 0;
      const dimensions = new Set<number>();

      for (const chunk of chunks) {
        try {
          // Parse embedding from JSON
          const embedding = JSON.parse(chunk.embedding) as number[];
          
          if (!Array.isArray(embedding) || embedding.length === 0) {
            console.warn(`⚠️ SQLiteStorage: Invalid embedding format for chunk ${chunk.id}`);
            results.embeddingQuality.invalidEmbeddings++;
            continue;
          }

          results.chunksWithEmbeddings++;
          totalDimension += embedding.length;
          dimensions.add(embedding.length);

          // Analyze embedding characteristics to determine source
          const embeddingType = this.analyzeEmbeddingType(embedding);
          const confidence = this.calculateEmbeddingConfidence(embedding);

          if (embeddingType === 'onnx') {
            results.embeddingQuality.onnxEmbeddings++;
          } else if (embeddingType === 'hash') {
            results.embeddingQuality.hashEmbeddings++;
          } else {
            results.embeddingQuality.invalidEmbeddings++;
          }

          // Add sample embedding info
          results.sampleEmbeddings.push({
            chunkId: chunk.id,
            dimension: embedding.length,
            firstValues: embedding.slice(0, 5),
            embeddingType,
            confidence
          });

        } catch (error) {
          console.error(`❌ SQLiteStorage: Failed to parse embedding for chunk ${chunk.id}:`, error);
          results.embeddingQuality.invalidEmbeddings++;
        }
      }

      // Calculate statistics
      results.embeddingQuality.averageDimension = totalDimension / Math.max(results.chunksWithEmbeddings, 1);
      results.embeddingQuality.dimensionConsistency = dimensions.size <= 2; // Allow for slight variations

      // Log verification results
      console.log('📊 SQLiteStorage: Embedding Verification Results');
      console.log(`📄 Total chunks analyzed: ${results.totalChunks}`);
      console.log(`🔍 Chunks with valid embeddings: ${results.chunksWithEmbeddings}`);
      console.log(`🤖 ONNX embeddings: ${results.embeddingQuality.onnxEmbeddings}`);
      console.log(`🔧 Hash embeddings: ${results.embeddingQuality.hashEmbeddings}`);
      console.log(`❌ Invalid embeddings: ${results.embeddingQuality.invalidEmbeddings}`);
      console.log(`📏 Average dimension: ${results.embeddingQuality.averageDimension.toFixed(2)}`);
      console.log(`📊 Dimension consistency: ${results.embeddingQuality.dimensionConsistency}`);

      // Log sample embeddings
      console.log('\n📋 Sample Embeddings:');
      results.sampleEmbeddings.slice(0, 5).forEach((sample, index) => {
        console.log(`${index + 1}. ${sample.chunkId}:`);
        console.log(`   Type: ${sample.embeddingType} (confidence: ${sample.confidence.toFixed(3)})`);
        console.log(`   Dimension: ${sample.dimension}`);
        console.log(`   First 5 values: [${sample.firstValues.map(v => v.toFixed(4)).join(', ')}]`);
      });

      return results;

    } catch (error) {
      console.error('❌ SQLiteStorage: Failed to verify embeddings:', error);
      return {
        totalChunks: 0,
        chunksWithEmbeddings: 0,
        embeddingQuality: {
          onnxEmbeddings: 0,
          hashEmbeddings: 0,
          invalidEmbeddings: 0,
          averageDimension: 0,
          dimensionConsistency: false
        },
        sampleEmbeddings: []
      };
    }
  }

  // Analyze embedding type based on characteristics
  private analyzeEmbeddingType(embedding: number[]): 'onnx' | 'hash' | 'invalid' {
    try {
      // Check dimension (ONNX models typically have specific dimensions)
      const dimension = embedding.length;
      
      console.log(`🔍 SQLiteStorage: Analyzing embedding with dimension: ${dimension}`);
      
      // Common ONNX model dimensions (including flattened tensors)
      const onnxDimensions = [384, 768, 512, 256, 128]; // 384 is the expected ONNX output dimension
      
      // Check if dimension matches ONNX model
      if (onnxDimensions.includes(dimension)) {
        console.log(`🔍 SQLiteStorage: Dimension ${dimension} matches ONNX model dimensions`);
        
        // Improved ONNX characteristic checks
        const hasSmallValues = embedding.some(val => Math.abs(val) < 0.1); // Relaxed threshold
        const hasVariedValues = new Set(embedding.map(val => Math.round(val * 1000) / 1000)).size > dimension * 0.5; // Relaxed threshold
        const isNormalized = Math.abs(Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) - 1.0) < 0.1; // Check if unit vector
        const hasReasonableRange = embedding.every(val => Math.abs(val) <= 2.0); // Check value range
        
        console.log(`🔍 SQLiteStorage: ONNX checks:`);
        console.log(`  - hasSmallValues: ${hasSmallValues} (some values < 0.1)`);
        console.log(`  - hasVariedValues: ${hasVariedValues} (unique ratio > 0.5)`);
        console.log(`  - isNormalized: ${isNormalized} (unit vector)`);
        console.log(`  - hasReasonableRange: ${hasReasonableRange} (all values <= 2.0)`);
        
        // More flexible ONNX detection - if dimension is correct and it's normalized, it's likely ONNX
        if (isNormalized && hasReasonableRange && (hasSmallValues || hasVariedValues)) {
          console.log(`✅ SQLiteStorage: Classified as ONNX embedding`);
          return 'onnx';
        }
        
        // Alternative: if dimension is 384 and it's normalized, assume ONNX
        if (dimension === 384 && isNormalized) {
          console.log(`✅ SQLiteStorage: Classified as ONNX embedding (384-dim normalized)`);
          return 'onnx';
        }
      }

      // Check for hash embedding characteristics
      const hasRepeatingPatterns = this.checkForHashPatterns(embedding);
      if (hasRepeatingPatterns) {
        console.log(`🔧 SQLiteStorage: Classified as hash embedding`);
        return 'hash';
      }

      // If dimension is very small or very large, likely invalid
      if (dimension < 10 || dimension > 1000) {
        console.log(`❌ SQLiteStorage: Classified as invalid embedding (dimension: ${dimension})`);
        return 'invalid';
      }

      // Default to hash if uncertain
      console.log(`🔧 SQLiteStorage: Defaulting to hash embedding (uncertain)`);
      return 'hash';

    } catch (error) {
      console.error('Error analyzing embedding type:', error);
      return 'invalid';
    }
  }

  // Check for hash embedding patterns
  private checkForHashPatterns(embedding: number[]): boolean {
    try {
      // Hash embeddings often have repeating patterns or simple distributions
      const uniqueValues = new Set(embedding.map(val => Math.round(val * 100) / 100));
      const uniqueRatio = uniqueValues.size / embedding.length;
      
      // Hash embeddings typically have fewer unique values
      if (uniqueRatio < 0.3) {
        return true;
      }

      // Check for simple mathematical patterns
      const hasSimplePatterns = embedding.some((val, i) => {
        if (i > 0) {
          const diff = Math.abs(val - embedding[i - 1]);
          return diff < 0.001 || diff > 0.999;
        }
        return false;
      });

      return hasSimplePatterns;

    } catch (error) {
      return false;
    }
  }

  // Calculate confidence in embedding quality
  private calculateEmbeddingConfidence(embedding: number[]): number {
    try {
      let confidence = 0;

      // Check normalization (should be close to unit vector)
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      const normalizationError = Math.abs(magnitude - 1.0);
      
      if (normalizationError < 0.1) {
        confidence += 0.3;
      } else if (normalizationError < 0.5) {
        confidence += 0.1;
      }

      // Check for reasonable value ranges
      const hasReasonableValues = embedding.every(val => Math.abs(val) <= 2.0);
      if (hasReasonableValues) {
        confidence += 0.2;
      }

      // Check for non-zero variance
      const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
      const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embedding.length;
      
      if (variance > 0.01) {
        confidence += 0.3;
      }

      // Check dimension appropriateness
      const dimension = embedding.length;
      if (dimension >= 128 && dimension <= 768) {
        confidence += 0.2;
      }

      return Math.min(confidence, 1.0);

    } catch (error) {
      return 0;
    }
  }
} 