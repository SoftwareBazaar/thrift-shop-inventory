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
        // Offline: get from IndexedDB and calculate stock from distributions
        console.log(`[OfflineDataApi] Getting inventory from offline storage for stall: ${stallId || 'admin'}`);
        const items = await offlineStorage.getItems();
        const distributions = await offlineStorage.getDistributions();
        const sales = await offlineStorage.getSales();

        // If stallId is provided (non-admin user), calculate stock from distributions
        if (stallId !== undefined) {
          console.log(`[OfflineDataApi] Filtering for stall ${stallId}, found ${distributions.length} distributions`);

          const filteredItems = items
            .map(item => {
              // Get all distributions to this stall for this item
              const stallDistributions = distributions.filter(
                d => d.item_id === item.item_id && d.stall_id === stallId
              );

              const totalDistributedToStall = stallDistributions.reduce(
                (sum, d) => sum + d.quantity_allocated, 0
              );

              // If no stock distributed to this stall, exclude this item
              if (totalDistributedToStall === 0) {
                return null;
              }

              // Calculate sales from this stall for this item
              const stallSales = sales.filter(
                s => s.item_id === item.item_id && s.stall_id === stallId
              );
              const totalSold = stallSales.reduce((sum, s) => sum + s.quantity_sold, 0);

              // Calculate stock available for this stall
              const currentStock = Math.max(0, totalDistributedToStall - totalSold);

              return {
                ...item,
                current_stock: currentStock,
                total_allocated: totalDistributedToStall,
                stall_id: stallId
              };
            })
            .filter((item): item is any => item !== null);

          console.log(`[OfflineDataApi] Returning ${filteredItems.length} items for stall ${stallId}`);
          return { items: filteredItems };
        }

        // Admin: return all items with admin stock calculation
        const itemsWithAdminStock = items.map(item => {
          const totalDistributed = distributions
            .filter(d => d.item_id === item.item_id)
            .reduce((sum, d) => sum + d.quantity_allocated, 0);

          const totalSold = sales
            .filter(s => s.item_id === item.item_id)
            .reduce((sum, s) => sum + s.quantity_sold, 0);

          const adminStock = Math.max(0, (item.initial_stock || 0) + (item.total_added || 0) - totalDistributed - totalSold);

          return {
            ...item,
            current_stock: adminStock,
            total_allocated: totalDistributed
          };
        });

        return { items: itemsWithAdminStock };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error getting inventory:', error);
      // Fallback to simple offline storage
      const items = await offlineStorage.getItems();
      return { items };
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

  // Distribute stock - handle offline
  distributeStock: async (distributionData: {
    item_id: number;
    distributions: Array<{ stall_id: number; quantity: number }>;
    notes?: string;
  }) => {
    try {
      if (navigator.onLine) {
        const result = await dataApi.distributeStock(distributionData);

        // Save distributions to offline storage for offline access
        if (result && result.distributions) {
          for (const dist of result.distributions) {
            await offlineStorage.saveDistribution(dist);
          }
        }

        // Also refetch and cache the updated inventory
        const inventory = await dataApi.getInventory();
        if (inventory.items) {
          for (const item of inventory.items) {
            await offlineStorage.saveItem(item);
          }
        }

        return result;
      } else {
        // Offline: queue for sync
        console.log('[OfflineDataApi] Distributing stock offline, queuing for sync');
        await syncService.queueOperation('CREATE', 'distributions', distributionData);

        // Create temporary distribution records
        const tempDistributions = distributionData.distributions.map(d => ({
          distribution_id: Date.now() + Math.random(),
          item_id: distributionData.item_id,
          stall_id: d.stall_id,
          quantity_allocated: d.quantity,
          date_distributed: new Date().toISOString(),
          distributed_by: 1
        }));

        // Save to offline storage
        for (const dist of tempDistributions) {
          await offlineStorage.saveDistribution(dist);
        }

        return { distributions: tempDistributions };
      }
    } catch (error) {
      console.error('[OfflineDataApi] Error distributing stock:', error);
      throw error;
    }
  },

  // Other methods pass through to main API
  getUsers: dataApi.getUsers,
  createUser: dataApi.createUser,
  updateUser: dataApi.updateUser,
  getStalls: dataApi.getStalls,
  createStall: dataApi.createStall,
  updateStall: dataApi.updateStall
};

export default offlineDataApi;
