import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Link } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import ModelSelectionCard from '../src/components/ModelSelectionCard';
import { BluetoothPermissionService } from '../src/services/bluetoothPermissionService';
import { ConnectionStatus, DeviceInfo, DeviceRole, DistributedLLMService, LLMResponse } from '../src/services/distributedLLMService';
import { ModelSettingsService } from '../src/services/modelSettings';

export default function SettingsScreen() {
  const [settings, setSettings] = useState(ModelSettingsService.getInstance().getSettings());
  const settingsService = ModelSettingsService.getInstance();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

  // Distributed LLM state
  const [distributedLLM, setDistributedLLM] = useState<DistributedLLMService | null>(null);
  const [currentRole, setCurrentRole] = useState<DeviceRole>(DeviceRole.CONSUMER);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [discoveredDevices, setDiscoveredDevices] = useState<DeviceInfo[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<DeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResponse, setTestResponse] = useState<LLMResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [deviceName, setDeviceName] = useState('LEAI Phone');
  const [permissionStatus, setPermissionStatus] = useState<{ bluetooth: boolean; location: boolean; allGranted: boolean }>({
    bluetooth: false,
    location: false,
    allGranted: false
  });

  // Initialize distributed LLM service
  useEffect(() => {
    const initService = async () => {
      try {
        const service = DistributedLLMService.getInstance({
          deviceName,
          role: currentRole,
          modelName: 'phi3',
        });

        // Set up event handlers
        service.setOnDeviceDiscovered((device) => {
          setDiscoveredDevices(prev => {
            const existing = prev.find(d => d.id === device.id);
            if (existing) {
              return prev.map(d => d.id === device.id ? device : d);
            }
            return [...prev, device];
          });
        });

        service.setOnDeviceConnected((device) => {
          setConnectedDevices(prev => {
            const existing = prev.find(d => d.id === device.id);
            if (existing) {
              return prev.map(d => d.id === device.id ? device : d);
            }
            return [...prev, device];
          });
        });

        service.setOnDeviceDisconnected((deviceId) => {
          setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
        });

        service.setOnStatusChanged((status) => {
          setConnectionStatus(status);
        });

        setDistributedLLM(service);
      } catch (error) {
        console.error('Failed to initialize distributed LLM service:', error);
      }
    };

    initService();

    return () => {
      if (distributedLLM) {
        distributedLLM.destroy();
      }
    };
  }, [currentRole, deviceName]);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      const permissionService = BluetoothPermissionService.getInstance();
      const status = await permissionService.checkPermissions();
      setPermissionStatus(status);
    };
    checkPermissions();
  }, []);

  // Handle role change
  const handleRoleChange = useCallback(async (newRole: DeviceRole) => {
    if (distributedLLM) {
      distributedLLM.destroy();
    }

    setCurrentRole(newRole);
    setDiscoveredDevices([]);
    setConnectedDevices([]);
    setConnectionStatus(ConnectionStatus.DISCONNECTED);
  }, [distributedLLM]);

  // Start/stop scanning
  const toggleScanning = useCallback(async () => {
    if (!distributedLLM) return;

    if (isScanning) {
      setIsScanning(false);
    } else {
      setIsScanning(true);
      setDiscoveredDevices([]);
      
      try {
        await distributedLLM.initialize();
      } catch (error) {
        console.error('Failed to start scanning:', error);
        setIsScanning(false);
        Alert.alert('Error', 'Failed to start BLE scanning. Check permissions.');
      }
    }
  }, [distributedLLM, isScanning]);

  // Connect to a provider device
  const connectToDevice = useCallback(async (deviceId: string) => {
    if (!distributedLLM) return;

    try {
      const success = await distributedLLM.connectToWorker(deviceId);
      if (success) {
        Alert.alert('Success', 'Connected to provider device');
      } else {
        Alert.alert('Error', 'Failed to connect to device');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      Alert.alert('Error', 'Connection failed');
    }
  }, [distributedLLM]);

  // Test query to connected provider
  const sendTestQuery = useCallback(async () => {
    if (!distributedLLM || !testQuery.trim() || connectedDevices.length === 0) {
      Alert.alert('Error', 'No connected providers or empty query');
      return;
    }

    setIsQuerying(true);
    setTestResponse(null);

    try {
      const providerDevice = connectedDevices[0];
      const response = await distributedLLM.queryWorker(providerDevice.id, testQuery);
      setTestResponse(response);
    } catch (error) {
      console.error('Query failed:', error);
      Alert.alert('Error', 'Query failed');
    } finally {
      setIsQuerying(false);
    }
  }, [distributedLLM, testQuery, connectedDevices]);

  // Disconnect from device
  const disconnectFromDevice = useCallback(async (deviceId: string) => {
    if (!distributedLLM) return;

    try {
      await distributedLLM.disconnectFromDevice(deviceId);
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }, [distributedLLM]);

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return '#4CAF50';
      case ConnectionStatus.SCANNING:
        return '#FF9800';
      case ConnectionStatus.CONNECTING:
        return '#2196F3';
      case ConnectionStatus.ERROR:
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return 'Connected';
      case ConnectionStatus.SCANNING:
        return 'Scanning';
      case ConnectionStatus.CONNECTING:
        return 'Connecting';
      case ConnectionStatus.ERROR:
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    settingsService.updateSettings(newSettings);
  };

  const handleLLMModelSelect = (modelPath: string, modelType: string) => {
    console.log('Settings: Selecting LLM model:', modelPath, 'Type:', modelType);
    settingsService.setLLMModelPath(modelPath);
    settingsService.setLLMModelType(modelType as 'gguf' | 'fallback');
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
        <Text style={styles.sectionTitle(themeColors)}>Nearby Share Network</Text>
        
        {/* Permission Status */}
        <View style={styles.settingCard(themeColors)}>
          <View style={{flex: 1}}>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoTitle(themeColors)}>Nearby Share</Text>
              <Switch
                value={permissionStatus.allGranted}
                onValueChange={async (value) => {
                  if (value && !permissionStatus.allGranted) {
                    const permissionService = BluetoothPermissionService.getInstance();
                    const newStatus = await permissionService.requestPermissions();
                    setPermissionStatus(newStatus);
                  } else if (!value && permissionStatus.allGranted) {
                    Alert.alert(
                      "Permissions Active",
                      "To disable permissions, please go to your device's system settings.",
                      [{ text: "OK" }]
                    );
                  }
                }}
                trackColor={{ false: '#767577', true: themeColors.tint }}
                thumbColor={permissionStatus.allGranted ? themeColors.tint : '#f4f3f4'}
              />
            </View>
            
            {permissionStatus.allGranted && currentRole === DeviceRole.CONSUMER && (
              <>
                <View style={styles.separator(themeColors)} />
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={toggleScanning}
                  disabled={!distributedLLM}
                >
                  <Text style={styles.scanButtonText(isScanning)}>
                    {isScanning ? 'Stop Scanning' : 'Start Scanning'}
                  </Text>
                  {isScanning && <ActivityIndicator size="small" color={themeColors.tint} />}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Device Configuration */}
        <View style={styles.settingCard(themeColors)}>
          <View style={{flex: 1}}>
            {/* Device Name */}
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoTitle(themeColors)}>Device Name</Text>
              <Text style={styles.settingDescription(themeColors)}>{deviceName}</Text>
            </View>

            <View style={styles.separator(themeColors)} />

            {/* Role Selection */}
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoTitle(themeColors)}>Device Role</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    currentRole === DeviceRole.CONSUMER && styles.roleButtonActive
                  ]}
                  onPress={() => handleRoleChange(DeviceRole.CONSUMER)}
                >
                  <Text style={[
                    styles.roleButtonText,
                    currentRole === DeviceRole.CONSUMER && styles.roleButtonTextActive
                  ]}>
                    Consumer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    currentRole === DeviceRole.PROVIDER && styles.roleButtonActive
                  ]}
                  onPress={() => handleRoleChange(DeviceRole.PROVIDER)}
                >
                  <Text style={[
                    styles.roleButtonText,
                    currentRole === DeviceRole.PROVIDER && styles.roleButtonTextActive
                  ]}>
                    Provider
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.separator(themeColors)} />

            {/* Connection Status */}
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoTitle(themeColors)}>Connection Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.settingDescription(themeColors)}>
                  {getStatusText(connectionStatus)}
                </Text>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(connectionStatus), marginLeft: 8 }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Consumer Mode Controls */}
        {currentRole === DeviceRole.CONSUMER && (
          <>
            

            {/* Discovered Devices */}
            {discoveredDevices.length > 0 && (
              <View style={styles.settingCard(themeColors)}>
                <Text style={styles.settingTitle(themeColors)}>Discovered Providers ({discoveredDevices.length})</Text>
                {discoveredDevices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={styles.deviceItem}
                    onPress={() => connectToDevice(device.id)}
                  >
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceStatus}>{device.status}</Text>
                    </View>
                    <Text style={styles.connectText}>Connect</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Connected Devices */}
            {connectedDevices.length > 0 && (
              <View style={styles.settingCard(themeColors)}>
                <Text style={styles.settingTitle(themeColors)}>Connected Providers ({connectedDevices.length})</Text>
                {connectedDevices.map((device) => (
                  <View key={device.id} style={styles.deviceItem}>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceStatus}>{device.status}</Text>
                    </View>
                    <TouchableOpacity onPress={() => disconnectFromDevice(device.id)}>
                      <Text style={styles.disconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Test Query */}
            {connectedDevices.length > 0 && (
              <View style={styles.settingCard(themeColors)}>
                <Text style={styles.settingTitle(themeColors)}>Test Query</Text>
                <Text style={styles.settingDescription(themeColors)}>
                  Send a test query to connected provider
                </Text>
                <TextInput
                  style={styles.queryInput}
                  placeholder="Enter your test query..."
                  value={testQuery}
                  onChangeText={setTestQuery}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={[styles.testButton, isQuerying && styles.testButtonDisabled]}
                  onPress={sendTestQuery}
                  disabled={isQuerying || !testQuery.trim()}
                >
                  {isQuerying ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.testButtonText}>Send Test Query</Text>
                  )}
                </TouchableOpacity>

                {testResponse && (
                  <View style={styles.responseContainer}>
                    <Text style={styles.responseText}>{testResponse.text}</Text>
                    <Text style={styles.responseMeta}>
                      Model: {testResponse.modelUsed} | Time: {testResponse.processingTime}ms
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Provider Mode Info */}
        {currentRole === DeviceRole.PROVIDER && (
          <View style={styles.settingCard(themeColors)}>
            <Text style={styles.settingTitle(themeColors)}>Provider Mode</Text>
            <Text style={styles.settingDescription(themeColors)}>
              This device is now serving as a provider. Other devices can connect and send LLM queries.
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle(themeColors)}>Model Configuration</Text>
        
        <Link href="/model-downloads" asChild>
          <TouchableOpacity style={styles.settingCard(themeColors)}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle(themeColors)}>Model Downloads</Text>
              <Text style={styles.settingDescription(themeColors)}>
                Download and manage GGUF models for offline use
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
    marginBottom: 20,
    color: themeColors.text,
  }),
  section: {
    marginBottom: 12,
  },
  sectionTitle: (themeColors) => ({
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: themeColors.text,
    opacity: 0.8,
  }),
  settingCard: (themeColors) => ({
    backgroundColor: themeColors.background,
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
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
  // Distributed LLM styles
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  deviceInfoTitle: (themeColors) => ({
    fontSize: 17,
    fontWeight: '600',
    color: themeColors.text,
  }),
  separator: (themeColors) => ({
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  }),
  roleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  roleButtonTextActive: {
    color: 'white',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  scanButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  scanButtonText: (isScanning) => ({
    color: isScanning ? '#FF9800' : '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  }),
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deviceStatus: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  connectText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  disconnectText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  testButtonDisabled: {
    backgroundColor: '#ccc',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  responseContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  responseText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  responseMeta: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  queryInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
    textAlignVertical: 'top',
  },
}); 