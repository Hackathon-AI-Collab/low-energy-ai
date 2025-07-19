import React, { useEffect, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ModelDownloadService } from '../services/modelDownloadService';
import { ModelSettingsService } from '../services/modelSettings';

interface ModelInfo {
  name: string;
  type: 'llm' | 'sentence-transformer';
  url: string;
  fileName: string;
  size?: number;
}

interface ProgressState {
  progress: number;
  totalBytes: number;
  writtenBytes: number;
}

export const ModelDownloadScreen: React.FC = () => {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressState>>({});
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  
  const downloadService = ModelDownloadService.getInstance();
  const settingsService = ModelSettingsService.getInstance();

  const initializeScreen = useCallback(async () => {
    try {
      setLoading(true);
      await downloadService.initialize();
      const models = await downloadService.getAvailableModels();
      const downloaded = await downloadService.getDownloadedModels();
      
      setAvailableModels(models);
      setDownloadedFiles(downloaded.map(file => file.split('/').pop() || ''));
    } catch (error) {
      console.error('Failed to initialize model download screen:', error);
      Alert.alert('Error', 'Failed to load available models');
    } finally {
      setLoading(false);
    }
  }, [downloadService]);

  useEffect(() => {
    initializeScreen();
  }, [initializeScreen]);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (model: ModelInfo) => {
    if (isDownloading) {
      Alert.alert('Download in Progress', 'Please wait for the current download to complete.');
      return;
    }

    setIsDownloading(true);
    setProgressMap(prev => ({ ...prev, [model.name]: { progress: 0, totalBytes: 0, writtenBytes: 0 } }));

    try {
      await downloadService.downloadModel({
        modelName: model.name,
        modelType: model.type,
        url: model.url,
        fileName: model.fileName,
        onProgress: (p) => {
          setProgressMap(prev => ({ 
            ...prev, 
            [model.name]: {
              progress: p.totalBytesWritten / p.totalBytesExpectedToWrite,
              writtenBytes: p.totalBytesWritten,
              totalBytes: p.totalBytesExpectedToWrite,
            }
          }));
        },
        onComplete: (filePath) => {
          Alert.alert('Success', `${model.name} downloaded successfully!`);
          initializeScreen();
        },
        onError: (error) => {
          Alert.alert('Download Failed', `Failed to download ${model.name}: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteModel = async (fileName: string) => {
    Alert.alert('Delete Model', `Are you sure you want to delete ${fileName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await downloadService.deleteModel(fileName);
              Alert.alert('Success', 'Model deleted successfully');
              initializeScreen();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete model');
            }
          }
        }
      ]
    );
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
          const isDownloaded = downloadedFiles.includes(model.fileName);
          const progressState = progressMap[model.name];
          const downloading = isDownloading && progressState != null;
          
          return (
            <View key={model.name} style={styles.modelCard}>
              <View style={styles.modelInfo}>
                <Text style={styles.modelName}>{model.name}</Text>
                <Text style={styles.modelType}>{model.type}</Text>
                {model.size && (
                  <Text style={styles.modelSize}>Size: {formatFileSize(model.size)}</Text>
                )}
              </View>
              
              {downloading && progressState && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>
                    {`${formatFileSize(progressState.writtenBytes)} / ${formatFileSize(progressState.totalBytes)} (${(progressState.progress * 100).toFixed(1)}%)`}
                  </Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[styles.progressFill, { width: `${progressState.progress * 100}%` }]} 
                    />
                  </View>
                </View>
              )}
              
              <View style={styles.buttonContainer}>
                {isDownloaded ? (
                  <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={() => handleDeleteModel(model.fileName)}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, styles.downloadButton, isDownloading && styles.disabledButton]}
                    onPress={() => handleDownload(model)}
                    disabled={isDownloading}
                  >
                    <Text style={styles.buttonText}>
                      {downloading ? 'In Progress...' : 'Download'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
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
    textAlign: 'right',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
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
});