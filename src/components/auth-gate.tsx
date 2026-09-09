import { type FormEvent, useEffect, useState, useMemo } from 'react';
import {
  AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Moon,
  ShieldCheck, Sparkles, Sun, User as UserIcon, ArrowLeft, ArrowRight, KeyRound
} from 'lucide-react';
import {
  signIn,
  signUp,
  resetPasswordForEmail,
  updatePassword,
  signOut,
  onAuthStateChange,
  getSession,
  checkIsRecoverySession,
  markRecoveryCompleted
} from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { UserStoreProvider } from '@/lib/user-store';
import { WindowControls } from '@/components/window-controls';
import type { Session } from '@supabase/supabase-js';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const SIGNUP_AVATARS = [
  { id: 'default', name: 'Neural Core', url: '/default-avatar.jpg' },
  { id: 'cyan', name: 'Cyan Bot', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=CortexCyan&backgroundColor=00aff4' },
  { id: 'purple', name: 'Matrix', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=NeuralMatrix&backgroundColor=8b5cf6' },
  { id: 'emerald', name: 'Sentinel', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=CyberSentinel&backgroundColor=10b981' },
  { id: 'amber', name: 'Solar', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=FounderCore&backgroundColor=f59e0b' },
  { id: 'pixel', name: 'Pixel', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=CodeMaster&backgroundColor=0284c7' },
];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');

  // Track recovery from URL params or sessionStorage
  const [urlRecovery, setUrlRecovery] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return (
      hash.includes('type=recovery') ||
      search.includes('type=recovery') ||
      hash.includes('reset-password') ||
      search.includes('reset-password') ||
      sessionStorage.getItem('cortex_recovery_pending') === 'true'
    );
  });
  const [eventRecovery, setEventRecovery] = useState(false);

  useEffect(() => {
    // Purge any guest mode token
    localStorage.removeItem('cortex-guest-mode');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange((s, event) => {
      setSession(s);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') {
        setEventRecovery(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('cortex_recovery_pending', 'true');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // True if URL flagged recovery, auth event fired, OR session JWT AMR claim indicates recovery
  const isPasswordRecovery = useMemo(() => {
    if (urlRecovery || eventRecovery) return true;
    if (session && checkIsRecoverySession(session)) return true;
    return false;
  }, [urlRecovery, eventRecovery, session]);

  if (loading) {
    return (
      <div className="auth-gate-loading">
        <header className="auth-titlebar" data-tauri-drag-region>
          <div className="auth-titlebar-brand">
            <img src="/logo.png" alt="CortexOS" />
            <span>CORTEXOS</span>
          </div>
          <WindowControls />
        </header>
        <div className="auth-glow-backdrop" aria-hidden="true">
          <div className="auth-glow-orb auth-glow-primary" />
        </div>
        <div className="auth-logo-pulse">
          <img src="/logo.png" alt="CortexOS" className="auth-logo-pulse-img" />
        </div>
        <span className="mono font-bold tracking-widest text-lg">CORTEX<span className="text-[hsl(var(--primary))]">OS</span></span>
        <small className="text-muted-foreground text-xs tracking-wider">ESTABLISHING QUANTUM LINK...</small>
      </div>
    );
  }

  // If the user arrived via a password reset link, require them to set their new password
  if (isPasswordRecovery) {
    return (
      <SetNewPasswordScreen
        session={session}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onComplete={() => {
          markRecoveryCompleted(session);
          setUrlRecovery(false);
          setEventRecovery(false);
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
      />
    );
  }

  if (!session) {
    return (
      <LoginScreen
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return <UserStoreProvider session={session}>{children}</UserStoreProvider>;
}

function SetNewPasswordScreen({
  session,
  theme,
  onToggleTheme,
  onComplete,
}: {
  session: Session | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onComplete: () => void;
}) {
  const { t, locale, setLocale } = useTranslation();
  const isRtl = locale === 'ar';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password Strength Calculation
  const passwordStats = useMemo(() => {
    if (!newPassword) return { score: 0, label: '' };
    const len = newPassword.length;
    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
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
  }, [newPassword, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || newPassword.length < 6) {
      setError(
        isRtl
          ? 'كلمة المرور يجب ألا تقل عن 6 أحرف'
          : 'Password must be at least 6 characters'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      markRecoveryCompleted(session);
      setSuccess(t('auth.passwordUpdatedSuccess'));
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || t('auth.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOutAndExit = async () => {
    markRecoveryCompleted(session);
    await signOut();
  };

  return (
    <div className="auth-gate" dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="auth-titlebar" data-tauri-drag-region>
        <div className="auth-titlebar-brand">
          <img src="/logo.png" alt="CortexOS" />
          <span>CORTEXOS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <button
            type="button"
            onClick={onToggleTheme}
            className="auth-control-btn"
            title={theme === 'dark' ? 'Switch to Light theme' : 'التبديل إلى الوضع الداكن'}
            aria-label="Toggle theme"
            style={{ width: '32px', height: '28px' }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            type="button"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="auth-control-btn mono font-bold"
            title="Switch Language / تغيير اللغة"
            aria-label="Toggle language"
            style={{ width: '40px', height: '28px', fontSize: '11px' }}
          >
            {locale === 'ar' ? 'EN' : 'عربي'}
          </button>

          <WindowControls />
        </div>
      </header>

      <div className="auth-glow-backdrop" aria-hidden="true">
        <div className="auth-glow-orb auth-glow-primary" />
        <div className="auth-glow-orb auth-glow-accent" />
        <div className="auth-glow-center" />
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark auth-brand-logo-wrap">
            <img src="/logo.png" alt="CortexOS" className="auth-brand-logo-img" />
          </div>
          <div>
            <strong>CORTEX<span>OS</span></strong>
            <small className="mono">RECOVERY & SECURITY</small>
          </div>
        </div>

        <div className="auth-header">
          <div className="auth-header-icon-wrap">
            <KeyRound size={18} />
          </div>
          <h1>{t('auth.setNewPasswordTitle')}</h1>
          <p>{t('auth.setNewPasswordSubtitle')}</p>
          {session?.user?.email && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50 border border-border text-xs text-muted-foreground mono font-medium">
              <UserIcon size={12} className="text-primary" />
              <span>{session.user.email}</span>
            </div>
          )}
        </div>

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label>
            <span>{t('auth.password')}</span>
            <div className="password-input-wrapper">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                minLength={6}
                required
                autoFocus
              />
              <button
                type="button"
                className="password-toggle-eye"
                onClick={() => setShowNewPassword(!showNewPassword)}
                title={showNewPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <label>
            <span>{t('auth.confirmPassword')}</span>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                minLength={6}
                required
              />
              <button
                type="button"
                className="password-toggle-eye"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          {/* Discreet strength indicator */}
          {newPassword.length > 0 && (
            <div className="flex items-center gap-2 pt-0.5 animate-in fade-in duration-150">
              <div className="flex-1 grid grid-cols-4 gap-1.5 h-1">
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
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                {passwordStats.label}
              </span>
            </div>
          )}

          {error && (
            <div className="auth-error">
              <ShieldCheck size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-success">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-accent auth-submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="spin" size={16} />
                <span>{t('auth.savingPassword')}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{t('auth.savePasswordAndContinue')}</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-switch">
          <button
            type="button"
            onClick={handleSignOutAndExit}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {isRtl ? 'إلغاء وتسجيل الخروج' : 'Cancel & Sign Out'}
          </button>
        </div>

        <div className="auth-footer mono">
          <ShieldCheck size={13} />
          <span>End-to-end encrypted · Supabase Auth · Cortex Neural Kernel</span>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({
  theme,
  onToggleTheme,
}: {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  const { t, locale, setLocale } = useTranslation();
  const isRtl = locale === 'ar';

  const [mode, setMode] = useState<AuthMode>('signIn');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('/default-avatar.jpg');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return '';
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (hash.includes('error=') || search.includes('error=')) {
      const raw = hash.startsWith('#') ? hash.slice(1) : (search.startsWith('?') ? search.slice(1) : search);
      const params = new URLSearchParams(raw);
      const errCode = params.get('error_code');
      const errDesc = params.get('error_description');
      if (errCode === 'otp_expired' || errDesc?.toLowerCase().includes('expired')) {
        return isRtl
          ? 'رابط استعادة كلمة المرور منتهي الصلاحية أو غير صالح، يرجى طلب رابط جديد'
          : 'Password reset link has expired or is invalid. Please request a new link.';
      }
      if (errDesc) {
        return decodeURIComponent(errDesc.replace(/\+/g, ' '));
      }
    }
    return '';
  });
  const [success, setSuccess] = useState('');

  // Individual Validation Errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Switch Mode Helper
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setNameError('');
    setUsernameError('');
  };

  // Password Strength Calculation
  const passwordStats = useMemo(() => {
    if (!password) return { score: 0, label: '' };
    const len = password.length;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
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
  }, [password, t]);

  // Handle Form Submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setNameError('');
    setUsernameError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

    // Email validation
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setEmailError(
        isRtl
          ? "يرجى إدخال عنوان بريد إلكتروني صالح يحتوي على '@'"
          : "Please enter a valid email address containing '@'"
      );
      hasError = true;
    }

    // Password validation (Sign in & Sign up)
    if (mode !== 'forgotPassword') {
      if (!password || password.length < 6) {
        setPasswordError(
          isRtl
            ? 'كلمة المرور يجب ألا تقل عن 6 أحرف'
            : 'Password must be at least 6 characters'
        );
        hasError = true;
      }
    }

    // Sign-up specific validation
    if (mode === 'signUp') {
      if (!displayName.trim()) {
        setNameError(isRtl ? 'يرجى كتابة الاسم الكامل' : 'Please enter your full name');
        hasError = true;
      }

      const cleanUser = username.replace(/^@/, '').toLowerCase().trim();
      if (!cleanUser || cleanUser.length < 3 || !/^[a-z0-9_]+$/.test(cleanUser)) {
        setUsernameError(t('auth.usernameInvalid'));
        hasError = true;
      }

      if (password !== confirmPassword) {
        setConfirmPasswordError(t('auth.passwordMismatch'));
        hasError = true;
      }
    }

    if (hasError) return;

    setSubmitting(true);

    try {
      if (mode === 'signIn') {
        await signIn(email.trim(), password);
      } else if (mode === 'signUp') {
        const cleanUser = username.replace(/^@/, '').toLowerCase().trim();
        const res = await signUp(email.trim(), password, {
          displayName: displayName.trim(),
          username: cleanUser,
          role: role.trim() || 'developer',
          avatarUrl: selectedAvatar,
          bio: 'CortexOS Neural Operator',
        });

        if (res.session) {
          // Immediately signed in
          setSuccess(t('auth.accountCreated'));
        } else {
          setSuccess(
            isRtl
              ? 'تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول مباشرة.'
              : 'Account created successfully! You can now sign in directly.'
          );
          setTimeout(() => {
            switchMode('signIn');
          }, 1500);
        }
      } else if (mode === 'forgotPassword') {
        await resetPasswordForEmail(email.trim());
        setSuccess(t('auth.resetLinkSent'));
      }
    } catch (err: any) {
      const msg = err?.message || '';
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('invalid login credentials')) {
        setError(t('auth.invalidCredentialsHint'));
      } else if (lowerMsg.includes('user already registered')) {
        setError(
          isRtl
            ? 'هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول'
            : 'Email already registered. Please sign in.'
        );
      } else if (lowerMsg.includes('database error saving new user')) {
        setError(
          isRtl
            ? 'حدث تعارض في مزامنة بيانات المستخدم مع قاعدة البيانات، يرجى تغيير اسم المستخدم والمحاولة مجدداً.'
            : 'Database error saving user profile. Please try a different username.'
        );
      } else if (lowerMsg.includes('rate limit')) {
        setError(
          isRtl
            ? 'تم تجاوز حد إرسال الطلبات مؤقتاً، يرجى الانتظار دقيقة والمحاولة لاحقاً.'
            : 'Email rate limit exceeded. Please wait a moment and try again.'
        );
      } else {
        setError(msg || t('auth.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-gate" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Native Windows 11 Draggable Titlebar & Window Controls */}
      <header className="auth-titlebar" data-tauri-drag-region>
        <div className="auth-titlebar-brand">
          <img src="/logo.png" alt="CortexOS" />
          <span>CORTEXOS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {/* Theme Switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="auth-control-btn"
            title={theme === 'dark' ? 'Switch to Light theme' : 'التبديل إلى الوضع الداكن'}
            aria-label="Toggle theme"
            data-testid="button-auth-toggle-theme"
            style={{ width: '32px', height: '28px' }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Seamless In-Place Language Switcher (No reload) */}
          <button
            type="button"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="auth-control-btn mono font-bold"
            title="Switch Language / تغيير اللغة"
            aria-label="Toggle language"
            data-testid="button-auth-toggle-lang"
            style={{ width: '40px', height: '28px', fontSize: '11px' }}
          >
            {locale === 'ar' ? 'EN' : 'عربي'}
          </button>

          {/* Native Window Controls (- □ ✕) */}
          <WindowControls />
        </div>
      </header>

      {/* Radiant atmospheric ambient glow — zero grid lines */}
      <div className="auth-glow-backdrop" aria-hidden="true">
        <div className="auth-glow-orb auth-glow-primary" />
        <div className="auth-glow-orb auth-glow-secondary" />
        <div className="auth-glow-orb auth-glow-accent" />
        <div className="auth-glow-center" />
      </div>

      <div className={`auth-card ${mode === 'signUp' ? 'auth-card-wide' : ''}`}>
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-brand-mark auth-brand-logo-wrap">
            <img src="/logo.png" alt="CortexOS" className="auth-brand-logo-img" />
          </div>
          <div>
            <strong>CORTEX<span>OS</span></strong>
            <small className="mono">NEURAL ACCESS GATE</small>
          </div>
        </div>

        {/* Segmented Mode Selector */}
        {mode !== 'forgotPassword' && (
          <div className="auth-tabs">
            <button
              type="button"
              onClick={() => switchMode('signIn')}
              className={`auth-tab-btn ${mode === 'signIn' ? 'active' : ''}`}
            >
              <Lock size={13} />
              <span>{t('auth.tabSignIn')}</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('signUp')}
              className={`auth-tab-btn ${mode === 'signUp' ? 'active' : ''}`}
            >
              <UserIcon size={13} />
              <span>{t('auth.tabSignUp')}</span>
            </button>
          </div>
        )}

        {/* Section Heading */}
        <div className="auth-header">
          <div className="auth-header-icon-wrap">
            {mode === 'forgotPassword' ? <KeyRound size={18} /> : mode === 'signUp' ? <UserIcon size={18} /> : <Lock size={18} />}
          </div>
          <h1>
            {mode === 'forgotPassword'
              ? t('auth.forgotPasswordTitle')
              : mode === 'signUp'
              ? t('auth.signUp')
              : t('auth.title')}
          </h1>
          <p>
            {mode === 'forgotPassword'
              ? t('auth.forgotPasswordSubtitle')
              : mode === 'signUp'
              ? t('settings.account.profileDesc')
              : t('auth.subtitle')}
          </p>
        </div>

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          {/* ── Sign Up Extended Profile Fields ── */}
          {mode === 'signUp' && (
            <>
              {/* Row 1: Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span>{t('auth.displayName')}</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder={t('auth.displayNamePlaceholder')}
                    maxLength={40}
                    required
                  />
                  {nameError && (
                    <div className="custom-validation-badge">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{nameError}</span>
                    </div>
                  )}
                </label>

                <label>
                  <span>{t('auth.username')}</span>
                  <div className="username-input-wrapper">
                    <span className="username-at-prefix">
                      @
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(
                          e.target.value
                            .replace(/^@/, '')
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, '')
                        );
                        if (usernameError) setUsernameError('');
                      }}
                      placeholder={t('auth.usernamePlaceholder')}
                      maxLength={30}
                      required
                    />
                  </div>
                  {usernameError && (
                    <div className="custom-validation-badge">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{usernameError}</span>
                    </div>
                  )}
                </label>
              </div>

              {/* Row 2: Role / Specialization */}
              <label>
                <span>{t('auth.role')}</span>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t('auth.rolePlaceholder')}
                  maxLength={50}
                />
              </label>

              {/* Initial Avatar Preset Gallery */}
              <div className="space-y-1.5 pt-0.5">
                <span className="text-xs font-medium text-muted-foreground block">
                  {t('auth.avatarSelectTitle')}
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                  {SIGNUP_AVATARS.map((p) => {
                    const isSelected = selectedAvatar === p.url;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedAvatar(p.url)}
                        className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all shrink-0 cursor-pointer p-0.5 relative group ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40 scale-105'
                            : 'border-border/80 hover:border-primary/50 opacity-75 hover:opacity-100'
                        }`}
                        title={p.name}
                      >
                        <img
                          src={p.url}
                          alt={p.name}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            e.currentTarget.src = '/default-avatar.jpg';
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Email Address */}
          <label>
            <span>{t('auth.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              placeholder="user@cortex.os"
              autoComplete="email"
              data-testid="input-auth-email"
            />
            {emailError && (
              <div className="custom-validation-badge">
                <AlertCircle size={13} className="shrink-0" />
                <span>{emailError}</span>
              </div>
            )}
          </label>

          {/* Passwords (Sign In & Sign Up) */}
          {mode !== 'forgotPassword' && (
            <>
              {mode === 'signUp' ? (
                /* Two column passwords for signup */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label>
                    <span>{t('auth.password')}</span>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) setPasswordError('');
                        }}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="password-toggle-eye"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {passwordError && (
                      <div className="custom-validation-badge">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}
                  </label>

                  <label>
                    <span>{t('auth.confirmPassword')}</span>
                    <div className="password-input-wrapper">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (confirmPasswordError) setConfirmPasswordError('');
                        }}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="password-toggle-eye"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPasswordError && (
                      <div className="custom-validation-badge">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{confirmPasswordError}</span>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                /* Single password for sign in */
                <label>
                  <div className="flex items-center justify-between">
                    <span>{t('auth.password')}</span>
                    <button
                      type="button"
                      onClick={() => switchMode('forgotPassword')}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError('');
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      minLength={6}
                      data-testid="input-auth-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-eye"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {passwordError && (
                    <div className="custom-validation-badge">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}
                </label>
              )}

              {/* Password strength meter on sign-up */}
              {mode === 'signUp' && password.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5 animate-in fade-in duration-150">
                  <div className="flex-1 grid grid-cols-4 gap-1.5 h-1">
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
                  <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                    {passwordStats.label}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="auth-error">
              <ShieldCheck size={16} className="shrink-0" />
              <div>
                <div>{error}</div>
                {mode === 'signIn' && (error.includes('إنشاء') || error.includes('Create')) && (
                  <button
                    type="button"
                    onClick={() => switchMode('signUp')}
                    className="auth-error-action"
                  >
                    {isRtl ? 'اضغط هنا لإنشاء الحساب الآن' : 'Click here to Create Account now'}
                  </button>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="auth-success">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-accent auth-submit"
            disabled={submitting}
            data-testid="button-auth-submit"
          >
            {submitting ? (
              <>
                <Loader2 className="spin" size={16} />
                <span>
                  {mode === 'forgotPassword'
                    ? t('auth.sendingResetLink')
                    : mode === 'signUp'
                    ? t('auth.creatingAccount')
                    : t('auth.signingIn')}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>
                  {mode === 'forgotPassword'
                    ? t('auth.sendResetLink')
                    : mode === 'signUp'
                    ? t('auth.signUp')
                    : t('auth.signIn')}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Bottom Switcher */}
        {mode === 'forgotPassword' ? (
          <div className="auth-switch">
            <button
              type="button"
              onClick={() => switchMode('signIn')}
              className="inline-flex items-center gap-1.5"
            >
              {isRtl ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
              <span>{t('auth.backToSignIn')}</span>
            </button>
          </div>
        ) : (
          <div className="auth-switch">
            <span>
              {mode === 'signUp' ? t('auth.hasAccount') : t('auth.noAccount')}
            </span>
            <button
              type="button"
              onClick={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
            >
              {mode === 'signUp' ? t('auth.signIn') : t('auth.signUp')}
            </button>
          </div>
        )}

        <div className="auth-footer mono">
          <ShieldCheck size={13} />
          <span>End-to-end encrypted · Supabase Auth · Cortex Neural Kernel</span>
        </div>
      </div>
    </div>
  );
}
