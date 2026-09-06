import { useState } from 'react';
import { BrainCircuit, Check, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserPersistent } from '@/lib/user-store';

export default function Study({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [lecture, setLecture] = useUserPersistent('lecture', 'Distributed systems trade consistency for availability during network partitions. The CAP theorem describes this boundary. Replication strategies include leader-based replication, quorum reads, and eventual consistency. A practical system chooses a point in this design space based on user expectations and failure modes.');
  const [summary, setSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiModel, setAiModel] = useState('Google Gemini 3.6 Flash');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);
  const [flipped, setFlipped] = useState<number | null>(null);

  const questions = ['What does CAP describe?', 'Which strategy uses a leader?', 'What happens during a partition?', 'What should guide consistency choices?', 'What kind of consistency can replication produce?'];
  const choices = [['A storage format', 'A distributed trade-off', 'A UI pattern'], ['Leader-based replication', 'CSS modules', 'Edge caching'], ['The system chooses a trade-off', 'The CPU stops', 'Data is deleted'], ['User expectations and failures', 'Screen size', 'Font choice'], ['Eventual consistency', 'Pixel consistency', 'Static consistency']];
  const correct = [1, 0, 0, 0, 0];

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: lecture }) });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        const engineLabel = data.provider === 'deepseek' ? 'DeepSeek Chat (V4)' : 'Google Gemini 3.6 Flash';
        setAiModel(engineLabel);
        notify(`${t('study.aiComplete')} ${engineLabel}`);
      } else { throw new Error('API request failed'); }
    } catch {
      const sentences = lecture.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
      setSummary(`${sentences.slice(0, 2).join('. ')}. Key thread: ${sentences[2] || 'connect each concept to a failure mode'}.`);
      notify(t('study.localFallback'));
    } finally { setGenerating(false); }
  };

  const score = Object.entries(answers).reduce((total, [i, a]) => total + (correct[Number(i)] === a ? 1 : 0), 0);

  return (
    <div>
      <div className="section-title">
        <div><div className="eyebrow mono">{t('study.eyebrow')}</div><h1>{t('study.title')}</h1><p>{t('study.subtitle')}</p></div>
        <span className="context-chip"><BrainCircuit size={14} />{t('study.aiActive')}</span>
      </div>

      <div className="study-grid">
        <section className="panel study-editor">
          <div className="panel-head"><span className="eyebrow mono">{t('study.lectureCapture')}</span><span className="mono quiet">{t('study.cloudSync')}</span></div>
          <textarea value={lecture} onChange={(e) => setLecture(e.target.value)} data-testid="input-lecture-text" />
          <div className="editor-foot">
            <span className="mono quiet">{lecture.split(/\s+/).filter(Boolean).length} {t('study.words')}</span>
            <button className="btn btn-accent focus-ring" onClick={generateSummary} disabled={generating} data-testid="button-generate-summary">
              {generating ? <RefreshCw className="spin" size={15} /> : <Sparkles size={15} />}
              {generating ? t('study.synthesizing') : t('study.generateSummary')}
            </button>
          </div>
        </section>

        <section className="panel summary-card">
          <div className="panel-head">
            <span className="eyebrow mono"><span className="pulse-dot live-dot" />{t('study.aiSynthesis')} · {aiModel.toUpperCase()}</span>
            <Sparkles size={15} className="text-green" />
          </div>
          {summary ? <p className="summary-text">{summary}</p> : (
            <div className="empty-summary"><Sparkles size={25} /><span>{t('study.summaryPlaceholder')}</span><small>{t('study.summaryConnected')}</small></div>
          )}
        </section>
      </div>

      <section className="quiz-section">
        <div className="section-mini-head">
          <span className="eyebrow mono">{t('study.recallCheck')} / 05</span>
          {graded && <strong className="score">{score} / 5 correct</strong>}
        </div>
        <div className="quiz-grid">
          {questions.map((question, index) => (
            <div className={`quiz-card panel ${graded ? (answers[index] === correct[index] ? 'quiz-correct' : 'quiz-wrong') : ''}`} key={question}>
              <div className="quiz-number mono">0{index + 1}</div>
              <b>{question}</b>
              <div className="choice-list">
                {choices[index].map((choice, ci) => (
                  <button key={choice} className={answers[index] === ci ? 'choice-selected' : ''} onClick={() => { setGraded(false); setAnswers((c) => ({ ...c, [index]: ci })); }} data-testid={`button-answer-${index}-${ci}`}>
                    <span>{String.fromCharCode(65 + ci)}</span>{choice}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-outline focus-ring grade-button" onClick={() => { setGraded(true); notify(t('study.quizGraded')); }} data-testid="button-grade-quiz">
          <Check size={15} />{t('study.gradeQuiz')}
        </button>
      </section>

      <section className="flashcard-section">
        <div className="section-mini-head"><span className="eyebrow mono">{t('study.flashcards')} / 03</span><span className="mono quiet">{t('study.clickToFlip')}</span></div>
        <div className="flashcard-grid">
          {[['CAP theorem', 'Consistency, availability, and partition tolerance are competing guarantees.'], ['Quorum read', 'A read accepted after enough replicas respond.'], ['Eventual consistency', 'Replicas converge when updates stop.']].map(([front, back], index) => (
            <button key={front} className={`flashcard ${flipped === index ? 'flipped' : ''}`} onClick={() => setFlipped(flipped === index ? null : index)} data-testid={`button-flashcard-${index}`}>
              <span className="mono">{flipped === index ? 'ANSWER' : `CARD 0${index + 1}`}</span>
              <strong>{flipped === index ? back : front}</strong>
              <small>{flipped === index ? 'click to return' : 'click to reveal'}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
