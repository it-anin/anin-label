import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  !url || !key
    ? 'Missing Supabase env. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for this deployment.'
    : null;

export const supabase = url && key
  ? createClient(url, key, {
      db: { schema: 'label' },
      auth: { persistSession: false }
    })
  : null;
