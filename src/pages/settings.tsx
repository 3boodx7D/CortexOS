import { type ChangeEvent, useCallback, useRef, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Check, ChevronRight, Cpu, Crown, Eye, EyeOff,
  HardDrive, Info, KeyRound, Lock, LogOut, Monitor, Moon, Palette, RefreshCw, Save, Shield, ShieldCheck, Sun,
  Upload, User as UserIcon, Zap, Globe, Sparkles, FolderKanban, Folder, FolderSearch, Camera, Trash2, Copy,
  Code2, Terminal, BrainCircuit, Layers
} from 'lucide-react';
import { useTranslation, type Locale } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { useUserContext } from '@/lib/user-store';
import { useDesktopDialog } from '@/components/ui/desktop-dialog';
import { pickDirectory } from '@/lib/tauri';
import { AccountSettingsTab } from '@/components/settings/account-settings-tab';

export type MotionMode = 'minimal' | 'cinematic';

export default function Settings({ notify }: { notify: (msg: string) => void }) {
  const [, setLocation] = useLocation();
  const { t, locale, setLocale } = useTranslation();
  const { confirmDialog } = useDesktopDialog();
  const {
    userId,
    syncAllToCloud,
  } = useUserContext();

  const [activeTab, setActiveTab] = useState<'desktop' | 'account' | 'data' | 'privacy' | 'about'>('desktop');
  const [workspacePath, setWorkspacePath] = usePersistent<string>('cortex-workspace-path', 'D:\\dev26-27');
  const [isBrowsingWorkspace, setIsBrowsingWorkspace] = useState(false);

  // Desktop App (PC) Local-Only settings (stored in localStorage per machine)
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');
  const [motionMode, setMotionMode] = usePersistent<MotionMode>('cortex-motion', 'cinematic');
  const [autoStart, setAutoStart] = usePersistent<boolean>('cortex-pc-autostart', true);
  const [runInBackground, setRunInBackground] = usePersistent<boolean>('cortex-pc-background', true);
  const [gpuAcceleration, setGpuAcceleration] = usePersistent<boolean>('cortex-pc-gpu', true);
  const [globalHotkeys, setGlobalHotkeys] = usePersistent<boolean>('cortex-pc-hotkeys', true);

  // Projects Vault & Dev Engine Settings
  const [defaultIde, setDefaultIde] = usePersistent<string>('cortex-default-ide', 'antigravity');
  const [customIdes, setCustomIdes] = usePersistent<Array<{ id: string; name: string; command: string }>>(
    'cortex-custom-ide-commands',
    [
      { id: 'antigravity', name: 'Google Antigravity', command: 'antigravity .' },
      { id: 'cursor', name: 'Cursor AI', command: 'cursor .' },
      { id: 'code', name: 'Visual Studio Code', command: 'code .' },
      { id: 'windsurf', name: 'Windsurf', command: 'windsurf .' },
      { id: 'webstorm', name: 'JetBrains WebStorm', command: 'webstorm .' },
      { id: 'pycharm', name: 'PyCharm', command: 'pycharm .' },
      { id: 'subl', name: 'Sublime Text', command: 'subl .' },
    ]
  );
  const [newIdeName, setNewIdeName] = useState('');
  const [newIdeCommand, setNewIdeCommand] = useState('');
  const [showAddIde, setShowAddIde] = useState(false);
  const [autoScanProjects, setAutoScanProjects] = usePersistent<boolean>('cortex-autoscan-projects', true);
  const [confirmCleanCache, setConfirmCleanCache] = usePersistent<boolean>('cortex-confirm-clean-cache', true);

  // Study Hub AI Settings
  const [studyAiModel, setStudyAiModel] = usePersistent<'auto' | 'gemini-lite' | 'gemini-pro' | 'deepseek'>('cortex-study-ai-model', 'auto');
  const [autoGenerateQuiz, setAutoGenerateQuiz] = usePersistent<boolean>('cortex-study-auto-quiz', true);
  const [autoGenerateFlashcards, setAutoGenerateFlashcards] = usePersistent<boolean>('cortex-study-auto-flashcards', true);

  // Backup & Restore System
  const [backupDir, setBackupDir] = usePersistent<string>('cortex-backup-dir', 'D:\\CortexOS_Backups');
  const [isBrowsingBackupDir, setIsBrowsingBackupDir] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [diskBackups, setDiskBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Backup files
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleBrowseWorkspace = async () => {
    setIsBrowsingWorkspace(true);
    try {
      const selected = await pickDirectory();
      if (selected) {
        setWorkspacePath(selected);
        notify(locale === 'ar' ? `تم تحديد مسار المشاريع: ${selected}` : `Workspace path set to: ${selected}`);
      }
    } finally {
      setIsBrowsingWorkspace(false);
    }
  };

  const handleAddCustomIde = () => {
    if (!newIdeName.trim() || !newIdeCommand.trim()) return;
    const id = newIdeName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const created = {
      id,
      name: newIdeName.trim(),
      command: newIdeCommand.trim(),
    };
    setCustomIdes([...customIdes, created]);
    setNewIdeName('');
    setNewIdeCommand('');
    setShowAddIde(false);
    notify(locale === 'ar' ? `تمت إضافة المحرر: ${created.name}` : `Added custom IDE: ${created.name}`);
  };

  const handleRemoveCustomIde = (id: string) => {
    setCustomIdes(customIdes.filter((item) => item.id !== id));
    if (defaultIde === id) {
      setDefaultIde('antigravity');
    }
    notify(locale === 'ar' ? 'تم حذف المحرر المخصص' : 'Custom IDE removed');
  };

  const handleOpenBackupDir = async () => {
    try {
      await fetch('/api/projects/backup/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup_dir: backupDir }),
      });
    } catch {
      // silent
    }
  };

  // Theme switching (Local to this PC)
  const applyTheme = useCallback((newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [setTheme]);

  // Motion switching (Local to this PC)
  const applyMotion = useCallback((mode: MotionMode) => {
    setMotionMode(mode);
    document.documentElement.setAttribute('data-motion', mode);
  }, [setMotionMode]);

  // Language switching (Seamless In-Place Transition - No Reload)
  const handleSelectLanguage = (newLang: Locale) => {
    if (newLang !== locale) {
      setLocale(newLang);
    }
  };


  // Backup Snapshot Management
  const fetchDiskBackups = useCallback(async (dir?: string) => {
    const target = dir || backupDir;
    if (!target) return;
    setLoadingBackups(true);
    try {
      const res = await fetch(`/api/system/backup/list?dir=${encodeURIComponent(target)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.backups)) {
          setDiskBackups(data.backups);
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingBackups(false);
    }
  }, [backupDir]);

  useEffect(() => {
    if (activeTab === 'data') {
      fetchDiskBackups();
    }
  }, [activeTab, fetchDiskBackups]);

  const handleBrowseBackupDir = async () => {
    setIsBrowsingBackupDir(true);
    try {
      const selected = await pickDirectory();
      if (selected) {
        setBackupDir(selected);
        fetchDiskBackups(selected);
        notify(locale === 'ar' ? `مجلد النسخ الاحتياطية: ${selected}` : `Backup directory set: ${selected}`);
      }
    } finally {
      setIsBrowsingBackupDir(false);
    }
  };

  const handleCreateDiskBackup = async () => {
    setCreatingBackup(true);
    try {
      const dump: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          try {
            dump[k] = JSON.parse(localStorage.getItem(k) || 'null');
          } catch {
            dump[k] = localStorage.getItem(k);
          }
        }
      }

      const res = await fetch('/api/system/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup_dir: backupDir, data: dump }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          notify(locale === 'ar' ? `تم حفظ النسخة الاحتياطية: ${data.filename}` : `Backup saved: ${data.filename}`);
          fetchDiskBackups();
        } else {
          notify(data.error || 'Failed to save backup');
        }
      }
    } catch {
      notify('Backup creation failed');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreDiskBackup = async (filePath: string) => {
    const ok = await confirmDialog({
      title: locale === 'ar' ? 'تأكيد استعادة النسخة الاحتياطية' : 'Confirm Backup Restoration',
      message: t('settings.data.confirmRestore'),
      confirmText: locale === 'ar' ? 'نعم، استعادة الآن' : 'Restore Now',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      isDanger: true,
    });

    if (!ok) return;

    try {
      const res = await fetch('/api/system/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.ok && result.data) {
          const payload = result.data;
          Object.keys(payload).forEach((k) => {
            const v = payload[k];
            localStorage.setItem(k, typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v));
          });
          notify(t('settings.data.restoredSuccess'));
          setTimeout(() => window.location.reload(), 800);
        }
      }
    } catch {
      notify('Restoration failed');
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
      [JSON.stringify({ exportedAt: new Date().toISOString(), version: '0.3.12', userId, data }, null, 2)],
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
        notify(t('settings.data.invalidFile'));
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

  const clearCache = async () => {
    const confirmed = await confirmDialog({
      title: locale === 'ar' ? 'إعادة ضبط بيانات CortexOS؟' : 'Reset CortexOS Data?',
      message: t('settings.data.clearConfirm'),
      confirmText: locale === 'ar' ? 'مسح وإعادة ضبط' : 'Reset Everything',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;
    const themeVal = localStorage.getItem('cortex-theme');
    const langVal = localStorage.getItem('cortex-locale');
    localStorage.clear();
    if (themeVal) localStorage.setItem('cortex-theme', themeVal);
    if (langVal) localStorage.setItem('cortex-locale', langVal);
    localStorage.setItem('cortex-onboarding-done', 'false');
    notify(t('settings.data.cleared'));
    setTimeout(() => window.location.reload(), 300);
  };

  // Curated 5 logical tabs: Desktop (System/Interface) first, then Account, Data, Privacy, About
  const tabs = [
    { id: 'desktop', labelKey: 'settings.tabs.desktop', icon: Monitor },
    { id: 'account', labelKey: 'settings.tabs.account', icon: UserIcon },
    { id: 'data', labelKey: 'settings.tabs.data', icon: HardDrive },
    { id: 'privacy', labelKey: 'settings.tabs.privacy', icon: Shield },
    { id: 'about', labelKey: 'settings.tabs.about', icon: Info },
  ] as const;

  const content: Record<typeof tabs[number]['id'], React.ReactNode> = {
    account: <AccountSettingsTab notify={notify} />,

    desktop: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><Monitor size={16} /></span>
          <div>
            <h2>{t('settings.desktop.title')}</h2>
            <p>{t('settings.desktop.desc')}</p>
          </div>
        </div>

        {/* 1. Language Selection (Top Priority) */}
        <div className="desktop-settings-group">
          <div className="group-header">
            <Globe size={16} className="text-cyan" />
            <div>
              <b>{t('settings.desktop.languageSection')}</b>
              <small className="block text-muted-foreground">{t('settings.desktop.languageDesc')}</small>
            </div>
          </div>
          <div className="pref-grid">
            <button
              type="button"
              className={`pref-card ${locale === 'ar' ? 'pref-card-active' : ''}`}
              onClick={() => handleSelectLanguage('ar')}
              data-testid="button-lang-ar"
            >
              <div className="pref-icon-box">🇸🇦</div>
              <div className="pref-content">
                <b>العربية</b>
                <small className="mono">Arabic (RTL) · واجهة عربية كاملة</small>
              </div>
              {locale === 'ar' && <span className="pref-check-badge"><Check size={12} strokeWidth={3} /></span>}
            </button>
            <button
              type="button"
              className={`pref-card ${locale === 'en' ? 'pref-card-active' : ''}`}
              onClick={() => handleSelectLanguage('en')}
              data-testid="button-lang-en"
            >
              <div className="pref-icon-box">🇺🇸</div>
              <div className="pref-content">
                <b>English</b>
                <small className="mono">English (LTR) · Left-to-right</small>
              </div>
              {locale === 'en' && <span className="pref-check-badge"><Check size={12} strokeWidth={3} /></span>}
            </button>
          </div>
        </div>

        {/* 2. Theme Selection Cards (Local to PC) */}
        <div className="desktop-settings-group">
          <div className="group-header">
            <Palette size={16} className="text-purple-400" />
            <div>
              <b>{t('settings.desktop.themeSection')}</b>
              <small className="block text-muted-foreground">{t('settings.desktop.themeDesc')}</small>
            </div>
          </div>
          <div className="pref-grid">
            <button
              type="button"
              className={`pref-card ${theme === 'dark' ? 'pref-card-active' : ''}`}
              onClick={() => applyTheme('dark')}
              data-testid="button-theme-dark"
            >
              <div className="pref-icon-box">
                <Moon size={20} className="text-cyan" />
              </div>
              <div className="pref-content">
                <b>{t('settings.desktop.obsidian')}</b>
                <small>{t('settings.desktop.obsidianDesc')}</small>
              </div>
              {theme === 'dark' && <span className="pref-check-badge"><Check size={12} strokeWidth={3} /></span>}
            </button>
            <button
              type="button"
              className={`pref-card ${theme === 'light' ? 'pref-card-active' : ''}`}
              onClick={() => applyTheme('light')}
              data-testid="button-theme-light"
            >
              <div className="pref-icon-box">
                <Sun size={20} className="text-amber-400" />
              </div>
              <div className="pref-content">
                <b>{t('settings.desktop.titanium')}</b>
                <small>{t('settings.desktop.titaniumDesc')}</small>
              </div>
              {theme === 'light' && <span className="pref-check-badge"><Check size={12} strokeWidth={3} /></span>}
            </button>
          </div>
        </div>

        {/* 3. Motion & Animation */}
        <div className="desktop-settings-group">
          <div className="group-header">
            <Zap size={16} className="text-amber-400" />
            <div>
              <b>{t('settings.desktop.motionSection')}</b>
              <small className="block text-muted-foreground">{t('settings.desktop.motionDesc')}</small>
            </div>
          </div>
          <div className="pref-grid">
            <button
              type="button"
              className={`pref-card ${motionMode === 'minimal' ? 'pref-card-active' : ''}`}
              onClick={() => applyMotion('minimal')}
              data-testid="button-motion-minimal"
            >
              <div className="pref-icon-box">
                <Zap size={20} className="text-cyan" />
              </div>
              <div className="pref-content">
                <b>{t('settings.desktop.minimal')}</b>
                <small>{t('settings.desktop.minimalDesc')}</small>
              </div>
              {motionMode === 'minimal' && <span className="pref-check-badge"><Check size={12} strokeWidth={3} /></span>}
            </button>
            <button
              type="button"
              className={`pref-card ${motionMode === 'cinematic' ? 'pref-card-active' : ''}`}
              onClick={() => applyMotion('cinematic')}
              data-testid="button-motion-cinematic"
            >
              <div className="pref-icon-box">
                <Sparkles size={20} className="text-amber-400" />
              </div>
              <div className="pref-content">
                <b>{t('settings.desktop.cinematic')}</b>
                <small>{t('settings.desktop.cinematicDesc')}</small>
              </div>
              {motionMode === 'cinematic' && <span className="pref-check-badge"><Check size={12} strokeWidth={3} /></span>}
            </button>
          </div>
        </div>

        {/* 4. Workspace & Projects Directory */}
        <div className="desktop-settings-group">
          <div className="group-header">
            <FolderKanban size={16} className="text-cyan" />
            <div>
              <b>{t('settings.desktop.workspaceSection')}</b>
              <small className="block text-muted-foreground">{t('settings.desktop.workspaceDesc')}</small>
            </div>
          </div>
          <div className="panel-subtle p-4 rounded-xl border border-border flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Folder size={18} className="text-cyan shrink-0" />
              <input
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="e.g. C:\Projects"
                className="editable-input flex-1 mono text-xs"
              />
              <button
                type="button"
                onClick={handleBrowseWorkspace}
                disabled={isBrowsingWorkspace}
                className="btn btn-primary text-xs h-[42px] px-3 gap-1.5 shrink-0 focus-ring"
              >
                <FolderSearch size={15} />
                <span>{isBrowsingWorkspace ? (locale === 'ar' ? 'جارٍ الفتح...' : 'Opening...') : (locale === 'ar' ? 'استعراض...' : 'Browse...')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5. Development & Projects Vault Engine */}
        <div className="desktop-settings-group">
          <div className="group-header">
            <Code2 size={16} className="text-cyan" />
            <div>
              <b>{t('settings.desktop.devSection')}</b>
              <small className="block text-muted-foreground">{t('settings.desktop.devSectionDesc')}</small>
            </div>
          </div>
          
          {/* Preferred IDE: Single Sleek Box / Dropdown */}
          <div className="panel-subtle p-4 rounded-xl border border-border flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan shrink-0">
                  <Code2 size={18} />
                </div>
                <div>
                  <b className="text-xs font-semibold block">{t('settings.desktop.defaultIdeTitle')}</b>
                  <p className="text-[11px] text-muted-foreground">{t('settings.desktop.defaultIdeDesc')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={defaultIde}
                  onChange={(e) => {
                    setDefaultIde(e.target.value);
                    notify(locale === 'ar' ? `المحرر المختار: ${e.target.value}` : `Selected IDE: ${e.target.value}`);
                  }}
                  className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus-ring cursor-pointer hover:border-cyan transition-all min-w-[200px]"
                >
                  {customIdes.map((item) => (
                    <option key={item.id} value={item.id} className="bg-black text-white">
                      💻 {item.name} ({item.command})
                    </option>
                  ))}
                  <option value="explorer" className="bg-black text-white">📁 Windows Explorer</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowAddIde(!showAddIde)}
                  className="btn btn-outline text-xs h-[36px] px-3 font-mono"
                >
                  {showAddIde ? (locale === 'ar' ? 'إغلاق' : 'Close') : (locale === 'ar' ? '+ محرر مخصص' : '+ Custom IDE')}
                </button>
              </div>
            </div>

            {/* Custom IDE Commands Expansion Panel */}
            {showAddIde && (
              <div className="mt-3 p-4 rounded-lg bg-black/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Terminal size={14} className="text-cyan" />
                    <span>{locale === 'ar' ? 'أوامر تشغيل المحررات المخصصة' : 'Configure Custom IDE Commands'}</span>
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {locale === 'ar' ? 'مثال: cursor . أو code -n .' : 'e.g. cursor . or code -n .'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={newIdeName}
                    onChange={(e) => setNewIdeName(e.target.value)}
                    placeholder={locale === 'ar' ? 'اسم المحرر (مثال: Zed Editor)' : 'IDE Name (e.g. Zed Editor)'}
                    className="sm:col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newIdeCommand}
                    onChange={(e) => setNewIdeCommand(e.target.value)}
                    placeholder={locale === 'ar' ? 'الأمر التنفيذي (مثال: zed .)' : 'Shell Command (e.g. zed .)'}
                    className="sm:col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-400 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomIde}
                    disabled={!newIdeName.trim() || !newIdeCommand.trim()}
                    className="sm:col-span-2 btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2 px-3 rounded-lg transition disabled:opacity-50"
                  >
                    {locale === 'ar' ? 'إضافة' : 'Add'}
                  </button>
                </div>

                {/* List of current configured IDE commands */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                  {customIdes.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded bg-zinc-900/50 border border-zinc-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{item.name}</span>
                        <code className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          {item.command}
                        </code>
                      </div>

                      {item.id !== 'antigravity' && item.id !== 'code' && item.id !== 'cursor' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomIde(item.id)}
                          className="text-zinc-500 hover:text-rose-400 text-xs transition"
                        >
                          {locale === 'ar' ? 'حذف' : 'Delete'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dev Toggles */}
          <div className="desktop-toggle-list">
            <div className="desktop-toggle-row panel-subtle">
              <div className="desktop-toggle-info">
                <div className="desktop-toggle-title">
                  <RefreshCw size={15} className="text-cyan" />
                  <b>{t('settings.desktop.autoScanTitle')}</b>
                </div>
                <p>{t('settings.desktop.autoScanDesc')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoScanProjects}
                className={`toggle ${autoScanProjects ? 'toggle-on' : ''}`}
                onClick={() => setAutoScanProjects(!autoScanProjects)}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="desktop-toggle-row panel-subtle">
              <div className="desktop-toggle-info">
                <div className="desktop-toggle-title">
                  <Trash2 size={15} className="text-cyan" />
                  <b>{t('settings.desktop.confirmCleanTitle')}</b>
                </div>
                <p>{t('settings.desktop.confirmCleanDesc')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={confirmCleanCache}
                className={`toggle ${confirmCleanCache ? 'toggle-on' : ''}`}
                onClick={() => setConfirmCleanCache(!confirmCleanCache)}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>

          {/* Study Hub AI Settings */}
          <div className="panel-subtle p-4 rounded-xl border border-border flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-purple-400 shrink-0">
                <BrainCircuit size={18} />
              </div>
              <div>
                <b className="text-xs font-semibold block">{t('settings.desktop.studyAiTitle')}</b>
                <p className="text-[11px] text-muted-foreground">{t('settings.desktop.studyAiDesc')}</p>
              </div>
            </div>

            <div className="relative min-w-[200px]">
              <select
                value={studyAiModel}
                onChange={(e) => {
                  setStudyAiModel(e.target.value as any);
                  notify(locale === 'ar' ? `نموذج دراسة الذكاء الاصطناعي: ${e.target.value}` : `Study AI model: ${e.target.value}`);
                }}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus-ring cursor-pointer hover:border-cyan transition-all"
              >
                <option value="auto" className="bg-black text-white">{t('settings.desktop.studyAiAuto')}</option>
                <option value="gemini-lite" className="bg-black text-white">{t('settings.desktop.studyAiGeminiLite')}</option>
                <option value="gemini-pro" className="bg-black text-white">{t('settings.desktop.studyAiGeminiPro')}</option>
                <option value="deepseek" className="bg-black text-white">{t('settings.desktop.studyAiDeepSeek')}</option>
              </select>
            </div>
          </div>

          <div className="desktop-toggle-list">
            <div className="desktop-toggle-row panel-subtle">
              <div className="desktop-toggle-info">
                <div className="desktop-toggle-title">
                  <Zap size={15} className="text-cyan" />
                  <b>{t('settings.desktop.studyAutoQuiz')}</b>
                </div>
                <p>{t('settings.desktop.studyAutoQuizDesc')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoGenerateQuiz}
                className={`toggle ${autoGenerateQuiz ? 'toggle-on' : ''}`}
                onClick={() => setAutoGenerateQuiz(!autoGenerateQuiz)}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="desktop-toggle-row panel-subtle">
              <div className="desktop-toggle-info">
                <div className="desktop-toggle-title">
                  <Layers size={15} className="text-cyan" />
                  <b>{t('settings.desktop.studyAutoFlashcards')}</b>
                </div>
                <p>{t('settings.desktop.studyAutoFlashcardsDesc')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoGenerateFlashcards}
                className={`toggle ${autoGenerateFlashcards ? 'toggle-on' : ''}`}
                onClick={() => setAutoGenerateFlashcards(!autoGenerateFlashcards)}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>
        </div>

        {/* 5. Windows PC Native Behaviors */}
        <div className="desktop-settings-group">
          <div className="group-header">
            <Monitor size={16} className="text-purple-400" />
            <div>
              <b>{t('settings.desktop.systemBehaviorSection')}</b>
              <small className="block text-muted-foreground">{t('settings.desktop.systemBehaviorDesc')}</small>
            </div>
          </div>
          <div className="desktop-toggle-list">
            {/* Auto Start */}
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

            {/* Run in Background */}
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
                  notify(next ? (locale === 'ar' ? 'البرنامج سيبقى نشطاً في الخلفية (System Tray)' : 'Background tray mode enabled') : (locale === 'ar' ? 'البرنامج سيغلق بالكامل عند الخروج' : 'Background tray mode disabled'));
                }}
                data-testid="toggle-pc-background"
              >
                <span />
              </button>
            </div>

            {/* GPU Acceleration */}
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

            {/* Global Hotkeys */}
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

        {/* 1. Backup Destination Folder */}
        <div className="panel-subtle p-4 rounded-xl border border-border flex flex-col gap-3">
          <div>
            <b className="text-xs font-semibold block">{t('settings.data.backupDirTitle')}</b>
            <p className="text-[11px] text-muted-foreground">{t('settings.data.backupDirDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Folder size={16} className="text-cyan shrink-0" />
            <input
              type="text"
              value={backupDir}
              onChange={(e) => setBackupDir(e.target.value)}
              placeholder="e.g. D:\CortexOS_Backups"
              className="editable-input flex-1 mono text-xs"
            />
            <button
              type="button"
              onClick={handleBrowseBackupDir}
              disabled={isBrowsingBackupDir}
              className="btn btn-primary text-xs h-[42px] px-3 gap-1.5 shrink-0 focus-ring"
            >
              <FolderSearch size={15} />
              <span>{isBrowsingBackupDir ? '...' : (locale === 'ar' ? 'تصفح...' : 'Browse...')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenBackupDir}
              className="btn btn-outline text-xs h-[42px] px-3 gap-1.5 shrink-0 focus-ring"
              title={locale === 'ar' ? 'فتح المجلد في Explorer' : 'Open in Explorer'}
            >
              <Folder size={15} />
              <span>{locale === 'ar' ? 'فتح' : 'Open'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={handleCreateDiskBackup}
              disabled={creatingBackup}
              className="btn btn-accent text-xs h-9 px-4 gap-2 focus-ring"
            >
              <HardDrive size={14} className={creatingBackup ? 'spin' : ''} />
              <span>{creatingBackup ? t('settings.data.creatingBackup') : t('settings.data.createBackup')}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchDiskBackups()}
              disabled={loadingBackups}
              className="btn btn-ghost text-xs h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={12} className={loadingBackups ? 'spin' : ''} />
              <span>{locale === 'ar' ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* 2. Available Snapshots on Disk */}
        <div className="panel-subtle p-4 rounded-xl border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <b className="text-xs font-semibold">{t('settings.data.availableBackups')}</b>
            <span className="mono text-[11px] text-muted-foreground">{diskBackups.length} snapshots</span>
          </div>

          {diskBackups.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {diskBackups.map((b) => (
                <div
                  key={b.filename}
                  className="p-3 rounded-lg border border-border bg-card/60 flex items-center justify-between gap-3 text-xs hover:border-zinc-700 transition-all"
                >
                  <div className="flex flex-col min-w-0">
                    <b className="mono text-[11px] truncate text-foreground">{b.filename}</b>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {b.timestamp_formatted} · {b.size_kb} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreDiskBackup(b.file_path)}
                    className="btn btn-outline text-xs h-7 px-3 gap-1 shrink-0 hover:border-cyan hover:text-cyan focus-ring"
                  >
                    <RefreshCw size={11} />
                    <span>{t('settings.data.restoreSnapshot')}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">{t('settings.data.noBackupsFound')}</p>
          )}
        </div>

        {/* 3. Manual Import & Cloud Export */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <button className="btn btn-outline text-xs h-9 px-4 gap-2 focus-ring" onClick={exportBackup}>
            <HardDrive size={14} />
            <span>{t('settings.data.exportBackup')}</span>
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
          <button className="btn btn-ghost text-destructive focus-ring text-xs" onClick={clearCache}>
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
              <b className="mono">0.3.12</b>
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
