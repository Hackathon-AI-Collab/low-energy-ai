import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { DocumentUploadService } from '../src/services/documentUploadService';
import { SampleDocumentService } from '../src/services/sampleDocuments';

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StorageStats>({ 
    documents: 0, 
    chunks: 0, 
    totalSize: 0, 
    available: true 
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      
      // Load sample documents
      const sampleDocs = SampleDocumentService.getAllDocuments();
      
      // Load uploaded documents
      const uploadService = DocumentUploadService.getInstance();
      await uploadService.initialize();
      const uploadedDocs = await uploadService.getUploadedDocuments();
      
      // Combine documents
      const allDocs: Document[] = [
        ...sampleDocs.map(doc => ({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          createdAt: new Date().toISOString(),
          isSample: true
        })),
        ...uploadedDocs.map(doc => ({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          createdAt: doc.uploadedAt.toISOString(),
          isSample: false
        }))
      ];
      
      setDocuments(allDocs);
      
      // Get storage statistics
      const storageStats = await uploadService.getStorageStats();
      setStats(storageStats);
      
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
    <View style={styles.documentItem(themeColors)}>
      <View style={styles.documentHeader}>
        <Text style={styles.documentTitle(themeColors)}>{item.title}</Text>
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
      <Text style={styles.documentDate(themeColors)}>Added: {formatDate(item.createdAt)}</Text>
      <Text style={styles.documentId(themeColors)}>ID: {item.id}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle(themeColors)}>No Documents Found</Text>
      <Text style={styles.emptyStateSubtitle(themeColors)}>
        Documents will appear here once they are added to the knowledge base.
      </Text>
    </View>
  );

  const renderStorageWarning = () => {
    if (!stats.available) {
      return (
        <View style={styles.warningContainer(themeColors)}>
          <Text style={styles.warningText(themeColors)}>⚠️ Storage Warning</Text>
          <Text style={styles.warningSubtext(themeColors)}>{stats.reason}</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer(themeColors)}>
        <ActivityIndicator size="large" color={themeColors.tint} />
        <Text style={styles.loadingText(themeColors)}>Loading knowledge base...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container(themeColors)}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Knowledge Base</Text>
        <Text style={styles.headerSubtitle}>Document Management</Text>
      </View>

      {renderStorageWarning()}

      <View style={styles.statsContainer(themeColors)}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber(themeColors)}>{stats.documents}</Text>
          <Text style={styles.statLabel(themeColors)}>Documents</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber(themeColors)}>{stats.chunks}</Text>
          <Text style={styles.statLabel(themeColors)}>Chunks</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber(themeColors)}>{formatFileSize(stats.totalSize)}</Text>
          <Text style={styles.statLabel(themeColors)}>Storage</Text>
        </View>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        style={styles.documentsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[themeColors.tint]} tintColor={themeColors.tint} />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={documents.length === 0 ? styles.emptyListContainer : { paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: (themeColors) => ({
    flex: 1,
    backgroundColor: themeColors.background,
  }),
  loadingContainer: (themeColors) => ({
    flex: 1,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  }),
  loadingText: (themeColors) => ({
    marginTop: 10,
    fontSize: 16,
    color: themeColors.text,
  }),
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
  warningContainer: (themeColors) => ({
    backgroundColor: '#FFE5E5',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  }),
  warningText: (themeColors) => ({
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
  }),
  warningSubtext: (themeColors) => ({
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 5,
  }),
  statsContainer: (themeColors) => ({
    flexDirection: 'row',
    backgroundColor: themeColors.background,
    margin: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  }),
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: (themeColors) => ({
    fontSize: 28,
    fontWeight: 'bold',
    color: themeColors.tint,
  }),
  statLabel: (themeColors) => ({
    fontSize: 13,
    color: themeColors.text,
    opacity: 0.7,
    marginTop: 4,
  }),
  documentsList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  documentItem: (themeColors) => ({
    backgroundColor: themeColors.background,
    marginBottom: 12,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  }),
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentTitle: (themeColors) => ({
    fontSize: 16,
    fontWeight: '600',
    color: themeColors.text,
    flex: 1,
    marginRight: 10,
  }),
  badgeContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sampleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  documentDate: (themeColors) => ({
    fontSize: 14,
    color: themeColors.text,
    opacity: 0.7,
    marginTop: 8,
  }),
  documentId: (themeColors) => ({
    fontSize: 12,
    color: themeColors.text,
    opacity: 0.5,
    marginTop: 4,
  }),
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStateTitle: (themeColors) => ({
    fontSize: 18,
    fontWeight: 'bold',
    color: themeColors.text,
    marginBottom: 8,
  }),
  emptyStateSubtitle: (themeColors) => ({
    fontSize: 14,
    color: themeColors.text,
    opacity: 0.7,
    textAlign: 'center',
    paddingHorizontal: 20,
  }),
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
}); 