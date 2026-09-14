import { useState, useEffect, useCallback, useRef } from 'react';
import { usePersistent } from '@/hooks/use-persistent';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { isTauri } from '@/lib/tauri';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'upToDate'
  | 'offline'
  | 'error';

export interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export interface UpdaterState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  relaunchApp: () => Promise<void>;
}

/**
 * useUpdater — Full update lifecycle hook for Tauri v2.
 * Gracefully degrades in browser/web mode.
 * Respects network status to avoid console errors when offline.
 */
export function useUpdater(): UpdaterState {
  const { isOnline } = useNetworkStatus();
  const [autoCheck] = usePersistent<boolean>('cortex-auto-update-check', true);

  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Keep a ref to the resolved update object from Tauri so we can call download on it
  const updateRef = useRef<any>(null);

  const checkForUpdates = useCallback(async (manual = false) => {
    // If offline, show offline state — no console errors
    if (!isOnline) {
      setStatus('offline');
      return;
    }

    // Web/browser mode — no native updater available
    if (!isTauri()) {
      if (manual) {
        setStatus('upToDate');
      }
      return;
    }

    setStatus('checking');
    setErrorMessage('');

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        updateRef.current = update;
        setUpdateInfo({
          version: update.version || '',
          date: update.date || '',
          body: update.body || '',
        });
        setStatus('available');
      } else {
        updateRef.current = null;
        setUpdateInfo(null);
        setStatus('upToDate');
      }
    } catch (err: any) {
      // Only set error if it's a genuine failure, not a network/offline issue
      if (!isOnline) {
        setStatus('offline');
      } else {
        setErrorMessage(err?.message || 'Update check failed');
        setStatus('error');
      }
    }
  }, [isOnline]);

  const downloadAndInstall = useCallback(async () => {
    const update = updateRef.current;
    if (!update || !isTauri()) return;

    setStatus('downloading');
    setProgressPercent(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      let contentLength = 0;
      let receivedLength = 0;

      await update.downloadAndInstall((event: any) => {
        if (event.event === 'Started') {
          contentLength = event.data?.contentLength || 0;
          setTotalBytes(contentLength);
        } else if (event.event === 'Progress') {
          const chunkLen = event.data?.chunkLength || 0;
          receivedLength += chunkLen;
          setDownloadedBytes(receivedLength);
          if (contentLength > 0) {
            setProgressPercent(Math.min(100, Math.round((receivedLength / contentLength) * 100)));
          }
        } else if (event.event === 'Finished') {
          setProgressPercent(100);
          setDownloadedBytes(contentLength);
        }
      });

      setStatus('downloaded');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Download failed');
      setStatus('error');
    }
  }, []);

  const relaunchApp = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      // Silent — the app is restarting
    }
  }, []);

  // Auto-check on startup if enabled
  const hasCheckedRef = useRef(false);
  useEffect(() => {
    if (autoCheck && !hasCheckedRef.current && isOnline && isTauri()) {
      hasCheckedRef.current = true;
      // Small delay to let the app settle
      const timer = setTimeout(() => {
        checkForUpdates(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [autoCheck, isOnline, checkForUpdates]);

  // React to going offline
  useEffect(() => {
    if (!isOnline && (status === 'idle' || status === 'checking')) {
      setStatus('offline');
    }
    if (isOnline && status === 'offline') {
      setStatus('idle');
    }
  }, [isOnline, status]);

  return {
    status,
    updateInfo,
    progressPercent,
    downloadedBytes,
    totalBytes,
    errorMessage,
    checkForUpdates,
    downloadAndInstall,
    relaunchApp,
  };
}
