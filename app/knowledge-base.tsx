import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SampleDocumentService } from '../src/services/sampleDocuments';

interface Document {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

export default function KnowledgeBaseScreen() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ documents: 0, chunks: 0 });
  const router = useRouter();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      // Load sample documents
      const sampleDocs = SampleDocumentService.getAllDocuments();
      
      const docs: Document[] = sampleDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        createdAt: new Date().toISOString()
      }));
      
      setDocuments(docs);
      
      // Calculate stats (approximate chunks based on content length)
      const totalChunks = sampleDocs.reduce((total, doc) => {
        const chunks = Math.ceil(doc.content.length / 500); // Rough estimate
        return total + chunks;
      }, 0);
      
      setStats({ documents: docs.length, chunks: totalChunks });
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'Failed to load documents');
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

  const renderDocument = ({ item }: { item: Document }) => (
    <View style={styles.documentItem}>
      <View style={styles.documentHeader}>
        <Text style={styles.documentTitle}>{item.title}</Text>
        <View style={[styles.typeBadge, { backgroundColor: item.type === 'markdown' ? '#007AFF' : '#34C759' }]}>
          <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.documentDate}>Added: {formatDate(item.createdAt)}</Text>
      <Text style={styles.documentId}>ID: {item.id}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Documents Found</Text>
      <Text style={styles.emptyStateSubtitle}>
        Documents will appear here once they are added to the knowledge base.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Knowledge Base</Text>
        <Text style={styles.headerSubtitle}>Document Management</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.documents}</Text>
          <Text style={styles.statLabel}>Documents</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.chunks}</Text>
          <Text style={styles.statLabel}>Chunks</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>✓</Text>
          <Text style={styles.statLabel}>Model</Text>
        </View>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        style={styles.documentsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={documents.length === 0 ? styles.emptyListContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  documentsList: {
    flex: 1,
    padding: 10,
  },
  documentItem: {
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  documentDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  documentId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 