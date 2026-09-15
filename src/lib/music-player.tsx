/**
 * CortexOS Global Music Player Context
 * Provides persistent audio playback across page navigation,
 * Windows SMTC integration via navigator.mediaSession,
 * keyboard media key handling, favorites, and playlist management.
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { usePersistent } from '@/hooks/use-persistent';
import { apiGet, apiPost, apiFetch, buildApiUrl, getDaemonToken } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MusicTrack {
  id: string;
  filename: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  duration_fmt: string;
  size_mb: number;
  ext: string;
  has_cover: boolean;
  modified: number;
}

export interface DownloadResult {
  ok: boolean;
  error?: string;
  filename?: string;
  title?: string;
  artist?: string;
  duration?: number;
  duration_fmt?: string;
  download_id?: string;
}

export interface PlaylistTrackItem {
  id: string;
  url: string;
  title: string;
  artist: string;
  duration: number;
  duration_fmt: string;
  thumbnail?: string;
}

export interface PlaylistInfoResult {
  ok: boolean;
  is_playlist?: boolean;
  playlist_id?: string;
  title?: string;
  total_available?: number;
  track_count?: number;
  tracks?: PlaylistTrackItem[];
  error?: string;
}

export interface PreviewResult {
  ok: boolean;
  error?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  duration_fmt?: string;
  thumbnail?: string;
  is_playlist?: boolean;
  playlist_title?: string;
  playlist_count?: number;
  playlist_tracks?: PlaylistTrackItem[];
}

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  progress: number;
  status: 'queued' | 'downloading' | 'complete' | 'error';
  error?: string;
  filename?: string;
  timestamp: number;
}

export type RepeatMode = 'none' | 'all' | 'one';

interface MusicPlayerState {
  // Player state
  tracks: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  isLoading: boolean;

  // Library
  musicDir: string;
  trackCount: number;

  // Favorites & Playlists
  favorites: string[];
  playlists: Record<string, string[]>;

  // Download state & queue
  isDownloading: boolean;
  downloadProgress: number;
  downloadStatus: string;
  downloadQueue: DownloadTask[];

  // Actions
  play: (track?: MusicTrack) => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  playAll: (shuffle?: boolean) => void;

  // Library actions
  refreshLibrary: () => Promise<void>;
  setMusicDirectory: (path: string) => Promise<void>;
  deleteTrack: (filename: string) => Promise<boolean>;

  // Download actions
  previewUrl: (url: string) => Promise<PreviewResult>;
  expandPlaylist: (url: string, limit?: number) => Promise<PlaylistInfoResult>;
  downloadFromUrl: (url: string, quality?: string, initialInfo?: Partial<DownloadTask>) => Promise<DownloadResult>;
  downloadBatch: (urls: string[], quality?: string) => Promise<void>;
  dismissDownloadTask: (id: string) => void;
  clearFinishedDownloads: () => void;

  // Favorites & Playlists
  toggleFavorite: (filename: string) => void;
  isFavorite: (filename: string) => boolean;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (name: string) => Promise<void>;
  addToPlaylist: (playlist: string, filename: string) => Promise<void>;
  removeFromPlaylist: (playlist: string, filename: string) => Promise<void>;
  refreshPlaylists: () => Promise<void>;

  // Cover URL helper
  getCoverUrl: (filename: string) => string;
  getStreamUrl: (filename: string) => string;
}

const MusicPlayerContext = createContext<MusicPlayerState | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = usePersistent<number>('cortex-music-volume', 75);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = usePersistent<RepeatMode>('cortex-music-repeat', 'none');
  const [isShuffled, setIsShuffled] = usePersistent<boolean>('cortex-music-shuffle', false);
  const [isLoading, setIsLoading] = useState(false);
  const [musicDir, setMusicDir] = useState('');
  const [trackCount, setTrackCount] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Record<string, string[]>>({});
  const [downloadQueue, setDownloadQueue] = useState<DownloadTask[]>([]);

  const activeDownloads = downloadQueue.filter((t) => t.status === 'downloading' || t.status === 'queued');
  const isDownloading = activeDownloads.length > 0;
  const downloadProgress = activeDownloads.length > 0
    ? Math.round(activeDownloads.reduce((a, b) => a + b.progress, 0) / activeDownloads.length)
    : (downloadQueue.length > 0 && downloadQueue[0].status === 'complete' ? 100 : 0);
  const downloadStatus = isDownloading
    ? 'downloading'
    : downloadQueue.some((t) => t.status === 'complete')
      ? 'complete'
      : '';

  const handleTrackEndRef = useRef<() => void>(() => {});

  // ── Initialize Audio Element (singleton) ─────────────────────────────────

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    const audio = audioRef.current;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      handleTrackEndRef.current();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Volume sync ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // ── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    refreshLibrary();
    refreshFavorites();
    refreshPlaylists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigator MediaSession (Windows SMTC) ────────────────────────────────

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    const coverUrl = currentTrack.has_cover
      ? getCoverUrl(currentTrack.filename)
      : '';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || 'CortexOS Music',
      artwork: coverUrl
        ? [
            { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayInternal());
    navigator.mediaSession.setActionHandler('pause', () => pauseInternal());
    navigator.mediaSession.setActionHandler('previoustrack', () => previousInternal());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextInternal());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, isPlaying]);

  // Update playback state for Windows flyout
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // ── Keyboard shortcuts (global) ──────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Media keys work always (even in inputs)
      if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        togglePlayInternal();
        return;
      }
      if (e.key === 'MediaTrackNext') {
        e.preventDefault();
        nextInternal();
        return;
      }
      if (e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        previousInternal();
        return;
      }
      if (e.key === 'MediaStop') {
        e.preventDefault();
        pauseInternal();
        return;
      }

      // In-app shortcuts only when not in an input field
      if (isInput) return;

      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
        // Only intercept Space if we have a track loaded
        if (currentTrack) {
          e.preventDefault();
          togglePlayInternal();
        }
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        setIsMuted((prev) => !prev);
        return;
      }
      if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
        setVolumeState((prev: number) => Math.min(100, prev + 5));
        return;
      }
      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
        setVolumeState((prev: number) => Math.max(0, prev - 5));
        return;
      }
      if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        nextInternal();
        return;
      }
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        previousInternal();
        return;
      }
      if (e.key === 'ArrowRight' && !e.altKey && currentTrack && audioRef.current) {
        e.preventDefault();
        audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 5);
        return;
      }
      if (e.key === 'ArrowLeft' && !e.altKey && currentTrack && audioRef.current) {
        e.preventDefault();
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // ── Internal helpers ─────────────────────────────────────────────────────

  const getStreamUrl = useCallback((filename: string) => {
    const token = getDaemonToken();
    const tokenParam = token ? `&daemon_token=${encodeURIComponent(token)}` : '';
    return buildApiUrl(`/music/stream?file=${encodeURIComponent(filename)}${tokenParam}`);
  }, []);

  const getCoverUrl = useCallback((filename: string) => {
    const token = getDaemonToken();
    const tokenParam = token ? `&daemon_token=${encodeURIComponent(token)}` : '';
    return buildApiUrl(`/music/cover?file=${encodeURIComponent(filename)}${tokenParam}`);
  }, []);

  const playInternal = useCallback((track: MusicTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsLoading(true);
    const url = getStreamUrl(track.filename);
    if (audio.src !== url) {
      audio.src = url;
    }
    audio.load();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Playback error:', err);
        setIsLoading(false);
        setIsPlaying(false);
      });
    }
    setCurrentTrack(track);
    setIsPlaying(true);
  }, [getStreamUrl]);

  const pauseInternal = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlayInternal = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (!audio.src && tracks.length > 0) {
        playInternal(tracks[0]);
      } else {
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
    }
  }, [tracks, playInternal]);

  const getCurrentIndex = useCallback(() => {
    if (!currentTrack) return -1;
    return tracks.findIndex((t) => t.filename === currentTrack.filename);
  }, [currentTrack, tracks]);

  const nextInternal = useCallback(() => {
    if (tracks.length === 0) return;
    const idx = getCurrentIndex();
    if (isShuffled) {
      const randomIdx = Math.floor(Math.random() * tracks.length);
      playInternal(tracks[randomIdx]);
    } else {
      const nextIdx = (idx + 1) % tracks.length;
      playInternal(tracks[nextIdx]);
    }
  }, [tracks, getCurrentIndex, isShuffled, playInternal]);

  const previousInternal = useCallback(() => {
    if (tracks.length === 0) return;
    const audio = audioRef.current;
    // If more than 3 seconds in, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const idx = getCurrentIndex();
    const prevIdx = idx <= 0 ? tracks.length - 1 : idx - 1;
    playInternal(tracks[prevIdx]);
  }, [tracks, getCurrentIndex, playInternal]);

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } else if (repeatMode === 'all') {
      nextInternal();
    } else {
      // Normal 'none' mode: advance to next song unless we reached the end of the tracklist
      const idx = getCurrentIndex();
      if (idx >= 0 && idx < tracks.length - 1) {
        nextInternal();
      } else if (isShuffled && tracks.length > 0) {
        nextInternal();
      } else {
        setIsPlaying(false);
      }
    }
  }, [repeatMode, getCurrentIndex, tracks.length, isShuffled, nextInternal]);

  useEffect(() => {
    handleTrackEndRef.current = handleTrackEnd;
  }, [handleTrackEnd]);

  // ── Public API ───────────────────────────────────────────────────────────

  const play = useCallback((track?: MusicTrack) => {
    if (track) {
      playInternal(track);
    } else {
      togglePlayInternal();
    }
  }, [playInternal, togglePlayInternal]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    setIsMuted(false);
  }, [setVolumeState]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev: RepeatMode) => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  }, [setRepeatMode]);

  const toggleShuffle = useCallback(() => {
    setIsShuffled((prev: boolean) => !prev);
  }, [setIsShuffled]);

  const playAll = useCallback((shuffle = false) => {
    if (tracks.length === 0) return;
    if (shuffle) {
      const randomIdx = Math.floor(Math.random() * tracks.length);
      setIsShuffled(true);
      playInternal(tracks[randomIdx]);
    } else {
      playInternal(tracks[0]);
    }
  }, [tracks, playInternal, setIsShuffled]);

  // ── Library ──────────────────────────────────────────────────────────────

  const refreshLibrary = useCallback(async () => {
    try {
      const data = await apiGet<{ ok: boolean; tracks: MusicTrack[]; total: number; music_dir: string }>('/music/library');
      if (data.ok) {
        setTracks(data.tracks);
        setTrackCount(data.total);
        setMusicDir(data.music_dir);
      }
    } catch {
      // silent
    }
  }, []);

  const setMusicDirectory = useCallback(async (path: string) => {
    try {
      await apiPost('/music/set-directory', { path });
      await refreshLibrary();
    } catch {
      // silent
    }
  }, [refreshLibrary]);

  const deleteTrack = useCallback(async (filename: string): Promise<boolean> => {
    try {
      // 1. Immediately pause and detach file handle from audio element so Windows file lock is released
      if (currentTrack?.filename === filename) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
        setIsPlaying(false);
        setCurrentTrack(null);
      }

      // 2. Perform file deletion on backend
      const res = await apiFetch(`/music/track?file=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await refreshLibrary();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [currentTrack, refreshLibrary]);

  // ── Download ─────────────────────────────────────────────────────────────

  const previewUrl = useCallback(async (url: string): Promise<PreviewResult> => {
    try {
      const timeoutPromise = new Promise<PreviewResult>((_, reject) =>
        setTimeout(() => reject(new Error('Preview timed out')), 12000)
      );
      return await Promise.race([
        apiPost<PreviewResult>('/music/preview', { url }),
        timeoutPromise,
      ]);
    } catch (e: any) {
      return { ok: false, error: e.message || 'Preview failed' };
    }
  }, []);

  const expandPlaylist = useCallback(async (url: string, limit = 50): Promise<PlaylistInfoResult> => {
    try {
      const timeoutPromise = new Promise<PlaylistInfoResult>((_, reject) =>
        setTimeout(() => reject(new Error('Playlist extraction timed out')), 16000)
      );
      return await Promise.race([
        apiPost<PlaylistInfoResult>('/music/expand-playlist', { url, limit }),
        timeoutPromise,
      ]);
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to extract playlist' };
    }
  }, []);

  const dismissDownloadTask = useCallback((id: string) => {
    setDownloadQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearFinishedDownloads = useCallback(() => {
    setDownloadQueue((prev) => prev.filter((t) => t.status === 'downloading' || t.status === 'queued'));
  }, []);

  const downloadFromUrl = useCallback(async (
    url: string,
    quality = 'best',
    initialInfo?: Partial<DownloadTask>
  ): Promise<DownloadResult> => {
    const taskId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const taskTitle = initialInfo?.title || url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 42);

    const newTask: DownloadTask = {
      id: taskId,
      url,
      title: taskTitle,
      artist: initialInfo?.artist,
      thumbnail: initialInfo?.thumbnail,
      progress: 12,
      status: 'downloading',
      timestamp: Date.now(),
    };

    setDownloadQueue((prev) => [newTask, ...prev]);

    // Micro-increments for smooth visual progress while yt-dlp fetches streams
    const progressTimer = setInterval(() => {
      setDownloadQueue((prev) =>
        prev.map((t) => {
          if (t.id === taskId && t.status === 'downloading' && t.progress < 85) {
            return { ...t, progress: Math.min(85, t.progress + Math.floor(Math.random() * 8) + 3) };
          }
          return t;
        })
      );
    }, 450);

    try {
      const result = await apiPost<DownloadResult>('/music/download', { url, quality });
      clearInterval(progressTimer);

      if (result.ok) {
        setDownloadQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progress: 100,
                  status: 'complete',
                  title: result.title || t.title,
                  artist: result.artist || t.artist,
                  filename: result.filename,
                }
              : t
          )
        );
        await refreshLibrary();
        return result;
      } else {
        setDownloadQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progress: 0,
                  status: 'error',
                  error: result.error || 'Download failed',
                }
              : t
          )
        );
        return result;
      }
    } catch (e: any) {
      clearInterval(progressTimer);
      setDownloadQueue((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                progress: 0,
                status: 'error',
                error: e.message || 'Download error',
              }
            : t
        )
      );
      return { ok: false, error: e.message || 'Download failed' };
    }
  }, [refreshLibrary]);

  const downloadBatch = useCallback(async (urls: string[], quality = 'best'): Promise<void> => {
    const uniqueUrls = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
    if (uniqueUrls.length === 0) return;

    // Concurrency pool of 3 simultaneous downloads
    const CONCURRENCY = 3;
    const queue = [...uniqueUrls];

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }).map(async () => {
      while (queue.length > 0) {
        const nextUrl = queue.shift();
        if (nextUrl) {
          await downloadFromUrl(nextUrl, quality);
        }
      }
    });

    await Promise.all(workers);
  }, [downloadFromUrl]);

  // ── Favorites ────────────────────────────────────────────────────────────

  const refreshFavorites = useCallback(async () => {
    try {
      const data = await apiGet<{ ok: boolean; favorites: string[] }>('/music/favorites');
      if (data.ok) setFavorites(data.favorites);
    } catch {
      // silent
    }
  }, []);

  const toggleFavoriteAction = useCallback(async (filename: string) => {
    // Optimistic update
    setFavorites((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]
    );
    try {
      await apiPost('/music/favorite', { filename });
    } catch {
      refreshFavorites();
    }
  }, [refreshFavorites]);

  const isFavorite = useCallback((filename: string) => {
    return favorites.includes(filename);
  }, [favorites]);

  // ── Playlists ────────────────────────────────────────────────────────────

  const refreshPlaylists = useCallback(async () => {
    try {
      const data = await apiGet<{ ok: boolean; playlists: Record<string, string[]> }>('/music/playlists');
      if (data.ok) setPlaylists(data.playlists);
    } catch {
      // silent
    }
  }, []);

  const createPlaylistAction = useCallback(async (name: string) => {
    await apiPost('/music/playlist/create', { name });
    await refreshPlaylists();
  }, [refreshPlaylists]);

  const deletePlaylistAction = useCallback(async (name: string) => {
    await apiFetch(`/music/playlist?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    await refreshPlaylists();
  }, [refreshPlaylists]);

  const addToPlaylistAction = useCallback(async (playlist: string, filename: string) => {
    await apiPost('/music/playlist/add', { playlist, filename });
    await refreshPlaylists();
  }, [refreshPlaylists]);

  const removeFromPlaylistAction = useCallback(async (playlist: string, filename: string) => {
    await apiPost('/music/playlist/remove', { playlist, filename });
    await refreshPlaylists();
  }, [refreshPlaylists]);

  // ── Context Value ────────────────────────────────────────────────────────

  const value: MusicPlayerState = {
    tracks,
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    repeatMode,
    isShuffled,
    isLoading,
    musicDir,
    trackCount,
    favorites,
    playlists,
    isDownloading,
    downloadProgress,
    downloadStatus,
    downloadQueue,

    play,
    pause: pauseInternal,
    togglePlay: togglePlayInternal,
    next: nextInternal,
    previous: previousInternal,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    playAll,

    refreshLibrary,
    setMusicDirectory,
    deleteTrack,
    previewUrl,
    expandPlaylist,
    downloadFromUrl,
    downloadBatch,
    dismissDownloadTask,
    clearFinishedDownloads,

    toggleFavorite: toggleFavoriteAction,
    isFavorite,
    createPlaylist: createPlaylistAction,
    deletePlaylist: deletePlaylistAction,
    addToPlaylist: addToPlaylistAction,
    removeFromPlaylist: removeFromPlaylistAction,
    refreshPlaylists,

    getCoverUrl,
    getStreamUrl,
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer(): MusicPlayerState {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  }
  return ctx;
}
