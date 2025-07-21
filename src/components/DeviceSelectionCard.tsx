import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DeviceInfo } from '../services/distributedLLMService';

interface DeviceSelectionCardProps {
  title: string;
  discoveredDevices: DeviceInfo[];
  connectedDevices: DeviceInfo[];
  isScanning: boolean;
  onDeviceSelect: (deviceId: string) => void;
  onDeviceDisconnect: (deviceId: string) => void;
  onStartScan: () => void;
  onStopScan: () => void;
}

export default function DeviceSelectionCard({
  title,
  discoveredDevices,
  connectedDevices,
  isScanning,
  onDeviceSelect,
  onDeviceDisconnect,
  onStartScan,
  onStopScan
}: DeviceSelectionCardProps) {

  const showDeviceSelection = () => {
    // Always allow device selection if devices are found, even while scanning
    if (discoveredDevices.length > 0) {
      const deviceOptions = discoveredDevices.map(device => ({
        text: `${device.name}${device.model ? ` (${device.model})` : ''}`,
        onPress: () => onDeviceSelect(device.id)
      }));

      const alertButtons: any[] = [
        { text: 'Cancel', style: 'cancel' as const },
        ...deviceOptions
      ];

      // Add scan controls
      if (isScanning) {
        alertButtons.push({ text: 'Stop Scanning', onPress: onStopScan });
      } else {
        alertButtons.push({ text: 'Scan Again', onPress: onStartScan });
      }

      Alert.alert(
        'Select Rufaydah Device',
        isScanning ? 'Choose a device to connect to (scanning in progress):' : 'Choose a device to connect to:',
        alertButtons
      );
      return;
    }

    // No devices found
    if (isScanning) {
      Alert.alert(
        'Scanning in Progress',
        'Currently scanning for devices. Would you like to stop scanning?',
        [
          { text: 'Continue Scanning', style: 'cancel' },
          { text: 'Stop Scanning', onPress: onStopScan }
        ]
      );
    } else {
      Alert.alert(
        'No Devices Found',
        'No Rufaydah devices have been discovered yet. Would you like to start scanning?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Scan', onPress: onStartScan }
        ]
      );
    }
  };

  const showConnectedDevices = () => {
    if (connectedDevices.length === 0) {
      return;
    }

    const deviceOptions = connectedDevices.map(device => ({
      text: `${device.name}${device.model ? ` (${device.model})` : ''}`,
      onPress: () => onDeviceDisconnect(device.id)
    }));

    Alert.alert(
      'Connected Devices',
      'Manage your connected devices:',
      [
        { text: 'Cancel', style: 'cancel' },
        ...deviceOptions
      ]
    );
  };

  const getCurrentDeviceDisplay = () => {
    if (connectedDevices.length > 0) {
      const device = connectedDevices[0];
      return `${device.name}${device.model ? ` (${device.model})` : ''}`;
    }
    return 'None connected';
  };

  const getStatusText = () => {
    if (isScanning) {
      return 'Scanning...';
    }
    if (connectedDevices.length > 0) {
      return `Connected: ${connectedDevices.length} device(s)`;
    }
    if (discoveredDevices.length > 0) {
      return `Found: ${discoveredDevices.length} device(s)`;
    }
    return 'No devices found';
  };

  return (
    <View style={styles.container}>
      {/* Device Selection Card */}
      <TouchableOpacity 
        style={styles.settingCard} 
        onPress={showDeviceSelection}
      >
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{title}</Text>
            <Text style={styles.settingValue}>
              Status: {getStatusText()}
            </Text>
            <Text style={styles.settingValue}>
              Current: {getCurrentDeviceDisplay()}
            </Text>
            <Text style={styles.settingValue}>
              Available: {discoveredDevices.length} devices
            </Text>
          </View>
          <Text style={styles.tapHint}>
            {isScanning ? 'Scanning...' : 'Tap to select'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Connected Devices Card (if any) */}
      {connectedDevices.length > 0 && (
        <TouchableOpacity 
          style={[styles.settingCard, styles.connectedCard]} 
          onPress={showConnectedDevices}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Connected Devices</Text>
              <Text style={styles.settingValue}>
                Connected: {connectedDevices.length} device(s)
              </Text>
              <Text style={styles.settingValue}>
                Status: Ready for queries
              </Text>
            </View>
            <Text style={styles.tapHint}>Tap to manage</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  connectedCard: {
    backgroundColor: '#e8f5e8',
    borderColor: '#28a745',
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