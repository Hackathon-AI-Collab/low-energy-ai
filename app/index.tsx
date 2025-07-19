import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing LEAI app...');
      
      // Initialize document loader first
      console.log('Loading documents from assets/documents/...');
      const { DocumentLoader } = await import('../src/services/documentLoader');
      const documentLoader = DocumentLoader.getInstance();
      const loadResults = await documentLoader.initialize();
      
      if (loadResults.success > 0) {
        console.log(`✅ Loaded ${loadResults.success} documents successfully`);
      } else {
        console.log('⚠️ No documents loaded, but continuing...');
      }
      
      // Test the app functionality
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

  const renderMessage = ({ item }: { item: Message }) => {
    const dynamicStyles = {
      botMessage: {
        backgroundColor: themeColors.background,
        borderBottomLeftRadius: 5,
        borderColor: '#E9E9E9',
        borderWidth: 1,
      },
      botMessageText: {
        color: themeColors.text,
      }
    };
    
    return (
      <View style={[styles.messageContainer, item.isUser ? styles.userMessageContainer : styles.botMessageContainer]}>
        {!item.isUser && (
          <Image source={require('../assets/images/icon.png')} style={styles.avatar} />
        )}
        <View style={[styles.message, item.isUser ? styles.userMessage : dynamicStyles.botMessage]}>
          <Text style={[styles.messageText, item.isUser ? styles.userMessageText : dynamicStyles.botMessageText]}>
            {item.text}
          </Text>
          <Text style={[styles.timestamp, item.isUser ? styles.userTimestamp : styles.botTimestamp]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    loadingContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 10,
    },
    loadingText: {
      marginLeft: 10,
      color: themeColors.text,
      fontSize: 14,
    },
    inputContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 15,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0, 0, 0, 0.1)',
    },
    input: {
      flex: 1,
      backgroundColor: themeColors.background,
      borderRadius: 25,
      paddingVertical: 12,
      paddingHorizontal: 20,
      fontSize: 16,
      color: themeColors.text,
      borderWidth: 1,
      borderColor: themeColors.icon,
    }
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <KeyboardAvoidingView 
        style={dynamicStyles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>LEAI Assistant</Text>
            <Text style={styles.headerSubtitle}>Low-Energy AI Platform</Text>
          </View>
          <View style={styles.navButtons}>
            <TouchableOpacity onPress={() => router.push('/knowledge-base')}>
              <Text style={styles.navButtonText}>Docs</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings')}>
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
          contentContainerStyle={styles.messagesListContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        
        {isLoading && (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="small" color={themeColors.tint} />
            <Text style={dynamicStyles.loadingText}>Processing...</Text>
          </View>
        )}
        
        <View style={dynamicStyles.inputContainer}>
          <TextInput
            style={dynamicStyles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a question..."
            placeholderTextColor={themeColors.icon}
            multiline
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  navButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    padding: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 5,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botMessageContainer: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#E9E9E9',
  },
  message: {
    padding: 15,
    borderRadius: 20,
  },
  userMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 8,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
  },
  botTimestamp: {
    color: '#999',
    alignSelf: 'flex-start',
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0C4DE',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});