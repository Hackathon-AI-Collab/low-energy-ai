import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { simpleAppTest } from '../src/services/simpleAppTest';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [advancedRAG, setAdvancedRAG] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing LEAI app...');
      
      // Test the app functionality first
      console.log('Testing app functionality...');
      const testResult = await simpleAppTest();
      if (testResult) {
        console.log('✅ Revised architecture test passed');
      } else {
        console.log('⚠️ Revised architecture test failed, but continuing...');
      }
      
      // Initialize Voy RAG with Sentence Transformer + cos_sim
      const { VoyRAG } = await import('../src/services/voyRAG');
      const rag = new VoyRAG();
      await rag.initialize();
      setAdvancedRAG(rag);
      
      setIsInitialized(true);
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        text: 'Hello! I\'m LEAI, your low-energy AI assistant with advanced semantic search. I can help you with medical guidelines, search and rescue procedures, and technical information. I use sentence transformers and cos_sim for better understanding. What would you like to know?',
        isUser: false,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      
      console.log('LEAI app initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      const errorMessage: Message = {
        id: 'error',
        text: 'Sorry, I encountered an error during initialization. Please restart the app.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages([errorMessage]);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim() && !isLoading && isInitialized && advancedRAG) {
      const userMessage: Message = {
        id: Date.now().toString(),
        text: inputText,
        isUser: true,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);
      
      try {
        // Use Advanced RAG to generate response
        const ragResponse = await advancedRAG.processQuery(inputText);
        
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: ragResponse.text,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        // Log response details for debugging
        console.log('RAG Response:', {
          modelUsed: ragResponse.modelUsed,
          confidence: ragResponse.confidence,
          processingTime: ragResponse.processingTime,
          documentsReferenced: ragResponse.documentsReferenced,
          embeddingModel: ragResponse.embeddingModel
        });
      } catch (error) {
        console.error('Error processing message:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Sorry, I encountered an error. Please try again.',
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    } else if (!isInitialized) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'System is still initializing. Please wait a moment and try again.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.message, item.isUser ? styles.userMessage : styles.botMessage]}>
      <Text style={[styles.messageText, item.isUser ? styles.userMessageText : styles.botMessageText]}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>LEAI Assistant</Text>
          <Text style={styles.headerSubtitle}>Low-Energy AI Platform</Text>
          <View style={styles.navButtons}>
            <TouchableOpacity 
              style={styles.navButton} 
              onPress={() => router.push('/knowledge-base')}
            >
              <Text style={styles.navButtonText}>Knowledge Base</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.navButton} 
              onPress={() => router.push('/settings')}
            >
              <Text style={styles.navButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a question..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!isLoading && isInitialized}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() || isLoading || !isInitialized) && styles.sendButtonDisabled]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading || !isInitialized}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  navButtons: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  message: {
    marginVertical: 5,
    padding: 15,
    borderRadius: 15,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  botMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#fff',
    marginHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 12,
    marginRight: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
}); 