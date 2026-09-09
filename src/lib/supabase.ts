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

export async function signUp(
  email: string,
  password: string,
  metadata?: {
    displayName?: string;
    username?: string;
    role?: string;
    avatarUrl?: string;
    bio?: string;
  }
) {
  const isOwner = email.toLowerCase().trim() === 'cabdulrahman36@gmail.com';
  const rawRole = (metadata?.role || '').trim();
  const lowerRole = rawRole.toLowerCase();

  // Safe Postgres ENUM role for public.users table constraint: CHECK (role IN ('admin', 'developer', 'viewer', 'founder'))
  const validDbRoles = ['admin', 'developer', 'viewer', 'founder'];
  const safeRoleEnum = isOwner
    ? 'founder'
    : (validDbRoles.includes(lowerRole) ? lowerRole : 'developer');

  const meta: Record<string, any> = {
    role: safeRoleEnum,
    custom_role: rawRole || (isOwner ? 'founder' : 'developer'),
    specialization: rawRole,
  };

  if (metadata?.displayName) {
    meta.name = metadata.displayName;
    meta.display_name = metadata.displayName;
  }
  if (metadata?.username) {
    meta.username = metadata.username.toLowerCase().trim().replace(/^@/, '');
  }
  if (metadata?.avatarUrl) {
    meta.avatarUrl = metadata.avatarUrl;
    meta.avatar_url = metadata.avatarUrl;
  }
  if (metadata?.bio) {
    meta.bio = metadata.bio;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: meta,
    },
  });
  if (error) throw error;

  // Ensure public.users entry is immediately inserted/updated
  if (data?.user) {
    try {
      const cleanUsername = meta.username || email.split('@')[0];

      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email || email,
        display_name: meta.display_name || email.split('@')[0],
        role: safeRoleEnum,
        avatar_url: meta.avatarUrl || '/default-avatar.jpg',
        bio: meta.bio || 'CortexOS Neural Operator',
        current_status: 'online',
        settings: {
          username: cleanUsername,
          custom_role: meta.custom_role || '',
        },
        updated_at: new Date().toISOString(),
      });
    } catch (upsertErr) {
      console.warn('Upserting user on signup caught:', upsertErr);
    }
  }

  return data;
}

// Early detection of recovery tokens before URL is sanitized by auth libraries
if (typeof window !== 'undefined') {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (
    hash.includes('type=recovery') ||
    search.includes('type=recovery') ||
    hash.includes('reset-password') ||
    search.includes('reset-password')
  ) {
    try {
      sessionStorage.setItem('cortex_recovery_pending', 'true');
    } catch {}
  }
}

export async function resetPasswordForEmail(email: string) {
  const redirectUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?type=recovery`
    : undefined;

  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectUrl,
  });
  if (error) throw error;
  return data;
}

export function checkIsRecoverySession(session: Session | null): boolean {
  if (!session?.access_token) return false;
  try {
    const parts = session.access_token.split('.');
    if (parts.length < 2) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    const amr = parsed?.amr;
    if (Array.isArray(amr) && amr.length > 0) {
      const recoveryEntry = [...amr].reverse().find((entry: any) => entry?.method === 'recovery');
      if (recoveryEntry) {
        const recoveryTime = recoveryEntry?.timestamp || 'default';
        const completedKey = `cortex_recovery_completed_${session.user?.id || 'anon'}_${recoveryTime}`;
        if (typeof window !== 'undefined' && localStorage.getItem(completedKey) === 'true') {
          return false;
        }
        return true;
      }
    }
  } catch (e) {
    console.warn('Error checking recovery session AMR:', e);
  }
  return false;
}

export function markRecoveryCompleted(session: Session | null) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('cortex_recovery_pending');
  } catch {}
  if (session?.user?.id && session?.access_token) {
    try {
      const parts = session.access_token.split('.');
      if (parts.length >= 2) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const parsed = JSON.parse(atob(base64));
        const amr = parsed?.amr;
        if (Array.isArray(amr)) {
          const recoveryEntry = [...amr].reverse().find((entry: any) => entry?.method === 'recovery');
          const recoveryTime = recoveryEntry?.timestamp || 'default';
          localStorage.setItem(`cortex_recovery_completed_${session.user.id}_${recoveryTime}`, 'true');
        }
      }
    } catch {}
  }
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function verifyAndChangePassword(email: string, oldPass: string, newPass: string) {
  // First, verify the old password by signing in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: oldPass,
  });
  
  if (signInError) {
    throw new Error('settings.account.incorrectOldPassword'); // Using localization key
  }
  
  // Then update to the new password
  const { data, error: updateError } = await supabase.auth.updateUser({ password: newPass });
  if (updateError) throw updateError;
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

export function onAuthStateChange(callback: (session: Session | null, event?: string) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
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

export interface SupabaseHealthReport {
  ok: boolean;
  latencyMs: number;
  authOk: boolean;
  dbOk: boolean;
  tables: {
    users: boolean;
    projects: boolean;
    friendships: boolean;
    team_collaborators: boolean;
  };
  tableErrors: Record<string, string>;
  errorMessage: string | null;
  errorCode: string | null;
  details: string | null;
  endpoint: string;
  checkedAt: string;
}

let cachedReport: SupabaseHealthReport | null = null;
let lastCheckTime = 0;
const HEALTH_CACHE_TTL = 30_000; // 30s cache to avoid excessive network requests

export async function checkSupabaseDetailedHealth(force = false): Promise<SupabaseHealthReport> {
  const now = Date.now();
  if (!force && cachedReport && now - lastCheckTime < HEALTH_CACHE_TTL) {
    return cachedReport;
  }

  const start = performance.now();
  let authOk = false;
  const tables = {
    users: false,
    projects: false,
    friendships: false,
    team_collaborators: false,
  };
  const tableErrors: Record<string, string> = {};
  let errorMessage: string | null = null;
  let errorCode: string | null = null;
  let details: string | null = null;

  try {
    // 1. Auth REST gateway check
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      authOk = authRes.ok || authRes.status === 200;
      if (!authOk) {
        tableErrors['auth_gateway'] = `HTTP status ${authRes.status}`;
      }
    } catch (authErr: any) {
      authOk = false;
      errorMessage = authErr?.message || 'Supabase Auth Gateway Unreachable';
      errorCode = 'AUTH_OFFLINE';
      tableErrors['auth_gateway'] = String(authErr);
    }

    // 2. Multi-table probe in parallel
    const [usersRes, projectsRes, friendshipsRes, teamRes] = await Promise.all([
      supabase.from('users').select('id').limit(1),
      supabase.from('projects').select('id').limit(1),
      supabase.from('friendships').select('id').limit(1),
      supabase.from('team_collaborators').select('id').limit(1),
    ]);

    if (usersRes.error) {
      tableErrors['users'] = usersRes.error.message;
      if (!errorMessage) {
        errorMessage = `Table 'users': ${usersRes.error.message}`;
        errorCode = usersRes.error.code || 'PGRST_ERR';
        details = usersRes.error.details || usersRes.error.hint;
      }
    } else {
      tables.users = true;
    }

    if (projectsRes.error) {
      tableErrors['projects'] = projectsRes.error.message;
      if (!errorMessage) {
        errorMessage = `Table 'projects': ${projectsRes.error.message}`;
        errorCode = projectsRes.error.code || 'PGRST_ERR';
        details = projectsRes.error.details || projectsRes.error.hint;
      }
    } else {
      tables.projects = true;
    }

    if (friendshipsRes.error) {
      tableErrors['friendships'] = friendshipsRes.error.message;
      if (!errorMessage) {
        errorMessage = `Table 'friendships': ${friendshipsRes.error.message}`;
        errorCode = friendshipsRes.error.code || 'PGRST_ERR';
        details = friendshipsRes.error.details || friendshipsRes.error.hint;
      }
    } else {
      tables.friendships = true;
    }

    if (teamRes.error) {
      tableErrors['team_collaborators'] = teamRes.error.message;
      if (!errorMessage) {
        errorMessage = `Table 'team_collaborators': ${teamRes.error.message}`;
        errorCode = teamRes.error.code || 'PGRST_ERR';
        details = teamRes.error.details || teamRes.error.hint;
      }
    } else {
      tables.team_collaborators = true;
    }

    const dbOk = tables.users && tables.projects && tables.friendships && tables.team_collaborators;
    const isOverallOk = authOk && dbOk;
    const latencyMs = Math.round(performance.now() - start);

    cachedReport = {
      ok: isOverallOk,
      latencyMs,
      authOk,
      dbOk,
      tables,
      tableErrors,
      errorMessage: isOverallOk ? null : (errorMessage || 'Database table probe mismatch'),
      errorCode: isOverallOk ? null : (errorCode || 'SCHEMA_MISMATCH'),
      details,
      endpoint: SUPABASE_URL,
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    lastCheckTime = now;
    return cachedReport;
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    cachedReport = {
      ok: false,
      latencyMs,
      authOk: false,
      dbOk: false,
      tables,
      tableErrors,
      errorMessage: err?.message || 'Connection failure to Supabase Cloud',
      errorCode: 'FETCH_FAILURE',
      details: String(err),
      endpoint: SUPABASE_URL,
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    lastCheckTime = now;
    return cachedReport;
  }
}

export async function checkSupabaseConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const report = await checkSupabaseDetailedHealth();
  return {
    ok: report.ok,
    message: report.ok ? 'Connected to Supabase Cloud (Global Cluster)' : (report.errorMessage || 'Connection failed'),
    latencyMs: report.latencyMs,
  };
}

