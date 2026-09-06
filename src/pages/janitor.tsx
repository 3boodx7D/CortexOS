import { useState } from 'react';
import type * as React from 'react';
import { Boxes, Check, CircleHelp, HardDrive, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserPersistent } from '@/lib/user-store';
import { organizeWorkspace } from '@/lib/tauri';

export default function Janitor({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [report, setReport] = useUserPersistent('janitor-report', { score: 84, lastRun: 'Today, 18:42', moved: 0, folders: 0 });
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const result = await organizeWorkspace();
    setReport({ score: 96, lastRun: 'Just now', moved: 47, folders: 8 });
    setRunning(false);
    notify(result.source === 'mock' ? t('janitor.mockOrganized') : t('janitor.organized'));
  };

  return (
    <div>
      <div className="section-title">
        <div><div className="eyebrow mono">{t('janitor.eyebrow')}</div><h1>{t('janitor.title')}</h1><p>{t('janitor.subtitle')}</p></div>
        <button className="btn btn-accent focus-ring" onClick={run} disabled={running} data-testid="button-organize-workspace">
          {running ? <RefreshCw className="spin" size={15} /> : <Sparkles size={15} />}
          {running ? t('janitor.organizing') : t('janitor.organize')}
        </button>
      </div>

      <div className="janitor-grid">
        <section className="clean-score panel">
          <div className="score-ring" style={{ '--score': `${report.score * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{report.score}</strong><small>/ 100</small></div>
          </div>
          <div>
            <span className="eyebrow mono">{t('janitor.clutterScore')}</span>
            <h2>{report.score > 90 ? t('janitor.clear') : t('janitor.almostClear')}</h2>
            <p>{report.score > 90 ? t('janitor.clearDesc') : t('janitor.almostClearDesc')}</p>
          </div>
        </section>

        <section className="panel janitor-report">
          <div className="panel-head"><span className="eyebrow mono">{t('janitor.localReport')}</span><span className="mono quiet">{report.lastRun.toUpperCase()}</span></div>
          <div className="report-rows">
            <div><span><HardDrive size={15} />Downloads</span><b className="status-good">12 items</b></div>
            <div><span><Boxes size={15} />Loose folders</span><b className="status-good">{report.folders || 3} found</b></div>
            <div><span><Trash2 size={15} />Stale cache</span><b className="status-warn">{report.moved ? '0.8 GB' : '1.4 GB'}</b></div>
            <div><span><Check size={15} />Files organized</span><b>{report.moved || 0}</b></div>
          </div>
        </section>
      </div>

      <div className="janitor-note panel-subtle">
        <CircleHelp size={16} />
        <span><b>{t('janitor.safeDefault')}</b><small>{t('janitor.safeDesc')}</small></span>
      </div>
    </div>
  );
}
