import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentStorageService } from './documentStorage';

export interface StorageInfo {
  totalSize: number;
  available: boolean;
  reason?: string;
  documentsCount: number;
  chunksCount: number;
}

export class StorageManager {
  private static instance: StorageManager;
  private documentStorage: DocumentStorageService;

  private constructor() {
    this.documentStorage = DocumentStorageService.getInstance();
  }

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Get comprehensive storage information
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const [stats, availability] = await Promise.all([
        this.documentStorage.getStorageStats(),
        this.documentStorage.checkStorageAvailability()
      ]);

      return {
        totalSize: stats.totalSize,
        available: availability.available,
        reason: availability.reason,
        documentsCount: stats.documentsSize > 0 ? 1 : 0, // Simplified count
        chunksCount: stats.chunksSize > 0 ? 1 : 0 // Simplified count
      };
    } catch (error) {
      console.error('StorageManager: Failed to get storage info:', error);
      return {
        totalSize: 0,
        available: false,
        reason: 'Error getting storage info',
        documentsCount: 0,
        chunksCount: 0
      };
    }
  }

  // Clear all app data (nuclear option)
  async clearAllAppData(): Promise<void> {
    try {
      console.log('StorageManager: Clearing all app data...');
      
      // Clear document storage
      await this.documentStorage.clearAll();
      
      // Clear all AsyncStorage keys (be careful!)
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter(key => 
        key.startsWith('leai_') || 
        key.startsWith('@react-native-async-storage/async-storage:leai_')
      );
      
      if (appKeys.length > 0) {
        await AsyncStorage.multiRemove(appKeys);
        console.log(`StorageManager: Cleared ${appKeys.length} app storage keys`);
      }
      
      console.log('StorageManager: All app data cleared successfully');
    } catch (error) {
      console.error('StorageManager: Failed to clear all app data:', error);
      throw error;
    }
  }

  // Clear only document data (safer option)
  async clearDocumentData(): Promise<void> {
    try {
      console.log('StorageManager: Clearing document data...');
      await this.documentStorage.clearAll();
      console.log('StorageManager: Document data cleared successfully');
    } catch (error) {
      console.error('StorageManager: Failed to clear document data:', error);
      throw error;
    }
  }

  // Check if storage is critically full
  async isStorageCritical(): Promise<boolean> {
    try {
      const info = await this.getStorageInfo();
      return !info.available || info.totalSize > 4 * 1024 * 1024; // 4MB threshold
    } catch (error) {
      console.error('StorageManager: Failed to check storage critical status:', error);
      return true; // Assume critical if we can't check
    }
  }

  // Get storage usage percentage
  async getStorageUsagePercentage(): Promise<number> {
    try {
      const info = await this.getStorageInfo();
      const maxSize = 5 * 1024 * 1024; // 5MB max
      return Math.round((info.totalSize / maxSize) * 100);
    } catch (error) {
      console.error('StorageManager: Failed to get storage usage percentage:', error);
      return 0;
    }
  }

  // Format storage size for display
  formatStorageSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get storage recommendations
  async getStorageRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    try {
      const info = await this.getStorageInfo();
      const usagePercentage = await this.getStorageUsagePercentage();
      
      if (usagePercentage > 80) {
        recommendations.push('Storage is nearly full. Consider clearing old documents.');
      }
      
      if (usagePercentage > 90) {
        recommendations.push('Storage is critically full. Clear document data immediately.');
      }
      
      if (!info.available) {
        recommendations.push('Storage is not available. Clear some data to continue.');
      }
      
      if (recommendations.length === 0) {
        recommendations.push('Storage usage is healthy.');
      }
      
    } catch (error) {
      recommendations.push('Unable to check storage status.');
    }
    
    return recommendations;
  }

  // Emergency storage cleanup
  async emergencyCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('StorageManager: Performing emergency cleanup...');
      
      // Check if storage is critical
      const isCritical = await this.isStorageCritical();
      
      if (isCritical) {
        // Clear document data
        await this.clearDocumentData();
        
        return {
          success: true,
          message: 'Emergency cleanup completed. Document data cleared.'
        };
      } else {
        return {
          success: true,
          message: 'Storage is not critical. No cleanup needed.'
        };
      }
    } catch (error) {
      console.error('StorageManager: Emergency cleanup failed:', error);
      return {
        success: false,
        message: `Emergency cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 