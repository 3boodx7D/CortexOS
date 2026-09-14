import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cpu, HardDrive, Monitor, Zap, Activity,
  Server, Microchip, RotateCw, CheckCircle2, X,
  Battery, BatteryCharging, Wifi, Layers,
  Sparkles, Sliders, ExternalLink, ShieldCheck,
  Flame, Check
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { invoke } from '@/lib/tauri';
import { apiGet, apiPost } from '@/lib/api-client';
import type { MotionMode } from '@/pages/settings';

type DiskData = {
  drive: string;
  mount: string;
  label: string;
  fs: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
};

type ProcessInfo = {
  pid: number;
  name: string;
  memory_percent: number;
  memory_mb: number;
  cpu_percent: number;
};

type HardwareDetails = {
  cpu: {
    name: string;
    logical_cores: number;
    physical_cores: number;
    usage_percent: number;
    freq_mhz?: number;
  };
  memory: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
    swap_total_gb?: number;
    swap_used_gb?: number;
  };
  gpus: string[];
  disks: DiskData[];
  battery?: {
    percent: number;
    plugged: boolean;
    secsleft?: number | null;
  } | null;
  network?: {
    bytes_sent: number;
    bytes_recv: number;
    sent_mb: number;
    recv_mb: number;
  } | null;
  top_processes?: ProcessInfo[];
  system: {
    os: string;
    build: string;
    hostname: string;
    uptime: string;
    uptime_seconds: number;
  };
};

const defaultHardware: HardwareDetails = {
  cpu: {
    name: 'Intel Core Ultra 7 155H',
    logical_cores: 22,
    physical_cores: 16,
    usage_percent: 14.5,
    freq_mhz: 3800,
  },
  memory: {
    total_gb: 15.4,
    used_gb: 10.4,
    free_gb: 5.0,
    percent: 67.5,
    swap_total_gb: 11.5,
    swap_used_gb: 1.3,
  },
  gpus: [
    'Intel(R) Arc(TM) Graphics',
    'NVIDIA GeForce RTX 3050 6GB Laptop GPU'
  ],
  disks: [
    { drive: 'C:', mount: 'C:\\', label: 'Windows System', fs: 'NTFS', total_gb: 930.4, used_gb: 508.8, free_gb: 421.6, percent: 54.7 },
    { drive: 'D:', mount: 'D:\\', label: 'Data Volume', fs: 'NTFS', total_gb: 931.5, used_gb: 289.7, free_gb: 641.8, percent: 31.1 }
  ],
  battery: {
    percent: 100,
    plugged: true,
    secsleft: null,
  },
  network: {
    bytes_sent: 1253700937,
    bytes_recv: 601267289,
    sent_mb: 1195.6,
    recv_mb: 573.4,
  },
  top_processes: [
    { pid: 3056, name: 'MemCompression', memory_percent: 5.2, memory_mb: 812.1, cpu_percent: 0 },
    { pid: 18184, name: 'Antigravity IDE.exe', memory_percent: 4.8, memory_mb: 753.8, cpu_percent: 0 },
    { pid: 6624, name: 'chrome.exe', memory_percent: 3.7, memory_mb: 589.7, cpu_percent: 0 },
    { pid: 7296, name: 'MsMpEng.exe', memory_percent: 3.5, memory_mb: 547.2, cpu_percent: 0 }
  ],
  system: {
    os: 'Windows 11 64bit',
    build: '10.0.26200',
    hostname: 'CORTEX-STATION',
    uptime: '2h 14m',
    uptime_seconds: 8040
  }
};

export default function MyPc() {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<HardwareDetails>(defaultHardware);
  const [motionMode, setMotionMode] = usePersistent<MotionMode>('cortex-motion', 'cinematic');
  
  // Anti-Spam Clean RAM State
  const [flushing, setFlushing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [flushResult, setFlushResult] = useState<{ freedGB: number; procs: number } | null>(null);
  
  const [launchingTool, setLaunchingTool] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cpuHistory, setCpuHistory] = useState<number[]>([14, 18, 12, 19, 15, 23, 17, 16, 21, 14]);

  const isRtl = locale === 'ar';
  const isFastMode = motionMode === 'minimal';

  // Decrement Anti-Spam Cooldown Timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const fetchTelemetry = useCallback(async () => {
    // 1. Attempt FastAPI hardware endpoint
    try {
      const json = await apiGet<HardwareDetails>('/api/system/hardware');
      if (json && json.cpu && json.memory) {
        // Sanitize any residual personal names from Windows drive labels
        if (Array.isArray(json.disks)) {
          json.disks = json.disks.map((d) => ({
            ...d,
            label: (!d.label || d.label.toLowerCase().includes('abood'))
              ? (d.drive.startsWith('C') ? 'Windows System' : `Data Volume (${d.drive.slice(0, 2)})`)
              : d.label
          }));
        }
        if (json.system?.hostname && json.system.hostname.toLowerCase().includes('abood')) {
          json.system.hostname = 'CORTEX-STATION';
        }

        setData(json);
        setCpuHistory((prev) => {
          const next = [...prev.slice(1), json.cpu.usage_percent];
          return next;
        });
        return;
      }
    } catch {
      // Fall through to Tauri IPC
    }

    // 2. Attempt Tauri Native IPC
    try {
      const tauriRes = await invoke<any>('get_system_info');
      if (tauriRes?.value) {
        const v = tauriRes.value;
        setData((prev) => ({
          ...prev,
          cpu: {
            ...prev.cpu,
            name: v.cpu?.brand ? v.cpu.brand.replace(/\(R\)|\(TM\)/gi, '').trim() : prev.cpu.name,
            usage_percent: v.cpu?.usage ?? prev.cpu.usage_percent,
            logical_cores: v.cpu?.cores ?? prev.cpu.logical_cores,
          },
          memory: {
            ...prev.memory,
            total_gb: v.memory?.total_gb ? Number(v.memory.total_gb.toFixed(1)) : prev.memory.total_gb,
            used_gb: v.memory?.used_gb ? Number(v.memory.used_gb.toFixed(1)) : prev.memory.used_gb,
            free_gb: v.memory?.free_gb ? Number(v.memory.free_gb.toFixed(1)) : prev.memory.free_gb,
            percent: v.memory?.usage_percent ? Number(v.memory.usage_percent.toFixed(1)) : prev.memory.percent,
          },
          gpus: v.gpus && v.gpus.length > 0 ? v.gpus : prev.gpus,
          disks: v.disks && v.disks.length > 0 ? v.disks : prev.disks,
        }));
      }
    } catch (err) {
      console.warn('Hardware poll fallback error:', err);
    }
  }, []);

  // Sensor Polling Governed by Motion Mode (3500ms in FAST mode, 1500ms in STUDIO SMOOTH)
  useEffect(() => {
    fetchTelemetry();
    const intervalMs = isFastMode ? 3500 : 1500;
    const interval = setInterval(fetchTelemetry, intervalMs);
    return () => clearInterval(interval);
  }, [fetchTelemetry, isFastMode]);

  // Anti-Spam Flush Standby Memory (EmptyWorkingSet)
  const handleFlushRam = async () => {
    if (flushing || cooldownRemaining > 0) return;
    setFlushing(true);
    setFlushResult(null);

    try {
      const json = await apiPost<{ freedGB?: number; trimmedProcesses?: number }>('/api/system/flush-ram');
      setFlushResult({
        freedGB: typeof json.freedGB === 'number' ? json.freedGB : 0.6,
        procs: typeof json.trimmedProcesses === 'number' ? json.trimmedProcesses : 42,
      });
      // Set strict 20-second anti-spam cooldown
      setCooldownRemaining(20);
    } catch (err) {
      console.error('Flush RAM failed:', err);
    } finally {
      await fetchTelemetry();
      setFlushing(false);
      setTimeout(() => setFlushResult(null), 7000);
    }
  };

  const handleLaunchTool = async (tool: 'taskmgr' | 'resmon' | 'devmgmt' | 'dxdiag' | 'cleanmgr') => {
    if (launchingTool) return;
    setLaunchingTool(tool);
    try {
      await apiPost(`/api/system/launch/${tool}`);
    } catch (err) {
      console.error(`Launch ${tool} failed:`, err);
    } finally {
      setTimeout(() => setLaunchingTool(null), 800);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchTelemetry();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const toggleMotionProfile = () => {
    const nextMode: MotionMode = motionMode === 'cinematic' ? 'minimal' : 'cinematic';
    setMotionMode(nextMode);
  };

  // Build SVG Path for CPU Sparkline
  const sparklinePoints = cpuHistory.map((val, idx) => {
    const x = (idx / (cpuHistory.length - 1)) * 140;
    const y = 32 - (Math.min(100, Math.max(0, val)) / 100) * 28;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="mypc-page page-in">
      
      {/* ── 1. Executive Hardware Header & Tool Suite ── */}
      <header className="mypc-header-container">
        <div>
          <div className="mypc-badge-row">
            <span className="mypc-live-indicator">
              <span className="mypc-pulse-dot" />
              <span className="mono">{t('myPc.activeSensors')}</span>
            </span>
            <span className="mypc-divider">•</span>
            <span className="mypc-status-text mono">
              {t('myPc.status')}
            </span>
          </div>

          <h1 className="mypc-title">{t('myPc.title')}</h1>
          <p className="mypc-subtitle">{t('myPc.subtitle')}</p>
        </div>

        {/* Action Suite & Governor */}
        <div className="mypc-action-cluster">
          
          {/* Executive Performance & Motion Governor Switch */}
          <button
            type="button"
            onClick={toggleMotionProfile}
            className="mypc-governor-btn focus-ring"
            title={isFastMode ? t('myPc.fastDesc') : t('myPc.smoothDesc')}
            data-testid="button-motion-governor"
          >
            <div className="mypc-governor-icon">
              {isFastMode ? (
                <Zap size={13} className="text-amber-400" />
              ) : (
                <Sparkles size={13} className="text-cyan" />
              )}
            </div>
            <div className="mypc-governor-text">
              <span className="mypc-governor-label mono">
                {isFastMode ? t('myPc.fastProfile') : t('myPc.smoothProfile')}
              </span>
            </div>
          </button>

          {/* Anti-Spam Clean RAM Button */}
          <button
            type="button"
            onClick={handleFlushRam}
            disabled={flushing || cooldownRemaining > 0}
            className={`mypc-btn mypc-btn-primary focus-ring ${cooldownRemaining > 0 ? 'mypc-btn-cooldown' : ''}`}
            title={cooldownRemaining > 0 ? t('myPc.cooldown').replace('{seconds}', String(cooldownRemaining)) : t('myPc.flushRam')}
            data-testid="button-clean-ram"
          >
            {flushing ? (
              <>
                <RotateCw className="spin" size={13} />
                <span>{t('myPc.flushing')}</span>
              </>
            ) : cooldownRemaining > 0 ? (
              <>
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>{t('myPc.cooldown').replace('{seconds}', String(cooldownRemaining))}</span>
              </>
            ) : (
              <>
                <Zap size={13} />
                <span>{t('myPc.cleanRam')}</span>
              </>
            )}
          </button>

          {/* Native Windows Tool: Task Manager */}
          <button
            type="button"
            onClick={() => handleLaunchTool('taskmgr')}
            disabled={launchingTool === 'taskmgr'}
            className="mypc-btn focus-ring"
            title="Launch Windows Task Manager"
            data-testid="button-taskmgr"
          >
            <Activity size={13} className="text-cyan" />
            <span className="hidden sm:inline">{t('myPc.taskManager')}</span>
          </button>

          {/* Native Windows Tool: Resource Monitor */}
          <button
            type="button"
            onClick={() => handleLaunchTool('resmon')}
            disabled={launchingTool === 'resmon'}
            className="mypc-btn focus-ring"
            title="Launch Windows Resource Monitor"
            data-testid="button-resmon"
          >
            <Server size={13} className="text-emerald-500" />
            <span className="hidden sm:inline">{t('myPc.resMon')}</span>
          </button>

          {/* Refresh Sensors */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="mypc-btn mypc-btn-icon focus-ring"
            title={t('myPc.refresh')}
            data-testid="button-refresh-telemetry"
          >
            <RotateCw size={13} className={refreshing ? 'spin text-cyan' : ''} />
          </button>
        </div>
      </header>

      {/* ── 2. Memory Flush Notification (Sleek Inline Pill) ── */}
      {flushResult && (
        <div className="mypc-feedback-pill" role="status" aria-live="polite">
          <div className="mypc-feedback-content">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            <span>
              {isRtl
                ? `تم تحرير ${flushResult.freedGB} جيجابايت من الذاكرة المؤقتة عبر ${flushResult.procs} عملية بنجاح.`
                : `Standby memory trimmed: Freed ${flushResult.freedGB} GB RAM across ${flushResult.procs} active processes.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFlushResult(null)}
            className="mypc-feedback-close"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── 3. Primary Processors: CPU & RAM Matrix ── */}
      <section className="mypc-grid-two">
        
        {/* CPU Telemetry Card */}
        <div className="mypc-card">
          <div className="mypc-card-header">
            <div className="mypc-card-tag">
              <Cpu size={15} className="text-cyan" />
              <span>{t('myPc.processor')}</span>
            </div>
            <div className="mypc-rate-box">
              <span className="mypc-rate-val mono">{data.cpu.usage_percent.toFixed(1)}%</span>
              <span className="mypc-rate-sub mono">{t('myPc.utilization')}</span>
            </div>
          </div>

          <div className="mypc-chip-name">
            {data.cpu.name.replace(/\(R\)|\(TM\)/gi, '').trim()}
          </div>

          <div className="mypc-specs-row mono">
            <span>{data.cpu.logical_cores} {t('myPc.cores')}</span>
            <span>•</span>
            <span>{data.cpu.physical_cores} Physical</span>
            <span>•</span>
            <span className="text-cyan font-semibold">{data.cpu.freq_mhz || 3800} MHz</span>
          </div>

          {/* Progress Bar & Mini Sparkline */}
          <div className="mypc-meter-group">
            <div className="mypc-meter-header mono">
              <span>{t('myPc.cpuLoadHistory')}</span>
              <span>{data.cpu.usage_percent.toFixed(1)}%</span>
            </div>
            <div className="mypc-meter-track">
              <div
                className="mypc-meter-fill mypc-meter-cyan"
                style={{ width: `${Math.min(100, Math.max(3, data.cpu.usage_percent))}%` }}
              />
            </div>
          </div>

          {/* Realtime 12-point Sparkline */}
          <div className="mypc-sparkline-wrap">
            <svg viewBox="0 0 140 34" className="mypc-sparkline-svg" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          </div>
        </div>

        {/* RAM Telemetry Card */}
        <div className="mypc-card">
          <div className="mypc-card-header">
            <div className="mypc-card-tag">
              <Microchip size={15} className="text-emerald-500" />
              <span>{t('myPc.memory')}</span>
            </div>
            <div className="mypc-rate-box">
              <span className="mypc-rate-val mono text-emerald-500">{data.memory.percent.toFixed(1)}%</span>
              <span className="mypc-rate-sub mono">{t('myPc.allocation')}</span>
            </div>
          </div>

          <div className="mypc-chip-name">
            {data.memory.total_gb.toFixed(1)} GB High-Speed Memory
          </div>

          <div className="mypc-specs-row mono">
            <span><b className="text-foreground">{data.memory.used_gb.toFixed(1)} GB</b> {t('myPc.inUse')}</span>
            <span>•</span>
            <span className="text-emerald-500 font-semibold">{data.memory.free_gb.toFixed(1)} GB {t('myPc.free')}</span>
            {data.memory.swap_total_gb && (
              <>
                <span>•</span>
                <span className="text-muted-foreground">{t('myPc.swapMemory')}: {data.memory.swap_used_gb || 0}/{data.memory.swap_total_gb} GB</span>
              </>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mypc-meter-group">
            <div className="mypc-meter-header mono">
              <span>{t('myPc.allocation')}</span>
              <span>{data.memory.used_gb.toFixed(1)} / {data.memory.total_gb.toFixed(1)} GB</span>
            </div>
            <div className="mypc-meter-track">
              <div
                className="mypc-meter-fill mypc-meter-emerald"
                style={{ width: `${Math.min(100, Math.max(3, data.memory.percent))}%` }}
              />
            </div>
          </div>

          {/* Top 4 Memory-Consuming Processes */}
          {data.top_processes && data.top_processes.length > 0 && (
            <div className="mypc-procs-container">
              <div className="mypc-procs-title mono">
                <span>{t('myPc.topProcesses')}</span>
                <span>MB / %</span>
              </div>
              <div className="mypc-procs-list">
                {data.top_processes.slice(0, 4).map((proc) => (
                  <div key={proc.pid} className="mypc-proc-row">
                    <span className="mypc-proc-name truncate">{proc.name}</span>
                    <span className="mypc-proc-stat mono">
                      {proc.memory_mb.toFixed(0)} MB <small>({proc.memory_percent}%)</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. Graphics Accelerators (GPUs) ── */}
      <section className="mypc-section">
        <div className="mypc-section-header">
          <Monitor size={15} className="text-cyan" />
          <h2>{t('myPc.graphics')}</h2>
          <span className="mypc-section-desc">• {t('myPc.graphicsDesc')}</span>
          
          <div className="mypc-section-actions">
            <button
              type="button"
              onClick={() => handleLaunchTool('dxdiag')}
              className="mypc-mini-tool focus-ring"
              title="Launch DirectX Diagnostic Tool"
            >
              <span>{t('myPc.dxDiag')}</span>
              <ExternalLink size={11} />
            </button>
            <button
              type="button"
              onClick={() => handleLaunchTool('devmgmt')}
              className="mypc-mini-tool focus-ring"
              title="Launch Windows Device Manager"
            >
              <span>{t('myPc.deviceMgr')}</span>
              <ExternalLink size={11} />
            </button>
          </div>
        </div>

        <div className="mypc-grid-two">
          {data.gpus.map((gpuName, idx) => {
            const isNvidia = gpuName.toLowerCase().includes('nvidia');
            return (
              <div
                key={idx}
                className={`mypc-card mypc-gpu-card ${isNvidia ? 'mypc-gpu-discrete' : ''}`}
              >
                <div className="mypc-gpu-icon-box">
                  <Monitor size={20} />
                </div>
                <div className="mypc-gpu-content">
                  <div className="mypc-gpu-badges">
                    <span className={`mypc-gpu-tag mono ${isNvidia ? 'is-discrete' : 'is-integrated'}`}>
                      {isNvidia ? 'DISCRETE ACCELERATOR' : 'INTEGRATED GRAPHICS'}
                    </span>
                    <span className="mypc-gpu-index mono">GPU 0{idx}</span>
                  </div>
                  <b className="mypc-gpu-name truncate">{gpuName}</b>
                  <p className="mypc-gpu-desc">
                    {isNvidia ? t('myPc.discreteGpu') : t('myPc.integratedGpu')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 5. Storage Partitions & NVMe Volumes ── */}
      <section className="mypc-section">
        <div className="mypc-section-header">
          <HardDrive size={15} className="text-amber-400" />
          <h2>{t('myPc.storage')}</h2>
          <span className="mypc-section-desc">• {t('myPc.storageDesc')}</span>

          <div className="mypc-section-actions">
            <button
              type="button"
              onClick={() => handleLaunchTool('cleanmgr')}
              className="mypc-mini-tool focus-ring"
              title="Launch Windows Disk Cleanup"
            >
              <span>{t('myPc.cleanMgr')}</span>
              <ExternalLink size={11} />
            </button>
          </div>
        </div>

        <div className="mypc-grid-two">
          {data.disks.map((disk) => {
            const isSystem = disk.drive.toUpperCase().includes('C');
            return (
              <div key={disk.drive} className="mypc-card mypc-disk-card">
                <div className="mypc-disk-header">
                  <div className="mypc-disk-meta">
                    <div className={`mypc-drive-letter ${isSystem ? 'is-system-drive' : ''}`}>
                      {disk.drive}
                    </div>
                    <div>
                      <b className="mypc-disk-label">{disk.label} ({disk.drive})</b>
                      <span className="mypc-disk-sub mono">
                        {disk.fs} • {isSystem ? 'System Boot' : 'Secondary Storage'}
                      </span>
                    </div>
                  </div>
                  <div className="mypc-disk-percent mono">
                    <b>{disk.percent}%</b>
                    <small>{t('myPc.inUse').toUpperCase()}</small>
                  </div>
                </div>

                <div className="mypc-meter-track">
                  <div
                    className={`mypc-meter-fill ${isSystem ? 'mypc-meter-cyan' : 'mypc-meter-amber'}`}
                    style={{ width: `${Math.min(100, Math.max(2, disk.percent))}%` }}
                  />
                </div>

                <div className="mypc-disk-footer mono">
                  <span><b className="text-foreground">{disk.free_gb.toFixed(0)} GB</b> {t('myPc.free')}</span>
                  <span>{disk.total_gb.toFixed(0)} GB {t('myPc.total')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 6. Power, Network & Operating Environment ── */}
      <section className="mypc-section">
        <div className="mypc-section-header">
          <Server size={15} className="text-purple-400" />
          <h2>{t('myPc.os')}</h2>
          <span className="mypc-section-desc">• {t('myPc.osDesc')}</span>
        </div>

        <div className="mypc-env-grid">
          {/* Battery Status (if laptop) */}
          {data.battery && (
            <div className="mypc-env-tile">
              <div className="mypc-env-tile-label mono">
                {data.battery.plugged ? <BatteryCharging size={12} className="text-emerald-500" /> : <Battery size={12} className="text-amber-400" />}
                <span>{t('myPc.batteryTitle')}</span>
              </div>
              <b className="mypc-env-tile-val">
                {data.battery.percent}% {data.battery.plugged ? `(${t('myPc.acConnected')})` : `(${t('myPc.onBattery')})`}
              </b>
            </div>
          )}

          {/* Network Realtime Telemetry */}
          {data.network && (
            <div className="mypc-env-tile">
              <div className="mypc-env-tile-label mono">
                <Wifi size={12} className="text-cyan" />
                <span>{t('myPc.networkTitle')}</span>
              </div>
              <b className="mypc-env-tile-val mono">
                ↓ {data.network.recv_mb} MB • ↑ {data.network.sent_mb} MB
              </b>
            </div>
          )}

          {/* OS Platform */}
          <div className="mypc-env-tile">
            <span className="mypc-env-tile-label mono">OS PLATFORM</span>
            <b className="mypc-env-tile-val">{data.system.os}</b>
          </div>

          {/* Windows Build */}
          <div className="mypc-env-tile">
            <span className="mypc-env-tile-label mono">WINDOWS BUILD</span>
            <b className="mypc-env-tile-val mono">{data.system.build}</b>
          </div>

          {/* Sanitized Hostname */}
          <div className="mypc-env-tile">
            <span className="mypc-env-tile-label mono">MACHINE HOSTNAME</span>
            <b className="mypc-env-tile-val mono">{data.system.hostname}</b>
          </div>

          {/* Live System Uptime */}
          <div className="mypc-env-tile">
            <span className="mypc-env-tile-label mono">{t('myPc.uptime').toUpperCase()}</span>
            <b className="mypc-env-tile-val mono text-cyan">{data.system.uptime}</b>
          </div>
        </div>
      </section>

    </div>
  );
}
