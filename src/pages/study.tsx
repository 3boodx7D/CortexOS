import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  Check,
  RefreshCw,
  Sparkles,
  BookOpen,
  Zap,
  Wand2,
  Copy,
  Download,
  Upload,
  Trash2,
  Lightbulb,
  MessageSquare,
  Target,
  Layers,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserPersistent } from '@/lib/user-store';
import { useUserContext } from '@/lib/user-store';

interface QuizQuestion {
  question: string;
  choices: string[];
  correct: number;
  explanation: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface StudySession {
  lecture: string;
  summary: string;
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
  aiModel: string;
  createdAt: string;
}

export default function Study({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();
  const { syncStudyData, loadStudyData } = useUserContext();

  // Lecture & Summary State
  const [lecture, setLecture] = useUserPersistent('study-lecture', '');
  const [summary, setSummary] = useState<string>('');
  const [generating, setGenerating] = useState<'idle' | 'summary' | 'quiz' | 'flashcards'>('idle');
  const [aiModel, setAiModel] = useState('Google Gemini 3.5 Flash-Lite');
  const [aiError, setAiError] = useState<string | null>(null);

  // Quiz State
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);

  // Flashcards State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<number | null>(null);

  // Session History
  const [sessions, setSessions] = useUserPersistent<StudySession[]>('study-sessions', []);
  const [activeSessionIndex, setActiveSessionIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Settings
  const [studyAiModel, setStudyAiModel] = useUserPersistent<'auto' | 'gemini-lite' | 'gemini-pro' | 'deepseek'>('study-ai-model', 'auto');
  const [autoGenerateQuiz, setAutoGenerateQuiz] = useUserPersistent('study-auto-quiz', true);
  const [autoGenerateFlashcards, setAutoGenerateFlashcards] = useUserPersistent('study-auto-flashcards', true);

  // Load study data from cloud on mount
  useEffect(() => {
    loadStudyData();
  }, [loadStudyData]);

  const wordCount = lecture.split(/\s+/).filter(Boolean).length;
  const score = Object.entries(answers).reduce((total, [i, a]) => total + (quiz[Number(i)]?.correct === a ? 1 : 0), 0);

  const callAI = async (prompt: string, systemPrompt: string, taskType: 'summary' | 'quiz' | 'flashcards') => {
    setGenerating(taskType);
    setAiError(null);
    try {
      const providerMap: Record<string, string> = {
        'auto': 'auto',
        'gemini-lite': 'gemini-lite',
        'gemini-pro': 'gemini-pro',
        'deepseek': 'deepseek'
      };
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: prompt,
          provider: providerMap[studyAiModel],
          systemPrompt,
          taskType
        })
      });
      if (res.ok) {
        const data = await res.json();
        const engineLabel = data.provider === 'deepseek' ? 'DeepSeek Chat (V4)' : 'Google Gemini 3.5 Flash-Lite';
        setAiModel(engineLabel);
        return data;
      } else {
        throw new Error('API request failed');
      }
    } catch (err: any) {
      const msg = err?.message || 'AI request failed';
      setAiError(msg);
      notify(`${t('study.aiError')}: ${msg}`);
      throw err;
    } finally {
      setGenerating('idle');
    }
  };

  const generateSummary = useCallback(async () => {
    if (!lecture.trim()) return;
    try {
      const systemPrompt = `You are CortexOS Neural Synthesizer. Provide a sharp, structured technical summary with:
1. Core thesis (1 sentence)
2. Key concepts (3-5 bullet points)
3. Practical takeaways (2-3 actionable items)
4. Connections to related topics

Format as clean markdown. Be concise but comprehensive.`;
      const data = await callAI(lecture, systemPrompt, 'summary');
      if (data?.summary) {
        setSummary(data.summary);
        notify(`${t('study.aiComplete')} ${data.provider === 'deepseek' ? 'DeepSeek Chat (V4)' : 'Google Gemini 3.5 Flash-Lite'}`);
      }
    } catch { /* handled in callAI */ }
  }, [lecture, studyAiModel, notify, t]);

  const generateQuiz = useCallback(async () => {
    if (!lecture.trim()) return;
    try {
      const systemPrompt = `You are CortexOS Recall Engine. Generate exactly 5 high-quality multiple-choice questions from the lecture.
Return JSON array: [{"question":"...","choices":["A","B","C"],"correct":0,"explanation":"why this is right"}]
- Test understanding, not memorization
- Mix conceptual and applied questions
- Explanations must be clear and educational
- Return ONLY valid JSON array`;
      const data = await callAI(lecture, systemPrompt, 'quiz');
      if (data?.quiz) {
        setQuiz(data.quiz);
        setAnswers({});
        setGraded(false);
        setShowExplanations(false);
        notify(t('study.quizGenerated'));
      } else if (data?.text) {
        // Fallback: parse text response
        try {
          const parsed = JSON.parse(data.text);
          if (Array.isArray(parsed)) {
            setQuiz(parsed);
            setAnswers({});
            setGraded(false);
            setShowExplanations(false);
            notify(t('study.quizGenerated'));
          }
        } catch {
          // Use local fallback
          generateLocalQuiz();
        }
      }
    } catch {
      generateLocalQuiz();
    }
  }, [lecture, studyAiModel, notify, t]);

  const generateLocalQuiz = () => {
    const sentences = lecture.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const localQuiz: QuizQuestion[] = [
      {
        question: t('study.localQ1'),
        choices: [t('study.localQ1A'), t('study.localQ1B'), t('study.localQ1C')],
        correct: 1,
        explanation: t('study.localQ1Exp')
      },
      {
        question: t('study.localQ2'),
        choices: [t('study.localQ2A'), t('study.localQ2B'), t('study.localQ2C')],
        correct: 0,
        explanation: t('study.localQ2Exp')
      },
      {
        question: t('study.localQ3'),
        choices: [t('study.localQ3A'), t('study.localQ3B'), t('study.localQ3C')],
        correct: 0,
        explanation: t('study.localQ3Exp')
      },
      {
        question: t('study.localQ4'),
        choices: [t('study.localQ4A'), t('study.localQ4B'), t('study.localQ4C')],
        correct: 0,
        explanation: t('study.localQ4Exp')
      },
      {
        question: t('study.localQ5'),
        choices: [t('study.localQ5A'), t('study.localQ5B'), t('study.localQ5C')],
        correct: 0,
        explanation: t('study.localQ5Exp')
      }
    ];
    setQuiz(localQuiz);
    setAnswers({});
    setGraded(false);
    setShowExplanations(false);
    notify(t('study.localFallback'));
  };

  const generateFlashcards = useCallback(async () => {
    if (!lecture.trim()) return;
    try {
      const systemPrompt = `You are CortexOS Memory Architect. Generate 5-8 high-yield flashcards from the lecture.
Return JSON array: [{"front":"Question/Concept","back":"Answer/Explanation"}]
- Focus on key definitions, relationships, and principles
- Front: concise question or term
- Back: clear, complete answer with context
- Return ONLY valid JSON array`;
      const data = await callAI(lecture, systemPrompt, 'flashcards');
      if (data?.flashcards) {
        setFlashcards(data.flashcards);
        setFlipped(null);
        notify(t('study.flashcardsGenerated'));
      } else if (data?.text) {
        try {
          const parsed = JSON.parse(data.text);
          if (Array.isArray(parsed)) {
            setFlashcards(parsed);
            setFlipped(null);
            notify(t('study.flashcardsGenerated'));
          }
        } catch {
          generateLocalFlashcards();
        }
      }
    } catch {
      generateLocalFlashcards();
    }
  }, [lecture, studyAiModel, notify, t]);

  const generateLocalFlashcards = () => {
    const localCards: Flashcard[] = [
      { front: t('study.localCard1F'), back: t('study.localCard1B') },
      { front: t('study.localCard2F'), back: t('study.localCard2B') },
      { front: t('study.localCard3F'), back: t('study.localCard3B') },
      { front: t('study.localCard4F'), back: t('study.localCard4B') },
      { front: t('study.localCard5F'), back: t('study.localCard5B') }
    ];
    setFlashcards(localCards);
    setFlipped(null);
    notify(t('study.localFallback'));
  };

  const generateAll = useCallback(async () => {
    await generateSummary();
    if (autoGenerateQuiz) await generateQuiz();
    if (autoGenerateFlashcards) await generateFlashcards();
  }, [generateSummary, generateQuiz, generateFlashcards, autoGenerateQuiz, autoGenerateFlashcards]);

  const saveSession = useCallback(async () => {
    if (!lecture.trim() && !summary.trim()) return;
    const session: StudySession = {
      lecture,
      summary,
      quiz,
      flashcards,
      aiModel,
      createdAt: new Date().toISOString()
    };
    const updated = [session, ...sessions].slice(0, 20);
    setSessions(updated);
    await syncStudyData({ sessions: updated });
    notify(t('study.sessionSaved'));
  }, [lecture, summary, quiz, flashcards, aiModel, sessions, setSessions, syncStudyData, notify, t]);

  const loadSession = useCallback(async (index: number) => {
    const session = sessions[index];
    if (!session) return;
    setLecture(session.lecture);
    setSummary(session.summary);
    setQuiz(session.quiz);
    setFlashcards(session.flashcards);
    setAiModel(session.aiModel);
    setAnswers({});
    setGraded(false);
    setFlipped(null);
    setShowExplanations(false);
    setActiveSessionIndex(index);
    notify(t('study.sessionLoaded'));
  }, [sessions, setLecture, notify, t]);

  const deleteSession = useCallback(async (index: number) => {
    const updated = sessions.filter((_, i) => i !== index);
    setSessions(updated);
    await syncStudyData({ sessions: updated });
    if (activeSessionIndex === index) setActiveSessionIndex(null);
    notify(t('study.sessionDeleted'));
  }, [sessions, setSessions, syncStudyData, activeSessionIndex, notify, t]);

  const clearAll = useCallback(async () => {
    setLecture('');
    setSummary('');
    setQuiz([]);
    setFlashcards([]);
    setAnswers({});
    setGraded(false);
    setFlipped(null);
    setShowExplanations(false);
    notify(t('study.cleared'));
  }, [setLecture, notify, t]);

  const exportSession = () => {
    if (!lecture.trim() && !summary.trim()) return;
    const session: StudySession = { lecture, summary, quiz, flashcards, aiModel, createdAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortexos-study-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(t('study.exported'));
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const session = JSON.parse(event.target?.result as string);
        if (session.lecture) setLecture(session.lecture);
        if (session.summary) setSummary(session.summary);
        if (session.quiz) setQuiz(session.quiz);
        if (session.flashcards) setFlashcards(session.flashcards);
        if (session.aiModel) setAiModel(session.aiModel);
        setAnswers({});
        setGraded(false);
        setFlipped(null);
        setShowExplanations(false);
        notify(t('study.imported'));
      } catch {
        notify(t('study.importError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="page-in">
      <div className="section-title">
        <div>
          <div className="eyebrow mono">{t('study.eyebrow')}</div>
          <h1>{t('study.title')}</h1>
          <p>{t('study.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="context-chip"><BrainCircuit size={14} />{t('study.aiActive')}</span>
          <div className="relative">
            <select
              value={studyAiModel}
              onChange={(e) => setStudyAiModel(e.target.value as any)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus-ring cursor-pointer"
            >
              <option value="auto">{t('study.aiAuto')}</option>
              <option value="gemini-lite">Google Gemini 3.5 Flash-Lite</option>
              <option value="gemini-pro">Google Gemini Pro</option>
              <option value="deepseek">DeepSeek V4</option>
            </select>
          </div>
        </div>
      </div>

      {aiError && (
        <div className="panel panel-alert" role="alert">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-sm">{aiError}</span>
          <button className="btn btn-ghost text-xs" onClick={() => setAiError(null)}>{t('common.dismiss')}</button>
        </div>
      )}

      <div className="study-grid">
        <section className="panel study-editor">
          <div className="panel-head">
            <span className="eyebrow mono">{t('study.lectureCapture')}</span>
            <span className="mono quiet">{t('study.cloudSync')}</span>
          </div>
          <textarea
            value={lecture}
            onChange={(e) => setLecture(e.target.value)}
            placeholder={t('study.lecturePlaceholder')}
            data-testid="input-lecture-text"
            className="lecture-textarea"
          />
          <div className="editor-foot">
            <span className="mono quiet">{wordCount} {t('study.words')}</span>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline focus-ring text-xs"
                onClick={clearAll}
                disabled={!lecture.trim() && !summary && !quiz.length && !flashcards.length}
              >
                <Trash2 size={13} /> {t('study.clearAll')}
              </button>
              <button
                className="btn btn-outline focus-ring text-xs"
                onClick={exportSession}
                disabled={!lecture.trim() && !summary}
              >
                <Download size={13} /> {t('study.export')}
              </button>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="sr-only"
                id="study-import"
              />
              <label htmlFor="study-import" className="btn btn-outline focus-ring text-xs cursor-pointer">
                <Upload size={13} /> {t('study.import')}
              </label>
              <button
                className="btn btn-accent focus-ring"
                onClick={generateAll}
                disabled={generating !== 'idle' || !lecture.trim()}
                data-testid="button-generate-all"
              >
                {generating !== 'idle' ? (
                  <>
                    <RefreshCw className="spin" size={15} />
                    {generating === 'summary' && t('study.synthesizing')}
                    {generating === 'quiz' && t('study.generatingQuiz')}
                    {generating === 'flashcards' && t('study.generatingFlashcards')}
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    {t('study.generateAll')}
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        <section className="panel summary-card">
          <div className="panel-head">
            <span className="eyebrow mono flex items-center gap-2">
              <span className={`pulse-dot ${summary ? 'live-dot' : ''}`} />
              {t('study.aiSynthesis')} · {aiModel.toUpperCase()}
            </span>
            <div className="flex items-center gap-1">
              <button className="icon-btn" onClick={() => navigator.clipboard.writeText(summary)} title={t('common.copy')}>
                <Copy size={14} />
              </button>
              <button className="icon-btn" onClick={generateSummary} disabled={generating === 'summary' || !lecture.trim()} title={t('study.regenerateSummary')}>
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          {summary ? (
            <div className="summary-content">
              <div className="summary-text" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br>') }} />
            </div>
          ) : (
            <div className="empty-summary">
              <Sparkles size={25} />
              <span>{t('study.summaryPlaceholder')}</span>
              <small>{t('study.summaryConnected')}</small>
            </div>
          )}
        </section>
      </div>

      {quiz.length > 0 && (
        <section className="quiz-section panel">
          <div className="section-mini-head">
            <span className="eyebrow mono">{t('study.recallCheck')} / {quiz.length}</span>
            <div className="flex items-center gap-3">
              {graded && <strong className="score">{score} / {quiz.length} {t('study.correct')}</strong>}
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={showExplanations} onChange={(e) => setShowExplanations(e.target.checked)} className="checkbox" />
                {t('study.showExplanations')}
              </label>
              <button className="btn btn-ghost text-xs" onClick={() => { setGraded(false); setShowExplanations(false); notify(t('study.quizReset')); }}>
                <RotateCcw size={12} /> {t('study.resetQuiz')}
              </button>
            </div>
          </div>
          <div className="quiz-grid">
            {quiz.map((q, index) => (
              <div
                key={index}
                className={`quiz-card panel ${graded ? (answers[index] === q.correct ? 'quiz-correct' : 'quiz-wrong') : ''} ${showExplanations ? 'show-exp' : ''}`}
              >
                <div className="quiz-number mono">0{index + 1}</div>
                <b>{q.question}</b>
                <div className="choice-list">
                  {q.choices.map((choice, ci) => (
                    <button
                      key={ci}
                      className={`${answers[index] === ci ? 'choice-selected' : ''} ${graded && ci === q.correct ? 'choice-correct' : ''} ${graded && answers[index] === ci && ci !== q.correct ? 'choice-wrong' : ''}`}
                      onClick={() => { if (!graded) { setGraded(false); setAnswers((c) => ({ ...c, [index]: ci })); }}}
                      data-testid={`button-answer-${index}-${ci}`}
                    >
                      <span className="choice-letter">{String.fromCharCode(65 + ci)}</span>
                      <span>{choice}</span>
                    </button>
                  ))}
                </div>
                {(graded || showExplanations) && (
                  <div className="quiz-explanation">
                    <Lightbulb size={12} />
                    <span>{q.explanation}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!graded && (
            <button className="btn btn-outline focus-ring grade-button" onClick={() => { setGraded(true); notify(`${t('study.quizGraded')}: ${score}/${quiz.length}`); }} data-testid="button-grade-quiz">
              <Check size={15} /> {t('study.gradeQuiz')}
            </button>
          )}
        </section>
      )}

      {flashcards.length > 0 && (
        <section className="flashcard-section panel">
          <div className="section-mini-head">
            <span className="eyebrow mono">{t('study.flashcards')} / {flashcards.length}</span>
            <span className="mono quiet">{t('study.clickToFlip')}</span>
          </div>
          <div className="flashcard-grid">
            {flashcards.map((card, index) => (
              <button
                key={index}
                className={`flashcard ${flipped === index ? 'flipped' : ''}`}
                onClick={() => setFlipped(flipped === index ? null : index)}
                data-testid={`button-flashcard-${index}`}
              >
                <span className="mono">{flipped === index ? 'ANSWER' : `CARD 0${index + 1}`}</span>
                <strong>{flipped === index ? card.back : card.front}</strong>
                <small>{flipped === index ? t('study.clickToReturn') : t('study.clickToReveal')}</small>
              </button>
            ))}
          </div>
          <div className="flashcard-actions">
            <button className="btn btn-outline text-xs" onClick={generateFlashcards} disabled={generating === 'flashcards'}>
              <Wand2 size={13} /> {t('study.regenerateFlashcards')}
            </button>
            <button className="btn btn-ghost text-xs" onClick={() => setFlashcards([])}>
              <Trash2 size={13} /> {t('study.clearFlashcards')}
            </button>
          </div>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="history-section panel">
          <div className="section-mini-head">
            <span className="eyebrow mono">{t('study.history')}</span>
            <button className="btn btn-ghost text-xs" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showHistory ? t('study.hideHistory') : t('study.showHistory')}
            </button>
          </div>
          {showHistory && (
            <div className="history-list">
              {sessions.map((session, index) => (
                <div key={index} className={`history-item ${activeSessionIndex === index ? 'active' : ''}`} onClick={() => loadSession(index)}>
                  <div className="history-meta">
                    <span className="mono text-xs text-cyan">SESSION {String(sessions.length - index).padStart(2, '0')}</span>
                    <span className="mono text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <span className="mono text-xs text-muted-foreground">{session.aiModel}</span>
                  </div>
                  <div className="history-preview mono text-xs">
                    {session.lecture.slice(0, 120)}...
                  </div>
                  <div className="history-stats flex items-center gap-4 text-xs text-muted-foreground">
                    <span><BarChart2 size={10} /> {session.quiz.length} {t('study.questions')}</span>
                    <span><Layers size={10} /> {session.flashcards.length} {t('study.cards')}</span>
                  </div>
                  <button
                    className="icon-btn text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteSession(index); }}
                    title={t('study.deleteSession')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="tips-section panel panel-subtle">
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan mb-3">
          <Lightbulb size={14} />
          <span>{t('study.proTips')}</span>
        </div>
        <ul className="tips-list">
          <li><kbd>Ctrl+Enter</kbd> <span>{t('study.tip1')}</span></li>
          <li><kbd>Tab</kbd> <span>{t('study.tip2')}</span></li>
          <li><kbd>Space</kbd> <span>{t('study.tip3')}</span></li>
          <li><kbd>S</kbd> <span>{t('study.tip4')}</span></li>
        </ul>
      </section>
    </div>
  );
}