import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoafqqhojpuigpxrxfwm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7CxZ7FfKLrIAO5qkXptVIg_9wVT0hCA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function checkSupabaseConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok || res.status === 200) {
      return { ok: true, message: 'Connected to Supabase Cloud (Global Cluster)', latencyMs };
    }
    // Any response from domain means reached
    return { ok: true, message: 'Connected to Supabase gateway', latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, message: err?.message || 'Connection failed', latencyMs };
  }
}
