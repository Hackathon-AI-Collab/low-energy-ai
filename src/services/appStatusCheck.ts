import { ModelSettingsService } from './modelSettings';
import { SentenceTransformer } from './sentenceTransformer';
import { VectorRAG } from './vectorRAG';
import { SQLiteVectorStorage } from './sqliteVectorStorage';

export interface AppStatus {
  sentenceTransformer: {
    initialized: boolean;
    modelLoaded: boolean;
    modelName: string;
    dimension: number;
    ready: boolean;
  };
  vectorStorage: {
    initialized: boolean;
    documentCount: number;
    chunkCount: number;
    ready: boolean;
  };
  vectorRAG: {
    initialized: boolean;
    llmReady: boolean;
    ready: boolean;
  };
  settings: {
    loaded: boolean;
    sentenceTransformerModel: string;
    sentenceTransformerPath: string;
    similarityMethod: string;
  };
  overall: {
    ready: boolean;
    errors: string[];
    warnings: string[];
  };
}

export async function checkAppStatus(): Promise<AppStatus> {
  const status: AppStatus = {
    sentenceTransformer: {
      initialized: false,
      modelLoaded: false,
      modelName: '',
      dimension: 0,
      ready: false
    },
    vectorStorage: {
      initialized: false,
      documentCount: 0,
      chunkCount: 0,
      ready: false
    },
    vectorRAG: {
      initialized: false,
      llmReady: false,
      ready: false
    },
    settings: {
      loaded: false,
      sentenceTransformerModel: '',
      sentenceTransformerPath: '',
      similarityMethod: ''
    },
    overall: {
      ready: false,
      errors: [],
      warnings: []
    }
  };

  try {
    console.log('🔍 Starting comprehensive app status check...');

    // Check Model Settings
    try {
      const settings = ModelSettingsService.getInstance();
      const settingsData = settings.getSettings();
      status.settings = {
        loaded: true,
        sentenceTransformerModel: settingsData.sentenceTransformerModel,
        sentenceTransformerPath: settingsData.sentenceTransformerPath || 'Not set',
        similarityMethod: settingsData.similarityMethod
      };
      console.log('✅ Model settings loaded');
    } catch (error) {
      status.overall.errors.push(`Settings error: ${error}`);
      console.error('❌ Model settings error:', error);
    }

    // Check Sentence Transformer
    try {
      const transformer = new SentenceTransformer();
      await transformer.initialize();
      
      status.sentenceTransformer = {
        initialized: true,
        modelLoaded: transformer.isModelReady(),
        modelName: transformer.getModelName(),
        dimension: transformer.getDimension(),
        ready: transformer.isReady()
      };

      // Test embedding generation
      const testEmbedding = await transformer.generateEmbedding('test');
      if (testEmbedding.length === status.sentenceTransformer.dimension) {
        console.log('✅ Sentence transformer working correctly');
      } else {
        status.overall.warnings.push('Embedding dimension mismatch');
      }
    } catch (error) {
      status.overall.errors.push(`Sentence transformer error: ${error}`);
      console.error('❌ Sentence transformer error:', error);
    }

    // Check SQLite Vector Storage
    try {
      const vectorStorage = new SQLiteVectorStorage();
      await vectorStorage.initialize();
      
      const stats = await vectorStorage.getDocumentStats();
      status.vectorStorage = {
        initialized: true,
        documentCount: stats.documents,
        chunkCount: stats.chunks,
        ready: true
      };
      console.log('✅ SQLite vector storage working correctly');
    } catch (error) {
      status.overall.errors.push(`Vector storage error: ${error}`);
      console.error('❌ Vector storage error:', error);
    }

    // Check Vector RAG
    try {
      const vectorRAG = VectorRAG.getInstance();
      await vectorRAG.initialize();
      
      status.vectorRAG = {
        initialized: true,
        llmReady: true, // Assuming it's ready if initialization succeeds
        ready: true
      };

      // Test a simple query
      const testResponse = await vectorRAG.query('What is TCCC?');
      if (testResponse.text && testResponse.text.length > 0) {
        console.log('✅ Vector RAG working correctly');
      } else {
        status.overall.warnings.push('RAG response empty');
      }
    } catch (error) {
      status.overall.errors.push(`Vector RAG error: ${error}`);
      console.error('❌ Vector RAG error:', error);
    }

    // Determine overall status
    status.overall.ready = 
      status.sentenceTransformer.ready &&
      status.vectorStorage.ready &&
      status.vectorRAG.ready &&
      status.overall.errors.length === 0;

    if (status.overall.ready) {
      console.log('🎉 App status check completed successfully!');
    } else {
      console.log('⚠️ App status check completed with issues');
    }

    return status;

  } catch (error) {
    console.error('❌ App status check failed:', error);
    status.overall.errors.push(`Status check error: ${error}`);
    return status;
  }
}

export function printAppStatus(status: AppStatus): void {
  console.log('\n📊 APP STATUS REPORT');
  console.log('====================');
  
  console.log('\n🤖 Sentence Transformer:');
  console.log(`  Initialized: ${status.sentenceTransformer.initialized ? '✅' : '❌'}`);
  console.log(`  Model Loaded: ${status.sentenceTransformer.modelLoaded ? '✅' : '⚠️'}`);
  console.log(`  Model Name: ${status.sentenceTransformer.modelName}`);
  console.log(`  Dimension: ${status.sentenceTransformer.dimension}`);
  console.log(`  Ready: ${status.sentenceTransformer.ready ? '✅' : '❌'}`);

  console.log('\n🗄️ SQLite Vector Storage:');
  console.log(`  Initialized: ${status.vectorStorage.initialized ? '✅' : '❌'}`);
  console.log(`  Documents: ${status.vectorStorage.documentCount}`);
  console.log(`  Chunks: ${status.vectorStorage.chunkCount}`);
  console.log(`  Ready: ${status.vectorStorage.ready ? '✅' : '❌'}`);

  console.log('\n🧠 Voy RAG:');
  console.log(`  Initialized: ${status.vectorRAG.initialized ? '✅' : '❌'}`);
  console.log(`  LLM Ready: ${status.vectorRAG.llmReady ? '✅' : '❌'}`);
  console.log(`  Ready: ${status.vectorRAG.ready ? '✅' : '❌'}`);

  console.log('\n⚙️ Settings:');
  console.log(`  Loaded: ${status.settings.loaded ? '✅' : '❌'}`);
  console.log(`  Model Type: ${status.settings.sentenceTransformerModel}`);
  console.log(`  Model Path: ${status.settings.sentenceTransformerPath}`);
  console.log(`  Similarity Method: ${status.settings.similarityMethod}`);

  console.log('\n🎯 Overall Status:');
  console.log(`  Ready: ${status.overall.ready ? '✅' : '❌'}`);
  
  if (status.overall.errors.length > 0) {
    console.log('\n❌ Errors:');
    status.overall.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (status.overall.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    status.overall.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  console.log('\n====================\n');
} 