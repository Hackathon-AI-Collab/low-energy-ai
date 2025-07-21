import { Platform } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import { BluetoothPermissionService } from './bluetoothPermissionService';

// BLE Service and Characteristic UUIDs for LEAI Distributed LLM
const LEAI_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const LEAI_QUERY_CHARACTERISTIC_UUID = '87654321-4321-4321-4321-cba987654321';
const LEAI_RESPONSE_CHARACTERISTIC_UUID = '11111111-2222-3333-4444-555555555555';
const LEAI_STATUS_CHARACTERISTIC_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

export enum DeviceRole {
  PROVIDER = 'provider',  // Provides LLM service (e.g., laptop with Ollama)
  CONSUMER = 'consumer'   // Consumes LLM service (e.g., phone app)
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  SCANNING = 'scanning',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface LLMQuery {
  id: string;
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  timestamp: number;
}

export interface LLMResponse {
  id: string;
  text: string;
  modelUsed: string;
  processingTime: number;
  tokensGenerated?: number;
  error?: string;
  timestamp: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  role: DeviceRole;
  model?: string;
  status: 'available' | 'busy' | 'offline';
  lastSeen: number;
}

export interface DistributedLLMConfig {
  deviceName: string;
  role: DeviceRole;
  modelName?: string; // For workers
  scanInterval?: number;
  connectionTimeout?: number;
}

export class DistributedLLMService {
  private static instance: DistributedLLMService | null = null;
  
  private bleManager: BleManager;
  private config: DistributedLLMConfig;
  private isInitialized = false;
  private isScanning = false;
  private connectedDevices: Map<string, Device> = new Map();
  private discoveredDevices: Map<string, DeviceInfo> = new Map();
  private pendingQueries: Map<string, { query: LLMQuery; resolve: (response: LLMResponse) => void; reject: (error: Error) => void }> = new Map();
  
  // Event callbacks
  private onDeviceDiscovered?: (device: DeviceInfo) => void;
  private onDeviceConnected?: (device: DeviceInfo) => void;
  private onDeviceDisconnected?: (deviceId: string) => void;
  private onQueryReceived?: (query: LLMQuery) => void;
  private onResponseReceived?: (response: LLMResponse) => void;
  private onStatusChanged?: (status: ConnectionStatus) => void;

  constructor(config: DistributedLLMConfig) {
    console.log('🔍 DistributedLLM: Constructor called with config:', config);
    this.config = {
      scanInterval: 5000,
      connectionTimeout: 10000,
      ...config
    };
    
    // Try to get the shared BLE manager from permission service first
    const permissionService = BluetoothPermissionService.getInstance();
    const sharedBleManager = permissionService.getBleManager();
    
    if (sharedBleManager) {
      this.bleManager = sharedBleManager;
      console.log(`🔗 DistributedLLM: Using shared BLE manager for ${config.role} with name "${config.deviceName}"`);
    } else {
      this.bleManager = new BleManager();
      console.log(`🔗 DistributedLLM: Created new BLE manager for ${config.role} with name "${config.deviceName}"`);
    }
  }

  static getInstance(config?: DistributedLLMConfig): DistributedLLMService {
    console.log('🔍 DistributedLLM: getInstance() called with config:', config);
    console.log('🔍 DistributedLLM: Existing instance:', !!DistributedLLMService.instance);
    
    if (!DistributedLLMService.instance) {
      if (!config) {
        throw new Error('DistributedLLMService requires config for first initialization');
      }
      console.log('🔍 DistributedLLM: Creating new instance with config:', config);
      DistributedLLMService.instance = new DistributedLLMService(config);
    } else {
      console.log('🔍 DistributedLLM: Returning existing instance');
    }
    return DistributedLLMService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔗 DistributedLLM: Initializing BLE manager...');
      
      // Share BLE manager with permission service
      const permissionService = BluetoothPermissionService.getInstance();
      permissionService.setBleManager(this.bleManager);
      
      // Check permissions first
      const permissionsGranted = await permissionService.ensurePermissions();
      
      if (!permissionsGranted) {
        throw new Error('Bluetooth permissions not granted');
      }
      
      // Check BLE state
      const state = await this.bleManager.state();
      console.log(`🔗 DistributedLLM: BLE state: ${state}`);
      
      if (state === State.PoweredOff) {
        throw new Error('Bluetooth is powered off');
      }

      // Set up state change listener
      this.bleManager.onStateChange((state) => {
        console.log(`🔗 DistributedLLM: BLE state changed to: ${state}`);
        if (state === State.PoweredOff) {
          this.onStatusChanged?.(ConnectionStatus.ERROR);
        }
      }, true);

      this.isInitialized = true;
      console.log('✅ DistributedLLM: Initialization complete');

      // Start advertising if provider, scanning if consumer
      if (this.config.role === DeviceRole.PROVIDER) {
        await this.startAdvertising();
      } else {
        await this.startScanning();
      }

    } catch (error) {
      console.error('❌ DistributedLLM: Initialization failed:', error);
      throw error;
    }
  }

  // ===== WORKER MODE (Serving LLM Queries) =====

  private async startAdvertising(): Promise<void> {
    if (Platform.OS === 'ios') {
      console.log('🔗 DistributedLLM: iOS advertising not supported in this implementation');
      return;
    }

    try {
      console.log('📡 DistributedLLM: Starting BLE advertising as worker...');
      
      // Note: react-native-ble-plx doesn't support advertising directly
      // In a real implementation, you'd need a native module or use a different approach
      // For now, we'll simulate advertising by being discoverable
      
      console.log('📡 DistributedLLM: Provider mode active - ready to receive queries');
    } catch (error) {
      console.error('❌ DistributedLLM: Failed to start advertising:', error);
    }
  }

  async handleIncomingQuery(query: LLMQuery): Promise<LLMResponse> {
    console.log(`🤖 DistributedLLM: Received query: ${query.id}`);
    
    try {
      // This would integrate with your local LLM service
      // For now, we'll simulate a response
      const response: LLMResponse = {
        id: query.id,
        text: `[Worker Response] Processed query: "${query.prompt}"`,
        modelUsed: this.config.modelName || 'unknown',
        processingTime: Math.random() * 1000 + 500,
        tokensGenerated: Math.floor(Math.random() * 100) + 50,
        timestamp: Date.now()
      };

      console.log(`✅ DistributedLLM: Query ${query.id} processed successfully`);
      return response;

    } catch (error) {
      console.error(`❌ DistributedLLM: Failed to process query ${query.id}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        id: query.id,
        text: `Error processing query: ${errorMessage}`,
        modelUsed: this.config.modelName || 'unknown',
        processingTime: 0,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }

  // ===== MANAGER MODE (Requesting LLM Queries) =====

  private async startScanning(): Promise<void> {
    if (this.isScanning) return;

    try {
      console.log('🔍 DistributedLLM: Starting BLE scanning for workers...');
      // Clear previous discoveries to avoid stale data
      this.clearDiscoveredDevices();
      this.isScanning = true;

      // Check permissions again before scanning
      const permissionService = BluetoothPermissionService.getInstance();
      const permissionsGranted = await permissionService.ensurePermissions();
      
      if (!permissionsGranted) {
        throw new Error('Bluetooth permissions not granted');
      }

      // Scan for all devices but filter for LEAI workers
      this.bleManager.startDeviceScan(
        null, // Scan for all devices, then filter
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('❌ DistributedLLM: Scan error:', error);
            return;
          }

          if (device) {
            console.log(`🔍 DistributedLLM: Found device: ${device.name || 'Unknown'} (${device.id})`);
            // Only process LEAI worker devices
            this.handleDiscoveredDevice(device);
          }
        }
      );

      // Stop scanning after a longer time to find more devices
      setTimeout(() => {
        console.log('🔍 DistributedLLM: Scan timeout reached, stopping...');
        this.stopScanning();
      }, 30000); // 30 seconds to give more time for discovery

    } catch (error) {
      console.error('❌ DistributedLLM: Failed to start scanning:', error);
      this.isScanning = false;
    }
  }

  stopScanning(): void {
    if (!this.isScanning) return;
    
    console.log('🔍 DistributedLLM: Stopping BLE scan...');
    this.bleManager.stopDeviceScan();
    this.isScanning = false;
  }

  clearDiscoveredDevices(): void {
    console.log('🧹 DistributedLLM: Clearing discovered devices cache...');
    this.discoveredDevices.clear();
  }

  private handleDiscoveredDevice(device: Device): void {
    // Only process LEAI worker devices
    const deviceName = device.name;
    
    // Temporarily show ALL devices for debugging
    console.log(`🔍 DistributedLLM: Processing device: ${deviceName || 'Unknown'} (${device.id})`);
    
    // Skip devices without names or non-LEAI devices
    if (!deviceName || !this.isLEAIWorker(deviceName)) {
      console.log(`🔍 DistributedLLM: Skipping non-LEAI device: ${deviceName || 'Unknown'} (${device.id})`);
      return;
    }

    let model = undefined;
    let cleanDeviceName = deviceName;
    
    // Try to extract model information from device name
    // Format: "LEAI Provider (phi3:mini)" or "LEAI-Phi3 (phi3)"
    const modelMatch = deviceName.match(/\(([^)]+)\)/);
    if (modelMatch) {
      model = modelMatch[1];
      // Keep the full device name for better identification
      cleanDeviceName = deviceName;
    }
    
    // Check if it's a LEAI device
    if (cleanDeviceName.startsWith('LEAI-')) {
      // Extract model from LEAI device names like "LEAI-Phi3"
      const leaiMatch = cleanDeviceName.match(/LEAI-([^-]+)/);
      if (leaiMatch && !model) {
        model = leaiMatch[1].toLowerCase();
      }
    }

    const deviceInfo: DeviceInfo = {
      id: device.id,
      name: cleanDeviceName,
      role: DeviceRole.PROVIDER,
      model: model,
      status: 'available',
      lastSeen: Date.now()
    };

    this.discoveredDevices.set(device.id, deviceInfo);
    console.log(`🔍 DistributedLLM: Discovered LEAI worker: ${deviceInfo.name}${model ? ` (${model})` : ''} (${device.id})`);
    
    this.onDeviceDiscovered?.(deviceInfo);
  }

  private isLEAIWorker(deviceName: string): boolean {
    // Check if device name indicates it's a LEAI worker
    const isLEAI = deviceName.startsWith('LEAI-') || 
                   deviceName.includes('LEAI') || 
                   deviceName.includes('(phi3') ||
                   deviceName.includes('(llama') ||
                   deviceName.includes('(mistral') ||
                   deviceName.includes('(codellama') ||
                   deviceName.includes('(gemma') ||
                   deviceName.includes('LEAI Provider');
    
    if (isLEAI) {
      console.log(`🎯 Found LEAI device: ${deviceName}`);
    }
    
    return isLEAI;
  }

  async connectToWorker(deviceId: string): Promise<boolean> {
    try {
      console.log(`🔗 DistributedLLM: Connecting to worker ${deviceId}...`);
      
      // Stop scanning before connecting to avoid conflicts
      this.stopScanning();
      
      // For now, simulate a successful connection since we're using HTTP anyway
      // The BLE connection is just for device discovery, not for data transfer
      console.log(`🔗 DistributedLLM: Simulating connection to ${deviceId}...`);
      
      // Get the device info
      const deviceInfo = this.discoveredDevices.get(deviceId);
      if (!deviceInfo) {
        throw new Error(`Device info not found for ${deviceId}`);
      }
      
      // Create a mock device object for tracking
      const mockDevice = {
        id: deviceId,
        name: deviceInfo.name,
        isConnected: () => Promise.resolve(true)
      } as any;
      
      // Mark the device as connected
      this.connectedDevices.set(deviceId, mockDevice);
      console.log(`🔍 DistributedLLM: Device ${deviceId} added to connectedDevices Map`);
      console.log(`🔍 DistributedLLM: connectedDevices Map size after connection:`, this.connectedDevices.size);
      
      // Update device status
      deviceInfo.status = 'available';
      this.onDeviceConnected?.(deviceInfo);

      console.log(`✅ DistributedLLM: Successfully connected to worker ${deviceId} (${deviceInfo.name})`);
      return true;

    } catch (error) {
      console.error(`❌ DistributedLLM: Failed to connect to worker ${deviceId}:`, error);
      
      // Log more details about the error
      if (error instanceof Error) {
        console.error(`❌ Error details: ${error.message}`);
      }
      
      return false;
    }
  }

  async queryWorker(deviceId: string, prompt: string, context?: string): Promise<LLMResponse> {
    const startTime = Date.now(); // Move this to the very beginning
    
    try {
      const device = this.connectedDevices.get(deviceId);
      if (!device) {
        throw new Error(`Not connected to device ${deviceId}`);
      }

      const deviceInfo = this.discoveredDevices.get(deviceId);
      if (!deviceInfo) {
        throw new Error(`Device info not found for ${deviceId}`);
      }

      console.log(`📤 DistributedLLM: Sending query to worker ${deviceId} (${deviceInfo.name})`);

      // Remove hardcoded demo responses - let actual AI processing handle all queries

      // Use HTTP to query Ollama directly on the worker's machine
      // The BLE connection is used for device discovery and connection management
      // but queries go through HTTP for simplicity and reliability
      
      try {
        // Extract model from device name or use default
        let modelName = deviceInfo.model || 'phi3:mini';
        
        // Try to extract model name from device name
        // Device name format: "LEAI Provider (phi3:mini)" or "LEAI-Phi3"
        if (deviceInfo.name.includes('(phi3:mini)')) {
          modelName = 'phi3:mini';
        } else if (deviceInfo.name.includes('(mistral:latest)')) {
          modelName = 'mistral:latest';
        } else if (deviceInfo.name.includes('Phi3') || deviceInfo.name.includes('phi3')) {
          modelName = 'phi3:mini';
        } else if (deviceInfo.name.includes('Mistral') || deviceInfo.name.includes('mistral')) {
          modelName = 'mistral:latest';
        }
        
        console.log(`🌐 DistributedLLM: Sending HTTP query to Ollama with model: ${modelName}`);
        
        // For now, we'll need to know the IP address of the worker machine
        // In a real implementation, this could be discovered via BLE or configured
        const workerIP = '192.168.1.6'; // Your computer's IP address
        const workerPort = 11434; // Default Ollama port
        
        const requestBody = {
          model: modelName,
          prompt: prompt,
          stream: false
        };
        
        console.log(`📤 DistributedLLM: Request body:`, JSON.stringify(requestBody, null, 2));
        
        const response = await fetch(`http://${workerIP}:${workerPort}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        const processingTime = Date.now() - startTime;

        const llmResponse: LLMResponse = {
          id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: data.response || 'No response',
          modelUsed: modelName,
          processingTime,
          tokensGenerated: data.eval_count,
          timestamp: Date.now()
        };

        console.log(`✅ DistributedLLM: Received response from ${deviceInfo.name} via HTTP`);
        return llmResponse;

      } catch (error) {
        console.error(`❌ DistributedLLM: HTTP query failed:`, error);
        throw new Error(`Failed to query Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      console.error(`❌ DistributedLLM: Query worker failed:`, error);
      throw error;
    }
  }

  // ===== EVENT HANDLERS =====

  setOnDeviceDiscovered(callback: (device: DeviceInfo) => void): void {
    this.onDeviceDiscovered = callback;
  }

  setOnDeviceConnected(callback: (device: DeviceInfo) => void): void {
    this.onDeviceConnected = callback;
  }

  setOnDeviceDisconnected(callback: (deviceId: string) => void): void {
    this.onDeviceDisconnected = callback;
  }

  setOnQueryReceived(callback: (query: LLMQuery) => void): void {
    this.onQueryReceived = callback;
  }

  setOnResponseReceived(callback: (response: LLMResponse) => void): void {
    this.onResponseReceived = callback;
  }

  setOnStatusChanged(callback: (status: ConnectionStatus) => void): void {
    this.onStatusChanged = callback;
  }

  // ===== UTILITY METHODS =====

  getDiscoveredDevices(): DeviceInfo[] {
    return Array.from(this.discoveredDevices.values());
  }

  getConnectedDevices(): DeviceInfo[] {
    const connectedIds = Array.from(this.connectedDevices.keys());
    console.log(`🔍 DistributedLLM: getConnectedDevices() called - connected IDs:`, connectedIds);
    console.log(`🔍 DistributedLLM: connectedDevices Map size:`, this.connectedDevices.size);
    console.log(`🔍 DistributedLLM: discoveredDevices Map size:`, this.discoveredDevices.size);
    
    const devices = connectedIds.map(id => {
      const deviceInfo = this.discoveredDevices.get(id);
      if (deviceInfo) {
        // Update status to reflect connection
        deviceInfo.status = 'available';
        console.log(`🔍 DistributedLLM: Found connected device: ${deviceInfo.name} (${id})`);
        return deviceInfo;
      }
      console.log(`🔍 DistributedLLM: No device info found for connected ID: ${id}`);
      return null;
    }).filter(Boolean) as DeviceInfo[];
    
    console.log(`🔍 DistributedLLM: Returning ${devices.length} connected devices`);
    return devices;
  }

  async disconnectFromDevice(deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (device) {
      await device.cancelConnection();
      this.connectedDevices.delete(deviceId);
      this.onDeviceDisconnected?.(deviceId);
    }
  }

  destroy(): void {
    console.log('🔗 DistributedLLM: Destroying service...');
    console.log('🔍 DistributedLLM: connectedDevices before destroy:', this.connectedDevices.size);
    console.log('🔍 DistributedLLM: discoveredDevices before destroy:', this.discoveredDevices.size);
    
    this.stopScanning();
    
    // Disconnect all devices
    this.connectedDevices.forEach(async (device) => {
      try {
        await device.cancelConnection();
      } catch (error) {
        console.warn('Failed to disconnect device:', error);
      }
    });
    
    this.connectedDevices.clear();
    this.discoveredDevices.clear();
    this.pendingQueries.clear();
    
    // Only destroy BLE manager if we created it (not shared)
    const permissionService = BluetoothPermissionService.getInstance();
    const sharedBleManager = permissionService.getBleManager();
    
    if (this.bleManager !== sharedBleManager) {
      this.bleManager.destroy();
    } else {
      console.log('🔗 DistributedLLM: Not destroying shared BLE manager');
    }
    
    this.isInitialized = false;
    
    // Clear the singleton instance
    DistributedLLMService.instance = null;
    console.log('🔗 DistributedLLM: Service destroyed and singleton instance cleared');
  }
} 