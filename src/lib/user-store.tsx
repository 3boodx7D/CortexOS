import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, onAuthStateChange, getSession } from './supabase';

interface UserStoreContextType {
  user: User | null;
  session: Session | null;
  userId: string;
  email: string;
  displayName: string;
  role: string;
  bio: string;
  avatarChar: string;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'saved_locally';
  lastSynced: string | null;
  syncAllToCloud: () => Promise<boolean>;
  getScopedKey: (key: string) => string;
  updateDisplayName: (name: string) => Promise<boolean>;
  updateProfile: (updates: { displayName?: string; role?: string; bio?: string }) => Promise<boolean>;
}

const UserStoreContext = createContext<UserStoreContextType | null>(null);

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
  const [customRole, setCustomRole] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`cortex_custom_role_${userId}`) || '';
  });
  const [customBio, setCustomBio] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`cortex_custom_bio_${userId}`) || '';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem(`cortex_custom_name_${userId}`);
      if (storedName) setCustomName(storedName);
      else if (user?.user_metadata?.name) setCustomName(user.user_metadata.name);

      const storedRole = localStorage.getItem(`cortex_custom_role_${userId}`);
      if (storedRole) setCustomRole(storedRole);
      else if (user?.user_metadata?.role) setCustomRole(user.user_metadata.role);

      const storedBio = localStorage.getItem(`cortex_custom_bio_${userId}`);
      if (storedBio) setCustomBio(storedBio);
      else if (user?.user_metadata?.bio) setCustomBio(user.user_metadata.bio);
    }
  }, [userId, user]);

  const displayName = customName || (user?.user_metadata?.name as string) || email.split('@')[0] || 'Operator';
  const role = customRole || (user?.user_metadata?.role as string) || 'Lead Engineer';
  const bio = customBio || (user?.user_metadata?.bio as string) || 'Local workspace & neural executive';
  const avatarChar = displayName.charAt(0).toUpperCase() || 'U';

  const updateProfile = useCallback(async (updates: { displayName?: string; role?: string; bio?: string }): Promise<boolean> => {
    const nextMeta: Record<string, any> = {};

    if (updates.displayName !== undefined) {
      setCustomName(updates.displayName);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_name_${userId}`, updates.displayName);
      }
      nextMeta.name = updates.displayName;
    }

    if (updates.role !== undefined) {
      setCustomRole(updates.role);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_role_${userId}`, updates.role);
      }
      nextMeta.role = updates.role;
    }

    if (updates.bio !== undefined) {
      setCustomBio(updates.bio);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cortex_custom_bio_${userId}`, updates.bio);
      }
      nextMeta.bio = updates.bio;
    }

    try {
      if (user && userId !== 'guest') {
        await supabase.auth.updateUser({
          data: nextMeta,
        });
      }
      return true;
    } catch (e) {
      console.warn('Could not update remote user profile:', e);
      return false;
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
      // Gather all keys belonging to this user
      const userPrefix = `cortex_u_${userId}_`;
      const store: Record<string, any> = {};

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

      // Strategy 1: Attempt PostgreSQL user_cortex_data table
      let tableSuccess = false;
      try {
        const { error } = await supabase
          .from('user_cortex_data')
          .upsert({
            user_id: userId,
            data: store,
            updated_at: new Date().toISOString(),
          });
        if (!error) tableSuccess = true;
      } catch {
        tableSuccess = false;
      }

      // Strategy 2: If table not found or failed, save in Supabase Auth user_metadata
      if (!tableSuccess) {
        await supabase.auth.updateUser({
          data: { cortex_store: store },
        });
      }

      setSyncStatus('synced');
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (err) {
      console.warn('Cloud sync offline or postponed:', err);
      setSyncStatus('saved_locally');
      return false;
    }
  }, [user, userId]);

  // Hydrate from Supabase cloud on login if local cache is fresh
  useEffect(() => {
    if (!user || userId === 'guest') return;

    async function hydrate() {
      try {
        let cloudStore: Record<string, any> | null = null;

        // Try table first
        try {
          const { data, error } = await supabase
            .from('user_cortex_data')
            .select('data')
            .eq('user_id', userId)
            .single();
          if (!error && data?.data) {
            cloudStore = data.data;
          }
        } catch {}

        // Fallback to user_metadata
        if (!cloudStore && user?.user_metadata?.cortex_store) {
          cloudStore = user.user_metadata.cortex_store as Record<string, any>;
        }

        if (cloudStore && typeof cloudStore === 'object') {
          const userPrefix = `cortex_u_${userId}_`;
          let anyUpdated = false;

          for (const [key, val] of Object.entries(cloudStore)) {
            const storageKey = userPrefix + key;
            if (localStorage.getItem(storageKey) === null) {
              localStorage.setItem(storageKey, JSON.stringify(val));
              anyUpdated = true;
            }
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

  return (
    <UserStoreContext.Provider
      value={{
        user,
        session,
        userId,
        email,
        displayName,
        role,
        bio,
        avatarChar,
        syncStatus,
        lastSynced,
        syncAllToCloud,
        getScopedKey,
        updateDisplayName,
        updateProfile,
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
