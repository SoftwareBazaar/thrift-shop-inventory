// Enhanced Data Service with Offline Support
// Wraps the main data service to add offline queueing and sync
import { dataApi } from './baseDataService';
import { offlineStorage } from './offlineStorage';
import { syncService } from './syncService';

// Enhanced API with offline support
export const offlineDataApi = {
  // Get inventory - try online first, fallback to offline
  getInventory: async (stallId?: number) => {
    try {
      if (navigator.onLine) {
        const result = await dataApi.getInventory(stallId);
        // Save to offline storage
        if (result.items) {
          for (const item of result.items) {
            await offlineStorage.saveItem(item);
          }
        }
        return result;
      } else {
        // Offline: get from IndexedDB
        console.log('[OfflineDataApi] Getting inventory from offline storage');
        const items = await offlineStorage.getItems();
        return { items: items.filter(item => !stallId || item.stall_id === stallId) };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error getting inventory:', error);
      // Fallback to offline storage
      const items = await offlineStorage.getItems();
      return { items: items.filter(item => !stallId || item.stall_id === stallId) };
    }
  },

  // Create item - queue if offline
  createItem: async (itemData: any) => {
    try {
      if (navigator.onLine) {
        const result = await dataApi.createItem(itemData);
        await offlineStorage.saveItem(result.item);
        return result;
      } else {
        // Offline: save to IndexedDB and queue for sync
        console.log('[OfflineDataApi] Creating item offline, queuing for sync');
        const tempId = Date.now(); // Temporary ID
        const offlineItem = { ...itemData, item_id: tempId, date_added: new Date().toISOString() };
        await offlineStorage.saveItem(offlineItem);
        await syncService.queueOperation('CREATE', 'items', itemData);
        return { item: offlineItem };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error creating item:', error);
      throw error;
    }
  },

  // Update item - queue if offline
  updateItem: async (itemId: number, itemData: any) => {
    try {
      if (navigator.onLine) {
        const result = await dataApi.updateItem(itemId, itemData);
        await offlineStorage.saveItem(result.item);
        return result;
      } else {
        // Offline: update in IndexedDB and queue for sync
        console.log('[OfflineDataApi] Updating item offline, queuing for sync');
        const updatedItem = { ...itemData, item_id: itemId };
        await offlineStorage.saveItem(updatedItem);
        await syncService.queueOperation('UPDATE', 'items', updatedItem);
        return { item: updatedItem };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error updating item:', error);
      throw error;
    }
  },

  // Create sale - queue if offline
  createSale: async (saleData: any) => {
    try {
      if (navigator.onLine) {
        const result = await dataApi.createSale(saleData);
        await offlineStorage.saveSale(result.sale);
        return result;
      } else {
        // Offline: save to IndexedDB and queue for sync
        console.log('[OfflineDataApi] Creating sale offline, queuing for sync');
        const tempId = Date.now(); // Temporary ID
        const offlineSale = {
          ...saleData,
          sale_id: tempId,
          date_time: new Date().toISOString()
        };
        await offlineStorage.saveSale(offlineSale);
        await syncService.queueOperation('CREATE', 'sales', saleData);
        return { sale: offlineSale };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error creating sale:', error);
      throw error;
    }
  },

  // Update sale - queue if offline
  updateSale: async (saleId: number, saleData: any) => {
    try {
      if (navigator.onLine) {
        const result = await dataApi.updateSale(saleId, saleData);
        await offlineStorage.saveSale(result.sale);
        return result;
      } else {
        // Offline: update in IndexedDB and queue for sync
        console.log('[OfflineDataApi] Updating sale offline, queuing for sync');
        // Retrieve existing sale to ensure we don't lose data
        const styles = await offlineStorage.getSales();
        const existingSale = styles.find((s: any) => s.sale_id === saleId) || {};

        const updatedSale = {
          ...existingSale,
          ...saleData,
          sale_id: saleId
        };

        await offlineStorage.saveSale(updatedSale);
        await syncService.queueOperation('UPDATE', 'sales', updatedSale);
        return { sale: updatedSale };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error updating sale:', error);
      throw error;
    }
  },

  // Get sales - try online first, fallback to offline
  getSales: async () => {
    try {
      if (navigator.onLine) {
        const result = await dataApi.getSales();
        // Save to offline storage
        if (result.sales) {
          for (const sale of result.sales) {
            await offlineStorage.saveSale(sale);
          }
        }
        return result;
      } else {
        // Offline: get from IndexedDB
        console.log('[OfflineDataApi] Getting sales from offline storage');
        const sales = await offlineStorage.getSales();
        return { sales };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error getting sales:', error);
      // Fallback to offline storage
      const sales = await offlineStorage.getSales();
      return { sales };
    }
  },

  // Other methods pass through to main API
  getUsers: dataApi.getUsers,
  createUser: dataApi.createUser,
  updateUser: dataApi.updateUser,
  getStalls: dataApi.getStalls,
  createStall: dataApi.createStall,
  updateStall: dataApi.updateStall,
  distributeStock: dataApi.distributeStock
};

export default offlineDataApi;

