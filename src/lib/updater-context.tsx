import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePersistent } from '@/hooks/use-persistent';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { isTauri } from '@/lib/tauri';
import { NeuralLoadingView } from '@/components/ui/neural-loading-view';

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

export interface UpdaterContextValue {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string;
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  startUpdate: () => Promise<void>;
  installAndRelaunch: () => Promise<void>;
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null);

export function UpdaterProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetworkStatus();
  const [autoCheck] = usePersistent<boolean>('cortex-auto-update-check', true);

  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);

  const updateRef = useRef<any>(null);

  const checkForUpdates = useCallback(async (manual = false) => {
    if (!isOnline) {
      setStatus('offline');
      return;
    }

    if (!isTauri()) {
      if (manual) setStatus('upToDate');
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
      console.error('[CortexUpdater] Check error:', err);
      if (!isOnline) {
        setStatus('offline');
      } else {
        const msg = typeof err === 'string' ? err : err?.message || String(err);
        setErrorMessage(msg);
        setStatus('error');
      }
    }
  }, [isOnline]);

  const startUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update || !isTauri()) return;

    setShowOverlay(true);
    setStatus('downloading');
    setProgressPercent(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      let contentLength = 0;
      let receivedLength = 0;

      // Step 1: Download package with progress reporting
      await update.download((event: any) => {
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

      // Brief delay so the user sees the 100% complete state before the app exits to installer
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Step 2: On Windows, install exits the app and launches the small rectangular installer window!
      await update.install({ restartAfterInstall: true });
    } catch (err: any) {
      console.error('[CortexUpdater] Download/Install error:', err);
      const msg = typeof err === 'string' ? err : err?.message || String(err);
      setErrorMessage(msg);
      setStatus('error');
    }
  }, []);

  const installAndRelaunch = useCallback(async () => {
    const update = updateRef.current;
    if (!update || !isTauri()) return;

    try {
      await update.install({ restartAfterInstall: true });
    } catch (err: any) {
      console.error('[CortexUpdater] Install error:', err);
      // Fallback: try process relaunch
      try {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch {}
    }
  }, []);

  // Auto check on launch
  const hasCheckedRef = useRef(false);
  useEffect(() => {
    if (autoCheck && !hasCheckedRef.current && isOnline && isTauri()) {
      hasCheckedRef.current = true;
      const timer = setTimeout(() => {
        checkForUpdates(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [autoCheck, isOnline, checkForUpdates]);

  // Online / Offline listener
  useEffect(() => {
    if (!isOnline && (status === 'idle' || status === 'checking')) {
      setStatus('offline');
    }
    if (isOnline && status === 'offline') {
      setStatus('idle');
    }
  }, [isOnline, status]);

  return (
    <UpdaterContext.Provider
      value={{
        status,
        updateInfo,
        progressPercent,
        downloadedBytes,
        totalBytes,
        errorMessage,
        showOverlay,
        setShowOverlay,
        checkForUpdates,
        startUpdate,
        installAndRelaunch,
      }}
    >
      {children}

      {/* Global Neural Loading Overlay when downloading or downloaded */}
      {showOverlay && (status === 'downloading' || status === 'downloaded') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'hsl(var(--background))' }}>
          <NeuralLoadingView
            mode="downloading"
            progressPercent={progressPercent}
            downloadedBytes={downloadedBytes}
            totalBytes={totalBytes}
            isComplete={status === 'downloaded'}
            onRestart={installAndRelaunch}
          />
        </div>
      )}
    </UpdaterContext.Provider>
  );
}

export function useUpdater(): UpdaterContextValue {
  const ctx = useContext(UpdaterContext);
  if (!ctx) {
    throw new Error('useUpdater must be used within an UpdaterProvider');
  }
  return ctx;
}
