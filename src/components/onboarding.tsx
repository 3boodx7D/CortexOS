import { useState } from 'react';
import { Moon, Sun, Zap, Globe, ChevronRight, CheckCircle2, Monitor, FolderKanban, Sparkles, Folder, FolderSearch } from 'lucide-react';
import { useTranslation, type Locale } from '@/lib/i18n';
import { WindowControls } from '@/components/window-controls';
import { pickDirectory } from '@/lib/tauri';
import type { MotionMode } from '@/pages/settings';

interface OnboardingProps {
  theme: 'dark' | 'light';
  motionMode: MotionMode;
  onThemeChange: (theme: 'dark' | 'light') => void;
  onMotionChange: (mode: MotionMode) => void;
  onComplete: () => void;
}

export function Onboarding({
  theme,
  motionMode,
  onThemeChange,
  onMotionChange,
  onComplete,
}: OnboardingProps) {
  const { t, locale, setLocale } = useTranslation();
  const [step, setStep] = useState(0);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [workspacePath, setWorkspacePath] = useState(() => {
    return localStorage.getItem('cortex-workspace-path') || 'C:\\Projects';
  });

  const totalSteps = 5;

  const nextStep = () => {
    if (step < totalSteps - 1) {
      if (step === 1) {
        // Save workspace path on step 1
        localStorage.setItem('cortex-workspace-path', workspacePath.trim() || 'C:\\Projects');
      }
      setStep(step + 1);
    } else {
      localStorage.setItem('cortex-workspace-path', workspacePath.trim() || 'C:\\Projects');
      onComplete();
    }
  };

  const handleBrowse = async () => {
    setIsBrowsing(true);
    try {
      const selected = await pickDirectory();
      if (selected) {
        setWorkspacePath(selected);
      }
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleThemeSelect = (t: 'dark' | 'light') => {
    onThemeChange(t);
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const isRtl = locale === 'ar';

  return (
    <div className="onboarding-overlay">
      {/* Draggable Window Bar & Native Controls */}
      <header className="auth-titlebar" data-tauri-drag-region>
        <div className="auth-titlebar-brand">
          <img src="/logo.png" alt="CortexOS" />
          <span>CORTEXOS // WORKSTATION INITIALIZATION</span>
        </div>
        <WindowControls />
      </header>

      <div className="onboarding-wizard-container" style={{ width: '640px', maxWidth: '92vw', position: 'relative', marginTop: '20px' }}>
        
        {/* Progress Dots / Steps Indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ 
              flex: 1, 
              height: '4px', 
              background: i <= step ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.6)',
              borderRadius: '2px',
              transition: 'background 250ms ease'
            }} />
          ))}
        </div>

        <div className="onboarding-wizard-panel page-in">
          
          {/* Step 0: Language Selection */}
          {step === 0 && (
            <div className="wizard-step page-in">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ width: 68, height: 68, background: 'hsl(var(--primary) / 0.12)', borderRadius: '20px', display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
                  <img src="/logo.png" alt="Logo" style={{ width: 40, height: 40 }} />
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '6px' }}>
                  {isRtl ? 'مرحباً بك في CortexOS' : 'Welcome to CortexOS'}
                </h1>
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px', margin: 0 }}>
                  {isRtl ? 'اختر لغة واجهة النظام المفضلة لديك' : 'Choose your preferred workstation language'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <button 
                  type="button"
                  className={`pref-card ${locale === 'en' ? 'pref-card-active' : ''}`}
                  onClick={() => setLocale('en')}
                  style={{ height: '72px', justifyContent: 'flex-start', padding: '0 18px' }}
                >
                  <div className="pref-icon-box">
                    <Globe size={18} className="text-cyan" />
                  </div>
                  <div className="pref-content">
                    <b>English</b>
                    <small>Default workstation</small>
                  </div>
                  {locale === 'en' && <span className="pref-check-badge"><CheckCircle2 size={13} /></span>}
                </button>

                <button 
                  type="button"
                  className={`pref-card ${locale === 'ar' ? 'pref-card-active' : ''}`}
                  onClick={() => setLocale('ar')}
                  style={{ height: '72px', justifyContent: 'flex-start', padding: '0 18px' }}
                >
                  <div className="pref-icon-box">
                    <Globe size={18} className="text-emerald-400" />
                  </div>
                  <div className="pref-content">
                    <b>العربية</b>
                    <small>واجهة عربية كاملة RTL</small>
                  </div>
                  {locale === 'ar' && <span className="pref-check-badge"><CheckCircle2 size={13} /></span>}
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Default Workspace & Projects Path Setup */}
          {step === 1 && (
            <div className="wizard-step page-in">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ width: 56, height: 56, background: 'hsl(var(--primary) / 0.1)', borderRadius: '16px', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'hsl(var(--primary))' }}>
                  <FolderKanban size={26} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
                  {isRtl ? 'مسار مجلد المشاريع الافتراضي' : 'Default Projects Directory'}
                </h1>
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px', margin: 0, maxWidth: '480px', marginInline: 'auto' }}>
                  {isRtl 
                    ? 'حدد المسار المحلي الذي يحتوي على مجلدات مشاريعك ليقوم النظام بالتعرف عليها تلقائياً دون أي أخطاء.' 
                    : 'Set the local folder where your programming projects reside for automatic discovery and sync.'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    {isRtl ? 'مسار المشاريع (Projects Folder Path)' : 'Projects Directory Path'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                      <Folder size={16} style={{ position: 'absolute', insetInlineStart: '12px', color: 'hsl(var(--primary))', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        value={workspacePath}
                        onChange={(e) => setWorkspacePath(e.target.value)}
                        placeholder="C:\Projects"
                        className="mono"
                        style={{ 
                          width: '100%', 
                          height: '42px', 
                          paddingInlineStart: '38px', 
                          paddingInlineEnd: '14px', 
                          background: 'hsl(var(--secondary) / 0.5)', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px', 
                          color: 'hsl(var(--foreground))',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleBrowse}
                      disabled={isBrowsing}
                      className="btn btn-primary focus-ring"
                      style={{ height: '42px', padding: '0 16px', gap: '8px', flexShrink: 0 }}
                      data-testid="button-browse-projects"
                    >
                      <FolderSearch size={16} />
                      <span>{isBrowsing ? (isRtl ? 'جارٍ الفتح...' : 'Opening...') : (isRtl ? 'استعراض...' : 'Browse...')}</span>
                    </button>
                  </div>
                </label>

                {/* Quick suggestions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
                    {isRtl ? 'مسارات سريعة مقترحة:' : 'Quick suggestions:'}
                  </span>
                  {['C:\\Projects', 'D:\\Projects', 'C:\\dev26-27\\app'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setWorkspacePath(p)}
                      className="btn btn-outline"
                      style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Performance Profile & Motion Mode */}
          {step === 2 && (
            <div className="wizard-step page-in">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ width: 56, height: 56, background: 'hsl(var(--primary) / 0.1)', borderRadius: '16px', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'hsl(var(--primary))' }}>
                  <Zap size={26} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
                  {isRtl ? 'نمط الأداء والانيميشن' : 'Performance & Motion Profile'}
                </h1>
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px', margin: 0 }}>
                  {isRtl ? 'اختر النمط المناسب لقوة جهازك واستهلاك البطارية' : 'Select optimization profile suited for your hardware'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* FAST Mode */}
                <button 
                  type="button"
                  className={`pref-card ${motionMode === 'minimal' ? 'pref-card-active' : ''}`}
                  onClick={() => onMotionChange('minimal')}
                  style={{ height: '100px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', gap: '8px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={16} className="text-cyan" />
                      <b>FAST</b>
                    </div>
                    {motionMode === 'minimal' && <span className="pref-check-badge"><CheckCircle2 size={13} /></span>}
                  </div>
                  <small style={{ fontSize: '11.5px', color: 'hsl(var(--muted-foreground))', textAlign: 'start' }}>
                    {isRtl ? 'أقصى كفاءة للموارد، رسومات بيانية ثابتة وخفيفة، مثالي للأجهزة المحمولة والضعيفة.' : 'Ultra-low CPU footprint, instant charts, optimized for laptops and low-spec machines.'}
                  </small>
                </button>

                {/* STUDIO SMOOTH Mode */}
                <button 
                  type="button"
                  className={`pref-card ${motionMode === 'cinematic' ? 'pref-card-active' : ''}`}
                  onClick={() => onMotionChange('cinematic')}
                  style={{ height: '100px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', gap: '8px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} className="text-amber-400" />
                      <b>STUDIO SMOOTH</b>
                    </div>
                    {motionMode === 'cinematic' && <span className="pref-check-badge"><CheckCircle2 size={13} /></span>}
                  </div>
                  <small style={{ fontSize: '11.5px', color: 'hsl(var(--muted-foreground))', textAlign: 'start' }}>
                    {isRtl ? 'حركة انسيابية 60 إطاراً، منحنيات بيزير متقدمة مع تسريع كرت الشاشة بالكامل.' : 'Fluid 60 FPS motion, smooth bezier telemetry curves with full GPU acceleration.'}
                  </small>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Theme Selection */}
          {step === 3 && (
            <div className="wizard-step page-in">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ width: 56, height: 56, background: 'hsl(var(--primary) / 0.1)', borderRadius: '16px', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'hsl(var(--primary))' }}>
                  <Monitor size={26} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
                  {isRtl ? 'المظهر وسمة الألوان' : 'Workstation Theme'}
                </h1>
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px', margin: 0 }}>
                  {isRtl ? 'اختر السمة التي تفضل العمل بها' : 'Select your visual appearance theme'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <button 
                  type="button"
                  className={`pref-card ${theme === 'dark' ? 'pref-card-active' : ''}`}
                  onClick={() => handleThemeSelect('dark')}
                  style={{ height: '90px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Moon size={24} className="text-cyan" />
                  <b>Dark Mode</b>
                  <small>{isRtl ? 'الوضع الداكن الموصى به' : 'Recommended cyberpunk dark'}</small>
                </button>

                <button 
                  type="button"
                  className={`pref-card ${theme === 'light' ? 'pref-card-active' : ''}`}
                  onClick={() => handleThemeSelect('light')}
                  style={{ height: '90px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Sun size={24} className="text-amber-400" />
                  <b>Light Mode</b>
                  <small>{isRtl ? 'الوضع الفاتح' : 'Clean high contrast light'}</small>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Setup Complete */}
          {step === 4 && (
            <div className="wizard-step page-in" style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 72, height: 72, background: 'hsl(var(--primary))', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: '#000000', boxShadow: '0 0 32px hsl(var(--primary) / 0.5)' }}>
                <CheckCircle2 size={36} />
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px' }}>
                {isRtl ? 'اكتمل إعداد محطة العمل بنجاح!' : 'Workstation Ready!'}
              </h1>
              <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13.5px', margin: 0, maxWidth: '420px', marginInline: 'auto', lineHeight: 1.5 }}>
                {isRtl 
                  ? 'تم حفظ كافة الإعدادات والمسارات بنجاح. أنت الآن جاهز لبدء استخدام CortexOS بكامل كفاءته.' 
                  : 'All preferences and directories have been initialized. You are ready to launch CortexOS.'}
              </p>
            </div>
          )}

          {/* Wizard Footer Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid hsl(var(--border))' }}>
            {step > 0 ? (
              <button 
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(step - 1)}
                style={{ padding: '0 20px' }}
              >
                {isRtl ? 'السابق' : 'Back'}
              </button>
            ) : <div />}

            <button 
              type="button"
              className="btn btn-accent" 
              onClick={nextStep} 
              style={{ padding: '0 24px', height: '36px', gap: '8px' }}
            >
              <span>{step === totalSteps - 1 ? (isRtl ? 'إطلاق النظام' : 'Launch CortexOS') : (isRtl ? 'التالي' : 'Continue')}</span>
              <ChevronRight size={16} className={isRtl ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
