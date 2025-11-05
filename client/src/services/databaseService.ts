// Database Service - Uses Supabase with real-time sync, falls back to mockData
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockApi, type User, type Sale, type Stall, type SaleInput, type InventoryItem as Item } from './mockData';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Export interfaces for compatibility
export type { User, Sale, Stall, Item, SaleInput };

// Real-time subscription channels
let inventoryChannel: RealtimeChannel | null = null;
let salesChannel: RealtimeChannel | null = null;
let usersChannel: RealtimeChannel | null = null;

// Callbacks for real-time updates
const updateCallbacks: {
  inventory?: (items: Item[]) => void;
  sales?: (sales: Sale[]) => void;
  users?: (users: User[]) => void;
} = {};

// Setup real-time subscriptions
export const setupRealtimeSubscriptions = (callbacks: {
  inventory?: (items: Item[]) => void;
  sales?: (sales: Sale[]) => void;
  users?: (users: User[]) => void;
}) => {
  if (!isSupabaseConfigured()) {
    console.log('📝 Supabase not configured, using polling instead');
    return () => {}; // Return cleanup function
  }

  updateCallbacks.inventory = callbacks.inventory;
  updateCallbacks.sales = callbacks.sales;
  updateCallbacks.users = callbacks.users;

  // Subscribe to inventory changes
  inventoryChannel = supabase
    .channel('inventory-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'items' },
      async () => {
        if (callbacks.inventory) {
          const { data } = await supabase
            .from('items')
            .select('*')
            .order('date_added', { ascending: false });
          if (data) callbacks.inventory(data as Item[]);
        }
      }
    )
    .subscribe();

  // Subscribe to sales changes
  salesChannel = supabase
    .channel('sales-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'sales' },
      async () => {
        if (callbacks.sales) {
          const { data } = await supabase
            .from('sales')
            .select('*, users:recorded_by(full_name)')
            .order('date_time', { ascending: false });
          if (data) {
            const sales = data.map((sale: any) => ({
              ...sale,
              recorded_by_name: sale.users?.full_name || 'Unknown'
            }));
            callbacks.sales(sales as Sale[]);
          }
        }
      }
    )
    .subscribe();

  // Subscribe to users changes
  usersChannel = supabase
    .channel('users-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      async () => {
        if (callbacks.users) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .order('created_date', { ascending: false });
          if (data) callbacks.users(data as User[]);
        }
      }
    )
    .subscribe();

  // Cleanup function
  return () => {
    inventoryChannel?.unsubscribe();
    salesChannel?.unsubscribe();
    usersChannel?.unsubscribe();
  };
};

// Database API - Uses Supabase if configured, otherwise mockData
export const dbApi = {
  // Users
  getUsers: async () => {
    if (!isSupabaseConfigured()) {
      return mockApi.getUsers();
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_date', { ascending: false });

      if (error) throw error;
      return { users: data as User[] };
    } catch (error) {
      console.error('Error fetching users:', error);
      return mockApi.getUsers(); // Fallback
    }
  },

  createUser: async (userData: any) => {
    if (!isSupabaseConfigured()) {
      return mockApi.createUser(userData as any);
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) throw error;
      return { user: data as User };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Inventory
  getInventory: async (stallId?: number) => {
    if (!isSupabaseConfigured()) {
      return mockApi.getInventory(stallId);
    }

    try {
      let query = supabase
        .from('items')
        .select('*');

      if (stallId) {
        // Get items distributed to this stall
        const { data: distributions } = await supabase
          .from('stock_distribution')
          .select('item_id, quantity_allocated')
          .eq('stall_id', stallId);

        const itemIds = distributions?.map(d => d.item_id) || [];
        if (itemIds.length > 0) {
          query = query.in('item_id', itemIds);
        } else {
          return { items: [] };
        }
      }

      const { data, error } = await query.order('date_added', { ascending: false });

      if (error) throw error;

      // Calculate current stock based on distributions and sales
      const items = await Promise.all((data || []).map(async (item: any) => {
        const { data: distributions } = await supabase
          .from('stock_distribution')
          .select('quantity_allocated')
          .eq('item_id', item.item_id)
          .eq('stall_id', stallId || 0);

        const totalDistributed = distributions?.reduce((sum, d) => sum + d.quantity_allocated, 0) || 0;

        const { data: sales } = await supabase
          .from('sales')
          .select('quantity_sold')
          .eq('item_id', item.item_id)
          .eq('stall_id', stallId || 0);

        const totalSold = sales?.reduce((sum, s) => sum + s.quantity_sold, 0) || 0;

        return {
          ...item,
          current_stock: Math.max(0, totalDistributed - totalSold),
          initial_stock: item.initial_stock || 0,
          total_added: totalDistributed
        };
      }));

      return { items };
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return mockApi.getInventory(stallId); // Fallback
    }
  },

  createItem: async (itemData: any) => {
    if (!isSupabaseConfigured()) {
      return mockApi.createItem(itemData as any);
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (error) throw error;
      return { item: data as Item };
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  },

  updateItem: async (itemId: number, itemData: any) => {
    if (!isSupabaseConfigured()) {
      return mockApi.updateItem(itemId, itemData as any);
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .update(itemData)
        .eq('item_id', itemId)
        .select()
        .single();

      if (error) throw error;
      return { item: data as Item };
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },

  distributeStock: async (distributionData: {
    item_id: number;
    distributions: Array<{ stall_id: number; quantity: number }>;
    notes?: string;
  }) => {
    if (!isSupabaseConfigured()) {
      // Call mockApi with the correct signature - it expects (itemId, distribution)
      // We'll call it for each distribution
      for (const dist of distributionData.distributions) {
        await mockApi.distributeStock(distributionData.item_id, {
          stall_id: dist.stall_id,
          quantity_allocated: dist.quantity
        });
      }
      return { distributions: distributionData.distributions.map(d => ({
        item_id: distributionData.item_id,
        stall_id: d.stall_id,
        quantity_allocated: d.quantity,
        date_distributed: new Date().toISOString()
      })) };
    }

    try {
      const distributions = distributionData.distributions.map(dist => ({
        item_id: distributionData.item_id,
        stall_id: dist.stall_id,
        quantity_allocated: dist.quantity,
        date_distributed: new Date().toISOString(),
        notes: distributionData.notes || ''
      }));

      const { data, error } = await supabase
        .from('stock_distribution')
        .insert(distributions)
        .select();

      if (error) throw error;
      return { distributions: data };
    } catch (error) {
      console.error('Error distributing stock:', error);
      throw error;
    }
  },

  // Sales
  getSales: async () => {
    if (!isSupabaseConfigured()) {
      return mockApi.getSales();
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          users:recorded_by(full_name),
          stalls:stall_id(stall_name),
          items:item_id(item_name, category)
        `)
        .order('date_time', { ascending: false });

      if (error) throw error;

      const sales = (data || []).map((sale: any) => ({
        ...sale,
        recorded_by_name: sale.users?.full_name || 'Unknown',
        stall_name: sale.stalls?.stall_name || 'Unknown',
        item_name: sale.items?.item_name || 'Unknown',
        category: sale.items?.category || 'Unknown'
      }));

      return { sales: sales as Sale[] };
    } catch (error) {
      console.error('Error fetching sales:', error);
      return mockApi.getSales(); // Fallback
    }
  },

  createSale: async (saleData: SaleInput) => {
    if (!isSupabaseConfigured()) {
      return mockApi.createSale(saleData);
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .insert([saleData])
        .select()
        .single();

      if (error) throw error;
      return { sale: data as Sale };
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  },

  updateSale: async (saleId: number, saleData: any) => {
    if (!isSupabaseConfigured()) {
      // Mock implementation
      return { sale: { ...saleData, sale_id: saleId } as Sale };
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .update(saleData)
        .eq('sale_id', saleId)
        .select()
        .single();

      if (error) throw error;
      return { sale: data as Sale };
    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  },

  // Stalls
  getStalls: async () => {
    if (!isSupabaseConfigured()) {
      return mockApi.getStalls();
    }

    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .order('stall_name', { ascending: true });

      if (error) throw error;
      return { stalls: data as Stall[] };
    } catch (error) {
      console.error('Error fetching stalls:', error);
      return mockApi.getStalls(); // Fallback
    }
  }
};

// Export as default for easy migration
export default dbApi;

