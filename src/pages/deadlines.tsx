import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { CalendarClock, Plus, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';

type Deadline = { id: string; title: string; course: string; date: string; priority: 'high' | 'medium' | 'low' };

const dateIn = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString().slice(0, 16);
};

const seedDeadlines: Deadline[] = [
  { id: 'd1', title: 'Distributed Systems lab', course: 'CS 431 · Lab report', date: dateIn(2, 23), priority: 'high' },
  { id: 'd2', title: 'Systems design reading', course: 'CS 406 · Read chapters 8–10', date: dateIn(5, 9), priority: 'medium' },
  { id: 'd3', title: 'Research proposal', course: 'Independent study · v1.0', date: dateIn(10, 17), priority: 'high' },
  { id: 'd4', title: 'Linear algebra quiz', course: 'MATH 214 · Week 9', date: dateIn(16, 10), priority: 'low' },
];

function timeLeft(date: string) {
  const delta = new Date(date).getTime() - Date.now();
  if (delta <= 0) return 'PAST DUE';
  const d = Math.floor(delta / 86400000);
  const h = Math.floor((delta % 86400000) / 3600000);
  return `${d}d ${h}h`;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal panel page-in" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="btn btn-ghost" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div>
        {children}
      </div>
    </div>
  );
}

export default function Deadlines({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [deadlines, setDeadlines] = usePersistent<Deadline[]>('cortex-deadlines', seedDeadlines);
  const [adding, setAdding] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick((v) => v + 1), 60000); return () => window.clearInterval(timer); }, []);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setDeadlines((list) => [...list, { id: `d-${Date.now()}`, title: String(form.get('title')), course: String(form.get('course') || 'Personal'), date: String(form.get('date')), priority: String(form.get('priority')) as Deadline['priority'] }]);
    setAdding(false);
    notify(t('deadlines.added'));
  };

  const ordered = [...deadlines].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const next = ordered[0];

  return (
    <div>
      <div className="section-title">
        <div><div className="eyebrow mono">{t('deadlines.eyebrow')}</div><h1>{t('deadlines.title')}</h1><p>{t('deadlines.subtitle')}</p></div>
        <button className="btn btn-accent focus-ring" onClick={() => setAdding(true)} data-testid="button-add-deadline"><Plus size={15} />{t('deadlines.add')}</button>
      </div>

      <div className="radar-summary panel">
        <div><span className="eyebrow mono">{t('deadlines.nextSignal')}</span><h2>{next?.title}</h2><p>{next?.course}</p></div>
        <div className="next-countdown">
          <span className="mono">T−</span><strong>{next ? timeLeft(next.date) : '--'}</strong>
          <small>{next && new Date(next.date).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}</small>
        </div>
      </div>

      <div className="deadline-list">
        {ordered.map((d, index) => (
          <article className={`deadline-row panel-subtle priority-${d.priority}`} key={d.id}>
            <span className="deadline-index mono">0{index + 1}</span>
            <span className="deadline-main"><b>{d.title}</b><small>{d.course}</small></span>
            <span className={`priority-label priority-${d.priority}`}>{d.priority}</span>
            <span className="deadline-date"><b>{timeLeft(d.date)}</b><small>{new Date(d.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></span>
            <button className="btn btn-ghost focus-ring" aria-label={`Remove ${d.title}`} onClick={() => { setDeadlines((list) => list.filter((item) => item.id !== d.id)); notify(t('deadlines.removed')); }} data-testid={`button-remove-deadline-${d.id}`}><X size={15} /></button>
          </article>
        ))}
      </div>

      {adding && (
        <Modal title={t('deadlines.addTitle')} onClose={() => setAdding(false)}>
          <form className="form-stack" onSubmit={add}>
            <label>{t('deadlines.titleField')}<input required name="title" placeholder="Assignment, exam, review..." data-testid="input-deadline-title" /></label>
            <label>{t('deadlines.contextField')}<input name="course" placeholder="CS 431 · Lab report" data-testid="input-deadline-course" /></label>
            <label>{t('deadlines.dateField')}<input required type="datetime-local" name="date" data-testid="input-deadline-date" /></label>
            <label>{t('deadlines.priorityField')}<select name="priority" defaultValue="medium" data-testid="input-deadline-priority"><option value="high">{t('deadlines.high')}</option><option value="medium">{t('deadlines.medium')}</option><option value="low">{t('deadlines.low')}</option></select></label>
            <button className="btn btn-accent focus-ring" type="submit" data-testid="button-submit-deadline"><Plus size={15} />{t('deadlines.addToRadar')}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
