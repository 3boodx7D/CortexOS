"""
CortexOS Music Router — FastAPI endpoints for the Liquid Glass Music Lounge.
Handles: config, library scanning, URL preview/download, audio streaming, cover art, favorites, playlists.
"""

import os
import mimetypes
from fastapi import APIRouter, Body, Query, Response, Request
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any, Optional
from pathlib import Path

from backend.services.music_service import (
    get_music_config,
    set_music_directory,
    open_music_directory,
    scan_music_library,
    extract_url_info,
    download_song_from_url,
    get_download_progress,
    get_cover_art,
    get_cover_content_type,
    get_audio_file_path,
    delete_track,
    toggle_favorite,
    get_favorites,
    create_playlist,
    delete_playlist,
    add_to_playlist,
    remove_from_playlist,
    get_playlists,
    expand_playlist,
)

router = APIRouter(prefix="/api/music", tags=["music"])


# ── Config ────────────────────────────────────────────────────────────────────

@router.get("/config")
def music_config():
    """Get current music directory config and stats."""
    return get_music_config()


@router.post("/set-directory")
def music_set_directory(payload: Dict[str, Any] = Body(...)):
    """Set the music directory path."""
    new_path = payload.get("path", "")
    if not new_path:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Path is required"})
    return set_music_directory(new_path)


@router.post("/open-folder")
def music_open_folder():
    """Open the music folder in Windows Explorer."""
    return open_music_directory()


# ── Library ───────────────────────────────────────────────────────────────────

@router.get("/library")
def music_library():
    """Scan and return all tracks with metadata from the music directory."""
    return scan_music_library()


# ── URL Preview & Download ────────────────────────────────────────────────────

@router.post("/preview")
def music_preview(payload: Dict[str, Any] = Body(...)):
    """Preview URL metadata without downloading."""
    url = payload.get("url", "")
    if not url:
        return JSONResponse(status_code=400, content={"ok": False, "error": "URL is required"})
    return extract_url_info(url)


@router.post("/expand-playlist")
def music_expand_playlist(payload: Dict[str, Any] = Body(...)):
    """Extract individual track URLs from a playlist or mix URL."""
    url = payload.get("url", "")
    limit = payload.get("limit", 50)
    if not url:
        return JSONResponse(status_code=400, content={"ok": False, "error": "URL is required"})
    return expand_playlist(url, limit)


@router.post("/download")
def music_download(payload: Dict[str, Any] = Body(...)):
    """Download audio from URL and save to music directory."""
    url = payload.get("url", "")
    quality = payload.get("quality", "best")
    if not url:
        return JSONResponse(status_code=400, content={"ok": False, "error": "URL is required"})
    return download_song_from_url(url, quality)


@router.get("/download-progress")
def music_download_progress(id: str = Query(...)):
    """Check download progress."""
    return get_download_progress(id)


# ── Audio Streaming (HTTP Range support) ──────────────────────────────────────

@router.get("/stream")
def music_stream(file: str = Query(...), request: Request = None):
    """Stream an audio file with HTTP Range support for seeking."""
    filepath = get_audio_file_path(file)
    if filepath is None:
        return JSONResponse(status_code=404, content={"ok": False, "error": "File not found"})

    file_size = filepath.stat().st_size
    content_type = mimetypes.guess_type(str(filepath))[0] or "audio/mpeg"

    # Parse Range header for seeking support
    range_header = request.headers.get("range") if request else None

    if range_header:
        # Parse "bytes=start-end"
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
        end = min(end, file_size - 1)
        content_length = end - start + 1

        def iter_range():
            with open(str(filepath), "rb") as f:
                f.seek(start)
                remaining = content_length
                chunk_size = 65536
                while remaining > 0:
                    read_size = min(chunk_size, remaining)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iter_range(),
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Cache-Control": "no-cache",
            },
        )
    else:
        def iter_file():
            with open(str(filepath), "rb") as f:
                while True:
                    data = f.read(65536)
                    if not data:
                        break
                    yield data

        return StreamingResponse(
            iter_file(),
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "no-cache",
            },
        )


# ── Cover Art ─────────────────────────────────────────────────────────────────

@router.get("/cover")
def music_cover(file: str = Query(...)):
    """Get cover art for an audio file."""
    filepath = get_audio_file_path(file)
    if filepath is None:
        return JSONResponse(status_code=404, content={"ok": False, "error": "File not found"})

    cover_data = get_cover_art(str(filepath))
    if cover_data is None:
        return JSONResponse(status_code=404, content={"ok": False, "error": "No cover art found"})

    content_type = get_cover_content_type(str(filepath))
    return Response(content=cover_data, media_type=content_type, headers={"Cache-Control": "max-age=3600"})


# ── Track Deletion ────────────────────────────────────────────────────────────

@router.delete("/track")
def music_delete_track(file: str = Query(...)):
    """Delete a track from the music directory."""
    return delete_track(file)


# ── Favorites ─────────────────────────────────────────────────────────────────

@router.post("/favorite")
def music_toggle_favorite(payload: Dict[str, Any] = Body(...)):
    """Toggle a track in/out of favorites."""
    filename = payload.get("filename", "")
    if not filename:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Filename is required"})
    return toggle_favorite(filename)


@router.get("/favorites")
def music_get_favorites():
    """Get list of favorite filenames."""
    return {"ok": True, "favorites": get_favorites()}


# ── Playlists ─────────────────────────────────────────────────────────────────

@router.get("/playlists")
def music_get_playlists():
    """Get all playlists."""
    return {"ok": True, "playlists": get_playlists()}


@router.post("/playlist/create")
def music_create_playlist(payload: Dict[str, Any] = Body(...)):
    """Create a new playlist."""
    name = payload.get("name", "")
    if not name:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Name is required"})
    return create_playlist(name)


@router.delete("/playlist")
def music_delete_playlist(name: str = Query(...)):
    """Delete a playlist."""
    return delete_playlist(name)


@router.post("/playlist/add")
def music_playlist_add(payload: Dict[str, Any] = Body(...)):
    """Add a track to a playlist."""
    playlist = payload.get("playlist", "")
    filename = payload.get("filename", "")
    if not playlist or not filename:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Playlist and filename are required"})
    return add_to_playlist(playlist, filename)


@router.post("/playlist/remove")
def music_playlist_remove(payload: Dict[str, Any] = Body(...)):
    """Remove a track from a playlist."""
    playlist = payload.get("playlist", "")
    filename = payload.get("filename", "")
    if not playlist or not filename:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Playlist and filename are required"})
    return remove_from_playlist(playlist, filename)
