import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import ChatScreen from './src/screens/ChatScreen';
import KnowledgeBaseScreen from './src/screens/KnowledgeBaseScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { RAGPipeline } from './src/services/ragPipeline';

const Stack = createStackNavigator();

export default function App() {
  const [ragPipeline, setRagPipeline] = useState<RAGPipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing LEAI app...');
      
      // Initialize RAG pipeline
      const pipeline = new RAGPipeline();
      await pipeline.initialize();
      
      // Load sample documents
      await loadSampleDocuments(pipeline);
      
      setRagPipeline(pipeline);
      setIsLoading(false);
      console.log('LEAI app initialized successfully');
    } catch (err) {
      console.error('Failed to initialize app:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  };

  const loadSampleDocuments = async (pipeline: RAGPipeline) => {
    try {
      console.log('Loading sample documents...');
      
      // Load TCCC guidelines
      const tcccPath = `${FileSystem.documentDirectory}docs/sample/tccc_guidelines.md`;
      await pipeline.addDocument(tcccPath);
      
      // Load search and rescue procedures
      const searchRescuePath = `${FileSystem.documentDirectory}docs/sample/search_rescue.md`;
      await pipeline.addDocument(searchRescuePath);
      
      console.log('Sample documents loaded successfully');
    } catch (err) {
      console.warn('Failed to load sample documents:', err);
      // Continue without sample documents for demo
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing LEAI...</Text>
        <Text style={styles.loadingSubtext}>Loading AI components and knowledge base</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Initialization Failed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>
          Please restart the app or check your configuration.
        </Text>
      </View>
    );
  }

  if (!ragPipeline) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>System Error</Text>
        <Text style={styles.errorText}>Failed to initialize RAG pipeline</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Chat"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Chat" 
          component={(props: any) => <ChatScreen {...props} ragPipeline={ragPipeline} />}
          options={{ title: 'LEAI Assistant' }}
        />
        <Stack.Screen 
          name="KnowledgeBase" 
          component={(props: any) => <KnowledgeBaseScreen {...props} ragPipeline={ragPipeline} />}
          options={{ title: 'Knowledge Base' }}
        />
        <Stack.Screen 
          name="Settings" 
          component={(props: any) => <SettingsScreen {...props} ragPipeline={ragPipeline} />}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
}); 