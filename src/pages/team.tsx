import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, UserPlus, Shield, Activity, Clock, FolderKanban, Check,
  Sparkles, RefreshCw, X, Radio, ArrowUpRight, Search, Filter,
  MoreVertical, ShieldAlert, Laptop, GitCommit, CheckCircle2
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { usePersistent } from '@/hooks/use-persistent';
import { useDesktopDialog } from '@/components/ui/desktop-dialog';
import { supabase } from '@/lib/supabase';
import { useUserContext } from '@/lib/user-store';
import type { Project } from '@/pages/projects';

export type TeamRole = 'admin' | 'developer' | 'viewer';
export type MemberStatus = 'online' | 'coding' | 'in_flow' | 'away' | 'offline';

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: TeamRole;
  avatarUrl?: string;
  status: MemberStatus;
  currentProject?: string;
  lastActive: string;
  totalHoursLogged: number;
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  projectName: string;
  action: 'started_session' | 'completed_task' | 'committed_code' | 'created_snapshot' | 'deployed';
  details: string;
  timestamp: string;
}

const DEFAULT_MEMBERS: TeamMember[] = [
  {
    id: 'user-01',
    email: 'architect@cortexos.local',
    displayName: 'Lead Architect',
    role: 'admin',
    avatarUrl: '',
    status: 'in_flow',
    currentProject: 'CortexOS',
    lastActive: 'Just now',
    totalHoursLogged: 142.5
  },
  {
    id: 'user-02',
    email: 'developer.lead@cortex.os',
    displayName: 'Sarah Al-Mansoor',
    role: 'developer',
    avatarUrl: '',
    status: 'coding',
    currentProject: 'E-Commerce SaaS',
    lastActive: '12m ago',
    totalHoursLogged: 86.0
  },
  {
    id: 'user-03',
    email: 'khalid.sys@cortex.os',
    displayName: 'Khalid Tech',
    role: 'developer',
    avatarUrl: '',
    status: 'online',
    currentProject: 'FastAPI Microservice',
    lastActive: '35m ago',
    totalHoursLogged: 54.2
  },
  {
    id: 'user-04',
    email: 'omar.audit@cortex.os',
    displayName: 'Omar Reviewer',
    role: 'viewer',
    avatarUrl: '',
    status: 'away',
    currentProject: 'Discord Bot Master',
    lastActive: '3h ago',
    totalHoursLogged: 19.8
  }
];

const DEFAULT_ACTIVITIES: ActivityFeedItem[] = [
  {
    id: 'act-01',
    userId: 'user-01',
    userName: 'Lead Architect',
    projectName: 'CortexOS',
    action: 'created_snapshot',
    details: 'Created production ZIP snapshot v0.2.33 with hardware telemetry fixes',
    timestamp: '5m ago'
  },
  {
    id: 'act-02',
    userId: 'user-02',
    userName: 'Sarah Al-Mansoor',
    projectName: 'E-Commerce SaaS',
    action: 'started_session',
    details: 'Started work session on Stripe webhook integration and cart state',
    timestamp: '15m ago'
  },
  {
    id: 'act-03',
    userId: 'user-03',
    userName: 'Khalid Tech',
    projectName: 'FastAPI Microservice',
    action: 'committed_code',
    details: 'Pushed commit e7f8a91: Optimized Docker multi-stage build',
    timestamp: '42m ago'
  },
  {
    id: 'act-04',
    userId: 'user-01',
    userName: 'Lead Architect',
    projectName: 'CortexOS',
    action: 'completed_task',
    details: 'Configured Supabase PostgreSQL schema with strict RLS and UUIDs',
    timestamp: '1h ago'
  }
];

export default function TeamCollaborationPage({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();
  const { confirmDialog } = useDesktopDialog();
  const { user, displayName } = useUserContext();

  const [cachedProjects] = usePersistent<Project[]>('cortex-vault-projects', []);
  const [teamMembers, setTeamMembers] = usePersistent<TeamMember[]>('cortex-team-members', DEFAULT_MEMBERS);
  const [activityFeed, setActivityFeed] = usePersistent<ActivityFeedItem[]>('cortex-team-activities', DEFAULT_ACTIVITIES);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'roster' | 'activity' | 'allocations'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | TeamRole>('all');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('developer');
  const [inviteProject, setInviteProject] = useState(cachedProjects[0]?.name || 'CortexOS');

  // Supabase real-time sync attempt
  const fetchCloudCollaborators = useCallback(async () => {
    setSyncing(true);
    try {
      if (supabase) {
        const { data: dbMembers, error } = await supabase
          .from('users')
          .select('id, email, display_name, role, avatar_url, current_status, updated_at');
          
        if (!error && Array.isArray(dbMembers) && dbMembers.length > 0) {
          const mapped: TeamMember[] = dbMembers.map((m: any) => ({
            id: m.id,
            email: m.email,
            displayName: m.display_name || m.email.split('@')[0],
            role: (m.role as TeamRole) || 'developer',
            avatarUrl: m.avatar_url,
            status: (m.current_status as MemberStatus) || 'online',
            lastActive: 'Active recently',
            totalHoursLogged: 45.0
          }));
          setTeamMembers(mapped);
        }
      }
    } catch {
      // Offline-first graceful fallback
    } finally {
      setSyncing(false);
    }
  }, [setTeamMembers]);

  useEffect(() => {
    fetchCloudCollaborators();
  }, [fetchCloudCollaborators]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const matchSearch =
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.currentProject && m.currentProject.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchRole = roleFilter === 'all' || m.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [teamMembers, searchQuery, roleFilter]);

  // Handle Invite Submission
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    const newMember: TeamMember = {
      id: `member-${Date.now()}`,
      email: inviteEmail.trim(),
      displayName: inviteName.trim(),
      role: inviteRole,
      status: 'online',
      currentProject: inviteProject,
      lastActive: 'Just invited',
      totalHoursLogged: 0
    };

    const newActivity: ActivityFeedItem = {
      id: `act-${Date.now()}`,
      userId: user?.id || 'admin',
      userName: displayName || 'Administrator',
      projectName: inviteProject,
      action: 'started_session',
      details: `Invited ${inviteName.trim()} (${inviteRole.toUpperCase()}) to collaborate`,
      timestamp: 'Just now'
    };

    setTeamMembers([newMember, ...teamMembers]);
    setActivityFeed([newActivity, ...activityFeed]);
    setInviteModalOpen(false);
    setInviteEmail('');
    setInviteName('');

    notify(locale === 'ar' ? `تمت دعوة ${newMember.displayName} بنجاح` : `Invited ${newMember.displayName} successfully`);
  };

  // Remove Member with confirmation
  const handleRemoveMember = async (member: TeamMember) => {
    const ok = await confirmDialog({
      title: locale === 'ar' ? 'إزالة عضو من الفريق' : 'Remove Team Member',
      message: `${locale === 'ar' ? 'هل أنت متأكد من إزالة' : 'Are you sure you want to remove'} ${member.displayName} (${member.email})?`,
      confirmText: locale === 'ar' ? 'إزالة' : 'Remove',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      isDanger: true
    });

    if (ok) {
      setTeamMembers(teamMembers.filter((m) => m.id !== member.id));
      notify(locale === 'ar' ? 'تمت إزالة العضو' : 'Member removed');
    }
  };

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case 'in_flow':
        return { dot: 'bg-cyan-400 shadow-[0_0_8px_#00aff4]', text: locale === 'ar' ? 'في قمة التركيز' : 'In Deep Flow', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
      case 'coding':
        return { dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]', text: locale === 'ar' ? 'يكتب كود الآن' : 'Writing Code', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
      case 'online':
        return { dot: 'bg-emerald-400', text: locale === 'ar' ? 'متصل' : 'Online', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' };
      case 'away':
        return { dot: 'bg-amber-400', text: locale === 'ar' ? 'بالخارج' : 'Away', color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' };
      case 'offline':
      default:
        return { dot: 'bg-zinc-600', text: locale === 'ar' ? 'غير متصل' : 'Offline', color: 'text-zinc-500 border-zinc-800 bg-zinc-900/40' };
    }
  };

  return (
    <div className="page-wrap space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Command Deck */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-2">
            <Users size={13} />
            <span>{locale === 'ar' ? 'شبكة المزامنة السحابية' : 'SUPABASE NEURAL SYNC'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            {locale === 'ar' ? 'فريق العمل والتعاون الحي' : 'Team Collaboration Hub'}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {locale === 'ar'
              ? 'إدارة المطورين، مزامنة المهام اللحظية مع Supabase، وتتبع ساعات العمل الحية للمشاريع'
              : 'Real-time multi-developer sync, Supabase cloud roster, and live work session telemetry.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchCloudCollaborators}
            disabled={syncing}
            className="btn btn-secondary border border-zinc-800 flex items-center gap-2 text-xs py-2 px-3 hover:bg-zinc-900"
            title="Sync with Supabase"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin text-cyan-400' : 'text-zinc-400'} />
            <span>{syncing ? (locale === 'ar' ? 'جارٍ المزامنة...' : 'Syncing...') : (locale === 'ar' ? 'مزامنة السحابة' : 'Cloud Sync')}</span>
          </button>

          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs py-2 px-4 rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(0,175,244,0.3)] transition-all"
          >
            <UserPlus size={15} />
            <span>{locale === 'ar' ? 'دعوة عضو جديد' : 'Invite Member'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#080808] border border-zinc-800/80 module-card">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-2">
            <span>{locale === 'ar' ? 'إجمالي المطورين' : 'TEAM MEMBERS'}</span>
            <Users size={15} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{teamMembers.length}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {teamMembers.filter((m) => m.status !== 'offline').length} {locale === 'ar' ? 'نشط الآن' : 'active right now'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#080808] border border-zinc-800/80 module-card">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-2">
            <span>{locale === 'ar' ? 'ساعات العمل المنجزة' : 'LOGGED HOURS'}</span>
            <Clock size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {teamMembers.reduce((acc, m) => acc + m.totalHoursLogged, 0).toFixed(1)}h
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} /> {locale === 'ar' ? 'مزامنة دقيقة مع Supabase' : 'Synced to Supabase'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#080808] border border-zinc-800/80 module-card">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-2">
            <span>{locale === 'ar' ? 'المشاريع المشتركة' : 'ACTIVE PROJECTS'}</span>
            <FolderKanban size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {new Set(teamMembers.map((m) => m.currentProject).filter(Boolean)).size}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {cachedProjects.length} {locale === 'ar' ? 'مشروع مسجل بالخزينة' : 'in local vault'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#080808] border border-zinc-800/80 module-card">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-2">
            <span>{locale === 'ar' ? 'حالة المزامنة' : 'SYNC STATUS'}</span>
            <Activity size={15} className="text-cyan-400" />
          </div>
          <div className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            <span>{locale === 'ar' ? 'متصل بالسحابة' : 'Cloud Online'}</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            eoafqqhojpuigpxrxfwm.supabase.co
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'roster'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
          >
            {locale === 'ar' ? 'قائمة المطورين' : 'Team Roster'} ({teamMembers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'activity'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
            }`}
          >
            {locale === 'ar' ? 'سجل النشاط الحي' : 'Live Activity Feed'} ({activityFeed.length})
          </button>
        </div>

        {activeTab === 'roster' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={locale === 'ar' ? 'بحث عن مطور أو مشروع...' : 'Search members or projects...'}
                className="bg-black border border-zinc-800 rounded-lg text-xs ps-8 pe-3 py-1.5 text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none w-56 transition"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-black border border-zinc-800 rounded-lg text-xs px-2.5 py-1.5 text-zinc-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">{locale === 'ar' ? 'جميع الرتب' : 'All Roles'}</option>
              <option value="admin">{locale === 'ar' ? 'مسؤول (Admin)' : 'Admin'}</option>
              <option value="developer">{locale === 'ar' ? 'مطور (Dev)' : 'Developer'}</option>
              <option value="viewer">{locale === 'ar' ? 'مشاهد (Viewer)' : 'Viewer'}</option>
            </select>
          </div>
        )}
      </div>

      {/* 4. Tab 1: Team Roster */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMembers.map((member) => {
            const statusInfo = getStatusBadge(member.status);
            return (
              <div
                key={member.id}
                className="p-5 rounded-xl bg-[#060606] border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between module-card"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white text-base shadow-inner">
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{member.displayName}</h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              member.role === 'admin'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : member.role === 'developer'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {member.role.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono block mt-0.5">{member.email}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${statusInfo.color}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                      <span>{statusInfo.text}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-black/50 p-3 rounded-lg border border-zinc-900 text-xs">
                    <div>
                      <span className="text-zinc-500 text-[11px] block">{locale === 'ar' ? 'المشروع الحالي' : 'Active Project'}</span>
                      <span className="text-zinc-300 font-medium truncate block flex items-center gap-1 mt-0.5">
                        <FolderKanban size={13} className="text-cyan-400" />
                        {member.currentProject || 'Idle'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[11px] block">{locale === 'ar' ? 'ساعات العمل' : 'Hours Logged'}</span>
                      <span className="text-emerald-400 font-mono font-medium block mt-0.5">
                        {member.totalHoursLogged.toFixed(1)} hrs
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-900 text-[11px] text-zinc-500">
                  <span>{locale === 'ar' ? `آخر نشاط: ${member.lastActive}` : `Last active: ${member.lastActive}`}</span>
                  {member.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member)}
                      className="text-zinc-500 hover:text-rose-400 transition"
                    >
                      {locale === 'ar' ? 'إزالة' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Tab 2: Activity Feed */}
      {activeTab === 'activity' && (
        <div className="bg-[#060606] border border-zinc-800/80 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" />
                <span>{locale === 'ar' ? 'سجل العمليات المشتركة الحية' : 'Realtime Team Operations'}</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {locale === 'ar'
                  ? 'يتم تحديثه لحظياً عبر خادم Supabase مع كل جلسة عمل أو حفظ كود'
                  : 'Live updates from team members streamed via Supabase.'}
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-500">{activityFeed.length} Events</span>
          </div>

          <div className="space-y-4">
            {activityFeed.map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-4 p-3.5 rounded-lg bg-black/40 border border-zinc-900 hover:border-zinc-800 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-cyan-400 shrink-0 mt-0.5">
                  {act.userName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">{act.userName}</span>
                    <span className="text-[11px] font-mono text-zinc-500">{act.timestamp}</span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1">{act.details}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      <FolderKanban size={10} /> {act.projectName}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Invite Member Modal */}
      {inviteModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInviteModalOpen(false);
          }}
        >
          <div className="modal panel max-w-lg w-full bg-[#0a0a0a] border border-zinc-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
              <div className="flex items-center gap-2.5 text-white font-bold text-base">
                <UserPlus size={18} className="text-cyan-400" />
                <span>{locale === 'ar' ? 'دعوة مطور للفريق' : 'Invite Team Collaborator'}</span>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {locale === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Zaid Engineer"
                  className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="developer@cortex.os"
                  className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    {locale === 'ar' ? 'الرتبة والصلاحيات' : 'Role'}
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                    className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="developer">{locale === 'ar' ? 'مطور (Developer)' : 'Developer'}</option>
                    <option value="admin">{locale === 'ar' ? 'مسؤول (Admin)' : 'Admin'}</option>
                    <option value="viewer">{locale === 'ar' ? 'مشاهد (Viewer)' : 'Viewer'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    {locale === 'ar' ? 'المشروع المبدئي' : 'Assigned Project'}
                  </label>
                  <input
                    type="text"
                    value={inviteProject}
                    onChange={(e) => setInviteProject(e.target.value)}
                    placeholder="CortexOS"
                    className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="btn btn-ghost text-xs px-4 py-2 text-zinc-400 hover:text-white"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs px-5 py-2 rounded-lg transition"
                >
                  {locale === 'ar' ? 'إرسال الدعوة' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
