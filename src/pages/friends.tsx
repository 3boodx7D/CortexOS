import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, UserPlus, Search, Check, X, Clock, Radio, MessageSquare,
  Copy, CheckCheck, Trash2, ArrowUpRight, ArrowDownLeft, Shield,
  RefreshCw, Sparkles, Terminal, Activity, Zap
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useUserContext, type UserStatus } from '@/lib/user-store';
import { supabase } from '@/lib/supabase';

interface FriendProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url?: string;
  bio?: string;
  current_status: UserStatus;
  updated_at?: string;
}

interface FriendshipItem {
  friendshipId: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  isSender: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  profile: FriendProfile;
}

// In-memory 60s TTL cache to prevent repeated REST database queries
let friendsMemoryCache: { data: FriendshipItem[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000;

export default function FriendsPage() {
  const { t, locale } = useTranslation();
  const { user, userId, email: currentUserEmail, displayName: currentUserName, currentStatus, setCurrentStatus } = useUserContext();

  const [friendships, setFriendships] = useState<FriendshipItem[]>(() => friendsMemoryCache?.data || []);
  const [loading, setLoading] = useState(!friendsMemoryCache);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);

  // Add Friend Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copied feedback helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch friendships from Supabase with 60s cache
  const fetchFriendships = useCallback(async (force = false) => {
    if (!userId || userId === 'guest') return;

    if (!force && friendsMemoryCache && Date.now() - friendsMemoryCache.timestamp < CACHE_TTL_MS) {
      setFriendships(friendsMemoryCache.data);
      setLoading(false);
      return;
    }

    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      // Query all friendships where current user is sender or receiver
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          notes,
          created_at,
          updated_at
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setFriendships([]);
        friendsMemoryCache = { data: [], timestamp: Date.now() };
        return;
      }

      // Collect target user IDs to batch-fetch profiles
      const targetUserIds = Array.from(new Set(
        data.map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id))
      ));

      // Fetch user profiles in a single query
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id, email, display_name, role, avatar_url, bio, current_status, updated_at')
        .in('id', targetUserIds);

      if (usersErr) throw usersErr;

      const userMap = new Map<string, FriendProfile>();
      (usersData || []).forEach((u) => {
        userMap.set(u.id, u as FriendProfile);
      });

      // Construct rich items
      const items: FriendshipItem[] = data.map((row) => {
        const isSender = row.sender_id === userId;
        const otherUserId = isSender ? row.receiver_id : row.sender_id;
        const fallbackProfile: FriendProfile = {
          id: otherUserId,
          email: 'developer@cortex.os',
          display_name: 'Developer',
          role: 'developer',
          current_status: 'offline',
        };
        const profile = userMap.get(otherUserId) || fallbackProfile;

        return {
          friendshipId: row.id,
          status: row.status as any,
          isSender,
          notes: row.notes || '',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          profile,
        };
      });

      setFriendships(items);
      friendsMemoryCache = { data: items, timestamp: Date.now() };
    } catch (err) {
      console.warn('Could not fetch friends from Supabase:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchFriendships();
  }, [fetchFriendships]);

  // Real-time WebSocket subscriptions for friendships & users status
  useEffect(() => {
    if (!userId || userId === 'guest') return;

    // 1. Friendships Channel (listen for new, accepted, or deleted requests)
    const friendshipsChannel = supabase
      .channel(`cortex-friendships-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          // Invalidate cache and refetch cleanly
          fetchFriendships(true);
        }
      )
      .subscribe();

    // 2. Users Status Channel (listen for live status changes from peers)
    const usersPresenceChannel = supabase
      .channel(`cortex-presence-realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          const updatedUser = payload.new as any;
          if (!updatedUser) return;

          setFriendships((prev) => {
            let modified = false;
            const next = prev.map((item) => {
              if (item.profile.id === updatedUser.id) {
                modified = true;
                return {
                  ...item,
                  profile: {
                    ...item.profile,
                    display_name: updatedUser.display_name || item.profile.display_name,
                    role: updatedUser.role || item.profile.role,
                    avatar_url: updatedUser.avatar_url || item.profile.avatar_url,
                    current_status: (updatedUser.current_status || 'offline') as UserStatus,
                  },
                };
              }
              return item;
            });

            if (modified && friendsMemoryCache) {
              friendsMemoryCache = { data: next, timestamp: Date.now() };
            }
            return modified ? next : prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendshipsChannel);
      supabase.removeChannel(usersPresenceChannel);
    };
  }, [userId, fetchFriendships]);

  // Action: Send Friend Request
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);
    const rawInput = targetEmail.trim();
    if (!rawInput) return;

    const cleanHandle = rawInput.replace(/^@/, '').toLowerCase().trim();
    const cleanEmail = rawInput.toLowerCase().trim();

    if (cleanEmail === currentUserEmail.toLowerCase() || cleanHandle === (currentUserName || '').toLowerCase()) {
      setFormFeedback({ type: 'error', message: t('friends.cannotAddSelf') });
      return;
    }

    setSendingRequest(true);
    try {
      // Find receiver user in public.users by email, UUID, or username handle
      let targetUser: any = null;

      // 1. Search by exact username handle
      if (!targetUser && cleanHandle) {
        const { data } = await supabase
          .from('users')
          .select('id, email, display_name, settings')
          .eq('settings->>username', cleanHandle)
          .maybeSingle();
        if (data) targetUser = data;
      }

      // 2. Search by UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanEmail);
      if (!targetUser && isUUID) {
        const { data } = await supabase.from('users').select('id, email, display_name, settings').eq('id', cleanEmail).maybeSingle();
        if (data) targetUser = data;
      }

      // 3. Search by exact Email
      if (!targetUser && cleanEmail.includes('@') && cleanEmail.includes('.')) {
        const { data } = await supabase.from('users').select('id, email, display_name, settings').eq('email', cleanEmail).maybeSingle();
        if (data) targetUser = data;
      }

      // 4. Fuzzy search by email prefix or display name
      if (!targetUser) {
        const { data } = await supabase
          .from('users')
          .select('id, email, display_name, settings')
          .or(`email.ilike.${cleanHandle}@%,display_name.ilike.${cleanHandle}`)
          .limit(1)
          .maybeSingle();
        if (data) targetUser = data;
      }

      if (!targetUser || targetUser.id === userId) {
        setFormFeedback({
          type: 'error',
          message: targetUser?.id === userId ? t('friends.cannotAddSelf') : t('friends.userNotFound'),
        });
        setSendingRequest(false);
        return;
      }

      // Check if already friends or requested
      const alreadyExists = friendships.some(
        (f) => f.profile.id === targetUser.id && (f.status === 'accepted' || f.status === 'pending')
      );
      if (alreadyExists) {
        setFormFeedback({ type: 'error', message: t('friends.alreadyFriends') });
        setSendingRequest(false);
        return;
      }

      // Send request
      const { error: insertErr } = await supabase.from('friendships').insert({
        sender_id: userId,
        receiver_id: targetUser.id,
        status: 'pending',
        notes: requestNote.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertErr) throw insertErr;

      setFormFeedback({ type: 'success', message: t('friends.requestSent') });
      setTargetEmail('');
      setRequestNote('');
      fetchFriendships(true);

      setTimeout(() => {
        setAddModalOpen(false);
        setFormFeedback(null);
      }, 1400);
    } catch (err: any) {
      setFormFeedback({ type: 'error', message: err?.message || 'Failed to send request' });
    } finally {
      setSendingRequest(false);
    }
  };

  // Action: Accept Friend Request
  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId);

      if (error) throw error;
      fetchFriendships(true);
    } catch (err) {
      console.warn('Failed to accept friendship:', err);
    }
  };

  // Action: Decline / Cancel / Remove
  const handleRemoveFriendship = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;
      fetchFriendships(true);
    } catch (err) {
      console.warn('Failed to delete friendship:', err);
    }
  };

  // Helper: Copy User ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Segregated Lists
  const acceptedFriends = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships]
  );
  const incomingRequests = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && !f.isSender),
    [friendships]
  );
  const outgoingRequests = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.isSender),
    [friendships]
  );

  const onlineFriendsCount = useMemo(
    () => acceptedFriends.filter((f) => f.profile.current_status !== 'offline').length,
    [acceptedFriends]
  );

  // Filtered Friends
  const filteredFriends = useMemo(() => {
    return acceptedFriends.filter((f) => {
      const nameMatch = f.profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.profile.email.toLowerCase().includes(searchQuery.toLowerCase());
      const onlineMatch = !onlineOnly || f.profile.current_status !== 'offline';
      return nameMatch && onlineMatch;
    });
  }, [acceptedFriends, searchQuery, onlineOnly]);

  // Status visual badge helper
  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return {
          dotClass: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
          pillClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          label: t('friends.statusOnline'),
        };
      case 'coding':
        return {
          dotClass: 'bg-cyan-400 shadow-[0_0_8px_#00aff4] animate-pulse',
          pillClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
          label: t('friends.statusCoding'),
        };
      case 'in_flow':
        return {
          dotClass: 'bg-sky-400 shadow-[0_0_8px_#38bdf8] animate-ping',
          pillClass: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
          label: t('friends.statusInFlow'),
        };
      case 'away':
        return {
          dotClass: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
          pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
          label: t('friends.statusAway'),
        };
      case 'offline':
      default:
        return {
          dotClass: 'bg-muted-foreground/50',
          pillClass: 'border-border bg-secondary text-muted-foreground',
          label: t('friends.statusOffline'),
        };
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* 1. Header & Live Sync Banner */}
      <div className="flex items-start justify-between flex-wrap gap-4 pb-2 border-b border-border">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[11px] font-mono tracking-wider w-fit uppercase">
            <Radio size={12} className="animate-pulse text-cyan-500 dark:text-cyan-400" />
            <span>{t('friends.eyebrow')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('friends.title')}
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            {t('friends.subtitle')}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Quick Switcher */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card shadow-xs text-xs font-mono">
            <span className="text-[11px] text-muted-foreground">My Status:</span>
            <select
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value as UserStatus)}
              className="bg-transparent text-foreground text-xs font-semibold cursor-pointer outline-none capitalize"
            >
              <option value="online" className="bg-popover text-foreground">Online</option>
              <option value="coding" className="bg-popover text-foreground">Writing Code</option>
              <option value="in_flow" className="bg-popover text-foreground">Deep Flow</option>
              <option value="away" className="bg-popover text-foreground">Away</option>
              <option value="offline" className="bg-popover text-foreground">Offline</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchFriendships(true)}
            disabled={refreshing}
            className="btn btn-outline text-xs h-9 px-3 gap-2 border-border"
            title="Refresh Friends"
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="btn btn-primary text-xs font-bold h-9 px-4 gap-2 shadow-sm"
          >
            <UserPlus size={14} />
            <span>{t('friends.addFriend')}</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm backdrop-blur flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {t('friends.totalFriends')}
            </span>
            <b className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {acceptedFriends.length}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-cyan-500 dark:text-cyan-400">
            <Users size={18} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm backdrop-blur flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {t('friends.onlineFriends')}
            </span>
            <b className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-2">
              {onlineFriendsCount}
              {onlineFriendsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
              )}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-emerald-600 dark:text-emerald-400">
            <Zap size={18} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm backdrop-blur flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {t('friends.incomingRequests')}
            </span>
            <b className={`text-xl font-bold font-mono mt-0.5 block ${
              incomingRequests.length > 0 ? 'text-amber-500 dark:text-amber-400 animate-pulse' : 'text-foreground'
            }`}>
              {incomingRequests.length}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-amber-500 dark:text-amber-400">
            <ArrowDownLeft size={18} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm backdrop-blur flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-muted-foreground block uppercase">
              {t('friends.outgoingRequests')}
            </span>
            <b className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {outgoingRequests.length}
            </b>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-muted-foreground">
            <ArrowUpRight size={18} />
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs & Search Controls */}
      <div className="flex flex-col gap-3 p-3 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('friends.tabFriends')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                {acceptedFriends.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('incoming')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'incoming'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('friends.tabIncoming')}</span>
              {incomingRequests.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 dark:text-amber-400 font-bold animate-pulse">
                  {incomingRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outgoing')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                activeTab === 'outgoing'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('friends.tabOutgoing')}</span>
              {outgoingRequests.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                  {outgoingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box & Online Filter */}
          {activeTab === 'all' && (
            <div className="flex items-center gap-2.5 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('friends.searchPlaceholder')}
                  className="w-full h-9 pl-9 pr-8 bg-secondary/60 text-xs border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 transition-all font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOnlineOnly(!onlineOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                  onlineOnly
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${onlineOnly ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-muted-foreground'}`} />
                <span>Online</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB 1: ACCEPTED FRIENDS ROSTER */}
      {activeTab === 'all' && (
        <>
          {filteredFriends.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFriends.map((item, idx) => {
                const badge = getStatusBadge(item.profile.current_status);
                const staggerClass = `stagger-${(idx % 8) + 1}`;
                const initial = item.profile.display_name.charAt(0).toUpperCase() || 'D';

                return (
                  <div
                    key={item.friendshipId}
                    className={`friend-card cinematic-cascade ${staggerClass} p-5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between gap-4 transition-all`}
                  >
                    {/* Top: Avatar, Name, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-foreground overflow-hidden">
                            {item.profile.avatar_url ? (
                              <img src={item.profile.avatar_url} alt={item.profile.display_name} className="w-full h-full object-cover" />
                            ) : (
                              initial
                            )}
                          </div>
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${badge.dotClass}`} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate max-w-[160px]">
                            {item.profile.display_name}
                          </h3>
                          <span className="text-[10.5px] font-mono text-muted-foreground truncate block max-w-[180px]" title={item.profile.email}>
                            {item.profile.email}
                          </span>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${badge.pillClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    {/* Middle: Bio / Working Note */}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">
                      {item.profile.bio || (locale === 'ar' ? 'مطور برمجيات وعضو في مجتمع CortexOS' : 'Software engineer & CortexOS neural operator.')}
                    </p>

                    {/* Bottom: Action Deck */}
                    <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                        <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
                          {item.profile.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyId(item.profile.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title={copiedId === item.profile.id ? t('friends.actionCopied') : t('friends.actionCopyId')}
                        >
                          {copiedId === item.profile.id ? <CheckCheck size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveFriendship(item.friendshipId)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title={t('friends.actionRemove')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state panel p-12 text-center flex flex-col items-center justify-center rounded-xl border border-dashed border-border gap-3">
              <Users size={38} className="text-muted-foreground" />
              <b className="text-base font-semibold text-foreground">{t('friends.emptyFriendsTitle')}</b>
              <p className="text-xs text-muted-foreground max-w-sm">{t('friends.emptyFriendsDesc')}</p>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="btn btn-primary text-xs h-9 px-4 gap-2 mt-2"
              >
                <UserPlus size={14} />
                <span>{t('friends.addFriend')}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* TAB 2: INCOMING REQUESTS */}
      {activeTab === 'incoming' && (
        <>
          {incomingRequests.length > 0 ? (
            <div className="flex flex-col gap-3">
              {incomingRequests.map((req) => (
                <div
                  key={req.friendshipId}
                  className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-foreground">
                      {req.profile.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <b className="text-sm text-foreground">{req.profile.display_name}</b>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                          {req.profile.role}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground block mt-0.5">
                        {req.profile.email}
                      </span>
                      {req.notes && (
                        <p className="text-xs text-foreground/80 italic mt-1 bg-secondary/50 p-2 rounded border border-border">
                          "{req.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req.friendshipId)}
                      className="btn text-xs h-8 px-3.5 gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-xs"
                    >
                      <Check size={14} />
                      <span>{t('friends.actionAccept')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFriendship(req.friendshipId)}
                      className="btn btn-outline text-xs h-8 px-3.5 gap-1.5 border-border hover:border-rose-500/40 hover:text-rose-500"
                    >
                      <X size={14} />
                      <span>{t('friends.actionDecline')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state panel p-12 text-center flex flex-col items-center justify-center rounded-xl border border-dashed border-border gap-3">
              <CheckCheck size={38} className="text-muted-foreground" />
              <b className="text-base font-semibold text-foreground">{t('friends.emptyIncomingTitle')}</b>
              <p className="text-xs text-muted-foreground max-w-sm">{t('friends.emptyIncomingDesc')}</p>
            </div>
          )}
        </>
      )}

      {/* TAB 3: OUTGOING REQUESTS */}
      {activeTab === 'outgoing' && (
        <>
          {outgoingRequests.length > 0 ? (
            <div className="flex flex-col gap-3">
              {outgoingRequests.map((req) => (
                <div
                  key={req.friendshipId}
                  className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-foreground">
                      {req.profile.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <b className="text-sm text-foreground">{req.profile.display_name}</b>
                      <span className="text-xs font-mono text-muted-foreground block mt-0.5">
                        {req.profile.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                      <Clock size={12} className="text-amber-500" />
                      <span>Pending response...</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFriendship(req.friendshipId)}
                      className="btn btn-outline text-xs h-8 px-3 border-border hover:text-rose-500 hover:border-rose-500/40"
                    >
                      {t('friends.actionCancel')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state panel p-12 text-center flex flex-col items-center justify-center rounded-xl border border-dashed border-border gap-3">
              <Clock size={38} className="text-muted-foreground" />
              <b className="text-base font-semibold text-foreground">{t('friends.emptyOutgoingTitle')}</b>
              <p className="text-xs text-muted-foreground max-w-sm">{t('friends.emptyOutgoingDesc')}</p>
            </div>
          )}
        </>
      )}

      {/* 5. Modal: Add Developer Friend */}
      {addModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setAddModalOpen(false); }}
        >
          <div className="modal panel page-in max-w-md w-full" role="dialog" aria-modal="true" aria-label={t('friends.modalTitle')}>
            <div className="modal-head flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-cyan-500 dark:text-cyan-400" />
                <h2 className="text-base font-bold text-foreground">{t('friends.modalTitle')}</h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost p-1.5 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-all"
                onClick={() => setAddModalOpen(false)}
              >
                <X size={17} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              {t('friends.modalDesc')}
            </p>

            <form onSubmit={handleSendRequest} className="flex flex-col gap-4 mt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  {locale === 'ar' ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username (@handle) or Email Address'}
                </label>
                <input
                  type="text"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder={locale === 'ar' ? '@username أو developer@cortex.os' : '@username or developer@cortex.os'}
                  required
                  className="editable-input text-xs font-mono"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  {t('friends.inputNote')}
                </label>
                <textarea
                  rows={3}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder={t('friends.notePlaceholder')}
                  className="editable-textarea text-xs"
                />
              </div>

              {formFeedback && (
                <div className={`p-2.5 rounded-lg text-xs font-medium ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}>
                  {formFeedback.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="btn btn-ghost text-xs h-9 px-3"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={sendingRequest || !targetEmail.trim()}
                  className="btn btn-primary text-xs h-9 px-4 gap-2"
                >
                  <UserPlus size={14} />
                  <span>{sendingRequest ? t('friends.sending') : t('friends.btnSend')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
