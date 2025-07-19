import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { SampleDocumentService } from '../src/services/sampleDocuments';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

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
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

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
    <View style={styles.documentItem(themeColors)}>
      <View style={styles.documentHeader}>
        <Text style={styles.documentTitle(themeColors)}>{item.title}</Text>
        <View style={[styles.typeBadge, { backgroundColor: item.type === 'markdown' ? '#007AFF' : '#34C759' }]}>
          <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
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

  return (
    <View style={styles.container(themeColors)}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Knowledge Base</Text>
        <Text style={styles.headerSubtitle}>Document Management</Text>
      </View>

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
          <Text style={styles.statNumber(themeColors)}>✓</Text>
          <Text style={styles.statLabel(themeColors)}>Model</Text>
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
    marginBottom: 10,
  },
  documentTitle: (themeColors) => ({
    fontSize: 17,
    fontWeight: '600',
    color: themeColors.text,
    flex: 1,
  }),
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginLeft: 10,
  },
  typeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  documentDate: (themeColors) => ({
    fontSize: 14,
    color: themeColors.text,
    opacity: 0.6,
    marginBottom: 6,
  }),
  documentId: (themeColors) => ({
    fontSize: 12,
    color: themeColors.text,
    opacity: 0.4,
    fontFamily: 'monospace',
  }),
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    opacity: 0.7,
  },
  emptyStateTitle: (themeColors) => ({
    fontSize: 18,
    fontWeight: 'bold',
    color: themeColors.text,
    marginBottom: 10,
  }),
  emptyStateSubtitle: (themeColors) => ({
    fontSize: 14,
    color: themeColors.text,
    textAlign: 'center',
    lineHeight: 20,
  }),
}); 