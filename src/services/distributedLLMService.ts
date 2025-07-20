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
    this.config = {
      scanInterval: 5000,
      connectionTimeout: 10000,
      ...config
    };
    
    this.bleManager = new BleManager();
    console.log(`🔗 DistributedLLM: Initialized as ${config.role} with name "${config.deviceName}"`);
  }

  static getInstance(config?: DistributedLLMConfig): DistributedLLMService {
    if (!DistributedLLMService.instance) {
      if (!config) {
        throw new Error('DistributedLLMService requires config for first initialization');
      }
      DistributedLLMService.instance = new DistributedLLMService(config);
    }
    return DistributedLLMService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔗 DistributedLLM: Initializing BLE manager...');
      
      // Check permissions first
      const permissionService = BluetoothPermissionService.getInstance();
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
      this.isScanning = true;

      // Check permissions again before scanning
      const permissionService = BluetoothPermissionService.getInstance();
      const permissionsGranted = await permissionService.ensurePermissions();
      
      if (!permissionsGranted) {
        throw new Error('Bluetooth permissions not granted');
      }

      this.bleManager.startDeviceScan(
        [LEAI_SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('❌ DistributedLLM: Scan error:', error);
            return;
          }

          if (device) {
            this.handleDiscoveredDevice(device);
          }
        }
      );

      // Stop scanning after a while
      setTimeout(() => {
        this.stopScanning();
      }, this.config.scanInterval || 5000);

    } catch (error) {
      console.error('❌ DistributedLLM: Failed to start scanning:', error);
      this.isScanning = false;
    }
  }

  private stopScanning(): void {
    if (!this.isScanning) return;
    
    console.log('🔍 DistributedLLM: Stopping BLE scan...');
    this.bleManager.stopDeviceScan();
    this.isScanning = false;
  }

  private handleDiscoveredDevice(device: Device): void {
    const deviceInfo: DeviceInfo = {
      id: device.id,
      name: device.name || 'Unknown Device',
      role: DeviceRole.PROVIDER, // Assume discovered devices are providers
      status: 'available',
      lastSeen: Date.now()
    };

    this.discoveredDevices.set(device.id, deviceInfo);
    console.log(`🔍 DistributedLLM: Discovered worker device: ${deviceInfo.name} (${device.id})`);
    
    this.onDeviceDiscovered?.(deviceInfo);
  }

  async connectToWorker(deviceId: string): Promise<boolean> {
    try {
      console.log(`🔗 DistributedLLM: Connecting to worker ${deviceId}...`);
      
      const device = await this.bleManager.connectToDevice(deviceId, {
        timeout: this.config.connectionTimeout
      });

      await device.discoverAllServicesAndCharacteristics();
      
      this.connectedDevices.set(deviceId, device);
      
      const deviceInfo = this.discoveredDevices.get(deviceId);
      if (deviceInfo) {
        deviceInfo.status = 'available';
        this.onDeviceConnected?.(deviceInfo);
      }

      console.log(`✅ DistributedLLM: Connected to worker ${deviceId}`);
      return true;

    } catch (error) {
      console.error(`❌ DistributedLLM: Failed to connect to worker ${deviceId}:`, error);
      return false;
    }
  }

  async queryWorker(deviceId: string, prompt: string, context?: string): Promise<LLMResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        const device = this.connectedDevices.get(deviceId);
        if (!device) {
          throw new Error(`Not connected to device ${deviceId}`);
        }

        const query: LLMQuery = {
          id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          prompt,
          context,
          maxTokens: 512,
          temperature: 0.3,
          timestamp: Date.now()
        };

        console.log(`📤 DistributedLLM: Sending query ${query.id} to worker ${deviceId}`);

        // Store pending query
        this.pendingQueries.set(query.id, { query, resolve, reject });

        // Send query via BLE characteristic
        const service = await device.services();
        const leaiService = service.find(s => s.uuid.toLowerCase() === LEAI_SERVICE_UUID.toLowerCase());
        
        if (!leaiService) {
          throw new Error('LEAI service not found on device');
        }

        const characteristics = await leaiService.characteristics();
        const queryCharacteristic = characteristics.find(
          c => c.uuid.toLowerCase() === LEAI_QUERY_CHARACTERISTIC_UUID.toLowerCase()
        );

        if (!queryCharacteristic) {
          throw new Error('Query characteristic not found on device');
        }

        // Send query as JSON
        const queryData = JSON.stringify(query);
        await queryCharacteristic.writeWithResponse(queryData);

        // Set timeout for response
        setTimeout(() => {
          if (this.pendingQueries.has(query.id)) {
            this.pendingQueries.delete(query.id);
            reject(new Error('Query timeout'));
          }
        }, 30000); // 30 second timeout

      } catch (error) {
        reject(error);
      }
    });
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
    return Array.from(this.connectedDevices.keys()).map(id => 
      this.discoveredDevices.get(id)
    ).filter(Boolean) as DeviceInfo[];
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
    
    this.bleManager.destroy();
    this.isInitialized = false;
  }
} 