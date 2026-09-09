import os
import shutil
import subprocess
from typing import Dict, Any, List

# Strict whitelist of cleanable cache folders
ALLOWED_CLEAN_TARGETS = {
    "node_modules", ".next", "dist", "target", ".venv", "venv",
    ".turbo", "build", "__pycache__", ".cache", ".nuxt", ".output"
}

def calculate_folder_size_mb(folder_path: str) -> float:
    """Calculates folder size in MB safely."""
    if not os.path.exists(folder_path):
        return 0.0
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(folder_path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
                except Exception:
                    pass
    except Exception:
        pass
    return round(total_size / (1024 * 1024), 2)

def clean_project_cache(project_path: str, targets: List[str] = None) -> Dict[str, Any]:
    """
    Safely purges bulky node_modules and build artifacts to recover disk space.
    Enforces strict folder whitelisting and path containment checks to prevent
    accidental or malicious deletion of project code or system files.
    """
    if not os.path.exists(project_path) or not os.path.isdir(project_path):
        return {"ok": False, "error": "Project directory does not exist", "freed_mb": 0.0}

    abs_project = os.path.abspath(project_path)
    
    # Restrict targets to strict whitelist only
    if not targets:
        clean_targets = ["node_modules", ".next", "dist", "target", ".venv", ".turbo"]
    else:
        clean_targets = [t.strip() for t in targets if t.strip() in ALLOWED_CLEAN_TARGETS]

    if not clean_targets:
        return {"ok": False, "error": "No valid or permissible cache targets provided", "freed_mb": 0.0}

    freed_mb = 0.0
    deleted_folders = []

    for target in clean_targets:
        target_path = os.path.join(abs_project, target)
        abs_target = os.path.abspath(target_path)

        # Security containment check: abs_target MUST strictly be a direct subfolder of abs_project
        if not abs_target.startswith(abs_project) or abs_target == abs_project:
            continue

        if os.path.exists(abs_target) and os.path.isdir(abs_target):
            size = calculate_folder_size_mb(abs_target)
            freed_mb += size

            try:
                if os.name == "nt":
                    # Safe parameterized command without raw shell string concatenation
                    subprocess.run(
                        ["cmd.exe", "/c", "rd", "/s", "/q", abs_target],
                        timeout=60,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                else:
                    shutil.rmtree(abs_target, ignore_errors=True)

                if not os.path.exists(abs_target):
                    deleted_folders.append(target)
            except Exception:
                try:
                    shutil.rmtree(abs_target, ignore_errors=True)
                    if not os.path.exists(abs_target):
                        deleted_folders.append(target)
                except Exception:
                    pass

    return {
        "ok": len(deleted_folders) > 0,
        "freed_mb": round(freed_mb, 2),
        "deleted_folders": deleted_folders,
        "project_path": abs_project
    }
