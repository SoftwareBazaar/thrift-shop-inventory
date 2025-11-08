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
  inventoryChannel = (supabase as any)
    .channel('inventory-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'items' },
      async () => {
        if (callbacks.inventory) {
          const { data } = await (supabase as any)
            .from('items')
            .select('*')
            .order('date_added', { ascending: false });
          if (data) callbacks.inventory(data as Item[]);
        }
      }
    )
    .subscribe();

  // Subscribe to sales changes
  salesChannel = (supabase as any)
    .channel('sales-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'sales' },
      async () => {
        if (callbacks.sales) {
          const { data } = await (supabase as any)
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
  usersChannel = (supabase as any)
    .channel('users-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      async () => {
        if (callbacks.users) {
          const { data } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
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

  updateUser: async (userId: number, userData: Partial<User>) => {
    if (!isSupabaseConfigured()) {
      return mockApi.updateUser(userId, userData as any);
    }

    try {
      const { data, error } = await (supabase as any)
        .from('users')
        .update(userData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return { user: data as User };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Inventory
  getInventory: async (stallId?: number) => {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, using mock data for inventory');
      return mockApi.getInventory(stallId);
    }

      console.log(`[Get Inventory] Fetching inventory${stallId ? ` for stall ${stallId}` : ' (admin view)'}`);

      try {
        let query = (supabase as any)
          .from('items')
          .select('*');

        if (stallId) {
          // Get items distributed to this stall
          console.log(`[Get Inventory] Querying distributions for stall ${stallId}...`);
          const { data: distributions, error: distError } = await (supabase as any)
            .from('stock_distribution')
            .select('item_id, quantity_allocated')
            .eq('stall_id', stallId);

          if (distError) {
            console.error(`[Get Inventory] Error fetching distributions:`, distError);
          }

          const itemIds = (distributions as any)?.map((d: any) => d.item_id).filter((id: any) => id != null) || [];
          console.log(`[Get Inventory] Stall ${stallId} - Found ${itemIds.length} distributions, item_ids:`, itemIds);
          
          if (itemIds.length > 0) {
            // Use .in() method correctly - ensure itemIds is a non-empty array
            query = (query as any).in('item_id', itemIds);
            console.log(`[Get Inventory] Querying items with item_ids:`, itemIds);
          } else {
            console.log(`[Get Inventory] No items distributed to stall ${stallId}`);
            return { items: [] };
          }
        }

        const { data, error } = await (query as any).order('date_added', { ascending: false });
        
        if (error) {
          console.error(`[Get Inventory] Error fetching items:`, error);
          throw error;
        }
        
        console.log(`[Get Inventory] Fetched ${data?.length || 0} items from database`);

      // Calculate current stock based on distributions and sales
      console.log(`[Get Inventory] Processing ${data?.length || 0} items, stallId: ${stallId}`);
      const items = await Promise.all((data || []).map(async (item: any) => {
        if (stallId !== undefined) {
          console.log(`[Get Inventory] Processing item ${item.item_id} (${item.item_name}) for stall ${stallId}`);
          // For specific stall: calculate distributed - sold for that stall
          // Get all distributions sorted by date
          const { data: distributions } = await (supabase as any)
            .from('stock_distribution')
            .select('quantity_allocated, date_distributed')
            .eq('item_id', item.item_id)
            .eq('stall_id', stallId)
            .order('date_distributed', { ascending: true });

          const sortedDistributions = (distributions || []).sort((a: any, b: any) => 
            new Date(a.date_distributed).getTime() - new Date(b.date_distributed).getTime()
          );

          const totalDistributed = sortedDistributions.reduce((sum: number, d: any) => sum + d.quantity_allocated, 0);

          // Get all sales for this item at this stall
          const { data: sales } = await (supabase as any)
            .from('sales')
            .select('quantity_sold, date_time')
            .eq('item_id', item.item_id)
            .eq('stall_id', stallId);

          const totalSold = (sales || []).reduce((sum: number, s: any) => sum + s.quantity_sold, 0) || 0;

          // Calculate initial_stock and total_added based on distribution history
          // Initial stock = stock the user had at the time of the most recent distribution
          // Total added = quantity from the most recent distribution
          let initialStock = 0;
          let totalAdded = 0;

          if (sortedDistributions.length > 0) {
            const mostRecentDistribution = sortedDistributions[sortedDistributions.length - 1];
            totalAdded = mostRecentDistribution.quantity_allocated;

            if (sortedDistributions.length === 1) {
              // First distribution: initial = 0 (no stock before first distribution)
              initialStock = 0;
            } else {
              // For subsequent distributions: calculate stock at the time of the most recent distribution
              // This is: all previous distributions minus all sales up to that point
              const previousDistributions = sortedDistributions.slice(0, -1);
              const totalPreviousDistributed = previousDistributions.reduce(
                (sum: number, d: any) => sum + d.quantity_allocated, 0
              );

              // Calculate all sales that happened strictly before the most recent distribution
              // We use < (not <=) to ensure we get the stock at the moment before the new distribution
              const lastDistributionDate = new Date(mostRecentDistribution.date_distributed);
              const salesBeforeDistribution = (sales || []).filter(
                (s: any) => new Date(s.date_time) < lastDistributionDate
              );
              const totalSalesBeforeDistribution = salesBeforeDistribution.reduce(
                (sum: number, s: any) => sum + s.quantity_sold, 0
              );
              
              // Initial stock = stock the user had at that moment (before the new distribution)
              // This represents their "present stock" at the time they received the new stock
              // This is: previous distributions - sales before that point
              initialStock = Math.max(0, totalPreviousDistributed - totalSalesBeforeDistribution);
            }
          }

          // Current stock = total distributed - total sold
          const currentStock = Math.max(0, totalDistributed - totalSold);

          console.log(`[User Stock Calc] Item: ${item.item_name}, Stall: ${stallId}, Distributions: ${sortedDistributions.length}, initialStock: ${initialStock}, totalAdded: ${totalAdded}, currentStock: ${currentStock}`);

          // IMPORTANT: Explicitly create new object with calculated values
          // DO NOT use spread operator on item - it might include the original initial_stock
          const userItem = {
            item_id: item.item_id,
            item_name: item.item_name,
            category: item.category,
            sku: item.sku,
            unit_price: item.unit_price,
            buying_price: item.buying_price,
            date_added: item.date_added,
            current_stock: currentStock,
            initial_stock: initialStock, // Use calculated value (0 for first distribution)
            total_added: totalAdded,
            total_allocated: totalDistributed // For compatibility
          };
          
          console.log(`[User Stock Calc] Returning item:`, {
            item_id: userItem.item_id,
            item_name: userItem.item_name,
            original_initial_stock: item.initial_stock,
            calculated_initial_stock: userItem.initial_stock,
            total_added: userItem.total_added,
            current_stock: userItem.current_stock,
            distributions_count: sortedDistributions.length
          });
          
          // CRITICAL: Verify the calculated value is actually in the returned object
          if (userItem.initial_stock !== initialStock) {
            console.error(`[ERROR] initial_stock mismatch! Calculated: ${initialStock}, Returned: ${userItem.initial_stock}`);
          }
          
          // Force set the value one more time to be absolutely sure
          userItem.initial_stock = initialStock;
          userItem.total_added = totalAdded;
          
          console.log(`[User Stock Calc] FINAL VERIFICATION - initial_stock: ${userItem.initial_stock}, total_added: ${userItem.total_added}`);
          
          return userItem;
        } else {
          // For admin view: calculate actual available stock (initial + additions - total sold)
          const initialStock = item.initial_stock != null ? Number(item.initial_stock) : 0;
          const existingCurrentStock = item.current_stock != null ? Number(item.current_stock) : 0;

          // Sum stock additions
          const { data: stockAdditions } = await (supabase as any)
            .from('stock_additions')
            .select('quantity_added')
            .eq('item_id', item.item_id);

          const totalAdded = (stockAdditions as any)?.reduce((sum: number, a: any) => sum + (a.quantity_added || 0), 0) || 0;

          // Sum sales quantities
          const { data: itemSales } = await (supabase as any)
            .from('sales')
            .select('quantity_sold')
            .eq('item_id', item.item_id);

          const totalSold = (itemSales as any)?.reduce((sum: number, sale: any) => sum + (sale.quantity_sold || 0), 0) || 0;

          const adminStock = Math.max(0, initialStock + totalAdded - totalSold);

          if (existingCurrentStock !== adminStock) {
            try {
              await (supabase as any)
                .from('items')
                .update({ current_stock: adminStock })
                .eq('item_id', item.item_id);
            } catch (updateError) {
              console.warn('[Admin Stock Calc] Failed to sync current_stock for item', item.item_id, updateError);
            }
          }

          console.log(`[Admin Stock Calc] Item: ${item.item_name} (ID: ${item.item_id}), initial_stock: ${initialStock}, totalAdded: ${totalAdded}, totalSold: ${totalSold}, adminStock: ${adminStock}`);

          return {
            ...item,
            current_stock: adminStock,
            initial_stock: initialStock,
            total_added: totalAdded
          };
        }
      }));

      return { items };
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return mockApi.getInventory(stallId); // Fallback
    }
  },

  createItem: async (itemData: any) => {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, using mock data');
      return mockApi.createItem(itemData as any);
    }

    try {
      // Ensure initial_stock is a number
      const itemToInsert = {
        ...itemData,
        initial_stock: Number(itemData.initial_stock) || 0,
        current_stock: Number(itemData.current_stock) || Number(itemData.initial_stock) || 0
      };

      console.log('[Create Item] Inserting item:', itemToInsert);

      const { data, error } = await (supabase as any)
        .from('items')
        .insert([itemToInsert])
        .select()
        .single();

      if (error) {
        console.error('[Create Item] Supabase error:', error);
        throw error;
      }
      
      console.log('[Create Item] Item created successfully:', data);
      
      // Note: We don't create stock_additions for initial_stock
      // initial_stock is the starting stock, and stock_additions tracks additional stock added later
      // Admin Stock = initial_stock + total_added (from stock_additions) - total_distributed
      
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
      // If total_added is being updated, also create a stock_additions record
      if (itemData.total_added !== undefined) {
        // Get current item to calculate the difference
        const { data: currentItem } = await (supabase as any)
          .from('items')
          .select('total_added')
          .eq('item_id', itemId)
          .single();
        
        const currentTotalAdded = Number(currentItem?.total_added || 0);
        const newTotalAdded = Number(itemData.total_added);
        const quantityToAdd = newTotalAdded - currentTotalAdded;
        
        console.log(`[Update Item] Item ID: ${itemId}, currentTotalAdded: ${currentTotalAdded}, newTotalAdded: ${newTotalAdded}, quantityToAdd: ${quantityToAdd}`);
        
        // If quantity is positive, create a stock_additions record
        if (quantityToAdd > 0) {
          // Get current user for added_by (from localStorage or default to 1 for admin)
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          
          const { error: insertError } = await (supabase as any)
            .from('stock_additions')
            .insert([{
              item_id: itemId,
              quantity_added: quantityToAdd,
              added_by: currentUser.user_id || 1
            }]);
          
          if (insertError) {
            console.error('Error creating stock_additions record:', insertError);
            throw insertError;
          }
          
          console.log(`[Update Item] Created stock_additions record: ${quantityToAdd} units`);
        }
      }
      
      // Update the item (remove total_added from update since we handle it via stock_additions)
      const { total_added, ...updateData } = itemData;
      const { data, error } = await (supabase as any)
        .from('items')
        .update(updateData)
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
  }): Promise<{ distributions: Array<{ item_id: number; stall_id: number; quantity_allocated: number; date_distributed: string }> }> => {
    if (!isSupabaseConfigured()) {
      // Call mockApi with the correct signature - it expects (itemId, distribution)
      // We'll call it for each distribution
      for (const dist of distributionData.distributions) {
        await (mockApi.distributeStock as any)(distributionData.item_id, {
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
      // Get current user ID for distributed_by field
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const distributedBy = currentUser.user_id || 1; // Default to admin (1) if not found
      
      console.log('[Distribute Stock] Current user:', currentUser);
      console.log('[Distribute Stock] distributed_by:', distributedBy);
      
      const distributions = distributionData.distributions.map(dist => {
        const distRecord = {
          item_id: distributionData.item_id,
          stall_id: dist.stall_id,
          quantity_allocated: dist.quantity,
          date_distributed: new Date().toISOString(),
          distributed_by: distributedBy,
          notes: distributionData.notes || ''
        };
        console.log('[Distribute Stock] Distribution record:', distRecord);
        return distRecord;
      });

      console.log('[Distribute Stock] Inserting distributions:', distributions);

      const { data, error } = await (supabase as any)
        .from('stock_distribution')
        .insert(distributions)
        .select();

      if (error) {
        console.error('[Distribute Stock] Supabase error:', error);
        throw error;
      }
      
      console.log('[Distribute Stock] Success:', data);
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
      const { data, error } = await (supabase as any)
        .from('sales')
        .select(`
          *,
          users:recorded_by(full_name),
          stalls:stall_id(stall_name),
          items:item_id(item_name, category),
          credit_sales:credit_sales(sale_id, customer_name, customer_contact, payment_status, balance_due, amount_paid, due_date, notes)
        `)
        .order('date_time', { ascending: false });

      if (error) throw error;

      const sales = (data || []).map((sale: any) => {
        const credit = Array.isArray(sale.credit_sales) ? sale.credit_sales[0] : sale.credit_sales;

        return {
          ...sale,
          recorded_by_name: sale.users?.full_name || 'Unknown',
          stall_name: sale.stalls?.stall_name || 'Unknown',
          item_name: sale.items?.item_name || 'Unknown',
          category: sale.items?.category || 'Unknown',
          customer_name: credit?.customer_name ?? sale.customer_name,
          customer_contact: credit?.customer_contact ?? sale.customer_contact,
          payment_status: credit?.payment_status ?? sale.payment_status,
          balance_due: credit?.balance_due ?? sale.balance_due,
          amount_paid: credit?.amount_paid ?? sale.amount_paid,
          due_date: credit?.due_date ?? sale.due_date,
          notes: credit?.notes ?? sale.notes
        };
      });

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
      if (!saleData.quantity_sold || saleData.quantity_sold <= 0) {
        throw new Error('Quantity must be greater than zero.');
      }

      if (!saleData.unit_price || saleData.unit_price <= 0) {
        throw new Error('Selling price must be greater than zero.');
      }

      // Calculate total_amount if not provided
      const totalAmount = saleData.total_amount || (saleData.quantity_sold * saleData.unit_price);
      const itemId = typeof saleData.item_id === 'number' ? saleData.item_id : parseInt(saleData.item_id.toString(), 10);
      const stallId = saleData.stall_id === null || saleData.stall_id === undefined
        ? null
        : (typeof saleData.stall_id === 'number' ? saleData.stall_id : parseInt(saleData.stall_id.toString(), 10));

      if (saleData.sale_type === 'split') {
        const cashAmount = saleData.cash_amount ?? 0;
        const mobileAmount = saleData.mobile_amount ?? 0;

        if (cashAmount <= 0 || mobileAmount <= 0) {
          throw new Error('Split payment amounts must be greater than zero.');
        }

        if (Math.abs((cashAmount + mobileAmount) - totalAmount) > 0.5) {
          throw new Error('Split payment totals must equal the negotiated total.');
        }
      }
      
      const saleToInsert = {
        item_id: itemId,
        stall_id: stallId,
        quantity_sold: saleData.quantity_sold,
        unit_price: saleData.unit_price,
        total_amount: totalAmount,
        sale_type: saleData.sale_type,
        cash_amount: saleData.sale_type === 'split' ? (saleData.cash_amount ?? null) : null,
        mobile_amount: saleData.sale_type === 'split' ? (saleData.mobile_amount ?? null) : null,
        recorded_by: saleData.recorded_by
      };

      const { data, error } = await (supabase as any)
        .from('sales')
        .insert([saleToInsert])
        .select()
        .single();

      if (error) throw error;

      if (saleData.sale_type === 'credit') {
        const amountPaid = saleData.amount_paid ?? 0;
        const paymentStatus = saleData.payment_status
          ?? (amountPaid >= totalAmount ? 'fully_paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid');

        const { error: creditError } = await (supabase as any)
          .from('credit_sales')
          .insert([{
            sale_id: data.sale_id,
            customer_name: saleData.customer_name || 'Customer',
            customer_contact: saleData.customer_contact || 'N/A',
            total_credit_amount: totalAmount,
            amount_paid: amountPaid,
            payment_status: paymentStatus,
            due_date: saleData.due_date || null,
            notes: saleData.notes || null
          }]);

        if (creditError) throw creditError;
      }

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
      const { data: existingSale, error: existingError } = await (supabase as any)
        .from('sales')
        .select('*')
        .eq('sale_id', saleId)
        .single();

      if (existingError) throw existingError;

      const quantity = saleData.quantity_sold !== undefined ? saleData.quantity_sold : existingSale.quantity_sold;
      const unitPrice = saleData.unit_price !== undefined ? saleData.unit_price : existingSale.unit_price;
      const saleType = saleData.sale_type || existingSale.sale_type;

      if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be greater than zero.');
      }

      if (!unitPrice || unitPrice <= 0) {
        throw new Error('Selling price must be greater than zero.');
      }

      const totalAmount = saleData.total_amount !== undefined
        ? saleData.total_amount
        : quantity * unitPrice;

      const stallId = saleData.stall_id === undefined
        ? existingSale.stall_id
        : (saleData.stall_id === null
            ? null
            : (typeof saleData.stall_id === 'number' ? saleData.stall_id : parseInt(saleData.stall_id.toString(), 10)));

      const itemId = saleData.item_id === undefined
        ? existingSale.item_id
        : (typeof saleData.item_id === 'number' ? saleData.item_id : parseInt(saleData.item_id.toString(), 10));

      if (saleType === 'split') {
        const cashAmount = saleData.cash_amount ?? existingSale.cash_amount ?? 0;
        const mobileAmount = saleData.mobile_amount ?? existingSale.mobile_amount ?? 0;

        if (cashAmount <= 0 || mobileAmount <= 0) {
          throw new Error('Split payment amounts must be greater than zero.');
        }

        if (Math.abs((cashAmount + mobileAmount) - totalAmount) > 0.5) {
          throw new Error('Split payment totals must equal the negotiated total.');
        }
      }

      const updatePayload: any = {
        item_id: itemId,
        stall_id: stallId,
        quantity_sold: quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        sale_type: saleType,
        cash_amount: saleType === 'split' ? (saleData.cash_amount ?? existingSale.cash_amount ?? null) : null,
        mobile_amount: saleType === 'split' ? (saleData.mobile_amount ?? existingSale.mobile_amount ?? null) : null,
        recorded_by: saleData.recorded_by ?? existingSale.recorded_by
      };

      const { data, error } = await (supabase as any)
        .from('sales')
        .update(updatePayload)
        .eq('sale_id', saleId)
        .select()
        .single();

      if (error) throw error;

      const { data: existingCreditRows, error: existingCreditError } = await (supabase as any)
        .from('credit_sales')
        .select('*')
        .eq('sale_id', saleId)
        .limit(1);

      if (existingCreditError) throw existingCreditError;

      const existingCredit = Array.isArray(existingCreditRows) ? existingCreditRows[0] : null;

      if (saleType === 'credit') {
        const amountPaid = saleData.amount_paid ?? existingCredit?.amount_paid ?? 0;
        const paymentStatus = saleData.payment_status
          ?? (amountPaid >= totalAmount ? 'fully_paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid');

        const creditPayload: any = {
          customer_name: saleData.customer_name ?? existingCredit?.customer_name ?? 'Customer',
          customer_contact: saleData.customer_contact ?? existingCredit?.customer_contact ?? 'N/A',
          total_credit_amount: totalAmount,
          amount_paid: amountPaid,
          payment_status: paymentStatus,
          due_date: saleData.due_date ?? existingCredit?.due_date ?? null,
          notes: saleData.notes ?? existingCredit?.notes ?? null
        };

        if (existingCredit) {
          await (supabase as any)
            .from('credit_sales')
            .update(creditPayload)
            .eq('sale_id', saleId);
        } else {
          await (supabase as any)
            .from('credit_sales')
            .insert([{ sale_id: saleId, ...creditPayload }]);
        }
      } else if (existingCredit) {
        await (supabase as any)
          .from('credit_sales')
          .delete()
          .eq('sale_id', saleId);
      }

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
      const { data, error } = await (supabase as any)
        .from('stalls')
        .select('*')
        .order('stall_name', { ascending: true });

      if (error) throw error;
      return { stalls: data as Stall[] };
    } catch (error) {
      console.error('Error fetching stalls:', error);
      return mockApi.getStalls(); // Fallback
    }
  },

  createStall: async (stallData: any) => {
    if (!isSupabaseConfigured()) {
      return mockApi.createStall(stallData as any);
    }

    try {
      const { data, error } = await (supabase as any)
        .from('stalls')
        .insert([stallData])
        .select()
        .single();

      if (error) throw error;
      return { stall: data as Stall };
    } catch (error) {
      console.error('Error creating stall:', error);
      throw error;
    }
  },

  updateStall: async (stallId: number, stallData: Partial<Stall>) => {
    if (!isSupabaseConfigured()) {
      return mockApi.updateStall(stallId, stallData as any);
    }

    try {
      const { data, error } = await (supabase as any)
        .from('stalls')
        .update(stallData)
        .eq('stall_id', stallId)
        .select()
        .single();

      if (error) throw error;
      return { stall: data as Stall };
    } catch (error) {
      console.error('Error updating stall:', error);
      throw error;
    }
  }
};

// Export as default for easy migration
export default dbApi;

