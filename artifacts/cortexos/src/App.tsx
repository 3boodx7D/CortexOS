import { type FormEvent, type InputHTMLAttributes, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  Archive,
  ArrowUpRight,
  AudioLines,
  Blocks,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  Database,
  Download,
  FileCode2,
  FolderGit2,
  Gamepad2,
  HardDrive,
  Headphones,
  LayoutDashboard,
  Library,
  ListChecks,
  Loader2,
  LockKeyhole,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Music2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Timer,
  Trash2,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useCreateDeadline,
  useCreateNote,
  useCreateProject,
  useDeleteNote,
  useGetCortexOverview,
  useGetIntegrationStatus,
  useListDeadlines,
  useListNotes,
  useListProjects,
  useUpdateDeadline,
  useUpdateNote,
  getGetCortexOverviewQueryKey,
  getGetIntegrationStatusQueryKey,
  getListDeadlinesQueryKey,
  getListNotesQueryKey,
  getListProjectsQueryKey,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import './index.css';

const queryClient = new QueryClient();

type IconType = LucideIcon;

const navGroups: { label: string; items: { href: string; label: string; icon: IconType }[] }[] = [
  {
    label: 'Command',
    items: [{ href: '/', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    label: 'Build',
    items: [
      { href: '/projects', label: 'Project vault', icon: FolderGit2 },
      { href: '/study', label: 'Study hub', icon: BookOpen },
      { href: '/deadlines', label: 'Deadline radar', icon: ListChecks },
    ],
  },
  {
    label: 'Play',
    items: [
      { href: '/games', label: 'Game room', icon: Gamepad2 },
      { href: '/music', label: 'Offline music', icon: Music2 },
    ],
  },
  {
    label: 'Systems',
    items: [
      { href: '/backups', label: 'Backups', icon: Archive },
      { href: '/ai', label: 'AI router', icon: Sparkles },
      { href: '/supabase', label: 'Data studio', icon: Database },
    ],
  },
];

const pageTitles: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Mission control', title: 'Good morning, Alex.' },
  '/projects': { eyebrow: 'Build / inventory', title: 'Project vault' },
  '/study': { eyebrow: 'Build / learning', title: 'Study hub' },
  '/games': { eyebrow: 'Play / performance', title: 'Game room' },
  '/music': { eyebrow: 'Play / listening', title: 'Offline music' },
  '/backups': { eyebrow: 'Systems / resilience', title: 'Backup station' },
  '/deadlines': { eyebrow: 'Build / timeline', title: 'Deadline radar' },
  '/ai': { eyebrow: 'Systems / intelligence', title: 'AI router' },
  '/supabase': { eyebrow: 'Systems / data', title: 'Data studio' },
  '/settings': { eyebrow: 'Workspace / control', title: 'Settings' },
};

function cn(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ');
}

function Button({
  children,
  variant = 'primary',
  className,
  onClick,
  type = 'button',
  disabled,
  testId,
}: {
  children: ReactNode;
  variant?: 'primary' | 'quiet' | 'outline' | 'danger';
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-bold tracking-[.01em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
        variant === 'quiet' && 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
        variant === 'outline' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary)/.7)] hover:bg-[hsl(var(--primary)/.1)]',
        variant === 'danger' && 'border border-[hsl(var(--destructive)/.3)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Panel({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cn('panel-cortex rounded-xl', className)}>
      {children}
    </section>
  );
}

function SectionHeading({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="font-mono-cortex mb-1 text-[9px] font-bold uppercase tracking-[.19em] text-[hsl(var(--muted-foreground))]">{kicker}</p>}
        <h2 className="display-cortex text-xl font-bold text-[hsl(var(--foreground))]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[hsl(var(--muted))]', className)} />;
}

function LoadingPanel({ rows = 3 }: { rows?: number }) {
  return (
    <Panel className="space-y-4 p-5" testId="status-loading">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-6 w-52" />
      {Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
    </Panel>
  );
}

function ErrorPanel({ retry }: { retry?: () => void }) {
  return (
    <Panel className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center" testId="status-error">
      <TriangleAlert className="h-5 w-5 text-[hsl(var(--destructive))]" />
      <div>
        <p className="font-bold text-[hsl(var(--foreground))]">Signal lost</p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">The control center could not reach this surface.</p>
      </div>
      {retry && <Button variant="outline" onClick={retry} testId="button-retry"><RefreshCw className="h-3.5 w-3.5" /> Try again</Button>}
    </Panel>
  );
}

function EmptyState({ icon: Icon, title, detail, action }: { icon: IconType; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-center" data-testid="status-empty">
      <div className="mb-3 rounded-lg bg-[hsl(var(--muted))] p-3 text-[hsl(var(--muted-foreground))]"><Icon className="h-5 w-5" /></div>
      <p className="font-bold text-[hsl(var(--foreground))]">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const style = status === 'connected' || status === 'active' ? 'bg-[hsl(157_35%_88%)] text-[hsl(158_45%_25%)]' : status === 'planned' || status === 'experiment' ? 'bg-[hsl(39_70%_89%)] text-[hsl(31_65%_31%)]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]';
  return <span className={cn('font-mono-cortex inline-flex rounded px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em]', style)} data-testid={`status-${status}`}>{status}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(211_28%_17%/.35)] p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" data-testid="dialog-modal">
      <div className="w-full max-w-lg rounded-t-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl sm:rounded-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display-cortex text-xl font-bold">{title}</h2>
          <Button variant="quiet" onClick={onClose} testId="button-close-dialog"><X className="h-4 w-4" /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono-cortex text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{hint}</span>}
    </label>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement> & { 'data-testid'?: string }) {
  return <input {...props} className={cn('w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background)/.5)] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.18)]', props.className)} />;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const page = pageTitles[location] ?? pageTitles['/'];
  return (
    <div className="cortex-noise min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <aside className={cn('fixed inset-y-0 left-0 z-30 flex w-[250px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] px-3 py-4 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:translate-x-0', collapsed ? 'md:w-[76px]' : '', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className={cn('mb-8 flex items-center gap-3 px-2', collapsed ? 'md:justify-center' : '')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Command className="h-4 w-4" /></div>
          <div className={cn('min-w-0', collapsed ? 'md:hidden' : '')}><p className="display-cortex text-lg font-bold leading-none">CortexOS</p><p className="font-mono-cortex mt-1 text-[8px] uppercase tracking-[.22em] text-[hsl(var(--sidebar-foreground)/.55)]">Control center</p></div>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className={cn('font-mono-cortex mb-2 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.42)]', collapsed ? 'md:hidden' : '')}>{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={cn('group flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold transition-colors', location === href ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]' : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]', collapsed ? 'md:justify-center md:px-2' : '')}>
                    <Icon className="h-4 w-4 shrink-0" /><span className={collapsed ? 'md:hidden' : ''}>{label}</span>{location === href && <span className={cn('ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]', collapsed ? 'md:hidden' : '')} />}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className={cn('border-t border-[hsl(var(--sidebar-border))] pt-3', collapsed ? 'md:flex md:justify-center' : '')}>
          <Link href="/settings" onClick={() => setOpen(false)} data-testid="link-nav-settings" className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]', location === '/settings' && 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]')}><Settings2 className="h-4 w-4" /><span className={collapsed ? 'md:hidden' : ''}>Settings</span></Link>
          {!collapsed && <div className="mt-4 flex items-center gap-2 px-3"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-[10px] font-bold text-[hsl(var(--accent-foreground))]">AL</div><div className="min-w-0"><p className="truncate text-[11px] font-bold">Alex Lin</p><p className="font-mono-cortex truncate text-[9px] text-[hsl(var(--sidebar-foreground)/.45)]">local workspace</p></div><div className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(157_55%_55%)]" /></div>}
        </div>
      </aside>
      <div className={cn('transition-[padding] duration-300 md:pl-[250px]', collapsed && 'md:pl-[76px]')}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.9)] px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3"><Button variant="quiet" className="md:hidden" onClick={() => setOpen(!open)} testId="button-open-menu"><Menu className="h-5 w-5" /></Button><Button variant="quiet" className="hidden md:inline-flex" onClick={() => setCollapsed(!collapsed)} testId="button-toggle-sidebar">{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</Button><div><p className="font-mono-cortex text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{page.eyebrow}</p><h1 className="display-cortex text-lg font-bold sm:text-xl" data-testid="text-page-title">{page.title}</h1></div></div>
          <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))] sm:flex"><Search className="h-3.5 w-3.5" /><span>Jump to surface</span><kbd className="font-mono-cortex ml-3 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px]">⌘ K</kbd></div><div className="relative flex h-2 w-2 rounded-full bg-[hsl(157_55%_45%)]"><span className="live-pulse absolute -inset-1 rounded-full bg-[hsl(157_55%_45%)/.2]" /></div><span className="font-mono-cortex hidden text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] lg:inline">synced</span></div>
        </header>
        <main className="cortex-grid min-h-[calc(100dvh-72px)] px-4 py-6 sm:px-7 sm:py-8 lg:px-10">{children}</main>
      </div>
      {open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-[hsl(211_28%_17%/.35)] md:hidden" data-testid="button-close-menu" />}
    </div>
  );
}

function PageIntro({ label, title, detail, action }: { label: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono-cortex mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[hsl(var(--primary-foreground))]"><span className="rounded bg-[hsl(var(--primary))] px-2 py-1">{label}</span></p><h2 className="display-cortex text-3xl font-bold tracking-[-.055em] sm:text-4xl">{title}</h2><p className="mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">{detail}</p></div>{action}</div>;
}

function StatCard({ label, value, detail, accent = 'primary', icon: Icon }: { label: string; value: string | number; detail: string; accent?: 'primary' | 'teal' | 'coral'; icon: IconType }) {
  const color = accent === 'teal' ? 'text-[hsl(171_42%_35%)] bg-[hsl(171_33%_82%)]' : accent === 'coral' ? 'text-[hsl(var(--destructive))] bg-[hsl(6_62%_89%)]' : 'text-[hsl(var(--primary-foreground))] bg-[hsl(var(--primary))]';
  return <Panel className="relative overflow-hidden p-4 sm:p-5" testId={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className={cn('mb-5 flex h-8 w-8 items-center justify-center rounded-md', color)}><Icon className="h-4 w-4" /></div><p className="font-mono-cortex text-[10px] font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="display-cortex mt-1 text-3xl font-bold">{value}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</p><div className="absolute -right-5 -top-7 h-24 w-24 rounded-full border-[10px] border-[hsl(var(--primary)/.08)]" /></Panel>;
}

function OverviewPage() {
  const overview = useGetCortexOverview();
  const notes = useListNotes();
  const invalidate = useQueryClient();
  if (overview.isLoading) return <div className="mx-auto max-w-[1400px] space-y-5"><Skeleton className="h-24 w-2/3" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36" />)}</div><LoadingPanel /></div>;
  if (overview.isError || !overview.data) return <div className="mx-auto max-w-[1400px]"><ErrorPanel retry={() => invalidate.invalidateQueries({ queryKey: getGetCortexOverviewQueryKey() })} /></div>;
  const data = overview.data;
  const projects = data.projects ?? [];
  const deadlines = data.deadlines ?? [];
  const activities = data.activities ?? [];
  const integrations = data.integrations ?? [];
  return <div className="mx-auto max-w-[1400px] space-y-6">
    <div className="reveal flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono-cortex mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[hsl(var(--primary-foreground))]"><span className="rounded bg-[hsl(var(--primary))] px-2 py-1">Tuesday · 08:42</span></p><h2 className="display-cortex text-3xl font-bold tracking-[-.06em] sm:text-5xl" data-testid="text-greeting">{data.greeting}</h2><p className="mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">Your workspace is warm. Here is the signal worth acting on first.</p></div><Button variant="outline" testId="button-refresh-overview" onClick={() => invalidate.invalidateQueries({ queryKey: getGetCortexOverviewQueryKey() })}><RefreshCw className="h-3.5 w-3.5" /> Refresh signal</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: 'Active projects', value: data.stats.activeProjects, detail: '1 moved this week', icon: FolderGit2, accent: 'primary' as const },
      { label: 'Open deadlines', value: data.stats.openDeadlines, detail: '2 need attention soon', icon: Clock3, accent: 'coral' as const },
      { label: 'Focus minutes', value: data.stats.focusMinutes, detail: 'this week · +18% tempo', icon: Timer, accent: 'teal' as const },
      { label: 'Study progress', value: `${data.stats.studyProgress}%`, detail: data.study.nextLabel, icon: BookOpen, accent: 'primary' as const },
    ].map((stat, i) => <div key={stat.label} className={`reveal reveal-delay-${Math.min(i + 1, 3)}`}><StatCard {...stat} /></div>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
      <Panel className="reveal reveal-delay-1 overflow-hidden" testId="panel-active-projects"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><SectionHeading kicker="In motion" title="Active projects" action={<Link href="/projects" data-testid="link-view-projects" className="font-mono-cortex inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">View vault <ArrowUpRight className="h-3 w-3" /></Link>} /></div><div className="divide-y divide-[hsl(var(--border))]">{projects.slice(0, 4).map((project) => <div className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[hsl(var(--muted)/.42)]" key={project.id} data-testid={`row-project-${project.id}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><FileCode2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{project.name}</p><StatusPill status={project.status} /></div><p className="font-mono-cortex mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{project.path}</p></div><div className="hidden w-28 sm:block"><div className="mb-1 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]"><span>progress</span><span>{project.progress ?? 0}%</span></div><div className="h-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${project.progress ?? 0}%` }} /></div></div><ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground)/.5)] transition-transform group-hover:translate-x-1" /></div>)}{projects.length === 0 && <div className="p-5"><EmptyState icon={FolderGit2} title="No active projects" detail="Your build queue is clear. Add a project when you are ready." action={<Link href="/projects" data-testid="link-add-first-project" className="inline-flex rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold">Add a project</Link>} /></div>}</div></Panel>
      <Panel className="reveal reveal-delay-2 p-5" testId="panel-focus-progress"><SectionHeading kicker="Today" title="Focus progress" action={<span className="font-mono-cortex text-[10px] text-[hsl(var(--muted-foreground))]">08:42 local</span>} /><div className="flex items-center gap-6 py-3"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${Math.min(data.stats.focusMinutes / 480 * 100, 100)}%, hsl(var(--muted)) 0)` }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[hsl(var(--card))]"><span className="display-cortex text-2xl font-bold">{data.stats.focusMinutes}</span><span className="font-mono-cortex text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">minutes</span></div></div><div><p className="font-bold">Solid tempo.</p><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">You are {Math.max(0, 480 - data.stats.focusMinutes)} minutes from your weekly focus target.</p><Button variant="outline" className="mt-4" testId="button-start-focus"><Zap className="h-3.5 w-3.5" /> Start focus block</Button></div></div></Panel>
    </div>
    <div className="grid gap-6 lg:grid-cols-[.85fr_1fr_1fr]">
      <Panel className="reveal p-5" testId="panel-study-snapshot"><SectionHeading kicker="Learning loop" title="Study snapshot" /><div className="rounded-lg bg-[hsl(var(--secondary)/.5)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono-cortex text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Current course</p><p className="mt-1 font-bold">{data.study.course}</p></div><BookOpen className="h-4 w-4 text-[hsl(171_42%_35%)]" /></div><div className="mt-6"><div className="mb-2 flex justify-between text-[11px]"><span>Term progress</span><span className="font-mono-cortex font-bold">{data.study.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--card))]"><div className="h-full rounded-full bg-[hsl(171_42%_35%)]" style={{ width: `${data.study.progress}%` }} /></div></div><p className="mt-4 border-t border-[hsl(var(--border))] pt-3 text-xs text-[hsl(var(--muted-foreground))]"><span className="font-bold text-[hsl(var(--foreground))]">{data.study.nextLabel}</span><br />{data.study.nextAt}</p></div><Link href="/study" data-testid="link-open-study" className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--secondary-foreground))]">Open study hub <ArrowUpRight className="h-3 w-3" /></Link></Panel>
      <Panel className="reveal reveal-delay-1 p-5" testId="panel-deadline-radar"><SectionHeading kicker="Next on deck" title="Deadline radar" action={<Link href="/deadlines" data-testid="link-view-deadlines" className="font-mono-cortex text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">All radar</Link>} /><div className="space-y-1">{deadlines.slice(0, 4).map((deadline) => <div key={deadline.id} className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-[hsl(var(--muted)/.45)]" data-testid={`row-deadline-${deadline.id}`}><div className={cn('h-2 w-2 shrink-0 rounded-full', deadline.category === 'exam' ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary))]')} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{deadline.title}</p><p className="font-mono-cortex mt-0.5 text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{deadline.category}</p></div><span className="font-mono-cortex whitespace-nowrap text-[10px] text-[hsl(var(--muted-foreground))]">{deadline.targetAt}</span></div>)}{deadlines.length === 0 && <EmptyState icon={Clock3} title="Clear horizon" detail="No deadlines are currently on radar." />}</div></Panel>
      <Panel className="reveal reveal-delay-2 p-5" testId="panel-recent-activity"><SectionHeading kicker="Trace log" title="Recent activity" /><div className="space-y-4">{activities.slice(0, 5).map((activity) => <div className="flex gap-3" key={activity.id} data-testid={`activity-${activity.id}`}><div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))]"><ActivityIcon className="h-3 w-3 text-[hsl(var(--muted-foreground))]" /></div><div className="min-w-0"><p className="text-xs font-bold">{activity.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{activity.detail}</p><p className="font-mono-cortex mt-1 text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground)/.7)]">{activity.time}</p></div></div>)}{activities.length === 0 && <EmptyState icon={ActivityIcon} title="No recent trace" detail="Activity will appear as you move through your workspace." />}</div></Panel>
    </div>
    <Panel className="reveal p-5" testId="panel-integrations"><SectionHeading kicker="System health" title="Connected services" action={<Link href="/settings" data-testid="link-manage-integrations" className="font-mono-cortex text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Manage</Link>} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{integrations.slice(0, 4).map((integration) => <div key={integration.id} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3" data-testid={`integration-${integration.id}`}><div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><Network className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{integration.name}</p><p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{integration.detail}</p></div><StatusPill status={integration.status} /></div>)}</div>{notes.data && notes.data.length > 0 && <p className="mt-4 font-mono-cortex text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]" data-testid="text-note-count">{notes.data.length} quick notes indexed in memory</p>}</Panel>
  </div>;
}

function ProjectsPage() {
  const queryClient = useQueryClient();
  const projects = useListProjects();
  const create = useCreateProject();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', path: '', status: 'active', stack: '' });
  const filtered = useMemo(() => (projects.data ?? []).filter((p) => `${p.name} ${p.path} ${p.stack.join(' ')}`.toLowerCase().includes(search.toLowerCase())), [projects.data, search]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.name.trim() || !form.path.trim()) return; create.mutate({ data: { name: form.name, path: form.path, status: form.status as 'active' | 'client' | 'experiment' | 'archived', stack: form.stack.split(',').map((item) => item.trim()).filter(Boolean) } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }); setShowCreate(false); setForm({ name: '', path: '', status: 'active', stack: '' }); } }); };
  return <div className="mx-auto max-w-[1400px]"><PageIntro label="Project vault" title="Everything you are building." detail="A searchable inventory of repositories, experiments, and client work. Keep the whole build surface in view." action={<Button onClick={() => setShowCreate(true)} testId="button-create-project"><Plus className="h-4 w-4" /> Add project</Button>} /><Panel className="overflow-hidden p-4 sm:p-5" testId="panel-project-vault"><div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><Input type="search" placeholder="Search by name, path, or stack" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-projects" /></div><div className="font-mono-cortex flex items-center gap-2 rounded-md bg-[hsl(var(--muted)/.65)] px-3 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><FolderGit2 className="h-3.5 w-3.5" /> {filtered.length} indexed</div></div>{projects.isLoading ? <LoadingPanel /> : projects.isError ? <ErrorPanel retry={() => queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })} /> : filtered.length === 0 ? <EmptyState icon={FolderGit2} title={search ? 'No matching projects' : 'Your vault is empty'} detail={search ? 'Try a wider query or clear the search.' : 'Register your first repository to make the build surface visible.'} action={!search && <Button onClick={() => setShowCreate(true)} testId="button-create-first-project"><Plus className="h-3.5 w-3.5" /> Register repository</Button>} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((project) => <div className="group rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.6)] hover:shadow-md" key={project.id} data-testid={`card-project-${project.id}`}><div className="mb-5 flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><FileCode2 className="h-4 w-4" /></div><StatusPill status={project.status} /></div><p className="display-cortex truncate text-lg font-bold">{project.name}</p><p className="font-mono-cortex mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{project.path}</p><div className="mt-5 flex flex-wrap gap-1.5">{project.stack.map((item) => <span key={item} className="rounded bg-[hsl(var(--muted))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{item}</span>)}</div><div className="mt-5 border-t border-[hsl(var(--border))] pt-3"><div className="mb-1.5 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]"><span>Build progress</span><span className="font-mono-cortex font-bold text-[hsl(var(--foreground))]">{project.progress ?? 0}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500" style={{ width: `${project.progress ?? 0}%` }} /></div></div></div>)}</div>}</Panel>{showCreate && <Modal title="Register a project" onClose={() => setShowCreate(false)}><form className="space-y-4" onSubmit={submit}><Field label="Project name"><Input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Atlas compiler" data-testid="input-project-name" /></Field><Field label="Local path" hint="Use the path exactly as it exists on disk."><Input required value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="C:\Users\Alex\dev\atlas" data-testid="input-project-path" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} data-testid="select-project-status" className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background)/.5)] px-3 py-2.5 text-sm"><option value="active">Active</option><option value="client">Client</option><option value="experiment">Experiment</option><option value="archived">Archived</option></select></Field><Field label="Stack" hint="Comma separated"><Input value={form.stack} onChange={(e) => setForm({ ...form, stack: e.target.value })} placeholder="TypeScript, Rust" data-testid="input-project-stack" /></Field></div><div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setShowCreate(false)} testId="button-cancel-project">Cancel</Button><Button type="submit" disabled={create.isPending} testId="button-submit-project">{create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save project</Button></div></form></Modal>}</div>;
}

function StudyPage() {
  const queryClient = useQueryClient();
  const overview = useGetCortexOverview();
  const notes = useListNotes();
  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string; content: string; tag: string; pinned: boolean } | null>(null);
  const [form, setForm] = useState({ title: '', content: '', tag: 'study', pinned: false });
  const saveNote = (event: FormEvent) => { event.preventDefault(); if (!form.title.trim()) return; create.mutate({ data: form }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }); setShowCreate(false); setForm({ title: '', content: '', tag: 'study', pinned: false }); } }); };
  const editNote = (event: FormEvent) => { event.preventDefault(); if (!editing?.title.trim()) return; update.mutate({ id: editing.id, data: { title: editing.title, content: editing.content, tag: editing.tag, pinned: editing.pinned } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }); setEditing(null); } }); };
  return <div className="mx-auto max-w-[1400px]"><PageIntro label="Study hub" title="Turn input into recall." detail="Your course pulse, quick notes, and the future home for summaries, quizzes, and audio sessions." action={<Button onClick={() => setShowCreate(true)} testId="button-create-note"><Plus className="h-4 w-4" /> Capture note</Button>} /><div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><div className="space-y-6"><Panel className="overflow-hidden p-5" testId="panel-current-course"><SectionHeading kicker="Current course" title={overview.data?.study.course ?? 'Course signal'} />{overview.isLoading ? <Skeleton className="h-40 w-full" /> : overview.isError ? <ErrorPanel /> : overview.data && <><div className="rounded-lg bg-[hsl(var(--secondary)/.55)] p-5"><div className="flex items-center justify-between"><BookOpen className="h-5 w-5 text-[hsl(171_42%_35%)]" /><span className="font-mono-cortex text-xs font-bold">{overview.data.study.progress}%</span></div><p className="display-cortex mt-8 text-2xl font-bold">{overview.data.study.course}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Next up: {overview.data.study.nextLabel}</p><div className="mt-6 h-2 rounded-full bg-[hsl(var(--card))]"><div className="h-full rounded-full bg-[hsl(171_42%_35%)]" style={{ width: `${overview.data.study.progress}%` }} /></div></div><div className="mt-4 flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]"><span>Due {overview.data.study.nextAt}</span><Button variant="outline" testId="button-open-course">Open course <ArrowUpRight className="h-3 w-3" /></Button></div></>}</Panel><Panel className="p-5" testId="panel-study-modules"><SectionHeading kicker="Planned modules" title="Learning tools" /><div className="grid gap-2 sm:grid-cols-2">{[{ icon: FileCode2, name: 'Document library', detail: 'PDFs and references' }, { icon: MessageSquareText, name: 'Summary desk', detail: 'Condense long material' }, { icon: ListChecks, name: 'Quiz builder', detail: 'Recall over reread' }, { icon: AudioLines, name: 'Audio sessions', detail: 'Review on the move' }].map(({ icon: Icon, name, detail }) => <div key={name} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 opacity-75" data-testid={`card-module-${name.toLowerCase().replaceAll(' ', '-')}`}><div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></div><div><p className="text-xs font-bold">{name}</p><p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{detail}</p></div><span className="font-mono-cortex ml-auto text-[8px] uppercase text-[hsl(var(--muted-foreground))]">API soon</span></div>)}</div></Panel></div><Panel className="p-5" testId="panel-quick-notes"><SectionHeading kicker="Memory buffer" title="Quick notes" action={<span className="font-mono-cortex text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{notes.data?.length ?? 0} notes</span>} />{notes.isLoading ? <LoadingPanel rows={4} /> : notes.isError ? <ErrorPanel retry={() => queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() })} /> : notes.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{notes.data.map((note) => <article key={note.id} className="group relative rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-md" data-testid={`card-note-${note.id}`}><div className="mb-4 flex items-center justify-between"><span className="font-mono-cortex rounded bg-[hsl(var(--accent)/.55)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--accent-foreground))]">{note.tag || 'note'}</span><div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"><Button variant="quiet" onClick={() => setEditing({ id: note.id, title: note.title, content: note.content, tag: note.tag, pinned: note.pinned })} testId={`button-edit-note-${note.id}`}><Pencil className="h-3 w-3" /></Button><Button variant="quiet" onClick={() => remove.mutate({ id: note.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }) })} testId={`button-delete-note-${note.id}`}><Trash2 className="h-3 w-3 text-[hsl(var(--destructive))]" /></Button></div></div><h3 className="font-bold">{note.title}</h3><p className="mt-2 line-clamp-4 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{note.content || 'No content yet.'}</p><p className="font-mono-cortex mt-5 text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground)/.7)]">{note.pinned ? 'Pinned · ' : ''}{note.updatedAt}</p></article>)}</div> : <EmptyState icon={Library} title="Memory buffer is clear" detail="Capture a thought, a definition, or a question before it gets away." action={<Button onClick={() => setShowCreate(true)} testId="button-create-first-note"><Plus className="h-3.5 w-3.5" /> Capture first note</Button>} />}</Panel></div>{(showCreate || editing) && <Modal title={editing ? 'Refine note' : 'Capture a note'} onClose={() => { setShowCreate(false); setEditing(null); }}>{editing ? <form onSubmit={editNote} className="space-y-4"><Field label="Title"><Input autoFocus required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} data-testid="input-edit-note-title" /></Field><Field label="Content"><textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} data-testid="input-edit-note-content" className="min-h-32 w-full resize-y rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background)/.5)] px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))]" /></Field><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)} testId="button-cancel-edit-note">Cancel</Button><Button type="submit" disabled={update.isPending} testId="button-submit-edit-note">Save changes</Button></div></form> : <form onSubmit={saveNote} className="space-y-4"><Field label="Title"><Input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="A useful thought" data-testid="input-note-title" /></Field><Field label="Content"><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write the part you want to remember..." data-testid="input-note-content" className="min-h-32 w-full resize-y rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background)/.5)] px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))]" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tag"><Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} data-testid="input-note-tag" /></Field><label className="flex items-center gap-2 self-end pb-2 text-xs"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} data-testid="input-note-pinned" /> Pin to memory buffer</label></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowCreate(false)} testId="button-cancel-note">Cancel</Button><Button type="submit" disabled={create.isPending} testId="button-submit-note">Save note</Button></div></form>}</Modal>}</div>;
}

function DeadlinesPage() {
  const queryClient = useQueryClient();
  const deadlines = useListDeadlines();
  const create = useCreateDeadline();
  const update = useUpdateDeadline();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'submission', targetAt: '' });
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.title || !form.targetAt) return; create.mutate({ data: { title: form.title, category: form.category as 'exam' | 'submission' | 'server' | 'personal', targetAt: form.targetAt } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDeadlinesQueryKey() }); setShowCreate(false); setForm({ title: '', category: 'submission', targetAt: '' }); } }); };
  const rows = (deadlines.data ?? []).filter((item) => filter === 'all' || !item.completed);
  return <div className="mx-auto max-w-[1200px]"><PageIntro label="Deadline radar" title="Never let the important sneak up." detail="A single timeline for exams, submissions, servers, and the things that matter outside the screen." action={<Button onClick={() => setShowCreate(true)} testId="button-create-deadline"><Plus className="h-4 w-4" /> Add deadline</Button>} /><div className="grid gap-6 lg:grid-cols-[1fr_320px]"><Panel className="p-5" testId="panel-deadline-list"><div className="mb-5 flex items-center justify-between"><SectionHeading kicker="Timeline" title="Upcoming" /><div className="flex rounded-md bg-[hsl(var(--muted))] p-1"><button onClick={() => setFilter('open')} data-testid="button-filter-open" className={cn('rounded px-2.5 py-1.5 text-[10px] font-bold', filter === 'open' && 'bg-[hsl(var(--card))] shadow-sm')}>Open</button><button onClick={() => setFilter('all')} data-testid="button-filter-all" className={cn('rounded px-2.5 py-1.5 text-[10px] font-bold', filter === 'all' && 'bg-[hsl(var(--card))] shadow-sm')}>All</button></div></div>{deadlines.isLoading ? <LoadingPanel rows={5} /> : deadlines.isError ? <ErrorPanel retry={() => queryClient.invalidateQueries({ queryKey: getListDeadlinesQueryKey() })} /> : rows.length === 0 ? <EmptyState icon={CheckCircle2} title={filter === 'open' ? 'Horizon clear' : 'No deadlines yet'} detail={filter === 'open' ? 'Everything is complete. Enjoy the clear runway.' : 'Add the next thing you need to remember.'} action={filter === 'all' && <Button onClick={() => setShowCreate(true)} testId="button-create-first-deadline"><Plus className="h-3.5 w-3.5" /> Add a deadline</Button>} /> : <div className="relative space-y-2 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-[hsl(var(--border))]">{rows.map((deadline) => <div key={deadline.id} className={cn('relative flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.3)]', deadline.completed && 'opacity-55')} data-testid={`row-deadline-detail-${deadline.id}`}><button onClick={() => update.mutate({ id: deadline.id, data: { completed: !deadline.completed } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDeadlinesQueryKey() }) })} data-testid={`button-complete-deadline-${deadline.id}`} className={cn('z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-[hsl(var(--card))]', deadline.completed ? 'border-[hsl(171_42%_35%)] text-[hsl(171_42%_35%)]' : 'border-[hsl(var(--primary))] text-transparent hover:text-[hsl(var(--primary))]')}><Check className="h-3.5 w-3.5" /></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={cn('text-sm font-bold', deadline.completed && 'line-through')}>{deadline.title}</p><StatusPill status={deadline.category} /></div><p className="font-mono-cortex mt-1 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{deadline.targetAt}</p></div><Button variant="quiet" onClick={() => window.alert('Edit flow is ready for the deadline API payload.')} testId={`button-edit-deadline-${deadline.id}`}><Pencil className="h-3.5 w-3.5" /></Button></div>)}</div>}</Panel><div className="space-y-6"><Panel className="overflow-hidden p-5" testId="panel-radar-summary"><SectionHeading kicker="At a glance" title="Radar summary" /><div className="space-y-4">{['exam', 'submission', 'server', 'personal'].map((category) => { const count = (deadlines.data ?? []).filter((item) => item.category === category && !item.completed).length; return <div className="flex items-center justify-between" key={category}><div className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', category === 'exam' ? 'bg-[hsl(var(--destructive))]' : category === 'server' ? 'bg-[hsl(171_42%_35%)]' : 'bg-[hsl(var(--primary))]')} /><span className="text-xs font-bold capitalize">{category}</span></div><span className="font-mono-cortex text-xs">{count}</span></div>; })}</div></Panel><Panel className="bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))]" testId="panel-deadline-tip"><ShieldCheck className="mb-5 h-5 w-5 text-[hsl(var(--primary))]" /><p className="display-cortex text-xl font-bold">Keep the runway visible.</p><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--sidebar-foreground)/.6)]">The radar is designed for action, not anxiety. Complete what is done and keep the next decision close.</p></Panel></div></div>{showCreate && <Modal title="Add a deadline" onClose={() => setShowCreate(false)}><form className="space-y-4" onSubmit={submit}><Field label="What needs doing?"><Input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Operating systems midterm" data-testid="input-deadline-title" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="select-deadline-category" className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background)/.5)] px-3 py-2.5 text-sm"><option value="exam">Exam</option><option value="submission">Submission</option><option value="server">Server</option><option value="personal">Personal</option></select></Field><Field label="Target"><Input required type="datetime-local" value={form.targetAt} onChange={(e) => setForm({ ...form, targetAt: e.target.value })} data-testid="input-deadline-target" /></Field></div><div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setShowCreate(false)} testId="button-cancel-deadline">Cancel</Button><Button type="submit" disabled={create.isPending} testId="button-submit-deadline">Add to radar</Button></div></form></Modal>}</div>;
}

function SurfaceCard({ icon: Icon, title, detail, status = 'planned', action }: { icon: IconType; title: string; detail: string; status?: string; action?: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-4" data-testid={`card-surface-${title.toLowerCase().replaceAll(' ', '-')}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold">{title}</p><StatusPill status={status} /></div><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{detail}</p>{action && <div className="mt-3">{action}</div>}</div></div>;
}

function GamesPage() {
  const [turbo, setTurbo] = useState(false);
  const [profile, setProfile] = useState('Balanced');
  return <div className="mx-auto max-w-[1200px]"><PageIntro label="Game room" title="Play with the noise turned down." detail="A single switchboard for game profiles, turbo mode, and the Windows-native controls waiting to connect." action={<div className="font-mono-cortex flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-[10px] uppercase tracking-wider"><span className={cn('h-2 w-2 rounded-full', turbo ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted-foreground))]')} /> {turbo ? 'Turbo armed' : 'Standby'}</div>} /><div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><Panel className={cn('overflow-hidden p-6 transition-colors', turbo && 'border-[hsl(var(--primary)/.65)]')} testId="panel-turbo-mode"><div className="flex items-start justify-between gap-4"><div><p className="font-mono-cortex text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Performance switch</p><h2 className="display-cortex mt-2 text-3xl font-bold">Turbo mode</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Prioritize your active game, quiet background tasks, and prepare the machine for play.</p></div><div className={cn('flex h-12 w-12 items-center justify-center rounded-lg transition-colors', turbo ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}><Zap className="h-6 w-6" /></div></div><button onClick={() => setTurbo(!turbo)} data-testid="button-toggle-turbo" className={cn('mt-10 flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all', turbo ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.4)]')}><div><p className="text-sm font-bold">{turbo ? 'Turbo mode is active' : 'Enable turbo mode'}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{turbo ? 'The performance profile is armed for this session.' : 'Native Windows API connection required.'}</p></div><div className={cn('flex h-6 w-11 items-center rounded-full p-1 transition-colors', turbo ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]')}><div className={cn('h-4 w-4 rounded-full bg-[hsl(var(--card))] transition-transform', turbo && 'translate-x-5')} /></div></button></Panel><Panel className="p-6" testId="panel-game-profiles"><SectionHeading kicker="Presets" title="Game profiles" /><div className="space-y-2">{['Balanced', 'Competitive', 'Story mode'].map((item) => <button key={item} onClick={() => setProfile(item)} data-testid={`button-profile-${item.toLowerCase().replaceAll(' ', '-')}`} className={cn('flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors', profile === item ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.4)]')}><span className="text-xs font-bold">{item}</span>{profile === item && <CheckCircle2 className="h-4 w-4 text-[hsl(var(--primary-foreground))]" />}</button>)}</div><p className="font-mono-cortex mt-4 text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Selected profile: {profile}</p></Panel></div><Panel className="mt-6 p-5" testId="panel-game-integrations"><SectionHeading kicker="Native bridge" title="Ready when Windows is connected" /><div className="grid gap-3 md:grid-cols-3"><SurfaceCard icon={Gamepad2} title="Process priority" detail="Raise the active game's priority without touching the task manager." /><SurfaceCard icon={AudioLines} title="Audio routing" detail="Switch between desk, headset, and stream outputs in one move." /><SurfaceCard icon={HardDrive} title="Memory trim" detail="Pause known background services for a cleaner session." /></div></Panel></div>;
}

function MusicPage() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(68);
  return <div className="mx-auto max-w-[1200px]"><PageIntro label="Offline music" title="Make room for the right frequency." detail="A local-first listening surface for downloaded sets, albums, and the soundtrack to your next deep work block." action={<Button variant="outline" testId="button-import-music"><Download className="h-3.5 w-3.5" /> Import folder</Button>} /><div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]"><Panel className="overflow-hidden p-6" testId="panel-music-player"><div className="flex min-h-64 flex-col justify-between rounded-xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]"><div className="flex items-center justify-between"><span className="font-mono-cortex rounded bg-[hsl(var(--primary))] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--primary-foreground))]">Offline player</span><MoreHorizontal className="h-4 w-4 text-[hsl(var(--sidebar-foreground)/.55)]" /></div><div><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><Music2 className="h-7 w-7" /></div><p className="font-mono-cortex text-[10px] uppercase tracking-[.15em] text-[hsl(var(--sidebar-foreground)/.5)]">Nothing queued</p><p className="display-cortex mt-1 text-2xl font-bold">Choose a local record</p></div><div><div className="mb-3 h-1 rounded-full bg-[hsl(var(--sidebar-foreground)/.16)]"><div className="h-full w-[28%] rounded-full bg-[hsl(var(--primary))]" /></div><div className="flex items-center justify-between"><span className="font-mono-cortex text-[9px] text-[hsl(var(--sidebar-foreground)/.5)]">00:00</span><span className="font-mono-cortex text-[9px] text-[hsl(var(--sidebar-foreground)/.5)]">--:--</span></div><div className="mt-4 flex items-center justify-center gap-3"><Button variant="quiet" className="text-[hsl(var(--sidebar-foreground)/.65)]" onClick={() => setPlaying(!playing)} testId="button-toggle-music">{playing ? <Pause className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}</Button></div></div></div></Panel><Panel className="p-5" testId="panel-music-library"><SectionHeading kicker="Library" title="Local collection" /><EmptyState icon={Headphones} title="No tracks indexed" detail="Import a folder to build your offline library. The player stays local by design." action={<Button onClick={() => window.alert('Folder import will connect to the native downloader API.')} testId="button-choose-folder"><Plus className="h-3.5 w-3.5" /> Choose folder</Button>} /></Panel></div><Panel className="mt-6 p-5" testId="panel-music-controls"><SectionHeading kicker="Session controls" title="Playback preferences" /><div className="grid gap-4 sm:grid-cols-3"><SurfaceCard icon={RefreshCw} title="Queue behavior" detail="Keep the listening loop intentional." action={<Button variant="outline" testId="button-shuffle-mode">Sequential <ChevronRight className="h-3 w-3" /></Button>} /><SurfaceCard icon={LockKeyhole} title="Local only" detail="No network calls. Files stay on this machine." status="connected" /><div className="rounded-lg border border-[hsl(var(--border))] p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><AudioLines className="h-4 w-4" /></div><p className="text-sm font-bold">Volume</p></div><input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} data-testid="input-volume" className="mt-5 w-full accent-[hsl(var(--primary))]" /><p className="font-mono-cortex mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">{volume}% output</p></div></div></Panel></div>;
}

function BackupsPage() {
  const [lastAction, setLastAction] = useState('');
  return <div className="mx-auto max-w-[1200px]"><PageIntro label="Backup station" title="Build boldly. Roll back calmly." detail="Versioned project archives are the safety net beneath your experiments. The archive bridge is ready for native storage APIs." action={<Button onClick={() => setLastAction('Archive request staged')} testId="button-create-backup"><Archive className="h-4 w-4" /> Create snapshot</Button>} />{lastAction && <div className="mb-5 flex items-center gap-2 rounded-md border border-[hsl(171_42%_35%/.35)] bg-[hsl(171_33%_86%)] px-3 py-2 text-xs text-[hsl(171_42%_28%)]" data-testid="status-backup-action"><CheckCircle2 className="h-4 w-4" /> {lastAction}</div>}<div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><Panel className="p-5" testId="panel-backup-versions"><SectionHeading kicker="Version history" title="Project snapshots" /><EmptyState icon={Archive} title="No snapshots yet" detail="When the archive API is connected, each project will show a recoverable timeline here." action={<Button variant="outline" onClick={() => setLastAction('Archive request staged')} testId="button-stage-backup"><Archive className="h-3.5 w-3.5" /> Stage first archive</Button>} /></Panel><Panel className="p-5" testId="panel-backup-readiness"><SectionHeading kicker="Archive readiness" title="What will be captured" /><div className="space-y-3">{[{ icon: FolderGit2, label: 'Project source', detail: 'Repository files and local metadata' }, { icon: FileCode2, label: 'Workspace state', detail: 'CortexOS configuration and links' }, { icon: ShieldCheck, label: 'Version manifest', detail: 'Checksums for safe recovery' }].map(({ icon: Icon, label, detail }) => <div className="flex gap-3" key={label}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(171_42%_35%)]" /><div><p className="text-xs font-bold">{label}</p><p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</p></div></div>)}</div><div className="mt-6 rounded-lg bg-[hsl(var(--muted)/.65)] p-4"><p className="font-mono-cortex text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Archive provider</p><p className="mt-2 text-xs font-bold">Local archive API</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Connection planned · Windows bridge</p></div></Panel></div></div>;
}

function AiPage() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('Reasoning / local');
  const [sent, setSent] = useState(false);
  return <div className="mx-auto max-w-[1200px]"><PageIntro label="AI router" title="One prompt. The right model." detail="Route work by intent instead of brand. The workspace below is ready for model connections and streaming responses." action={<div className="font-mono-cortex flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-[10px] uppercase tracking-wider"><Sparkles className="h-3.5 w-3.5 text-[hsl(var(--primary-foreground))]" /> Router planned</div>} /><div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><Panel className="p-5" testId="panel-models"><SectionHeading kicker="Model map" title="Planned connections" /><div className="space-y-3"><SurfaceCard icon={SquareTerminal} title="Reasoning / local" detail="Private code review and long context." status="ready" /><SurfaceCard icon={Sparkles} title="Fast / cloud" detail="Short answers, transformations, and triage." /><SurfaceCard icon={Network} title="Vision / cloud" detail="Screenshots, diagrams, and visual context." /></div></Panel><Panel className="overflow-hidden" testId="panel-prompt-workspace"><div className="border-b border-[hsl(var(--border))] p-5"><SectionHeading kicker="Prompt workspace" title="Send a thought somewhere useful." /></div><div className="p-5"><div className="mb-4 flex flex-wrap gap-2">{['Reasoning / local', 'Fast / cloud', 'Vision / cloud'].map((item) => <button key={item} onClick={() => setModel(item)} data-testid={`button-model-${item.toLowerCase().replaceAll(' ', '-')}`} className={cn('rounded-md border px-2.5 py-1.5 text-[10px] font-bold', model === item ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.12)]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]')}>{item}</button>)}</div><textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setSent(false); }} data-testid="input-ai-prompt" placeholder="Ask for a plan, a critique, or a sharper next step..." className="min-h-48 w-full resize-none rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background)/.45)] p-4 text-sm outline-none focus:border-[hsl(var(--primary))]" /><div className="mt-4 flex items-center justify-between"><span className="font-mono-cortex text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{sent ? 'Request staged for API' : `${model} · waiting`}</span><Button onClick={() => setSent(true)} disabled={!prompt.trim()} testId="button-send-prompt"><ArrowUpRight className="h-3.5 w-3.5" /> Route prompt</Button></div></div></Panel></div></div>;
}

function SupabasePage() {
  const [query, setQuery] = useState('select * from projects\norder by updated_at desc\nlimit 10;');
  const [ran, setRan] = useState(false);
  return <div className="mx-auto max-w-[1200px]"><PageIntro label="Data studio" title="See the shape of your second brain." detail="A focused SQL workspace for the Supabase connection that will power richer CortexOS surfaces." action={<span className="font-mono-cortex rounded-md border border-[hsl(var(--border))] px-3 py-2 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Connection planned</span>} /><div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]"><Panel className="p-5" testId="panel-database-connection"><SectionHeading kicker="Connection" title="Supabase bridge" /><div className="rounded-lg bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))]"><div className="flex items-center justify-between"><Database className="h-5 w-5 text-[hsl(var(--primary))]" /><StatusPill status="planned" /></div><p className="display-cortex mt-8 text-2xl font-bold">cortex_workspace</p><p className="font-mono-cortex mt-1 text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">project ref · not connected</p><Button variant="outline" className="mt-6 border-[hsl(var(--sidebar-foreground)/.25)] bg-transparent text-[hsl(var(--sidebar-foreground))]" onClick={() => window.alert('Supabase connection will be enabled by the data API.')} testId="button-connect-supabase">Connect workspace</Button></div><div className="mt-5 space-y-3"><SurfaceCard icon={Blocks} title="Schema browser" detail="Tables, relationships, and row counts." /><SurfaceCard icon={ShieldCheck} title="Safe query mode" detail="Read-only by default. Mutations require a deliberate unlock." /></div></Panel><Panel className="overflow-hidden" testId="panel-query-workspace"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5"><SectionHeading kicker="Query workspace" title="Run a query" /><Button onClick={() => setRan(true)} testId="button-run-query"><SquareTerminal className="h-3.5 w-3.5" /> Run</Button></div><div className="p-5"><textarea value={query} onChange={(e) => { setQuery(e.target.value); setRan(false); }} data-testid="input-sql-query" className="font-mono-cortex min-h-52 w-full resize-y rounded-lg border border-[hsl(var(--input))] bg-[hsl(211_28%_17%)] p-4 text-xs leading-relaxed text-[hsl(var(--sidebar-foreground))] outline-none focus:border-[hsl(var(--primary))]" />{ran && <div className="mt-4 flex items-center gap-2 rounded-md bg-[hsl(171_33%_86%)] px-3 py-2 text-xs text-[hsl(171_42%_28%)]" data-testid="status-query-result"><CheckCircle2 className="h-4 w-4" /> Query staged. Connect the data API to return rows.</div>}</div></Panel></div></div>;
}

function SettingsPage() {
  const [sync, setSync] = useState(true);
  const [compact, setCompact] = useState(false);
  const integrations = useGetIntegrationStatus();
  const queryClient = useQueryClient();
  return <div className="mx-auto max-w-[1100px]"><PageIntro label="Workspace control" title="Tune the cockpit to your rhythm." detail="Shortcuts, integrations, sync behavior, and the few defaults that make CortexOS feel like yours." /><div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><Panel className="p-5" testId="panel-settings-preferences"><SectionHeading kicker="Workspace" title="Preferences" /><div className="divide-y divide-[hsl(var(--border))]"><button onClick={() => setSync(!sync)} data-testid="button-toggle-sync" className="flex w-full items-center justify-between py-4 text-left"><div><p className="text-sm font-bold">Background sync</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Keep overview data warm while CortexOS is open.</p></div><div className={cn('flex h-6 w-11 items-center rounded-full p-1', sync ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]')}><div className={cn('h-4 w-4 rounded-full bg-[hsl(var(--card))] transition-transform', sync && 'translate-x-5')} /></div></button><button onClick={() => setCompact(!compact)} data-testid="button-toggle-compact" className="flex w-full items-center justify-between py-4 text-left"><div><p className="text-sm font-bold">Dense layout</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">More signal per screen on the command surface.</p></div><div className={cn('flex h-6 w-11 items-center rounded-full p-1', compact ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]')}><div className={cn('h-4 w-4 rounded-full bg-[hsl(var(--card))] transition-transform', compact && 'translate-x-5')} /></div></button></div></Panel><Panel className="p-5" testId="panel-settings-shortcuts"><SectionHeading kicker="Shortcuts" title="Fast lanes" /><div className="space-y-2">{[{ key: '⌘ K', label: 'Jump to any surface' }, { key: '⌘ P', label: 'Open project vault' }, { key: '⌘ Enter', label: 'Send current workspace' }].map((item) => <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-3" key={item.key}><span className="text-xs font-bold">{item.label}</span><kbd className="font-mono-cortex rounded bg-[hsl(var(--muted))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">{item.key}</kbd></div>)}</div></Panel></div><Panel className="mt-6 p-5" testId="panel-settings-integrations"><div className="flex items-center justify-between"><SectionHeading kicker="Connections" title="Integrations" /><Button variant="quiet" onClick={() => queryClient.invalidateQueries({ queryKey: getGetIntegrationStatusQueryKey() })} testId="button-refresh-integrations"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button></div>{integrations.isLoading ? <LoadingPanel rows={4} /> : integrations.isError ? <ErrorPanel retry={() => queryClient.invalidateQueries({ queryKey: getGetIntegrationStatusQueryKey() })} /> : <div className="grid gap-3 md:grid-cols-2">{(integrations.data ?? []).map((item) => <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-4" key={item.id} data-testid={`settings-integration-${item.id}`}><div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><Network className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{item.detail}</p></div><StatusPill status={item.status} /></div>)}</div>}</Panel></div>;
}

function Router() {
  return <ErrorBoundary resetKey={window.location.pathname}><Shell><Switch><Route path="/" component={OverviewPage} /><Route path="/projects" component={ProjectsPage} /><Route path="/study" component={StudyPage} /><Route path="/games" component={GamesPage} /><Route path="/music" component={MusicPage} /><Route path="/backups" component={BackupsPage} /><Route path="/deadlines" component={DeadlinesPage} /><Route path="/ai" component={AiPage} /><Route path="/supabase" component={SupabasePage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;