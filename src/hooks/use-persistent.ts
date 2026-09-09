import { useEffect, useState, useCallback } from 'react';

export function usePersistent<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initial;
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return initial;
      try {
        return JSON.parse(saved) as T;
      } catch {
        // Fallback for raw strings stored without JSON.stringify (like file paths "D:\dev26-27")
        if (typeof initial === 'string') {
          return saved as unknown as T;
        }
        return initial;
      }
    } catch {
      return initial;
    }
  }, [key, initial]);

  const [value, setValue] = useState<T>(readValue);

  useEffect(() => {
    // Keep in sync with other components and tabs
    const handleStorage = (e: StorageEvent | CustomEvent<{ key: string; value: any }>) => {
      if ('key' in e && e.key === key) {
        setValue(readValue());
      } else if ('detail' in e && e.detail?.key === key) {
        setValue(readValue());
      }
    };

    window.addEventListener('storage', handleStorage as EventListener);
    window.addEventListener('cortex-storage-change', handleStorage as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage as EventListener);
      window.removeEventListener('cortex-storage-change', handleStorage as EventListener);
    };
  }, [key, readValue]);

  const update = (next: T | ((current: T) => T)) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next;
      try {
        const serialized = typeof resolved === 'string' ? JSON.stringify(resolved) : JSON.stringify(resolved);
        localStorage.setItem(key, serialized);
        // Dispatch across current window components
        window.dispatchEvent(new CustomEvent('cortex-storage-change', { detail: { key, value: resolved } }));
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: serialized }));
      } catch (e) {
        console.error('usePersistent save error:', e);
      }
      return resolved;
    });
  };

  return [value, update];
}
