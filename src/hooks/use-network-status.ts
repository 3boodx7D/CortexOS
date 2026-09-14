import { useState, useEffect, useCallback } from 'react';

/**
 * useNetworkStatus — Monitor real-time network connectivity.
 * Uses `navigator.onLine` + online/offline events.
 * Provides a manual `checkConnection()` for retry flows.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      // Quick HEAD request to verify actual connectivity beyond navigator.onLine
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch('https://github.com/3boodx7D/CortexOS/releases', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOnline(true);
    } catch {
      setIsOnline(navigator.onLine);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { isOnline, isChecking, checkConnection };
}
