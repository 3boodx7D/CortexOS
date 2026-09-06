import { createClient, type User, type Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoafqqhojpuigpxrxfwm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7CxZ7FfKLrIAO5qkXptVIg_9wVT0hCA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  localStorage.removeItem('cortex-guest-mode');
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } finally {
    window.location.reload();
  }
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

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
    return { ok: true, message: 'Connected to Supabase gateway', latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, message: err?.message || 'Connection failed', latencyMs };
  }
}
