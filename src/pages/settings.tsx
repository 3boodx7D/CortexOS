import { type ChangeEvent, useCallback, useRef, useState, useEffect } from 'react';
import {
  Check, ChevronRight, Cpu, Eye, EyeOff,
  HardDrive, Info, KeyRound, Lock, LogOut, Monitor, Moon, Palette, RefreshCw, Save, Shield, ShieldCheck, Sun,
  Upload, User as UserIcon, Zap, Globe, Sparkles, FolderKanban, Folder, FolderSearch, Camera, Trash2, Copy
} from 'lucide-react';
import { useTranslation, type Locale } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { signOut, updatePassword } from '@/lib/supabase';
import { useUserContext } from '@/lib/user-store';
import { useDesktopDialog } from '@/components/ui/desktop-dialog';
import { pickDirectory } from '@/lib/tauri';

export type MotionMode = 'minimal' | 'cinematic';

export default function Settings({ notify }: { notify: (msg: string) => void }) {
  const { t, locale, setLocale } = useTranslation();
  const { confirmDialog } = useDesktopDialog();
  const {
    email,
    userId,
    displayName,
    role,
    bio,
    avatarChar,
    avatarUrl,
    lastSynced,
    syncAllToCloud,
    updateProfile,
  } = useUserContext();

  const [activeTab, setActiveTab] = useState<'desktop' | 'account' | 'data' | 'privacy' | 'about'>('desktop');
  const [workspacePath, setWorkspacePath] = usePersistent<string>('cortex-workspace-path', 'C:\\Projects');
  const [isBrowsingWorkspace, setIsBrowsingWorkspace] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(avatarUrl);
  const [copiedId, setCopiedId] = useState(false);

  // Desktop App (PC) Local-Only settings (stored in localStorage per machine)
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');
  const [motionMode, setMotionMode] = usePersistent<MotionMode>('cortex-motion', 'cinematic');
  const [autoStart, setAutoStart] = usePersistent<boolean>('cortex-pc-autostart', true);
  const [runInBackground, setRunInBackground] = usePersistent<boolean>('cortex-pc-background', true);
  const [gpuAcceleration, setGpuAcceleration] = usePersistent<boolean>('cortex-pc-gpu', true);
  const [globalHotkeys, setGlobalHotkeys] = usePersistent<boolean>('cortex-pc-hotkeys', true);

  // Account Form State
  const [inputName, setInputName] = useState(displayName);
  const [inputRole, setInputRole] = useState(role);
  const [inputBio, setInputBio] = useState(bio);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security Form State
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPass, setUpdatingPass] = useState(false);

  // Sync state
  const [syncingNow, setSyncingNow] = useState(false);

  // Backup files
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setInputName(displayName);
    setInputRole(role);
    setInputBio(bio);
  }, [displayName, role, bio]);

  useEffect(() => {
    setAvatarPreview(avatarUrl);
  }, [avatarUrl]);

  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      notify(locale === 'ar' ? 'حجم الصورة كبير جداً (الحد الأقصى 3 ميجابايت)' : 'Image too large (Max 3MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatarPreview(base64);
        await updateProfile({ avatarUrl: base64 });
        notify(locale === 'ar' ? 'تم تحديث الصورة الشخصية بنجاح' : 'Profile picture updated successfully');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setAvatarPreview('/default-avatar.jpg');
    await updateProfile({ avatarUrl: '' });
    notify(locale === 'ar' ? 'تم استعادة الصورة الرمزية الافتراضية' : 'Default avatar restored');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId);
    setCopiedId(true);
    notify(locale === 'ar' ? 'تم نسخ معرف الحساب' : 'UUID copied to clipboard');
    setTimeout(() => setCopiedId(false), 2000);
  };

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

  // Profile Save (Persisted to Database & Cloud)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    setSavingProfile(true);
    const ok = await updateProfile({
      displayName: inputName.trim(),
      role: inputRole.trim(),
      bio: inputBio.trim(),
    });
    setSavingProfile(false);
    if (ok) {
      notify(t('settings.account.profileUpdated'));
    }
  };

  // Password Change (Zero native browser alerts)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass) return;
    if (newPass.length < 6) {
      notify(t('settings.account.passwordMinLength'));
      return;
    }
    if (newPass !== confirmPass) {
      notify(t('settings.account.passwordMismatch'));
      return;
    }
    setUpdatingPass(true);
    try {
      await updatePassword(newPass);
      setNewPass('');
      setConfirmPass('');
      notify(t('settings.account.passwordChanged'));
    } catch (err: any) {
      notify(err?.message || 'Failed to update password');
    } finally {
      setUpdatingPass(false);
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
      [JSON.stringify({ exportedAt: new Date().toISOString(), version: '0.2.31', userId, data }, null, 2)],
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
    account: (
      <div className="settings-form">
        <div className="settings-section-heading">
          <span className="settings-icon"><UserIcon size={16} /></span>
          <div>
            <h2>{t('settings.account.title')}</h2>
            <p>{t('settings.account.desc')}</p>
          </div>
        </div>

        {/* Profile Card & Details */}
        <div className="account-details-panel panel-subtle">
          <div className="account-profile-header flex items-center gap-5">
            <div className="account-big-avatar-wrapper">
              <div
                className="account-big-avatar-circle"
                onClick={() => avatarInputRef.current?.click()}
                title={locale === 'ar' ? 'انقر لتغيير الصورة الشخصية' : 'Click to change profile picture'}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt={displayName} />
                ) : (
                  <img src="/default-avatar.jpg" alt={displayName} />
                )}
                <div className="account-big-avatar-overlay">
                  <Camera size={22} />
                </div>
              </div>
              <span className="account-online" style={{ width: 12, height: 12, bottom: 2, insetInlineEnd: 2 }} />
            </div>

            <div className="account-profile-text flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="account-profile-name">{displayName}</span>
                <span className="account-role-pill mono">{role}</span>
                <span className="account-profile-badge mono ml-auto">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  {t('settings.account.connected')}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="btn btn-outline text-xs h-7 px-3 gap-1.5 focus-ring"
                >
                  <Camera size={13} />
                  <span>{locale === 'ar' ? 'تغيير الصورة' : 'Change Photo'}</span>
                </button>
                {avatarPreview && avatarPreview !== '/default-avatar.jpg' && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="btn btn-ghost text-xs h-7 px-2.5 text-muted-foreground hover:text-destructive gap-1 focus-ring"
                  >
                    <Trash2 size={12} />
                    <span>{locale === 'ar' ? 'استعادة الافتراضي' : 'Reset to Default'}</span>
                  </button>
                )}
              </div>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarFile}
            />
          </div>

          <form className="account-edit-form" onSubmit={handleSaveProfile}>
            {/* Locked Email */}
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

            {/* Editable Display Name & Role in a 2-column grid */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="settings-display-name">
                  <span>{t('settings.account.displayName')}</span>
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="Your Name"
                  maxLength={40}
                  className="editable-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="settings-role">
                  <span>{t('settings.account.role')}</span>
                </label>
                <input
                  id="settings-role"
                  type="text"
                  value={inputRole}
                  onChange={(e) => setInputRole(e.target.value)}
                  placeholder="e.g. Lead Engineer, Student"
                  maxLength={50}
                  className="editable-input"
                />
              </div>
            </div>

            {/* Editable Bio */}
            <div className="form-group">
              <label htmlFor="settings-bio">
                <span>{t('settings.account.bio')}</span>
              </label>
              <textarea
                id="settings-bio"
                rows={2}
                value={inputBio}
                onChange={(e) => setInputBio(e.target.value)}
                placeholder="A brief bio..."
                maxLength={200}
                className="editable-textarea"
              />
            </div>

            <div className="form-actions-inline">
              <button
                type="submit"
                className="btn btn-primary focus-ring"
                disabled={savingProfile || !inputName.trim()}
              >
                <Save size={14} />
                {savingProfile ? (locale === 'ar' ? 'جارٍ الحفظ في الداتا بيس...' : 'Saving to Database...') : t('settings.account.saveProfile')}
              </button>
            </div>
          </form>

          {/* Security & Password Section */}
          <div className="security-sub-panel panel-subtle">
            <div className="sub-panel-head">
              <KeyRound size={15} className="text-cyan" />
              <b>{t('settings.account.securitySection')}</b>
            </div>
            <form className="password-change-form" onSubmit={handleUpdatePassword}>
              <div className="form-row-2">
                <div className="password-input-wrapper">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder={t('settings.account.newPassword')}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    minLength={6}
                    className="editable-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-eye"
                    onClick={() => setShowNewPass(!showNewPass)}
                    title={showNewPass ? 'Hide password' : 'Show password'}
                  >
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    placeholder={t('settings.account.confirmPassword')}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    minLength={6}
                    className="editable-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-eye"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    title={showConfirmPass ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-outline focus-ring"
                disabled={updatingPass || !newPass || !confirmPass}
              >
                <Lock size={13} />
                {updatingPass ? (locale === 'ar' ? 'جارٍ التحديث...' : 'Updating...') : t('settings.account.updatePassword')}
              </button>
            </form>
          </div>

          <div className="cloud-details-grid">
            <div>
              <small>{t('settings.account.accountInfo')}</small>
              <b className="mono text-xs truncate max-w-[200px] block" title={userId}>
                {userId}
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground">{locale === 'ar' ? 'مسارات سريعة مقترحة:' : 'Quick suggestions:'}</span>
              {['C:\\Projects', 'D:\\Projects', 'C:\\dev26-27\\app'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setWorkspacePath(p);
                    notify(locale === 'ar' ? `تم تحديد مسار المشاريع: ${p}` : `Workspace path set to: ${p}`);
                  }}
                  className="px-2 py-0.5 rounded text-[11px] mono border border-border bg-card hover:border-cyan text-foreground transition-all cursor-pointer"
                >
                  {p}
                </button>
              ))}
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
              <b className="mono">0.2.31</b>
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
