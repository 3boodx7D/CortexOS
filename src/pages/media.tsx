import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronRight, Disc3, Download, FolderOpen, Heart, Loader2,
  Music2, Pause, Play, Plus, RefreshCw, Repeat, Repeat1,
  Search, Shuffle, SkipBack, SkipForward, Trash2, Volume2, VolumeX,
  ExternalLink, ListMusic, Check, Layers, X, ChevronLeft, FolderPlus,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useMusicPlayer, type MusicTrack } from '@/lib/music-player';
import { pickDirectory } from '@/lib/tauri';
import { apiPost } from '@/lib/api-client';
import { useDesktopDialog } from '@/components/ui/desktop-dialog';

type Tab = 'all' | 'favorites' | 'playlists';

function isPlaylistUrl(url: string): boolean {
  if (!url) return false;
  return /[?&]list=/.test(url) || /\/playlist\b/.test(url);
}

function cleanMusicUrl(url: string, stripPlaylist = false): string {
  try {
    const trimmed = url.trim();
    if (!trimmed) return '';
    const parsed = new URL(trimmed);
    const listId = parsed.searchParams.get('list');

    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (id) {
        if (!stripPlaylist && listId) {
          return `https://www.youtube.com/watch?v=${id}&list=${listId}`;
        }
        return `https://youtu.be/${id}`;
      }
    }
    if ((parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtube-nocookie.com')) && parsed.pathname.includes('/watch')) {
      const v = parsed.searchParams.get('v');
      if (v) {
        if (!stripPlaylist && listId) {
          return `https://www.youtube.com/watch?v=${v}&list=${listId}`;
        }
        return `https://www.youtube.com/watch?v=${v}`;
      }
    }
    if ((parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtube-nocookie.com')) && parsed.pathname.includes('/playlist')) {
      if (listId) return `https://www.youtube.com/playlist?list=${listId}`;
    }
    if (parsed.hostname.includes('youtube.com') && parsed.pathname.includes('/shorts/')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[0] === 'shorts') {
        return `https://www.youtube.com/watch?v=${parts[1]}`;
      }
    }
    return trimmed;
  } catch {
    return url.trim();
  }
}

function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s,]+)/g;
  const matches = text.match(urlRegex) || [];
  const cleaned = matches.map((u) => cleanMusicUrl(u, false)).filter(Boolean);
  return Array.from(new Set(cleaned));
}

export default function Media({ notify }: { notify: (msg: string) => void }) {
  const { t, locale } = useTranslation();
  const player = useMusicPlayer();
  const [tab, setTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchInput, setBatchInput] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExpandingPlaylist, setIsExpandingPlaylist] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistPopoverTrack, setPlaylistPopoverTrack] = useState<string | null>(null);
  const { confirmDialog } = useDesktopDialog();
  const downloadInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const fmt = (s: number) => {
    const sec = Math.floor(s);
    if (sec < 3600) return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
    return `${Math.floor(sec / 3600)}:${Math.floor((sec % 3600) / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  const filteredTracks = player.tracks.filter((track) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q);
  });

  const favoriteTracks = filteredTracks.filter((t) => player.isFavorite(t.filename));

  const displayTracks = tab === 'favorites' ? favoriteTracks : filteredTracks;

  // ── Download Flow ──────────────────────────────────────────────────────────

  const handlePreview = useCallback(async (customUrl?: string) => {
    const targetUrl = cleanMusicUrl(customUrl || downloadUrl);
    if (!targetUrl) return;
    setIsPreviewing(true);
    setPreview(null);
    try {
      const result = await player.previewUrl(targetUrl);
      if (result.ok) {
        setPreview(result);
      } else {
        notify(result.error || (locale === 'ar' ? 'فشل في استخراج المعلومات' : 'Failed to extract info'));
      }
    } catch {
      notify(locale === 'ar' ? 'فشل في الاتصال' : 'Connection failed');
    } finally {
      setIsPreviewing(false);
    }
  }, [downloadUrl, player, notify, locale]);

  const handleDownload = useCallback(async () => {
    if (!downloadUrl.trim()) return;

    // Auto-detect and expand playlist
    if (isPlaylistUrl(downloadUrl)) {
      setIsPreviewing(true);
      notify(locale === 'ar' ? 'جارٍ استخراج أغاني القائمة...' : 'Extracting playlist tracks...');
      const pl = await player.expandPlaylist(downloadUrl, 50);
      setIsPreviewing(false);
      if (pl.ok && pl.tracks && pl.tracks.length > 1) {
        const trackUrls = pl.tracks.map((t) => t.url);
        setDownloadUrl('');
        setPreview(null);
        notify(locale === 'ar' ? `تم استخراج ${trackUrls.length} أغنية وبدء التنزيل المتزامن!` : `Extracted ${trackUrls.length} tracks! Starting download...`);
        await player.downloadBatch(trackUrls);
        return;
      }
    }

    const targetUrl = cleanMusicUrl(downloadUrl, true);
    if (!targetUrl) return;
    const songPreview = preview;
    setDownloadUrl('');
    setPreview(null);
    notify(locale === 'ar' ? 'بدأ التنزيل وأُضيفت الأغنية للقائمة' : 'Download queued');
    const result = await player.downloadFromUrl(targetUrl, 'best', {
      title: songPreview?.title,
      artist: songPreview?.artist,
      thumbnail: songPreview?.thumbnail,
    });
    if (result.ok) {
      notify(locale === 'ar' ? `تم تنزيل "${result.title}" بنجاح` : `Downloaded "${result.title}" successfully`);
    } else {
      notify(result.error || (locale === 'ar' ? 'فشل في التنزيل' : 'Download failed'));
    }
  }, [downloadUrl, preview, player, notify, locale]);

  const handleDownloadPlaylist = useCallback(async () => {
    if (!preview || !preview.playlist_tracks || preview.playlist_tracks.length === 0) return;
    const trackUrls = preview.playlist_tracks.map((t: any) => t.url);
    const count = trackUrls.length;
    setDownloadUrl('');
    setPreview(null);
    notify(locale === 'ar' ? `تمت إضافة ${count} أغنية إلى طابور التنزيل` : `Queued ${count} tracks for download`);
    await player.downloadBatch(trackUrls);
  }, [preview, player, notify, locale]);

  const handleDownloadSingleFromPlaylist = useCallback(async () => {
    if (!downloadUrl) return;
    const targetUrl = cleanMusicUrl(downloadUrl, true);
    const songPreview = preview;
    setDownloadUrl('');
    setPreview(null);
    notify(locale === 'ar' ? 'بدأ التنزيل وأُضيفت الأغنية للقائمة' : 'Download queued');
    const result = await player.downloadFromUrl(targetUrl, 'best', {
      title: songPreview?.title,
      artist: songPreview?.artist,
      thumbnail: songPreview?.thumbnail,
    });
    if (result.ok) {
      notify(locale === 'ar' ? `تم تنزيل "${result.title}" بنجاح` : `Downloaded "${result.title}" successfully`);
    }
  }, [downloadUrl, preview, player, notify, locale]);

  const handleExpandBatchPlaylists = useCallback(async () => {
    const urls = extractUrls(batchInput);
    if (urls.length === 0) return;
    setIsExpandingPlaylist(true);
    notify(locale === 'ar' ? 'جارٍ استخراج أغاني القوائم...' : 'Extracting playlist tracks...');
    try {
      const expandedUrls: string[] = [];
      for (const u of urls) {
        if (isPlaylistUrl(u)) {
          const res = await player.expandPlaylist(u, 50);
          if (res.ok && res.tracks && res.tracks.length > 0) {
            expandedUrls.push(...res.tracks.map((t) => t.url));
          } else {
            expandedUrls.push(u);
          }
        } else {
          expandedUrls.push(u);
        }
      }
      setBatchInput(Array.from(new Set(expandedUrls)).join('\n'));
      notify(locale === 'ar' ? `تم استخراج ${expandedUrls.length} أغنية بنجاح!` : `Expanded to ${expandedUrls.length} tracks!`);
    } catch {
      notify(locale === 'ar' ? 'فشل في استخراج القائمة' : 'Failed to expand playlist');
    } finally {
      setIsExpandingPlaylist(false);
    }
  }, [batchInput, player, notify, locale]);

  const handleBatchDownload = useCallback(async () => {
    const urls = extractUrls(batchInput);
    if (urls.length === 0) return;

    let finalUrls: string[] = [];
    setIsExpandingPlaylist(true);

    try {
      for (const url of urls) {
        if (isPlaylistUrl(url)) {
          notify(locale === 'ar' ? 'جارٍ استخراج قائمة التشغيل...' : 'Extracting playlist tracks...');
          const pl = await player.expandPlaylist(url, 50);
          if (pl.ok && pl.tracks && pl.tracks.length > 0) {
            finalUrls.push(...pl.tracks.map((t) => t.url));
            notify(locale === 'ar' ? `تم استخراج ${pl.tracks.length} أغنية من "${pl.title}"` : `Extracted ${pl.tracks.length} tracks from "${pl.title}"`);
          } else {
            finalUrls.push(cleanMusicUrl(url, true));
          }
        } else {
          finalUrls.push(url);
        }
      }
    } catch {
      finalUrls = urls;
    } finally {
      setIsExpandingPlaylist(false);
    }

    finalUrls = Array.from(new Set(finalUrls)).filter(Boolean);

    if (finalUrls.length === 0) return;
    notify(locale === 'ar' ? `بدء تنزيل ${finalUrls.length} أغانٍ متزامنة...` : `Starting download of ${finalUrls.length} songs...`);
    setBatchInput('');
    setIsBatchMode(false);
    await player.downloadBatch(finalUrls);
  }, [batchInput, player, notify, locale]);

  const handleUrlPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted) {
      const urls = extractUrls(pasted);
      if (urls.length > 1) {
        // Auto-switch to batch mode when pasting multiple URLs
        setIsBatchMode(true);
        setBatchInput(urls.join('\n'));
        notify(locale === 'ar' ? `تم اكتشاف ${urls.length} روابط وتحويلك للتحميل المتعدد` : `Detected ${urls.length} URLs! Switched to batch mode`);
        return;
      }
      if (urls.length === 1) {
        const cleaned = urls[0];
        setTimeout(() => {
          setDownloadUrl(cleaned);
          setIsPreviewing(true);
          setPreview(null);
          player.previewUrl(cleaned).then((result) => {
            if (result.ok) setPreview(result);
            setIsPreviewing(false);
          }).catch(() => setIsPreviewing(false));
        }, 50);
      }
    }
  }, [player, notify, locale]);

  // ── Browse Folder ──────────────────────────────────────────────────────────

  const handleBrowseFolder = useCallback(async () => {
    setIsBrowsing(true);
    try {
      const selected = await pickDirectory();
      if (selected) {
        await player.setMusicDirectory(selected);
        notify(locale === 'ar' ? `مسار الموسيقى: ${selected}` : `Music folder set to: ${selected}`);
      }
    } finally {
      setIsBrowsing(false);
    }
  }, [player, notify, locale]);

  const handleOpenFolder = useCallback(async () => {
    try {
      await apiPost('/music/open-folder', {});
    } catch {
      // silent
    }
  }, []);

  // ── Create Playlist ────────────────────────────────────────────────────────

  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await player.createPlaylist(newPlaylistName.trim());
      notify(locale === 'ar' ? `تم إنشاء "${newPlaylistName}"` : `Created "${newPlaylistName}"`);
      setNewPlaylistName('');
      setShowNewPlaylist(false);
    } catch {
      notify(locale === 'ar' ? 'فشل في إنشاء القائمة' : 'Failed to create playlist');
    }
  }, [newPlaylistName, player, notify, locale]);

  // ── Playlist Management & Track Deletion ────────────────────────────────────

  const handleDeleteTrack = useCallback(async (track: MusicTrack) => {
    const ok = await confirmDialog({
      title: t('media.confirmDeleteTitle'),
      message: t('media.confirmDelete'),
      confirmText: locale === 'ar' ? 'حذف من القرص' : 'Delete from Disk',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      variant: 'danger',
      isDanger: true,
    });
    if (ok) {
      const success = await player.deleteTrack(track.filename);
      if (success) {
        notify(t('media.trackDeleted'));
      } else {
        notify(t('media.trackDeleteFailed'));
      }
    }
  }, [confirmDialog, player, t, locale, notify]);

  const handleDeletePlaylist = useCallback(async (name: string) => {
    const ok = await confirmDialog({
      title: t('media.confirmDeletePlaylistTitle'),
      message: t('media.confirmDeletePlaylist'),
      confirmText: locale === 'ar' ? 'حذف القائمة' : 'Delete Playlist',
      cancelText: locale === 'ar' ? 'إلغاء' : 'Cancel',
      variant: 'danger',
      isDanger: true,
    });
    if (ok) {
      await player.deletePlaylist(name);
      if (selectedPlaylist === name) setSelectedPlaylist(null);
      notify(locale === 'ar' ? `تم حذف "${name}"` : `Deleted "${name}"`);
    }
  }, [confirmDialog, player, selectedPlaylist, t, locale, notify]);

  const handleToggleTrackInPlaylist = useCallback(async (playlistName: string, filename: string) => {
    const plFiles = player.playlists[playlistName] || [];
    if (plFiles.includes(filename)) {
      await player.removeFromPlaylist(playlistName, filename);
      notify(`${t('media.removedFromPlaylist')} "${playlistName}"`);
    } else {
      await player.addToPlaylist(playlistName, filename);
      notify(`${t('media.addedToPlaylist')} "${playlistName}"`);
    }
  }, [player, t, notify]);

  useEffect(() => {
    if (!playlistPopoverTrack) return;
    const onDocClick = () => setPlaylistPopoverTrack(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [playlistPopoverTrack]);

  // ── Seek handler ───────────────────────────────────────────────────────────

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    player.seek(Number(e.target.value));
  }, [player]);

  const seekPercent = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="music-lounge">
      {/* Header */}
      <div className="section-title">
        <div>
          <div className="eyebrow mono">{t('media.eyebrow')}</div>
          <h1>{t('media.title')}</h1>
          <p>{t('media.subtitle')}</p>
        </div>
        <span className="context-chip"><Disc3 size={14} />{t('media.localPlayback')}</span>
      </div>

        {/* Download Section */}
        <div className="glass-surface music-download-card">
          {!isBatchMode ? (
            <div className="music-download-bar">
              <input
                ref={downloadInputRef}
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                onPaste={handleUrlPaste}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDownload(); }}
                placeholder={t('media.pastePlaceholder')}
                data-testid="input-music-url"
              />
              <button
                type="button"
                className="music-batch-toggle-btn"
                onClick={() => setIsBatchMode(true)}
                title={t('media.batchMode')}
                data-testid="button-toggle-batch"
              >
                <Layers size={13} />
                <span>{t('media.batchMode')}</span>
              </button>
              <button
                className="music-dl-btn"
                onClick={handleDownload}
                disabled={!downloadUrl.trim()}
                data-testid="button-music-download"
              >
                {isPreviewing ? <Loader2 size={14} className="animate-spin text-cyan" /> : <Download size={14} />}
                <span>{isPreviewing
                  ? t('media.downloadChecking')
                  : preview
                    ? t('media.downloadNow')
                    : t('media.downloadSong')
                }</span>
              </button>
            </div>
          ) : (
            <div className="music-batch-panel">
              <div className="music-batch-header">
                <div className="music-batch-header-title">
                  <Layers size={14} className="text-cyan" />
                  <b>{t('media.batchMode')}</b>
                </div>
                <button
                  type="button"
                  className="music-folder-btn"
                  onClick={() => { setIsBatchMode(false); setBatchInput(''); }}
                >
                  <X size={12} />
                  <span>{locale === 'ar' ? 'إغلاق' : 'Close'}</span>
                </button>
              </div>
              <textarea
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder={t('media.batchPlaceholder')}
                className="music-batch-textarea"
                rows={3}
                data-testid="textarea-batch-urls"
                autoFocus
              />
              <div className="music-batch-footer">
                <div className="music-batch-count">
                  <span className="mono">
                    {extractUrls(batchInput).length} {t('media.urlsDetected')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {extractUrls(batchInput).some(isPlaylistUrl) && (
                    <button
                      type="button"
                      className="music-batch-toggle-btn"
                      onClick={handleExpandBatchPlaylists}
                      disabled={isExpandingPlaylist}
                      title={t('media.expandPlaylist')}
                    >
                      {isExpandingPlaylist ? <Loader2 size={12} className="animate-spin text-cyan" /> : <Layers size={12} className="text-cyan" />}
                      <span>{isExpandingPlaylist ? t('media.expandingPlaylist') : t('media.expandPlaylist')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="music-dl-btn"
                    onClick={handleBatchDownload}
                    disabled={extractUrls(batchInput).length === 0 || isExpandingPlaylist}
                    data-testid="button-batch-download-start"
                  >
                    <Download size={14} />
                    <span>{`${t('media.downloadAll')} (${extractUrls(batchInput).length})`}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Downloads Queue List */}
          {player.downloadQueue.length > 0 && (
            <div className="music-download-queue">
              <div className="music-queue-header">
                <div className="music-queue-title">
                  <Layers size={13} className="text-cyan" />
                  <b>{t('media.activeQueue')}</b>
                  <span className="music-queue-badge mono">
                    {player.downloadQueue.filter((t) => t.status === 'downloading' || t.status === 'queued').length > 0
                      ? `${player.downloadQueue.filter((t) => t.status === 'downloading' || t.status === 'queued').length} ${t('media.downloading')}`
                      : t('media.allFinished')}
                  </span>
                </div>
                {player.downloadQueue.some((t) => t.status === 'complete' || t.status === 'error') && (
                  <button
                    type="button"
                    className="music-folder-btn"
                    onClick={player.clearFinishedDownloads}
                  >
                    {t('media.clearCompleted')}
                  </button>
                )}
              </div>
              <div className="music-queue-list">
                {player.downloadQueue.slice(0, 8).map((task) => (
                  <div key={task.id} className={`music-queue-item is-${task.status}`}>
                    <div className="music-queue-item-icon">
                      {task.status === 'downloading' ? (
                        <Loader2 size={14} className="animate-spin text-cyan" />
                      ) : task.status === 'complete' ? (
                        <Check size={14} className="text-cyan" />
                      ) : task.status === 'error' ? (
                        <X size={14} className="text-red" />
                      ) : (
                        <Layers size={14} style={{ opacity: 0.5 }} />
                      )}
                    </div>
                    <div className="music-queue-item-meta">
                      <b>{task.title}</b>
                      {task.artist && <small>{task.artist}</small>}
                      {task.status === 'downloading' && (
                        <div className="music-queue-item-bar">
                          <div className="music-queue-item-fill" style={{ width: `${task.progress}%` }} />
                        </div>
                      )}
                      {task.status === 'error' && (
                        <small style={{ color: '#ef4444' }}>{task.error || t('media.downloadError')}</small>
                      )}
                    </div>
                    <div className="music-queue-item-actions">
                      {task.status === 'downloading' && (
                        <span className="mono music-queue-percent">{task.progress}%</span>
                      )}
                      {task.status === 'complete' && (
                        <button
                          type="button"
                          className="music-queue-play-btn"
                          onClick={() => {
                            const found = player.tracks.find(
                              (tr) => tr.filename === task.filename || tr.title === task.title
                            );
                            if (found) player.play(found);
                          }}
                          title={t('media.playNow')}
                        >
                          <Play size={10} />
                          <span>{t('media.playNow')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="music-queue-dismiss-btn"
                        onClick={() => player.dismissDownloadTask(task.id)}
                        aria-label="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlist preview card */}
          {preview && preview.is_playlist && !player.isDownloading && (
            <div className="music-playlist-preview-card">
              <div className="music-playlist-preview-header">
                <div className="music-playlist-preview-meta">
                  <div className="music-playlist-badge">
                    <Layers size={13} className="text-cyan" />
                    <b>{preview.playlist_title || preview.title}</b>
                  </div>
                  <span className="mono text-muted" style={{ fontSize: 11 }}>
                    {preview.playlist_count || preview.tracks?.length || 0} {t('media.playlistTracksFound')}
                  </span>
                </div>
                <div className="music-playlist-preview-actions">
                  <button
                    type="button"
                    className="music-dl-btn"
                    onClick={handleDownloadPlaylist}
                    data-testid="button-download-full-playlist"
                  >
                    <Download size={13} />
                    <span>{t('media.downloadFullPlaylist')} ({preview.playlist_count || preview.tracks?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    className="music-batch-toggle-btn"
                    onClick={handleDownloadSingleFromPlaylist}
                    title={t('media.downloadSingleOnly')}
                  >
                    <Music2 size={13} />
                    <span>{t('media.downloadSingleOnly')}</span>
                  </button>
                </div>
              </div>
              {preview.playlist_tracks && preview.playlist_tracks.length > 0 && (
                <div className="music-playlist-snippets">
                  {preview.playlist_tracks.slice(0, 4).map((tr: any, idx: number) => (
                    <div key={tr.id || idx} className="music-playlist-snippet-item">
                      <span className="mono music-playlist-snippet-idx">{idx + 1}</span>
                      <span className="music-playlist-snippet-title">{tr.title}</span>
                      <span className="music-playlist-snippet-artist">{tr.artist}</span>
                    </div>
                  ))}
                  {preview.playlist_tracks.length > 4 && (
                    <small className="text-muted" style={{ padding: '0 8px', fontSize: 10 }}>
                      +{preview.playlist_tracks.length - 4} more tracks...
                    </small>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Single Track Preview card */}
          {preview && !preview.is_playlist && !player.isDownloading && (
            <div className="dl-preview-card">
              {preview.thumbnail && (
                <img src={preview.thumbnail} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <div className="dl-preview-info">
                <b>{preview.title}</b>
                <small>{preview.artist} · {preview.duration_fmt}</small>
              </div>
              <Check size={14} className="text-cyan" />
            </div>
          )}
        </div>

      {/* Main Layout: Player + Library */}
      <div className="music-player-layout">
        {/* ── Now Playing Panel ── */}
        <div className="glass-surface-strong music-now-playing">
          {/* Disc / Cover Art */}
          <div className="music-disc-wrap">
            <div className={`music-disc-glow ${player.isPlaying ? 'is-active' : ''}`} />
            <div className={`music-disc ${player.isPlaying ? 'is-spinning' : player.currentTrack ? 'is-paused' : ''}`}>
              {player.currentTrack ? (
                <>
                  <img
                    key={player.currentTrack.filename}
                    src={player.getCoverUrl(player.currentTrack.filename)}
                    alt={player.currentTrack.title}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.music-disc-placeholder');
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <div className="music-disc-placeholder" style={{ display: 'none' }}>
                    <Music2 size={48} />
                  </div>
                </>
              ) : (
                <div className="music-disc-placeholder">
                  <Music2 size={48} />
                </div>
              )}
              <div className="music-disc-grooves" />
              <div className="music-disc-sheen" />
              <div className="music-disc-hole" />
            </div>
          </div>

          {/* Track info */}
          <div className="music-track-meta">
            <h2>{player.currentTrack?.title || t('media.noTrack')}</h2>
            <p>{player.currentTrack?.artist || t('media.selectSong')}</p>
          </div>

          {/* Seek bar */}
          <div className="music-seek-bar">
            <div className="music-seek-track">
              <div className="music-seek-fill" style={{ width: `${seekPercent}%` }} />
              <input
                type="range"
                className="music-seek-input"
                min={0}
                max={player.duration || 0}
                step={0.1}
                value={player.currentTime}
                onChange={handleSeek}
                aria-label="Seek"
                data-testid="input-music-seek"
              />
            </div>
            <div className="music-seek-times">
              <span>{fmt(player.currentTime)}</span>
              <span>{fmt(player.duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="music-controls">
            <button
              className={`music-ctrl-btn ${player.isShuffled ? 'is-active' : ''}`}
              onClick={() => player.toggleShuffle()}
              aria-label="Shuffle"
              data-testid="button-music-shuffle"
            >
              <Shuffle size={16} />
            </button>
            <button className="music-ctrl-btn" onClick={() => player.previous()} aria-label="Previous" data-testid="button-music-prev">
              <SkipBack size={18} />
            </button>
            <button
              className="music-ctrl-btn-play"
              onClick={() => player.togglePlay()}
              aria-label={player.isPlaying ? 'Pause' : 'Play'}
              data-testid="button-music-play"
            >
              {player.isLoading ? <Loader2 size={20} className="animate-spin" /> : player.isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="music-ctrl-btn" onClick={() => player.next()} aria-label="Next" data-testid="button-music-next">
              <SkipForward size={18} />
            </button>
            <button
              className={`music-ctrl-btn ${player.repeatMode !== 'none' ? 'is-active' : ''}`}
              onClick={() => player.toggleRepeat()}
              aria-label="Repeat"
              data-testid="button-music-repeat"
            >
              {player.repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>

          {/* Volume */}
          <div className="music-volume">
            <button className="music-ctrl-btn" onClick={() => player.toggleMute()} aria-label="Mute" style={{ width: 28, height: 28 }}>
              {player.isMuted || player.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={player.isMuted ? 0 : player.volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              aria-label="Volume"
              data-testid="input-music-volume"
            />
          </div>

          {/* Favorite button for current track */}
          {player.currentTrack && (
            <button
              className={`music-track-item-fav ${player.isFavorite(player.currentTrack.filename) ? 'is-fav' : ''}`}
              onClick={() => player.toggleFavorite(player.currentTrack!.filename)}
              aria-label="Favorite"
              data-testid="button-music-fav-current"
            >
              <Heart size={18} fill={player.isFavorite(player.currentTrack.filename) ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        {/* ── Library Panel ── */}
        <div className="glass-surface" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Folder bar */}
          <div className="music-folder-bar">
            <FolderOpen size={13} />
            <code title={player.musicDir}>{player.musicDir || '...'}</code>
            <button className="music-folder-btn" onClick={handleBrowseFolder} disabled={isBrowsing} data-testid="button-music-browse">
              {isBrowsing ? <Loader2 size={10} className="animate-spin" /> : <FolderOpen size={10} />}
              <span>{t('media.browse')}</span>
            </button>
            <button className="music-folder-btn" onClick={handleOpenFolder} data-testid="button-music-open-folder">
              <ExternalLink size={10} />
            </button>
            <button className="music-folder-btn" onClick={() => player.refreshLibrary()} data-testid="button-music-rescan">
              <RefreshCw size={10} />
            </button>
          </div>

          {/* Tabs */}
          <div className="music-tabs">
            <button className={`music-tab ${tab === 'all' ? 'is-active' : ''}`} onClick={() => setTab('all')} data-testid="button-tab-all">
              <Music2 size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
              {t('media.all')} <span className="mono" style={{ opacity: 0.5, marginInlineStart: 4 }}>{player.trackCount}</span>
            </button>
            <button className={`music-tab ${tab === 'favorites' ? 'is-active' : ''}`} onClick={() => setTab('favorites')} data-testid="button-tab-favorites">
              <Heart size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
              {t('media.favorites')}
            </button>
            <button className={`music-tab ${tab === 'playlists' ? 'is-active' : ''}`} onClick={() => setTab('playlists')} data-testid="button-tab-playlists">
              <ListMusic size={12} style={{ marginInlineEnd: 4, verticalAlign: -1 }} />
              {t('media.playlists')}
            </button>
          </div>

          {/* Action Bar */}
          <div className="music-actions-bar">
            <button className="music-action-btn" onClick={() => player.playAll()} data-testid="button-play-all">
              <Play size={12} />{t('media.playAll')}
            </button>
            <button className="music-action-btn" onClick={() => player.playAll(true)} data-testid="button-shuffle-all">
              <Shuffle size={12} />{t('media.shuffle')}
            </button>
            <Search size={13} style={{ color: 'hsl(var(--muted-foreground))', marginInlineStart: 'auto' }} />
            <input
              type="text"
              className="music-search-input"
              placeholder={t('media.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-music-search"
            />
          </div>

          {/* Track list / Favorites / Playlists */}
          {tab !== 'playlists' ? (
            <div className="music-track-list">
              {displayTracks.length === 0 ? (
                <div className="music-empty">
                  <Music2 size={40} />
                  <b>{tab === 'favorites' ? t('media.emptyFavorites') : t('media.emptyLibrary')}</b>
                  <small>{tab === 'favorites' ? t('media.emptyFavoritesSub') : t('media.emptyLibrarySub')}</small>
                </div>
              ) : (
                displayTracks.map((track) => (
                  <div
                    key={track.filename}
                    className={`music-track-item ${player.currentTrack?.filename === track.filename ? 'is-active' : ''}`}
                    onClick={() => player.play(track)}
                    data-testid={`button-track-${track.id}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { player.play(track); } }}
                  >
                    <div className="music-track-item-cover">
                      {player.currentTrack?.filename === track.filename && player.isPlaying ? (
                        <span className="music-playing-bars"><i /><i /><i /></span>
                      ) : (
                        <>
                          <img
                            src={player.getCoverUrl(track.filename)}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.music-cover-fallback');
                              if (fallback) (fallback as HTMLElement).style.display = 'flex';
                            }}
                          />
                          <div className="music-cover-fallback" style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                            <Music2 size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="music-track-item-info">
                      <b>{track.title}</b>
                      <small>{track.artist}</small>
                    </div>
                    <span className="music-track-item-duration">{track.duration_fmt}</span>
                    <div style={{ position: 'relative' }}>
                      <button
                        className={`music-track-item-playlist-btn ${playlistPopoverTrack === track.filename ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaylistPopoverTrack((prev) => (prev === track.filename ? null : track.filename));
                        }}
                        title={t('media.addToPlaylist')}
                        aria-label={t('media.addToPlaylist')}
                      >
                        <FolderPlus size={13} />
                      </button>
                      {playlistPopoverTrack === track.filename && (
                        <div
                          className="music-playlist-popover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--muted-foreground))', padding: '4px 8px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }}>
                            {t('media.addToPlaylist')}
                          </div>
                          {Object.keys(player.playlists).length === 0 ? (
                            <div style={{ padding: 8, fontSize: 11, opacity: 0.6, textAlign: 'center' }}>
                              {t('media.noPlaylistsYet')}
                            </div>
                          ) : (
                            Object.entries(player.playlists).map(([pName, pFiles]) => {
                              const inPl = pFiles.includes(track.filename);
                              return (
                                <button
                                  key={pName}
                                  className={`music-playlist-popover-item ${inPl ? 'in-playlist' : ''}`}
                                  onClick={() => handleToggleTrackInPlaylist(pName, track.filename)}
                                >
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {inPl ? '✓ ' : '+ '}{pName}
                                  </span>
                                  <span className="mono" style={{ fontSize: 10, opacity: 0.5 }}>{pFiles.length}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      className={`music-track-item-fav ${player.isFavorite(track.filename) ? 'is-fav' : ''}`}
                      onClick={(e) => { e.stopPropagation(); player.toggleFavorite(track.filename); }}
                      aria-label="Favorite"
                    >
                      <Heart size={14} fill={player.isFavorite(track.filename) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className="music-track-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrack(track);
                      }}
                      title={t('media.deleteTrack')}
                      aria-label={t('media.deleteTrack')}
                      data-testid={`button-delete-track-${track.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Playlists Tab */
            <div className="music-track-list">
              {selectedPlaylist ? (
                /* Selected Playlist View */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="music-action-btn"
                        onClick={() => setSelectedPlaylist(null)}
                        style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <ChevronLeft size={14} />
                        {t('media.backToPlaylists')}
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <b style={{ fontSize: 13, color: '#00aff4' }}>{selectedPlaylist}</b>
                        <span className="mono" style={{ fontSize: 10, opacity: 0.5 }}>
                          ({(player.playlists[selectedPlaylist] || []).length} {t('media.tracks')})
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(player.playlists[selectedPlaylist] || []).length > 0 && (
                        <button
                          className="music-action-btn"
                          onClick={() => {
                            const plFiles = player.playlists[selectedPlaylist] || [];
                            const first = player.tracks.find((t) => t.filename === plFiles[0]);
                            if (first) player.play(first);
                          }}
                          style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Play size={11} fill="currentColor" />
                          {t('media.playPlaylist')}
                        </button>
                      )}
                      <button
                        className="music-action-btn"
                        onClick={() => handleDeletePlaylist(selectedPlaylist)}
                        style={{ padding: '5px 8px', color: '#ef4444' }}
                        title={t('media.confirmDeletePlaylistTitle')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const plFilenames = player.playlists[selectedPlaylist] || [];
                    const plTracks = plFilenames
                      .map((fn) => player.tracks.find((t) => t.filename === fn))
                      .filter((t): t is MusicTrack => Boolean(t));

                    if (plTracks.length === 0) {
                      return (
                        <div className="music-empty">
                          <ListMusic size={36} />
                          <b>{t('media.emptyPlaylistTracks')}</b>
                          <small>{t('media.emptyPlaylistTracksSub')}</small>
                        </div>
                      );
                    }

                    return plTracks.map((track) => (
                      <div
                        key={track.filename}
                        className={`music-track-item ${player.currentTrack?.filename === track.filename ? 'is-active' : ''}`}
                        onClick={() => player.play(track)}
                      >
                        <div className="music-track-item-cover">
                          {player.currentTrack?.filename === track.filename && player.isPlaying ? (
                            <div className="music-playing-bars">
                              <i /><i /><i />
                            </div>
                          ) : (
                            <>
                              <img
                                src={player.getCoverUrl(track.filename)}
                                alt=""
                                className="music-track-item-cover-img"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.parentElement?.querySelector('.music-cover-fallback');
                                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                              />
                              <div className="music-cover-fallback" style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                <Music2 size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                              </div>
                            </>
                          )}
                        </div>
                        <div className="music-track-item-info">
                          <b>{track.title}</b>
                          <small>{track.artist}</small>
                        </div>
                        <span className="music-track-item-duration">{track.duration_fmt}</span>
                        <button
                          className="music-track-item-delete"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await player.removeFromPlaylist(selectedPlaylist, track.filename);
                            notify(`${t('media.removedFromPlaylist')} "${selectedPlaylist}"`);
                          }}
                          title={t('media.removeFromPlaylist')}
                          aria-label={t('media.removeFromPlaylist')}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                /* All Playlists List */
                <div>
                  {showNewPlaylist ? (
                    <div style={{ display: 'flex', gap: 8, padding: '8px 0', alignItems: 'center', marginBottom: 10 }}>
                      <input
                        type="text"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }}
                        placeholder={t('media.playlistName')}
                        className="music-search-input"
                        style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '6px 10px', flex: 1 }}
                        autoFocus
                        data-testid="input-new-playlist"
                      />
                      <button className="music-action-btn" onClick={handleCreatePlaylist}><Check size={12} /></button>
                    </div>
                  ) : (
                    <button className="music-action-btn" onClick={() => setShowNewPlaylist(true)} style={{ margin: '6px 0 12px' }} data-testid="button-new-playlist">
                      <Plus size={12} />{t('media.newPlaylist')}
                    </button>
                  )}

                  {Object.keys(player.playlists).length === 0 && !showNewPlaylist ? (
                    <div className="music-empty">
                      <ListMusic size={36} />
                      <b>{t('media.emptyPlaylists')}</b>
                      <small>{t('media.emptyPlaylistsSub')}</small>
                    </div>
                  ) : (
                    Object.entries(player.playlists).map(([name, files]) => (
                      <div
                        key={name}
                        className="music-playlist-row"
                        onClick={() => setSelectedPlaylist(name)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0, 175, 244, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ListMusic size={15} style={{ color: '#00aff4' }} />
                          </div>
                          <div>
                            <b style={{ fontSize: 13, display: 'block' }}>{name}</b>
                            <span className="mono" style={{ fontSize: 11, opacity: 0.5 }}>{files.length} {t('media.tracks')}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {files.length > 0 && (
                            <button
                              className="music-folder-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const firstTrack = player.tracks.find((t) => t.filename === files[0]);
                                if (firstTrack) player.play(firstTrack);
                              }}
                              title={t('media.playPlaylist')}
                            >
                              <Play size={11} fill="currentColor" />
                            </button>
                          )}
                          <button
                            className="music-folder-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(name);
                            }}
                            title={t('media.confirmDeletePlaylistTitle')}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
