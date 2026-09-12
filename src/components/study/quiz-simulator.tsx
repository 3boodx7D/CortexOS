import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Award,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface QuizItem {
  id?: string;
  question: string;
  choices: string[];
  correct: number;
  explanation?: string;
}

interface QuizSimulatorProps {
  quiz: QuizItem[];
  onSaveHistory?: (score: number, total: number) => void;
  notify: (msg: string) => void;
}

export function QuizSimulator({ quiz, onSaveHistory, notify }: QuizSimulatorProps) {
  const { t, locale } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');

  if (!quiz || quiz.length === 0) {
    return (
      <div className="panel-subtle p-8 rounded-xl border border-border text-center space-y-3">
        <HelpCircle size={32} className="mx-auto text-muted-foreground opacity-50" />
        <p className="text-xs text-muted-foreground">
          {locale === 'ar' ? 'لا توجد أسئلة اختبار بعد. اضغط على "توليد شامل بواسطة CORTEXAI" لإنشاء اختبار تدريبي.' : 'No quiz generated yet. Click "Synthesize with CORTEXAI" to create an exam simulation.'}
        </p>
      </div>
    );
  }

  const currentQ = quiz[currentIndex];
  const totalQuestions = quiz.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  const handleSelectChoice = (choiceIndex: number) => {
    if (isSubmitted && mode === 'exam') return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: choiceIndex
    }));
  };

  const calculateScore = () => {
    return quiz.reduce((score, q, idx) => {
      return score + (selectedAnswers[idx] === q.correct ? 1 : 0);
    }, 0);
  };

  const handleFinish = () => {
    setIsSubmitted(true);
    const score = calculateScore();
    if (onSaveHistory) {
      onSaveHistory(score, totalQuestions);
    }
    notify(locale === 'ar' ? `اكتمل الاختبار! النتيجة: ${score} من ${totalQuestions}` : `Exam submitted! Score: ${score}/${totalQuestions}`);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setCurrentIndex(0);
    notify(locale === 'ar' ? 'تمت إعادة ضبط الاختبار' : 'Exam reset');
  };

  const score = calculateScore();
  const percentage = Math.round((score / totalQuestions) * 100);

  return (
    <div className="space-y-4">
      {/* Top Header Controls: Mode & Progress Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-cyan tracking-wider">
            {locale === 'ar' ? `سؤال ${currentIndex + 1} من ${totalQuestions}` : `Question ${currentIndex + 1} of ${totalQuestions}`}
          </span>
          <div className="w-28 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-cyan transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Practice vs Exam mode toggle */}
          <div className="inline-flex p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => {
                setMode('practice');
                setIsSubmitted(false);
              }}
              className={`px-2.5 py-1 rounded-md transition ${
                mode === 'practice' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'تدريب فوري' : 'Instant Practice'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('exam');
                setIsSubmitted(false);
              }}
              className={`px-2.5 py-1 rounded-md transition ${
                mode === 'exam' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {locale === 'ar' ? 'محاكاة اختبار' : 'Timed Exam'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition"
            title={t('study.resetQuiz')}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Summary Score Banner (if submitted or in exam mode final) */}
      {isSubmitted && (
        <div className="p-4 rounded-xl border border-cyan/30 bg-cyan/5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan">
              <Award size={22} />
            </div>
            <div>
              <b className="text-xs font-semibold text-white block">
                {locale === 'ar' ? 'نتيجة الاختبار النهائي' : 'Exam Simulation Result'}
              </b>
              <p className="text-[11px] text-zinc-400">
                {score} / {totalQuestions} ({percentage}%) •{' '}
                {percentage >= 80 ? (locale === 'ar' ? 'أداء ممتاز 🚀' : 'Mastery Achieved 🚀') : (locale === 'ar' ? 'بحاجة إلى مراجعة الملاحظات 📚' : 'Review Recommended 📚')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-primary text-xs h-[34px] px-3 gap-1.5"
          >
            <RotateCcw size={13} />
            <span>{t('study.retakeQuiz')}</span>
          </button>
        </div>
      )}

      {/* Active Question Card */}
      <div className="panel-subtle p-5 rounded-xl border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground leading-relaxed">
          {currentQ.question}
        </h3>

        {/* Choices */}
        <div className="space-y-2">
          {currentQ.choices.map((choice, cIdx) => {
            const isSelected = selectedAnswers[currentIndex] === cIdx;
            const isCorrect = currentQ.correct === cIdx;
            const revealInstant = mode === 'practice' && selectedAnswers[currentIndex] !== undefined;
            const revealFinal = isSubmitted;
            const shouldShowFeedback = revealInstant || revealFinal;

            let borderClass = 'border-border/80 hover:border-primary/40 bg-card hover:bg-muted/30 text-foreground shadow-2xs';
            let iconComponent = null;

            if (shouldShowFeedback) {
              if (isCorrect) {
                borderClass = 'border-emerald-500/60 bg-emerald-500/10 text-foreground font-medium';
                iconComponent = <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />;
              } else if (isSelected && !isCorrect) {
                borderClass = 'border-rose-500/60 bg-rose-500/10 text-foreground font-medium';
                iconComponent = <XCircle size={16} className="text-rose-400 shrink-0" />;
              }
            } else if (isSelected) {
              borderClass = 'border-cyan bg-cyan/10 text-foreground font-semibold shadow-xs ring-1 ring-cyan/40';
            }

            return (
              <button
                key={cIdx}
                type="button"
                onClick={() => handleSelectChoice(cIdx)}
                className={`w-full text-start p-3 rounded-lg border transition-all duration-150 flex items-center justify-between gap-3 text-xs cursor-pointer ${borderClass}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full border border-border/80 flex items-center justify-center font-mono text-[10px] text-muted-foreground shrink-0">
                    {String.fromCharCode(65 + cIdx)}
                  </span>
                  <span>{choice}</span>
                </div>
                {iconComponent}
              </button>
            );
          })}
        </div>

        {/* Diagnostic Explanation (shown in practice mode immediately or in exam mode after submit) */}
        {((mode === 'practice' && selectedAnswers[currentIndex] !== undefined) || isSubmitted) && currentQ.explanation && (
          <div className="p-3.5 rounded-lg bg-muted border border-border text-xs space-y-1.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 text-cyan font-semibold text-[11px]">
              <Lightbulb size={14} />
              <span>{t('study.quizExplanation')}</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              {currentQ.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Navigation Stepper & Action Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="btn btn-outline text-xs h-[36px] px-3 gap-1 disabled:opacity-40"
        >
          {locale === 'ar' ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          <span>{t('study.prevQuestion')}</span>
        </button>

        {currentIndex < totalQuestions - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
            className="btn btn-outline text-xs h-[36px] px-3 gap-1 hover:border-cyan"
          >
            <span>{t('study.nextQuestion')}</span>
            {locale === 'ar' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          !isSubmitted && (
            <button
              type="button"
              onClick={handleFinish}
              disabled={answeredCount === 0}
              className="btn btn-primary text-xs h-[36px] px-4 gap-1.5 disabled:opacity-50"
            >
              <Award size={15} />
              <span>{t('study.finishQuiz')}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
