import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRole) {
  throw new Error('Missing required Supabase environment variables');
}

// Client for authenticated requests
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service role for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});
