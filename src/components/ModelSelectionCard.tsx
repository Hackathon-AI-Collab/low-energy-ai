import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ModelSettingsService } from '../services/modelSettings';

interface ModelSelectionCardProps {
  title: string;
  modelType: 'llm' | 'sentenceTransformer';
  currentModelPath?: string;
  currentModelType: string;
  onModelSelect: (modelPath: string, modelType: string) => void;
}

export default function ModelSelectionCard({
  title,
  modelType,
  currentModelPath,
  currentModelType,
  onModelSelect
}: ModelSelectionCardProps) {
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailableModels();
  }, []);

  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      const settingsService = ModelSettingsService.getInstance();
      const models = await settingsService.getAvailableModels();
      
      const relevantModels = modelType === 'llm' 
        ? models.llm 
        : models.sentenceTransformer;
      
      // Convert filenames to full paths (handle both relative and absolute paths)
      const modelDirectory = `${FileSystem.documentDirectory}models/`;
      const modelsWithPaths = relevantModels.map(model => {
        // If model already has a full path (starts with file://), use it as is
        if (model.startsWith('file://')) {
          return {
            name: model.split('/').pop() || model,
            path: model
          };
        }
        // Otherwise, construct the full path
        return {
          name: model,
          path: `${modelDirectory}${model}`
        };
      });
      
      setAvailableModels(modelsWithPaths);
    } catch (error) {
      console.error('Failed to load available models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = (modelPath: string) => {
    const modelTypeForSettings = modelType === 'llm' ? 'gguf' : 'local';
    console.log('ModelSelectionCard: Selecting model:', modelPath, 'Type:', modelTypeForSettings);
    onModelSelect(modelPath, modelTypeForSettings);
  };

  const showModelSelection = () => {
    if (loading) {
      Alert.alert('Loading', 'Loading available models...');
      return;
    }

    if (availableModels.length === 0) {
      Alert.alert(
        'No Models Available',
        `No ${modelType} models have been downloaded yet. Please download models from the Model Downloads section.`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Go to Downloads', 
            onPress: () => {
              // This would navigate to model downloads
              console.log('Navigate to model downloads');
            }
          }
        ]
      );
      return;
    }

    const modelOptions = availableModels.map(model => ({
      text: model.name,
      onPress: () => handleModelSelect(model.path)
    }));

    Alert.alert(
      `Select ${title}`,
      'Choose a model to use:',
      [
        { text: 'Cancel', style: 'cancel' },
        ...modelOptions
      ]
    );
  };

  const getCurrentModelDisplay = () => {
    if (currentModelPath) {
      const fileName = currentModelPath.split('/').pop() || currentModelPath;
      return fileName;
    }
    return 'None selected';
  };

  return (
    <TouchableOpacity style={styles.settingCard} onPress={showModelSelection}>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingValue}>
            Type: {currentModelType}
          </Text>
          <Text style={styles.settingValue}>
            Current: {getCurrentModelDisplay()}
          </Text>
          <Text style={styles.settingValue}>
            Available: {availableModels.length} models
          </Text>
        </View>
        <Text style={styles.tapHint}>Tap to select</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  settingCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  tapHint: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  },
}); 