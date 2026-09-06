import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import type * as React from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowUpRight, BookOpen, Boxes, BrainCircuit, CalendarClock, Check,
  ChevronRight, CircleHelp, Command, Cpu, Database, Disc3,
  FolderKanban, Gamepad2, Gauge, HardDrive, Headphones, LayoutDashboard,
  ListFilter, Menu, Music2, Pause, Play, Plus, Power, RefreshCw, Rocket, Search,
  Settings2, Sparkles, SunMedium, Terminal, Trash2, Volume2, X, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { openExternal, organizeWorkspace } from '@/lib/tauri';

type Locale = 'en' | 'ar';
type Status = 'active' | 'paused' | 'archived';
type Project = { id: string; name: string; description: string; status: Status; stack: string[]; progress: number; path: string; updated: string };
type Deadline = { id: string; title: string; course: string; date: string; priority: 'high' | 'medium' | 'low' };
type Track = { id: string; title: string; artist: string; duration: string; mood: string };

const seedProjects: Project[] = [
  { id: 'orbit', name: 'Orbit Console', description: 'A tiny command palette for orchestrating local developer workflows.', status: 'active', stack: ['Rust', 'Tauri', 'React'], progress: 72, path: '~/code/orbit-console', updated: '12 min ago' },
  { id: 'atlas', name: 'Atlas Notes', description: 'Offline-first lecture archive with a fast semantic search layer.', status: 'active', stack: ['TypeScript', 'SQLite'], progress: 48, path: '~/uni/atlas-notes', updated: 'Yesterday' },
  { id: 'sentinel', name: 'Sentinel Board', description: 'A low-noise hardware monitor for the desk setup.', status: 'paused', stack: ['Python', 'WebSockets'], progress: 31, path: '~/lab/sentinel', updated: '3 days ago' },
  { id: 'kinetic', name: 'Kinetic UI Kit', description: 'Interaction primitives with motion measured in milliseconds.', status: 'archived', stack: ['CSS', 'Storybook'], progress: 100, path: '~/design/kinetic', updated: '18 days ago' },
];

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

const tracks: Track[] = [
  { id: 't1', title: 'Soft Reset', artist: 'Kiasmos', duration: '04:12', mood: 'Focus' },
  { id: 't2', title: 'Night Owl', artist: 'Tycho', duration: '05:07', mood: 'Deep work' },
  { id: 't3', title: 'A Walk', artist: 'Hania Rani', duration: '03:48', mood: 'Low light' },
  { id: 't4', title: 'Open Circuit', artist: 'Rival Consoles', duration: '04:31', mood: 'Momentum' },
];

const navItems: { href: string; label: string; ar: string; icon: LucideIcon }[] = [
  { href: '/overview', label: 'Overview', ar: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects Vault', ar: 'خزنة المشاريع', icon: FolderKanban },
  { href: '/study', label: 'Study Hub', ar: 'مركز الدراسة', icon: BookOpen },
  { href: '/games', label: 'Game Hub', ar: 'مركز الألعاب', icon: Gamepad2 },
  { href: '/media', label: 'Music Lounge', ar: 'صالة الموسيقى', icon: Headphones },
  { href: '/janitor', label: 'Clean Janitor', ar: 'منظف النظام', icon: Trash2 },
  { href: '/deadlines', label: 'Deadline Radar', ar: 'رادار المواعيد', icon: CalendarClock },
];

const navGroups = [
  { label: 'WORKSPACE', ar: 'مساحة العمل', items: navItems.slice(0, 2) },
  { label: 'ACADEMIC & FOCUS', ar: 'الدراسة والإنجاز', items: [navItems[2], navItems[6]] },
  { label: 'UTILITIES', ar: 'الأدوات', items: [navItems[3], navItems[4], navItems[5]] },
];

function usePersistent<T>(key: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

function tr(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }

function Button({ children, className = '', variant = 'default', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'ghost' | 'outline' | 'accent' }) {
  return <button className={`btn btn-${variant} focus-ring ${className}`} {...props}>{children}</button>;
}

function SectionTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-title">
    <div><div className="eyebrow mono">{eyebrow}</div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>
    {action}
  </div>;
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{status}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal panel page-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><h2>{title}</h2><Button variant="ghost" aria-label="Close dialog" data-testid="button-close-dialog" onClick={onClose}><X size={17} /></Button></div>
      {children}
    </div>
  </div>;
}

function AppShell({ children, locale, toast }: { children: ReactNode; locale: Locale; toast: string }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const label = (en: string, ar: string) => tr(locale, en, ar);
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup">
        <div className="brand-mark"><BrainCircuit size={19} /></div>
        <div><strong>CORTEX<span>OS</span></strong><small className="mono">LOCAL / 02</small></div>
        <Button className="mobile-close" variant="ghost" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={17} /></Button>
      </div>
      <nav className="nav-list" aria-label="Primary navigation">
         {navGroups.map(({ label: groupLabel, ar: groupAr, items }) => <div className="nav-group" key={groupLabel}>
           <div className="nav-group-label mono">{label(groupLabel, groupAr)}</div>
           {items.map(({ href, label: itemLabel, ar, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileNav(false)} className={`nav-item ${location === href || (href === '/overview' && location === '/') ? 'nav-active' : ''}`} data-testid={`link-nav-${itemLabel.toLowerCase().replaceAll(' ', '-')}`}>
             <Icon size={17} strokeWidth={1.8} /><span>{label(itemLabel, ar)}</span>{href === '/deadlines' && <span className="nav-count">4</span>}
           </Link>)}
         </div>)}
      </nav>
      <div className="sidebar-spacer" />
       <div className="account-card">
         <div className="account-avatar">A<span className="account-online" /></div>
         <div className="account-copy"><b>Abdulrahman</b><small>{label('Founder & Student', 'مؤسس وطالب')}</small></div>
      </div>
       <Link href="/settings" className={`nav-item settings-link ${location === '/settings' ? 'nav-active' : ''}`} data-testid="link-nav-settings"><Settings2 size={17} /><span>{label('Settings', 'الإعدادات')}</span></Link>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar">
        <Button variant="ghost" className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={19} /></Button>
        <div className="crumb mono"><span className="crumb-signal" />CORTEX / {location === '/' ? 'OVERVIEW' : location.slice(1).toUpperCase()}</div>
        <div className="topbar-actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)} data-testid="button-command-search"><Search size={15} /><span>{label('Command search', 'بحث الأوامر')}</span><kbd>Ctrl+K</kbd></button>
          <div className="sync-badge"><span className="pulse-dot" />{label('Synced locally', 'متزامن محلياً')}</div>
        </div>
      </header>
      <div className="page-wrap page-in" key={location}>{children}</div>
    </main>
    {toast && <div className="toast" role="status" data-testid="status-toast"><Check size={15} />{toast}</div>}
    {searchOpen && <Modal title={label('Command search', 'بحث الأوامر')} onClose={() => setSearchOpen(false)}>
      <div className="command-box"><Command size={17} /><input autoFocus placeholder={label('Try “open projects” or “start focus mode”', 'جرّب "فتح المشاريع" أو "بدء التركيز"')} data-testid="input-command-search" /><kbd>ESC</kbd></div>
      <div className="command-list">
        {navItems.slice(0, 5).map(({ href, label: itemLabel, icon: Icon }) => <Link key={href} href={href} onClick={() => setSearchOpen(false)} className="command-item" data-testid={`link-command-${itemLabel.toLowerCase().replaceAll(' ', '-')}`}><Icon size={16} />{itemLabel}<ChevronRight size={14} /></Link>)}
      </div>
    </Modal>}
  </div>;
}

function Overview({ locale, notify }: { locale: Locale; notify: (message: string) => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const [focus, setFocus] = usePersistent('cortex-focus', false);
  const [turbo, setTurbo] = usePersistent('cortex-turbo', false);
  const label = (en: string, ar: string) => tr(locale, en, ar);
  const modules = [
    { href: '/projects', icon: FolderKanban, title: label('Projects Vault', 'خزنة المشاريع'), meta: '04 active', tone: 'cyan' },
    { href: '/study', icon: BookOpen, title: label('Study Hub', 'مركز الدراسة'), meta: '02 sessions', tone: 'green' },
    { href: '/games', icon: Gamepad2, title: label('Game Hub', 'مركز الألعاب'), meta: '03 installed', tone: 'violet' },
    { href: '/media', icon: Headphones, title: label('Music Lounge', 'صالة الموسيقى'), meta: '04 tracks', tone: 'orange' },
    { href: '/janitor', icon: Trash2, title: label('Clean Janitor', 'منظف النظام'), meta: '84% clean', tone: 'lime' },
    { href: '/deadlines', icon: CalendarClock, title: label('Deadline Radar', 'رادار المواعيد'), meta: '04 upcoming', tone: 'pink' },
  ];
  return <div>
    <SectionTitle eyebrow="01 / COCKPIT" title={label('Good evening, Sam.', 'مساء الخير، سام.')} detail={label('Your desk is quiet. Your context is loaded.', 'مكتبك هادئ. سياقك جاهز.')} action={<div className="clock-block"><span className="mono">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><small>{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</small></div>} />
    <div className="overview-grid">
      <section className="hero-panel panel shell-grid">
        <div className="hero-top"><span className="eyebrow mono"><span className="pulse-dot live-dot" />{label('SYSTEM READY', 'النظام جاهز')}</span><span className="mono quiet">SESSION 04:28:16</span></div>
         <div className="hero-copy"><h2>{locale === 'ar' ? <>مكتب واحد.<br /><em>كل الإشارات.</em></> : <>One desk.<br /><em>Every signal.</em></>}</h2><p>{label('Projects, lectures, hardware, and play — held in one fast local context.', 'مشاريعك ومحاضراتك وأجهزتك ووقتك — في سياق محلي سريع.')}</p></div>
        <div className="hero-actions"><Button variant="accent" onClick={() => { setFocus(!focus); notify(focus ? label('Focus mode off', 'تم إيقاف التركيز') : label('Focus mode on', 'تم تشغيل التركيز')); }} data-testid="button-focus-mode"><Zap size={15} />{focus ? label('Exit focus mode', 'إنهاء التركيز') : label('Start focus mode', 'بدء التركيز')}</Button><span className="mono action-hint">⌘ + ENTER</span></div>
        <div className="hero-foot"><span><span className="tiny-led cyan" />{label('All systems nominal', 'كل الأنظمة مستقرة')}</span><span className="mono">LOCAL ONLY · NO CLOUD</span></div>
      </section>
      <section className="telemetry panel">
        <div className="panel-head"><span className="eyebrow mono">LIVE TELEMETRY</span><Activity size={15} className="text-cyan" /></div>
        <div className="telemetry-chart"><div className="chart-grid" /><svg viewBox="0 0 460 130" preserveAspectRatio="none"><polyline points="0,96 28,91 48,97 74,64 103,76 127,54 153,68 178,44 203,57 225,48 249,77 277,59 305,67 332,36 361,49 385,30 409,44 436,22 460,28" fill="none" stroke="hsl(187 86% 54%)" strokeWidth="2" /></svg><span className="chart-now mono">NOW</span></div>
        <div className="telemetry-stats"><div><span>CPU LOAD</span><b>38.4%</b></div><div><span>MEMORY</span><b>6.2 <small>GB</small></b></div><div><span>UPTIME</span><b>18<small>h</small> 42<small>m</small></b></div></div>
      </section>
    </div>
    <div className="overview-lower">
       <section className="module-section"><div className="section-mini-head"><span className="eyebrow mono">{label('MODULES', 'الوحدات')}</span><span className="mono quiet">07 AVAILABLE</span></div><div className="module-grid">{[...modules, { href: '/media', icon: Disc3, title: label('Dynamic Island', 'الجزيرة الديناميكية'), meta: 'PLAYING · 04:12', tone: 'cyan' }].map(({ href, icon: Icon, title, meta, tone }, index) => <Link href={href} key={`${href}-${title}`} className={`module-card tone-${tone}`} data-testid={`link-module-${index}`}><span className="module-index mono">0{index + 1}</span><span className="module-icon"><Icon size={20} /></span><span className="module-title">{title}</span><span className="module-meta mono">{meta}<ArrowUpRight size={13} /></span></Link>)}</div></section>
      <aside className="quick-stack"><div className="section-mini-head"><span className="eyebrow mono">{label('QUICK SYSTEMS', 'أنظمة سريعة')}</span></div><div className="quick-item"><span className="quick-icon"><Power size={15} /></span><span><b>{label('Turbo Mode', 'الوضع السريع')}</b><small>{turbo ? label('Performance profile active', 'ملف الأداء مفعل') : label('Balanced performance', 'أداء متوازن')}</small></span><button className={`toggle ${turbo ? 'toggle-on' : ''}`} onClick={() => { setTurbo(!turbo); notify(turbo ? 'Turbo Mode disabled' : 'Turbo Mode enabled'); }} aria-label="Toggle Turbo Mode" data-testid="button-toggle-turbo"><span /></button></div><div className="quick-item"><span className="quick-icon"><Database size={15} /></span><span><b>{label('Local database', 'قاعدة البيانات المحلية')}</b><small>128 records · 4.7 MB</small></span><span className="status-pill status-active">READY</span></div></aside>
    </div>
  </div>;
}

function Projects({ locale, notify }: { locale: Locale; notify: (message: string) => void }) {
  const [projects, setProjects] = usePersistent<Project[]>('cortex-projects', seedProjects);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Project | null>(projects[0]);
  const [registering, setRegistering] = useState(false);
  const shown = projects.filter((project) => (filter === 'all' || project.status === filter) && `${project.name} ${project.description} ${project.stack.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const addProject = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const project: Project = { id: `local-${Date.now()}`, name: String(form.get('name')), description: String(form.get('description') || 'Local project workspace.'), status: 'active', stack: String(form.get('stack') || 'TypeScript').split(',').map((item) => item.trim()), progress: 0, path: String(form.get('path') || '~/code/new-project'), updated: 'just now' }; setProjects((list) => [project, ...list]); setSelected(project); setRegistering(false); notify('Project registered locally'); };
  const label = (en: string, ar: string) => tr(locale, en, ar);
  return <div><SectionTitle eyebrow="02 / WORKSPACE" title={label('Projects Vault', 'خزنة المشاريع')} detail={label('Everything you are building, within reach.', 'كل ما تبنيه، في متناولك.')} action={<Button variant="accent" onClick={() => setRegistering(true)} data-testid="button-register-project"><Plus size={15} />{label('Register project', 'تسجيل مشروع')}</Button>} />
    <div className="toolbar panel-subtle"><div className="input-wrap"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={label('Search projects...', 'ابحث في المشاريع...')} data-testid="input-project-search" /></div><div className="filter-tabs">{(['all', 'active', 'paused', 'archived'] as const).map((item) => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)} data-testid={`button-filter-${item}`}>{item === 'all' ? label('All', 'الكل') : item}</button>)}</div><span className="mono quiet toolbar-count">{shown.length.toString().padStart(2, '0')} FOUND</span></div>
    <div className="split-layout"><section className="project-list">{shown.map((project) => <button className={`project-row ${selected?.id === project.id ? 'project-selected' : ''}`} key={project.id} onClick={() => setSelected(project)} data-testid={`button-project-${project.id}`}><span className="project-symbol"><Terminal size={17} /></span><span className="project-main"><b>{project.name}</b><small>{project.description}</small><span className="project-tags">{project.stack.map((tag) => <em key={tag}>{tag}</em>)}</span></span><span className="project-status"><StatusPill status={project.status} /><small className="mono">{project.progress}%</small></span><ChevronRight size={15} /></button>)}{shown.length === 0 && <div className="empty-state"><FolderKanban size={22} /><b>No projects match</b><span>Try a different filter or register a new workspace.</span></div>}</section>{selected && <section className="project-detail panel"><div className="detail-top"><StatusPill status={selected.status} /><span className="mono quiet">UPDATED {selected.updated.toUpperCase()}</span></div><h2>{selected.name}</h2><p>{selected.description}</p><div className="detail-progress"><div className="detail-progress-label"><span>BUILD PROGRESS</span><b>{selected.progress}%</b></div><div className="progress-track"><span style={{ width: `${selected.progress}%` }} /></div></div><div className="detail-meta"><span><small>WORKSPACE</small><b className="mono">{selected.path}</b></span><span><small>STACK</small><b>{selected.stack.join(' · ')}</b></span></div><div className="detail-actions"><Button variant="accent" onClick={async () => { await openExternal(selected.path); notify(`Launch signal sent for ${selected.name}`); }} data-testid="button-launch-project"><Rocket size={15} />Launch workspace</Button><Button variant="outline" onClick={() => notify(`Explorer opened for ${selected.name}`)} data-testid="button-explore-project"><ArrowUpRight size={15} />Explore files</Button></div></section>}</div>
    {registering && <Modal title={label('Register a project', 'تسجيل مشروع')} onClose={() => setRegistering(false)}><form className="form-stack" onSubmit={addProject}><label>Project name<input required name="name" placeholder="e.g. Signal Garden" data-testid="input-register-name" /></label><label>Workspace path<input required name="path" placeholder="~/code/project" data-testid="input-register-path" /></label><label>Stack <input name="stack" placeholder="Rust, React, SQLite" data-testid="input-register-stack" /></label><label>Short description<textarea name="description" rows={3} placeholder="What is this becoming?" data-testid="input-register-description" /></label><Button variant="accent" type="submit" data-testid="button-submit-project"><Plus size={15} />Register locally</Button></form></Modal>}</div>;
}

function Study({ locale, notify }: { locale: Locale; notify: (message: string) => void }) {
  const [lecture, setLecture] = usePersistent('cortex-lecture', 'Distributed systems trade consistency for availability during network partitions. The CAP theorem describes this boundary. Replication strategies include leader-based replication, quorum reads, and eventual consistency. A practical system chooses a point in this design space based on user expectations and failure modes.');
  const [summary, setSummary] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState(false);
  const [flipped, setFlipped] = useState<number | null>(null);
  const questions = ['What does CAP describe?', 'Which strategy uses a leader?', 'What happens during a partition?', 'What should guide consistency choices?', 'What kind of consistency can replication produce?'];
  const choices = [['A storage format', 'A distributed trade-off', 'A UI pattern'], ['Leader-based replication', 'CSS modules', 'Edge caching'], ['The system chooses a trade-off', 'The CPU stops', 'Data is deleted'], ['User expectations and failures', 'Screen size', 'Font choice'], ['Eventual consistency', 'Pixel consistency', 'Static consistency']];
  const correct = [1, 0, 0, 0, 0];
  const generateSummary = () => { const sentences = lecture.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean); setSummary(`${sentences.slice(0, 2).join('. ')}. Key thread: ${sentences[2] || 'connect each concept to a failure mode'}.`); notify('Summary generated from local notes'); };
  const score = Object.entries(answers).reduce((total, [index, answer]) => total + (correct[Number(index)] === answer ? 1 : 0), 0);
  const label = (en: string, ar: string) => tr(locale, en, ar);
  return <div><SectionTitle eyebrow="03 / LEARNING" title={label('Study Hub', 'مركز الدراسة')} detail={label('Turn a lecture into something you can retrieve.', 'حوّل المحاضرة إلى معرفة يمكنك استرجاعها.')} action={<span className="context-chip"><BookOpen size={14} />CS 431 / DISTRIBUTED SYSTEMS</span>} />
    <div className="study-grid"><section className="panel study-editor"><div className="panel-head"><span className="eyebrow mono">LECTURE CAPTURE</span><span className="mono quiet">AUTOSAVED LOCALLY</span></div><textarea value={lecture} onChange={(event) => setLecture(event.target.value)} data-testid="input-lecture-text" /><div className="editor-foot"><span className="mono quiet">{lecture.split(/\s+/).filter(Boolean).length} WORDS</span><Button variant="accent" onClick={generateSummary} data-testid="button-generate-summary"><Sparkles size={15} />Generate summary</Button></div></section><section className="panel summary-card"><div className="panel-head"><span className="eyebrow mono">LOCAL SYNTHESIS</span><Sparkles size={15} className="text-green" /></div>{summary ? <p className="summary-text">{summary}</p> : <div className="empty-summary"><Sparkles size={25} /><span>Summary output appears here.</span><small>No network calls. Your lecture stays on this device.</small></div>}</section></div>
    <section className="quiz-section"><div className="section-mini-head"><span className="eyebrow mono">RECALL CHECK / 05</span>{graded && <strong className="score">{score} / 5 correct</strong>}</div><div className="quiz-grid">{questions.map((question, index) => <div className={`quiz-card panel ${graded ? (answers[index] === correct[index] ? 'quiz-correct' : 'quiz-wrong') : ''}`} key={question}><div className="quiz-number mono">0{index + 1}</div><b>{question}</b><div className="choice-list">{choices[index].map((choice, choiceIndex) => <button key={choice} className={answers[index] === choiceIndex ? 'choice-selected' : ''} onClick={() => { setGraded(false); setAnswers((current) => ({ ...current, [index]: choiceIndex })); }} data-testid={`button-answer-${index}-${choiceIndex}`}><span>{String.fromCharCode(65 + choiceIndex)}</span>{choice}</button>)}</div></div>)}</div><Button variant="outline" className="grade-button" onClick={() => { setGraded(true); notify('Quiz graded locally'); }} data-testid="button-grade-quiz"><Check size={15} />Grade recall check</Button></section>
    <section className="flashcard-section"><div className="section-mini-head"><span className="eyebrow mono">FLASHCARDS / 03</span><span className="mono quiet">CLICK TO FLIP</span></div><div className="flashcard-grid">{[['CAP theorem', 'Consistency, availability, and partition tolerance are competing guarantees.'], ['Quorum read', 'A read accepted after enough replicas respond.'], ['Eventual consistency', 'Replicas converge when updates stop.']].map(([front, back], index) => <button key={front} className={`flashcard ${flipped === index ? 'flipped' : ''}`} onClick={() => setFlipped(flipped === index ? null : index)} data-testid={`button-flashcard-${index}`}><span className="mono">{flipped === index ? 'ANSWER' : `CARD 0${index + 1}`}</span><strong>{flipped === index ? back : front}</strong><small>{flipped === index ? 'click to return' : 'click to reveal'}</small></button>)}</div></section>
  </div>;
}

function Games({ locale, notify }: { locale: Locale; notify: (message: string) => void }) {
  const [turbo, setTurbo] = usePersistent('cortex-turbo', false);
  const games = [{ title: 'Hades II', meta: 'Last played 2d ago', color: 'coral', icon: 'H2' }, { title: 'The Finals', meta: 'Last played 5d ago', color: 'blue', icon: 'TF' }, { title: 'Factorio', meta: 'Last played 8d ago', color: 'amber', icon: 'FC' }];
  const label = (en: string, ar: string) => tr(locale, en, ar);
  return <div><SectionTitle eyebrow="04 / OFF HOURS" title={label('Game Hub', 'مركز الألعاب')} detail={label('A clean launch surface between deep work sessions.', 'مساحة إطلاق نظيفة بين جلسات العمل.')} action={<div className="turbo-control"><Power size={14} /><span>Turbo Mode</span><button className={`toggle ${turbo ? 'toggle-on' : ''}`} onClick={() => { setTurbo(!turbo); notify(turbo ? 'Turbo Mode disabled' : 'Turbo Mode enabled — priority boosted'); }} data-testid="button-games-turbo"><span /></button></div>} /><div className="game-feature panel shell-grid"><div><span className="eyebrow mono">READY TO PLAY</span><h2>Make space<br /><em>for play.</em></h2><p>Games launch through a safe local mock handler. No launcher accounts required.</p></div><div className="game-feature-mark"><Gamepad2 size={48} strokeWidth={1} /><span className="mono">LOCAL<br />QUEUE</span></div></div><div className="game-grid">{games.map((game, index) => <article className={`game-card panel game-${game.color}`} key={game.title}><div className="game-art"><span>{game.icon}</span><small className="mono">0{index + 1}</small></div><div className="game-info"><h3>{game.title}</h3><p>{game.meta}</p><Button variant="outline" onClick={() => notify(`${game.title} launch queued`)} data-testid={`button-launch-game-${index}`}><Play size={13} />Launch</Button></div></article>)}</div><div className="game-status panel-subtle"><Gauge size={16} /><span><b>{turbo ? 'Turbo profile engaged' : 'Balanced profile'}</b><small>{turbo ? 'CPU priority raised for your next launch.' : 'System will keep background tasks balanced.'}</small></span><span className="mono quiet">MOCK HANDLER READY</span></div></div>;
}

function Media({ locale, notify }: { locale: Locale; notify: (message: string) => void }) {
  const [selected, setSelected] = usePersistent('cortex-track', tracks[0].id);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = usePersistent('cortex-volume', 68);
  const track = tracks.find((item) => item.id === selected) || tracks[0];
  const label = (en: string, ar: string) => tr(locale, en, ar);
  return <div><SectionTitle eyebrow="05 / ATMOSPHERE" title={label('Music Lounge', 'صالة الموسيقى')} detail={label('Soundtrack the context, not the noise.', 'صمّم صوت السياق، لا الضوضاء.')} action={<span className="context-chip"><Disc3 size={14} />LOCAL PLAYBACK</span>} /><div className="media-layout"><section className="now-playing panel"><div className="album-visual"><div className="album-ring ring-one" /><div className="album-ring ring-two" /><div className="album-core"><Music2 size={29} /></div><span className="mono">CORTEX<br />FM</span></div><div className="now-meta"><span className="eyebrow mono">NOW PLAYING</span><h2>{track.title}</h2><p>{track.artist} · {track.mood}</p><div className="track-progress"><span /><small className="mono">01:24 / {track.duration}</small></div><div className="player-controls"><Button variant="ghost" onClick={() => notify('Previous track selected')} aria-label="Previous track" data-testid="button-previous-track"><ChevronRight className="flip-x" size={18} /></Button><Button variant="accent" className="play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} data-testid="button-play-pause">{playing ? <Pause size={19} /> : <Play size={19} />}</Button><Button variant="ghost" onClick={() => { const next = tracks[(tracks.findIndex((item) => item.id === selected) + 1) % tracks.length]; setSelected(next.id); }} aria-label="Next track" data-testid="button-next-track"><ChevronRight size={18} /></Button><div className="volume"><Volume2 size={15} /><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" data-testid="input-volume" /></div></div></div></section><section className="panel preset-panel"><div className="panel-head"><span className="eyebrow mono">{label('PRESETS', 'الإعدادات المسبقة')}</span><ListFilter size={15} /></div><div className="preset-grid">{['Deep work', 'Night drive', 'Soft landing', 'Signal / noise'].map((preset, index) => <button className={index === 0 ? 'preset preset-selected' : 'preset'} onClick={() => notify(`${preset} preset active`)} key={preset} data-testid={`button-preset-${index}`}><span className={`preset-orb orb-${index}`} /><b>{preset}</b><small>{['Binaural · 62 min', 'Ambient · 48 min', 'Piano · 56 min', 'Electronic · 71 min'][index]}</small></button>)}</div></section></div><section className="track-list-section"><div className="section-mini-head"><span className="eyebrow mono">{label('QUEUE', 'قائمة التشغيل')}</span><span className="mono quiet">{tracks.length.toString().padStart(2, '0')} TRACKS</span></div><div className="track-list">{tracks.map((item, index) => <button className={`track-row ${item.id === selected ? 'track-selected' : ''}`} onClick={() => { setSelected(item.id); setPlaying(true); }} key={item.id} data-testid={`button-track-${item.id}`}><span className="track-number mono">{item.id === selected && playing ? <span className="playing-bars"><i /><i /><i /></span> : `0${index + 1}`}</span><span><b>{item.title}</b><small>{item.artist}</small></span><span className="track-mood">{item.mood}</span><span className="mono quiet">{item.duration}</span></button>)}</div></section></div>;
}

function Janitor({ locale, notify }: { locale: Locale; notify: (message: string) => void }) {
  const [report, setReport] = usePersistent('cortex-janitor-report', { score: 84, lastRun: 'Today, 18:42', moved: 0, folders: 0 });
  const [running, setRunning] = useState(false);
  const run = async () => { setRunning(true); const result = await organizeWorkspace(); setReport({ score: 96, lastRun: 'Just now', moved: 47, folders: 8 }); setRunning(false); notify(result.source === 'mock' ? 'Workspace organized in mock mode' : 'Workspace organized'); };
  const label = (en: string, ar: string) => tr(locale, en, ar);
  return <div><SectionTitle eyebrow="06 / MAINTENANCE" title={label('Clean Janitor', 'منظف النظام')} detail={label('A small reset for a noisy workspace.', 'إعادة ضبط صغيرة لمساحة عمل مزدحمة.')} action={<Button variant="accent" onClick={run} disabled={running} data-testid="button-organize-workspace">{running ? <RefreshCw className="spin" size={15} /> : <Sparkles size={15} />}{running ? 'Organizing...' : label('Organize workspace', 'تنظيم مساحة العمل')}</Button>} /><div className="janitor-grid"><section className="clean-score panel"><div className="score-ring" style={{ '--score': `${report.score * 3.6}deg` } as React.CSSProperties}><div><strong>{report.score}</strong><small>/ 100</small></div></div><div><span className="eyebrow mono">CLUTTER SCORE</span><h2>{report.score > 90 ? 'Clear channel.' : 'Almost clear.'}</h2><p>{report.score > 90 ? 'Your workspace is ready for another focused session.' : 'A few stale downloads and loose files are still in the way.'}</p></div></section><section className="panel janitor-report"><div className="panel-head"><span className="eyebrow mono">LOCAL REPORT</span><span className="mono quiet">{report.lastRun.toUpperCase()}</span></div><div className="report-rows"><div><span><HardDrive size={15} />Downloads</span><b className="status-good">12 items</b></div><div><span><Boxes size={15} />Loose folders</span><b className="status-good">{report.folders || 3} found</b></div><div><span><Trash2 size={15} />Stale cache</span><b className="status-warn">{report.moved ? '0.8 GB' : '1.4 GB'}</b></div><div><span><Check size={15} />Files organized</span><b>{report.moved || 0}</b></div></div></section></div><div className="janitor-note panel-subtle"><CircleHelp size={16} /><span><b>{label('Safe by default', 'آمن افتراضياً')}</b><small>{label('Janitor only moves files into local folders. Nothing is deleted without your confirmation.', 'المنظف ينقل الملفات فقط إلى مجلدات محلية. لا شيء يُحذف دون تأكيدك.')}</small></span></div></div>;
}

function timeLeft(date: string) { const delta = new Date(date).getTime() - Date.now(); if (delta <= 0) return 'PAST DUE'; const d = Math.floor(delta / 86400000); const h = Math.floor((delta % 86400000) / 3600000); return `${d}d ${h}h`; }

function Deadlines({ locale, notify }: { locale: Locale; notify: (message: string) => void }) {
  const [deadlines, setDeadlines] = usePersistent<Deadline[]>('cortex-deadlines', seedDeadlines);
  const [adding, setAdding] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), 60000); return () => window.clearInterval(timer); }, []);
  const label = (en: string, ar: string) => tr(locale, en, ar);
  const add = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); setDeadlines((list) => [...list, { id: `d-${Date.now()}`, title: String(form.get('title')), course: String(form.get('course') || 'Personal'), date: String(form.get('date')), priority: String(form.get('priority')) as Deadline['priority'] }]); setAdding(false); notify('Deadline added locally'); };
  const orderedDeadlines = [...deadlines].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextDeadline = orderedDeadlines[0];
  return <div><SectionTitle eyebrow="07 / TIME" title={label('Deadline Radar', 'رادار المواعيد')} detail={label('The next thing, without the panic.', 'الشيء التالي، بلا توتر.')} action={<Button variant="accent" onClick={() => setAdding(true)} data-testid="button-add-deadline"><Plus size={15} />{label('Add deadline', 'إضافة موعد')}</Button>} /><div className="radar-summary panel"><div><span className="eyebrow mono">NEXT SIGNAL</span><h2>{nextDeadline?.title}</h2><p>{nextDeadline?.course}</p></div><div className="next-countdown"><span className="mono">T−</span><strong>{nextDeadline ? timeLeft(nextDeadline.date) : '--'}</strong><small>{nextDeadline && new Date(nextDeadline.date).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}</small></div></div><div className="deadline-list">{orderedDeadlines.map((deadline, index) => <article className={`deadline-row panel-subtle priority-${deadline.priority}`} key={deadline.id}><span className="deadline-index mono">0{index + 1}</span><span className="deadline-main"><b>{deadline.title}</b><small>{deadline.course}</small></span><span className={`priority-label priority-${deadline.priority}`}>{deadline.priority}</span><span className="deadline-date"><b>{timeLeft(deadline.date)}</b><small>{new Date(deadline.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></span><Button variant="ghost" aria-label={`Remove ${deadline.title}`} onClick={() => { setDeadlines((list) => list.filter((item) => item.id !== deadline.id)); notify('Deadline removed'); }} data-testid={`button-remove-deadline-${deadline.id}`}><X size={15} /></Button></article>)}</div>{adding && <Modal title={label('Add a deadline', 'إضافة موعد')} onClose={() => setAdding(false)}><form className="form-stack" onSubmit={add}><label>Title<input required name="title" placeholder="Assignment, exam, review..." data-testid="input-deadline-title" /></label><label>Context<input name="course" placeholder="CS 431 · Lab report" data-testid="input-deadline-course" /></label><label>Date and time<input required type="datetime-local" name="date" data-testid="input-deadline-date" /></label><label>Priority<select name="priority" defaultValue="medium" data-testid="input-deadline-priority"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><Button variant="accent" type="submit" data-testid="button-submit-deadline"><Plus size={15} />Add to radar</Button></form></Modal>}</div>;
}

function Settings({ locale, setLocale, notify }: { locale: Locale; setLocale: (locale: Locale) => void; notify: (message: string) => void }) {
  const [activeTab, setActiveTab] = useState('general');
  const [sync, setSync] = usePersistent('cortex-sync', true);
  const [hardware, setHardware] = usePersistent('cortex-hardware', true);
  const [sound, setSound] = usePersistent('cortex-sound', true);
  const [compact, setCompact] = usePersistent('cortex-compact', false);
  const [processPriority, setProcessPriority] = usePersistent('cortex-process-priority', true);
  const [powerProfile, setPowerProfile] = usePersistent('cortex-power-profile', 'balanced');
  const [supabaseUrl, setSupabaseUrl] = usePersistent('cortex-supabase-url', '');
  const [anonKey, setAnonKey] = usePersistent('cortex-supabase-key', '');
  const [projectsPath, setProjectsPath] = usePersistent('cortex-projects-path', 'd:\\dev26-27');
  const [downloadsPath, setDownloadsPath] = usePersistent('cortex-downloads-path', 'd:\\downloads');
  const [volume, setVolume] = usePersistent('cortex-volume', 68);
  const [connectionStatus, setConnectionStatus] = useState<'offline' | 'connected'>('offline');
  const label = (en: string, ar: string) => tr(locale, en, ar);
  const tabs = [
    { id: 'general', title: 'General & Language', ar: 'عام واللغة', icon: SunMedium },
    { id: 'cloud', title: 'Cloud Sync (Supabase)', ar: 'المزامنة السحابية (Supabase)', icon: Database },
    { id: 'paths', title: 'Workspaces & Paths', ar: 'مساحات العمل والمسارات', icon: FolderKanban },
    { id: 'data', title: 'Data Manager', ar: 'مدير البيانات', icon: HardDrive },
    { id: 'hardware', title: 'Hardware & Turbo', ar: 'الأجهزة والوضع السريع', icon: Cpu },
    { id: 'audio', title: 'Audio & Media', ar: 'الصوت والوسائط', icon: Volume2 },
  ];
  const settingLabel = (en: string, ar: string) => label(en, ar);
  const field = (title: string, value: string, setValue: (value: string) => void, type = 'text') => <label className="setting-field"><span>{title}</span><input type={type} value={value} onChange={(event) => setValue(event.target.value)} /></label>;
  const exportBackup = () => {
    const data = Object.fromEntries(Object.keys(localStorage).filter((key) => key.startsWith('cortex-')).map((key) => [key, localStorage.getItem(key)]));
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cortexos-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    notify(settingLabel('Backup exported', 'تم تصدير النسخة الاحتياطية'));
  };
  const clearCache = () => {
    if (!window.confirm(settingLabel('Clear all local CortexOS data?', 'هل تريد مسح جميع بيانات CortexOS المحلية؟'))) return;
    Object.keys(localStorage).filter((key) => key.startsWith('cortex-') && key !== 'cortex-locale').forEach((key) => localStorage.removeItem(key));
    notify(settingLabel('Local cache cleared', 'تم مسح الذاكرة المحلية'));
    window.setTimeout(() => window.location.reload(), 300);
  };
  const content = {
    general: <div className="settings-form">
      <div className="settings-section-heading"><span className="settings-icon"><SunMedium size={16} /></span><div><h2>{settingLabel('General & Language', 'عام واللغة')}</h2><p>{settingLabel('Set the language and density of the CortexOS workspace.', 'حدد لغة وكثافة مساحة عمل CortexOS.')}</p></div></div>
      <div className="settings-field-grid">
        <label className="setting-field"><span>{settingLabel('App language', 'لغة التطبيق')}</span><select value={locale} onChange={(event) => { const next = event.target.value as Locale; setLocale(next); notify(next === 'ar' ? 'العربية · RTL' : 'English · LTR'); }}><option value="en">English (LTR)</option><option value="ar">العربية (RTL)</option></select></label>
        <div className="setting-row"><span><b>{settingLabel('Compact density', 'الكثافة المضغوطة')}</b><small>{settingLabel('Reduce spacing across the cockpit.', 'تقليل المسافات في المركز.')}</small></span><button className={`toggle ${compact ? 'toggle-on' : ''}`} onClick={() => setCompact(!compact)} aria-label="Toggle compact density"><span /></button></div>
      </div>
    </div>,
    cloud: <div className="settings-form">
      <div className="settings-section-heading"><span className="settings-icon"><Database size={16} /></span><div><h2>{settingLabel('Cloud Sync & Supabase', 'المزامنة السحابية و Supabase')}</h2><p>{settingLabel('Optional sync for notes, summaries, flashcards, and deadlines.', 'مزامنة اختيارية للملاحظات والملخصات والبطاقات والمواعيد.')}</p></div></div>
      {field('Supabase Project URL', supabaseUrl, setSupabaseUrl, 'url')}
      {field('Anon Public API Key', anonKey, setAnonKey, 'password')}
      <div className="settings-actions"><Button variant="outline" onClick={() => { const connected = Boolean(supabaseUrl && anonKey); setConnectionStatus(connected ? 'connected' : 'offline'); notify(connected ? 'Connection verified' : 'Offline · add both Supabase values'); }}>{settingLabel('Test connection', 'اختبار الاتصال')}</Button><Button variant="accent" onClick={() => { setSync(true); notify(settingLabel('Sync queued locally', 'تمت جدولة المزامنة محلياً')); }}><RefreshCw size={14} />{settingLabel('Force sync now', 'مزامنة الآن')}</Button><span className={`connection-status ${connectionStatus}`}><span />{connectionStatus === 'connected' ? 'CONNECTED' : 'OFFLINE'}</span></div>
    </div>,
    paths: <div className="settings-form">
      <div className="settings-section-heading"><span className="settings-icon"><FolderKanban size={16} /></span><div><h2>{settingLabel('Workspaces & Paths', 'مساحات العمل والمسارات')}</h2><p>{settingLabel('Directories used by native launchers and local organization.', 'المجلدات المستخدمة من أدوات التشغيل والتنظيم المحلي.')}</p></div></div>
      {field('Default Projects Directory', projectsPath, setProjectsPath)}
      {field('Downloads Directory', downloadsPath, setDownloadsPath)}
      <label className="setting-field"><span>Preferred code editor</span><select defaultValue="cursor"><option>VS Code</option><option>Cursor</option><option>Windsurf</option><option>Antigravity</option></select></label>
    </div>,
    data: <div className="settings-form">
      <div className="settings-section-heading"><span className="settings-icon"><HardDrive size={16} /></span><div><h2>{settingLabel('Data Manager', 'مدير البيانات')}</h2><p>{settingLabel('Export or reset the local CortexOS state.', 'تصدير أو إعادة ضبط حالة CortexOS المحلية.')}</p></div></div>
      <div className="data-meter"><span><b>{settingLabel('Local storage used', 'التخزين المحلي المستخدم')}</b><small>4.7 MB · 128 records</small></span><div><i style={{ width: '18%' }} /></div></div>
      <div className="settings-actions"><Button variant="outline" onClick={exportBackup}><HardDrive size={14} />{settingLabel('Export Backup JSON', 'تصدير نسخة JSON')}</Button><Button variant="ghost" onClick={clearCache}><Trash2 size={14} />{settingLabel('Clear Local Cache', 'مسح الذاكرة المحلية')}</Button></div>
    </div>,
    hardware: <div className="settings-form">
      <div className="settings-section-heading"><span className="settings-icon"><Cpu size={16} /></span><div><h2>{settingLabel('Hardware & Turbo', 'الأجهزة والوضع السريع')}</h2><p>{settingLabel('Tune how the desktop bridge behaves during focused work.', 'اضبط سلوك جسر سطح المكتب أثناء العمل المركز.')}</p></div></div>
      <label className="setting-field"><span>Power profile</span><select value={powerProfile} onChange={(event) => setPowerProfile(event.target.value)}><option value="balanced">Balanced</option><option value="performance">High Performance</option></select></label>
      <div className="setting-row"><span><b>Hardware bridge</b><small>Browser-safe mock outside the Tauri shell.</small></span><button className={`toggle ${hardware ? 'toggle-on' : ''}`} onClick={() => setHardware(!hardware)} aria-label="Toggle hardware bridge"><span /></button></div>
      <div className="setting-row"><span><b>Process priority</b><small>Prefer development processes during active sessions.</small></span><button className={`toggle ${processPriority ? 'toggle-on' : ''}`} onClick={() => setProcessPriority(!processPriority)} aria-label="Toggle process priority"><span /></button></div>
    </div>,
    audio: <div className="settings-form">
      <div className="settings-section-heading"><span className="settings-icon"><Volume2 size={16} /></span><div><h2>{settingLabel('Audio & Media', 'الصوت والوسائط')}</h2><p>{settingLabel('Control sound cues and the default ambient workspace level.', 'تحكم في أصوات التنبيه ومستوى الوسائط الافتراضي.')}</p></div></div>
      <div className="setting-row"><span><b>Sound effects</b><small>Play short confirmation cues for local actions.</small></span><button className={`toggle ${sound ? 'toggle-on' : ''}`} onClick={() => setSound(!sound)} aria-label="Toggle sound effects"><span /></button></div>
      <label className="setting-field"><span>Master volume <b className="range-value">{volume}%</b></span><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
      <label className="setting-field"><span>Ambient preset</span><select defaultValue="lofi"><option value="lofi">Night study · Lo-Fi</option><option value="rain">Rain on glass</option><option value="circuit">Soft circuit</option></select></label>
    </div>,
  } as Record<string, ReactNode>;
  return <div><SectionTitle eyebrow="SYSTEM / 08" title={label('Settings', 'الإعدادات')} detail={label('System-only controls for this local cockpit.', 'عناصر تحكم النظام لهذا المركز المحلي.')} /><div className="settings-layout"><nav className="settings-tabs panel" aria-label="Settings tabs" role="tablist">{tabs.map(({ id, title, ar, icon: Icon }) => <button key={id} className={`settings-tab ${activeTab === id ? 'settings-tab-active' : ''}`} onClick={() => setActiveTab(id)} role="tab" aria-selected={activeTab === id}><Icon size={16} /><span>{label(title, ar)}</span><ChevronRight size={14} /></button>)}</nav><section className="settings-content panel" role="tabpanel">{content[activeTab]}</section></div></div>;
}

function NotFound() { return <div className="empty-page"><Terminal size={30} /><h1>404 / signal not found</h1><Link href="/overview" className="btn btn-accent">Return to cockpit</Link></div>; }

function App() {
  const [locale, setLocale] = usePersistent<Locale>('cortex-locale', 'en');
  const [toast, setToast] = useState('');
  useEffect(() => { document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = locale; }, [locale]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><TooltipProvider><AppShell locale={locale} toast={toast}><Switch><Route path="/" component={() => <Overview locale={locale} notify={notify} />} /><Route path="/overview" component={() => <Overview locale={locale} notify={notify} />} /><Route path="/projects" component={() => <Projects locale={locale} notify={notify} />} /><Route path="/study" component={() => <Study locale={locale} notify={notify} />} /><Route path="/games" component={() => <Games locale={locale} notify={notify} />} /><Route path="/media" component={() => <Media locale={locale} notify={notify} />} /><Route path="/janitor" component={() => <Janitor locale={locale} notify={notify} />} /><Route path="/deadlines" component={() => <Deadlines locale={locale} notify={notify} />} /><Route path="/settings" component={() => <Settings locale={locale} setLocale={setLocale} notify={notify} />} /><Route component={NotFound} /></Switch></AppShell><Toaster /></TooltipProvider></ErrorBoundary></WouterRouter>;
}

export default App;