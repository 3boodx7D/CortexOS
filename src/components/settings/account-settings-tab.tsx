import React, { type ChangeEvent, useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  User as UserIcon, Lock, Crown, KeyRound, Eye, EyeOff,
  RefreshCw, LogOut, Camera, Trash2,
  Sparkles, CheckCircle2
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserContext } from '@/lib/user-store';
import { useDesktopDialog } from '@/components/ui/desktop-dialog';
import { signOut, updatePassword } from '@/lib/supabase';

interface AccountSettingsTabProps {
  notify: (msg: string) => void;
}

const AVATAR_PRESETS = [
  {
    id: 'default',
    nameKey: 'settings.account.presetDefault',
    fallbackName: 'Neural Core',
    url: '/default-avatar.jpg',
    isDefault: true,
  },
  {
    id: 'p1',
    nameKey: 'settings.account.presetCyan',
    fallbackName: 'Cortex Sentinel',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=CortexCyan&backgroundColor=00aff4',
  },
  {
    id: 'p2',
    nameKey: 'settings.account.presetPurple',
    fallbackName: 'Neural Matrix',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=NeuralMatrix&backgroundColor=8b5cf6',
  },
  {
    id: 'p3',
    nameKey: 'settings.account.presetEmerald',
    fallbackName: 'Cyber Guard',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=CyberSentinel&backgroundColor=10b981',
  },
  {
    id: 'p4',
    nameKey: 'settings.account.presetAmber',
    fallbackName: 'Solar Core',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=FounderCore&backgroundColor=f59e0b',
  },
  {
    id: 'p5',
    nameKey: 'settings.account.presetRose',
    fallbackName: 'Quantum Pulse',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=NeonMatrix&backgroundColor=ec4899',
  },
  {
    id: 'p6',
    nameKey: 'settings.account.presetPixel',
    fallbackName: 'Pixel Master',
    url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=CodeMaster&backgroundColor=0284c7',
  },
  {
    id: 'p7',
    nameKey: 'settings.account.presetHacker',
    fallbackName: 'Cyber Nomad',
    url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=CyberNomad&backgroundColor=6366f1',
  },
];

export function AccountSettingsTab({ notify }: AccountSettingsTabProps) {
  const { t, locale } = useTranslation();
  const [, setLocation] = useLocation();
  const { confirmDialog } = useDesktopDialog();
  const {
    email,
    displayName,
    username,
    role,
    bio,
    avatarUrl,
    isOwner,
    updateProfile,
  } = useUserContext();

  const isRtl = locale === 'ar';

  // Avatar Management
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(avatarUrl || '/default-avatar.jpg');
  const [showPresets, setShowPresets] = useState(false);

  // Profile Form State
  const [inputName, setInputName] = useState(displayName);
  const [inputUsername, setInputUsername] = useState(username);
  const [inputRole, setInputRole] = useState(role);
  const [inputBio, setInputBio] = useState(bio);
  const [savingProfile, setSavingProfile] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Password State
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPass, setUpdatingPass] = useState(false);

  // Sync state from context when context changes, guarded against active save race conditions
  useEffect(() => {
    if (!savingProfile && !justSaved) {
      setInputName(displayName);
    }
  }, [displayName, savingProfile, justSaved]);

  useEffect(() => {
    if (!savingProfile && !justSaved) {
      setInputUsername(username);
    }
  }, [username, savingProfile, justSaved]);

  useEffect(() => {
    if (!savingProfile && !justSaved) {
      setInputRole(role);
    }
  }, [role, savingProfile, justSaved]);

  useEffect(() => {
    if (!savingProfile && !justSaved) {
      setInputBio(bio);
    }
  }, [bio, savingProfile, justSaved]);

  useEffect(() => {
    setAvatarPreview(avatarUrl || '/default-avatar.jpg');
  }, [avatarUrl]);

  // Dirty State Checker
  const isDirty = useMemo(() => {
    return (
      inputName.trim() !== (displayName || '').trim() ||
      inputUsername.trim() !== (username || '').trim() ||
      inputRole.trim() !== (role || '').trim() ||
      inputBio.trim() !== (bio || '').trim()
    );
  }, [inputName, inputUsername, inputRole, inputBio, displayName, username, role, bio]);

  // Password Strength
  const passwordStats = useMemo(() => {
    if (!newPass) return { score: 0, label: '' };
    const len = newPass.length;
    const hasLower = /[a-z]/.test(newPass);
    const hasUpper = /[A-Z]/.test(newPass);
    const hasDigit = /[0-9]/.test(newPass);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPass);
    const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

    let score = 1;
    if (len >= 8 && variety >= 2) {
      score = 2;
    }
    if ((len >= 8 && variety >= 3) || (len >= 10 && variety >= 2) || len >= 14) {
      score = 3;
    }
    if (
      (len >= 12 && variety >= 3) ||
      (len >= 10 && variety >= 4) ||
      (len >= 16 && variety >= 2)
    ) {
      score = 4;
    }

    let label = t('settings.account.strengthWeak');
    if (score === 2) label = t('settings.account.strengthFair');
    else if (score === 3) label = t('settings.account.strengthGood');
    else if (score >= 4) label = t('settings.account.strengthStrong');

    return { score, label };
  }, [newPass, t]);

  // File Upload
  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      notify(isRtl ? 'حجم الصورة كبير جداً (الحد الأقصى 3 ميجابايت)' : 'Image too large (Max 3MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatarPreview(base64);
        await updateProfile({ avatarUrl: base64 });
        notify(isRtl ? 'تم تحديث الصورة بنجاح' : 'Profile picture updated');
      }
    };
    reader.readAsDataURL(file);
  };

  // Select Preset
  const handleSelectPreset = async (presetUrl: string) => {
    setAvatarPreview(presetUrl);
    await updateProfile({ avatarUrl: presetUrl });
    notify(isRtl ? 'تم تغيير الصورة' : 'Avatar updated');
  };

  // Remove Avatar (Restore Default)
  const handleRemoveAvatar = async () => {
    const defaultUrl = '/default-avatar.jpg';
    setAvatarPreview(defaultUrl);
    setShowPresets(false);
    await updateProfile({ avatarUrl: defaultUrl });
    notify(isRtl ? 'تمت استعادة الصورة الافتراضية' : 'Default avatar restored');
  };

  // Discard Changes
  const handleDiscard = () => {
    setInputName(displayName);
    setInputUsername(username);
    setInputRole(role);
    setInputBio(bio);
  };

  // Save Profile
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = inputName.trim();
    if (!cleanName) {
      notify(isRtl ? 'يرجى كتابة الاسم' : 'Please enter your name');
      return;
    }
    const cleanUser = inputUsername.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    setSavingProfile(true);
    try {
      const ok = await updateProfile({
        displayName: cleanName,
        username: cleanUser,
        role: inputRole.trim(),
        bio: inputBio.trim(),
      });
      if (ok) {
        setJustSaved(true);
        setInputUsername(cleanUser);
        notify(t('settings.account.profileUpdated'));
        setTimeout(() => setJustSaved(false), 2500);
      } else {
        notify(isRtl ? 'حدث خطأ أثناء الحفظ' : 'Failed to save changes');
      }
    } catch (err: any) {
      notify(err?.message || 'Failed to save changes');
    } finally {
      setSavingProfile(false);
    }
  };

  // Update Password
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

  // Sign Out
  const handleSignOut = async () => {
    const confirmed = await confirmDialog({
      title: t('settings.account.confirmSignOutTitle'),
      message: t('settings.account.confirmSignOutDesc'),
      confirmText: t('settings.account.signOut'),
      cancelText: isRtl ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (confirmed) {
      await signOut();
    }
  };

  const hasCustomAvatar = Boolean(avatarPreview && avatarPreview !== '/default-avatar.jpg');

  return (
    <div className="settings-form" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── 1. Page Section Heading ── */}
      <div className="settings-section-heading">
        <span className="settings-icon">
          <UserIcon size={16} />
        </span>
        <div>
          <h2>{t('settings.account.title')}</h2>
          <p>{t('settings.account.desc')}</p>
        </div>
      </div>

      {/* ── 2. Avatar & Identity Row ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-border">
        <div
          className="relative w-20 h-20 rounded-full overflow-hidden border border-border bg-secondary shrink-0 group cursor-pointer shadow-sm"
          onClick={() => avatarInputRef.current?.click()}
          title={t('settings.account.changePhoto')}
        >
          <img
            src={avatarPreview || '/default-avatar.jpg'}
            alt={displayName}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = '/default-avatar.jpg';
            }}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            <Camera size={18} />
          </div>
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleAvatarFile}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground">
              {displayName}
            </h3>
            {isOwner && (
              <button
                type="button"
                onClick={() => setLocation('/owner')}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:scale-105 transition-all cursor-pointer"
                title={locale === 'ar' ? 'مركز تحكم المالك' : 'Owner Cockpit'}
                aria-label="Owner Cockpit"
              >
                <Crown size={13} className="fill-amber-400/20 text-amber-400" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
            @{username || 'user'} · {email}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="btn btn-outline text-xs h-7 px-3 gap-1.5 focus-ring cursor-pointer"
            >
              <Camera size={12} />
              <span>{t('settings.account.changePhoto')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className={`btn text-xs h-7 px-2.5 gap-1.5 focus-ring cursor-pointer transition-all ${
                showPresets
                  ? 'btn-accent text-primary-foreground'
                  : 'btn-ghost text-cyan hover:text-cyan'
              }`}
            >
              <Sparkles size={12} />
              <span>{t('settings.account.avatarPresets')}</span>
            </button>

            {hasCustomAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="btn btn-ghost text-xs h-7 px-2 text-muted-foreground hover:text-destructive focus-ring cursor-pointer"
              >
                <Trash2 size={12} />
                <span>{t('settings.account.removePhoto')}</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground mt-2">
            {t('settings.account.avatarHint')}
          </p>
        </div>
      </div>

      {/* ── 3. Redesigned Avatar Presets Gallery ── */}
      {showPresets && (
        <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-cyan" />
              <span className="text-xs font-semibold text-foreground">
                {t('settings.account.avatarGallery')}
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                · {t('settings.account.avatarGalleryDesc')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPresets(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              title={isRtl ? 'إغلاق' : 'Close'}
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {AVATAR_PRESETS.map((p) => {
              const isSelected =
                avatarPreview === p.url ||
                (p.isDefault && (!avatarPreview || avatarPreview === '/default-avatar.jpg'));

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.url)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all cursor-pointer relative group text-center ${
                    isSelected
                      ? 'border-cyan bg-cyan/10 shadow-sm shadow-cyan/20 ring-1 ring-cyan/40'
                      : 'border-border/60 bg-background/50 hover:border-cyan/50 hover:bg-secondary/60 hover:scale-[1.02]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border/80 bg-secondary/80 p-0.5 relative mb-1.5 shadow-inner">
                    <img
                      src={p.url}
                      alt={p.fallbackName}
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = '/default-avatar.jpg';
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-foreground truncate max-w-full">
                    {t(p.nameKey) || p.fallbackName}
                  </span>
                  {isSelected && (
                    <span className="absolute top-1.5 end-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-cyan text-black">
                      <CheckCircle2 size={11} className="stroke-[3]" />
                    </span>
                  )}
                  {p.isDefault && (
                    <span className="text-[9px] px-1 py-0.2 rounded font-mono text-cyan bg-cyan/10 mt-1">
                      {isRtl ? 'افتراضي' : 'Default'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. Profile Information Form ── */}
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <div>
          <b className="text-xs font-semibold text-foreground block">
            {t('settings.account.profileInfo')}
          </b>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t('settings.account.profileDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="acc-display-name">
              {t('settings.account.displayName')}
            </label>
            <input
              id="acc-display-name"
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Your Name"
              maxLength={40}
              className="account-input-base"
              required
            />
          </div>

          {/* Username (Clean Inline Layout - No Overlap) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="acc-username">
              {t('settings.account.username')}
            </label>
            <div className="account-input-base flex items-center gap-1.5 !px-3 focus-within:!border-primary focus-within:!ring-2 focus-within:!ring-primary/20">
              <span className="text-muted-foreground select-none font-mono text-xs shrink-0">
                @
              </span>
              <input
                id="acc-username"
                type="text"
                value={inputUsername}
                onChange={(e) =>
                  setInputUsername(
                    e.target.value
                      .replace(/^@/, '')
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '')
                  )
                }
                placeholder="username"
                maxLength={30}
                className="w-full h-full bg-transparent border-none outline-none text-foreground font-mono text-[13px] p-0 focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          {/* Email Address (Read-Only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="acc-email">
              {t('settings.account.emailLabel')}
            </label>
            <div className="account-input-base flex items-center justify-between !px-3 opacity-70 cursor-not-allowed bg-secondary/50">
              <input
                id="acc-email"
                type="email"
                value={email}
                disabled
                readOnly
                className="w-full bg-transparent border-none outline-none font-mono text-muted-foreground text-[13px] p-0 cursor-not-allowed"
              />
              <Lock size={13} className="text-muted-foreground shrink-0 select-none ms-2" />
            </div>
          </div>

          {/* Role / Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="acc-role">
              {t('settings.account.role')}
            </label>
            <input
              id="acc-role"
              type="text"
              value={inputRole}
              onChange={(e) => setInputRole(e.target.value)}
              placeholder="e.g. Developer, Student"
              maxLength={50}
              className="account-input-base"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-medium text-foreground" htmlFor="acc-bio">
            {t('settings.account.bio')}
          </label>
          <textarea
            id="acc-bio"
            rows={3}
            value={inputBio}
            onChange={(e) => setInputBio(e.target.value)}
            placeholder={t('settings.account.bioPlaceholder')}
            maxLength={200}
            className="account-textarea-base"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              className="btn btn-ghost text-xs h-9 px-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
          )}

          <button
            type="submit"
            disabled={savingProfile || (!isDirty && !justSaved)}
            className="btn btn-accent text-xs h-9 px-5 gap-2 font-medium focus-ring cursor-pointer"
          >
            {savingProfile ? (
              <>
                <RefreshCw className="spin" size={13} />
                <span>{t('settings.account.saving')}</span>
              </>
            ) : justSaved ? (
              <>
                <CheckCircle2 size={13} />
                <span>{t('settings.account.saved')}</span>
              </>
            ) : (
              <span>{t('settings.account.saveProfile')}</span>
            )}
          </button>
        </div>
      </form>

      <div className="h-px bg-border my-2" />

      {/* ── 5. Password Security Form ── */}
      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div>
          <b className="text-xs font-semibold text-foreground block">
            {t('settings.account.securitySection')}
          </b>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t('settings.account.securityDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 max-w-xl">
          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="acc-new-pass">
              {t('settings.account.newPassword')}
            </label>
            <div className="relative">
              <input
                id="acc-new-pass"
                type={showNewPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                minLength={6}
                className="account-input-base pe-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 end-0 px-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                title={showNewPass ? 'Hide password' : 'Show password'}
              >
                {showNewPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="acc-confirm-pass">
              {t('settings.account.confirmPassword')}
            </label>
            <div className="relative">
              <input
                id="acc-confirm-pass"
                type={showConfirmPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                minLength={6}
                className="account-input-base pe-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute inset-y-0 end-0 px-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                title={showConfirmPass ? 'Hide password' : 'Show password'}
              >
                {showConfirmPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Discreet Password Strength */}
        {newPass.length > 0 && (
          <div className="flex items-center gap-3 pt-1 max-w-xl animate-in fade-in duration-150">
            <div className="flex-1 grid grid-cols-4 gap-1.5 h-1.5">
              {[1, 2, 3, 4].map((step) => {
                let barColor = 'bg-border';
                if (passwordStats.score >= step) {
                  if (passwordStats.score <= 1) barColor = 'bg-red-500';
                  else if (passwordStats.score === 2) barColor = 'bg-amber-500';
                  else if (passwordStats.score === 3) barColor = 'bg-sky-500';
                  else barColor = 'bg-emerald-500';
                }
                return (
                  <div
                    key={step}
                    className={`h-full rounded-full transition-colors duration-200 ${barColor}`}
                  />
                );
              })}
            </div>
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              {passwordStats.label}
            </span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={updatingPass || !newPass || newPass.length < 6 || newPass !== confirmPass}
            className="btn btn-outline text-xs h-9 px-4 gap-2 hover:border-cyan hover:text-cyan focus-ring cursor-pointer"
          >
            {updatingPass ? (
              <>
                <RefreshCw className="spin" size={13} />
                <span>{t('settings.account.updatingPassword')}</span>
              </>
            ) : (
              <>
                <KeyRound size={13} />
                <span>{t('settings.account.updatePassword')}</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="h-px bg-border my-2" />

      {/* ── 6. Sign Out Row ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
        <div>
          <b className="text-xs font-semibold text-foreground block">
            {t('settings.account.dangerZone')}
          </b>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t('settings.account.dangerZoneDesc')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="btn btn-outline text-destructive hover:bg-destructive/10 border-destructive/30 text-xs h-9 px-4 gap-2 shrink-0 focus-ring cursor-pointer"
        >
          <LogOut size={13} />
          <span>{t('settings.account.signOut')}</span>
        </button>
      </div>
    </div>
  );
}
