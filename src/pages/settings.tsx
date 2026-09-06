import { type ChangeEvent, useCallback, useRef, useState, useEffect } from 'react';
import {
  Check, ChevronRight, Cpu, Eye,
  Globe, HardDrive, Info, Lock, LogOut, Monitor, Moon, Palette, RefreshCw, Save, Shield, ShieldCheck, Sun,
  Upload, User as UserIcon, Zap,
} from 'lucide-react';
import { useTranslation, saveLocaleAndReload, type Locale } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { signOut } from '@/lib/supabase';
import { useUserContext } from '@/lib/user-store';

export type MotionMode = 'minimal' | 'cinematic';

export default function Settings({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();
  const { email, userId, displayName, avatarChar, syncStatus, lastSynced, syncAllToCloud, updateDisplayName } = useUserContext();
  const [activeTab, setActiveTab] = useState('account');

  // State
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');
  const [motionMode, setMotionMode] = usePersistent<MotionMode>('cortex-motion', 'cinematic');
  const [pendingLocale, setPendingLocale] = useState<Locale>(locale);

  // Desktop App (PC) simulated settings
  const [autoStart, setAutoStart] = usePersistent<boolean>('cortex-pc-autostart', true);
  const [runInBackground, setRunInBackground] = usePersistent<boolean>('cortex-pc-background', true);
  const [gpuAcceleration, setGpuAcceleration] = usePersistent<boolean>('cortex-pc-gpu', true);
  const [globalHotkeys, setGlobalHotkeys] = usePersistent<boolean>('cortex-pc-hotkeys', true);

  // Account editing
  const [inputName, setInputName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  // File import/export
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setInputName(displayName);
  }, [displayName]);

  // Theme switching
  const applyTheme = useCallback((newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [setTheme]);

  // Motion switching
  const applyMotion = useCallback((mode: MotionMode) => {
    setMotionMode(mode);
    document.documentElement.setAttribute('data-motion', mode);
  }, [setMotionMode]);

  // Language save
  const handleSaveLocale = () => {
    if (pendingLocale !== locale) {
      saveLocaleAndReload(pendingLocale);
    }
  };

  // Name save
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    setSavingName(true);
    const ok = await updateDisplayName(inputName.trim());
    setSavingName(false);
    if (ok) {
      notify(t('settings.account.nameUpdated'));
    }
  };

  // Cloud Sync
  const handleSyncCloud = async () => {
    setSyncingNow(true);
    const ok = await syncAllToCloud();
    setSyncingNow(false);
    if (ok) {
      notify(t('settings.account.syncSuccess'));
    } else {
      notify(locale === 'ar' ? 'تم حفظ البيانات محلياً' : 'Data stored locally');
    }
  };

  // Data export
  const exportBackup = () => {
    const userPrefix = `cortex_u_${userId}_`;
    const data = Object.fromEntries(
      Object.keys(localStorage)
        .filter((k) => k.startsWith(userPrefix) || k.startsWith('cortex-') || k.startsWith('cortex_u_'))
        .map((k) => [k, localStorage.getItem(k)])
    );
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), version: '0.2.10', userId, data }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cortexos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Data import
  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.data || typeof json.data !== 'object') throw new Error('Invalid format');
        for (const [key, value] of Object.entries(json.data)) {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          }
        }
        await syncAllToCloud();
        setTimeout(() => window.location.reload(), 400);
      } catch {
        alert(t('settings.data.invalidFile'));
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) importBackup(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importBackup(file);
  };

  const clearCache = () => {
    if (!confirm(t('settings.data.clearConfirm'))) return;
    const themeVal = localStorage.getItem('cortex-theme');
    const langVal = localStorage.getItem('cortex-locale');
    localStorage.clear();
    if (themeVal) localStorage.setItem('cortex-theme', themeVal);
    if (langVal) localStorage.setItem('cortex-locale', langVal);
    setTimeout(() => window.location.reload(), 300);
  };

  const tabs = [
    { id: 'account', labelKey: 'settings.tabs.account', icon: UserIcon },
    { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: Palette },
    { id: 'desktop', labelKey: 'settings.tabs.desktop', icon: Monitor },
    { id: 'motion', labelKey: 'settings.tabs.motion', icon: Zap },
    { id: 'data', labelKey: 'settings.tabs.data', icon: HardDrive },
    { id: 'privacy', labelKey: 'settings.tabs.privacy', icon: Shield },
    { id: 'language', labelKey: 'settings.tabs.language', icon: Globe },
    { id: 'about', labelKey: 'settings.tabs.about', icon: Info },
  ];

  const content: Record<string, React.ReactNode> = {
    account: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><UserIcon size={16} /></span>
          <div>
            <h2>{t('settings.account.title')}</h2>
            <p>{t('settings.account.desc')}</p>
          </div>
        </div>

        {/* User Card */}
        <div className="account-details-panel panel-subtle">
          <div className="account-profile-header">
            <div className="account-big-avatar">
              {avatarChar}
              <span className="account-online" />
            </div>
            <div className="account-profile-text">
              <span className="account-profile-name">{displayName}</span>
              <span className="account-profile-badge mono">
                <ShieldCheck size={13} className="text-emerald-400" />
                {t('settings.account.connected')}
              </span>
            </div>
          </div>

          <form className="account-edit-form" onSubmit={handleSaveName}>
            <div className="form-group">
              <label htmlFor="settings-email-locked">
                <span>{t('settings.account.emailLabel')}</span>
              </label>
              <div className="locked-input-wrapper">
                <input
                  id="settings-email-locked"
                  type="email"
                  value={email}
                  disabled
                  readOnly
                  className="locked-input mono"
                />
                <Lock size={15} className="locked-icon" />
              </div>
              <small className="field-hint text-muted-foreground">{t('settings.account.emailHint')}</small>
            </div>

            <div className="form-group">
              <label htmlFor="settings-display-name">
                <span>{t('settings.account.displayName')}</span>
              </label>
              <div className="input-with-button">
                <input
                  id="settings-display-name"
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="Your Name"
                  maxLength={40}
                  className="editable-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm focus-ring"
                  disabled={savingName || inputName.trim() === displayName || !inputName.trim()}
                >
                  <Save size={13} />
                  {savingName ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t('settings.account.saveName')}
                </button>
              </div>
            </div>
          </form>

          <div className="cloud-details-grid">
            <div>
              <small>{t('settings.account.accountInfo')}</small>
              <b className="mono text-xs truncate max-w-[200px] block" title={userId}>
                UUID: {userId.slice(0, 16)}...
              </b>
            </div>
            <div>
              <small>{t('settings.account.status')}</small>
              <b className="mono text-xs text-emerald-400 flex items-center gap-1">
                <span className="pulse-dot-green" /> {lastSynced ? `${t('common.online')} (${lastSynced})` : t('common.online')}
              </b>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn btn-accent focus-ring" disabled={syncingNow} onClick={handleSyncCloud}>
            <RefreshCw className={syncingNow ? "spin" : ""} size={14} />
            {syncingNow ? (locale === 'ar' ? 'جاري المزامنة...' : 'Syncing...') : t('settings.account.syncCloud')}
          </button>
          <button className="btn btn-ghost text-destructive focus-ring" onClick={() => signOut()}>
            <LogOut size={14} />
            {t('settings.account.signOut')}
          </button>
        </div>
      </div>
    ),

    appearance: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><Palette size={16} /></span>
          <div>
            <h2>{t('settings.appearance.title')}</h2>
            <p>{t('settings.appearance.desc')}</p>
          </div>
        </div>
        <div className="theme-cards">
          <button
            className={`theme-card theme-dark-card ${theme === 'dark' ? 'theme-active' : ''}`}
            onClick={() => applyTheme('dark')}
          >
            <div className="theme-preview theme-preview-dark">
              <Moon size={24} />
              <div className="theme-preview-lines"><span /><span /><span /></div>
            </div>
            <div className="theme-card-info">
              <b>{t('settings.appearance.obsidian')}</b>
              <small>{t('settings.appearance.obsidianDesc')}</small>
            </div>
            {theme === 'dark' && <span className="theme-check"><Check size={14} /></span>}
          </button>
          <button
            className={`theme-card theme-light-card ${theme === 'light' ? 'theme-active' : ''}`}
            onClick={() => applyTheme('light')}
          >
            <div className="theme-preview theme-preview-light">
              <Sun size={24} />
              <div className="theme-preview-lines"><span /><span /><span /></div>
            </div>
            <div className="theme-card-info">
              <b>{t('settings.appearance.titanium')}</b>
              <small>{t('settings.appearance.titaniumDesc')}</small>
            </div>
            {theme === 'light' && <span className="theme-check"><Check size={14} /></span>}
          </button>
        </div>
      </div>
    ),

    desktop: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><Monitor size={16} /></span>
          <div>
            <h2>{t('settings.desktop.title')}</h2>
            <p>{t('settings.desktop.desc')}</p>
          </div>
        </div>

        <div className="desktop-toggle-list">
          {/* 1. Auto Start */}
          <div className="desktop-toggle-row panel-subtle">
            <div className="desktop-toggle-info">
              <div className="desktop-toggle-title">
                <Monitor size={16} className="text-cyan" />
                <b>{t('settings.desktop.autoLaunchTitle')}</b>
              </div>
              <p>{t('settings.desktop.autoLaunchDesc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoStart}
              className={`toggle ${autoStart ? 'toggle-on' : ''}`}
              onClick={() => {
                const next = !autoStart;
                setAutoStart(next);
                notify(next ? (locale === 'ar' ? 'تم تفعيل التشغيل التلقائي مع الويندوز' : 'Auto-launch enabled') : (locale === 'ar' ? 'تم تعطيل التشغيل التلقائي' : 'Auto-launch disabled'));
              }}
              data-testid="toggle-pc-autostart"
            >
              <span />
            </button>
          </div>

          {/* 2. Run in Background */}
          <div className="desktop-toggle-row panel-subtle">
            <div className="desktop-toggle-info">
              <div className="desktop-toggle-title">
                <Cpu size={16} className="text-emerald-400" />
                <b>{t('settings.desktop.backgroundTitle')}</b>
              </div>
              <p>{t('settings.desktop.backgroundDesc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={runInBackground}
              className={`toggle ${runInBackground ? 'toggle-on' : ''}`}
              onClick={() => {
                const next = !runInBackground;
                setRunInBackground(next);
                notify(next ? (locale === 'ar' ? 'البرنامج سيبقى نشطاً في الخلفية (Tray)' : 'Background tray mode enabled') : (locale === 'ar' ? 'البرنامج سيغلق بالكامل عند الخروج' : 'Background tray mode disabled'));
              }}
              data-testid="toggle-pc-background"
            >
              <span />
            </button>
          </div>

          {/* 3. GPU Hardware Acceleration */}
          <div className="desktop-toggle-row panel-subtle">
            <div className="desktop-toggle-info">
              <div className="desktop-toggle-title">
                <Zap size={16} className="text-amber-400" />
                <b>{t('settings.desktop.hardwareTitle')}</b>
              </div>
              <p>{t('settings.desktop.hardwareDesc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={gpuAcceleration}
              className={`toggle ${gpuAcceleration ? 'toggle-on' : ''}`}
              onClick={() => {
                const next = !gpuAcceleration;
                setGpuAcceleration(next);
                notify(next ? (locale === 'ar' ? 'تم تفعيل تسريع كرت الشاشة GPU' : 'GPU acceleration enabled') : (locale === 'ar' ? 'تم إيقاف تسريع العتاد' : 'GPU acceleration disabled'));
              }}
              data-testid="toggle-pc-gpu"
            >
              <span />
            </button>
          </div>

          {/* 4. Global Hotkeys */}
          <div className="desktop-toggle-row panel-subtle">
            <div className="desktop-toggle-info">
              <div className="desktop-toggle-title">
                <HardDrive size={16} className="text-purple-400" />
                <b>{t('settings.desktop.globalHotkeysTitle')}</b>
              </div>
              <p>{t('settings.desktop.globalHotkeysDesc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={globalHotkeys}
              className={`toggle ${globalHotkeys ? 'toggle-on' : ''}`}
              onClick={() => {
                const next = !globalHotkeys;
                setGlobalHotkeys(next);
                notify(next ? (locale === 'ar' ? 'تم تفعيل اختصارات النظام العامة' : 'Global system hotkeys active') : (locale === 'ar' ? 'تم تعطيل الاختصارات العامة' : 'Global hotkeys disabled'));
              }}
              data-testid="toggle-pc-hotkeys"
            >
              <span />
            </button>
          </div>
        </div>
      </div>
    ),

    motion: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><Zap size={16} /></span>
          <div>
            <h2>{t('settings.motion.title')}</h2>
            <p>{t('settings.motion.desc')}</p>
          </div>
        </div>
        <div className="theme-cards">
          {/* Mode 1: Minimal */}
          <button
            className={`theme-card ${motionMode === 'minimal' ? 'theme-active' : ''}`}
            onClick={() => applyMotion('minimal')}
            data-testid="button-motion-minimal"
          >
            <div className="theme-preview theme-preview-dark">
              <div className="motion-preview-icon minimal-icon">
                <Zap size={22} className="text-cyan" />
              </div>
            </div>
            <div className="theme-card-info">
              <b>{t('settings.motion.minimal')}</b>
              <small>{t('settings.motion.minimalDesc')}</small>
            </div>
            {motionMode === 'minimal' && <span className="theme-check"><Check size={14} /></span>}
          </button>

          {/* Mode 2: Cinematic */}
          <button
            className={`theme-card ${motionMode === 'cinematic' ? 'theme-active' : ''}`}
            onClick={() => applyMotion('cinematic')}
            data-testid="button-motion-cinematic"
          >
            <div className="theme-preview theme-preview-dark">
              <div className="motion-preview-icon cinematic-icon">
                <span className="motion-ring" />
                <span className="motion-dot" />
              </div>
            </div>
            <div className="theme-card-info">
              <b>{t('settings.motion.cinematic')}</b>
              <small>{t('settings.motion.cinematicDesc')}</small>
            </div>
            {motionMode === 'cinematic' && <span className="theme-check"><Check size={14} /></span>}
          </button>
        </div>
      </div>
    ),

    data: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><HardDrive size={16} /></span>
          <div>
            <h2>{t('settings.data.title')}</h2>
            <p>{t('settings.data.desc')}</p>
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn btn-accent focus-ring" onClick={exportBackup}>
            <HardDrive size={14} />
            {t('settings.data.exportBackup')}
          </button>
        </div>

        <div
          className={`import-dropzone ${dragOver ? 'dropzone-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={24} />
          <b>{t('settings.data.dragDrop')}</b>
          <small>{t('settings.data.orBrowse')}</small>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="sr-only" />
        </div>

        <div className="settings-actions">
          <button className="btn btn-ghost text-destructive focus-ring" onClick={clearCache}>
            {t('settings.data.clearCache')}
          </button>
        </div>
      </div>
    ),

    privacy: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><Shield size={16} /></span>
          <div>
            <h2>{t('settings.privacy.title')}</h2>
            <p>{t('settings.privacy.desc')}</p>
          </div>
        </div>

        <div className="privacy-cards-grid">
          {/* 1. Isolation */}
          <div className="privacy-card panel-subtle">
            <div className="privacy-card-icon-wrap">
              <Lock size={18} className="text-cyan" />
            </div>
            <div className="privacy-card-content">
              <b>{t('settings.privacy.isolationTitle')}</b>
              <p>{t('settings.privacy.isolationDesc')}</p>
            </div>
          </div>

          {/* 2. Encryption */}
          <div className="privacy-card panel-subtle">
            <div className="privacy-card-icon-wrap">
              <ShieldCheck size={18} className="text-emerald-400" />
            </div>
            <div className="privacy-card-content">
              <b>{t('settings.privacy.encryptionTitle')}</b>
              <p>{t('settings.privacy.encryptionDesc')}</p>
            </div>
          </div>

          {/* 3. Zero Ads */}
          <div className="privacy-card panel-subtle">
            <div className="privacy-card-icon-wrap">
              <Eye size={18} className="text-purple-400" />
            </div>
            <div className="privacy-card-content">
              <b>{t('settings.privacy.noTrackingTitle')}</b>
              <p>{t('settings.privacy.noTrackingDesc')}</p>
            </div>
          </div>

          {/* 4. Full Portability */}
          <div className="privacy-card panel-subtle">
            <div className="privacy-card-icon-wrap">
              <HardDrive size={18} className="text-amber-400" />
            </div>
            <div className="privacy-card-content">
              <b>{t('settings.privacy.ownershipTitle')}</b>
              <p>{t('settings.privacy.ownershipDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    ),

    language: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><Globe size={16} /></span>
          <div>
            <h2>{t('settings.language.title')}</h2>
            <p>{t('settings.language.desc')}</p>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="settings-app-language">
            <span>{t('settings.language.appLanguage')}</span>
          </label>
          <select
            id="settings-app-language"
            value={pendingLocale}
            onChange={(e) => setPendingLocale(e.target.value as Locale)}
            className="settings-select"
          >
            <option value="en">{t('settings.language.english')}</option>
            <option value="ar">{t('settings.language.arabic')}</option>
          </select>
        </div>
        <div className="settings-actions">
          <button className="btn btn-accent focus-ring" onClick={handleSaveLocale}>
            <Check size={14} />
            {t('settings.language.saveApply')}
          </button>
        </div>
      </div>
    ),

    about: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><Info size={16} /></span>
          <div>
            <h2>{t('settings.about.title')}</h2>
            <p>{t('settings.about.desc')}</p>
          </div>
        </div>

        <div className="about-hero panel-subtle">
          <div className="about-hero-header">
            <img src="/logo.png" alt="CortexOS Logo" className="about-logo-img" />
            <div className="about-version-chip mono">
              <span className="pulse-dot-green" />
              <strong>{t('settings.about.version')}</strong>
            </div>
          </div>

          <div className="about-grid">
            <div className="about-item">
              <small>{t('settings.about.versionLabel')}</small>
              <b className="mono">0.2.10</b>
            </div>
            <div className="about-item">
              <small>{t('settings.about.channel')}</small>
              <b>{t('settings.about.channelValue')}</b>
            </div>
            <div className="about-item">
              <small>{t('settings.about.architecture')}</small>
              <b>{t('settings.about.architectureValue')}</b>
            </div>
            <div className="about-item">
              <small>{t('settings.about.cluster')}</small>
              <b>{t('settings.about.clusterValue')}</b>
            </div>
          </div>

          <div className="about-footer-status">
            <span className="tiny-led cyan" />
            <span>{t('settings.about.allNominal')}</span>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div>
      <div className="section-title">
        <div>
          <div className="eyebrow mono">{t('settings.eyebrow')}</div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav className="settings-tabs panel" aria-label="Settings tabs" role="tablist">
          {tabs.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              className={`settings-tab ${activeTab === id ? 'settings-tab-active' : ''}`}
              onClick={() => setActiveTab(id)}
              role="tab"
              aria-selected={activeTab === id}
            >
              <Icon size={16} />
              <span>{t(labelKey)}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </nav>
        <section className="settings-content" role="tabpanel">
          <div className="settings-tab-pane" key={activeTab}>
            {content[activeTab]}
          </div>
        </section>
      </div>
    </div>
  );
}
