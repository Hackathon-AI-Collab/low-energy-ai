import { useTheme } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AssetDocumentService } from '../src/services/assetDocumentService';
import { SQLiteStorageService } from '../src/services/sqliteStorage';
import { VoyVectorStore } from '../src/services/voyVectorStore';

interface Document {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  isAsset?: boolean;
  category?: string;
  description?: string;
}

interface StorageStats {
  documents: number;
  chunks: number;
  totalSize: number;
  available: boolean;
  reason?: string;
}

export default function KnowledgeBaseScreen() {
  const { colors: themeColors } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [verifyingEmbeddings, setVerifyingEmbeddings] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<any>(null);
  const [stats, setStats] = useState<StorageStats>({
    documents: 0,
    chunks: 0,
    totalSize: 0,
    available: true
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      
      // Initialize services
      const vectorStore = new VoyVectorStore();
      const storageService = SQLiteStorageService.getInstance();
      const assetService = AssetDocumentService.getInstance();
      
      await vectorStore.initialize();
      await storageService.initialize();
      
      // Load documents from vector store
      const storedDocs = await vectorStore.getAllDocuments();
      
      // Load asset documents metadata
      const assetDocs = assetService.getAllDocuments();
      
      // Combine documents with unique keys
      const allDocs: Document[] = [
        ...storedDocs.map(doc => ({
          id: `stored-${doc.id}`,
          title: doc.title,
          type: doc.type,
          createdAt: doc.createdAt.toISOString(),
          isAsset: false
        })),
        ...assetDocs.map(doc => ({
          id: `asset-${doc.id}`,
          title: doc.title,
          type: 'markdown',
          createdAt: new Date().toISOString(),
          isAsset: true,
          category: doc.category,
          description: doc.description
        }))
      ];
      
      setDocuments(allDocs);
      
      // Get storage statistics
      const storageStats = await storageService.getStorageStats();
      const availability = await storageService.checkStorageAvailability();
      
      setStats({
        documents: storageStats.documentsCount,
        chunks: storageStats.chunksCount,
        totalSize: storageStats.totalSize,
        available: availability.available,
        reason: availability.reason
      });
      
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadAssetDocuments = async () => {
    try {
      setLoadingAssets(true);
      
      // Documents are now loaded automatically on app startup
      // This function is kept for compatibility but shows status instead
      
      const { DocumentLoader } = await import('../src/services/documentLoader');
      const documentLoader = DocumentLoader.getInstance();
      const status = documentLoader.getLoadingStatus();
      
      if (status.documentsLoaded) {
        Alert.alert(
          'Documents Already Loaded',
          'Documents are automatically loaded from assets/documents/ when the app starts. All 16 documents are ready for RAG queries.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Documents Not Loaded',
          'Documents should be loaded automatically. Please restart the app to load documents.',
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('Error checking document status:', error);
      Alert.alert('Error', 'Failed to check document status');
    } finally {
      setLoadingAssets(false);
    }
  };

  const performCompleteLoad = async (assetService: AssetDocumentService, vectorStore: VoyVectorStore, clearExisting: boolean) => {
    try {
      console.log('🚀 Starting complete document load process...');
      
      // Step 1: Clear existing data if needed
      if (clearExisting) {
        console.log('🗑️ Clearing existing data...');
        await vectorStore.clearAll();
        console.log('✅ Existing data cleared');
      }
      
      // Step 2: Load documents directly from directory (more efficient)
      console.log('📚 Loading asset documents from directory...');
      const loadResults = await assetService.loadAllDocumentsFromDirectory();
      console.log(`✅ Documents loaded: ${loadResults.success} success, ${loadResults.failed} failed`);
      
      if (loadResults.success === 0) {
        Alert.alert('No Documents Loaded', 'No documents were successfully loaded. Please check your asset configuration.');
        return;
      }
      
      // Step 3: Generate embeddings (this happens automatically during document loading)
      console.log('🔍 Embeddings should be generated automatically during document loading');
      
      // Step 4: Verify embeddings
      console.log('🔍 Verifying embeddings...');
      const verificationResults = await vectorStore.verifyStoredEmbeddings();
      
      // Step 5: Show results
      const onnxCount = verificationResults.storedEmbeddings?.embeddingQuality?.onnxEmbeddings || 0;
      const hashCount = verificationResults.storedEmbeddings?.embeddingQuality?.hashEmbeddings || 0;
      const totalChunks = verificationResults.storedEmbeddings?.totalChunks || 0;
      const averageDimension = verificationResults.storedEmbeddings?.embeddingQuality?.averageDimension || 0;
      const quality = verificationResults.assessment?.quality || 'unknown';
      
      console.log(`📊 Verification Results:`);
      console.log(`  - Total chunks: ${totalChunks}`);
      console.log(`  - ONNX embeddings: ${onnxCount}`);
      console.log(`  - Hash embeddings: ${hashCount}`);
      console.log(`  - Average dimension: ${averageDimension.toFixed(2)}`);
      console.log(`  - Quality: ${quality}`);
      
      // Step 6: Show success message with details
      let message = `Successfully loaded ${loadResults.success} documents.\n\n`;
      message += `📊 Embedding Results:\n`;
      message += `• Total chunks: ${totalChunks}\n`;
      message += `• ONNX embeddings: ${onnxCount}\n`;
      message += `• Hash embeddings: ${hashCount}\n`;
      message += `• Average dimension: ${averageDimension.toFixed(2)}\n`;
      message += `• Quality: ${quality.toUpperCase()}`;
      
      if (onnxCount > 0) {
        message += `\n\n✅ ONNX model is working correctly!`;
      } else if (hashCount > 0) {
        message += `\n\n⚠️ Using hash-based embeddings (ONNX model may not be available)`;
      }
      
      Alert.alert(
        'Documents Loaded Successfully',
        message,
        [{ text: 'OK', onPress: () => loadDocuments() }]
      );
      
    } catch (error) {
      console.error('Error in complete load process:', error);
      Alert.alert('Error', 'Failed to complete document loading process');
    }
  };

  const verifyEmbeddings = async () => {
    try {
      setVerifyingEmbeddings(true);
      
      const vectorStore = new VoyVectorStore();
      await vectorStore.initialize();
      
      console.log('🔍 Starting embedding verification...');
      const results = await vectorStore.verifyStoredEmbeddings();
      
      console.log('📊 Verification completed');
      
      // Show results in alert
      const onnxCount = results.storedEmbeddings?.embeddingQuality?.onnxEmbeddings || 0;
      const hashCount = results.storedEmbeddings?.embeddingQuality?.hashEmbeddings || 0;
      const totalChunks = results.storedEmbeddings?.totalChunks || 0;
      const averageDimension = results.storedEmbeddings?.embeddingQuality?.averageDimension || 0;
      const quality = results.assessment?.quality || 'unknown';
      
      let message = `📊 Embedding Verification Results:\n\n`;
      message += `• Total chunks: ${totalChunks}\n`;
      message += `• ONNX embeddings: ${onnxCount}\n`;
      message += `• Hash embeddings: ${hashCount}\n`;
      message += `• Average dimension: ${averageDimension.toFixed(2)}\n`;
      message += `• Quality: ${quality.toUpperCase()}`;
      
      if (onnxCount > 0) {
        message += `\n\n✅ ONNX model is working correctly!`;
      } else if (hashCount > 0) {
        message += `\n\n⚠️ Using hash-based embeddings (ONNX model may not be available)`;
      }
      
      Alert.alert('Embedding Verification', message);
      
    } catch (error) {
      console.error('Error verifying embeddings:', error);
      Alert.alert('Error', 'Failed to verify embeddings');
    } finally {
      setVerifyingEmbeddings(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <View style={[styles.documentItem, { backgroundColor: themeColors.background }]}>
      <View style={styles.documentHeader}>
        <Text style={[styles.documentTitle, { color: themeColors.text }]}>{item.title}</Text>
        <View style={styles.badgeContainer}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === 'markdown' ? '#007AFF' : '#34C759' }]}>
            <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
          </View>
          {item.isAsset && (
            <View style={[styles.assetBadge, { backgroundColor: '#AF52DE' }]}>
              <Text style={styles.typeText}>ASSET</Text>
            </View>
          )}
          {item.category && (
            <View style={[styles.categoryBadge, { backgroundColor: '#30D158' }]}>
              <Text style={styles.typeText}>{item.category.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>
      {item.description && (
        <Text style={[styles.documentDescription, { color: themeColors.text }]}>{item.description}</Text>
      )}
      <Text style={[styles.documentDate, { color: themeColors.text }]}>Added: {formatDate(item.createdAt)}</Text>
      <Text style={[styles.documentId, { color: themeColors.text }]}>ID: {item.id}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>No Documents Found</Text>
      <Text style={[styles.emptyStateSubtitle, { color: themeColors.text }]}>
        Load the medical and emergency response documents to get started.
      </Text>
      <TouchableOpacity 
        style={[styles.loadButton, { backgroundColor: themeColors.primary }]}
        onPress={loadAssetDocuments}
        disabled={loadingAssets}
      >
        <Text style={styles.loadButtonText}>
          {loadingAssets ? 'Loading...' : 'Load Asset Documents'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStorageWarning = () => {
    if (!stats.available) {
      return (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>⚠️ Storage Warning</Text>
          <Text style={styles.warningSubtext}>{stats.reason}</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.text }]}>Loading knowledge base...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Knowledge Base</Text>
        <Text style={styles.headerSubtitle}>Document Management</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
            onPress={loadAssetDocuments}
            disabled={loadingAssets}
          >
            <Text style={styles.headerButtonText}>
              {loadingAssets ? 'Loading...' : '📚 Load Documents'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)', marginLeft: 10 }]}
            onPress={verifyEmbeddings}
            disabled={verifyingEmbeddings}
          >
            <Text style={styles.headerButtonText}>
              {verifyingEmbeddings ? 'Checking...' : '🔍 Verify Embeddings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderStorageWarning()}

      <View style={[styles.statsContainer, { backgroundColor: themeColors.background }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: themeColors.primary }]}>{stats.documents}</Text>
          <Text style={[styles.statLabel, { color: themeColors.text }]}>Documents</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: themeColors.primary }]}>{stats.chunks}</Text>
          <Text style={[styles.statLabel, { color: themeColors.text }]}>Chunks</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: themeColors.primary }]}>{formatFileSize(stats.totalSize)}</Text>
          <Text style={[styles.statLabel, { color: themeColors.text }]}>Storage</Text>
        </View>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        style={styles.documentsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[themeColors.primary]} tintColor={themeColors.primary} />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={documents.length === 0 ? styles.emptyListContainer : { paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    marginBottom: 15,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: '#FFE5E5',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  warningText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  warningSubtext: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 4,
  },
  documentsList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  documentItem: {
    marginBottom: 12,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  assetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  documentDescription: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
  },
  documentDate: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
  },
  documentId: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.5,
    fontFamily: 'monospace',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  loadButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
}); 