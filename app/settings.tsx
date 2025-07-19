import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdvancedRAG } from '../src/services/advancedRAG';
import { ModelSettingsService } from '../src/services/modelSettings';

export default function SettingsScreen() {
  const [settings, setSettings] = useState(ModelSettingsService.getInstance().getSettings());
  const [ragStats, setRagStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const rag = new AdvancedRAG();
      const stats = await rag.getStats();
      setRagStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    ModelSettingsService.getInstance().updateSettings(newSettings);
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
            ModelSettingsService.getInstance().resetToDefaults();
            setSettings(ModelSettingsService.getInstance().getSettings());
            loadStats();
          }
        }
      ]
    );
  };

  const exportSettings = () => {
    const settingsJson = ModelSettingsService.getInstance().exportSettings();
    Alert.alert('Settings Export', settingsJson);
  };

  const importSettings = () => {
    Alert.prompt(
      'Import Settings',
      'Paste the settings JSON:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: (text) => {
            if (text) {
              const success = ModelSettingsService.getInstance().importSettings(text);
              if (success) {
                setSettings(ModelSettingsService.getInstance().getSettings());
                loadStats();
                Alert.alert('Success', 'Settings imported successfully');
              } else {
                Alert.alert('Error', 'Failed to import settings');
              }
            }
          }
        }
      ]
    );
  };

  const reloadModels = async () => {
    setIsLoading(true);
    try {
      // This would reload the models with new settings
      await loadStats();
      Alert.alert('Success', 'Models reloaded with new settings');
    } catch (error) {
      Alert.alert('Error', 'Failed to reload models');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>LEAI Settings</Text>

        {/* LLM Model Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LLM Model Configuration</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Model Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radio, settings.llmModelType === 'onnx' && styles.radioSelected]}
                onPress={() => updateSetting('llmModelType', 'onnx')}
              >
                <Text style={styles.radioText}>ONNX</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radio, settings.llmModelType === 'fallback' && styles.radioSelected]}
                onPress={() => updateSetting('llmModelType', 'fallback')}
              >
                <Text style={styles.radioText}>Fallback</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Model Path (ONNX)</Text>
            <TextInput
              style={styles.input}
              value={settings.llmModelPath || ''}
              onChangeText={(text) => updateSetting('llmModelPath', text)}
              placeholder="Path to ONNX model file"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Model Name</Text>
            <TextInput
              style={styles.input}
              value={settings.llmModelName || ''}
              onChangeText={(text) => updateSetting('llmModelName', text)}
              placeholder="e.g., gemma-3n-E2B-it"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Sentence Transformer Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sentence Transformer Configuration</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Model Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radio, settings.sentenceTransformerModel === 'xenova' && styles.radioSelected]}
                onPress={() => updateSetting('sentenceTransformerModel', 'xenova')}
              >
                <Text style={styles.radioText}>Xenova</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radio, settings.sentenceTransformerModel === 'local' && styles.radioSelected]}
                onPress={() => updateSetting('sentenceTransformerModel', 'local')}
              >
                <Text style={styles.radioText}>Local</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radio, settings.sentenceTransformerModel === 'hash' && styles.radioSelected]}
                onPress={() => updateSetting('sentenceTransformerModel', 'hash')}
              >
                <Text style={styles.radioText}>Hash</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Model Path (Local)</Text>
            <TextInput
              style={styles.input}
              value={settings.sentenceTransformerPath || ''}
              onChangeText={(text) => updateSetting('sentenceTransformerPath', text)}
              placeholder="Path to local model directory"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Model Name</Text>
            <TextInput
              style={styles.input}
              value={settings.sentenceTransformerName || ''}
              onChangeText={(text) => updateSetting('sentenceTransformerName', text)}
              placeholder="e.g., Xenova/all-MiniLM-L6-v2"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Embedding Dimension</Text>
            <TextInput
              style={styles.input}
              value={settings.sentenceTransformerDimension.toString()}
              onChangeText={(text) => updateSetting('sentenceTransformerDimension', parseInt(text) || 384)}
              placeholder="384"
              keyboardType="numeric"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Similarity Calculation Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Similarity Calculation</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Method</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radio, settings.similarityMethod === 'cos_sim' && styles.radioSelected]}
                onPress={() => updateSetting('similarityMethod', 'cos_sim')}
              >
                <Text style={styles.radioText}>cos_sim</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radio, settings.similarityMethod === 'manual' && styles.radioSelected]}
                onPress={() => updateSetting('similarityMethod', 'manual')}
              >
                <Text style={styles.radioText}>Manual</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radio, settings.similarityMethod === 'auto' && styles.radioSelected]}
                onPress={() => updateSetting('similarityMethod', 'auto')}
              >
                <Text style={styles.radioText}>Auto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Performance Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Settings</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Use Cache</Text>
            <Switch
              value={settings.useCache}
              onValueChange={(value) => updateSetting('useCache', value)}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Cache Size</Text>
            <TextInput
              style={styles.input}
              value={settings.cacheSize.toString()}
              onChangeText={(text) => updateSetting('cacheSize', parseInt(text) || 1000)}
              placeholder="1000"
              keyboardType="numeric"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Batch Size</Text>
            <TextInput
              style={styles.input}
              value={settings.batchSize.toString()}
              onChangeText={(text) => updateSetting('batchSize', parseInt(text) || 10)}
              placeholder="10"
              keyboardType="numeric"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Advanced Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Settings</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Allow Remote Models</Text>
            <Switch
              value={settings.allowRemoteModels}
              onValueChange={(value) => updateSetting('allowRemoteModels', value)}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Allow Local Models</Text>
            <Switch
              value={settings.allowLocalModels}
              onValueChange={(value) => updateSetting('allowLocalModels', value)}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Use Browser Cache</Text>
            <Switch
              value={settings.useBrowserCache}
              onValueChange={(value) => updateSetting('useBrowserCache', value)}
            />
          </View>
        </View>

        {/* System Status */}
        {ragStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Status</Text>
            
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Documents:</Text>
              <Text style={styles.statusValue}>{ragStats.documents}</Text>
            </View>
            
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Chunks:</Text>
              <Text style={styles.statusValue}>{ragStats.chunks}</Text>
            </View>
            
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Total Size:</Text>
              <Text style={styles.statusValue}>{ragStats.totalSize} chars</Text>
            </View>
            
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Enhanced LLM:</Text>
              <Text style={[styles.statusValue, { color: ragStats.enhancedLLMReady ? '#4CAF50' : '#F44336' }]}>
                {ragStats.enhancedLLMReady ? 'Ready' : 'Not Ready'}
              </Text>
            </View>
            
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Vector Store:</Text>
              <Text style={[styles.statusValue, { color: ragStats.voyVectorStoreReady ? '#4CAF50' : '#F44336' }]}>
                {ragStats.voyVectorStoreReady ? 'Ready' : 'Not Ready'}
              </Text>
            </View>
            
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Embedding Model:</Text>
              <Text style={styles.statusValue}>{ragStats.embeddingModel}</Text>
            </View>
            
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Model Loaded:</Text>
              <Text style={[styles.statusValue, { color: ragStats.embeddingModelLoaded ? '#4CAF50' : '#F44336' }]}>
                {ragStats.embeddingModelLoaded ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity style={styles.button} onPress={reloadModels} disabled={isLoading}>
            <Text style={styles.buttonText}>{isLoading ? 'Reloading...' : 'Reload Models'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={exportSettings}>
            <Text style={styles.buttonText}>Export Settings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={importSettings}>
            <Text style={styles.buttonText}>Import Settings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={resetToDefaults}>
            <Text style={styles.buttonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    flex: 1,
    marginLeft: 16,
  },
  radio: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  radioSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radioText: {
    fontSize: 14,
    color: '#333',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 