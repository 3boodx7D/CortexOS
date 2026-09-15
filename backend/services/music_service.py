"""
CortexOS Music Service — Local Music Library & yt-dlp Downloader Engine
Handles: folder config, library scanning with mutagen tags, yt-dlp URL downloads,
audio streaming with HTTP Range, cover art extraction, favorites & playlists.
"""

import os
import io
import json
import re
import subprocess
import time
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# ── Constants ──────────────────────────────────────────────────────────────────
CONFIG_DIR = Path.home() / ".cortexos"
MUSIC_CONFIG_FILE = CONFIG_DIR / "music_config.json"
LIBRARY_CACHE_FILE_NAME = ".cortex_music_cache.json"
DEFAULT_MUSIC_DIR = Path("D:/CortexOS_Music")

SUPPORTED_EXTENSIONS = {".mp3", ".m4a", ".mp4", ".flac", ".wav", ".aac", ".ogg", ".opus", ".webm", ".wma"}

# In-memory download progress tracker
_download_progress: Dict[str, Dict[str, Any]] = {}
_download_lock = threading.Lock()


# ── Config Helpers ─────────────────────────────────────────────────────────────

def _load_music_config() -> Dict[str, Any]:
    """Load music config from disk."""
    try:
        if MUSIC_CONFIG_FILE.exists():
            with open(MUSIC_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_music_config(data: Dict[str, Any]) -> None:
    """Persist music config to disk."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(MUSIC_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_music_directory() -> str:
    """Get the configured music folder path, creating it if needed."""
    config = _load_music_config()
    custom = config.get("music_dir")
    if custom and os.path.isdir(custom):
        return custom

    # Try default D: drive, fallback to ~/Music/CortexOS_Music
    try:
        DEFAULT_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
        return str(DEFAULT_MUSIC_DIR)
    except Exception:
        fallback = Path.home() / "Music" / "CortexOS_Music"
        fallback.mkdir(parents=True, exist_ok=True)
        return str(fallback)


def set_music_directory(new_path: str) -> Dict[str, Any]:
    """Set custom music folder path."""
    p = Path(new_path)
    p.mkdir(parents=True, exist_ok=True)
    config = _load_music_config()
    config["music_dir"] = str(p)
    _save_music_config(config)
    return {"ok": True, "path": str(p)}


def open_music_directory() -> Dict[str, Any]:
    """Open the music folder in Windows Explorer."""
    music_dir = get_music_directory()
    try:
        if os.name == "nt":
            subprocess.Popen(
                ["explorer", music_dir],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_music_config() -> Dict[str, Any]:
    """Return current config + stats."""
    music_dir = get_music_directory()
    count = 0
    try:
        for f in Path(music_dir).iterdir():
            if f.suffix.lower() in SUPPORTED_EXTENSIONS:
                count += 1
    except Exception:
        pass
    return {
        "music_dir": music_dir,
        "track_count": count,
    }


# ── Library Scanning ──────────────────────────────────────────────────────────

def _extract_track_metadata(filepath: Path) -> Optional[Dict[str, Any]]:
    """Extract metadata from a single audio file using mutagen."""
    try:
        from mutagen import File as MutagenFile
        from mutagen.mp3 import MP3
        from mutagen.mp4 import MP4
        from mutagen.flac import FLAC

        audio = MutagenFile(str(filepath), easy=True)
        if audio is None:
            return None

        title = ""
        artist = ""
        album = ""
        duration = 0.0

        if audio.tags:
            title = str(audio.tags.get("title", [""])[0]) if audio.tags.get("title") else ""
            artist = str(audio.tags.get("artist", [""])[0]) if audio.tags.get("artist") else ""
            album = str(audio.tags.get("album", [""])[0]) if audio.tags.get("album") else ""

        if hasattr(audio, "info") and audio.info:
            duration = audio.info.length or 0.0

        # Fallback title to filename
        if not title:
            title = filepath.stem

        # Check for cover art existence
        has_cover = _has_embedded_cover(filepath)

        return {
            "id": filepath.stem,
            "filename": filepath.name,
            "path": str(filepath),
            "title": title,
            "artist": artist or "Unknown Artist",
            "album": album,
            "duration": round(duration, 1),
            "duration_fmt": _format_duration(duration),
            "size_mb": round(filepath.stat().st_size / (1024 * 1024), 1),
            "ext": filepath.suffix.lower(),
            "has_cover": has_cover,
            "modified": filepath.stat().st_mtime,
        }
    except Exception:
        # Fallback for files that mutagen can't parse
        try:
            return {
                "id": filepath.stem,
                "filename": filepath.name,
                "path": str(filepath),
                "title": filepath.stem,
                "artist": "Unknown Artist",
                "album": "",
                "duration": 0,
                "duration_fmt": "00:00",
                "size_mb": round(filepath.stat().st_size / (1024 * 1024), 1),
                "ext": filepath.suffix.lower(),
                "has_cover": False,
                "modified": filepath.stat().st_mtime,
            }
        except Exception:
            return None


def _has_embedded_cover(filepath: Path) -> bool:
    """Check if audio file has embedded cover art or an adjacent/cached image."""
    try:
        # 1. Check dedicated .covers directory
        if (filepath.parent / ".covers" / f"{filepath.stem}.jpg").exists():
            return True

        # 2. Check same-stem cover file
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            if filepath.with_suffix(ext).exists():
                return True

        # 3. Check embedded tags via Mutagen
        try:
            from mutagen import File as MutagenFile
            audio = MutagenFile(str(filepath))
            if audio and hasattr(audio, "tags") and audio.tags:
                for key in audio.tags:
                    if isinstance(key, str) and key.startswith("APIC"):
                        return True
                if "covr" in audio.tags:
                    return True
            if audio and hasattr(audio, "pictures") and audio.pictures:
                return True
        except Exception:
            pass

        # 4. Check external directory cover files
        cover_names = ["cover.jpg", "cover.png", "folder.jpg", "folder.png", "album.jpg", "album.png"]
        parent = filepath.parent
        for name in cover_names:
            if (parent / name).exists():
                return True

        return False
    except Exception:
        return False


def _format_duration(seconds: float) -> str:
    """Format seconds into MM:SS or HH:MM:SS."""
    s = int(seconds)
    if s < 3600:
        return f"{s // 60:02d}:{s % 60:02d}"
    return f"{s // 3600}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def scan_music_library() -> Dict[str, Any]:
    """Scan the music directory and return all tracks with metadata, auto-migrating loose covers to .covers/."""
    music_dir = get_music_directory()
    tracks: List[Dict[str, Any]] = []
    errors = 0

    try:
        p = Path(music_dir)
        if not p.exists():
            p.mkdir(parents=True, exist_ok=True)

        # Auto-migrate any loose images in root directory to .covers/
        _migrate_loose_covers(p)

        for f in sorted(p.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
                meta = _extract_track_metadata(f)
                if meta:
                    tracks.append(meta)
                else:
                    errors += 1
    except Exception as e:
        return {"ok": False, "tracks": [], "error": str(e)}

    return {
        "ok": True,
        "tracks": tracks,
        "total": len(tracks),
        "errors": errors,
        "music_dir": music_dir,
    }


# ── Cover Art Extraction ──────────────────────────────────────────────────────

def get_cover_art(filepath: str) -> Optional[bytes]:
    """Extract embedded cover art from audio file, or find cached cover."""
    try:
        p = Path(filepath)

        # 1. Check dedicated .covers directory
        cached_cover = p.parent / ".covers" / f"{p.stem}.jpg"
        if cached_cover.exists():
            return cached_cover.read_bytes()

        # 2. Check embedded tags in audio file via mutagen
        try:
            from mutagen import File as MutagenFile
            audio = MutagenFile(str(p))
            if audio and audio.tags:
                for key in audio.tags:
                    if isinstance(key, str) and key.startswith("APIC"):
                        return audio.tags[key].data
                if "covr" in audio.tags:
                    covers = audio.tags["covr"]
                    if covers:
                        return bytes(covers[0])
            if hasattr(audio, "pictures") and audio.pictures:
                return audio.pictures[0].data
        except Exception:
            pass

        # 3. Check same-stem cover file
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            same_name = p.with_suffix(ext)
            if same_name.exists():
                return same_name.read_bytes()

        # 4. Check directory cover files
        cover_names = ["cover.jpg", "cover.png", "folder.jpg", "folder.png", "album.jpg", "album.png"]
        for name in cover_names:
            ext_cover = p.parent / name
            if ext_cover.exists():
                return ext_cover.read_bytes()
        try:
            from mutagen import File as MutagenFile
            audio = MutagenFile(str(p))
            if audio and audio.tags:
                for key in audio.tags:
                    if isinstance(key, str) and key.startswith("APIC"):
                        return audio.tags[key].data
                if "covr" in audio.tags:
                    covers = audio.tags["covr"]
                    if covers:
                        return bytes(covers[0])
            if hasattr(audio, "pictures") and audio.pictures:
                return audio.pictures[0].data
        except Exception:
            pass

    except Exception:
        pass
    return None


def get_cover_content_type(filepath: str) -> str:
    """Guess cover art MIME type."""
    data = get_cover_art(filepath)
    if data:
        if data[:3] == b'\xff\xd8\xff':
            return "image/jpeg"
        if data[:8] == b'\x89PNG\r\n\x1a\n':
            return "image/png"
        if data[:4] == b'RIFF':
            return "image/webp"
    return "image/jpeg"


# ── URL Sanitization, Preview & Download (yt-dlp) ─────────────────────────────

def clean_music_url(raw_url: str, strip_playlist: bool = False) -> str:
    """Clean and normalize song URLs, removing tracking parameters while preserving playlist info when needed."""
    if not raw_url:
        return ""
    url = raw_url.strip()
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)

        # Handle youtu.be/<id>?list=...
        if "youtu.be" in parsed.netloc:
            vid_id = parsed.path.strip("/").split("/")[0]
            if vid_id:
                if not strip_playlist and "list" in qs and qs["list"]:
                    return f"https://www.youtube.com/watch?v={vid_id}&list={qs['list'][0]}"
                return f"https://youtu.be/{vid_id}"

        # Handle youtube.com/watch?v=<id>&list=...
        if ("youtube.com" in parsed.netloc or "youtube-nocookie.com" in parsed.netloc) and "/watch" in parsed.path:
            vid_id = qs.get("v", [""])[0]
            if vid_id:
                if not strip_playlist and "list" in qs and qs["list"]:
                    return f"https://www.youtube.com/watch?v={vid_id}&list={qs['list'][0]}"
                return f"https://www.youtube.com/watch?v={vid_id}"

        # Handle youtube.com/playlist?list=...
        if ("youtube.com" in parsed.netloc or "youtube-nocookie.com" in parsed.netloc) and "/playlist" in parsed.path:
            list_id = qs.get("list", [""])[0]
            if list_id:
                return f"https://www.youtube.com/playlist?list={list_id}"

        # Handle music.youtube.com/watch?v=<id>&list=...
        if "music.youtube.com" in parsed.netloc and "/watch" in parsed.path:
            vid_id = qs.get("v", [""])[0]
            if vid_id:
                if not strip_playlist and "list" in qs and qs["list"]:
                    return f"https://www.youtube.com/watch?v={vid_id}&list={qs['list'][0]}"
                return f"https://www.youtube.com/watch?v={vid_id}"

        # Handle music.youtube.com/playlist?list=...
        if "music.youtube.com" in parsed.netloc and "/playlist" in parsed.path:
            list_id = qs.get("list", [""])[0]
            if list_id:
                return f"https://www.youtube.com/playlist?list={list_id}"

        # Handle youtube.com/shorts/<id>
        if "youtube.com" in parsed.netloc and "/shorts/" in parsed.path:
            parts = [p for p in parsed.path.split("/") if p]
            if len(parts) >= 2 and parts[0] == "shorts":
                return f"https://www.youtube.com/watch?v={parts[1]}"
    except Exception:
        pass
    return url


def expand_playlist(raw_url: str, limit: int = 50) -> Dict[str, Any]:
    """Extract individual tracks from a YouTube Playlist or Mix without downloading."""
    url = clean_music_url(raw_url, strip_playlist=False)
    if not url:
        return {"ok": False, "error": "Invalid or empty URL"}

    try:
        import yt_dlp
        import concurrent.futures

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": True,
            "socket_timeout": 12,
            "playlist_items": f"1-{limit}" if limit else "1-50",
            "js_runtimes": {"node": {}},
            "remote_components": ["ejs:github"],
        }

        def _do_expand():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_do_expand)
            info = future.result(timeout=15)

        if not info:
            return {"ok": False, "error": "Could not extract playlist information"}

        entries = list(info.get("entries") or [])
        is_playlist = ("_type" in info and info["_type"] == "playlist") or len(entries) > 1 or ("list=" in url or "/playlist" in url)

        if not is_playlist and len(entries) <= 1:
            # Single video fallback
            single_info = entries[0] if entries else info
            vid_id = single_info.get("id")
            title = single_info.get("title", "Unknown")
            artist = single_info.get("uploader") or single_info.get("channel") or single_info.get("artist") or "Unknown Artist"
            duration = single_info.get("duration", 0) or 0
            v_url = f"https://www.youtube.com/watch?v={vid_id}" if vid_id else url
            return {
                "ok": True,
                "is_playlist": False,
                "title": title,
                "artist": artist,
                "track_count": 1,
                "tracks": [{
                    "id": vid_id or "",
                    "url": v_url,
                    "title": title,
                    "artist": artist,
                    "duration": duration,
                    "duration_fmt": _format_duration(duration),
                    "thumbnail": single_info.get("thumbnail") or (f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg" if vid_id else ""),
                }],
            }

        # Format each playlist track
        track_list = []
        for e in entries:
            if not e:
                continue
            eid = e.get("id")
            e_url = e.get("url")
            if eid and (not e_url or not e_url.startswith("http")):
                e_url = f"https://www.youtube.com/watch?v={eid}"
            elif not e_url:
                continue

            duration = e.get("duration", 0) or 0
            track_list.append({
                "id": eid or "",
                "url": e_url,
                "title": e.get("title", "Unknown"),
                "artist": e.get("uploader") or e.get("channel") or e.get("artist") or "Unknown Artist",
                "duration": duration,
                "duration_fmt": _format_duration(duration),
                "thumbnail": e.get("thumbnail") or (f"https://i.ytimg.com/vi/{eid}/hqdefault.jpg" if eid else ""),
            })

        playlist_title = info.get("title") or "Playlist"
        return {
            "ok": True,
            "is_playlist": True,
            "playlist_id": info.get("id", ""),
            "title": playlist_title,
            "total_available": info.get("playlist_count") or len(track_list),
            "track_count": len(track_list),
            "tracks": track_list,
        }
    except concurrent.futures.TimeoutError:
        return {"ok": False, "error": "Playlist extraction timed out"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def extract_url_info(raw_url: str) -> Dict[str, Any]:
    """Extract metadata from a URL without downloading, checking for playlists as well."""
    # Check if this is a playlist/mix URL
    if "list=" in raw_url or "/playlist" in raw_url:
        pl_result = expand_playlist(raw_url, limit=25)
        if pl_result.get("ok") and pl_result.get("is_playlist"):
            first_track = pl_result["tracks"][0] if pl_result["tracks"] else {}
            return {
                "ok": True,
                "is_playlist": True,
                "playlist_title": pl_result["title"],
                "playlist_count": pl_result["track_count"],
                "playlist_tracks": pl_result["tracks"],
                "title": first_track.get("title", pl_result["title"]),
                "artist": first_track.get("artist", "Playlist"),
                "album": pl_result["title"],
                "duration": first_track.get("duration", 0),
                "duration_fmt": first_track.get("duration_fmt", "00:00"),
                "thumbnail": first_track.get("thumbnail", ""),
                "url": clean_music_url(raw_url, strip_playlist=False),
                "extractor": "youtube",
                "webpage_url": raw_url,
            }

    url = clean_music_url(raw_url, strip_playlist=True)
    if not url:
        return {"ok": False, "error": "Invalid or empty URL"}

    try:
        import yt_dlp
        import concurrent.futures

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
            "playlist_items": "1",
            "socket_timeout": 10,
            "extract_flat": False,
            "js_runtimes": {"node": {}},
            "remote_components": ["ejs:github"],
        }

        def _do_extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        # Strict 12s timeout to prevent FastAPI thread pool lockups
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_do_extract)
            info = future.result(timeout=12)

        if info is None:
            return {"ok": False, "error": "Could not extract song info"}

        # If a playlist structure was returned despite noplaylist, grab the first entry
        if "_type" in info and info["_type"] == "playlist" and "entries" in info:
            entries = list(info.get("entries") or [])
            if entries and entries[0]:
                info = entries[0]

        title = info.get("title", "Unknown")
        artist = info.get("artist") or info.get("uploader") or info.get("channel") or "Unknown Artist"
        duration = info.get("duration", 0) or 0

        return {
            "ok": True,
            "is_playlist": False,
            "title": title,
            "artist": artist,
            "album": info.get("album", ""),
            "duration": duration,
            "duration_fmt": _format_duration(duration),
            "thumbnail": info.get("thumbnail", ""),
            "url": url,
            "extractor": info.get("extractor", ""),
            "webpage_url": info.get("webpage_url", url),
        }
    except concurrent.futures.TimeoutError:
        return {"ok": False, "error": "Preview timed out after 12s"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def download_song_from_url(raw_url: str, quality: str = "best") -> Dict[str, Any]:
    """Download audio from URL, embed cover art and metadata, save to music dir."""
    url = clean_music_url(raw_url)
    download_id = f"dl_{int(time.time() * 1000)}"

    try:
        import yt_dlp

        music_dir = get_music_directory()

        with _download_lock:
            _download_progress[download_id] = {
                "status": "starting",
                "progress": 0,
                "filename": "",
            }

        def progress_hook(d):
            with _download_lock:
                if download_id in _download_progress:
                    if d["status"] == "downloading":
                        total = d.get("total_bytes") or d.get("total_bytes_estimate") or 1
                        downloaded = d.get("downloaded_bytes", 0)
                        _download_progress[download_id]["status"] = "downloading"
                        _download_progress[download_id]["progress"] = min(
                            int((downloaded / total) * 100), 99
                        )
                    elif d["status"] == "finished":
                        _download_progress[download_id]["status"] = "processing"
                        _download_progress[download_id]["progress"] = 95

        outtmpl = os.path.join(music_dir, "%(title)s.%(ext)s")
        ffmpeg_available = _check_ffmpeg()

        ydl_opts = {
            "noplaylist": True,
            "playlist_items": "1",
            "socket_timeout": 15,
            "js_runtimes": {"node": {}},
            "remote_components": ["ejs:github"],
            "writethumbnail": True,
            "progress_hooks": [progress_hook],
            "quiet": True,
            "no_warnings": True,
            "overwrites": True,
        }

        if ffmpeg_available:
            ydl_opts.update({
                "format": "bestaudio/best",
                "outtmpl": outtmpl,
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "320" if quality == "best" else "192",
                }],
            })
        else:
            # Native web audio formats supported by Chromium HTML5 player
            ydl_opts.update({
                "format": "ba[ext=m4a]/ba[ext=mp3]/ba[ext=webm]/ba/b",
                "outtmpl": outtmpl,
            })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                with _download_lock:
                    _download_progress.pop(download_id, None)
                return {"ok": False, "error": "Download failed — could not extract info"}

            # If playlist entry returned
            if "_type" in info and info["_type"] == "playlist" and "entries" in info:
                entries = list(info.get("entries") or [])
                if entries and entries[0]:
                    info = entries[0]

            title = info.get("title", "Unknown")
            artist = info.get("artist") or info.get("uploader") or info.get("channel") or "Unknown Artist"

            # Find the downloaded file
            downloaded_file = None
            expected_base = ydl.prepare_filename(info)

            # Check various extensions the file might have after post-processing
            for ext in [".mp3", ".m4a", ".opus", ".webm", ".wav", ".ogg", ".flac", ""]:
                candidate = Path(expected_base).with_suffix(ext)
                if candidate.exists():
                    downloaded_file = candidate
                    break

            if downloaded_file is None:
                expected_path = Path(expected_base)
                if expected_path.exists():
                    downloaded_file = expected_path

            if downloaded_file is None:
                # Search for recently created files
                now = time.time()
                for f in Path(music_dir).iterdir():
                    if f.suffix.lower() in SUPPORTED_EXTENSIONS and (now - f.stat().st_mtime) < 60:
                        downloaded_file = f
                        break

            if downloaded_file is None:
                with _download_lock:
                    _download_progress.pop(download_id, None)
                return {"ok": False, "error": "Download completed but file not found"}

            # Embed metadata and cover art directly inside the audio file
            _process_thumbnail(downloaded_file, info, title, artist)

            with _download_lock:
                _download_progress[download_id] = {
                    "status": "complete",
                    "progress": 100,
                    "filename": downloaded_file.name,
                }

            return {
                "ok": True,
                "download_id": download_id,
                "filename": downloaded_file.name,
                "path": str(downloaded_file),
                "title": title,
                "artist": artist,
                "duration": info.get("duration", 0),
                "duration_fmt": _format_duration(info.get("duration", 0)),
            }

    except Exception as e:
        with _download_lock:
            _download_progress.pop(download_id, None)
        return {"ok": False, "error": str(e)}


def _check_ffmpeg() -> bool:
    """Check if ffmpeg is available on PATH."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        return result.returncode == 0
    except Exception:
        return False


def _ensure_jpeg_cover(cover_path: Path) -> Optional[bytes]:
    """Convert any image (webp, png, etc.) to clean JPEG bytes for standard tagging and caching."""
    try:
        from PIL import Image
        import io
        img = Image.open(str(cover_path))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=92)
        return out.getvalue()
    except Exception:
        try:
            return cover_path.read_bytes()
        except Exception:
            return None


def _embed_cover_and_metadata(filepath: Path, title: str, artist: str, info: Dict, cover_path: Optional[Path]) -> None:
    """Embed Title, Contributing Artists, Album, Year, and Cover Art directly into the audio file."""
    try:
        ext = filepath.suffix.lower()
        cover_bytes = _ensure_jpeg_cover(cover_path) if cover_path and cover_path.exists() else None
        album = info.get("album") or title
        upload_date = info.get("upload_date") or ""
        year_str = upload_date[:4] if len(upload_date) >= 4 else ""

        if ext in [".m4a", ".mp4"]:
            from mutagen.mp4 import MP4, MP4Cover
            try:
                mp4 = MP4(str(filepath))
                if mp4.tags is None:
                    mp4.add_tags()
                mp4.tags["\xa9nam"] = [title]
                mp4.tags["\xa9ART"] = [artist]
                mp4.tags["aART"] = [artist]
                if album:
                    mp4.tags["\xa9alb"] = [album]
                if year_str:
                    mp4.tags["\xa9day"] = [year_str]
                if cover_bytes:
                    mp4.tags["covr"] = [MP4Cover(cover_bytes, imageformat=MP4Cover.FORMAT_JPEG)]
                mp4.save()
            except Exception as e:
                logger.warning(f"Error embedding MP4 tags: {e}")

        elif ext == ".mp3":
            from mutagen.id3 import ID3, TIT2, TPE1, TPE2, TALB, TDRC, APIC, ID3NoHeaderError
            try:
                try:
                    tags = ID3(str(filepath))
                except ID3NoHeaderError:
                    tags = ID3()

                tags.delall("TIT2")
                tags.add(TIT2(encoding=3, text=title))
                tags.delall("TPE1")
                tags.add(TPE1(encoding=3, text=artist))
                tags.delall("TPE2")
                tags.add(TPE2(encoding=3, text=artist))
                tags.delall("TALB")
                tags.add(TALB(encoding=3, text=album))
                if year_str:
                    tags.delall("TDRC")
                    tags.add(TDRC(encoding=3, text=year_str))
                if cover_bytes:
                    tags.delall("APIC")
                    tags.add(APIC(
                        encoding=3,
                        mime="image/jpeg",
                        type=3,  # Cover (front)
                        desc="Cover",
                        data=cover_bytes,
                    ))
                tags.save(str(filepath), v2_version=3)
            except Exception as e:
                logger.warning(f"Error embedding ID3 tags: {e}")

        elif ext == ".flac":
            from mutagen.flac import FLAC, Picture
            try:
                audio = FLAC(str(filepath))
                audio["title"] = title
                audio["artist"] = artist
                if album:
                    audio["album"] = album
                if year_str:
                    audio["date"] = year_str
                if cover_bytes:
                    pic = Picture()
                    pic.type = 3
                    pic.mime = "image/jpeg"
                    pic.desc = "Cover"
                    pic.data = cover_bytes
                    audio.clear_pictures()
                    audio.add_picture(pic)
                audio.save()
            except Exception as e:
                logger.warning(f"Error embedding FLAC tags: {e}")

    except Exception as e:
        logger.warning(f"Metadata embedding failed for {filepath.name}: {e}")


def _process_thumbnail(filepath: Path, info: Dict, title: str, artist: str) -> None:
    """Find downloaded thumbnail, convert to JPEG, save to .covers/ and embed inside audio file."""
    try:
        stem = filepath.stem
        parent = filepath.parent
        covers_dir = parent / ".covers"
        covers_dir.mkdir(exist_ok=True)

        cover_path = covers_dir / f"{stem}.jpg"
        found_thumb = None

        # 1. Search for loose thumbnail generated by yt-dlp in the music folder
        thumb_exts = [".jpg", ".jpeg", ".png", ".webp"]
        for ext in thumb_exts:
            cand = parent / f"{stem}{ext}"
            if cand.exists():
                found_thumb = cand
                break

        # 2. Direct download from thumbnail URL if none on disk
        if not found_thumb:
            thumb_url = info.get("thumbnail")
            if thumb_url:
                try:
                    import urllib.request
                    req = urllib.request.Request(
                        thumb_url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                    )
                    with urllib.request.urlopen(req, timeout=8) as resp:
                        if resp.status == 200:
                            temp_thumb = parent / f"temp_{stem}.jpg"
                            temp_thumb.write_bytes(resp.read())
                            found_thumb = temp_thumb
                except Exception:
                    pass

        # 3. Convert found thumbnail to clean JPEG in .covers/
        if found_thumb and found_thumb.exists():
            jpeg_data = _ensure_jpeg_cover(found_thumb)
            if jpeg_data:
                cover_path.write_bytes(jpeg_data)

            # Unlink the loose thumbnail from the root music directory
            if found_thumb != cover_path and found_thumb.exists():
                try:
                    found_thumb.unlink(missing_ok=True)
                except Exception:
                    pass

        # 4. Embed metadata & cover art directly into the audio file!
        _embed_cover_and_metadata(filepath, title, artist, info, cover_path if cover_path.exists() else None)

    except Exception as e:
        logger.warning(f"Failed to process thumbnail for {filepath.name}: {e}")


def _migrate_loose_covers(music_dir: Path) -> None:
    """Move loose image files to .covers/ and ensure all audio files have embedded tags."""
    try:
        covers_dir = music_dir / ".covers"
        covers_dir.mkdir(exist_ok=True)

        img_exts = [".jpg", ".jpeg", ".png", ".webp"]
        for img_file in list(music_dir.iterdir()):
            if img_file.is_file() and img_file.suffix.lower() in img_exts:
                stem = img_file.stem
                has_audio = any((music_dir / f"{stem}{ext}").exists() for ext in SUPPORTED_EXTENSIONS)
                if has_audio:
                    target_cover = covers_dir / f"{stem}.jpg"
                    if not target_cover.exists() or img_file != target_cover:
                        jpeg_data = _ensure_jpeg_cover(img_file)
                        if jpeg_data:
                            target_cover.write_bytes(jpeg_data)
                    try:
                        img_file.unlink(missing_ok=True)
                    except Exception:
                        pass
    except Exception:
        pass


def get_download_progress(download_id: str) -> Dict[str, Any]:
    """Check progress of a download."""
    with _download_lock:
        return _download_progress.get(download_id, {"status": "unknown", "progress": 0})


# ── Audio Streaming ───────────────────────────────────────────────────────────

def get_audio_file_path(filename: str) -> Optional[Path]:
    """Resolve a filename to its full path in the music directory."""
    music_dir = get_music_directory()
    filepath = Path(music_dir) / filename
    if filepath.exists() and filepath.suffix.lower() in SUPPORTED_EXTENSIONS:
        return filepath
    return None


# ── Track Deletion ────────────────────────────────────────────────────────────

def delete_track(filename: str) -> Dict[str, Any]:
    """Delete a track, its associated cover art, and any playlist references."""
    try:
        music_dir = get_music_directory()
        filepath = Path(music_dir) / filename
        stem = Path(filename).stem

        # On Windows, audio file handles might take a moment to release after pause.
        # Retry deletion up to 5 times with a short sleep.
        if filepath.exists():
            deleted = False
            for _ in range(5):
                try:
                    filepath.unlink(missing_ok=True)
                    deleted = True
                    break
                except (PermissionError, OSError):
                    time.sleep(0.12)
            if not deleted and filepath.exists():
                import stat
                try:
                    os.chmod(str(filepath), stat.S_IWRITE)
                    filepath.unlink(missing_ok=True)
                except Exception as ex:
                    return {"ok": False, "error": f"Track is locked by another process: {ex}"}

        # Also delete associated cover files
        covers_dir = Path(music_dir) / ".covers"
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            (Path(music_dir) / f"{stem}{ext}").unlink(missing_ok=True)
            if covers_dir.exists():
                (covers_dir / f"{stem}{ext}").unlink(missing_ok=True)

        # Clean up from favorites & playlists
        try:
            data = _load_playlists_data()
            favs = [f for f in data.get("favorites", []) if f != filename]
            playlists = {}
            for pl_name, pl_tracks in data.get("playlists", {}).items():
                playlists[pl_name] = [f for f in pl_tracks if f != filename]
            _save_playlists_data(favs, playlists)
        except Exception:
            pass

        return {"ok": True, "deleted": filename}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Favorites & Playlists (Local JSON Persistence) ────────────────────────────

def _load_playlists_data() -> Dict[str, Any]:
    """Load favorites and playlists from config."""
    config = _load_music_config()
    return {
        "favorites": config.get("favorites", []),
        "playlists": config.get("playlists", {}),
    }


def _save_playlists_data(favorites: List[str], playlists: Dict[str, List[str]]) -> None:
    """Save favorites and playlists to config."""
    config = _load_music_config()
    config["favorites"] = favorites
    config["playlists"] = playlists
    _save_music_config(config)


def toggle_favorite(filename: str) -> Dict[str, Any]:
    """Toggle a track in/out of favorites."""
    data = _load_playlists_data()
    favs = data["favorites"]
    if filename in favs:
        favs.remove(filename)
        is_fav = False
    else:
        favs.append(filename)
        is_fav = True
    _save_playlists_data(favs, data["playlists"])
    return {"ok": True, "filename": filename, "is_favorite": is_fav}


def get_favorites() -> List[str]:
    """Return list of favorite filenames."""
    data = _load_playlists_data()
    return data["favorites"]


def create_playlist(name: str) -> Dict[str, Any]:
    """Create a new empty playlist."""
    data = _load_playlists_data()
    playlists = data["playlists"]
    safe_name = re.sub(r'[^\w\s\-]', '', name).strip()
    if not safe_name:
        return {"ok": False, "error": "Invalid playlist name"}
    if safe_name in playlists:
        return {"ok": False, "error": "Playlist already exists"}
    playlists[safe_name] = []
    _save_playlists_data(data["favorites"], playlists)
    return {"ok": True, "name": safe_name}


def delete_playlist(name: str) -> Dict[str, Any]:
    """Delete a playlist."""
    data = _load_playlists_data()
    playlists = data["playlists"]
    if name not in playlists:
        return {"ok": False, "error": "Playlist not found"}
    del playlists[name]
    _save_playlists_data(data["favorites"], playlists)
    return {"ok": True, "deleted": name}


def add_to_playlist(playlist_name: str, filename: str) -> Dict[str, Any]:
    """Add a track to a playlist."""
    data = _load_playlists_data()
    playlists = data["playlists"]
    if playlist_name not in playlists:
        return {"ok": False, "error": "Playlist not found"}
    if filename not in playlists[playlist_name]:
        playlists[playlist_name].append(filename)
    _save_playlists_data(data["favorites"], playlists)
    return {"ok": True}


def remove_from_playlist(playlist_name: str, filename: str) -> Dict[str, Any]:
    """Remove a track from a playlist."""
    data = _load_playlists_data()
    playlists = data["playlists"]
    if playlist_name not in playlists:
        return {"ok": False, "error": "Playlist not found"}
    if filename in playlists[playlist_name]:
        playlists[playlist_name].remove(filename)
    _save_playlists_data(data["favorites"], playlists)
    return {"ok": True}


def get_playlists() -> Dict[str, List[str]]:
    """Return all playlists."""
    data = _load_playlists_data()
    return data["playlists"]
