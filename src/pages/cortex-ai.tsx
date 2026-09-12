import { useState } from 'react';
import {
  BrainCircuit,
  Cpu,
  GraduationCap,
  Lightbulb,
  Terminal,
  Save,
  RotateCcw,
  Play,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  BookOpen,
  Code2,
  ShieldCheck,
  Zap,
  Bot,
  Globe,
  Sliders,
  Flame,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { apiPost } from '@/lib/api-client';

export type CortexTier = 'flash' | 'pro' | 'ultra';
export type TeachingStyle = 'socratic' | 'professor' | 'coach' | 'crammer';
export type AiLanguage = 'auto' | 'arabic' | 'english' | 'bilingual';

interface ModelTierConfig {
  id: CortexTier;
  titleKey: string;
  badgeKey: string;
  descKey: string;
  speedKey: string;
  contextKey: string;
  scoreKey: string;
  latencyMs: number;
  contextTokens: string;
  reasoningEffort: string;
  icon: typeof Zap;
}

const MODEL_TIERS: ModelTierConfig[] = [
  {
    id: 'flash',
    titleKey: 'cortexAi.tierFlash',
    badgeKey: 'cortexAi.tierFlashBadge',
    descKey: 'cortexAi.tierFlashDesc',
    speedKey: 'cortexAi.tierFlashSpeed',
    contextKey: 'cortexAi.tierFlashContext',
    scoreKey: 'cortexAi.tierFlashScore',
    latencyMs: 42,
    contextTokens: '32,000 tokens',
    reasoningEffort: 'Direct Matrix (Instant)',
    icon: Zap
  },
  {
    id: 'pro',
    titleKey: 'cortexAi.tierPro',
    badgeKey: 'cortexAi.tierProBadge',
    descKey: 'cortexAi.tierProDesc',
    speedKey: 'cortexAi.tierProSpeed',
    contextKey: 'cortexAi.tierProContext',
    scoreKey: 'cortexAi.tierProScore',
    latencyMs: 145,
    contextTokens: '128,000 tokens',
    reasoningEffort: 'Guided CoT (Multi-Pass)',
    icon: Cpu
  },
  {
    id: 'ultra',
    titleKey: 'cortexAi.tierUltra',
    badgeKey: 'cortexAi.tierUltraBadge',
    descKey: 'cortexAi.tierUltraDesc',
    speedKey: 'cortexAi.tierUltraSpeed',
    contextKey: 'cortexAi.tierUltraContext',
    scoreKey: 'cortexAi.tierUltraScore',
    latencyMs: 315,
    contextTokens: '1,000,000 tokens',
    reasoningEffort: 'Deep Neural Proofs & Synthesis',
    icon: Flame
  }
];

interface TeachingStyleConfig {
  id: TeachingStyle;
  titleKey: string;
  descKey: string;
  icon: typeof Lightbulb;
}

const TEACHING_STYLES: TeachingStyleConfig[] = [
  {
    id: 'socratic',
    titleKey: 'cortexAi.styleSocratic',
    descKey: 'cortexAi.styleSocraticDesc',
    icon: Lightbulb
  },
  {
    id: 'professor',
    titleKey: 'cortexAi.styleProfessor',
    descKey: 'cortexAi.styleProfessorDesc',
    icon: GraduationCap
  },
  {
    id: 'coach',
    titleKey: 'cortexAi.styleCoach',
    descKey: 'cortexAi.styleCoachDesc',
    icon: UserCheck
  },
  {
    id: 'crammer',
    titleKey: 'cortexAi.styleCrammer',
    descKey: 'cortexAi.styleCrammerDesc',
    icon: Zap
  }
];

interface AiLanguageConfig {
  id: AiLanguage;
  titleKey: string;
  descKey: string;
  badge: string;
}

const AI_LANGUAGES: AiLanguageConfig[] = [
  {
    id: 'arabic',
    titleKey: 'cortexAi.langArabic',
    descKey: 'cortexAi.langArabicDesc',
    badge: 'AR'
  },
  {
    id: 'english',
    titleKey: 'cortexAi.langEnglish',
    descKey: 'cortexAi.langEnglishDesc',
    badge: 'EN'
  },
  {
    id: 'bilingual',
    titleKey: 'cortexAi.langBilingual',
    descKey: 'cortexAi.langBilingualDesc',
    badge: 'AR+EN'
  },
  {
    id: 'auto',
    titleKey: 'cortexAi.langAuto',
    descKey: 'cortexAi.langAutoDesc',
    badge: 'AUTO'
  }
];

export default function CortexAiPage({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();

  // Active Sub-tab in Config Column
  const [activeTab, setActiveTab] = useState<'tiers' | 'persona' | 'tuning'>('tiers');

  // 1. Persistent CORTEXAI Model Tier
  const [selectedTier, setSelectedTier] = usePersistent<CortexTier>('cortex-ai-tier', 'pro');

  // 2. Persistent Custom AI Name
  const [customAiName, setCustomAiName] = usePersistent<string>('cortex-ai-name', 'CORTEX');

  // 3. Persistent AI Response Language (Independent from app language)
  const [aiLanguage, setAiLanguage] = usePersistent<AiLanguage>('cortex-ai-language', 'auto');

  // 4. Persistent Teaching & Mentoring Style
  const [teachingStyle, setTeachingStyle] = usePersistent<TeachingStyle>('cortex-ai-teaching-style', 'professor');

  // 5. Neural Tuning Parameters
  const [academicLevel, setAcademicLevel] = usePersistent<'highschool' | 'undergrad' | 'postgrad' | 'pro'>('cortex-ai-academic-level', 'undergrad');
  const [temperature, setTemperature] = usePersistent<number>('cortex-ai-temp', 0.35);
  const [reasoningDepth, setReasoningDepth] = usePersistent<'instant' | 'balanced' | 'deep'>('cortex-ai-reasoning-depth', 'balanced');
  const [customDirectives, setCustomDirectives] = usePersistent<string>(
    'cortex-ai-custom-prompt',
    'Enforce rigorous academic precision, high-yield exam question generation, and zero-slop algorithmic derivation.'
  );

  // 6. Grounding Switches
  const [groundInVault, setGroundInVault] = usePersistent<boolean>('cortex-ai-ground-vault', true);
  const [groundInCodebase, setGroundInCodebase] = usePersistent<boolean>('cortex-ai-ground-code', true);
  const [showThinkingTrace, setShowThinkingTrace] = usePersistent<boolean>('cortex-ai-show-cot', true);

  // Live Playground State
  const [testInput, setTestInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReasoningBox, setShowReasoningBox] = useState(true);
  const [playgroundOutput, setPlaygroundOutput] = useState<{
    thinking: string;
    answer: string;
    tokens: number;
    latencyMs: number;
  } | null>({
    thinking: `Synthesizing with CORTEXAI (Tier: Pro, Active Name: "${customAiName}"). Evaluating algorithmic complexity, cache hierarchy, and state machine invariants. Grounding in local study vault.`,
    answer: `### CORTEXAI Analysis & Exam Invariant Matrix

1. **Fundamental Principle**: When traversing distributed state or binary search partitions, loop invariants guarantee termination without off-by-one errors.
2. **Time Complexity**: $\\mathcal{O}(\\log n)$ worst/average case; $\\mathcal{O}(1)$ space.
3. **Common Exam Trap**: Computing \`mid = (low + high) / 2\` can trigger integer overflow in 32-bit registers. The resilient pattern is \`mid = low + ((high - low) >> 1)\`.

*Signed by ${customAiName} (${t('cortexAi.tierPro')})*`,
    tokens: 382,
    latencyMs: 145
  });

  const activeTierConfig = MODEL_TIERS.find((tier) => tier.id === selectedTier) || MODEL_TIERS[1];

  const handleResetDefaults = () => {
    setSelectedTier('pro');
    setCustomAiName('CORTEX');
    setAiLanguage('auto');
    setTeachingStyle('professor');
    setAcademicLevel('undergrad');
    setTemperature(0.35);
    setReasoningDepth('balanced');
    setCustomDirectives('Enforce rigorous academic precision, high-yield exam question generation, and zero-slop algorithmic derivation.');
    setGroundInVault(true);
    setGroundInCodebase(true);
    setShowThinkingTrace(true);
    notify(locale === 'ar' ? 'تمت استعادة إعدادات CORTEXAI الافتراضية' : 'CORTEXAI defaults restored');
  };

  const handleSaveProfile = () => {
    notify(locale === 'ar' ? `تم حفظ ملف ${customAiName} بنجاح!` : `Saved ${customAiName} profile successfully!`);
  };

  const handleAppendDirective = (directive: string) => {
    setCustomDirectives((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return directive;
      return `${trimmed}\n- ${directive}`;
    });
  };

  const handleRunPlayground = async () => {
    const query = testInput.trim();
    if (!query) return;
    setIsGenerating(true);

    try {
      const res = await apiPost<{
        ok: boolean;
        answer: string;
        thinking?: string;
        tokens?: number;
        latency_ms?: number;
        tier?: string;
        ai_name?: string;
        provider?: string;
        model?: string;
        error?: string;
      }>('/ai/cortex-chat', {
        prompt: query,
        tier: selectedTier,
        ai_name: customAiName,
        language: aiLanguage,
        teaching_style: teachingStyle,
        academic_level: academicLevel,
        temperature: temperature,
        reasoning_depth: reasoningDepth,
        custom_directives: customDirectives,
        ground_in_vault: groundInVault,
        ground_in_codebase: groundInCodebase,
        show_thinking_trace: showThinkingTrace
      });

      if (res && res.ok) {
        setPlaygroundOutput({
          thinking: res.thinking || (selectedTier === 'ultra' ? 'Neural chain-of-thought resolved with DeepSeek R1.' : `Synthesized via ${res.model || 'CORTEXAI'}`),
          answer: res.answer,
          tokens: res.tokens || 250,
          latencyMs: res.latency_ms || activeTierConfig.latencyMs
        });
      } else {
        throw new Error(res?.error || 'Neural inference failed');
      }
    } catch (err: any) {
      console.error('[cortex-ai] Generation error:', err);
      notify(locale === 'ar' ? `خطأ أثناء المعالجة: ${err.message || 'فشل الاتصال بالخادم'}` : `Neural synthesis error: ${err.message || 'Server error'}`);
      
      // Resilient fallback output so user is informed without UI crash
      setPlaygroundOutput({
        thinking: `Connection notice: ${err.message || 'Backend daemon probe'}`,
        answer: locale === 'ar'
          ? `### تنبيه الاتصال بـ CORTEXAI\n\nتعذر إتمام الاستدعاء العصبي الحي: ${err.message || 'فشل الاتصال'}\nتأكد من أن خادم الخلفية (Daemon) قيد التشغيل على المنفذ 8000.`
          : `### CORTEXAI Connection Notice\n\nLive neural call encountered an issue: ${err.message || 'Connection failed'}\nPlease ensure the backend daemon is running on port 8000.`,
        tokens: 45,
        latencyMs: activeTierConfig.latencyMs
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-in min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-[1540px] mx-auto space-y-6">
      
      {/* 1. Header Bar: Identity & Engine Status */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              03 / NEURAL INTELLIGENCE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/30 text-cyan flex items-center gap-1 font-semibold">
              <Zap size={11} />
              <span>{t('cortexAi.statusOnline')}</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-foreground font-semibold">
              {customAiName} · {t(activeTierConfig.badgeKey)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BrainCircuit size={24} className="text-cyan" />
            <span>{t('cortexAi.pageTitle')}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {t('cortexAi.pageSubtitle')}
          </p>
        </div>

        {/* Global Preset Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn btn-outline text-xs h-[34px] px-3 gap-1.5 font-mono hover:border-primary/40"
            title={t('cortexAi.resetDefaults')}
          >
            <RotateCcw size={13} />
            <span>{t('cortexAi.resetDefaults')}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveProfile}
            className="btn btn-primary text-xs h-[34px] px-3.5 gap-1.5 font-mono shadow-sm"
          >
            <Save size={13} />
            <span>{t('cortexAi.saveProfile')}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Studio Grid: Configuration (7 Cols) + Live Playground (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: AI Tuning, Tiers, Identity & Pedagogy */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Subtabs Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('tiers')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'tiers'
                  ? 'bg-card text-cyan font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Cpu size={14} />
              <span>{t('cortexAi.tabTiers')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('persona')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'persona'
                  ? 'bg-card text-cyan font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Bot size={14} />
              <span>{t('cortexAi.tabPersona')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tuning')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'tuning'
                  ? 'bg-card text-cyan font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Sliders size={14} />
              <span>{t('cortexAi.tabGrounding')}</span>
            </button>
          </div>

          {/* TAB 1: MODEL TIERS (FLASH / PRO / ULTRA) */}
          {activeTab === 'tiers' && (
            <div className="space-y-4">
              <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Zap size={18} className="text-cyan" />
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">{t('cortexAi.tierSectionTitle')}</h2>
                      <p className="text-[11px] text-muted-foreground">{t('cortexAi.tierSectionDesc')}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-cyan px-2.5 py-1 rounded-full bg-cyan/10 border border-cyan/30 font-bold">
                    {t(activeTierConfig.titleKey)}
                  </span>
                </div>

                {/* 3 Tier Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MODEL_TIERS.map((tier) => {
                    const TierIcon = tier.icon;
                    const isSelected = tier.id === selectedTier;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => {
                          setSelectedTier(tier.id);
                          notify(locale === 'ar' ? `تم تفعيل فئة ${t(tier.titleKey)}` : `Activated ${t(tier.titleKey)}`);
                        }}
                        className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                          isSelected
                            ? 'border-cyan bg-cyan/10 shadow-xs ring-1 ring-cyan/40'
                            : 'border-border/80 hover:border-primary/40 hover:bg-muted/40 bg-card'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-cyan text-black' : 'bg-muted text-foreground'}`}>
                            <TierIcon size={18} />
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-cyan text-black flex items-center justify-center text-[11px] font-bold">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <b className="text-xs font-semibold text-foreground">{t(tier.titleKey)}</b>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted border border-border text-muted-foreground">
                              {t(tier.badgeKey)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                            {t(tier.descKey)}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-border/80 space-y-1 text-[10px] font-mono text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Latency:</span>
                            <span className="text-foreground font-semibold">{t(tier.speedKey)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Context:</span>
                            <span className="text-foreground font-semibold">{t(tier.contextKey)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Tier Hardware & Capabilities Breakdown */}
                <div className="p-3.5 rounded-lg bg-muted/50 border border-border text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Active Architecture:</span>
                    <span className="text-cyan font-bold">{t(activeTierConfig.titleKey)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Reasoning Strategy:</span>
                    <span className="text-foreground">{activeTierConfig.reasoningEffort}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Context Depth:</span>
                    <span className="text-foreground">{activeTierConfig.contextTokens}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IDENTITY, AI NAME, LANGUAGE & TEACHING STYLE */}
          {activeTab === 'persona' && (
            <div className="space-y-4">
              {/* Section A: AI Name & Title */}
              <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Bot size={17} className="text-cyan" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('cortexAi.identitySectionTitle')}</h2>
                    <p className="text-[11px] text-muted-foreground">{t('cortexAi.aiNameHint')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customAiName}
                      onChange={(e) => setCustomAiName(e.target.value)}
                      placeholder={t('cortexAi.aiNamePlaceholder')}
                      className="editable-input flex-1 text-xs font-mono"
                    />
                  </div>

                  {/* Quick Name Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      t('cortexAi.namePresetCortex'),
                      t('cortexAi.namePresetProfessor'),
                      t('cortexAi.namePresetTutor'),
                      t('cortexAi.namePresetMentor')
                    ].map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setCustomAiName(name)}
                        className={`px-2 py-1 rounded text-[11px] font-mono transition border ${
                          customAiName === name
                            ? 'border-cyan bg-cyan/15 text-cyan font-bold'
                            : 'bg-muted/70 border-border text-foreground hover:border-cyan'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section B: AI Response Language (Independent from App UI) */}
              <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Globe size={17} className="text-cyan" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('cortexAi.languageSectionTitle')}</h2>
                    <p className="text-[11px] text-muted-foreground">{t('cortexAi.languageSectionDesc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AI_LANGUAGES.map((lang) => {
                    const isSelected = lang.id === aiLanguage;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => {
                          setAiLanguage(lang.id);
                          notify(locale === 'ar' ? `لغة ردود الذكاء: ${t(lang.titleKey)}` : `AI Response Language: ${t(lang.titleKey)}`);
                        }}
                        className={`p-3 rounded-lg border text-start transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'border-cyan bg-cyan/10 shadow-xs ring-1 ring-cyan/40'
                            : 'border-border/80 hover:border-primary/40 hover:bg-muted/40 bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <b className="text-xs font-semibold text-foreground">{t(lang.titleKey)}</b>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                            {lang.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {t(lang.descKey)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section C: Teaching Methodology & Mentorship Style */}
              <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap size={17} className="text-cyan" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('cortexAi.teachingStyleTitle')}</h2>
                    <p className="text-[11px] text-muted-foreground">{t('cortexAi.teachingStyleDesc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TEACHING_STYLES.map((style) => {
                    const StyleIcon = style.icon;
                    const isSelected = style.id === teachingStyle;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          setTeachingStyle(style.id);
                          notify(locale === 'ar' ? `أسلوب التدريس: ${t(style.titleKey)}` : `Teaching Style: ${t(style.titleKey)}`);
                        }}
                        className={`p-3 rounded-lg border text-start transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'border-cyan bg-cyan/10 shadow-xs ring-1 ring-cyan/40'
                            : 'border-border/80 hover:border-primary/40 hover:bg-muted/40 bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${isSelected ? 'bg-cyan text-black' : 'bg-muted text-foreground'}`}>
                            <StyleIcon size={16} />
                          </div>
                          <b className="text-xs font-semibold text-foreground">{t(style.titleKey)}</b>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {t(style.descKey)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GROUNDING, PARAMETERS & CUSTOM DIRECTIVES */}
          {activeTab === 'tuning' && (
            <div className="space-y-4">
              {/* Grounding Switches (Rule 04 Anti-Slop Compliant) */}
              <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck size={16} className="text-cyan" />
                  <span>{t('cortexAi.knowledgeGateways')}</span>
                </h2>

                <div className="space-y-2">
                  {/* Switch 1: Study Vault */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <BookOpen size={14} className="text-cyan" />
                        <span>{t('cortexAi.groundVault')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('cortexAi.groundVaultDesc')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGroundInVault(!groundInVault)}
                      className={`toggle ${groundInVault ? 'toggle-on' : ''}`}
                      role="switch"
                      aria-checked={groundInVault}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>

                  {/* Switch 2: Active Codebase */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Code2 size={14} className="text-cyan" />
                        <span>{t('cortexAi.groundCodebase')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('cortexAi.groundCodebaseDesc')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGroundInCodebase(!groundInCodebase)}
                      className={`toggle ${groundInCodebase ? 'toggle-on' : ''}`}
                      role="switch"
                      aria-checked={groundInCodebase}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>

                  {/* Switch 3: Chain-of-Thought Trace */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Cpu size={14} className="text-cyan" />
                        <span>{t('cortexAi.showCot')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('cortexAi.showCotDesc')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowThinkingTrace(!showThinkingTrace)}
                      className={`toggle ${showThinkingTrace ? 'toggle-on' : ''}`}
                      role="switch"
                      aria-checked={showThinkingTrace}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tuning Matrix: Academic Level & Temperature */}
              <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders size={17} className="text-cyan" />
                  <h2 className="text-sm font-semibold text-foreground">{t('cortexAi.tuningTitle')}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      <GraduationCap size={13} />
                      <span>{t('cortexAi.academicLevel')}</span>
                    </label>
                    <select
                      value={academicLevel}
                      onChange={(e) => setAcademicLevel(e.target.value as any)}
                      className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground w-full focus-ring cursor-pointer hover:border-cyan"
                    >
                      <option value="highschool">{t('cortexAi.levelHighschool')}</option>
                      <option value="undergrad">{t('cortexAi.levelUndergrad')}</option>
                      <option value="postgrad">{t('cortexAi.levelPostgrad')}</option>
                      <option value="pro">{t('cortexAi.levelPro')}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      <Cpu size={13} />
                      <span>{t('cortexAi.reasoningDepth')}</span>
                    </label>
                    <select
                      value={reasoningDepth}
                      onChange={(e) => setReasoningDepth(e.target.value as any)}
                      className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground w-full focus-ring cursor-pointer hover:border-cyan"
                    >
                      <option value="instant">{t('cortexAi.depthInstant')}</option>
                      <option value="balanced">{t('cortexAi.depthBalanced')}</option>
                      <option value="deep">{t('cortexAi.depthDeep')}</option>
                    </select>
                  </div>
                </div>

                {/* Creativity Temperature */}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{t('cortexAi.temperature')}</span>
                    <span className="text-cyan font-bold">{temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-cyan cursor-pointer h-1.5 bg-muted rounded-lg"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>{t('cortexAi.tempStrict')}</span>
                    <span>{t('cortexAi.tempCreative')}</span>
                  </div>
                </div>
              </div>

              {/* Custom Directives */}
              <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Terminal size={16} className="text-cyan" />
                    <span>{t('cortexAi.directivesTitle')}</span>
                  </h2>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {customDirectives.length} {t('cortexAi.chars')}
                  </span>
                </div>

                <textarea
                  value={customDirectives}
                  onChange={(e) => setCustomDirectives(e.target.value)}
                  rows={3}
                  className="editable-input w-full p-3 resize-y leading-relaxed text-xs font-mono"
                  placeholder={t('cortexAi.directivesPlaceholder')}
                />

                {/* Quick Directive Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">{t('cortexAi.quickAddDirectives')}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAppendDirective(locale === 'ar' ? 'قم دائماً بصياغة المعادلات الرياضية بتنسيق LaTeX واضح' : 'Always format mathematical equations in LaTeX notation')}
                      className="px-2 py-1 rounded bg-muted/80 border border-border hover:border-cyan hover:text-cyan text-[11px] text-foreground font-mono transition"
                    >
                      + LaTeX Math
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAppendDirective(locale === 'ar' ? 'اذكر فخاخ الامتحانات الشائعة التي يقع فيها الطلاب' : 'Highlight tricky exam traps students frequently fall into')}
                      className="px-2 py-1 rounded bg-muted/80 border border-border hover:border-cyan hover:text-cyan text-[11px] text-foreground font-mono transition"
                    >
                      + Exam Traps
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAppendDirective(locale === 'ar' ? 'أضف في نهاية الشرح 3 أسئلة تدريبية مع الإجابات النموذجية' : 'Append 3 practice multiple-choice questions with answer rationales')}
                      className="px-2 py-1 rounded bg-muted/80 border border-border hover:border-cyan hover:text-cyan text-[11px] text-foreground font-mono transition"
                    >
                      + 3 Practice Qs
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAppendDirective(locale === 'ar' ? 'التزم بأسلوب كود خالي من الهبد وموثق بالتعقيد الزمني' : 'Strict anti-slop code style with Big-O time and space complexity')}
                      className="px-2 py-1 rounded bg-muted/80 border border-border hover:border-cyan hover:text-cyan text-[11px] text-foreground font-mono transition"
                    >
                      + Big-O Complexity
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Live Neural Test Bench & Playground */}
        <div className="lg:col-span-5 space-y-4">
          <div className="panel p-4 sm:p-5 rounded-xl border border-border space-y-4 sticky top-4">
            
            {/* Bench Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Play size={16} className="text-cyan fill-cyan" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t('cortexAi.playgroundTitle')}</h3>
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    {customAiName} ({t(activeTierConfig.titleKey)})
                  </span>
                </div>
              </div>
              {playgroundOutput && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span className="text-cyan font-bold">{playgroundOutput.latencyMs}ms</span>
                  <span>·</span>
                  <span>{playgroundOutput.tokens} tokens</span>
                </div>
              )}
            </div>

            {/* Quick Test Prompt Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">{t('cortexAi.samplePrompts')}</span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setTestInput(locale === 'ar' ? 'اشرح مبدأ الـ Virtual Memory وكيف يتعامل نظام التشغيل مع Page Fault.' : 'Explain Virtual Memory and how the OS handles a Page Fault step-by-step.')}
                  className="text-start px-2.5 py-1.5 rounded-lg bg-card border border-border hover:border-cyan hover:text-cyan text-xs text-foreground font-mono truncate transition shadow-2xs"
                >
                  {locale === 'ar' ? '💡 شرح الـ Virtual Memory والـ Page Fault' : '💡 Virtual Memory & Page Fault Breakdown'}
                </button>
                <button
                  type="button"
                  onClick={() => setTestInput(locale === 'ar' ? 'أنشئ سؤالين امتحانيين في هياكل البيانات (AVL Trees) مع خيارات متعددة وشرح.' : 'Create 2 university exam multiple-choice questions on AVL Trees with explanations.')}
                  className="text-start px-2.5 py-1.5 rounded-lg bg-card border border-border hover:border-cyan hover:text-cyan text-xs text-foreground font-mono truncate transition shadow-2xs"
                >
                  {locale === 'ar' ? '📝 توليد أسئلة امتحان في AVL Trees' : '📝 AVL Trees Exam Simulator Questions'}
                </button>
                <button
                  type="button"
                  onClick={() => setTestInput(locale === 'ar' ? 'راجع هذا الكود وأخبرني أين يقع تسريب الذاكرة أو الخطأ المنطقي.' : 'Audit this concurrency scenario for race conditions and deadlocks.')}
                  className="text-start px-2.5 py-1.5 rounded-lg bg-card border border-border hover:border-cyan hover:text-cyan text-xs text-foreground font-mono truncate transition shadow-2xs"
                >
                  {locale === 'ar' ? '⚡ فحص Deadlocks في تزامن الخيوط' : '⚡ Concurrency Deadlock & Race Condition Check'}
                </button>
              </div>
            </div>

            {/* Input & Run Action */}
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleRunPlayground();
                    }
                  }}
                  rows={3}
                  className="editable-input w-full p-2.5 text-xs font-mono resize-none leading-relaxed"
                  placeholder={t('cortexAi.playgroundPlaceholder')}
                />
              </div>

              <button
                type="button"
                onClick={handleRunPlayground}
                disabled={isGenerating || !testInput.trim()}
                className="btn btn-primary w-full text-xs h-[36px] gap-2 font-mono shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-black" />
                    <span>{t('cortexAi.synthesizing')}</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>{t('cortexAi.runSynthesis')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Output Display */}
            {playgroundOutput && (
              <div className="space-y-3 pt-2">
                {/* Collapsible Reasoning Trace (Chain of Thought) */}
                {showThinkingTrace && (
                  <div className="rounded-lg border border-cyan/30 bg-cyan/5 overflow-hidden text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setShowReasoningBox(!showReasoningBox)}
                      className="w-full px-3 py-2 flex items-center justify-between text-[11px] text-cyan hover:bg-cyan/10 transition"
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Cpu size={12} />
                        <span>{t('cortexAi.chainOfThought')}</span>
                      </span>
                      {showReasoningBox ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {showReasoningBox && (
                      <div className="p-3 pt-0 text-[11px] text-foreground/80 leading-relaxed border-t border-cyan/20">
                        {playgroundOutput.thinking}
                      </div>
                    )}
                  </div>
                )}

                {/* Final Answer Card */}
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pb-1.5 border-b border-border">
                    <span className="text-cyan uppercase font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>{t('cortexAi.responseHeader')} {customAiName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(playgroundOutput.answer);
                        notify(t('cortexAi.copied'));
                      }}
                      className="hover:text-cyan text-muted-foreground transition flex items-center gap-1 cursor-pointer"
                    >
                      <Copy size={11} />
                      <span>{t('cortexAi.copy')}</span>
                    </button>
                  </div>
                  <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                    {playgroundOutput.answer}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
