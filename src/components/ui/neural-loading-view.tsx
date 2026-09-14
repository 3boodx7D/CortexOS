import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { WindowControls } from '@/components/window-controls';
import { WifiOff, RefreshCw, RotateCw, Download, CheckCircle2, Loader2 } from 'lucide-react';
import type { MotionMode } from '@/pages/settings';

export type NeuralViewMode = 'checking' | 'downloading' | 'offline';

interface NeuralLoadingViewProps {
  mode: NeuralViewMode;
  /** 0–100 download progress */
  progressPercent?: number;
  /** Downloaded bytes so far */
  downloadedBytes?: number;
  /** Total download size in bytes */
  totalBytes?: number;
  /** Whether the download is complete (shows restart button) */
  isComplete?: boolean;
  /** Retry connection callback */
  onRetry?: () => void;
  /** Restart & apply update callback */
  onRestart?: () => void;
  /** Continue to local mode callback (offline) */
  onContinueLocal?: () => void;
  /** Whether a retry/check is in progress */
  isRetrying?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * NeuralLoadingView — Shared neural loading interface
 * Built 100% on the visual architecture of .auth-gate-loading
 * (pulsing logo, glow orbs, auth-titlebar, etc.)
 *
 * Supports 3 modes:
 *  - checking: Spinner + "Checking update servers..."
 *  - downloading: Neon progress bar + percentage + size
 *  - offline: Calm offline badge + retry button
 */
export function NeuralLoadingView({
  mode,
  progressPercent = 0,
  downloadedBytes = 0,
  totalBytes = 0,
  isComplete = false,
  onRetry,
  onRestart,
  onContinueLocal,
  isRetrying = false,
}: NeuralLoadingViewProps) {
  const { t } = useTranslation();
  const [motion] = usePersistent<MotionMode>('cortex-motion', 'cinematic');
  const isCinematic = motion === 'cinematic';

  return (
    <div className="neural-loading-view">
      {/* Titlebar with drag region & window controls */}
      <header className="auth-titlebar" data-tauri-drag-region>
        <div className="auth-titlebar-brand">
          <img src="/logo.png" alt="CortexOS" />
          <span>CORTEXOS</span>
        </div>
        <WindowControls />
      </header>

      {/* Atmospheric glow backdrop */}
      <div className="auth-glow-backdrop" aria-hidden="true">
        <div className="auth-glow-orb auth-glow-primary" />
      </div>

      {/* Pulsing logo */}
      <div className={`auth-logo-pulse ${isCinematic ? '' : 'no-pulse'}`}>
        <img src="/logo.png" alt="CortexOS" className="auth-logo-pulse-img" />
      </div>

      {/* Brand name */}
      <span className="mono font-bold tracking-widest text-lg">
        CORTEX<span className="text-[hsl(var(--primary))]">OS</span>
      </span>

      {/* === MODE: Checking === */}
      {mode === 'checking' && (
        <div className="neural-status-area">
          <Loader2
            size={20}
            className="neural-spinner text-[hsl(var(--primary))]"
          />
          <small className="text-muted-foreground text-xs tracking-wider">
            {t('updater.checkingServers')}
          </small>
        </div>
      )}

      {/* === MODE: Downloading === */}
      {mode === 'downloading' && (
        <div className="neural-status-area neural-download-area">
          {!isComplete ? (
            <>
              {/* Progress bar */}
              <div className="neural-progress-track">
                <div
                  className="neural-progress-fill"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>

              {/* Stats */}
              <div className="neural-progress-stats">
                <span className="mono text-xs font-semibold text-[hsl(var(--primary))]">
                  {progressPercent}%
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
                </span>
              </div>

              <small className="text-muted-foreground text-xs tracking-wider">
                {t('updater.downloadingPackage')}
              </small>
            </>
          ) : (
            <>
              {/* Completed state */}
              <div className="neural-complete-badge">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">
                  {t('updater.downloadComplete')}
                </span>
              </div>

              <button
                className="btn-accent neural-restart-btn"
                onClick={onRestart}
                data-tauri-drag-region="false"
              >
                <RotateCw size={15} />
                {t('updater.restartBtn')}
              </button>
            </>
          )}
        </div>
      )}

      {/* === MODE: Offline === */}
      {mode === 'offline' && (
        <div className="neural-status-area neural-offline-area">
          <div className="neural-offline-badge">
            <WifiOff size={16} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              {t('updater.offlineBadge')}
            </span>
          </div>

          <p className="text-muted-foreground text-xs text-center leading-relaxed" style={{ maxWidth: 320 }}>
            {t('updater.offlineLocalMsg')}
          </p>

          <div className="neural-offline-actions">
            <button
              className="btn-accent neural-retry-btn"
              onClick={onRetry}
              disabled={isRetrying}
              data-tauri-drag-region="false"
            >
              {isRetrying ? <Loader2 size={14} className="neural-spinner" /> : <RefreshCw size={14} />}
              {t('updater.retry')}
            </button>

            {onContinueLocal && (
              <button
                className="btn-outline neural-continue-btn"
                onClick={onContinueLocal}
                data-tauri-drag-region="false"
              >
                {t('updater.continueLocal')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
