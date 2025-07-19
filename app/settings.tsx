import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { ModelSettingsService } from '../src/services/modelSettings';

export default function SettingsScreen() {
  const [settings, setSettings] = useState(ModelSettingsService.getInstance().getSettings());
  const settingsService = ModelSettingsService.getInstance();

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    settingsService.updateSettings(newSettings);
  };

  const handleModelTypeChange = (modelType: 'xenova' | 'local' | 'hash') => {
    updateSetting('sentenceTransformerModel', modelType);
    Alert.alert('Model Type Changed', `Sentence Transformer model type changed to: ${modelType}`);
  };

  const handleLLMTypeChange = (modelType: 'onnx' | 'fallback') => {
    updateSetting('llmModelType', modelType);
    Alert.alert('LLM Type Changed', `LLM model type changed to: ${modelType}`);
  };

  const handleSimilarityMethodChange = (method: 'cos_sim' | 'auto') => {
    updateSetting('similarityMethod', method);
    Alert.alert('Similarity Method Changed', `Similarity method changed to: ${method}`);
  };

  const handleCacheToggle = (value: boolean) => {
    updateSetting('useCache', value);
  };

  const handleRemoteModelsToggle = (value: boolean) => {
    updateSetting('allowRemoteModels', value);
  };

  const handleLocalModelsToggle = (value: boolean) => {
    updateSetting('allowLocalModels', value);
  };

  const handleBrowserCacheToggle = (value: boolean) => {
    updateSetting('useBrowserCache', value);
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            settingsService.resetToDefaults();
            setSettings(settingsService.getSettings());
            Alert.alert('Success', 'Settings reset to defaults');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Model Configuration</Text>
        
        <Link href="/model-downloads" asChild>
          <TouchableOpacity style={styles.settingCard}>
            <Text style={styles.settingTitle}>Model Downloads</Text>
            <Text style={styles.settingDescription}>
              Download and manage ONNX models for offline use
            </Text>
          </TouchableOpacity>
        </Link>
        
        <TouchableOpacity 
          style={styles.settingCard}
          onPress={() => {
            Alert.alert(
              'Sentence Transformer Model Type',
              'Choose the model type:',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Xenova (Remote)', onPress: () => handleModelTypeChange('xenova') },
                { text: 'Local (ONNX)', onPress: () => handleModelTypeChange('local') },
                { text: 'Hash-based', onPress: () => handleModelTypeChange('hash') }
              ]
            );
          }}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Sentence Transformer</Text>
              <Text style={styles.settingValue}>
                Model: {settings.sentenceTransformerModel}
              </Text>
              <Text style={styles.settingValue}>
                Name: {settings.sentenceTransformerName}
              </Text>
              <Text style={styles.settingValue}>
                Dimension: {settings.sentenceTransformerDimension}
              </Text>
            </View>
            <Text style={styles.tapHint}>Tap to change</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.settingCard}
          onPress={() => {
            Alert.alert(
              'LLM Model Type',
              'Choose the LLM type:',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'ONNX (Local)', onPress: () => handleLLMTypeChange('onnx') },
                { text: 'Fallback', onPress: () => handleLLMTypeChange('fallback') }
              ]
            );
          }}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>LLM Model</Text>
              <Text style={styles.settingValue}>
                Type: {settings.llmModelType}
              </Text>
              <Text style={styles.settingValue}>
                Name: {settings.llmModelName}
              </Text>
            </View>
            <Text style={styles.tapHint}>Tap to change</Text>
          </View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Use Cache</Text>
              <Text style={styles.settingValue}>
                Cache Size: {settings.cacheSize}
              </Text>
              <Text style={styles.settingValue}>
                Batch Size: {settings.batchSize}
              </Text>
            </View>
            <Switch
              value={settings.useCache}
              onValueChange={handleCacheToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.useCache ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.settingCard}
          onPress={() => {
            Alert.alert(
              'Similarity Method',
              'Choose the similarity calculation method:',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Cosine Similarity', onPress: () => handleSimilarityMethodChange('cos_sim') },
                { text: 'Auto', onPress: () => handleSimilarityMethodChange('auto') }
              ]
            );
          }}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Similarity Method</Text>
              <Text style={styles.settingValue}>
                Method: {settings.similarityMethod}
              </Text>
            </View>
            <Text style={styles.tapHint}>Tap to change</Text>
          </View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Allow Remote Models</Text>
              <Text style={styles.settingValue}>
                Download models from the internet
              </Text>
            </View>
            <Switch
              value={settings.allowRemoteModels}
              onValueChange={handleRemoteModelsToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.allowRemoteModels ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Allow Local Models</Text>
              <Text style={styles.settingValue}>
                Use models stored on device
              </Text>
            </View>
            <Switch
              value={settings.allowLocalModels}
              onValueChange={handleLocalModelsToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.allowLocalModels ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Use Browser Cache</Text>
              <Text style={styles.settingValue}>
                Cache models in browser storage
              </Text>
            </View>
            <Switch
              value={settings.useBrowserCache}
              onValueChange={handleBrowserCacheToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.useBrowserCache ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        
        <TouchableOpacity style={[styles.settingCard, styles.dangerCard]} onPress={resetToDefaults}>
          <Text style={[styles.settingTitle, styles.dangerText]}>Reset to Defaults</Text>
          <Text style={styles.settingDescription}>
            Reset all settings to their default values
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
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
  settingCard: {
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
    color: '#333',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tapHint: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  dangerCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  dangerText: {
    color: '#FF3B30',
  },
}); 