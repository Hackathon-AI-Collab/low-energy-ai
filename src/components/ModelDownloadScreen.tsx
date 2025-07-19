import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { DownloadProgress, ModelDownloadService } from '../services/modelDownloadService';
import { ModelSettingsService } from '../services/modelSettings';

interface ModelInfo {
  name: string;
  type: string;
  url: string;
  fileName: string;
  size?: number;
}

export const ModelDownloadScreen: React.FC = () => {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  const downloadService = ModelDownloadService.getInstance();
  const settingsService = ModelSettingsService.getInstance();

  useEffect(() => {
    initializeScreen();
    const interval = setInterval(updateDownloads, 1000);
    return () => clearInterval(interval);
  }, []);

  const initializeScreen = async () => {
    try {
      await downloadService.initialize();
      const models = await downloadService.getAvailableModels();
      const downloaded = await downloadService.getDownloadedModels();
      
      setAvailableModels(models);
      setDownloadedModels(downloaded);
    } catch (error) {
      console.error('Failed to initialize model download screen:', error);
      Alert.alert('Error', 'Failed to load available models');
    } finally {
      setLoading(false);
    }
  };

  const updateDownloads = async () => {
    try {
      const currentDownloads = await downloadService.getAllDownloads();
      setDownloads(currentDownloads);
    } catch (error) {
      console.error('Failed to update downloads:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (model: ModelInfo) => {
    if (downloading) {
      Alert.alert('Download in Progress', 'Please wait for the current download to complete.');
      return;
    }

    setDownloading(model.name);
    
    try {
      await downloadService.downloadModel({
        modelName: model.name,
        modelType: model.type as any,
        url: model.url,
        fileName: model.fileName,
        expectedSize: model.size,
        onProgress: (progress) => {
          console.log(`Download progress for ${model.name}: ${(progress * 100).toFixed(1)}%`);
        },
        onComplete: (filePath) => {
          console.log(`Download completed: ${filePath}`);
          Alert.alert('Success', `${model.name} downloaded successfully!`);
          initializeScreen(); // Refresh the list
        },
        onError: (error) => {
          console.error(`Download failed for ${model.name}:`, error);
          Alert.alert('Download Failed', `Failed to download ${model.name}: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteModel = async (fileName: string) => {
    Alert.alert(
      'Delete Model',
      `Are you sure you want to delete ${fileName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await downloadService.deleteModel(fileName);
              Alert.alert('Success', 'Model deleted successfully');
              initializeScreen(); // Refresh the list
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete model');
            }
          }
        }
      ]
    );
  };

  const getDownloadProgress = (modelName: string): DownloadProgress | undefined => {
    return downloads.find(d => d.modelName === modelName);
  };

  const isDownloaded = (fileName: string): boolean => {
    return downloadedModels.includes(fileName);
  };

  const isDownloading = (modelName: string): boolean => {
    return downloading === modelName || downloads.some(d => d.modelName === modelName && d.status === 'downloading');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading models...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Model Downloads</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Models</Text>
        {availableModels.map((model) => {
          const progress = getDownloadProgress(model.name);
          const downloaded = isDownloaded(model.fileName);
          const downloading = isDownloading(model.name);
          
          return (
            <View key={model.name} style={styles.modelCard}>
              <View style={styles.modelInfo}>
                <Text style={styles.modelName}>{model.name}</Text>
                <Text style={styles.modelType}>{model.type}</Text>
                {model.size && (
                  <Text style={styles.modelSize}>Size: {formatFileSize(model.size)}</Text>
                )}
              </View>
              
              {downloading && progress && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>
                    {`${(progress.progress * 100).toFixed(1)}%`}
                  </Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${progress.progress * 100}%` }
                      ]} 
                    />
                  </View>
                </View>
              )}
              
              <View style={styles.buttonContainer}>
                {downloaded ? (
                  <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={() => handleDeleteModel(model.fileName)}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.button, 
                      styles.downloadButton,
                      downloading && styles.disabledButton
                    ]}
                    onPress={() => handleDownload(model)}
                    disabled={downloading}
                  >
                    <Text style={styles.buttonText}>
                      {downloading ? 'Downloading...' : 'Download'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Settings</Text>
        <View style={styles.settingsCard}>
          <Text style={styles.settingText}>
            Sentence Transformer: {settingsService.getSentenceTransformerModel()}
          </Text>
          <Text style={styles.settingText}>
            LLM Model: {settingsService.getLLMModelType()}
          </Text>
          <Text style={styles.settingText}>
            Similarity Method: {settingsService.getSimilarityMethod()}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  modelCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modelInfo: {
    marginBottom: 12,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modelType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  modelSize: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
}); 