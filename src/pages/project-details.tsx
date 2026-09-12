import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import {
  ArrowLeft, Terminal, Play, Square, RefreshCw, Folder, FileCode,
  FileText, FolderKanban, Zap, Sparkles, Trash2, ExternalLink,
  Copy, Check, HardDrive, GitBranch, Cpu, Eye, EyeOff, Layers,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Archive,
  Settings as SettingsIcon, Wrench, ShieldAlert, Bug, Download, RotateCcw
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { useDesktopDialog } from '@/components/ui/desktop-dialog';
import type { Project, AISummary, Status } from '@/pages/projects';
import { apiGet, apiPost } from '@/lib/api-client';

interface CustomIdeCommand {
  id: string;
  name: string;
  command: string;
}

interface FileTreeItem {
  name: string;
  type: 'dir' | 'file';
  path: string;
  size?: number;
  depth: number;
}

interface ProjectSnapshot {
  project_name: string;
  version_tag: string;
  note: string;
  zip_filename: string;
  zip_filepath: string;
  size_mb: number;
  file_count: number;
  created_at: string;
  timestamp_formatted: string;
}

export default function ProjectDetailsPage({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();
  const [, params] = useRoute<{ id: string }>('/project/:id');
  const projectId = params?.id;
  const { confirmDialog } = useDesktopDialog();

  // Persistent states
  const [cachedProjects, setCachedProjects] = usePersistent<Project[]>('cortex-vault-projects', []);
  const [aiSummaries, setAiSummaries] = usePersistent<Record<string, AISummary>>('cortex-project-summaries', {});
  const [defaultIde] = usePersistent<string>('cortex-default-ide', 'antigravity');
  const [backupDir] = usePersistent<string>('cortex-backup-dir', 'D:\\CortexOS_Backups');
  const [customIdes] = usePersistent<CustomIdeCommand[]>('cortex-custom-ide-commands', [
    { id: 'antigravity', name: 'Google Antigravity', command: 'antigravity .' },
    { id: 'cursor', name: 'Cursor AI', command: 'cursor .' },
    { id: 'code', name: 'Visual Studio Code', command: 'code .' },
    { id: 'windsurf', name: 'Windsurf', command: 'windsurf .' },
    { id: 'webstorm', name: 'WebStorm', command: 'webstorm .' },
    { id: 'pycharm', name: 'PyCharm', command: 'pycharm .' },
    { id: 'subl', name: 'Sublime Text', command: 'subl .' },
  ]);

  // Active project
  const project = useMemo(() => {
    return cachedProjects.find((p) => p.id === projectId) || null;
  }, [cachedProjects, projectId]);

  // Tab State: 'overview' | 'dev' | 'files' | 'backups' | 'settings'
  const [activeTab, setActiveTab] = useState<'overview' | 'dev' | 'files' | 'backups' | 'settings'>('overview');

  // Dev server state
  const [devCommand, setDevCommand] = useState<string>('');
  const [devMode, setDevMode] = useState<'hidden' | 'terminal'>('hidden');
  const [isRunningDev, setIsRunningDev] = useState<boolean>(false);
  const [devPid, setDevPid] = useState<number | null>(null);
  const [startingDev, setStartingDev] = useState<boolean>(false);
  const [stoppingDev, setStoppingDev] = useState<boolean>(false);

  // Live Logs
  const [serverLogs, setServerLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [aiDiagnosing, setAiDiagnosing] = useState<boolean>(false);
  const [aiDiagnosisResult, setAiDiagnosisResult] = useState<string | null>(null);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState<boolean>(false);

  // File tree
  const [fileItems, setFileItems] = useState<FileTreeItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);

  // AI analysis state
  const [analyzingAi, setAnalyzingAi] = useState<boolean>(false);
  const [cleaningCache, setCleaningCache] = useState<boolean>(false);

  // Backups state
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState<boolean>(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState<boolean>(false);
  const [snapshotTag, setSnapshotTag] = useState<string>('v1.0.0');
  const [snapshotNote, setSnapshotNote] = useState<string>('');
  const [showCreateSnapshotModal, setShowCreateSnapshotModal] = useState<boolean>(false);

  // Project-specific settings overrides
  const [projectIdeOverride, setProjectIdeOverride] = usePersistent<Record<string, string>>('cortex-project-ide-overrides', {});
  const [projectEnvVars, setProjectEnvVars] = usePersistent<Record<string, string>>('cortex-project-env-vars', {});
  const [copiedPath, setCopiedPath] = useState(false);

  // Active Stopwatch & Time Tracking
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState<number>(() => {
    if (!project) return 0;
    const stored = localStorage.getItem(`cortex_time_spent_${project.id}`);
    return stored ? parseInt(stored, 10) : 3600; // default 1 hr initial proxy
  });

  // Timer interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
        setTotalTimeSpent((prev) => {
          const next = prev + 1;
          if (project?.id) {
            localStorage.setItem(`cortex_time_spent_${project.id}`, String(next));
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, project?.id]);

  // Format seconds to human string
  const formatSeconds = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${s}s`;
    return `${mins}m ${s}s`;
  };

  // Check dev server status & detect smart command
  const checkDevStatus = useCallback(async (projectPath: string) => {
    try {
      const data = await apiGet<{ running?: boolean; pid?: number }>(`/api/projects/dev-status?path=${encodeURIComponent(projectPath)}`);
      if (data) {
        setIsRunningDev(Boolean(data.running));
        setDevPid(data.pid || null);
      }
    } catch {
      // silent
    }
  }, []);

  const detectSmartCommand = useCallback(async (projectPath: string) => {
    try {
      const data = await apiGet<{ command?: string }>(`/api/projects/detect-command?path=${encodeURIComponent(projectPath)}`);
      if (data && data.command && !devCommand) {
        setDevCommand(data.command);
      }
    } catch {
      // silent
    }
  }, [devCommand]);

  const fetchProjectFiles = useCallback(async (projectPath: string) => {
    setLoadingFiles(true);
    try {
      const data = await apiGet<{ ok?: boolean; items?: FileTreeItem[] }>(`/api/projects/files?path=${encodeURIComponent(projectPath)}`);
      if (data && data.ok && Array.isArray(data.items)) {
        setFileItems(data.items);
      }
    } catch {
      // silent
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // Fetch Dev Server Logs
  const fetchLogs = useCallback(async (projectPath: string) => {
    setLoadingLogs(true);
    try {
      const data = await apiGet<{ ok?: boolean; logs?: string }>(`/api/projects/logs?path=${encodeURIComponent(projectPath)}&max_lines=120`);
      if (data && data.ok && typeof data.logs === 'string') {
        setServerLogs(data.logs);
      }
    } catch {
      // silent
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // Fetch Project Snapshots
  const fetchSnapshots = useCallback(async (projectPath: string) => {
    setLoadingSnapshots(true);
    try {
      const data = await apiGet<{ ok?: boolean; snapshots?: ProjectSnapshot[] }>(`/api/projects/backup/list?project_path=${encodeURIComponent(projectPath)}&backup_dir=${encodeURIComponent(backupDir)}`);
      if (data && data.ok && Array.isArray(data.snapshots)) {
        setSnapshots(data.snapshots);
      }
    } catch {
      // silent
    } finally {
      setLoadingSnapshots(false);
    }
  }, [backupDir]);

  useEffect(() => {
    if (project?.path) {
      checkDevStatus(project.path);
      detectSmartCommand(project.path);
      fetchProjectFiles(project.path);
      fetchLogs(project.path);
      fetchSnapshots(project.path);
    }
  }, [project?.path, checkDevStatus, detectSmartCommand, fetchProjectFiles, fetchLogs, fetchSnapshots]);

  // Periodic poll for logs and dev status if server is running
  useEffect(() => {
    if (!isRunningDev || !project?.path) return;
    const timer = setInterval(() => {
      checkDevStatus(project.path);
      fetchLogs(project.path);
    }, 3500);
    return () => clearInterval(timer);
  }, [isRunningDev, project?.path, checkDevStatus, fetchLogs]);

  // Start Dev Server
  const handleStartDev = async () => {
    if (!project) return;
    setStartingDev(true);
    try {
      const data = await apiPost<{ ok?: boolean; pid?: number; command?: string; error?: string }>('/api/projects/run-dev', {
        project_path: project.path,
        command: devCommand.trim() || undefined,
        mode: devMode,
      });

      if (data && data.ok) {
        setIsRunningDev(true);
        setDevPid(data.pid || null);
        notify(locale === 'ar' ? `تم تشغيل السيرفر (${data.command})` : `Server launched (${data.command})`);
        setTimeout(() => fetchLogs(project.path), 1200);
      } else {
        notify(data?.error || 'Failed to start dev server');
      }
    } catch {
      notify('Failed to start dev server');
    } finally {
      setStartingDev(false);
    }
  };

  // Stop Dev Server
  const handleStopDev = async () => {
    if (!project) return;
    setStoppingDev(true);
    try {
      const data = await apiPost<{ ok?: boolean; error?: string }>('/api/projects/stop-dev', {
        project_path: project.path,
      });

      if (data && data.ok) {
        setIsRunningDev(false);
        setDevPid(null);
        notify(locale === 'ar' ? 'تم إيقاف السيرفر بنجاح' : 'Dev server stopped');
      }
    } catch {
      notify('Failed to stop dev server');
    } finally {
      setStoppingDev(false);
    }
  };

  // Ask AI to analyze logs and diagnose errors
  const handleAskAiFix = async () => {
    if (!project || !serverLogs.trim()) return;
    setAiDiagnosing(true);
    setShowDiagnosisModal(true);
    try {
      const data = await apiPost<{ ok?: boolean; analysis?: string; error?: string }>('/api/projects/analyze-logs', {
        logs: serverLogs,
        project_name: project.name,
        stack: project.stack,
        provider: 'auto',
      });

      if (data && data.ok && data.analysis) {
        setAiDiagnosisResult(data.analysis);
      } else {
        setAiDiagnosisResult(data?.error || 'Could not diagnose error.');
      }
    } catch (e: any) {
      setAiDiagnosisResult(`Error connecting to AI: ${e.message}`);
    } finally {
      setAiDiagnosing(false);
    }
  };

  // Launch in IDE
  const effectiveIde = (project && projectIdeOverride[project.id]) || defaultIde || 'antigravity';

  const handleLaunchIde = async (ideId: string) => {
    if (!project) return;
    try {
      await apiPost('/api/projects/launch-ide', {
        project_path: project.path,
        ide: ideId,
      });

      const selectedObj = customIdes.find((i) => i.id === ideId);
      const name = selectedObj ? selectedObj.name : ideId;
      notify(locale === 'ar' ? `تم فتح المشروع بـ ${name}` : `Launched in ${name}`);
    } catch {
      notify('Failed to launch IDE');
    }
  };

  // Explain with AI (Deep Scan & Documentation)
  const handleExplainAi = async () => {
    if (!project) return;
    setAnalyzingAi(true);
    try {
      const data = await apiPost<{ ok?: boolean; summary?: string; role?: string; architecture?: string; run_command?: string; model?: string; provider?: string }>('/api/ai/explain-project', {
        project_path: project.path,
        provider: 'auto',
      });

      if (data && data.ok && data.summary) {
        const newSummary: AISummary = {
          summary: data.summary,
          role: data.role || 'Production Application',
          architecture: data.architecture || 'Modern Component Architecture',
          run_command: data.run_command || devCommand,
          model: data.model,
          provider: data.provider,
        };

        setAiSummaries((prev) => ({ ...prev, [project.id]: newSummary }));
        setCachedProjects((prev) =>
          prev.map((p) => (p.id === project.id ? { ...p, ai_summary: newSummary } : p))
        );

        if (data.run_command && !devCommand) {
          setDevCommand(data.run_command);
        }
        notify(locale === 'ar' ? 'تم التلخيص والتوثيق الذكي بنجاح' : 'AI documentation synthesized');
      }
    } catch {
      notify('AI analysis failed');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Create Project ZIP Snapshot
  const handleCreateSnapshot = async () => {
    if (!project) return;
    setCreatingSnapshot(true);
    try {
      const data = await apiPost<{ ok?: boolean; error?: string }>('/api/projects/backup/create', {
        project_path: project.path,
        version_tag: snapshotTag,
        note: snapshotNote,
        backup_dir: backupDir,
      });

      if (data && data.ok) {
        notify(locale === 'ar' ? `تم إنشاء لقطة ZIP (${snapshotTag})` : `Snapshot created (${snapshotTag})`);
        setShowCreateSnapshotModal(false);
        setSnapshotNote('');
        fetchSnapshots(project.path);
      } else {
        notify(data?.error || 'Failed to create snapshot');
      }
    } catch {
      notify('Failed to create snapshot');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  // Restore Snapshot
  const handleRestoreSnapshot = async (snapshot: ProjectSnapshot) => {
    if (!project) return;
    const ok = await confirmDialog({
      title: locale === 'ar' ? 'تأكيد استعادة لقطة المشروع' : 'Confirm Project Snapshot Restore',
      message: `${locale === 'ar' ? 'استعادة الإصدار' : 'Restore version'} ${snapshot.version_tag} (${snapshot.size_mb} MB)? ${locale === 'ar' ? 'سيتم استبدال الملفات الحالية بالملفات المستعادة من النسخة.' : 'This will unpack the snapshot over the project files.'}`,
      confirmText: locale === 'ar' ? 'نعم، استعادة الآن' : 'Restore Files',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      isDanger: true,
    });

    if (!ok) return;

    try {
      const data = await apiPost<{ ok?: boolean; error?: string }>('/api/projects/backup/restore', {
        zip_path: snapshot.zip_filepath,
        target_dir: project.path,
      });

      if (data && data.ok) {
        notify(locale === 'ar' ? 'تمت استعادة الملفات بنجاح!' : 'Files restored successfully!');
        fetchProjectFiles(project.path);
      } else {
        notify(data?.error || 'Restoration failed');
      }
    } catch {
      notify('Restoration failed');
    }
  };

  // Open Backup Folder
  const handleOpenBackupVault = async () => {
    try {
      await apiPost('/api/projects/backup/open-folder', { backup_dir: backupDir });
    } catch {
      // silent
    }
  };

  // Clean Cache
  const handleCleanCache = async () => {
    if (!project) return;
    const ok = await confirmDialog({
      title: locale === 'ar' ? 'تنظيف الكاش و node_modules' : 'Clean Project Cache',
      message: `${locale === 'ar' ? 'هل تريد حذف مجلد node_modules لتوفير المساحة؟' : 'Delete node_modules to free disk space?'} (${project.node_modules_size_mb} MB)`,
      confirmText: locale === 'ar' ? 'تنظيف الآن' : 'Clean Cache',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      isDanger: true,
    });

    if (!ok) return;

    setCleaningCache(true);
    try {
      const data = await apiPost<{ ok?: boolean; error?: string }>('/api/projects/clean-cache', { path: project.path });
      if (data && data.ok) {
        setCachedProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, has_node_modules: false, node_modules_size_mb: 0 } : p
          )
        );
        notify(locale === 'ar' ? 'تم تحرير المساحة بنجاح' : 'Cache purged successfully');
      }
    } catch {
      notify('Failed to clean cache');
    } finally {
      setCleaningCache(false);
    }
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <FolderKanban size={48} className="text-zinc-600" />
        <div>
          <h2 className="text-lg font-bold text-white">
            {locale === 'ar' ? 'المشروع غير موجود' : 'Project Not Found'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {locale === 'ar' ? 'قد يكون المشروع قد تم حذفه أو لم يتم مسحه بعد.' : 'This project might have been moved.'}
          </p>
        </div>
        <Link href="/projects" className="btn btn-outline text-xs h-9 px-4 gap-2">
          <ArrowLeft size={14} />
          <span>{locale === 'ar' ? 'العودة لقائمة المشاريع' : 'Back to Projects Vault'}</span>
        </Link>
      </div>
    );
  }

  const activeAi = project.ai_summary || aiSummaries[project.id];

  return (
    <div className="page-wrap space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Command Cockpit */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="flex items-start gap-3">
          <Link
            href="/projects"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition shrink-0 mt-1"
            title={locale === 'ar' ? 'رجوع للخزينة' : 'Back to Projects Vault'}
          >
            <ArrowLeft size={18} />
          </Link>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {activeAi?.role || 'DEVELOPER PROJECT'}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-mono text-zinc-400 truncate max-w-[280px]">{project.path}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(project.path);
                  setCopiedPath(true);
                  setTimeout(() => setCopiedPath(false), 2000);
                  notify(locale === 'ar' ? 'تم نسخ المسار' : 'Path copied');
                }}
                className="text-zinc-500 hover:text-white transition"
                title="Copy Path"
              >
                {copiedPath ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>{project.name}</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-300">
                {project.status.toUpperCase()}
              </span>
            </h1>
          </div>
        </div>

        {/* Quick Launch Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Work Session Stopwatch */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#080808] border border-zinc-800">
            <Clock size={14} className={isTimerRunning ? 'text-cyan-400 animate-pulse' : 'text-zinc-500'} />
            <div className="text-xs font-mono">
              <span className="text-zinc-400 block text-[10px]">
                {locale === 'ar' ? 'وقت العمل الإجمالي' : 'TOTAL TIME'}
              </span>
              <span className="text-white font-bold">{formatSeconds(totalTimeSpent)}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`ms-2 px-2.5 py-1 rounded text-[10px] font-mono font-bold transition ${
                isTimerRunning
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
              }`}
            >
              {isTimerRunning ? (locale === 'ar' ? 'إيقاف' : 'PAUSE') : (locale === 'ar' ? 'بدء مؤقت' : 'START')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleLaunchIde(effectiveIde)}
            className="btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2 px-4 rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(0,175,244,0.3)] transition-all"
          >
            <Zap size={14} />
            <span>
              {locale === 'ar' ? `فتح بـ ${effectiveIde}` : `Open in ${effectiveIde}`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleLaunchIde('explorer')}
            className="btn btn-secondary border border-zinc-800 text-xs py-2 px-3 hover:bg-zinc-900"
            title="Open in Explorer"
          >
            <Folder size={14} />
          </button>
        </div>
      </div>

      {/* 2. Cockpit Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'overview'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Sparkles size={14} className="text-cyan-400" />
          <span>{locale === 'ar' ? 'نظرة عامة والذكاء الاصطناعي' : 'Overview & AI'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dev')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'dev'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Terminal size={14} className={isRunningDev ? 'text-emerald-400' : 'text-zinc-400'} />
          <span>{locale === 'ar' ? 'سيرفر التطوير والسجلات الحية' : 'Dev Server & Logs'}</span>
          {isRunningDev && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'files'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <FileCode size={14} />
          <span>{locale === 'ar' ? 'مستكشف الملفات' : 'File Explorer'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backups')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'backups'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <Archive size={14} className="text-amber-400" />
          <span>{locale === 'ar' ? 'النسخ الاحتياطية وإصدارات ZIP' : 'ZIP Snapshots'}</span>
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
            {snapshots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'settings'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
          }`}
        >
          <SettingsIcon size={14} />
          <span>{locale === 'ar' ? 'إعدادات المشروع' : 'Project Settings'}</span>
        </button>
      </div>

      {/* 3. TAB 1: OVERVIEW & AI INTELLIGENCE */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            {/* AI Synthesized Intelligence */}
            <div className="p-6 rounded-2xl bg-[#060606] border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Sparkles size={16} className="text-cyan-400" />
                  <span>{locale === 'ar' ? 'التحليل المعماري الذكي (CortexOS Neural AI)' : 'AI Architectural Intelligence'}</span>
                </div>

                <button
                  type="button"
                  onClick={handleExplainAi}
                  disabled={analyzingAi}
                  className="btn btn-secondary border border-zinc-800 text-xs py-1.5 px-3 flex items-center gap-1.5 hover:bg-zinc-900"
                >
                  <RefreshCw size={13} className={analyzingAi ? 'animate-spin text-cyan-400' : 'text-zinc-400'} />
                  <span>{analyzingAi ? (locale === 'ar' ? 'جارٍ الفحص...' : 'Analyzing...') : (locale === 'ar' ? 'إعادة التوثيق الذكي' : 'Deep Re-Scan')}</span>
                </button>
              </div>

              {activeAi ? (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-black/60 border border-zinc-800/80 leading-relaxed text-zinc-300">
                    {activeAi.summary}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-black/40 border border-zinc-900">
                      <span className="text-zinc-500 text-[11px] block font-mono mb-1 uppercase">
                        {locale === 'ar' ? 'الهندسة المعمارية' : 'Architecture'}
                      </span>
                      <p className="text-white font-medium">{activeAi.architecture}</p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-black/40 border border-zinc-900">
                      <span className="text-zinc-500 text-[11px] block font-mono mb-1 uppercase">
                        {locale === 'ar' ? 'أمر التشغيل المكتشف' : 'Auto Launch Command'}
                      </span>
                      <code className="text-cyan-400 font-mono font-medium block">
                        {activeAi.run_command || 'npm run dev'}
                      </code>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <Sparkles size={32} className="text-zinc-700 mx-auto" />
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    {locale === 'ar'
                      ? 'لم يتم تلخيص هذا المشروع بعد. انقر على زر التوثيق الذكي ليقوم الذكاء الاصطناعي بقراءة الملفات وتوليد ملخص معماري وتحديد طريقة التشغيل المثالية.'
                      : 'Scan this project with Gemini to automatically generate architectural insights, summaries, and prerequisites.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleExplainAi}
                    disabled={analyzingAi}
                    className="btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2 px-4 rounded-lg inline-flex items-center gap-2"
                  >
                    <Sparkles size={14} />
                    <span>{locale === 'ar' ? 'بدء التوثيق الذكي الآن' : 'Synthesize Documentation'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tech Stack Badges */}
            <div className="p-5 rounded-2xl bg-[#060606] border border-zinc-800/80">
              <h3 className="text-xs font-mono text-zinc-400 uppercase mb-3">
                {locale === 'ar' ? 'حزم التقنيات والمكتبات المكتشفة' : 'DETECTED TECH STACK'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.stack.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 rounded-lg text-xs font-mono font-medium bg-black border border-zinc-800 text-zinc-300"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Git Metadata */}
            <div className="p-5 rounded-2xl bg-[#060606] border border-zinc-800/80 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs border-b border-zinc-800 pb-2.5">
                <GitBranch size={15} className="text-cyan-400" />
                <span>{locale === 'ar' ? 'مستودع Git والتعديلات' : 'Git Source Control'}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-zinc-500 text-[11px] block">{locale === 'ar' ? 'الفرع الحالي' : 'Active Branch'}</span>
                  <span className="font-mono text-cyan-400 font-medium">{project.git_branch || 'main'}</span>
                </div>

                {project.git_last_commit && (
                  <div>
                    <span className="text-zinc-500 text-[11px] block">{locale === 'ar' ? 'آخر تعديل' : 'Last Commit'}</span>
                    <span className="text-zinc-300 font-mono text-[11px]">{project.git_last_commit}</span>
                  </div>
                )}

                {project.git_remote && (
                  <div>
                    <span className="text-zinc-500 text-[11px] block">{locale === 'ar' ? 'المستودع البعيد' : 'Remote URL'}</span>
                    <a
                      href={project.git_remote}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px] truncate"
                    >
                      <ExternalLink size={11} />
                      <span className="truncate">{project.git_remote}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Storage & node_modules Cleaner */}
            <div className="p-5 rounded-2xl bg-[#060606] border border-zinc-800/80 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs border-b border-zinc-800 pb-2.5">
                <HardDrive size={15} className="text-amber-400" />
                <span>{locale === 'ar' ? 'المساحة والكاش' : 'Disk & Dependencies'}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">{locale === 'ar' ? 'حجم node_modules:' : 'node_modules size:'}</span>
                  <span className="font-mono text-white font-bold">
                    {project.node_modules_size_mb ? `${project.node_modules_size_mb} MB` : '0 MB'}
                  </span>
                </div>

                {Boolean(project.has_node_modules) && (
                  <button
                    type="button"
                    onClick={handleCleanCache}
                    disabled={cleaningCache}
                    className="w-full mt-2 btn btn-outline border-zinc-800 hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400 text-xs py-2 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 size={13} />
                    <span>{cleaningCache ? (locale === 'ar' ? 'جارٍ التنظيف...' : 'Purging...') : (locale === 'ar' ? 'حذف node_modules لتوفير المساحة' : 'Purge node_modules')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: DEV SERVER & LIVE LOGS & AI FIX */}
      {activeTab === 'dev' && (
        <div className="space-y-6">
          {/* Controls Deck */}
          <div className="p-5 rounded-2xl bg-[#060606] border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Terminal size={17} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  {locale === 'ar' ? 'تشغيل السيرفر بدون فتح المحرر' : 'Direct Dev Server Runner'}
                </h3>
              </div>

              {isRunningDev ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                  <span>ONLINE {devPid ? `(PID: ${devPid})` : ''}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border border-zinc-800 bg-zinc-900/60 text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-zinc-600" />
                  <span>STOPPED</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-8">
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  {locale === 'ar' ? 'أمر التشغيل' : 'Execution Command'}
                </label>
                <input
                  type="text"
                  value={devCommand}
                  onChange={(e) => setDevCommand(e.target.value)}
                  placeholder="npm run dev"
                  className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-cyan-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-4 flex items-end gap-2 pt-5">
                <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-zinc-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDevMode('hidden')}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                      devMode === 'hidden' ? 'bg-cyan-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {locale === 'ar' ? 'صامت' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevMode('terminal')}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                      devMode === 'terminal' ? 'bg-cyan-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {locale === 'ar' ? 'نافذة' : 'Terminal'}
                  </button>
                </div>

                {isRunningDev ? (
                  <button
                    type="button"
                    onClick={handleStopDev}
                    disabled={stoppingDev}
                    className="flex-1 btn bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Square size={14} />
                    <span>{stoppingDev ? 'Stopping...' : (locale === 'ar' ? 'إيقاف السيرفر' : 'Stop Server')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartDev}
                    disabled={startingDev}
                    className="flex-1 btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Play size={14} />
                    <span>{startingDev ? 'Starting...' : (locale === 'ar' ? 'تشغيل السيرفر' : 'Launch Server')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Realtime Logs Screen */}
          <div className="p-5 rounded-2xl bg-[#060606] border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Terminal size={14} className="text-zinc-400" />
                <span>{locale === 'ar' ? 'مخرجات وسجلات السيرفر المباشرة' : 'Live Dev Server Output'}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Ask AI to Fix Error Button */}
                <button
                  type="button"
                  onClick={handleAskAiFix}
                  disabled={aiDiagnosing || !serverLogs.trim()}
                  className="btn bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs py-1 px-3 rounded-lg flex items-center gap-1.5 font-mono transition"
                >
                  <Sparkles size={12} className={aiDiagnosing ? 'animate-spin' : ''} />
                  <span>{locale === 'ar' ? 'تحليل الخطأ بالذكاء الاصطناعي' : 'Ask AI to Fix'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => project.path && fetchLogs(project.path)}
                  disabled={loadingLogs}
                  className="btn btn-secondary text-xs py-1 px-2.5 border border-zinc-800 hover:bg-zinc-900"
                >
                  <RefreshCw size={12} className={loadingLogs ? 'animate-spin text-cyan-400' : 'text-zinc-400'} />
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-black border border-zinc-900 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-[380px] leading-relaxed whitespace-pre-wrap">
              {serverLogs || (locale === 'ar' ? 'لا توجد سجلات حالياً. ابدأ تشغيل السيرفر بالوضع الصامت لرؤية المخرجات هنا.' : 'No active logs. Launch the server in hidden mode to capture logs here.')}
            </pre>
          </div>
        </div>
      )}

      {/* 5. TAB 3: PROJECT FILE EXPLORER */}
      {activeTab === 'files' && (
        <div className="p-5 rounded-2xl bg-[#060606] border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Folder size={16} className="text-cyan-400" />
              <span>{locale === 'ar' ? 'هيكل ملفات المشروع' : 'Project Directory Tree'}</span>
            </h3>
            <span className="text-xs font-mono text-zinc-500">{fileItems.length} items</span>
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {fileItems.map((item, idx) => (
              <div
                key={`${item.path}-${idx}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 text-xs font-mono transition"
                style={{ paddingInlineStart: `${Math.max(8, item.depth * 20)}px` }}
              >
                <div className="flex items-center gap-2 truncate">
                  {item.type === 'dir' ? (
                    <Folder size={14} className="text-cyan-400 shrink-0" />
                  ) : (
                    <FileCode size={14} className="text-zinc-400 shrink-0" />
                  )}
                  <span className={item.type === 'dir' ? 'text-white font-semibold' : 'text-zinc-300'}>
                    {item.name}
                  </span>
                </div>

                {item.size !== undefined && item.size > 0 && (
                  <span className="text-zinc-600 text-[10px]">
                    {item.size > 1024 ? `${Math.round(item.size / 1024)} KB` : `${item.size} B`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB 4: VERSIONED ZIP SNAPSHOTS (Consolidated Backups) */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Archive size={18} className="text-amber-400" />
                <span>{locale === 'ar' ? 'خزينة النسخ الاحتياطية وإصدارات ZIP' : 'Project Versioned ZIP Snapshots'}</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {locale === 'ar'
                  ? 'يتم ضغط المشروع في ملف ZIP نقي مع استثناء node_modules و .git لحفظ مساحة القرص.'
                  : 'Clean ZIP archives excluding node_modules and bulky caches for instant restoration.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenBackupVault}
                className="btn btn-secondary border border-zinc-800 text-xs py-2 px-3 hover:bg-zinc-900"
                title="Open Folder"
              >
                <Folder size={14} />
                <span className="hidden sm:inline">{locale === 'ar' ? 'فتح مجلد الخزينة' : 'Open Vault'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCreateSnapshotModal(true)}
                className="btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2 px-4 rounded-lg flex items-center gap-2 transition"
              >
                <Archive size={14} />
                <span>{locale === 'ar' ? 'إنشاء لقطة جديدة (ZIP)' : 'Create Snapshot'}</span>
              </button>
            </div>
          </div>

          {/* Snapshots List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {snapshots.map((snap) => (
              <div
                key={snap.zip_filename}
                className="p-5 rounded-xl bg-[#060606] border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {snap.version_tag}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1.5 truncate max-w-[280px]">
                        {snap.zip_filename}
                      </h4>
                    </div>
                    <span className="font-mono text-xs text-zinc-400 font-bold bg-zinc-900 px-2 py-1 rounded">
                      {snap.size_mb} MB
                    </span>
                  </div>

                  {snap.note && (
                    <p className="text-xs text-zinc-300 bg-black/50 p-2.5 rounded-lg border border-zinc-900 mb-3">
                      {snap.note}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>{snap.file_count} files</span>
                    <span>{snap.timestamp_formatted}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-zinc-900">
                  <button
                    type="button"
                    onClick={() => handleRestoreSnapshot(snap)}
                    className="btn btn-outline border-zinc-800 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <RotateCcw size={12} />
                    <span>{locale === 'ar' ? 'استعادة هذه النسخة' : 'Restore'}</span>
                  </button>
                </div>
              </div>
            ))}

            {snapshots.length === 0 && (
              <div className="col-span-2 text-center py-12 p-6 rounded-xl bg-[#060606] border border-dashed border-zinc-800">
                <Archive size={36} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-xs text-zinc-400">
                  {locale === 'ar' ? 'لا توجد لقطات ZIP مسجلة لهذا المشروع حتى الآن.' : 'No snapshots recorded for this project yet.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TAB 5: PROJECT-SPECIFIC SETTINGS */}
      {activeTab === 'settings' && (
        <div className="p-6 rounded-2xl bg-[#060606] border border-zinc-800/80 space-y-6 max-w-3xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <SettingsIcon size={16} className="text-cyan-400" />
              <span>{locale === 'ar' ? 'إعدادات المشروع المخصصة' : 'Project-Level Configuration'}</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {locale === 'ar'
                ? 'تخصيص المحرر وأمر التشغيل والمتغيرات الخاصة بهذا المشروع فقط.'
                : 'Overrides global settings specifically for this project workspace.'}
            </p>
          </div>

          <div className="space-y-4">
            {/* Custom IDE Override */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {locale === 'ar' ? 'المحرر المخصص لهذا المشروع' : 'Preferred IDE Override'}
              </label>
              <select
                value={projectIdeOverride[project.id] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setProjectIdeOverride((prev) => ({ ...prev, [project.id]: val }));
                  notify(locale === 'ar' ? 'تم حفظ المحرر المخصص للمشروع' : 'Project IDE updated');
                }}
                className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">{locale === 'ar' ? `استخدام الافتراضي العام (${defaultIde})` : `Use Global Default (${defaultIde})`}</option>
                {customIdes.map((ide) => (
                  <option key={ide.id} value={ide.id}>
                    {ide.name} ({ide.command})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Run Command */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {locale === 'ar' ? 'أمر التشغيل الدائم' : 'Default Dev Command'}
              </label>
              <input
                type="text"
                value={devCommand}
                onChange={(e) => setDevCommand(e.target.value)}
                placeholder="e.g. pnpm run dev --port 4000"
                className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-cyan-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Custom Env Vars */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {locale === 'ar' ? 'ملاحظات بيئة العمل والمتغيرات' : 'Environment & Execution Notes'}
              </label>
              <textarea
                rows={4}
                value={projectEnvVars[project.id] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setProjectEnvVars((prev) => ({ ...prev, [project.id]: val }));
                }}
                placeholder="PORT=3000&#10;NODE_ENV=development"
                className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-zinc-300 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AI DIAGNOSIS & CODE FIX */}
      {showDiagnosisModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowDiagnosisModal(false);
          }}
        >
          <div className="modal panel max-w-2xl w-full bg-[#0a0a0a] border border-zinc-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Bug size={17} className="text-cyan-400" />
                <span>{locale === 'ar' ? 'تشخيص الخطأ وحلول الإصلاح (AI Debugger)' : 'AI Error Diagnosis & Fix'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosisModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {aiDiagnosing ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw size={28} className="animate-spin text-cyan-400 mx-auto" />
                <p className="text-xs text-zinc-400">
                  {locale === 'ar' ? 'جارٍ تحليل سجلات الأخطاء وتجهيز الحلول بالذكاء الاصطناعي...' : 'Diagnosing stack trace and generating instant fix instructions...'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                <pre className="p-4 rounded-xl bg-black border border-zinc-900 text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {aiDiagnosisResult}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE SNAPSHOT */}
      {showCreateSnapshotModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCreateSnapshotModal(false);
          }}
        >
          <div className="modal panel max-w-lg w-full bg-[#0a0a0a] border border-zinc-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Archive size={17} className="text-cyan-400" />
                <span>{locale === 'ar' ? 'إنشاء لقطة ZIP للمشروع' : 'Create Project ZIP Snapshot'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSnapshotModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1.5">
                  {locale === 'ar' ? 'رقم الإصدار (SemVer)' : 'Version Tag'}
                </label>
                <input
                  type="text"
                  value={snapshotTag}
                  onChange={(e) => setSnapshotTag(e.target.value)}
                  placeholder="v1.0.0"
                  className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1.5">
                  {locale === 'ar' ? 'ملاحظة التعديل (Commit Note)' : 'Snapshot Note'}
                </label>
                <textarea
                  rows={3}
                  value={snapshotNote}
                  onChange={(e) => setSnapshotNote(e.target.value)}
                  placeholder={locale === 'ar' ? 'ما الجديد في هذا الإصدار؟' : 'Describe the modifications in this version...'}
                  className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateSnapshotModal(false)}
                  className="btn btn-ghost text-xs px-4 py-2 text-zinc-400 hover:text-white"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleCreateSnapshot}
                  disabled={creatingSnapshot}
                  className="btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs px-5 py-2 rounded-lg transition"
                >
                  {creatingSnapshot ? (locale === 'ar' ? 'جارٍ الضغط...' : 'Zipping...') : (locale === 'ar' ? 'ضغط وحفظ الآن' : 'Create Snapshot')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
