import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Debug: Log what we're getting (without exposing the full key)
console.log('[Supabase Config] Checking environment variables...');
console.log('[Supabase Config] REACT_APP_SUPABASE_URL exists:', !!supabaseUrl);
console.log('[Supabase Config] REACT_APP_SUPABASE_URL value:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING');
console.log('[Supabase Config] REACT_APP_SUPABASE_ANON_KEY exists:', !!supabaseAnonKey);
console.log('[Supabase Config] REACT_APP_SUPABASE_ANON_KEY length:', supabaseAnonKey ? supabaseAnonKey.length : 0);

// Bypass HTTP/service-worker caches so stock mutations are visible on the next read.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

// Create Supabase client (or dummy if credentials missing)
let supabase: ReturnType<typeof createClient>;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Using mock data mode.');
  console.warn('⚠️ Make sure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY are set in Vercel environment variables.');
  // Create a dummy client to prevent runtime errors
  // Use 'as any' to bypass TypeScript type checking since this won't be used
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    global: { fetch: noStoreFetch },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }) as any;
} else {
  console.log('✅ Supabase client initialized successfully!');
  console.log('📡 Project URL:', supabaseUrl);
  // Create real Supabase client
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: noStoreFetch },
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
  const isConfigured = !!(supabaseUrl && supabaseAnonKey);
  console.log('[Supabase Config] Is configured:', isConfigured);
  return isConfigured; // Use real Supabase where admin distributed the data
};

