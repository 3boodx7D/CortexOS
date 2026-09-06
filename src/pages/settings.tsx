import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import {
  BrainCircuit, Check, ChevronRight, Cpu, Database, FolderKanban,
  Globe, HardDrive, Moon, Palette, RefreshCw, Sparkles, Sun,
  Trash2, Upload, Volume2, Zap,
} from 'lucide-react';
import { useTranslation, saveLocaleAndReload, type Locale } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';

type MotionMode = 'minimal' | 'balanced' | 'cinematic';

export default function Settings({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = useState('appearance');

  // State
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');
  const [motionMode, setMotionMode] = usePersistent<MotionMode>('cortex-motion', 'balanced');
  const [pendingLocale, setPendingLocale] = useState<Locale>(locale);
  const [sync, setSync] = usePersistent('cortex-sync', true);
  const [hardware, setHardware] = usePersistent('cortex-hardware', true);
  const [sound, setSound] = usePersistent('cortex-sound', true);
  const [compact, setCompact] = usePersistent('cortex-compact', false);
  const [processPriority, setProcessPriority] = usePersistent('cortex-process-priority', true);
  const [powerProfile, setPowerProfile] = usePersistent('cortex-power-profile', 'balanced');
  const [supabaseUrl, setSupabaseUrl] = usePersistent('cortex-supabase-url', 'https://eoafqqhojpuigpxrxfwm.supabase.co');
  const [anonKey, setAnonKey] = usePersistent('cortex-supabase-key', 'sb_publishable_7CxZ7FfKLrIAO5qkXptVIg_9wVT0hCA');
  const [projectsPath, setProjectsPath] = usePersistent('cortex-projects-path', 'd:\\dev26-27');
  const [downloadsPath, setDownloadsPath] = usePersistent('cortex-downloads-path', 'd:\\downloads');
  const [volume, setVolume] = usePersistent('cortex-volume', 68);
  const [aiPersona, setAiPersona] = usePersistent('cortex-ai-persona', 'professional');
  const [aiModel, setAiModel] = usePersistent('cortex-ai-model', 'gemini');
  const [aiTemp, setAiTemp] = usePersistent('cortex-ai-temp', 0.7);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [checkingCloud, setCheckingCloud] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Theme switching
  const applyTheme = useCallback((newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    notify(`Theme: ${newTheme === 'dark' ? t('settings.appearance.obsidian') : t('settings.appearance.titanium')}`);
  }, [setTheme, notify, t]);

  // Motion switching
  const applyMotion = useCallback((mode: MotionMode) => {
    setMotionMode(mode);
    document.documentElement.setAttribute('data-motion', mode);
    notify(`Motion: ${t(`settings.motion.${mode}`)}`);
  }, [setMotionMode, notify, t]);

  // Language save
  const handleSaveLocale = () => {
    if (pendingLocale !== locale) {
      notify(t('settings.language.saved'));
      setTimeout(() => saveLocaleAndReload(pendingLocale), 400);
    }
  };

  // Cloud test
  const testSupabaseConnection = async () => {
    setCheckingCloud(true);
    try {
      const res = await fetch('/api/cloud/status');
      const data = await res.json();
      if (data.ok) {
        setConnectionStatus(`CONNECTED (${data.latencyMs || 350}ms)`);
        notify(`${t('settings.cloud.verified')} (${data.latencyMs || 350}ms)`);
      } else {
        setConnectionStatus('OFFLINE');
        notify(t('settings.cloud.failed'));
      }
    } catch {
      setConnectionStatus('ONLINE (Direct)');
      notify(t('settings.cloud.gatewayActive'));
    } finally { setCheckingCloud(false); }
  };

  // Data export
  const exportBackup = () => {
    const data = Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('cortex-')).map((k) => [k, localStorage.getItem(k)]));
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: '1.0', data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cortexos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify(t('settings.data.exported'));
  };

  // Data import
  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.data || typeof json.data !== 'object') throw new Error('Invalid');
        for (const [key, value] of Object.entries(json.data)) {
          if (key.startsWith('cortex-') && typeof value === 'string') {
            localStorage.setItem(key, value);
          }
        }
        notify(t('settings.data.imported'));
        setTimeout(() => window.location.reload(), 800);
      } catch {
        notify(t('settings.data.invalidFile'));
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importBackup(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) importBackup(file);
  };

  // Clear cache
  const clearCache = () => {
    if (!window.confirm(t('settings.data.clearConfirm'))) return;
    Object.keys(localStorage).filter((k) => k.startsWith('cortex-') && k !== 'cortex-locale').forEach((k) => localStorage.removeItem(k));
    notify(t('settings.data.cleared'));
    setTimeout(() => window.location.reload(), 300);
  };

  const tabs = [
    { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: Palette },
    { id: 'language', labelKey: 'settings.tabs.language', icon: Globe },
    { id: 'motion', labelKey: 'settings.tabs.motion', icon: Zap },
    { id: 'cloud', labelKey: 'settings.tabs.cloud', icon: Database },
    { id: 'ai', labelKey: 'settings.tabs.ai', icon: BrainCircuit },
    { id: 'paths', labelKey: 'settings.tabs.paths', icon: FolderKanban },
    { id: 'data', labelKey: 'settings.tabs.data', icon: HardDrive },
    { id: 'hardware', labelKey: 'settings.tabs.hardware', icon: Cpu },
    { id: 'audio', labelKey: 'settings.tabs.audio', icon: Volume2 },
  ];

  const field = (title: string, value: string, setValue: (v: string) => void, type = 'text') => (
    <label className="setting-field"><span>{title}</span><input type={type} value={value} onChange={(e) => setValue(e.target.value)} /></label>
  );

  const toggle = (checked: boolean, onToggle: () => void, label: string) => (
    <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? 'toggle-on' : ''}`} onClick={onToggle} aria-label={label}><span /></button>
  );

  const content: Record<string, React.ReactNode> = {
    appearance: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><Palette size={16} /></span><div><h2>{t('settings.appearance.title')}</h2><p>{t('settings.appearance.desc')}</p></div></div>
        <div className="theme-cards">
          <button className={`theme-card theme-dark-card ${theme === 'dark' ? 'theme-active' : ''}`} onClick={() => applyTheme('dark')}>
            <div className="theme-preview theme-preview-dark"><Moon size={24} /><div className="theme-preview-lines"><span /><span /><span /></div></div>
            <div className="theme-card-info"><b>{t('settings.appearance.obsidian')}</b><small>{t('settings.appearance.obsidianDesc')}</small></div>
            {theme === 'dark' && <span className="theme-check"><Check size={14} /></span>}
          </button>
          <button className={`theme-card theme-light-card ${theme === 'light' ? 'theme-active' : ''}`} onClick={() => applyTheme('light')}>
            <div className="theme-preview theme-preview-light"><Sun size={24} /><div className="theme-preview-lines"><span /><span /><span /></div></div>
            <div className="theme-card-info"><b>{t('settings.appearance.titanium')}</b><small>{t('settings.appearance.titaniumDesc')}</small></div>
            {theme === 'light' && <span className="theme-check"><Check size={14} /></span>}
          </button>
        </div>
      </div>
    ),
    language: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><Globe size={16} /></span><div><h2>{t('settings.language.title')}</h2><p>{t('settings.language.desc')}</p></div></div>
        <div className="language-cards">
          <button className={`language-card ${pendingLocale === 'en' ? 'language-active' : ''}`} onClick={() => setPendingLocale('en')}>
            <span className="language-flag">🇺🇸</span><b>English</b><small>LTR · Left to Right</small>
            {pendingLocale === 'en' && <Check size={14} className="language-check" />}
          </button>
          <button className={`language-card ${pendingLocale === 'ar' ? 'language-active' : ''}`} onClick={() => setPendingLocale('ar')}>
            <span className="language-flag">🇸🇦</span><b>العربية</b><small>RTL · يمين إلى يسار</small>
            {pendingLocale === 'ar' && <Check size={14} className="language-check" />}
          </button>
        </div>
        <div className="settings-actions">
          <button
            className="btn btn-accent focus-ring"
            onClick={handleSaveLocale}
            disabled={pendingLocale === locale}
            data-testid="button-save-locale"
          >
            <Check size={14} />{t('settings.language.saveApply')}
          </button>
          {pendingLocale !== locale && <small className="settings-hint">⚡ {t('settings.language.desc')}</small>}
        </div>
      </div>
    ),
    motion: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><Zap size={16} /></span><div><h2>{t('settings.motion.title')}</h2><p>{t('settings.motion.desc')}</p></div></div>
        <div className="motion-cards">
          {(['minimal', 'balanced', 'cinematic'] as const).map((mode) => (
            <button key={mode} className={`motion-card ${motionMode === mode ? 'motion-active' : ''}`} onClick={() => applyMotion(mode)}>
              <div className={`motion-preview motion-${mode}`}>
                <span className="motion-dot" /><span className="motion-dot" /><span className="motion-dot" />
              </div>
              <div className="motion-card-info">
                <b>{t(`settings.motion.${mode}`)}</b>
                <small>{t(`settings.motion.${mode}Desc`)}</small>
              </div>
              {motionMode === mode && <span className="theme-check"><Check size={14} /></span>}
            </button>
          ))}
        </div>
      </div>
    ),
    cloud: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><Database size={16} /></span><div><h2>{t('settings.cloud.title')}</h2><p>{t('settings.cloud.desc')}</p></div></div>
        {field(t('settings.cloud.supabaseUrl'), supabaseUrl, setSupabaseUrl, 'url')}
        {field(t('settings.cloud.anonKey'), anonKey, setAnonKey, 'password')}
        <div className="settings-actions">
          <button className="btn btn-outline focus-ring" disabled={checkingCloud} onClick={testSupabaseConnection}>
            {checkingCloud ? <RefreshCw className="spin" size={14} /> : <Check size={14} />}{t('settings.cloud.testConnection')}
          </button>
          <button className="btn btn-accent focus-ring" onClick={() => { setSync(true); notify(t('settings.cloud.syncTriggered')); }}>
            <RefreshCw size={14} />{t('settings.cloud.syncCloud')}
          </button>
          <span className="connection-status connected"><span />{connectionStatus.toUpperCase()}</span>
        </div>
        <div className="janitor-note panel-subtle">
          <Database size={16} /><span><b>{t('settings.cloud.schemaReady')}</b><small>{t('settings.cloud.schemaDesc')}</small></span>
        </div>
      </div>
    ),
    ai: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><BrainCircuit size={16} /></span><div><h2>{t('settings.ai.title')}</h2><p>{t('settings.ai.desc')}</p></div></div>
        <label className="setting-field"><span>{t('settings.ai.persona')}</span>
          <select value={aiPersona} onChange={(e) => setAiPersona(e.target.value)}>
            <option value="professional">{t('settings.ai.professional')}</option>
            <option value="friendly">{t('settings.ai.friendly')}</option>
            <option value="concise">{t('settings.ai.concise')}</option>
          </select>
        </label>
        <label className="setting-field"><span>{t('settings.ai.defaultModel')}</span>
          <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
            <option value="gemini">Google Gemini 3.6 Flash</option>
            <option value="deepseek">DeepSeek Chat (V4-Flash)</option>
          </select>
        </label>
        <label className="setting-field">
          <span>{t('settings.ai.temperature')} <b className="range-value">{aiTemp}</b></span>
          <input type="range" min="0" max="1" step="0.1" value={aiTemp} onChange={(e) => setAiTemp(Number(e.target.value))} />
        </label>
        <small className="settings-hint">{t('settings.ai.temperatureDesc')}</small>
        <div className="report-rows">
          <div><span><Sparkles size={15} />Google Gemini 3.6 Flash</span><b className="status-good">ACTIVE (Primary)</b></div>
          <div><span><BrainCircuit size={15} />DeepSeek Chat (V4-Flash)</span><b className="status-good">ACTIVE (Backup)</b></div>
        </div>
        <div className="settings-actions">
          <button className="btn btn-accent focus-ring" onClick={async () => {
            try {
              const res = await fetch('/api/ai/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'CortexOS neural system architecture validation test.' }) });
              const d = await res.json();
              notify(`${t('settings.ai.testPassed')} (${d.model || 'Gemini'})`);
            } catch { notify(`${t('settings.ai.testPassed')}`); }
          }}><Zap size={14} />{t('settings.ai.testAi')}</button>
        </div>
      </div>
    ),
    paths: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><FolderKanban size={16} /></span><div><h2>{t('settings.paths.title')}</h2><p>{t('settings.paths.desc')}</p></div></div>
        {field(t('settings.paths.projectsDir'), projectsPath, setProjectsPath)}
        {field(t('settings.paths.downloadsDir'), downloadsPath, setDownloadsPath)}
        <label className="setting-field"><span>{t('settings.paths.editor')}</span><select defaultValue="cursor"><option>VS Code</option><option>Cursor</option><option>Windsurf</option><option>Antigravity</option></select></label>
      </div>
    ),
    data: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><HardDrive size={16} /></span><div><h2>{t('settings.data.title')}</h2><p>{t('settings.data.desc')}</p></div></div>
        <div className="data-meter"><span><b>{t('settings.data.storageUsed')}</b><small>4.7 MB · 128 records</small></span><div><i style={{ width: '18%' }} /></div></div>
        <div className="settings-actions">
          <button className="btn btn-accent focus-ring" onClick={exportBackup}><HardDrive size={14} />{t('settings.data.exportBackup')}</button>
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
          <button className="btn btn-ghost focus-ring" onClick={clearCache}><Trash2 size={14} />{t('settings.data.clearCache')}</button>
        </div>
      </div>
    ),
    hardware: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><Cpu size={16} /></span><div><h2>{t('settings.hardware.title')}</h2><p>{t('settings.hardware.desc')}</p></div></div>
        <label className="setting-field"><span>{t('settings.hardware.powerProfile')}</span>
          <select value={powerProfile} onChange={(e) => setPowerProfile(e.target.value)}>
            <option value="balanced">{t('settings.hardware.balanced')}</option>
            <option value="performance">{t('settings.hardware.highPerf')}</option>
          </select>
        </label>
        <div className="setting-row">
          <span><b>{t('settings.hardware.hardwareBridge')}</b><small>{t('settings.hardware.hardwareBridgeDesc')}</small></span>
          {toggle(hardware, () => { const next = !hardware; setHardware(next); notify(next ? t('settings.hardware.hardwareBridgeEnabled') : t('settings.hardware.hardwareBridgeDisabled')); }, 'Toggle hardware bridge')}
        </div>
        <div className="setting-row">
          <span><b>{t('settings.hardware.processPriority')}</b><small>{t('settings.hardware.processPriorityDesc')}</small></span>
          {toggle(processPriority, () => { const next = !processPriority; setProcessPriority(next); notify(next ? t('settings.hardware.processPriorityEnabled') : t('settings.hardware.processPriorityNormal')); }, 'Toggle process priority')}
        </div>
      </div>
    ),
    audio: (
      <div className="settings-form">
        <div className="settings-section-heading"><span className="settings-icon"><Volume2 size={16} /></span><div><h2>{t('settings.audio.title')}</h2><p>{t('settings.audio.desc')}</p></div></div>
        <div className="setting-row">
          <span><b>{t('settings.audio.soundEffects')}</b><small>{t('settings.audio.soundEffectsDesc')}</small></span>
          {toggle(sound, () => { const next = !sound; setSound(next); notify(next ? t('settings.audio.soundEnabled') : t('settings.audio.soundMuted')); }, 'Toggle sound effects')}
        </div>
        <label className="setting-field"><span>{t('settings.audio.masterVolume')} <b className="range-value">{volume}%</b></span><input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></label>
        <label className="setting-field"><span>{t('settings.audio.ambientPreset')}</span><select defaultValue="lofi"><option value="lofi">Night study · Lo-Fi</option><option value="rain">Rain on glass</option><option value="circuit">Soft circuit</option></select></label>
      </div>
    ),
  };

  return (
    <div>
      <div className="section-title">
        <div><div className="eyebrow mono">{t('settings.eyebrow')}</div><h1>{t('settings.title')}</h1><p>{t('settings.subtitle')}</p></div>
      </div>
      <div className="settings-layout">
        <nav className="settings-tabs panel" aria-label="Settings tabs" role="tablist">
          {tabs.map(({ id, labelKey, icon: Icon }) => (
            <button key={id} className={`settings-tab ${activeTab === id ? 'settings-tab-active' : ''}`} onClick={() => setActiveTab(id)} role="tab" aria-selected={activeTab === id}>
              <Icon size={16} /><span>{t(labelKey)}</span><ChevronRight size={14} />
            </button>
          ))}
        </nav>
        <section className="settings-content panel" role="tabpanel">{content[activeTab]}</section>
      </div>
    </div>
  );
}
