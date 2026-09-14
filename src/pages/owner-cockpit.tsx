import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Crown, ShieldAlert, ShieldCheck, Users, FolderKanban, Activity, Database,
  RefreshCw, Search, Check, AlertCircle, Copy, ArrowLeft, UserCheck, Sparkles,
  Server, Lock, Key, ExternalLink, SlidersHorizontal, Terminal
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserContext, type UserStatus } from '@/lib/user-store';
import { supabase, checkSupabaseDetailedHealth, type SupabaseHealthReport } from '@/lib/supabase';

interface SupabaseUserRecord {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url?: string;
  bio?: string;
  current_status: UserStatus;
  settings?: any;
  created_at?: string;
  updated_at?: string;
}

export default function OwnerCockpit() {
  const { locale } = useTranslation();
  const [, setLocation] = useLocation();
  const { isOwner, email, displayName } = useUserContext();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usersList, setUsersList] = useState<SupabaseUserRecord[]>([]);
  const [projectsCount, setProjectsCount] = useState<number>(0);
  const [friendshipsCount, setFriendshipsCount] = useState<number>(0);
  const [collaboratorsCount, setCollaboratorsCount] = useState<number>(0);
  const [healthReport, setHealthReport] = useState<SupabaseHealthReport | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Security Gate: strictly restricted to cabdulrahman36@gmail.com
  const isStrictFounder = (email || '').toLowerCase().trim() === 'cabdulrahman36@gmail.com' && isOwner;

  const loadClusterData = useCallback(async (isRefresh = false) => {
    if (!isStrictFounder) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch all users
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!usersErr && users) {
        setUsersList(users as SupabaseUserRecord[]);
      }

      // 2. Fetch projects count
      const { count: pCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });
      if (typeof pCount === 'number') setProjectsCount(pCount);

      // 3. Fetch friendships count
      const { count: fCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true });
      if (typeof fCount === 'number') setFriendshipsCount(fCount);

      // 4. Fetch team collaborators count
      const { count: cCount } = await supabase
        .from('team_collaborators')
        .select('*', { count: 'exact', head: true });
      if (typeof cCount === 'number') setCollaboratorsCount(cCount);

      // 5. Health check
      const report = await checkSupabaseDetailedHealth(false);
      setHealthReport(report);
    } catch (err: any) {
      console.error('Failed to load owner data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStrictFounder]);

  useEffect(() => {
    if (isStrictFounder) {
      loadClusterData();
    }
  }, [isStrictFounder, loadClusterData]);

  // Update user role handler
  const handleUpdateRole = async (targetUserId: string, newRole: string) => {
    setChangingRoleId(targetUserId);
    setActionSuccess(null);
    setActionError(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (error) throw error;

      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
      );
      setActionSuccess(
        locale === 'ar'
          ? `تم تحديث صلاحية المستخدم بنجاح إلى: ${newRole}`
          : `User role updated successfully to: ${newRole}`
      );
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update user role');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setChangingRoleId(null);
    }
  };

  // Copy Schema RLS Fix SQL
  const handleCopySql = () => {
    const sql = `-- Fix RLS Recursion (42P17) in Supabase SQL Editor:
CREATE OR REPLACE FUNCTION public.check_is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.team_collaborators WHERE project_id = p_project_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.check_is_project_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.team_collaborators WHERE project_id = p_project_id AND user_id = p_user_id AND role IN ('admin', 'owner'));
$$;

CREATE OR REPLACE FUNCTION public.check_is_project_owner(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND owner_id = p_user_id);
$$;`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // If unauthorized: render strictly sealed screen
  if (!isStrictFounder) {
    return (
      <div className="page page-in flex flex-col items-center justify-center min-h-[75vh] px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-5 shadow-lg shadow-rose-500/10">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {locale === 'ar' ? '403 — الوصول محظور تماماً' : '403 — Access Strictly Restricted'}
        </h1>
        <p className="text-sm text-zinc-400 max-w-md leading-relaxed mb-6">
          {locale === 'ar'
            ? 'مركز تحكم المالك مخصص ومحمي حصرياً لمالك ومؤسس النظام (cabdulrahman36@gmail.com). حسابك الحالي لا يمتلك تصريح Root للوصول لهذه المنطقة.'
            : 'The Master Owner Cockpit is locked and restricted exclusively to the Platform Founder (cabdulrahman36@gmail.com). Your account lacks root authorization.'}
        </p>
        <button
          type="button"
          onClick={() => setLocation('/overview')}
          className="btn btn-outline border-zinc-700 hover:border-zinc-500 text-xs h-9 px-4 gap-2 focus-ring"
        >
          <ArrowLeft size={14} />
          <span>{locale === 'ar' ? 'العودة إلى لوحة القيادة' : 'Return to Overview'}</span>
        </button>
      </div>
    );
  }

  // Filtered Users List
  const filteredUsers = usersList.filter((u) => {
    const handle = (u.settings?.username || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      u.email.toLowerCase().includes(query) ||
      u.display_name.toLowerCase().includes(query) ||
      handle.includes(query) ||
      u.id.toLowerCase().includes(query);

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.current_status === statusFilter;

    return matchesQuery && matchesRole && matchesStatus;
  });

  return (
    <div className="page page-in max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="mb-6 p-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-zinc-950/80 to-cyan-500/10 shadow-xl shadow-amber-500/5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/25 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner p-3">
              <Crown size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  {locale === 'ar' ? 'مركز تحكم المالك والمؤسس' : 'Master Founder Cockpit'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase bg-amber-500/25 text-amber-300 border border-amber-500/50">
                  ROOT PRIVILEGES
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  cabdulrahman36@gmail.com
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                {locale === 'ar'
                  ? `مرحباً بك${displayName ? ` يا ${displayName}` : ''}. لوحة التحكم الحصرية لإدارة قاعدة بيانات سوبا بيس، التحكم برتب ومستخدمي كورتكس، ومراقبة حالة الكلاستر وقواعد الحماية RLS في الوقت الفعلي.`
                  : `Welcome${displayName ? `, ${displayName}` : ''}. Exclusive executive terminal for Supabase cloud cluster governance, user role modification, and real-time database telemetry.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadClusterData(true)}
              disabled={refreshing}
              className="btn btn-outline border-zinc-700 hover:border-zinc-500 text-xs h-9 px-3.5 gap-2 focus-ring"
            >
              <RefreshCw size={13} className={refreshing ? 'spin text-amber-400' : ''} />
              <span>{locale === 'ar' ? 'تحديث الكلاستر' : 'Refresh Cluster'}</span>
            </button>
            <button
              type="button"
              onClick={() => setLocation('/settings')}
              className="btn btn-ghost text-xs h-9 px-3 text-zinc-400 hover:text-white"
            >
              {locale === 'ar' ? 'الإعدادات' : 'Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
          <Check size={14} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{actionError}</span>
        </div>
      )}

      {/* 2. Key Metrics Cluster */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">
              {locale === 'ar' ? 'المستخدمون المسجلون' : 'Registered Users'}
            </span>
            <Users size={16} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{usersList.length}</div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {usersList.filter((u) => u.current_status !== 'offline').length} {locale === 'ar' ? 'متصل الآن' : 'online now'}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">
              {locale === 'ar' ? 'المشاريع السحابية' : 'Cloud Projects'}
            </span>
            <FolderKanban size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{projectsCount}</div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {locale === 'ar' ? 'مزامنة سحابية نشطة' : 'Active cloud workspaces'}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">
              {locale === 'ar' ? 'روابط الصداقة' : 'Friendships'}
            </span>
            <Activity size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{friendshipsCount}</div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {collaboratorsCount} {locale === 'ar' ? 'عضو فريق متعاون' : 'team collaborators'}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs uppercase font-mono tracking-wider">
              {locale === 'ar' ? 'استجابة الداتا بيس' : 'Database Latency'}
            </span>
            <Database size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono flex items-center gap-2">
            <span>{healthReport ? `${healthReport.latencyMs}ms` : '—'}</span>
            {healthReport && (
              <span
                className={`w-2 h-2 rounded-full ${
                  healthReport.latencyMs < 1000 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            )}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {healthReport?.dbOk ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check size={11} /> {locale === 'ar' ? 'جميع الجداول نشطة ومحمية' : 'All tables operational'}
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertCircle size={11} /> {locale === 'ar' ? 'يوجد تنبيه في الجداول' : 'Issues detected'}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 3. Main Content: User Directory & Management */}
      <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users size={17} className="text-cyan-400" />
              <span>{locale === 'ar' ? 'سجل المستخدمين وإدارة الصلاحيات' : 'User Directory & Role Governance'}</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {locale === 'ar'
                ? 'عرض جميع المطورين المسجلين في كورتكس مع إمكانية ترقية الصلاحيات مباشرة'
                : 'Manage registered users, inspect identity metadata, and elevate roles.'}
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute inset-inline-start-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={locale === 'ar' ? 'بحث بالاسم، الإيميل، أو @المعرف...' : 'Search name, email, @handle...'}
                className="editable-input text-xs h-8 pl-8 pr-3 w-56 bg-zinc-900/80 border-zinc-800"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="editable-input text-xs h-8 px-2 bg-zinc-900/80 border-zinc-800 text-zinc-300"
            >
              <option value="all">{locale === 'ar' ? 'جميع الأدوار' : 'All Roles'}</option>
              <option value="founder">Founder</option>
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="viewer">Viewer</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="editable-input text-xs h-8 px-2 bg-zinc-900/80 border-zinc-800 text-zinc-300"
            >
              <option value="all">{locale === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="online">Online</option>
              <option value="coding">Coding</option>
              <option value="in_flow">In Flow</option>
              <option value="away">Away</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 text-zinc-400 font-mono text-[11px] uppercase">
                <th className="py-2.5 text-start font-medium">{locale === 'ar' ? 'المستخدم' : 'User / Identity'}</th>
                <th className="py-2.5 text-start font-medium">{locale === 'ar' ? 'المعرف (@)' : 'Handle (@)'}</th>
                <th className="py-2.5 text-start font-medium">{locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                <th className="py-2.5 text-start font-medium">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="py-2.5 text-start font-medium">{locale === 'ar' ? 'الصلاحية (الرتبة)' : 'Role'}</th>
                <th className="py-2.5 text-end font-medium">{locale === 'ar' ? 'تعديل الصلاحية' : 'Modify Role'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono">
                    {locale === 'ar' ? 'لم يتم العثور على مستخدمين يطابقون البحث' : 'No users match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((userRow) => {
                  const isRowFounder = userRow.email.toLowerCase().trim() === 'cabdulrahman36@gmail.com';
                  const handle = userRow.settings?.username || (userRow as any).username || '—';

                  return (
                    <tr key={userRow.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white overflow-hidden text-xs">
                            {userRow.avatar_url ? (
                              <img src={userRow.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (userRow.display_name || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{userRow.display_name}</span>
                              {isRowFounder && (
                                <span title="System Founder">
                                  <Crown size={12} className="text-amber-400" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block">
                              {userRow.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 font-mono text-cyan-400">
                        {handle !== '—' ? `@${handle}` : '—'}
                      </td>

                      <td className="py-3 font-mono text-zinc-300 select-all">
                        {userRow.email}
                      </td>

                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            userRow.current_status === 'online'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : userRow.current_status === 'coding'
                              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              userRow.current_status === 'online'
                                ? 'bg-emerald-400'
                                : userRow.current_status === 'coding'
                                ? 'bg-cyan-400'
                                : 'bg-zinc-500'
                            }`}
                          />
                          {userRow.current_status}
                        </span>
                      </td>

                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase ${
                            userRow.role === 'founder'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : userRow.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}
                        >
                          {userRow.role}
                        </span>
                      </td>

                      <td className="py-3 text-end">
                        {isRowFounder ? (
                          <span className="text-[11px] text-amber-400/80 font-mono italic">
                            Immutable Root
                          </span>
                        ) : (
                          <select
                            disabled={changingRoleId === userRow.id}
                            value={userRow.role}
                            onChange={(e) => handleUpdateRole(userRow.id, e.target.value)}
                            className="editable-input text-xs h-7 px-2 bg-zinc-900 border-zinc-700 text-zinc-200 focus-ring"
                          >
                            <option value="developer">Developer</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                            <option value="founder">Founder</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. RLS Recursion & Schema Health Quick-Fix Panel */}
      <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/70">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Terminal size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {locale === 'ar' ? 'مساعد إصلاح سياسات الحماية وقواعد RLS' : 'RLS Security & Anti-Recursion Helper'}
              </h3>
              <p className="text-xs text-zinc-400">
                {locale === 'ar'
                  ? 'إذا ظهر لك الخطأ 42P17 في سوبا بيس، انسخ هذا الكود والصقه في SQL Editor لإصلاح الدوران اللانهائي'
                  : 'If Supabase flags error 42P17, copy and run these SECURITY DEFINER functions in Supabase SQL Editor.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopySql}
            className="btn btn-outline border-cyan-500/40 hover:border-cyan-400 text-cyan-300 text-xs h-8 px-3 gap-1.5 focus-ring"
          >
            {copiedSql ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedSql ? (locale === 'ar' ? 'تم النسخ!' : 'Copied!') : (locale === 'ar' ? 'نسخ كود SQL' : 'Copy SQL Fix')}</span>
          </button>
        </div>

        <div className="bg-black/60 p-3.5 rounded-xl border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
          <code>
            {`CREATE OR REPLACE FUNCTION public.check_is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.team_collaborators WHERE project_id = p_project_id AND user_id = p_user_id);
$$;`}
          </code>
        </div>
      </div>
    </div>
  );
}
