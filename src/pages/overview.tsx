import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  Activity, ArrowUpRight, BookOpen, CalendarClock,
  Database, Disc3, FolderKanban, Gamepad2, Headphones, Power,
  Zap, Monitor, Check, Sparkles
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserPersistent } from '@/lib/user-store';
import { usePersistent } from '@/hooks/use-persistent';
import { LiveTelemetryChart } from '@/components/live-telemetry-chart';
import { apiGet } from '@/lib/api-client';
import { invoke } from '@/lib/tauri';

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      apiGet<Telemetry>('/api/system/telemetry')
        .then(data => {
          if (data && data.cpu && data.memory) {
            setTelemetry(data);
            setHistory(prev => {
              const next = [...prev.slice(1), { 
                cpu: data.cpu.loadPercent, 
                ram: data.memory.usagePercent, 
                gpu: data.gpu ? data.gpu.loadPercent : 0 
              }];
              return next;
            });
          }
        })
        .catch(() => {
          // Native Tauri hardware probe fallback when backend daemon is starting or unavailable
          invoke<any>('get_system_info')
            .then(res => {
              if (res?.value) {
                const v = res.value;
                const cpuLoad = Math.round((v.cpu?.usage ?? 0) * 10) / 10;
                const ramLoad = Math.round((v.memory?.usage_percent ?? 0) * 10) / 10;
                setTelemetry(prev => ({
                  cpu: { loadPercent: cpuLoad },
                  memory: {
                    totalGB: Math.round((v.memory?.total_gb ?? 16) * 10) / 10,
                    freeGB: Math.round((v.memory?.free_gb ?? 4) * 10) / 10,
                    usedGB: Math.round((v.memory?.used_gb ?? 12) * 10) / 10,
                    usagePercent: ramLoad,
                  },
                  gpu: { loadPercent: 0 },
                  uptime: prev?.uptime ?? { seconds: 0, hours: 0, minutes: 0 },
                }));
                setHistory(prev => [...prev.slice(1), { cpu: cpuLoad, ram: ramLoad, gpu: 0 }]);
              }
            })
            .catch(() => {});
        });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [focus, setFocus] = useUserPersistent('focus', false);
  const [turbo, setTurbo] = useUserPersistent('turbo', false);
  const [lastSeenVersion, setLastSeenVersion] = usePersistent<string>('cortex-last-seen-version', '');
  const showWhatsNew = lastSeenVersion !== '0.3.24';

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
      {showWhatsNew && (
        <div
          className="page-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '12px 18px',
            marginBottom: 20,
            borderRadius: 10,
            border: '1px solid rgba(0, 175, 244, 0.35)',
            background: 'rgba(0, 175, 244, 0.05)',
          }}
          data-testid="banner-whats-new"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(0, 175, 244, 0.12)',
              color: '#00aff4',
              flexShrink: 0
            }}>
              <Sparkles size={16} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span className="mono" style={{ color: '#00aff4' }}>{t('overview.whatsNewTag')}</span>
                <span>{t('overview.whatsNewTitle')}</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                {t('overview.whatsNewDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastSeenVersion('0.3.24')}
            className="btn-outline"
            style={{ fontSize: 11, padding: '6px 12px', height: 30, gap: 5, flexShrink: 0 }}
            data-testid="button-dismiss-whats-new"
          >
            <Check size={12} className="text-cyan" />
            <span>{t('overview.dismiss')}</span>
          </button>
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
            <span><span className="tiny-led cyan" />{t('app.allNominal')}</span>
            <span className="mono text-xs text-zinc-400 flex items-center gap-1.5">
              <span>{t('app.supabaseCluster')}</span>
              <span className="text-[10px] font-mono text-cyan-400">· {t('app.syncBadge')}</span>
            </span>
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
            <span className="quick-icon"><Database size={15} className="text-cyan-400" /></span>
            <span>
              <b>{t('overview.supabaseCloud')}</b>
              <small className="text-zinc-400">{t('overview.supabaseDesc')}</small>
            </span>
            <span className="status-pill status-active text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>ACTIVE</span>
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}


