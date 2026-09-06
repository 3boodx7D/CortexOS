import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  Activity, ArrowUpRight, BrainCircuit, BookOpen, CalendarClock,
  Database, Disc3, FolderKanban, Gamepad2, Headphones, Power,
  SunMedium, Trash2, Zap,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';

export default function Overview({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const [focus, setFocus] = usePersistent('cortex-focus', false);
  const [turbo, setTurbo] = usePersistent('cortex-turbo', false);

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
    { href: '/janitor', icon: Trash2, title: t('nav.janitor'), meta: '84% clean', tone: 'lime' },
    { href: '/deadlines', icon: CalendarClock, title: t('nav.deadlines'), meta: '04 upcoming', tone: 'pink' },
  ];

  return (
    <div>
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
            <span><span className="tiny-led cyan" />{t('overview.allNominal')}</span>
            <span className="mono">{t('app.supabaseCluster')}</span>
          </div>
        </section>

        <section className="telemetry panel">
          <div className="panel-head">
            <span className="eyebrow mono">{t('overview.liveTelemetry')}</span>
            <Activity size={15} className="text-cyan" />
          </div>
          <div className="telemetry-chart">
            <div className="chart-grid" />
            <svg viewBox="0 0 460 130" preserveAspectRatio="none">
              <polyline points="0,96 28,91 48,97 74,64 103,76 127,54 153,68 178,44 203,57 225,48 249,77 277,59 305,67 332,36 361,49 385,30 409,44 436,22 460,28" fill="none" stroke="hsl(187 86% 54%)" strokeWidth="2" />
            </svg>
            <span className="chart-now mono">NOW</span>
          </div>
          <div className="telemetry-stats">
            <div><span>CPU LOAD</span><b>38.4%</b></div>
            <div><span>MEMORY</span><b>6.2 <small>GB</small></b></div>
            <div><span>UPTIME</span><b>18<small>h</small> 42<small>m</small></b></div>
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
            <span className="quick-icon"><Database size={15} /></span>
            <span>
              <b>{t('overview.supabaseCloud')}</b>
              <small>{t('overview.supabaseDesc')}</small>
            </span>
            <span className="status-pill status-active">{t('common.online')}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
