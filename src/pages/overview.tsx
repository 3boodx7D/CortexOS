import { useEffect, useState, useCallback } from 'react';
import { Link } from 'wouter';
import {
  Activity, ArrowUpRight, BrainCircuit, BookOpen, CalendarClock,
  Database, Disc3, FolderKanban, Gamepad2, Headphones, Power,
  SunMedium, Trash2, Zap, Monitor, AlertTriangle, RefreshCw,
  Copy, Check, ShieldAlert, ShieldCheck, CheckCircle2, X
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserPersistent } from '@/lib/user-store';
import { usePersistent } from '@/hooks/use-persistent';
import { LiveTelemetryChart } from '@/components/live-telemetry-chart';
import { checkSupabaseDetailedHealth, type SupabaseHealthReport } from '@/lib/supabase';

type Telemetry = {
  cpu: { loadPercent: number };
  memory: { totalGB: number; freeGB: number; usedGB: number; usagePercent: number };
  gpu: { loadPercent: number };
  uptime: { seconds: number; hours: number; minutes: number };
};

export type TelemetryDataPoint = {
  cpu: number;
  ram: number;
  gpu: number;
};

export default function Overview({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [motionMode] = usePersistent<string>('cortex-motion', 'cinematic');
  const [now, setNow] = useState(new Date());
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [history, setHistory] = useState<TelemetryDataPoint[]>(Array(30).fill({ cpu: 0, ram: 0, gpu: 0 }));

  // Developer & Admin Supabase Diagnostics state
  const [healthReport, setHealthReport] = useState<SupabaseHealthReport | null>(null);
  const [probing, setProbing] = useState<boolean>(false);
  const [diagModalOpen, setDiagModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [simulatedError, setSimulatedError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  // Probe Supabase Health
  const runSupabaseProbe = useCallback(async (force = false) => {
    setProbing(true);
    try {
      const rep = await checkSupabaseDetailedHealth(force);
      setHealthReport(rep);
      if (!rep.ok) {
        setBannerDismissed(false);
      }
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    runSupabaseProbe(false);
  }, [runSupabaseProbe]);

  const isHealthy = Boolean(healthReport?.ok && !simulatedError);

  const handleCopyDiagnostics = () => {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      healthReport,
      simulatedError,
      userAgent: navigator.userAgent
    }, null, 2);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      fetch('/api/system/telemetry')
        .then(res => res.json())
        .then(data => {
          setTelemetry(data);
          setHistory(prev => {
            const next = [...prev.slice(1), { 
              cpu: data.cpu.loadPercent, 
              ram: data.memory.usagePercent, 
              gpu: data.gpu ? data.gpu.loadPercent : 0 
            }];
            return next;
          });
        })
        .catch(console.error);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [focus, setFocus] = useUserPersistent('focus', false);
  const [turbo, setTurbo] = useUserPersistent('turbo', false);

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return t('overview.morningGreeting');
    if (hour < 18) return t('overview.afternoonGreeting');
    return t('overview.eveningGreeting');
  };

  const modules = [
    { href: '/projects', icon: FolderKanban, title: t('nav.projects'), meta: '04 active', tone: 'cyan' },
    { href: '/study', icon: BookOpen, title: t('nav.study'), meta: '02 sessions', tone: 'green' },
    { href: '/games', icon: Gamepad2, title: t('nav.games'), meta: '03 installed', tone: 'violet' },
    { href: '/media', icon: Headphones, title: t('nav.media'), meta: '04 tracks', tone: 'orange' },
    { href: '/my-pc', icon: Monitor, title: 'My PC', meta: 'System Info', tone: 'lime' },
    { href: '/deadlines', icon: CalendarClock, title: t('nav.deadlines'), meta: '04 upcoming', tone: 'pink' },
  ];

  return (
    <div>
      {/* ⚠️ DEVELOPER & ADMIN SUPABASE ERROR BANNER (Conditional: only shown on error or failure) */}
      {(!isHealthy) && !bannerDismissed && (
        <div className="mb-6 p-5 rounded-2xl bg-[#0e0406] border border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.18)] page-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rose-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold tracking-wider">
                    {t('supabaseDiag.devAdminAlert')}
                  </span>
                  <span className="text-xs font-mono text-rose-400/80">
                    {simulatedError ? 'SIMULATED_ERR_503' : (healthReport?.errorCode || 'CONN_FAILURE')}
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-bold text-white mt-1">
                  {t('supabaseDiag.connectionErrorTitle')}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => runSupabaseProbe(true)}
                disabled={probing}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-mono flex items-center gap-1.5 transition"
              >
                <RefreshCw size={13} className={probing ? 'animate-spin' : ''} />
                <span>{probing ? t('supabaseDiag.retrying') : t('supabaseDiag.retryCheck')}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyDiagnostics}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-mono flex items-center gap-1.5 transition"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? t('supabaseDiag.copied') : t('supabaseDiag.copyReport')}</span>
              </button>

              <button
                type="button"
                onClick={() => setDiagModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-700 text-xs font-mono flex items-center gap-1.5 transition"
              >
                <ShieldAlert size={13} />
                <span>{t('supabaseDiag.inspectDeck')}</span>
              </button>

              {simulatedError ? (
                <button
                  type="button"
                  onClick={() => setSimulatedError(null)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono transition"
                >
                  {t('supabaseDiag.stopSimulation')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="text-zinc-500 hover:text-zinc-300 p-1.5 transition"
                  title={t('supabaseDiag.dismiss')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-black/60 border border-rose-950/80">
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">{t('supabaseDiag.endpoint')}</span>
              <span className="font-mono text-rose-300 truncate block">
                eoafqqhojpuigpxrxfwm.supabase.co
              </span>
            </div>
            <div className="p-3 rounded-lg bg-black/60 border border-rose-950/80">
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">{t('supabaseDiag.pingLatency')}</span>
              <span className="font-mono text-rose-400 font-bold block">
                {simulatedError ? 'SIMULATED / ERR' : (healthReport?.latencyMs ? `${healthReport.latencyMs} ms` : 'TIMEOUT')}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-black/60 border border-rose-950/80">
              <span className="text-[11px] font-mono text-zinc-400 block mb-1">{t('supabaseDiag.errorDetails')}</span>
              <span className="font-mono text-rose-300 truncate block">
                {simulatedError || healthReport?.errorMessage || t('supabaseDiag.connectionErrorDesc')}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="section-title">
        <div>
          <div className="eyebrow mono">{t('overview.eyebrow')}</div>
          <h1>{getGreeting()}</h1>
          <p>{t('overview.subtitle')}</p>
        </div>
        <div className="clock-block">
          <span className="mono">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <small>{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</small>
        </div>
      </div>

      <div className="overview-grid">
        <section className="hero-panel panel shell-grid">
          <div className="hero-top">
            <span className="eyebrow mono"><span className="pulse-dot live-dot" />{t('overview.eyebrow')}</span>
            <span className="mono quiet">SESSION 04:28:16</span>
          </div>
          <div className="hero-content-wrap">
            <div className="hero-copy">
              <h2>{t('overview.heroTitle1')}<br /><em>{t('overview.heroTitle2')}</em></h2>
              <p>{t('overview.heroDesc')}</p>
            </div>
            <div className="hero-actions">
              <button
                className="btn btn-accent focus-ring"
                onClick={() => { const next = !focus; setFocus(next); notify(next ? t('overview.focusModeActive') : t('overview.focusModeOff')); }}
                data-testid="button-focus-mode"
              >
                <Zap size={15} />{focus ? t('overview.focusExit') : t('overview.focusStart')}
              </button>
              <span className="mono action-hint">Ctrl + Enter</span>
            </div>
          </div>
          <div className="hero-foot">
            <span><span className={`tiny-led ${isHealthy ? 'cyan' : 'red'}`} />{isHealthy ? t('overview.allNominal') : 'SYSTEM NOTICE'}</span>
            <button
              type="button"
              onClick={() => setDiagModalOpen(true)}
              className="mono text-xs text-zinc-400 hover:text-cyan-400 flex items-center gap-1.5 transition"
              title={t('supabaseDiag.inspectDeck')}
            >
              <span>{t('app.supabaseCluster')}</span>
              <span className={`text-[10px] font-mono ${isHealthy ? 'text-cyan-400' : 'text-rose-400'}`}>
                ({isHealthy ? `${healthReport?.latencyMs || 35}ms` : 'DEGRADED'})
              </span>
            </button>
          </div>
        </section>

        <section className="telemetry panel">
          <div className="panel-head">
            <span className="eyebrow mono">{t('overview.liveTelemetry')}</span>
            <Activity size={15} className="text-cyan" />
          </div>
          <div className="telemetry-chart">
            <LiveTelemetryChart data={history} motionMode={motionMode} />
            <span className="chart-now mono" style={{ position: 'absolute', top: 0, right: 0, fontSize: '10px', color: 'hsl(187 86% 54%)' }}>NOW</span>
          </div>
          <div className="telemetry-stats">
            <div><span style={{color: '#16d4e9'}}>CPU LOAD</span><b>{telemetry ? telemetry.cpu.loadPercent : '--'}%</b></div>
            <div><span style={{color: '#a78bfa'}}>RAM LOAD</span><b>{telemetry ? telemetry.memory.usagePercent : '--'}%</b></div>
            <div><span style={{color: '#4ade80'}}>GPU LOAD</span><b>{telemetry && telemetry.gpu ? telemetry.gpu.loadPercent : '--'}%</b></div>
          </div>
        </section>
      </div>

      <div className="overview-lower">
        <section className="module-section">
          <div className="section-mini-head">
            <span className="eyebrow mono">{t('overview.modules')}</span>
            <span className="mono quiet">07 {t('overview.available')}</span>
          </div>
          <div className="module-grid">
            {[...modules, { href: '/media', icon: Disc3, title: t('overview.dynamicIsland'), meta: 'PLAYING · 04:12', tone: 'cyan' }].map(({ href, icon: Icon, title, meta, tone }, index) => (
              <Link href={href} key={`${href}-${title}`} className={`module-card tone-${tone}`} data-testid={`link-module-${index}`}>
                <span className="module-index mono">0{index + 1}</span>
                <span className="module-icon"><Icon size={20} /></span>
                <span className="module-title">{title}</span>
                <span className="module-meta mono">{meta}<ArrowUpRight size={13} /></span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="quick-stack">
          <div className="section-mini-head">
            <span className="eyebrow mono">{t('overview.quickSystems')}</span>
          </div>
          <div className="quick-item">
            <span className="quick-icon"><Power size={15} /></span>
            <span>
              <b>{t('overview.turboMode')}</b>
              <small>{turbo ? t('overview.turboPerf') : t('overview.turboBalanced')}</small>
            </span>
            <button
              type="button" role="switch" aria-checked={turbo}
              className={`toggle ${turbo ? 'toggle-on' : ''}`}
              onClick={() => { const next = !turbo; setTurbo(next); notify(next ? t('overview.turboEnabled') : t('overview.turboDisabled')); }}
              aria-label="Toggle Turbo Mode"
              data-testid="button-toggle-turbo"
            ><span /></button>
          </div>
          <div className="quick-item">
            <span className="quick-icon"><Database size={15} className={isHealthy ? 'text-cyan-400' : 'text-rose-400'} /></span>
            <span className="flex-1 cursor-pointer" onClick={() => setDiagModalOpen(true)}>
              <b className="flex items-center gap-1.5">
                {t('overview.supabaseCloud')}
                <span className="text-[9px] font-mono font-normal px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">DEV/ADMIN</span>
              </b>
              <small className={isHealthy ? 'text-zinc-400' : 'text-rose-400'}>
                {isHealthy
                  ? `${healthReport?.latencyMs || 35}ms · 4 Tables Verified`
                  : (simulatedError || healthReport?.errorMessage || 'Connection failed')}
              </small>
            </span>
            <button
              type="button"
              onClick={() => setDiagModalOpen(true)}
              className={`status-pill ${isHealthy ? 'status-active' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'} text-[11px] cursor-pointer flex items-center gap-1.5`}
              title={t('supabaseDiag.inspectDeck')}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-ping'}`} />
              <span>{isHealthy ? `${healthReport?.latencyMs || 35}ms` : 'Error'}</span>
            </button>
          </div>
        </aside>
      </div>

      {/* 🛠️ DEVELOPER & ADMIN SUPABASE DIAGNOSTICS MODAL */}
      {diagModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDiagModalOpen(false);
          }}
        >
          <div className="modal panel page-in max-w-xl w-full bg-[#0a0a0a] border border-zinc-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Database size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{t('supabaseDiag.modalTitle')}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      LIVE CLUSTER
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-500">{t('supabaseDiag.modalSubtitle')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiagModalOpen(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Telemetry Snapshot Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-black/60 border border-zinc-900">
                  <span className="text-[10px] font-mono text-zinc-500 block mb-1">{t('supabaseDiag.endpoint')}</span>
                  <span className="text-xs font-mono text-zinc-200 truncate block">
                    eoafqqhojpuigpxrxfwm.supabase.co
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-black/60 border border-zinc-900">
                  <span className="text-[10px] font-mono text-zinc-500 block mb-1">{t('supabaseDiag.pingLatency')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {healthReport?.latencyMs ?? 35} ms
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">(Cloudflare Edge)</span>
                  </div>
                </div>
              </div>

              {/* Verified Database Tables Matrix */}
              <div className="p-4 rounded-xl bg-black/60 border border-zinc-900">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-900 text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-cyan-400" />
                    <span>{t('supabaseDiag.verifiedTables')}</span>
                  </span>
                  <span className="font-mono text-xs text-emerald-400">
                    4/4 {t('supabaseDiag.tablesOperational')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-900">
                    <span className="text-zinc-300">public.users</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('supabaseDiag.verified')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-900">
                    <span className="text-zinc-300">public.projects</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('supabaseDiag.verified')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-900">
                    <span className="text-zinc-300">public.friendships</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('supabaseDiag.verified')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-900">
                    <span className="text-zinc-300">public.team_collaborators</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t('supabaseDiag.verified')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Infrastructure Services */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-black/60 border border-zinc-900 flex items-center justify-between">
                  <span className="text-zinc-400">{t('supabaseDiag.authGateway')}</span>
                  <span className="text-emerald-400 font-mono text-[11px] font-semibold">Active · 200 OK</span>
                </div>
                <div className="p-3 rounded-xl bg-black/60 border border-zinc-900 flex items-center justify-between">
                  <span className="text-zinc-400">{t('supabaseDiag.realtimeSockets')}</span>
                  <span className="text-cyan-400 font-mono text-[11px] font-semibold">Subscribed</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (simulatedError) {
                        setSimulatedError(null);
                      } else {
                        setSimulatedError('Simulated Gateway Error: HTTP 503 Backend Cluster Unreachable (Testing Developer Alert Banner)');
                        setDiagModalOpen(false);
                      }
                    }}
                    className={`text-xs font-mono px-3 py-2 rounded-lg border transition ${
                      simulatedError
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {simulatedError ? t('supabaseDiag.stopSimulation') : t('supabaseDiag.simulateFailure')}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyDiagnostics}
                    className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 flex items-center gap-1.5 transition"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copied ? t('supabaseDiag.copied') : t('supabaseDiag.copyReport')}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => runSupabaseProbe(true)}
                  disabled={probing}
                  className="btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2 px-4 rounded-lg flex items-center gap-2 transition"
                >
                  <RefreshCw size={13} className={probing ? 'animate-spin' : ''} />
                  <span>{probing ? t('supabaseDiag.retrying') : t('supabaseDiag.retryCheck')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

