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

      // Sync each operation, oldest first, so a sale never lands before the
      // item or stock movement it depends on.
      const ordered = [...pendingOperations].sort(
        (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
      );

      const failures: string[] = [];
      for (const operation of ordered) {
        try {
          await this.syncOperation(operation);
          await offlineStorage.markOperationSynced(operation.id);
        } catch (error) {
          console.error(`[SyncService] Failed to sync operation ${operation.id}:`, error);
          failures.push(`${operation.type} ${operation.table}`);
          // Keep operation in queue for retry
        }
      }

      // Clean up synced operations
      await offlineStorage.deleteSyncedOperations();

      // Refresh data from server
      await this.refreshData();

      // Report what is genuinely still queued. Forcing this to zero showed a
      // green "all synced" badge while changes were still sitting on the device.
      const stillPending = await offlineStorage.getPendingOperations();

      this.updateStatus({
        isSyncing: false,
        lastSyncTime: Date.now(),
        pendingOperations: stillPending.length
      });

      if (failures.length > 0) {
        console.warn(
          `[SyncService] ${failures.length} operation(s) could not be saved and are still queued: ${failures.join(', ')}`
        );
        window.dispatchEvent(
          new CustomEvent('sync-incomplete', { detail: { pending: stillPending.length, failures } })
        );
      } else {
        console.log('[SyncService] Sync completed successfully');
      }
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
      this.updateStatus({ isSyncing: false });
    }
  }

  // Apply a single queued operation to the server.
  //
  // Anything this cannot apply MUST throw. The caller only marks an operation
  // as synced when this returns, so a silent fall-through used to drop the
  // operation from the queue while the server never received it — the shop saw
  // "synced" and the record simply did not exist.
  private async syncOperation(operation: any): Promise<void> {
    const { type, table, data } = operation;

    if (type === 'CREATE') {
      switch (table) {
        case 'sales': {
          const result = await dbApi.createSale(data);
          // The offline copy was keyed by a placeholder id. Now that the server
          // has issued a real one, drop the placeholder or the device counts
          // the same sale twice the next time it reads from its own cache.
          if (data.__tempSaleId != null) {
            await offlineStorage.deleteSale(Number(data.__tempSaleId));
          }
          return result as unknown as void;
        }
        case 'items':
          await dbApi.createItem(data);
          return;
        case 'withdrawals':
          await dbApi.createWithdrawal(data);
          return;
        case 'stock_additions':
          await dbApi.addStock(data.item_id, data.quantity);
          return;
      }
    }

    if (type === 'UPDATE') {
      switch (table) {
        case 'items':
          await dbApi.updateItem(data.item_id, data);
          return;
        case 'sales':
          await dbApi.updateSale(data.sale_id, data);
          return;
      }
    }

    if (type === 'DELETE' && table === 'sales') {
      const ids: number[] = Array.isArray(data.sale_ids)
        ? data.sale_ids.map(Number)
        : [Number(data.sale_id)];
      await dbApi.bulkDeleteSales(ids);
      return;
    }

    throw new Error(
      `[SyncService] No handler for ${type} on "${table}" — refusing to discard this change.`
    );
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
    table: 'items' | 'sales' | 'withdrawals' | 'stock_additions',
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

  // Remove sales that were deleted while offline.
  //
  // A sale that was also created offline has never reached the server, so the
  // honest undo is to drop its queued insert. Queueing a delete instead would
  // race: the insert would run first and leave a sale on the server that the
  // operator had already deleted.
  async cancelOrQueueSaleDeletion(saleIds: number[]): Promise<void> {
    const pending = await offlineStorage.getPendingOperations();
    const remaining: number[] = [];

    for (const saleId of saleIds) {
      const queuedInsert = pending.find(
        (op: any) =>
          op.type === 'CREATE' &&
          op.table === 'sales' &&
          Number(op.data?.__tempSaleId) === Number(saleId)
      );

      if (queuedInsert) {
        await offlineStorage.removeOperation(queuedInsert.id);
      } else {
        remaining.push(saleId);
      }
    }

    if (remaining.length > 0) {
      await this.queueOperation('DELETE', 'sales', { sale_ids: remaining });
    } else {
      const stillPending = await offlineStorage.getPendingOperations();
      this.updateStatus({ pendingOperations: stillPending.length });
    }
  }

  // Manual sync trigger
  async manualSync(): Promise<void> {
    await this.sync();
  }
}

export const syncService = new SyncService();

