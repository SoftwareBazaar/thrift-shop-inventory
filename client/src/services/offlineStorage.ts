// Offline Storage Service using IndexedDB
// Stores data locally for offline access and syncs when online

const DB_NAME = 'ThriftShopDB';
const DB_VERSION = 1;

interface OfflineOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: 'items' | 'sales' | 'distributions';
  data: any;
  timestamp: number;
  synced: boolean;
}

class OfflineStorageService {
  private db: IDBDatabase | null = null;

  // Initialize IndexedDB
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineStorage] Failed to open database');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineStorage] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('items')) {
          const itemsStore = db.createObjectStore('items', { keyPath: 'item_id', autoIncrement: false });
          itemsStore.createIndex('item_name', 'item_name', { unique: false });
          itemsStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'sale_id', autoIncrement: true });
          salesStore.createIndex('item_id', 'item_id', { unique: false });
          salesStore.createIndex('date_time', 'date_time', { unique: false });
        }

        if (!db.objectStoreNames.contains('distributions')) {
          const distributionsStore = db.createObjectStore('distributions', { keyPath: 'distribution_id', autoIncrement: true });
          distributionsStore.createIndex('item_id', 'item_id', { unique: false });
          distributionsStore.createIndex('stall_id', 'stall_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('offline_queue')) {
          const queueStore = db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('synced', 'synced', { unique: false });
        }

        if (!db.objectStoreNames.contains('sync_state')) {
          db.createObjectStore('sync_state', { keyPath: 'key' });
        }

        console.log('[OfflineStorage] Database structure created');
      };
    });
  }

  // Check if online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Save item to offline storage
  async saveItem(item: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['items'], 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.put(item);

      request.onsuccess = () => {
        console.log('[OfflineStorage] Item saved:', item.item_id);
        resolve();
      };

      request.onerror = () => {
        console.error('[OfflineStorage] Failed to save item');
        reject(request.error);
      };
    });
  }

  // Get all items from offline storage
  async getItems(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['items'], 'readonly');
      const store = transaction.objectStore('items');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Save sale to offline storage
  async saveSale(sale: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sales'], 'readwrite');
      const store = transaction.objectStore('sales');
      const request = store.put(sale);

      request.onsuccess = () => {
        console.log('[OfflineStorage] Sale saved:', sale.sale_id);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get all sales from offline storage
  async getSales(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sales'], 'readonly');
      const store = transaction.objectStore('sales');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Add operation to offline queue
  async queueOperation(operation: OfflineOperation): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const request = store.put(operation);

      request.onsuccess = () => {
        console.log('[OfflineStorage] Operation queued:', operation.id);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get all pending operations
  async getPendingOperations(): Promise<OfflineOperation[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_queue'], 'readonly');
      const store = transaction.objectStore('offline_queue');
      const index = store.index('synced');
      const pending: OfflineOperation[] = [];

      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const value = cursor.value as OfflineOperation;
          if (!value.synced) {
            pending.push(value);
          }
          cursor.continue();
        } else {
          resolve(pending);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Mark operation as synced
  async markOperationSynced(operationId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const getRequest = store.get(operationId);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.synced = true;
          const putRequest = store.put(operation);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Delete synced operations (cleanup)
  async deleteSyncedOperations(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const index = store.index('synced');
      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const value = cursor.value as OfflineOperation;
          if (value.synced) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear all offline data (for testing/reset)
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    
    const stores = ['items', 'sales', 'distributions', 'offline_queue'];
    const promises = stores.map((storeName) => {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    console.log('[OfflineStorage] All data cleared');
  }
}

export const offlineStorage = new OfflineStorageService();

