// Smart Data Service - Automatically uses Supabase if configured, otherwise mockData
// This allows seamless switching without changing all the code
import { dbApi, setupRealtimeSubscriptions } from './databaseService';
import { mockApi } from './mockData';
import { isSupabaseConfigured } from '../lib/supabase';

// Export the API that automatically selects the right backend
export const dataApi = isSupabaseConfigured() ? dbApi : mockApi;

// Export real-time setup (only works with Supabase)
export const setupRealtime = setupRealtimeSubscriptions;

// Export for direct use
export default dataApi;

