import { type FormEvent, useEffect, useState } from 'react';
import {
  BrainCircuit, CheckCircle2, Loader2, Lock, Moon,
  ShieldCheck, Sparkles, Sun, Zap,
} from 'lucide-react';
import { signIn, signUp, onAuthStateChange, getSession } from '@/lib/supabase';
import { useTranslation, saveLocaleAndReload } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import type { Session } from '@supabase/supabase-js';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem('cortex-guest-mode') === 'true';
  });
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = usePersistent<'dark' | 'light'>('cortex-theme', 'dark');

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

    const { data: { subscription } } = onAuthStateChange((s) => {
      setSession(s);
      setLoading(false);
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

  if (loading) {
    return (
      <div className="auth-gate-loading">
        <div className="auth-glow-backdrop" aria-hidden="true">
          <div className="auth-glow-orb auth-glow-primary" />
        </div>
        <div className="auth-spinner">
          <BrainCircuit size={36} />
        </div>
        <span className="mono font-bold tracking-widest text-lg">CORTEX<span className="text-[hsl(var(--primary))]">OS</span></span>
        <small className="text-muted-foreground text-xs tracking-wider">ESTABLISHING QUANTUM LINK...</small>
      </div>
    );
  }

  if (!session && !isGuest) {
    return (
      <LoginScreen
        onGuestAccess={() => setIsGuest(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return <>{children}</>;
}

function LoginScreen({
  onGuestAccess,
  theme,
  onToggleTheme,
}: {
  onGuestAccess: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  const { t, locale } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setSuccess(t('auth.accountCreated'));
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError(t('auth.invalidCredentialsHint'));
      } else {
        setError(msg || t('auth.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('cortex-guest-mode', 'true');
    onGuestAccess();
  };

  return (
    <div className="auth-gate">
      {/* Corner Controls: Theme Switcher & Language Switcher */}
      <div className="auth-corner-controls">
        <button
          type="button"
          onClick={onToggleTheme}
          className="auth-control-btn"
          title={theme === 'dark' ? 'Switch to Light theme' : 'التبديل إلى الوضع الداكن'}
          aria-label="Toggle theme"
          data-testid="button-auth-toggle-theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          type="button"
          onClick={() => saveLocaleAndReload(locale === 'ar' ? 'en' : 'ar')}
          className="auth-control-btn mono font-bold"
          title="Switch Language / تغيير اللغة"
          aria-label="Toggle language"
          data-testid="button-auth-toggle-lang"
        >
          {locale === 'ar' ? 'EN' : 'عربي'}
        </button>
      </div>

      {/* Radiant atmospheric ambient glow — zero grid lines */}
      <div className="auth-glow-backdrop" aria-hidden="true">
        <div className="auth-glow-orb auth-glow-primary" />
        <div className="auth-glow-orb auth-glow-secondary" />
        <div className="auth-glow-orb auth-glow-accent" />
        <div className="auth-glow-center" />
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">
            <BrainCircuit size={28} />
          </div>
          <div>
            <strong>CORTEX<span>OS</span></strong>
            <small className="mono">NEURAL ACCESS GATE</small>
          </div>
        </div>

        <div className="auth-header">
          <div className="auth-header-icon-wrap">
            <Lock size={18} />
          </div>
          <h1>{t('auth.title')}</h1>
          <p>{t('auth.subtitle')}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>{t('auth.email')}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@cortex.os"
              autoComplete="email"
              data-testid="input-auth-email"
            />
          </label>
          <label>
            <span>{t('auth.password')}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6}
              data-testid="input-auth-password"
            />
          </label>

          {error && (
            <div className="auth-error">
              <ShieldCheck size={16} className="shrink-0" />
              <div>
                <div>{error}</div>
                {!isSignUp && error.includes('إنشاء') && (
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); setError(''); }}
                    className="auth-error-action"
                  >
                    اضغط هنا لإنشاء الحساب الآن
                  </button>
                )}
                {!isSignUp && error.includes('Create') && (
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); setError(''); }}
                    className="auth-error-action"
                  >
                    Click here to Create Account now
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

          <button
            type="submit"
            className="btn btn-accent auth-submit"
            disabled={submitting}
            data-testid="button-auth-submit"
          >
            {submitting ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            {submitting ? t('auth.signingIn') : isSignUp ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </form>

        <div className="auth-switch">
          <span>{isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}</span>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccess('');
            }}
          >
            {isSignUp ? t('auth.signIn') : t('auth.signUp')}
          </button>
        </div>

        {/* Quick guest demo button for instantaneous frictionless access */}
        <div className="auth-guest-section">
          <div className="auth-divider">
            <span>OR</span>
          </div>
          <button
            type="button"
            className="btn btn-outline auth-guest-btn"
            onClick={handleGuestLogin}
            title={t('auth.guestHint')}
          >
            <Zap size={15} className="text-[hsl(var(--primary))]" />
            <span>{t('auth.guestButton')}</span>
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
