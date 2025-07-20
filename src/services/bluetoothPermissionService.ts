import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';

export interface PermissionStatus {
  bluetooth: boolean;
  location: boolean;
  allGranted: boolean;
}

export class BluetoothPermissionService {
  private static instance: BluetoothPermissionService | null = null;
  private bleManager: BleManager;

  constructor() {
    this.bleManager = new BleManager();
  }

  static getInstance(): BluetoothPermissionService {
    if (!BluetoothPermissionService.instance) {
      BluetoothPermissionService.instance = new BluetoothPermissionService();
    }
    return BluetoothPermissionService.instance;
  }

  async checkPermissions(): Promise<PermissionStatus> {
    try {
      const state = await this.bleManager.state();
      
      // Check if Bluetooth is authorized and powered on
      const bluetoothGranted = state === State.PoweredOn;
      const locationGranted = await this.checkLocationPermission();
      
      // For Android, we need both Bluetooth and Location
      // For iOS, we only need Bluetooth authorization
      const allGranted = Platform.OS === 'android' 
        ? (bluetoothGranted && locationGranted)
        : (state !== State.Unauthorized && state !== State.PoweredOff);
      
      return {
        bluetooth: bluetoothGranted,
        location: locationGranted,
        allGranted
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return {
        bluetooth: false,
        location: false,
        allGranted: false
      };
    }
  }

  private async checkLocationPermission(): Promise<boolean> {
    // For Android, BLE scanning requires location permission
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted;
      } catch (error) {
        console.error('Error checking location permission:', error);
        return false;
      }
    }
    return true; // iOS doesn't require location for BLE
  }

  async requestPermissions(): Promise<PermissionStatus> {
    try {
      // Check current BLE state first
      const currentState = await this.bleManager.state();
      
      if (currentState === State.Unauthorized) {
        this.showBluetoothPermissionAlert();
        return {
          bluetooth: false,
          location: Platform.OS === 'android' ? await this.checkLocationPermission() : true,
          allGranted: false
        };
      }

      if (currentState === State.PoweredOff) {
        this.showBluetoothOffAlert();
        return {
          bluetooth: false,
          location: Platform.OS === 'android' ? await this.checkLocationPermission() : true,
          allGranted: false
        };
      }

      // For Android, request location permission if Bluetooth is available
      if (Platform.OS === 'android' && currentState === State.PoweredOn) {
        const locationGranted = await this.requestLocationPermission();
        if (!locationGranted) {
          this.showLocationPermissionAlert();
          return {
            bluetooth: true,
            location: false,
            allGranted: false
          };
        }
      }

      // If we get here, permissions should be granted
      return await this.checkPermissions();
      
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return {
        bluetooth: false,
        location: false,
        allGranted: false
      };
    }
  }

  private async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs location permission to discover nearby Bluetooth devices.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  private showBluetoothOffAlert(): void {
    Alert.alert(
      'Bluetooth Required',
      'Please enable Bluetooth to use the distributed LLM feature.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Settings', 
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('App-Prefs:Bluetooth');
            } else {
              Linking.openSettings();
            }
          }
        }
      ]
    );
  }

  private showBluetoothPermissionAlert(): void {
    Alert.alert(
      'Bluetooth Permission Required',
      'This app needs Bluetooth permission to discover nearby devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Settings', 
          onPress: () => Linking.openSettings()
        }
      ]
    );
  }

  private showLocationPermissionAlert(): void {
    Alert.alert(
      'Location Permission Required',
      'This app needs location permission to discover nearby Bluetooth devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Settings', 
          onPress: () => Linking.openSettings()
        }
      ]
    );
  }

  async ensurePermissions(): Promise<boolean> {
    const permissions = await this.requestPermissions();
    
    if (!permissions.allGranted) {
      console.log('❌ Bluetooth permissions not granted:', permissions);
      
      // Show a comprehensive alert with options
      Alert.alert(
        'Permissions Required',
        'This app needs Bluetooth and Location permissions to discover nearby devices. Please grant the required permissions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => Linking.openSettings()
          },
          {
            text: 'Try Again',
            onPress: async () => {
              const retryPermissions = await this.requestPermissions();
              if (!retryPermissions.allGranted) {
                console.log('❌ Permissions still not granted after retry');
              }
            }
          }
        ]
      );
      
      return false;
    }
    
    console.log('✅ Bluetooth permissions granted');
    return true;
  }

  destroy(): void {
    this.bleManager.destroy();
  }
} 