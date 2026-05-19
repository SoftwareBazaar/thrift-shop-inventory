// Sync Service - Handles online/offline data synchronization
import { offlineStorage } from './offlineStorage';
import { dbApi } from './databaseService';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingOperations: number;
}

class SyncService {
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingOperations: 0
  };

  private syncListeners: Array<(status: SyncStatus) => void> = [];

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Initialize offline storage
    offlineStorage.init().catch(console.error);

    // Start periodic sync check
    this.startPeriodicSync();
  }

  // Get current sync status
  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  // Subscribe to sync status changes
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  // Update and notify listeners
  private updateStatus(updates: Partial<SyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this.syncListeners.forEach(listener => listener(this.syncStatus));
  }

  // Handle online event
  private async handleOnline() {
    console.log('[SyncService] Back online, starting sync...');
    this.updateStatus({ isOnline: true });
    await this.sync();
  }

  // Handle offline event
  private handleOffline() {
    console.log('[SyncService] Gone offline');
    this.updateStatus({ isOnline: false });
  }

  // Start periodic sync check (every 30 seconds when online)
  private startPeriodicSync() {
    setInterval(async () => {
      if (navigator.onLine && !this.syncStatus.isSyncing) {
        const pending = await offlineStorage.getPendingOperations();
        if (pending.length > 0) {
          console.log(`[SyncService] Found ${pending.length} pending operations, syncing...`);
          await this.sync();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Main sync function
  async sync(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[SyncService] Offline, cannot sync');
      return;
    }

    if (this.syncStatus.isSyncing) {
      console.log('[SyncService] Sync already in progress');
      return;
    }

    this.updateStatus({ isSyncing: true });

    try {
      const pendingOperations = await offlineStorage.getPendingOperations();
      this.updateStatus({ pendingOperations: pendingOperations.length });

      if (pendingOperations.length === 0) {
        console.log('[SyncService] No pending operations');
        this.updateStatus({ isSyncing: false, lastSyncTime: Date.now() });
        return;
      }

      console.log(`[SyncService] Syncing ${pendingOperations.length} operations...`);

      // Sync each operation
      for (const operation of pendingOperations) {
        try {
          await this.syncOperation(operation);
          await offlineStorage.markOperationSynced(operation.id);
        } catch (error) {
          console.error(`[SyncService] Failed to sync operation ${operation.id}:`, error);
          // Keep operation in queue for retry
        }
      }

      // Clean up synced operations
      await offlineStorage.deleteSyncedOperations();

      // Refresh data from server
      await this.refreshData();

      this.updateStatus({
        isSyncing: false,
        lastSyncTime: Date.now(),
        pendingOperations: 0
      });

      console.log('[SyncService] Sync completed successfully');
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
      this.updateStatus({ isSyncing: false });
    }
  }

  // Sync a single operation
  private async syncOperation(operation: any): Promise<void> {
    switch (operation.type) {
      case 'CREATE':
        if (operation.table === 'sales') {
          await dbApi.createSale(operation.data);
        } else if (operation.table === 'items') {
          await dbApi.createItem(operation.data);
        } else if (operation.table === 'withdrawals') {
          await dbApi.createWithdrawal(operation.data);
        }
        break;

      case 'UPDATE':
        if (operation.table === 'items') {
          await dbApi.updateItem(operation.data.item_id, operation.data);
        } else if (operation.table === 'sales') {
          await dbApi.updateSale(operation.data.sale_id, operation.data);
        }
        break;

      case 'DELETE':
        // Handle delete if needed
        break;

      default:
        console.warn(`[SyncService] Unknown operation type: ${operation.type}`);
    }
  }

  // Refresh data from server
  private async refreshData(): Promise<void> {
    try {
      // Refresh inventory
      const { items } = await dbApi.getInventory();
      for (const item of items) {
        await offlineStorage.saveItem(item);
      }

      // Refresh sales
      const { sales } = await dbApi.getSales();
      for (const sale of sales) {
        await offlineStorage.saveSale(sale);
      }
    } catch (error) {
      console.error('[SyncService] Failed to refresh data:', error);
    }
  }

  // Queue an operation for offline sync
  async queueOperation(
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    table: 'items' | 'sales' | 'distributions' | 'withdrawals',
    data: any
  ): Promise<void> {
    const operation = {
      id: `${table}-${type}-${Date.now()}-${Math.random()}`,
      type,
      table,
      data,
      timestamp: Date.now(),
      synced: false
    };

    await offlineStorage.queueOperation(operation);

    // Update pending count
    const pending = await offlineStorage.getPendingOperations();
    this.updateStatus({ pendingOperations: pending.length });

    // Try to sync immediately if online
    if (navigator.onLine) {
      await this.sync();
    } else {
      console.log('[SyncService] Operation queued for later sync');
    }
  }

  // Manual sync trigger
  async manualSync(): Promise<void> {
    await this.sync();
  }
}

export const syncService = new SyncService();

