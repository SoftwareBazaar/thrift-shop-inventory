// Sync Service - Handles online/offline data synchronization
import { offlineStorage } from './offlineStorage';
import { dbApi } from './databaseService';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingOperations: number;
}

const SYNC_LOCK_KEY = 'thrift_shop_sync_lock';
const SYNC_LOCK_TTL_MS = 90_000;

class SyncService {
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingOperations: 0
  };

  private syncListeners: Array<(status: SyncStatus) => void> = [];
  private lockOwner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  /** Temp sale ids cancelled while a sync pass may still hold them in memory. */
  private cancelledTempSaleIds = new Set<number>();

  constructor() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    offlineStorage.init().catch(console.error);
    this.startPeriodicSync();
  }

  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private updateStatus(updates: Partial<SyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this.syncListeners.forEach(listener => listener(this.syncStatus));
  }

  private async handleOnline() {
    console.log('[SyncService] Back online, starting sync...');
    this.updateStatus({ isOnline: true });
    await this.sync();
  }

  private handleOffline() {
    console.log('[SyncService] Gone offline');
    this.updateStatus({ isOnline: false });
  }

  private startPeriodicSync() {
    setInterval(async () => {
      if (navigator.onLine && !this.syncStatus.isSyncing) {
        const pending = await offlineStorage.getPendingOperations();
        if (pending.length > 0) {
          console.log(`[SyncService] Found ${pending.length} pending operations, syncing...`);
          await this.sync();
        }
      }
    }, 30000);
  }

  private tryAcquireCrossTabLock(): boolean {
    try {
      const now = Date.now();
      const raw = localStorage.getItem(SYNC_LOCK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { owner?: string; until?: number };
        if (
          parsed.until &&
          parsed.until > now &&
          parsed.owner &&
          parsed.owner !== this.lockOwner
        ) {
          return false;
        }
      }
      localStorage.setItem(
        SYNC_LOCK_KEY,
        JSON.stringify({ owner: this.lockOwner, until: now + SYNC_LOCK_TTL_MS })
      );
      return true;
    } catch {
      return true;
    }
  }

  private releaseCrossTabLock() {
    try {
      const raw = localStorage.getItem(SYNC_LOCK_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { owner?: string };
      if (parsed.owner === this.lockOwner) {
        localStorage.removeItem(SYNC_LOCK_KEY);
      }
    } catch {
      // ignore
    }
  }

  async sync(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[SyncService] Offline, cannot sync');
      return;
    }

    if (this.syncStatus.isSyncing) {
      console.log('[SyncService] Sync already in progress');
      return;
    }

    const run = async () => {
      if (!this.tryAcquireCrossTabLock()) {
        console.log('[SyncService] Another tab is syncing — skipping this pass');
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
            // Stop so later ops that depend on this one do not land first.
            break;
          }
        }

        await offlineStorage.deleteSyncedOperations();

        // Only overwrite local cache when every queued op applied cleanly —
        // otherwise pending add-stock bumps disappear from the UI.
        if (failures.length === 0) {
          await this.refreshData();
        }

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
            new CustomEvent('sync-incomplete', {
              detail: { pending: stillPending.length, failures }
            })
          );
        } else {
          console.log('[SyncService] Sync completed successfully');
        }
      } catch (error) {
        console.error('[SyncService] Sync error:', error);
        this.updateStatus({ isSyncing: false });
      } finally {
        this.releaseCrossTabLock();
      }
    };

    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      try {
        await (navigator as any).locks.request(
          'thrift-shop-sync',
          { ifAvailable: true },
          async (lock: Lock | null) => {
            if (!lock) {
              console.log('[SyncService] Web Lock held by another tab — skipping');
              return;
            }
            await run();
          }
        );
        return;
      } catch (error) {
        console.warn('[SyncService] Web Locks unavailable, using localStorage lock', error);
      }
    }

    await run();
  }

  private async syncOperation(operation: any): Promise<void> {
    const { type, table, data } = operation;

    if (type === 'CREATE') {
      switch (table) {
        case 'sales': {
          const tempId = data.__tempSaleId != null ? Number(data.__tempSaleId) : null;
          if (tempId != null && this.cancelledTempSaleIds.has(tempId)) {
            this.cancelledTempSaleIds.delete(tempId);
            console.log(`[SyncService] Skipping cancelled offline sale ${tempId}`);
            return;
          }

          const payload = { ...data };
          delete payload.__tempSaleId;
          await dbApi.createSale(payload);

          // Server write already succeeded — never throw on local cleanup or
          // the next pass would createSale again (double-apply).
          if (tempId != null) {
            try {
              await offlineStorage.deleteSale(tempId);
            } catch (cleanupError) {
              console.warn('[SyncService] Could not drop temp sale after sync:', cleanupError);
            }
          }
          return;
        }
        case 'items': {
          const tempItemId =
            data.__tempItemId != null ? Number(data.__tempItemId) : null;
          const payload = { ...data };
          delete payload.__tempItemId;
          const result = await dbApi.createItem(payload);
          if (tempItemId != null) {
            try {
              await offlineStorage.deleteItem(tempItemId);
            } catch (cleanupError) {
              console.warn('[SyncService] Could not drop temp item after sync:', cleanupError);
            }
          }
          if (result?.item) {
            try {
              await offlineStorage.saveItem(result.item);
            } catch (saveError) {
              console.warn('[SyncService] Could not cache created item:', saveError);
            }
          }
          return;
        }
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

  private async refreshData(): Promise<void> {
    try {
      const { items } = await dbApi.getInventory();
      for (const item of items) {
        await offlineStorage.saveItem(item);
      }

      const { sales } = await dbApi.getSales();
      for (const sale of sales) {
        await offlineStorage.saveSale(sale);
      }
    } catch (error) {
      console.error('[SyncService] Failed to refresh data:', error);
    }
  }

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

    const pending = await offlineStorage.getPendingOperations();
    this.updateStatus({ pendingOperations: pending.length });

    if (navigator.onLine) {
      await this.sync();
    } else {
      console.log('[SyncService] Operation queued for later sync');
    }
  }

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
        this.cancelledTempSaleIds.add(Number(saleId));
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

  async manualSync(): Promise<void> {
    await this.sync();
  }
}

export const syncService = new SyncService();
