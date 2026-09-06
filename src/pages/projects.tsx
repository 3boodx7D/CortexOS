import { type FormEvent, useState, type ReactNode } from 'react';
import {
  ArrowUpRight, ChevronRight, FolderKanban, Plus, Rocket,
  Search, Terminal, X,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { openExternal } from '@/lib/tauri';

type Status = 'active' | 'paused' | 'archived';
type Project = { id: string; name: string; description: string; status: Status; stack: string[]; progress: number; path: string; updated: string };

const seedProjects: Project[] = [
  { id: 'orbit', name: 'Orbit Console', description: 'A tiny command palette for orchestrating local developer workflows.', status: 'active', stack: ['Rust', 'Tauri', 'React'], progress: 72, path: '~/code/orbit-console', updated: '12 min ago' },
  { id: 'atlas', name: 'Atlas Notes', description: 'Offline-first lecture archive with a fast semantic search layer.', status: 'active', stack: ['TypeScript', 'SQLite'], progress: 48, path: '~/uni/atlas-notes', updated: 'Yesterday' },
  { id: 'sentinel', name: 'Sentinel Board', description: 'A low-noise hardware monitor for the desk setup.', status: 'paused', stack: ['Python', 'WebSockets'], progress: 31, path: '~/lab/sentinel', updated: '3 days ago' },
  { id: 'kinetic', name: 'Kinetic UI Kit', description: 'Interaction primitives with motion measured in milliseconds.', status: 'archived', stack: ['CSS', 'Storybook'], progress: 100, path: '~/design/kinetic', updated: '18 days ago' },
];

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{status}</span>;
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

export default function Projects({ notify }: { notify: (msg: string) => void }) {
  const { t } = useTranslation();
  const [projects, setProjects] = usePersistent<Project[]>('cortex-projects', seedProjects);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Project | null>(projects[0]);
  const [registering, setRegistering] = useState(false);
  const shown = projects.filter((p) => (filter === 'all' || p.status === filter) && `${p.name} ${p.description} ${p.stack.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  const addProject = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const project: Project = { id: `local-${Date.now()}`, name: String(form.get('name')), description: String(form.get('description') || 'Local project workspace.'), status: 'active', stack: String(form.get('stack') || 'TypeScript').split(',').map((s) => s.trim()), progress: 0, path: String(form.get('path') || '~/code/new-project'), updated: 'just now' };
    setProjects((list) => [project, ...list]);
    setSelected(project);
    setRegistering(false);
    notify(t('projects.registered'));
  };

  return (
    <div>
      <div className="section-title">
        <div>
          <div className="eyebrow mono">{t('projects.eyebrow')}</div>
          <h1>{t('projects.title')}</h1>
          <p>{t('projects.subtitle')}</p>
        </div>
        <button className="btn btn-accent focus-ring" onClick={() => setRegistering(true)} data-testid="button-register-project">
          <Plus size={15} />{t('projects.register')}
        </button>
      </div>

      <div className="toolbar panel-subtle">
        <div className="input-wrap"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('projects.search')} data-testid="input-project-search" /></div>
        <div className="filter-tabs">
          {(['all', 'active', 'paused', 'archived'] as const).map((item) => (
            <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)} data-testid={`button-filter-${item}`}>
              {item === 'all' ? t('projects.all') : item}
            </button>
          ))}
        </div>
        <span className="mono quiet toolbar-count">{shown.length.toString().padStart(2, '0')} {t('common.found')}</span>
      </div>

      <div className="split-layout">
        <section className="project-list">
          {shown.map((project) => (
            <button className={`project-row ${selected?.id === project.id ? 'project-selected' : ''}`} key={project.id} onClick={() => setSelected(project)} data-testid={`button-project-${project.id}`}>
              <span className="project-symbol"><Terminal size={17} /></span>
              <span className="project-main">
                <b>{project.name}</b><small>{project.description}</small>
                <span className="project-tags">{project.stack.map((tag) => <em key={tag}>{tag}</em>)}</span>
              </span>
              <span className="project-status"><StatusPill status={project.status} /><small className="mono">{project.progress}%</small></span>
              <ChevronRight size={15} />
            </button>
          ))}
          {shown.length === 0 && (
            <div className="empty-state">
              <FolderKanban size={22} /><b>{t('projects.noMatch')}</b><span>{t('projects.noMatchDesc')}</span>
            </div>
          )}
        </section>

        {selected && (
          <section className="project-detail panel">
            <div className="detail-top"><StatusPill status={selected.status} /><span className="mono quiet">{t('common.updated')} {selected.updated.toUpperCase()}</span></div>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <div className="detail-progress">
              <div className="detail-progress-label"><span>{t('common.buildProgress')}</span><b>{selected.progress}%</b></div>
              <div className="progress-track"><span style={{ width: `${selected.progress}%` }} /></div>
            </div>
            <div className="detail-meta">
              <span><small>{t('common.workspace')}</small><b className="mono">{selected.path}</b></span>
              <span><small>{t('common.stack')}</small><b>{selected.stack.join(' · ')}</b></span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-accent focus-ring" onClick={async () => { await openExternal(selected.path); notify(`Launch signal sent for ${selected.name}`); }} data-testid="button-launch-project"><Rocket size={15} />{t('projects.launchWorkspace')}</button>
              <button className="btn btn-outline focus-ring" onClick={() => notify(`Explorer opened for ${selected.name}`)} data-testid="button-explore-project"><ArrowUpRight size={15} />{t('projects.exploreFiles')}</button>
            </div>
          </section>
        )}
      </div>

      {registering && (
        <Modal title={t('projects.registerTitle')} onClose={() => setRegistering(false)}>
          <form className="form-stack" onSubmit={addProject}>
            <label>{t('projects.projectName')}<input required name="name" placeholder="e.g. Signal Garden" data-testid="input-register-name" /></label>
            <label>{t('projects.workspacePath')}<input required name="path" placeholder="~/code/project" data-testid="input-register-path" /></label>
            <label>{t('projects.stack')}<input name="stack" placeholder="Rust, React, SQLite" data-testid="input-register-stack" /></label>
            <label>{t('projects.description')}<textarea name="description" rows={3} placeholder="What is this becoming?" data-testid="input-register-description" /></label>
            <button className="btn btn-accent focus-ring" type="submit" data-testid="button-submit-project"><Plus size={15} />{t('projects.registerLocally')}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
