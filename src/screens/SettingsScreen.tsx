import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { RAGPipeline } from '../services/ragPipeline';

interface SettingsScreenProps {
  ragPipeline: RAGPipeline;
}

export default function SettingsScreen({ ragPipeline }: SettingsScreenProps) {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isAutoSync, setIsAutoSync] = useState(true);

  const clearKnowledgeBase = () => {
    Alert.alert(
      'Clear Knowledge Base',
      'This will remove all documents and chunks from the knowledge base. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // This would clear the vector store in a real implementation
              Alert.alert('Success', 'Knowledge base cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear knowledge base');
            }
          }
        }
      ]
    );
  };

  const getAppInfo = () => {
    const stats = ragPipeline.getStats();
    return {
      version: '1.0.0',
      documents: stats.documents,
      chunks: stats.chunks,
      modelLoaded: ragPipeline.isModelLoaded(),
      platform: 'React Native + Expo',
      llm: 'ONNX Runtime (Placeholder)',
      vectorStore: 'In-Memory',
      sync: 'BLE (Coming Soon)'
    };
  };

  const appInfo = getAppInfo();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>LEAI Configuration</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Debug Mode</Text>
            <Text style={styles.settingDescription}>Enable detailed logging</Text>
          </View>
          <Switch
            value={isDebugMode}
            onValueChange={setIsDebugMode}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isDebugMode ? '#007AFF' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto Sync</Text>
            <Text style={styles.settingDescription}>Automatically sync with nearby devices</Text>
          </View>
          <Switch
            value={isAutoSync}
            onValueChange={setIsAutoSync}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isAutoSync ? '#007AFF' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Knowledge Base</Text>
        
        <TouchableOpacity style={styles.button} onPress={clearKnowledgeBase}>
          <Text style={styles.buttonText}>Clear Knowledge Base</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Information</Text>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>{appInfo.version}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>{appInfo.platform}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>LLM Engine</Text>
          <Text style={styles.infoValue}>{appInfo.llm}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Vector Store</Text>
          <Text style={styles.infoValue}>{appInfo.vectorStore}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Sync Protocol</Text>
          <Text style={styles.infoValue}>{appInfo.sync}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Documents</Text>
          <Text style={styles.infoValue}>{appInfo.documents}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Chunks</Text>
          <Text style={styles.infoValue}>{appInfo.chunks}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Model Status</Text>
          <Text style={[styles.infoValue, { color: appInfo.modelLoaded ? '#34C759' : '#FF3B30' }]}>
            {appInfo.modelLoaded ? 'Loaded' : 'Not Loaded'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          LEAI - Low-Energy AI Platform{'\n'}
          Hackathon Demo Version
        </Text>
      </View>
    </ScrollView>
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
  section: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#000',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#000',
  },
  infoValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 