import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema.js';

// Supabase configuration for authentication and data storage
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

// Neon database connection for application data
const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(DATABASE_URL);
export const db = drizzle(sql, { schema });
