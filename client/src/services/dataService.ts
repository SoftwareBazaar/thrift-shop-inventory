// Main Data Service - Globally enables Offline Support
// This file replaces the original dataService.ts but exposes the offline-aware API
// effectively enabling offline support for the entire application.

import { offlineDataApi } from './dataServiceWithOffline';
import { setupRealtimeSubscriptions } from './databaseService';

// Export the offline-enabled API as the default dataApi
// This means any component importing from here gets offline support automatically
export const dataApi = offlineDataApi;

// Export real-time setup (direct pass-through)
export const setupRealtime = setupRealtimeSubscriptions;

// Export types (direct pass-through)
export type { User, Sale, Stall, Item, SaleInput } from './databaseService';

// Export for direct use
export default dataApi;
