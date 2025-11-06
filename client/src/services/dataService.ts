// Smart Data Service - Automatically uses Supabase if configured, otherwise mockData
// This allows seamless switching without changing all the code
import { dbApi, setupRealtimeSubscriptions } from './databaseService';
import { mockApi } from './mockData';
import { isSupabaseConfigured } from '../lib/supabase';

// Create a wrapper to unify the API signatures
const createUnifiedApi = (): typeof dbApi => {
  const api = isSupabaseConfigured() ? dbApi : mockApi;
  
  // Wrap distributeStock to handle signature differences
  return {
    ...api,
    distributeStock: async (distributionData: {
      item_id: number;
      distributions: Array<{ stall_id: number; quantity: number }>;
      notes?: string;
    }) => {
      if (isSupabaseConfigured()) {
        return (dbApi as any).distributeStock(distributionData);
      } else {
        // For mockApi, call it for each distribution
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
    }
  } as typeof dbApi;
};

// Export the API that automatically selects the right backend
export const dataApi = createUnifiedApi();

// Export real-time setup (only works with Supabase)
export const setupRealtime = setupRealtimeSubscriptions;

// Export types for use in components
export type { User, Sale, Stall, Item, SaleInput } from './databaseService';

// Export for direct use
export default dataApi;

