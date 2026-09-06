import { useEffect, useState } from 'react';

export function usePersistent<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setValue(JSON.parse(e.newValue) as T);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  const update = (next: T | ((current: T) => T)) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(resolved) }));
      } catch (e) {
        console.error(e);
      }
      return resolved;
    });
  };

  return [value, update];
}
