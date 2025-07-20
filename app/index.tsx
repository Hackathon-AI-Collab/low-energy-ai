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
import { BackgroundInitializationService, InitializationState } from '../src/services/backgroundInitializationService';

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
  const [initStatus, setInitStatus] = useState<string>('Starting up...');
  const [initProgress, setInitProgress] = useState<number>(0);
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
      console.log('Initializing LEAI app (lightweight startup)...');
      
      // Quick startup - no heavy operations
      setIsInitialized(true);
      setInitStatus('App ready - initializing in background...');
      setInitProgress(10);
      
      // Add welcome message immediately
      const welcomeMessage: Message = {
        id: 'welcome',
        text: 'Hello! I\'m LEAI, your low-energy AI assistant. I\'m initializing in the background - you can start chatting and I\'ll be ready shortly!',
        isUser: false,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      
      // Start background initialization after a short delay (let UI load)
      setTimeout(() => {
        startBackgroundInit();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Failed to quick initialize LEAI app:', error);
      const errorMessage: Message = {
        id: 'error',
        text: 'Sorry, I encountered an error during initialization. Limited functionality available.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages([errorMessage]);
      setIsInitialized(true);
    }
  };

  const startBackgroundInit = async () => {
    try {
      const backgroundService = BackgroundInitializationService.getInstance();
      
      // Subscribe to status updates
      backgroundService.onStatusChange((status) => {
        setInitStatus(status.currentTask);
        setInitProgress(status.progress);
        
        if (status.state === InitializationState.Completed) {
          // Now we can initialize the RAG service
          initializeRAG();
        }
      });
      
      // Start the background initialization
      await backgroundService.startBackgroundInitialization();
      
    } catch (error) {
      console.error('❌ Background initialization failed:', error);
      setInitStatus('Initialization failed - using fallback mode');
    }
  };

  const initializeRAG = async () => {
    try {
      console.log('🚀 Initializing RAG service...');
      const { VectorRAG } = await import('../src/services/vectorRAG');
      const rag = VectorRAG.getInstance();
      // Don't call initialize() - it will be called lazily on first query
      setAdvancedRAG(rag);
      setInitStatus('Ready for queries');
      setInitProgress(100);
      
      // Update welcome message
      const readyMessage: Message = {
        id: 'ready',
        text: '✅ I\'m now fully initialized! I can help with medical guidelines, search and rescue procedures, and technical information using advanced semantic search.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, readyMessage]);
      
    } catch (error) {
      console.error('❌ RAG initialization failed:', error);
      setInitStatus('Ready (limited functionality)');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    scrollToBottom();

    try {
      let response = '';

      if (advancedRAG && initProgress >= 100) {
        // Use fully initialized RAG
        const ragResponse = await advancedRAG.query(inputText);
        response = ragResponse.text || 'No response generated';
      } else if (advancedRAG) {
        // RAG available but may not be fully initialized
        try {
          const ragResponse = await advancedRAG.query(inputText);
          response = ragResponse.text || 'No response generated';
        } catch (error) {
          response = `I'm still initializing (${Math.round(initProgress)}%). Please try again in a moment, or I can provide basic assistance.`;
        }
      } else {
        response = `I'm still starting up (${initStatus}). Please wait a moment for full functionality.`;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      scrollToBottom();
    } catch (error) {
      console.error('Query error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessage : [styles.assistantMessage, { backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F0F0F0' }]
    ]}>
      <Text style={[
        styles.messageText,
        { color: item.isUser ? '#FFFFFF' : (colorScheme === 'dark' ? '#FFFFFF' : '#000000') }
      ]}>
        {item.text}
      </Text>
      <Text style={[
        styles.timestamp,
        { color: item.isUser ? 'rgba(255,255,255,0.7)' : (colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)') }
      ]}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.tint} />
          <Text style={[styles.loadingText, { color: themeColors.text }]}>
            {initStatus}
          </Text>
          {initProgress > 0 && (
            <Text style={[styles.progressText, { color: themeColors.tabIconDefault }]}>
              {initProgress}%
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        {/* Header with status */}
        <View style={[styles.header, { backgroundColor: themeColors.background }]}>
          <View style={styles.headerContent}>
            <Image 
              source={require('../assets/images/icon.png')} 
              style={styles.headerIcon}
            />
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>LEAI Assistant</Text>
              <Text style={[styles.headerSubtitle, { color: themeColors.tabIconDefault }]}>
                {initProgress < 100 ? `${initStatus} (${initProgress}%)` : 'Ready'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Text style={[styles.settingsText, { color: themeColors.tint }]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: themeColors.background }]}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: themeColors.card,
              color: themeColors.text,
              borderColor: themeColors.border
            }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask me anything..."
            placeholderTextColor={themeColors.tabIconDefault}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
            editable={!isLoading}
          />
          <TouchableOpacity 
            onPress={handleSend}
            style={[styles.sendButton, { 
              backgroundColor: inputText.trim() ? themeColors.tint : themeColors.tabIconDefault 
            }]}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  progressText: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  settingsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  settingsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});