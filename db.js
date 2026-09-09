import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
