import os
import json
import time
from datetime import datetime
from typing import Dict, Any, List

DANGEROUS_SYSTEM_ROOTS = [
    "c:\\windows",
    "c:\\program files",
    "c:\\program files (x86)",
    "c:\\programdata",
    "c:\\system volume information",
    "c:\\$recycle.bin",
    "c:\\boot",
    "c:\\recovery"
]

def is_safe_backup_path(file_path: str) -> bool:
    """
    Strict security validation: Ensures the target file is a genuine CortexOS
    backup JSON file and not a sensitive system file or source code file.
    """
    if not file_path or not isinstance(file_path, str):
        return False
    if "\0" in file_path:
        return False
        
    abs_path = os.path.abspath(file_path)
    lower_abs = abs_path.lower()

    # Must be a JSON file
    if not lower_abs.endswith(".json"):
        return False

    # Check filename prefix/naming pattern
    filename = os.path.basename(abs_path).lower()
    if not ("cortex" in filename or filename.startswith("cortex-backup-")):
        return False

    # Must never target system root or program files
    for d in DANGEROUS_SYSTEM_ROOTS:
        if lower_abs.startswith(d):
            return False

    return True

def get_default_backup_dir() -> str:
    """Returns a sensible default backup directory on Windows."""
    for drive in ["D:", "C:"]:
        if os.path.exists(drive + "\\"):
            return f"{drive}\\CortexOS_Backups"
    return os.path.expanduser("~/CortexOS_Backups")

def save_cortex_backup(backup_dir: str, payload_data: Dict[str, Any]) -> Dict[str, Any]:
    """Saves a complete backup snapshot of CortexOS local and cloud data to disk."""
    if not backup_dir or not backup_dir.strip():
        backup_dir = get_default_backup_dir()

    abs_dir = os.path.abspath(backup_dir)
    lower_dir = abs_dir.lower()
    
    # Block writing to critical Windows system directories
    for d in DANGEROUS_SYSTEM_ROOTS:
        if lower_dir.startswith(d):
            backup_dir = get_default_backup_dir()
            abs_dir = os.path.abspath(backup_dir)
            break

    try:
        os.makedirs(abs_dir, exist_ok=True)
    except Exception:
        abs_dir = os.path.abspath(get_default_backup_dir())
        os.makedirs(abs_dir, exist_ok=True)

    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"cortex-backup-{timestamp_str}.json"
    full_path = os.path.join(abs_dir, filename)

    envelope = {
        "cortex_version": "0.3.20",
        "created_at": datetime.now().isoformat(),
        "timestamp_formatted": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "payload": payload_data
    }

    try:
        with open(full_path, "w", encoding="utf-8") as f:
            json.dump(envelope, f, indent=2, ensure_ascii=False)
            
        file_size = os.path.getsize(full_path)
        return {
            "ok": True,
            "filename": filename,
            "file_path": os.path.abspath(full_path),
            "size_kb": round(file_size / 1024, 1),
            "created_at": envelope["created_at"],
            "timestamp_formatted": envelope["timestamp_formatted"],
            "backup_dir": abs_dir
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e)
        }

def list_cortex_backups(backup_dir: str) -> Dict[str, Any]:
    """Lists available backup files in the target directory safely."""
    if not backup_dir:
        backup_dir = get_default_backup_dir()

    abs_dir = os.path.abspath(backup_dir)
    if not os.path.exists(abs_dir):
        return {"ok": True, "backups": [], "backup_dir": abs_dir}

    # Guard against system directories
    lower_dir = abs_dir.lower()
    for d in DANGEROUS_SYSTEM_ROOTS:
        if lower_dir.startswith(d):
            return {"ok": False, "error": "Access to system directories is restricted", "backups": []}

    backups = []
    try:
        for entry in os.listdir(abs_dir):
            if entry.endswith(".json") and "cortex" in entry.lower():
                fp = os.path.join(abs_dir, entry)
                if os.path.isfile(fp):
                    stat = os.stat(fp)
                    mtime = datetime.fromtimestamp(stat.st_mtime)
                    backups.append({
                        "filename": entry,
                        "file_path": os.path.abspath(fp),
                        "size_kb": round(stat.st_size / 1024, 1),
                        "mtime": stat.st_mtime,
                        "created_at": mtime.isoformat(),
                        "timestamp_formatted": mtime.strftime("%Y-%m-%d %H:%M:%S")
                    })
        backups.sort(key=lambda x: x["mtime"], reverse=True)
    except Exception as e:
        return {"ok": False, "error": str(e), "backups": []}

    return {"ok": True, "backups": backups, "backup_dir": abs_dir}

def read_cortex_backup(file_path: str) -> Dict[str, Any]:
    """Reads and parses a backup file from disk with strict path & size checks."""
    if not is_safe_backup_path(file_path):
        return {"ok": False, "error": "Security Alert: Refusing to read non-backup or protected file."}

    if not os.path.exists(file_path):
        return {"ok": False, "error": "Backup file does not exist"}

    # Limit file size to 50 MB to prevent memory exhaustion / DoS
    try:
        if os.path.getsize(file_path) > 50 * 1024 * 1024:
            return {"ok": False, "error": "Backup file exceeds maximum allowed size (50 MB)"}
            
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)
            payload = data.get("payload", data)
            return {
                "ok": True,
                "data": payload,
                "file_path": os.path.abspath(file_path)
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def delete_cortex_backup(file_path: str) -> Dict[str, Any]:
    """Deletes a backup file safely from disk after verifying it is a genuine backup."""
    if not is_safe_backup_path(file_path):
        return {"ok": False, "error": "Security Alert: Refusing to delete non-backup or protected file."}

    if not os.path.exists(file_path):
        return {"ok": False, "error": "File not found"}

    try:
        os.remove(file_path)
        return {"ok": True, "deleted": os.path.basename(file_path)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def open_backup_directory(backup_dir: str) -> Dict[str, Any]:
    """Reveals the backup folder in Windows Explorer safely."""
    abs_dir = os.path.abspath(backup_dir or get_default_backup_dir())
    
    # Block opening root system drives directly via API
    if abs_dir.lower() in ["c:\\", "c:\\windows", "c:\\windows\\system32"]:
        abs_dir = os.path.abspath(get_default_backup_dir())

    if not os.path.exists(abs_dir):
        try:
            os.makedirs(abs_dir, exist_ok=True)
        except Exception:
            pass

    try:
        import subprocess
        subprocess.Popen(["explorer.exe", abs_dir])
        return {"ok": True, "opened": abs_dir}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ------------------------------------------------------------------------------
# PROJECT ZIP BACKUPS ENGINE (Production-Grade, SemVer, Excludes node_modules/.git)
# ------------------------------------------------------------------------------
import zipfile
import re

IGNORED_BACKUP_DIRS = {
    "node_modules", ".git", ".next", ".nuxt", "dist", "build", "out",
    "__pycache__", "venv", ".venv", "target", ".turbo", ".cache",
    ".idea", ".vscode", "$recycle.bin", "system volume information"
}

def is_ignored_path(rel_path: str) -> bool:
    """Checks if relative path is inside an ignored directory."""
    parts = rel_path.replace("\\", "/").lower().split("/")
    for part in parts:
        if part in IGNORED_BACKUP_DIRS:
            return True
        if part.endswith(".pyc") or part.endswith(".tmp") or part.endswith(".log"):
            return True
    return False

def create_project_zip_snapshot(
    project_path: str,
    version_tag: str,
    note: str = "",
    backup_dir: str = ""
) -> Dict[str, Any]:
    """
    Creates a compressed ZIP snapshot of the target project, strictly
    omitting node_modules, .git, and bulky build artifacts.
    """
    if not project_path or not os.path.exists(project_path):
        return {"ok": False, "error": f"Project folder not found: {project_path}"}

    abs_proj = os.path.abspath(project_path)
    proj_name = os.path.basename(abs_proj)

    # Dynamic target backup directory
    effective_vault = os.path.abspath(backup_dir.strip() if backup_dir and backup_dir.strip() else get_default_backup_dir())
    
    # Store project backups in a dedicated subfolder per project
    proj_vault_dir = os.path.join(effective_vault, proj_name)
    try:
        os.makedirs(proj_vault_dir, exist_ok=True)
    except Exception as e:
        return {"ok": False, "error": f"Failed to create backup destination: {e}"}

    # Format version and timestamp
    clean_tag = re.sub(r'[^a-zA-Z0-9_\-\.]', '', version_tag.strip()) or "v1.0.0"
    if not clean_tag.startswith("v"):
        clean_tag = f"v{clean_tag}"
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"{proj_name}_{clean_tag}_{timestamp}.zip"
    zip_filepath = os.path.join(proj_vault_dir, zip_filename)

    meta_filename = f"{proj_name}_{clean_tag}_{timestamp}.meta.json"
    meta_filepath = os.path.join(proj_vault_dir, meta_filename)

    file_count = 0
    total_uncompressed_bytes = 0

    try:
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
            for root, dirs, files in os.walk(abs_proj):
                rel_root = os.path.relpath(root, abs_proj)
                
                # Prune walk directories
                dirs[:] = [d for d in dirs if not is_ignored_path(os.path.join(rel_root, d))]

                for file in files:
                    rel_file = os.path.normpath(os.path.join(rel_root, file))
                    if is_ignored_path(rel_file):
                        continue

                    full_src = os.path.join(root, file)
                    try:
                        file_stat = os.stat(full_src)
                        total_uncompressed_bytes += file_stat.st_size
                        zipf.write(full_src, arcname=rel_file)
                        file_count += 1
                    except (PermissionError, OSError):
                        continue # Skip in-use or inaccessible files safely

        compressed_size = os.path.getsize(zip_filepath)
        size_mb = round(compressed_size / (1024 * 1024), 2)

        meta_data = {
            "project_name": proj_name,
            "project_path": abs_proj,
            "version_tag": clean_tag,
            "note": note,
            "zip_filename": zip_filename,
            "zip_filepath": os.path.abspath(zip_filepath),
            "size_mb": size_mb,
            "size_bytes": compressed_size,
            "file_count": file_count,
            "created_at": datetime.now().isoformat(),
            "timestamp_formatted": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        with open(meta_filepath, 'w', encoding='utf-8') as mf:
            json.dump(meta_data, mf, indent=2)

        return {
            "ok": True,
            "snapshot": meta_data,
            "vault_dir": proj_vault_dir
        }

    except Exception as e:
        if os.path.exists(zip_filepath):
            try: os.remove(zip_filepath)
            except Exception: pass
        return {"ok": False, "error": str(e)}

def list_project_zip_snapshots(project_path: str, backup_dir: str = "") -> Dict[str, Any]:
    """Lists all available ZIP snapshots for the specific project."""
    if not project_path:
        return {"ok": False, "error": "Missing project path", "snapshots": []}

    proj_name = os.path.basename(os.path.abspath(project_path))
    effective_vault = os.path.abspath(backup_dir.strip() if backup_dir and backup_dir.strip() else get_default_backup_dir())
    proj_vault_dir = os.path.join(effective_vault, proj_name)

    if not os.path.exists(proj_vault_dir):
        return {"ok": True, "snapshots": [], "vault_dir": proj_vault_dir}

    snapshots = []
    try:
        for entry in os.listdir(proj_vault_dir):
            if entry.endswith(".meta.json"):
                meta_path = os.path.join(proj_vault_dir, entry)
                try:
                    with open(meta_path, 'r', encoding='utf-8', errors='ignore') as mf:
                        meta = json.load(mf)
                        # Verify the zip actually exists
                        if os.path.exists(meta.get("zip_filepath", "")):
                            snapshots.append(meta)
                except Exception:
                    continue

        # Sort by creation time descending (newest first)
        snapshots.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"ok": True, "snapshots": snapshots, "vault_dir": proj_vault_dir}

    except Exception as e:
        return {"ok": False, "error": str(e), "snapshots": [], "vault_dir": proj_vault_dir}

def restore_project_zip_snapshot(zip_path: str, target_dir: str = "") -> Dict[str, Any]:
    """Safely extracts a ZIP snapshot into the target directory with path-traversal protection."""
    if not zip_path or not os.path.exists(zip_path) or not zip_path.lower().endswith(".zip"):
        return {"ok": False, "error": "Invalid or missing ZIP snapshot file"}

    abs_zip = os.path.abspath(zip_path)
    
    if not target_dir:
        # Check if there is an accompanying meta file to know the original project path
        meta_candidate = abs_zip[:-4] + ".meta.json"
        if os.path.exists(meta_candidate):
            try:
                with open(meta_candidate, 'r', encoding='utf-8') as mf:
                    meta = json.load(mf)
                    target_dir = meta.get("project_path", "")
            except:
                pass

    if not target_dir:
        return {"ok": False, "error": "Restore destination directory not specified"}

    abs_target = os.path.abspath(target_dir)
    os.makedirs(abs_target, exist_ok=True)

    try:
        with zipfile.ZipFile(abs_zip, 'r') as zipf:
            # Zip-slip security check
            for member in zipf.namelist():
                member_path = os.path.abspath(os.path.join(abs_target, member))
                if not member_path.startswith(abs_target):
                    return {"ok": False, "error": "Security Alert: Detected path traversal in archive"}

            zipf.extractall(abs_target)

        return {
            "ok": True,
            "target_dir": abs_target,
            "restored_from": os.path.basename(abs_zip),
            "message": "Snapshot successfully restored"
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

