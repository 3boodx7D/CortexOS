import { type FormEvent, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  FolderKanban, Plus, Search, Terminal, X, RefreshCw, Trash2,
  FolderSearch, Folder, HardDrive, Sparkles, Copy, Play, Zap, Layers, ExternalLink,
  Clock, CheckCircle2, Square, ArrowUpDown, Bot, Code2, Rocket, ArrowRight,
  LayoutGrid, List, Check, GitBranch, Cpu, Eye
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { useDesktopDialog } from '@/components/ui/desktop-dialog';
import { pickDirectory } from '@/lib/tauri';
import { apiGet, apiPost } from '@/lib/api-client';

export type Status = 'active' | 'client' | 'experiment' | 'archived';

export interface AISummary {
  summary: string;
  role: string;
  architecture: string;
  run_command: string;
  model?: string;
  provider?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: Status;
  stack: string[];
  progress: number;
  path: string;
  updated: string;
  disk_size_mb?: number;
  node_modules_size_mb?: number;
  has_node_modules?: boolean;
  git_branch?: string | null;
  git_last_commit?: string | null;
  git_remote?: string | null;
  ai_summary?: AISummary | null;
}

interface CustomIde {
  id: string;
  name: string;
  command: string;
  icon?: string;
}

const DEFAULT_IDE_OPTIONS = [
  { id: 'antigravity', label: 'Google Antigravity' },
  { id: 'cursor', label: 'Cursor AI' },
  { id: 'code', label: 'VS Code' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'pycharm', label: 'PyCharm' },
  { id: 'subl', label: 'Sublime Text' },
  { id: 'explorer', label: 'File Explorer' },
];

function StatusPill({ status, label }: { status: Status; label?: string }) {
  const getBadgeClass = () => {
    switch (status) {
      case 'active':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'client':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'experiment':
        return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';
      case 'archived':
      default:
        return 'border-border bg-secondary text-muted-foreground';
    }
  };

  const getDotClass = () => {
    switch (status) {
      case 'active':
        return 'bg-emerald-400 shadow-[0_0_8px_#10b981]';
      case 'client':
        return 'bg-amber-400 shadow-[0_0_8px_#f59e0b]';
      case 'experiment':
        return 'bg-cyan-400 shadow-[0_0_8px_#00aff4]';
      case 'archived':
      default:
        return 'bg-muted-foreground';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-mono border ${getBadgeClass()}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${getDotClass()}`} />
      <span className="capitalize">{label || status}</span>
    </span>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal panel page-in max-w-2xl w-full" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button className="btn btn-ghost p-1.5 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-all" aria-label="Close dialog" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const AI_QUICK_PRESETS = [
  {
    title: 'Discord.js v14 Bot',
    desc: 'Modular slash commands, event handlers, SQLite database & .env template',
    prompt: 'Create a production-ready Discord.js v14 bot in TypeScript with slash commands handling, ping and info commands, event architecture, and SQLite persistent storage.',
    slug: 'discord-bot',
    stack: 'python'
  },
  {
    title: 'FastAPI AI Microservice',
    desc: 'Python 3.12, Uvicorn, Gemini 3.6 Flash & DeepSeek endpoints, streaming responses',
    prompt: 'Create a Python FastAPI backend with streaming AI endpoints, health checks, Pydantic v2 schemas, and Gemini integration.',
    slug: 'fastapi-ai-service',
    stack: 'python'
  },
  {
    title: 'Next.js 15 SaaS Dashboard',
    desc: 'App Router, Tailwind CSS v4, Lucide icons, Supabase Auth ready, dark mode',
    prompt: 'Architect a Next.js 15 App Router dashboard with modern dark-mode aesthetic, authentication pages, dashboard layout, and Supabase integration.',
    slug: 'saas-dashboard',
    stack: 'web'
  },
  {
    title: 'Tauri v2 Desktop Shell',
    desc: 'Ultra-fast native Windows app, React 19, Vite 6, Rust IPC daemon',
    prompt: 'Create a Tauri v2 native desktop application with React 19, Vite, Tailwind CSS, system tray support, and native window controls.',
    slug: 'tauri-desktop-app',
    stack: 'desktop'
  }
];

export default function Projects({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();
  const { confirmDialog } = useDesktopDialog();
  const [, navigate] = useLocation();

  // Persistent settings synchronized across app
  const [workspacePath, setWorkspacePath] = usePersistent<string>('cortex-workspace-path', 'D:\\dev26-27');
  const [defaultIde] = usePersistent<string>('cortex-default-ide', 'antigravity');
  const [customIdes] = usePersistent<CustomIde[]>('cortex-custom-ides', []);
  const [autoScan] = usePersistent<boolean>('cortex-autoscan-projects', true);
  const [viewMode, setViewMode] = usePersistent<'grid' | 'list'>('cortex-projects-view-mode', 'grid');

  // Cached project items & summaries
  const [cachedProjects, setCachedProjects] = usePersistent<Project[]>('cortex-vault-projects', []);
  const [aiSummaries, setAiSummaries] = usePersistent<Record<string, AISummary>>('cortex-project-summaries', {});
  const [statusOverrides, setStatusOverrides] = usePersistent<Record<string, Status>>('cortex-status-overrides', {});

  // Local state
  const [projects, setProjects] = useState<Project[]>(cachedProjects);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [selectedStackTag, setSelectedStackTag] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'time' | 'name' | 'size'>('recent');

  // Active dev processes map: normalized_path -> pid
  const [activeDevs, setActiveDevs] = useState<Record<string, number>>({});

  // Slide-over preview drawer
  const [inspectProject, setInspectProject] = useState<Project | null>(null);

  // Async states
  const [scanning, setScanning] = useState(false);
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  const [isBrowsingWorkspace, setIsBrowsingWorkspace] = useState(false);
  const [stoppingDevPath, setStoppingDevPath] = useState<string | null>(null);

  // Modals
  const [scaffolderOpen, setScaffolderOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [changePathOpen, setChangePathOpen] = useState(false);
  const [customPathInput, setCustomPathInput] = useState(workspacePath);

  // Scaffolder form state
  const [scaffoldMode, setScaffoldMode] = useState<'ai' | 'template'>('ai');
  const [scaffoldModel, setScaffoldModel] = useState<'gemini-pro' | 'deepseek-flash' | 'deepseek-pro'>('gemini-pro');
  const [selectedTemplate, setSelectedTemplate] = useState('saas-next15');
  const [newProjectName, setNewProjectName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStackType, setAiStackType] = useState('web');
  const [scaffoldingStep, setScaffoldingStep] = useState<number | null>(null);
  const [scaffoldCreatedResult, setScaffoldCreatedResult] = useState<{
    path: string;
    files: string[];
    name: string;
  } | null>(null);

  // Combine default IDE options with user-configured custom shell commands
  const allIdeOptions = useMemo(() => {
    const custom = customIdes.map((c) => ({ id: c.id, label: c.name }));
    return [...DEFAULT_IDE_OPTIONS, ...custom];
  }, [customIdes]);

  const getIdeLabel = useCallback((id: string): string => {
    const match = allIdeOptions.find((o) => o.id === id);
    return match ? match.label : id;
  }, [allIdeOptions]);

  // Fetch active running dev servers from background daemon
  const fetchActiveDevs = useCallback(async () => {
    try {
      const data = await apiGet<{ ok?: boolean; active?: Array<{ path: string; pid: number }> }>('/api/projects/active-devs');
      if (data && data.ok && Array.isArray(data.active)) {
        const map: Record<string, number> = {};
        data.active.forEach((item: { path: string; pid: number }) => {
          const normalized = item.path.toLowerCase().replace(/\\/g, '/');
          map[normalized] = item.pid;
        });
        setActiveDevs(map);
      }
    } catch {
      // Telemetry silent fallback
    }
  }, []);

  useEffect(() => {
    fetchActiveDevs();
    const iv = setInterval(fetchActiveDevs, 4000);
    return () => clearInterval(iv);
  }, [fetchActiveDevs]);

  const isProjectRunning = (projPath: string) => {
    const normalized = projPath.toLowerCase().replace(/\\/g, '/');
    return activeDevs[normalized] !== undefined;
  };

  const getProjectPid = (projPath: string) => {
    const normalized = projPath.toLowerCase().replace(/\\/g, '/');
    return activeDevs[normalized];
  };

  // Helper to read total logged time
  const getProjectTimeSeconds = (projectId: string): number => {
    try {
      const val = localStorage.getItem(`cortex_time_spent_${projectId}`);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  };

  const formatTimeSpent = (sec: number) => {
    if (!sec || sec <= 0) return null;
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  // Fetch projects from backend
  const handleScanWorkspace = async (targetPath?: string) => {
    const pathToScan = targetPath || workspacePath;
    if (!pathToScan) return;
    setScanning(true);
    try {
      const data = await apiGet<{ ok?: boolean; projects?: Project[]; error?: string }>(`/api/projects/scan?path=${encodeURIComponent(pathToScan)}`);
      if (data && data.ok && Array.isArray(data.projects)) {
        const merged: Project[] = data.projects.map((p: Project) => {
          const overrideStatus = statusOverrides[p.path] || statusOverrides[p.name] || p.status;
          const cachedSummary = aiSummaries[p.path] || aiSummaries[p.name] || p.ai_summary;
          return {
            ...p,
            status: overrideStatus,
            ai_summary: cachedSummary || null,
          };
        });

        setProjects(merged);
        setCachedProjects(merged);
        notify(locale === 'ar' ? `تم فحص ${merged.length} مشاريع بنجاح` : `Scanned ${merged.length} projects successfully`);
      } else if (data?.error) {
        notify(locale === 'ar' ? `تنبيه: ${data.error}` : `Notice: ${data.error}`);
      }
    } catch (err) {
      console.warn('Scan workspace error:', err);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (autoScan && workspacePath) {
      handleScanWorkspace();
    }
  }, [workspacePath, autoScan]);

  const handleBrowseWorkspace = async () => {
    setIsBrowsingWorkspace(true);
    try {
      const selected = await pickDirectory();
      if (selected) {
        setWorkspacePath(selected);
        await handleScanWorkspace(selected);
        notify(locale === 'ar' ? `تم تحديد مسار المشاريع: ${selected}` : `Workspace path set to: ${selected}`);
      } else {
        setCustomPathInput(workspacePath);
        setChangePathOpen(true);
      }
    } catch {
      setCustomPathInput(workspacePath);
      setChangePathOpen(true);
    } finally {
      setIsBrowsingWorkspace(false);
    }
  };

  const handleLaunchIde = async (project: Project, ideOverride?: string) => {
    const ideToUse = ideOverride || defaultIde || 'antigravity';
    try {
      const data = await apiPost<{ ok?: boolean; error?: string }>('/api/projects/launch-ide', {
        project_path: project.path,
        ide: ideToUse,
      });
      if (data && data.ok) {
        notify(locale === 'ar' ? `تم فتح المشروع بـ ${getIdeLabel(ideToUse)}` : `Opened in ${getIdeLabel(ideToUse)}`);
      } else {
        notify(data?.error || 'Failed to launch editor');
      }
    } catch {
      notify('Failed to launch editor');
    }
  };

  const handleRunDevServer = async (project: Project) => {
    try {
      const data = await apiPost<{ ok?: boolean; command?: string; error?: string }>('/api/projects/run-dev', {
        project_path: project.path,
        mode: 'hidden',
      });
      if (data && data.ok) {
        notify(
          locale === 'ar'
            ? `تم تشغيل السيرفر بالخلفية: ${data.command}`
            : `Dev server launched silently: ${data.command}`
        );
        fetchActiveDevs();
      } else {
        notify(data?.error || 'Failed to launch dev server');
      }
    } catch {
      notify('Failed to launch dev server');
    }
  };

  const handleStopDevServer = async (project: Project) => {
    setStoppingDevPath(project.path);
    try {
      const data = await apiPost<{ ok?: boolean; error?: string }>('/api/projects/stop-dev', {
        project_path: project.path,
      });
      if (data && data.ok) {
        notify(locale === 'ar' ? `تم إيقاف خادم التطوير بنجاح` : `Dev server stopped`);
        fetchActiveDevs();
      } else {
        notify(data?.error || 'Failed to stop dev server');
      }
    } catch {
      notify('Failed to stop dev server');
    } finally {
      setStoppingDevPath(null);
    }
  };

  const handleCleanCache = async (project: Project) => {
    const ok = await confirmDialog({
      title: locale === 'ar' ? 'تأكيد تنظيف الحزم المؤقتة' : 'Confirm Cache Cleanup',
      message: `${t('projects.cleanConfirm')} (${project.name})`,
      confirmText: locale === 'ar' ? 'نعم، حذف الحزم' : 'Purge Cache',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      isDanger: true,
    });

    if (!ok) return;

    setCleaningId(project.id);
    try {
      const data = await apiPost<{ ok?: boolean; freed_mb?: number; error?: string }>('/api/projects/clean-cache', {
        project_path: project.path,
      });
      if (data && data.ok) {
        notify(locale === 'ar' ? `تم تحرير ${data.freed_mb} ميجابايت بنجاح!` : `Freed ${data.freed_mb} MB successfully!`);
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id
              ? { ...p, has_node_modules: false, node_modules_size_mb: 0 }
              : p
          )
        );
      } else {
        notify(data?.error || 'Cleanup failed');
      }
    } catch {
      notify('Cleanup failed');
    } finally {
      setCleaningId(null);
    }
  };

  const handleChangeStatus = (project: Project, newStatus: Status) => {
    setStatusOverrides((prev) => ({ ...prev, [project.path]: newStatus, [project.name]: newStatus }));
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, status: newStatus } : p))
    );
    notify(locale === 'ar' ? `تم تغيير التصنيف إلى ${newStatus}` : `Status updated to ${newStatus}`);
  };

  const handleExecuteScaffold = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setScaffoldingStep(1);
    setScaffoldCreatedResult(null);

    const t1 = setTimeout(() => setScaffoldingStep(2), 1200);
    const t2 = setTimeout(() => setScaffoldingStep(3), 3200);

    try {
      const payload = {
        mode: scaffoldMode,
        template_id: selectedTemplate,
        project_name: newProjectName.trim(),
        workspace_path: workspacePath,
        prompt: aiPrompt,
        stack_type: aiStackType,
        provider: scaffoldModel,
      };

      const data = await apiPost<{ ok?: boolean; project_path?: string; files_created?: string[]; error?: string }>('/api/projects/scaffold', payload);

      clearTimeout(t1);
      clearTimeout(t2);
      setScaffoldingStep(4);

      if (data && data.ok) {
        notify(t('projects.createdSuccess'));
        setScaffoldCreatedResult({
          path: data.project_path || '',
          files: data.files_created || [],
          name: newProjectName.trim(),
        });
        await handleScanWorkspace();
      } else {
        notify(data?.error || 'Scaffolding failed');
        setScaffoldingStep(null);
      }
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      setScaffoldingStep(null);
      notify('Scaffolding failed');
    }
  };

  const handleRegisterManual = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newProj: Project = {
      id: `local-${Date.now()}`,
      name: String(form.get('name') || 'New Project'),
      description: String(form.get('description') || 'Local workspace project'),
      status: 'active',
      stack: String(form.get('stack') || 'TypeScript').split(',').map((s) => s.trim()),
      progress: 0,
      path: String(form.get('path') || `${workspacePath}\\${form.get('name')}`),
      updated: 'Just now',
      has_node_modules: false,
      node_modules_size_mb: 0,
    };

    setProjects((prev) => [newProj, ...prev]);
    setRegisterOpen(false);
    notify(t('projects.registered'));
  };

  // Unique stack tags
  const availableStackTags = useMemo(() => {
    const tags = new Set<string>();
    projects.forEach((p) => p.stack.forEach((s) => tags.add(s)));
    return Array.from(tags).slice(0, 10);
  }, [projects]);

  // KPIs
  const kpiStats = useMemo(() => {
    const totalCount = projects.length;
    let runningCount = 0;
    let totalTimeSec = 0;
    let totalCacheMb = 0;

    projects.forEach((p) => {
      if (isProjectRunning(p.path)) runningCount++;
      totalTimeSec += getProjectTimeSeconds(p.id);
      totalCacheMb += p.node_modules_size_mb || 0;
    });

    const cacheStr = totalCacheMb >= 1024 ? `${(totalCacheMb / 1024).toFixed(1)} GB` : `${Math.round(totalCacheMb)} MB`;
    const timeStr = formatTimeSpent(totalTimeSec) || '0m';

    return { totalCount, runningCount, timeStr, cacheStr };
  }, [projects, activeDevs]);

  // Filtered & Sorted list
  const filteredProjects = useMemo(() => {
    const list = projects.filter((p) => {
      const matchesCategory = filter === 'all' || p.status === filter;
      const matchesStackTag = selectedStackTag === 'all' || p.stack.includes(selectedStackTag);
      const searchStr = `${p.name} ${p.description} ${p.stack.join(' ')} ${p.path} ${p.ai_summary?.summary || ''}`.toLowerCase();
      const matchesQuery = searchStr.includes(query.toLowerCase());
      return matchesCategory && matchesStackTag && matchesQuery;
    });

    return list.sort((a, b) => {
      if (sortBy === 'time') {
        return getProjectTimeSeconds(b.id) - getProjectTimeSeconds(a.id);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'size') {
        const sizeA = a.node_modules_size_mb || a.disk_size_mb || 0;
        const sizeB = b.node_modules_size_mb || b.disk_size_mb || 0;
        return sizeB - sizeA;
      }
      return 0;
    });
  }, [projects, filter, selectedStackTag, query, sortBy]);

  return (
    <div className="flex flex-col gap-6 page-in max-w-[1440px] mx-auto w-full pb-12">
      {/* 1. Header Deck: Workspace Path & Actions */}
      <div className="flex items-start justify-between flex-wrap gap-4 pt-1">
        <div>
          <div className="eyebrow mono text-cyan-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00aff4]" />
            {t('projects.eyebrow')}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
            {t('projects.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {t('projects.subtitle')}
          </p>
        </div>

        {/* Top Right Action Deck */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Workspace Path Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary/70 text-xs font-mono">
            <Folder size={14} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
            <span className="text-foreground font-medium truncate max-w-[220px]" title={workspacePath}>
              {workspacePath || 'D:\\dev26-27'}
            </span>
            <button
              type="button"
              onClick={handleBrowseWorkspace}
              disabled={isBrowsingWorkspace}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded hover:bg-muted"
              title={locale === 'ar' ? 'تغيير المجلد' : 'Browse folder'}
            >
              <FolderSearch size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleScanWorkspace()}
              disabled={scanning}
              className="text-muted-foreground hover:text-cyan-500 dark:hover:text-cyan-400 p-1 transition-colors rounded hover:bg-muted"
              title={locale === 'ar' ? 'إعادة الفحص' : 'Rescan'}
            >
              <RefreshCw size={13} className={scanning ? 'spin' : ''} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline text-xs focus-ring gap-2 h-9 px-3.5 border-border hover:border-foreground/30"
            onClick={() => setRegisterOpen(true)}
            data-testid="button-manual-register"
          >
            <Plus size={14} />
            <span>{t('projects.register')}</span>
          </button>

          <button
            type="button"
            className="btn text-xs font-bold focus-ring gap-2 h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:brightness-110 text-black shadow-[0_0_20px_rgba(0,175,244,0.35)] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => {
              setScaffoldCreatedResult(null);
              setScaffoldingStep(null);
              setScaffolderOpen(true);
            }}
            data-testid="button-scaffold-ai"
          >
            <Sparkles size={15} className="text-black fill-black/20" />
            <span>{t('projects.scaffoldNew')}</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Metrics Strip (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card backdrop-blur flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {locale === 'ar' ? 'إجمالي المشاريع' : 'Indexed Projects'}
            </span>
            <b className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {kpiStats.totalCount}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-cyan-500 dark:text-cyan-400">
            <FolderKanban size={18} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card backdrop-blur flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {locale === 'ar' ? 'السيرفرات النشطة' : 'Active Dev Servers'}
            </span>
            <b className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-2">
              {kpiStats.runningCount}
              {kpiStats.runningCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
              )}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-emerald-600 dark:text-emerald-400">
            <Zap size={18} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card backdrop-blur flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {locale === 'ar' ? 'إجمالي ساعات العمل' : 'Total Focus Time'}
            </span>
            <b className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 block">
              {kpiStats.timeStr}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-cyan-500 dark:text-cyan-400">
            <Clock size={18} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card backdrop-blur flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {locale === 'ar' ? 'حزم قابلة للتنظيف' : 'Purgeable Cache'}
            </span>
            <b className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
              {kpiStats.cacheStr}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-rose-500 dark:text-rose-400">
            <HardDrive size={18} />
          </div>
        </div>
      </div>

      {/* 3. Unified Command Strip: Search, Categories, Filters */}
      <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between gap-4 p-2.5 border-b border-border/50 bg-secondary/20">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('projects.search')}
              className="w-full h-8 pl-9 pr-8 bg-background/50 hover:bg-background/80 text-xs border border-border/60 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all font-sans"
              data-testid="input-project-search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Right Controls: Sort & Layout Mode */}
          <div className="flex items-center gap-2">
            {/* Sorting Dropdown */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-background/50 border border-border/60 hover:border-border rounded-md px-2.5 h-8 transition-colors">
              <ArrowUpDown size={13} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-[11px] font-mono text-foreground cursor-pointer outline-none"
              >
                <option value="recent" className="bg-popover text-foreground">{t('projects.sortRecent')}</option>
                <option value="time" className="bg-popover text-foreground">{t('projects.sortTime')}</option>
                <option value="name" className="bg-popover text-foreground">{t('projects.sortName')}</option>
                <option value="size" className="bg-popover text-foreground">{t('projects.sortSize')}</option>
              </select>
            </div>

            {/* Grid / List View Toggle */}
            <div className="flex items-center bg-background/50 border border-border/60 rounded-md p-0.5 h-8">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-all flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-secondary text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-all flex items-center justify-center ${
                  viewMode === 'list'
                    ? 'bg-secondary text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Dense List View"
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-2.5 py-2 bg-card">
          {/* Category Tabs with Count Pills */}
          <div className="flex items-center gap-1">
            {(['all', 'active', 'client', 'experiment', 'archived'] as const).map((cat) => {
              const count = cat === 'all'
                ? projects.length
                : projects.filter((p) => p.status === cat).length;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                    filter === cat
                      ? 'bg-secondary text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                  data-testid={`button-filter-${cat}`}
                >
                  <span>{t(`projects.${cat}`)}</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${filter === cat ? 'bg-background text-foreground border border-border/50' : 'bg-secondary/80 text-muted-foreground'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tech Stack Chips Bar */}
          {availableStackTags.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none border-l border-border/50 pl-3 ml-2">
              <span className="text-[10px] uppercase font-mono text-muted-foreground/70 pr-1">Stack:</span>
              <button
                type="button"
                onClick={() => setSelectedStackTag('all')}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                  selectedStackTag === 'all'
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold'
                    : 'text-muted-foreground hover:text-foreground bg-transparent'
                }`}
              >
                All
              </button>
              {availableStackTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedStackTag(selectedStackTag === tag ? 'all' : tag)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors whitespace-nowrap ${
                    selectedStackTag === tag
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold'
                      : 'text-muted-foreground hover:text-foreground bg-transparent'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Projects Body: Grid Mode OR Dense Table List Mode */}
      {viewMode === 'grid' ? (
        /* GRID VIEW: Gorgeous Modern Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project, idx) => {
            const isRunning = isProjectRunning(project.path);
            const pid = getProjectPid(project.path);
            const timeSec = getProjectTimeSeconds(project.id);
            const timeSpentFormatted = formatTimeSpent(timeSec);
            const nmMb = project.node_modules_size_mb || 0;
            const nmStr = nmMb >= 1024 ? `${(nmMb / 1024).toFixed(1)} GB` : `${Math.round(nmMb)} MB`;
            const staggerClass = `stagger-${(idx % 8) + 1}`;

            return (
              <div
                key={project.id}
                className={`project-card cinematic-cascade ${staggerClass} group relative p-5 rounded-xl border bg-card transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-sm ${
                  isRunning
                    ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.06)]'
                    : 'border-border hover:border-cyan-500/40 hover:bg-secondary/30'
                }`}
                onClick={() => navigate(`/project/${project.id}`)}
              >
                {/* Card Top: Typography and Status */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-[15px] font-bold text-foreground group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors truncate">
                          {project.name}
                        </h2>
                        {isRunning && (
                           <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/20 shrink-0">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                             Running {pid ? `(${pid})` : ''}
                           </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/70 block truncate" title={project.path}>
                        {project.path.replace(/\\/g, ' / ')}
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <StatusPill status={project.status} label={t(`projects.${project.status}`)} />
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11.5px] text-muted-foreground/90 leading-relaxed line-clamp-2 min-h-[34px] mt-1">
                    {project.description || project.ai_summary?.summary || 'Local workspace project ready for active development.'}
                  </p>

                  {/* Tech Stack Pills - minimal style */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {project.stack.slice(0, 4).map((tech) => (
                      <span key={tech} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-background border border-border/60 text-foreground/80">
                        {tech}
                      </span>
                    ))}
                    {project.stack.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-transparent text-muted-foreground">
                        +{project.stack.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Meta & Action Bar */}
                <div className="flex flex-col gap-3 pt-3 border-t border-border/50 mt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {timeSpentFormatted ? (
                        <span className="text-foreground/80 flex items-center gap-1 font-medium">
                          <Clock size={11} className="text-cyan-500/70" /> {timeSpentFormatted}
                        </span>
                      ) : (
                        <span>{project.updated}</span>
                      )}
                    </div>

                    {nmMb > 0 ? (
                      <div className="flex items-center gap-1.5 group/trash cursor-default">
                        <span>{nmStr} cache</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCleanCache(project);
                          }}
                          disabled={cleaningId === project.id}
                          className="text-muted-foreground hover:text-rose-500 dark:hover:text-rose-400 p-0.5 transition-colors opacity-0 group-hover/trash:opacity-100"
                          title="Purge Cache"
                        >
                          <Trash2 size={11} className={cleaningId === project.id ? 'spin' : ''} />
                        </button>
                      </div>
                    ) : (
                      project.git_branch && (
                        <span className="flex items-center gap-1 text-muted-foreground/60">
                          <GitBranch size={10} /> {project.git_branch}
                        </span>
                      )
                    )}
                  </div>

                  {/* 1-Click Launch Controls */}
                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleLaunchIde(project)}
                      className="btn btn-outline text-[11px] h-7 px-2 justify-center gap-1.5 border-border/60 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-600 dark:hover:text-cyan-400"
                    >
                      <Code2 size={11} className="text-cyan-500 dark:text-cyan-400/80" />
                      <span>{getIdeLabel(defaultIde)}</span>
                    </button>

                    {isRunning ? (
                      <button
                        type="button"
                        onClick={() => handleStopDevServer(project)}
                        disabled={stoppingDevPath === project.path}
                        className="btn btn-outline text-[11px] h-7 px-2 justify-center gap-1.5 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Square size={11} />
                        <span>Stop Server</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRunDevServer(project)}
                        className="btn btn-outline text-[11px] h-7 px-2 justify-center gap-1.5 border-border/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        <Play size={11} className="text-emerald-500/80 dark:text-emerald-400/80" />
                        <span>Run Server</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DENSE TABLE VIEW: Ultra-fast Scanning for 90+ Projects */
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/70 text-muted-foreground font-mono uppercase text-[10.5px]">
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Tech Stack</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Server</th>
                  <th className="py-3 px-4">Time Spent</th>
                  <th className="py-3 px-4">Cache / Disk</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {filteredProjects.map((project) => {
                  const isRunning = isProjectRunning(project.path);
                  const pid = getProjectPid(project.path);
                  const timeSec = getProjectTimeSeconds(project.id);
                  const timeSpentFormatted = formatTimeSpent(timeSec);
                  const nmMb = project.node_modules_size_mb || 0;
                  const nmStr = nmMb >= 1024 ? `${(nmMb / 1024).toFixed(1)} GB` : `${Math.round(nmMb)} MB`;

                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="hover:bg-secondary/60 transition-colors cursor-pointer group"
                    >
                      {/* Name & Path */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Terminal size={15} className={isRunning ? 'text-emerald-500 dark:text-emerald-400' : 'text-cyan-500 dark:text-cyan-400'} />
                          <div>
                            <b className="text-foreground group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors block text-sm">
                              {project.name}
                            </b>
                            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[220px] block" title={project.path}>
                              {project.path}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Stack */}
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap max-w-[220px]">
                          {project.stack.slice(0, 3).map((st) => (
                            <span key={st} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary border border-border text-foreground">
                              {st}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusPill status={project.status} label={t(`projects.${project.status}`)} />
                      </td>

                      {/* Dev Server */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active {pid ? `(${pid})` : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">Idle</span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {timeSpentFormatted ? (
                          <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{timeSpentFormatted}</span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Cache */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {nmMb > 0 ? (
                          <span className="text-rose-500 dark:text-rose-400">{nmStr}</span>
                        ) : (
                          <span className="text-muted-foreground">Clean</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLaunchIde(project)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-secondary transition-colors"
                            title={`Launch in ${getIdeLabel(defaultIde)}`}
                          >
                            <Zap size={14} />
                          </button>
                          {isRunning ? (
                            <button
                              type="button"
                              onClick={() => handleStopDevServer(project)}
                              className="p-1.5 rounded-md text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Stop Dev Server"
                            >
                              <Square size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRunDevServer(project)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-secondary transition-colors"
                              title="Run Dev Server"
                            >
                              <Play size={14} />
                            </button>
                          )}
                          <Link
                            href={`/project/${project.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Open Project Cockpit"
                          >
                            <ExternalLink size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <div className="empty-state panel p-12 text-center flex flex-col items-center justify-center rounded-xl border border-dashed border-border gap-3">
          <FolderKanban size={40} className="text-muted-foreground" />
          <b className="text-base font-semibold text-foreground">{t('projects.emptyStateTitle')}</b>
          <p className="text-xs text-muted-foreground max-w-sm">{t('projects.emptyStateDesc')}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleBrowseWorkspace}
              className="btn btn-outline text-xs h-9 px-4 gap-2"
            >
              <FolderSearch size={14} />
              <span>{t('projects.changeFolder')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScaffoldCreatedResult(null);
                setScaffoldingStep(null);
                setScaffolderOpen(true);
              }}
              className="btn btn-accent text-xs h-9 px-4 gap-2"
            >
              <Sparkles size={14} />
              <span>{t('projects.scaffoldNew')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal: Advanced AI Project Scaffolding Wizard (Zero-to-Hero) */}
      {scaffolderOpen && (
        <Modal title={t('projects.scaffoldTitle')} onClose={() => setScaffolderOpen(false)}>
          <div className="flex flex-col gap-4">
            {/* Header Description & Model Selector */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScaffoldMode('ai')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    scaffoldMode === 'ai'
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles size={13} /> {t('projects.aiGenerator')}
                </button>
                <button
                  type="button"
                  onClick={() => setScaffoldMode('template')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    scaffoldMode === 'template'
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers size={13} /> {t('projects.starterTemplates')}
                </button>
              </div>

              {scaffoldMode === 'ai' && (
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <Bot size={13} className="text-cyan-500 dark:text-cyan-400" />
                  <select
                    value={scaffoldModel}
                    onChange={(e) => setScaffoldModel(e.target.value as any)}
                    className="bg-secondary text-[11px] font-mono border border-border rounded px-2 py-1 text-foreground outline-none cursor-pointer"
                  >
                    <option value="gemini-pro" className="bg-popover text-foreground">Google Gemini 3.6 Flash</option>
                    <option value="deepseek-flash" className="bg-popover text-foreground">DeepSeek V4 Flash</option>
                    <option value="deepseek-pro" className="bg-popover text-foreground">DeepSeek V4 Pro</option>
                  </select>
                </div>
              )}
            </div>

            {/* Successful Creation View */}
            {scaffoldCreatedResult ? (
              <div className="flex flex-col gap-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {locale === 'ar' ? 'تم إنشاء المشروع وتثبيته بنجاح!' : 'Project Scaffolding Complete!'}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {scaffoldCreatedResult.path}
                    </p>
                  </div>
                </div>

                {scaffoldCreatedResult.files.length > 0 && (
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-secondary/50">
                    <span className="text-[11px] font-mono text-muted-foreground uppercase">
                      {locale === 'ar' ? 'الملفات المولدة:' : 'Generated Files:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {scaffoldCreatedResult.files.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-card border border-border text-foreground">
                          <Code2 size={11} className="text-cyan-500 dark:text-cyan-400" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setScaffolderOpen(false);
                      setScaffoldCreatedResult(null);
                    }}
                    className="btn btn-ghost text-xs h-9 px-3"
                  >
                    {locale === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const proj = projects.find((p) => p.name === scaffoldCreatedResult.name);
                      if (proj) {
                        setScaffolderOpen(false);
                        navigate(`/project/${proj.id}`);
                      } else {
                        setScaffolderOpen(false);
                      }
                    }}
                    className="btn btn-primary text-xs h-9 px-4 gap-2"
                  >
                    <Rocket size={13} />
                    <span>{locale === 'ar' ? 'فتح في لوحة التحكم' : 'Open in Project Hub'}</span>
                  </button>
                </div>
              </div>
            ) : scaffoldingStep !== null ? (
              /* Phased Scaffolding Progress Visualizer */
              <div className="flex flex-col gap-4 py-8 items-center text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <Sparkles size={22} className="absolute inset-0 m-auto text-cyan-400 animate-pulse" />
                </div>

                <div className="flex flex-col gap-1 max-w-sm">
                  <h3 className="text-base font-bold text-foreground">
                    {scaffoldingStep === 1 && (locale === 'ar' ? 'تحليل المتطلبات وتخطيط المعمارية...' : 'Analyzing prompt & architecting project...')}
                    {scaffoldingStep === 2 && (locale === 'ar' ? 'توليد الحزم وملفات التكوين...' : 'Synthesizing dependencies & configs...')}
                    {scaffoldingStep === 3 && (locale === 'ar' ? 'كتابة الشيفرات البرمجية والملفات...' : 'Writing source code to workspace...')}
                    {scaffoldingStep === 4 && (locale === 'ar' ? 'تسجيل المشروع في الخزنة...' : 'Registering project in Vault...')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {newProjectName} · {scaffoldModel === 'gemini-pro' ? 'Gemini 3.6 Flash' : 'DeepSeek'}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        scaffoldingStep >= step ? 'w-10 bg-cyan-500 dark:bg-cyan-400' : 'w-4 bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* Scaffolding Form */
              <form onSubmit={handleExecuteScaffold} className="flex flex-col gap-4">
                {scaffoldMode === 'ai' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase font-mono">
                      {locale === 'ar' ? 'نماذج إلهام سريعة' : 'Quick Inspiration Presets'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AI_QUICK_PRESETS.map((preset) => (
                        <div
                          key={preset.title}
                          onClick={() => {
                            setAiPrompt(preset.prompt);
                            setNewProjectName(preset.slug);
                            setAiStackType(preset.stack);
                          }}
                          className="p-2.5 rounded-lg border border-border bg-secondary/50 hover:border-cyan-500/50 hover:bg-cyan-500/5 cursor-pointer transition-all flex flex-col gap-1"
                        >
                          <b className="text-xs text-foreground flex items-center justify-between">
                            {preset.title}
                            <ArrowRight size={12} className="text-muted-foreground" />
                          </b>
                          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {preset.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t('projects.projectName')}</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. discord-bot-pro, nextjs-crm-app"
                    required
                    className="editable-input text-xs"
                  />
                </div>

                {scaffoldMode === 'template' ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-foreground">{t('projects.selectTemplate')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: 'saas-next15', name: 'Next.js 15 SaaS', desc: 'App Router, Tailwind, Supabase ready' },
                        { id: 'tauri-desktop', name: 'Tauri v2 + React 19', desc: 'Native high-perf desktop shell' },
                        { id: 'fastapi-ai', name: 'FastAPI AI Backend', desc: 'Python async, Uvicorn, Gemini/DeepSeek' },
                        { id: 'discord-bot', name: 'Discord.js v14 Bot', desc: 'TypeScript, Slash commands, SQLite' },
                      ].map((tpl) => (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            setSelectedTemplate(tpl.id);
                            if (!newProjectName) setNewProjectName(tpl.id);
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedTemplate === tpl.id
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-border bg-secondary/60 hover:border-foreground/30'
                          }`}
                        >
                          <b className="text-xs text-foreground block">{tpl.name}</b>
                          <small className="text-[11px] text-muted-foreground block mt-0.5">{tpl.desc}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t('projects.promptLabel')}</label>
                      <textarea
                        rows={4}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder={t('projects.promptPlaceholder')}
                        required
                        className="editable-textarea text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t('projects.selectStack')}</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'web', label: 'Full-Stack Web' },
                          { id: 'desktop', label: 'Desktop (Tauri)' },
                          { id: 'python', label: 'Python Backend' },
                          { id: 'mobile', label: 'Mobile App' },
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setAiStackType(st.id)}
                            className={`p-2 rounded-md text-xs border text-center transition-all ${
                              aiStackType === st.id
                                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold'
                                : 'border-border bg-secondary/50 text-muted-foreground'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
                  <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[280px]">
                    {workspacePath}\\{newProjectName || '...'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setScaffolderOpen(false)}
                      className="btn btn-ghost text-xs h-9 px-3"
                    >
                      {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={!newProjectName.trim()}
                      className="btn btn-primary text-xs h-9 px-4 gap-2"
                    >
                      <Sparkles size={13} />
                      <span>{t('projects.createProject')}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* 6. Modal: Register Manual Project */}
      {registerOpen && (
        <Modal title={t('projects.registerTitle')} onClose={() => setRegisterOpen(false)}>
          <form onSubmit={handleRegisterManual} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">{t('projects.projectName')}</label>
              <input name="name" type="text" placeholder="My New Project" required className="editable-input text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">{t('projects.description')}</label>
              <input name="description" type="text" placeholder="Production service..." required className="editable-input text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">{t('projects.stack')}</label>
              <input name="stack" type="text" placeholder="React, TypeScript, Tailwind" required className="editable-input text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">{t('common.workspace')}</label>
              <input name="path" type="text" defaultValue={workspacePath} required className="editable-input text-xs mono" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
              <button type="button" onClick={() => setRegisterOpen(false)} className="btn btn-ghost text-xs h-8 px-3">
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="btn btn-primary text-xs h-8 px-4">
                {t('projects.registerLocally')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Modal: Change Workspace Folder Path */}
      {changePathOpen && (
        <Modal
          title={locale === 'ar' ? 'تحديد مسار مجلد المشاريع' : 'Set Workspace Directory'}
          onClose={() => setChangePathOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = customPathInput.trim();
              if (trimmed) {
                setWorkspacePath(trimmed);
                handleScanWorkspace(trimmed);
                setChangePathOpen(false);
                notify(locale === 'ar' ? `تم حفظ المسار: ${trimmed}` : `Workspace path set to: ${trimmed}`);
              }
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-xs text-muted-foreground leading-relaxed">
              {locale === 'ar'
                ? 'أدخل المسار الكامل للمجلد الذي يحتوي على مشاريعك البرمجية على القرص:'
                : 'Enter the full directory path where your local projects are located:'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                placeholder="D:\all2026.2007 or C:\Projects"
                required
                className="editable-input text-xs mono flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={async () => {
                  const p = await pickDirectory();
                  if (p) setCustomPathInput(p);
                }}
                className="btn btn-outline text-xs px-3 shrink-0 gap-1.5"
                title="Browse..."
              >
                <FolderSearch size={14} />
                <span>{locale === 'ar' ? 'استعراض...' : 'Browse...'}</span>
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setChangePathOpen(false)}
                className="btn btn-ghost text-xs h-8 px-3"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="btn btn-primary text-xs h-8 px-4 font-semibold"
              >
                {locale === 'ar' ? 'حفظ وفحص المشاريع' : 'Save & Scan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
