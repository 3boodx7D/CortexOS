import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, onAuthStateChange, getSession } from './supabase';

export type UserStatus = 'online' | 'coding' | 'in_flow' | 'away' | 'offline';

interface UserStoreContextType {
  user: User | null;
  session: Session | null;
  userId: string;
  email: string;
  displayName: string;
  username: string;
  role: string;
  bio: string;
  avatarChar: string;
  avatarUrl: string;
  currentStatus: UserStatus;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'saved_locally';
  lastSynced: string | null;
  isOwner: boolean;
  syncAllToCloud: () => Promise<boolean>;
  getScopedKey: (key: string) => string;
  updateDisplayName: (name: string) => Promise<boolean>;
  updateProfile: (updates: { displayName?: string; username?: string; role?: string; bio?: string; avatarUrl?: string }) => Promise<boolean>;
  setCurrentStatus: (status: UserStatus) => Promise<void>;
  syncStudyData: (data: { sessions?: any[]; lecture?: string; summary?: string }) => Promise<boolean>;
  loadStudyData: () => Promise<void>;
}

const UserStoreContext = createContext<UserStoreContextType | null>(null);

// In-memory 60-second TTL cache for profile reads to prevent Supabase request quota burn
interface CachedProfile {
  data: {
    display_name: string;
    username: string;
    role: string;
    bio: string;
    avatar_url: string;
    current_status: UserStatus;
  };
  timestamp: number;
}
const profileMemoryCache = new Map<string, CachedProfile>();
const CACHE_TTL_MS = 60_000;

export function UserStoreProvider({
  children,
  session: initialSession,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'saved_locally'>('synced');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus>('online');

  useEffect(() => {
    if (initialSession) setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user || null;
  const userId = user?.id || 'guest';
  const email = user?.email || 'user@cortex.os';

  const [customName, setCustomName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`cortex_custom_name_${userId}`) || '';
  });
  const [customUsername, setCustomUsername] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`cortex_custom_username_${userId}`) || '';
  });
  const [customRole, setCustomRole] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`cortex_custom_role_${userId}`) || '';
  });
  const [customBio, setCustomBio] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`cortex_custom_bio_${userId}`) || '';
  });
  const [customAvatar, setCustomAvatar] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`cortex_custom_avatar_${userId}`) || '';
  });

  // Fetch real user profile from Supabase public.users table with 60s TTL cache
  const fetchUserProfile = useCallback(async (uid: string, force = false) => {
    if (!uid || uid === 'guest') return;

    const cached = profileMemoryCache.get(uid);
    if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      if (cached.data.display_name) setCustomName(cached.data.display_name);
      if (cached.data.username) setCustomUsername(cached.data.username);
      if (cached.data.role) setCustomRole(cached.data.role);
      if (cached.data.bio) setCustomBio(cached.data.bio);
      if (cached.data.avatar_url) setCustomAvatar(cached.data.avatar_url);
      if (cached.data.current_status) setUserStatus(cached.data.current_status);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name, role, avatar_url, bio, current_status, settings')
        .eq('id', uid)
        .maybeSingle();

      if (data && !error) {
        const fetchedRole =
          (data.settings as any)?.custom_role ||
          (user?.user_metadata?.role as string) ||
          (user?.user_metadata?.title as string) ||
          data.role ||
          'developer';

        const fetchedUsername =
          (data.settings as any)?.username ||
          (data as any).username ||
          (user?.user_metadata?.username as string) ||
          '';

        setCustomName(data.display_name || '');
        setCustomRole(fetchedRole);
        setCustomBio(data.bio || '');
        setCustomAvatar(data.avatar_url || '/default-avatar.jpg');
        const st = (data.current_status || 'online') as UserStatus;
        setUserStatus(st);
        if (fetchedUsername) setCustomUsername(fetchedUsername);

        profileMemoryCache.set(uid, {
          data: {
            display_name: data.display_name || '',
            username: fetchedUsername,
            role: fetchedRole,
            bio: data.bio || '',
            avatar_url: data.avatar_url || '',
            current_status: st,
          },
          timestamp: Date.now(),
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem(`cortex_custom_name_${uid}`, data.display_name || '');
          if (fetchedUsername) localStorage.setItem(`cortex_custom_username_${uid}`, fetchedUsername);
          localStorage.setItem(`cortex_custom_role_${uid}`, fetchedRole || '');
          localStorage.setItem(`cortex_custom_bio_${uid}`, data.bio || '');
          localStorage.setItem(`cortex_custom_avatar_${uid}`, data.avatar_url || '/default-avatar.jpg');
        }
      } else if (!data) {
        // Auto-provision user in public.users if not already present
        const initialName = user?.user_metadata?.name || user?.user_metadata?.display_name || email.split('@')[0] || 'Operator';
        const initialUsername = user?.user_metadata?.username || email.split('@')[0] || 'user';
        const initialRole = user?.user_metadata?.role || 'developer';
        const initialBio = user?.user_metadata?.bio || 'CortexOS Developer';
        const initialAvatar = user?.user_metadata?.avatarUrl || '';

        await supabase.from('users').upsert({
          id: uid,
          email: email,
          display_name: initialName,
          role: initialRole,
          bio: initialBio,
          avatar_url: initialAvatar,
          current_status: 'online',
          settings: { username: initialUsername },
          updated_at: new Date().toISOString(),
        });

        profileMemoryCache.set(uid, {
          data: {
            display_name: initialName,
            username: initialUsername,
            role: initialRole,
            bio: initialBio,
            avatar_url: initialAvatar,
            current_status: 'online',
          },
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      console.warn('Could not fetch user profile from Supabase:', e);
    }
  }, [user, email]);

  // Subscribe to real-time changes on public.users for this specific user
  useEffect(() => {
    if (!userId || userId === 'guest') return;

    fetchUserProfile(userId);

    // Mark online in Supabase
    supabase
      .from('users')
      .update({ current_status: 'online', updated_at: new Date().toISOString() })
      .eq('id', userId)
      .then();

    const channel = supabase
      .channel(`cortex-user-profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row) {
            const incomingUsername = row.settings?.username || (row as any).username;
            const incomingRole = row.settings?.custom_role || (user?.user_metadata?.role as string) || row.role;
            if (incomingUsername) setCustomUsername(incomingUsername);
            if (row.display_name !== undefined) setCustomName(row.display_name);
            if (incomingRole !== undefined) setCustomRole(incomingRole);
            if (row.bio !== undefined) setCustomBio(row.bio);
            if (row.avatar_url !== undefined) setCustomAvatar(row.avatar_url || '/default-avatar.jpg');
            if (row.current_status !== undefined) setUserStatus(row.current_status);

            profileMemoryCache.set(userId, {
              data: {
                display_name: row.display_name || '',
                username: incomingUsername || '',
                role: incomingRole || 'developer',
                bio: row.bio || '',
                avatar_url: row.avatar_url || '/default-avatar.jpg',
                current_status: row.current_status || 'online',
              },
              timestamp: Date.now(),
            });

            if (typeof window !== 'undefined') {
              if (row.display_name) localStorage.setItem(`cortex_custom_name_${userId}`, row.display_name);
              if (incomingUsername) localStorage.setItem(`cortex_custom_username_${userId}`, incomingUsername);
              if (incomingRole) localStorage.setItem(`cortex_custom_role_${userId}`, incomingRole);
              if (row.bio) localStorage.setItem(`cortex_custom_bio_${userId}`, row.bio);
              if (row.avatar_url) localStorage.setItem(`cortex_custom_avatar_${userId}`, row.avatar_url);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUserProfile, user]);

  // Load local preferences as soon as userId is resolved
  useEffect(() => {
    if (!userId || userId === 'guest') return;
    if (typeof window !== 'undefined') {
      const localName = localStorage.getItem(`cortex_custom_name_${userId}`);
      if (localName) setCustomName(localName);
      const localUser = localStorage.getItem(`cortex_custom_username_${userId}`);
      if (localUser) setCustomUsername(localUser);
      const localRole = localStorage.getItem(`cortex_custom_role_${userId}`);
      if (localRole) setCustomRole(localRole);
      const localBio = localStorage.getItem(`cortex_custom_bio_${userId}`);
      if (localBio) setCustomBio(localBio);
      const localAvatar = localStorage.getItem(`cortex_custom_avatar_${userId}`);
      if (localAvatar) setCustomAvatar(localAvatar);
    }
  }, [userId]);

  const displayName = customName || (user?.user_metadata?.name as string) || (user?.user_metadata?.display_name as string) || email.split('@')[0] || 'Operator';
  const username = customUsername || (user?.user_metadata?.username as string) || (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const isOwner = (email || '').toLowerCase().trim() === 'cabdulrahman36@gmail.com';
  const role = customRole || (isOwner ? 'founder' : ((user?.user_metadata?.role as string) || 'developer'));
  const bio = customBio || (user?.user_metadata?.bio as string) || (isOwner ? 'CortexOS Founder & System Architect' : 'Local workspace & neural executive');
  const avatarChar = displayName.charAt(0).toUpperCase() || 'U';
  const avatarUrl = customAvatar || (user?.user_metadata?.avatarUrl as string) || '/default-avatar.jpg';

  const updateProfile = useCallback(async (updates: { displayName?: string; username?: string; role?: string; bio?: string; avatarUrl?: string }): Promise<boolean> => {
    const nextMeta: Record<string, any> = {};
    const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updates.displayName !== undefined) {
      setCustomName(updates.displayName);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_name_${userId}`, updates.displayName);
      }
      nextMeta.name = updates.displayName;
      nextMeta.display_name = updates.displayName;
      dbUpdates.display_name = updates.displayName;
    }

    let effectiveUsername = username;
    if (updates.username !== undefined) {
      const cleanUsername = updates.username.replace(/^@/, '').toLowerCase().trim();
      effectiveUsername = cleanUsername;
      setCustomUsername(cleanUsername);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_username_${userId}`, cleanUsername);
      }
      nextMeta.username = cleanUsername;
      // Note: username is persisted in dbUpdates.settings below as public.users stores it in JSONB settings
    }

    let effectiveRole = role;
    if (updates.role !== undefined) {
      effectiveRole = updates.role;
      setCustomRole(updates.role);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_role_${userId}`, updates.role);
      }
      nextMeta.role = updates.role;
      nextMeta.custom_role = updates.role;
      // In public.users, CHECK (role IN ('admin', 'developer', 'viewer', 'founder'))
      const lowerRole = updates.role.toLowerCase().trim();
      if (['admin', 'developer', 'viewer', 'founder'].includes(lowerRole)) {
        dbUpdates.role = lowerRole;
      } else {
        dbUpdates.role = isOwner ? 'founder' : 'developer';
      }
    }

    // Always merge settings JSONB
    dbUpdates.settings = {
      username: effectiveUsername,
      custom_role: effectiveRole,
    };

    if (updates.bio !== undefined) {
      setCustomBio(updates.bio);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_bio_${userId}`, updates.bio);
      }
      nextMeta.bio = updates.bio;
      dbUpdates.bio = updates.bio;
    }

    if (updates.avatarUrl !== undefined) {
      setCustomAvatar(updates.avatarUrl);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_avatar_${userId}`, updates.avatarUrl);
      }
      nextMeta.avatarUrl = updates.avatarUrl;
      dbUpdates.avatar_url = updates.avatarUrl;
    }

    try {
      if (user && userId !== 'guest') {
        // 1. Update public.users database table
        const { error: updateErr } = await supabase.from('users').update(dbUpdates).eq('id', userId);
        if (updateErr) {
          console.warn('First attempt at updating users failed, retrying with core safe fields:', updateErr.message);
          const safeFallback: Record<string, any> = {
            updated_at: new Date().toISOString(),
            settings: dbUpdates.settings,
          };
          if (dbUpdates.display_name !== undefined) safeFallback.display_name = dbUpdates.display_name;
          if (dbUpdates.avatar_url !== undefined) safeFallback.avatar_url = dbUpdates.avatar_url;
          if (dbUpdates.bio !== undefined) safeFallback.bio = dbUpdates.bio;
          await supabase.from('users').update(safeFallback).eq('id', userId);
        }

        // 2. Invalidate and update local cache
        profileMemoryCache.set(userId, {
          data: {
            display_name: dbUpdates.display_name || customName || '',
            username: effectiveUsername,
            role: effectiveRole,
            bio: dbUpdates.bio || customBio || '',
            avatar_url: dbUpdates.avatar_url || customAvatar || '/default-avatar.jpg',
            current_status: userStatus || 'online',
          },
          timestamp: Date.now(),
        });

        // 3. Update Supabase Auth metadata
        await supabase.auth.updateUser({
          data: nextMeta,
        });
      }
      return true;
    } catch (e) {
      console.warn('Could not update user profile in Supabase:', e);
      return false;
    }
  }, [user, userId, isOwner]);

  const setCurrentStatus = useCallback(async (status: UserStatus) => {
    setUserStatus(status);
    if (!user || userId === 'guest') return;
    try {
      await supabase.from('users').update({ current_status: status, updated_at: new Date().toISOString() }).eq('id', userId);
    } catch (e) {
      console.warn('Failed to update status:', e);
    }
  }, [user, userId]);

  const updateDisplayName = useCallback(async (name: string): Promise<boolean> => {
    return updateProfile({ displayName: name });
  }, [updateProfile]);

  const getScopedKey = useCallback((key: string) => {
    return `cortex_u_${userId}_${key}`;
  }, [userId]);

  // Sync all user keys to Supabase cloud
  const syncAllToCloud = useCallback(async (): Promise<boolean> => {
    if (!user || userId === 'guest') return false;
    setSyncStatus('syncing');

    try {
      // Gather all scoped keys belonging to this user
      const userPrefix = `cortex_u_${userId}_`;
      const currentName = (typeof window !== 'undefined' ? localStorage.getItem(`cortex_custom_name_${userId}`) : null) || displayName;
      const currentRole = (typeof window !== 'undefined' ? localStorage.getItem(`cortex_custom_role_${userId}`) : null) || role;
      const currentBio = (typeof window !== 'undefined' ? localStorage.getItem(`cortex_custom_bio_${userId}`) : null) || bio;
      const currentAvatar = (typeof window !== 'undefined' ? localStorage.getItem(`cortex_custom_avatar_${userId}`) : null) || avatarUrl;

      const store: Record<string, any> = {
        profile: {
          name: currentName,
          role: currentRole,
          bio: currentBio,
          avatarUrl: currentAvatar,
        }
      };

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(userPrefix)) {
          const rawKey = k.slice(userPrefix.length);
          try {
            store[rawKey] = JSON.parse(localStorage.getItem(k) || '');
          } catch {
            store[rawKey] = localStorage.getItem(k);
          }
        }
      }

      // Sync clean project metadata to cloud (no local paths or disk cache)
      const rawProjects = localStorage.getItem('cortex-vault-projects');
      if (rawProjects) {
        try {
          const list = JSON.parse(rawProjects);
          if (Array.isArray(list)) {
            store['cortex_cloud_projects'] = list.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              status: p.status,
              stack: p.stack,
              progress: p.progress,
              updated: p.updated,
              ai_summary: p.ai_summary || null
            }));
          }
        } catch {}
      }

      // Strategy 1: Save directly to public.users settings JSONB column
      try {
        await supabase
          .from('users')
          .update({
            settings: store,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      } catch (dbErr) {
        console.warn('Could not update users.settings in Supabase:', dbErr);
      }

      // Strategy 2: Save in Supabase Auth user_metadata
      await supabase.auth.updateUser({
        data: {
          name: currentName,
          role: currentRole,
          bio: currentBio,
          avatarUrl: currentAvatar,
          cortex_store: store,
        },
      });

      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (err) {
      console.warn('Cloud sync offline or postponed:', err);
      setSyncStatus('saved_locally');
      return false;
    }
  }, [user, userId, displayName, role, bio, avatarUrl]);

  // Hydrate from Supabase cloud on login
  useEffect(() => {
    if (!user || userId === 'guest') return;

    async function hydrate() {
      try {
        let cloudStore: Record<string, any> | null = null;

        // Try public.users settings column first
        try {
          const { data, error } = await supabase
            .from('users')
            .select('settings')
            .eq('id', userId)
            .maybeSingle();
          if (!error && data?.settings && typeof data.settings === 'object') {
            cloudStore = data.settings;
          }
        } catch {}

        // Fallback to user_metadata
        if (!cloudStore && user?.user_metadata?.cortex_store) {
          cloudStore = user.user_metadata.cortex_store as Record<string, any>;
        }

        // Hydrate profile from user_metadata or cloudStore
        if (user?.user_metadata?.name && !localStorage.getItem(`cortex_custom_name_${userId}`)) {
          setCustomName(user.user_metadata.name);
          localStorage.setItem(`cortex_custom_name_${userId}`, user.user_metadata.name);
        }
        if (user?.user_metadata?.role && !localStorage.getItem(`cortex_custom_role_${userId}`)) {
          setCustomRole(user.user_metadata.role);
          localStorage.setItem(`cortex_custom_role_${userId}`, user.user_metadata.role);
        }
        if (user?.user_metadata?.bio && !localStorage.getItem(`cortex_custom_bio_${userId}`)) {
          setCustomBio(user.user_metadata.bio);
          localStorage.setItem(`cortex_custom_bio_${userId}`, user.user_metadata.bio);
        }
        if (user?.user_metadata?.avatarUrl && !localStorage.getItem(`cortex_custom_avatar_${userId}`)) {
          setCustomAvatar(user.user_metadata.avatarUrl);
          localStorage.setItem(`cortex_custom_avatar_${userId}`, user.user_metadata.avatarUrl);
        }

        if (cloudStore && typeof cloudStore === 'object') {
          const userPrefix = `cortex_u_${userId}_`;
          let anyUpdated = false;

          for (const [key, val] of Object.entries(cloudStore)) {
            if (key === 'profile' || key === 'cortex_cloud_projects') continue;
            const storageKey = userPrefix + key;
            localStorage.setItem(storageKey, typeof val === 'string' ? val : JSON.stringify(val));
            anyUpdated = true;
          }

          if (anyUpdated) {
            window.dispatchEvent(new Event('storage'));
          }
        }
      } catch (e) {
        console.warn('Hydration skipped:', e);
      }
    }

    hydrate();
  }, [userId, user]);

  // Study Hub data sync functions
  const syncStudyData = useCallback(async (data: { sessions?: any[]; lecture?: string; summary?: string }): Promise<boolean> => {
    if (!user || userId === 'guest') return false;
    try {
      const userPrefix = `cortex_u_${userId}_`;
      const updates: Record<string, any> = {};
      
      if (data.sessions) {
        localStorage.setItem(userPrefix + 'study-sessions', JSON.stringify(data.sessions));
        updates['study-sessions'] = data.sessions;
      }
      if (data.lecture) {
        localStorage.setItem(userPrefix + 'study-lecture', data.lecture);
        updates['study-lecture'] = data.lecture;
      }
      if (data.summary) {
        localStorage.setItem(userPrefix + 'study-summary', data.summary);
        updates['study-summary'] = data.summary;
      }

      // Also sync to cloud via the main sync function
      await syncAllToCloud();
      return true;
    } catch (e) {
      console.warn('Study data sync failed:', e);
      return false;
    }
  }, [user, userId, syncAllToCloud]);

  const loadStudyData = useCallback(async (): Promise<void> => {
    if (!user || userId === 'guest') return;
    try {
      const userPrefix = `cortex_u_${userId}_`;
      // The data is already loaded via useUserPersistent, but we can trigger a refresh
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('Study data load failed:', e);
    }
  }, [user, userId]);

  return (
    <UserStoreContext.Provider
      value={{
        user,
        session,
        userId,
        email,
        displayName,
        username,
        role,
        bio,
        avatarChar,
        avatarUrl,
        syncStatus,
        lastSynced,
        isOwner,
        syncAllToCloud,
        getScopedKey,
        updateDisplayName,
        updateProfile,
        currentStatus: userStatus,
        setCurrentStatus,
        syncStudyData,
        loadStudyData,
      }}
    >
      {children}
    </UserStoreContext.Provider>
  );
}

export function useUserContext() {
  const ctx = useContext(UserStoreContext);
  if (!ctx) {
    throw new Error('useUserContext must be used within UserStoreProvider');
  }
  return ctx;
}

/**
 * Scoped persistent state hook that isolates data per Supabase User ID.
 * Each user on the same computer has their own independent data.
 */
export function useUserPersistent<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const { userId, syncAllToCloud } = useUserContext();
  const scopedKey = `cortex_u_${userId}_${key}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const saved = localStorage.getItem(scopedKey);
      if (saved !== null) {
        return JSON.parse(saved) as T;
      }
      return initial;
    } catch {
      return initial;
    }
  });

  // Re-sync when userId changes (switching accounts)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(scopedKey);
      if (saved !== null) {
        setValue(JSON.parse(saved) as T);
      } else {
        setValue(initial);
      }
    } catch {
      setValue(initial);
    }
  }, [scopedKey]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === scopedKey && e.newValue !== null) {
        try {
          setValue(JSON.parse(e.newValue) as T);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [scopedKey]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next;
        try {
          localStorage.setItem(scopedKey, JSON.stringify(resolved));
          if (typeof window !== 'undefined') {
            const timer = (window as any)[`__cortex_sync_${key}`];
            if (timer) clearTimeout(timer);
            (window as any)[`__cortex_sync_${key}`] = setTimeout(() => {
              syncAllToCloud();
            }, 1500);
          }
        } catch (e) {
          console.error('Error saving user data', e);
        }
        return resolved;
      });
    },
    [scopedKey, key, syncAllToCloud]
  );

  return [value, update];
}
