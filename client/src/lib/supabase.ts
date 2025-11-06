import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Create a dummy Supabase client if credentials are missing (prevents errors)
let supabase: ReturnType<typeof createClient>;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Using mock data mode.');
  // Create a dummy client to prevent errors
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
} else {
  console.log('✅ Supabase client initialized successfully!');
  console.log('📡 Project URL:', supabaseUrl);
  // Create real Supabase client
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

// Export the supabase client
export { supabase };

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

