import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import ModelSelectionCard from '../src/components/ModelSelectionCard';
import { ModelSettingsService } from '../src/services/modelSettings';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function SettingsScreen() {
  const [settings, setSettings] = useState(ModelSettingsService.getInstance().getSettings());
  const settingsService = ModelSettingsService.getInstance();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    settingsService.updateSettings(newSettings);
  };

  const handleLLMModelSelect = (modelPath: string, modelType: string) => {
    console.log('Settings: Selecting LLM model:', modelPath, 'Type:', modelType);
    settingsService.setLLMModelPath(modelPath);
    settingsService.setLLMModelType(modelType as 'onnx' | 'fallback');
    setSettings(settingsService.getSettings());
    Alert.alert('LLM Model Selected', `Selected: ${modelPath.split('/').pop()}`);
  };

  const handleSentenceTransformerModelSelect = (modelPath: string, modelType: string) => {
    console.log('Settings: Selecting Sentence Transformer model:', modelPath, 'Type:', modelType);
    settingsService.setSentenceTransformerPath(modelPath);
    settingsService.setSentenceTransformerModel(modelType as 'xenova' | 'local' | 'hash');
    setSettings(settingsService.getSettings());
    Alert.alert('Sentence Transformer Model Selected', `Selected: ${modelPath.split('/').pop()}`);
  };

  const handleSimilarityMethodChange = (method: 'cos_sim' | 'auto') => {
    updateSetting('similarityMethod', method);
    Alert.alert('Similarity Method Changed', `Similarity method changed to: ${method}`);
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

  const SettingRow = ({ title, description, value, onValueChange }) => (
    <View style={styles.settingCard(themeColors)}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle(themeColors)}>{title}</Text>
        {description && <Text style={styles.settingDescription(themeColors)}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: themeColors.tint }}
        thumbColor={value ? themeColors.tint : '#f4f3f4'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container(themeColors)} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title(themeColors)}>Settings</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle(themeColors)}>Model Configuration</Text>
        
        <Link href="/model-downloads" asChild>
          <TouchableOpacity style={styles.settingCard(themeColors)}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle(themeColors)}>Model Downloads</Text>
              <Text style={styles.settingDescription(themeColors)}>
                Download and manage ONNX models for offline use
              </Text>
            </View>
            <Text style={styles.arrow(themeColors)}>&gt;</Text>
          </TouchableOpacity>
        </Link>
        
        <ModelSelectionCard
          title="LLM Model Selection"
          modelType="llm"
          currentModelPath={settings.llmModelPath}
          currentModelType={settings.llmModelType}
          onModelSelect={handleLLMModelSelect}
        />
        
        <ModelSelectionCard
          title="Sentence Transformer Model Selection"
          modelType="sentenceTransformer"
          currentModelPath={settings.sentenceTransformerPath}
          currentModelType={settings.sentenceTransformerModel}
          onModelSelect={handleSentenceTransformerModelSelect}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle(themeColors)}>Performance</Text>
        
        <SettingRow 
          title="Use Cache"
          description={`Cache Size: ${settings.cacheSize}, Batch Size: ${settings.batchSize}`}
          value={settings.useCache}
          onValueChange={(value) => updateSetting('useCache', value)}
        />
        
        <TouchableOpacity 
          style={styles.settingCard(themeColors)}
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
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle(themeColors)}>Similarity Method</Text>
            <Text style={styles.settingDescription(themeColors)}>
              Current: {settings.similarityMethod}
            </Text>
          </View>
          <Text style={styles.arrow(themeColors)}>&gt;</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle(themeColors)}>Advanced</Text>
        
        <SettingRow 
          title="Allow Remote Models"
          description="Download models from the internet"
          value={settings.allowRemoteModels}
          onValueChange={(value) => updateSetting('allowRemoteModels', value)}
        />
        
        <SettingRow 
          title="Allow Local Models"
          description="Use locally stored models"
          value={settings.allowLocalModels}
          onValueChange={(value) => updateSetting('allowLocalModels', value)}
        />
        
        <SettingRow 
          title="Use Browser Cache"
          description="Cache models in browser storage"
          value={settings.useBrowserCache}
          onValueChange={(value) => updateSetting('useBrowserCache', value)}
        />
      </View>
      
      <View style={styles.section}>
        <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: (themeColors) => ({
    flex: 1,
    backgroundColor: themeColors.background,
  }),
  contentContainer: {
    padding: 20,
  },
  title: (themeColors) => ({
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    color: themeColors.text,
  }),
  section: {
    marginBottom: 25,
  },
  sectionTitle: (themeColors) => ({
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: themeColors.text,
    opacity: 0.8,
  }),
  settingCard: (themeColors) => ({
    backgroundColor: themeColors.background,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  }),
  settingInfo: {
    flex: 1,
    paddingRight: 15,
  },
  settingTitle: (themeColors) => ({
    fontSize: 17,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 5,
  }),
  settingDescription: (themeColors) => ({
    fontSize: 14,
    color: themeColors.text,
    opacity: 0.6,
  }),
  arrow: (themeColors) => ({
    fontSize: 20,
    color: themeColors.icon,
  }),
  resetButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 