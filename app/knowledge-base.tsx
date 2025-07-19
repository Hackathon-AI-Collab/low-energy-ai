import { useTheme } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SampleDocumentService } from '../src/services/sampleDocuments';
import { SQLiteStorageService } from '../src/services/sqliteStorage';
import { VoyVectorStore } from '../src/services/voyVectorStore';

interface Document {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  isSample: boolean;
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
      
      await vectorStore.initialize();
      await storageService.initialize();
      
      // Load sample documents
      const sampleDocs = SampleDocumentService.getAllDocuments();
      
      // Load documents from vector store
      const storedDocs = await vectorStore.getAllDocuments();
      
      // Combine documents with unique keys
      const allDocs: Document[] = [
        ...sampleDocs.map(doc => ({
          id: `sample-${doc.id}`, // Prefix sample documents
          title: doc.title,
          type: doc.type,
          createdAt: new Date().toISOString(),
          isSample: true
        })),
        ...storedDocs.map(doc => ({
          id: `stored-${doc.id}`, // Prefix stored documents
          title: doc.title,
          type: doc.type,
          createdAt: doc.createdAt.toISOString(),
          isSample: false
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
          {item.isSample && (
            <View style={[styles.sampleBadge, { backgroundColor: '#FF9500' }]}>
              <Text style={styles.typeText}>SAMPLE</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.documentDate, { color: themeColors.text }]}>Added: {formatDate(item.createdAt)}</Text>
      <Text style={[styles.documentId, { color: themeColors.text }]}>ID: {item.id}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>No Documents Found</Text>
      <Text style={[styles.emptyStateSubtitle, { color: themeColors.text }]}>
        Documents will appear here once they are added to the knowledge base.
      </Text>
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
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sampleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
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
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
}); 