import os
import json
import time
import subprocess
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from backend.services.cleaner import calculate_folder_size_mb

KNOWN_DEPENDENCY_TAGS = {
    "next": "Next.js",
    "react": "React",
    "vue": "Vue",
    "svelte": "Svelte",
    "vite": "Vite",
    "tailwindcss": "Tailwind",
    "@tauri-apps/api": "Tauri",
    "@tauri-apps/cli": "Tauri",
    "discord.js": "Discord.js",
    "electron": "Electron",
    "typescript": "TypeScript",
    "@supabase/supabase-js": "Supabase",
    "prisma": "Prisma",
    "drizzle-orm": "Drizzle",
    "express": "Express",
    "fastify": "Fastify",
    "@nestjs/core": "NestJS",
    "three": "Three.js",
    "@react-three/fiber": "Three.js",
    "framer-motion": "Framer Motion",
    "react-native": "React Native",
    "expo": "Expo",
}

def detect_project_stack(folder_path: str) -> List[str]:
    """Detects technologies and frameworks present in the project folder."""
    tags = []
    
    # 1. Check package.json
    pkg_path = os.path.join(folder_path, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8", errors="ignore") as f:
                pkg = json.load(f)
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                for dep, tag in KNOWN_DEPENDENCY_TAGS.items():
                    if dep in deps and tag not in tags:
                        tags.append(tag)
        except Exception:
            pass
        if "Node.js" not in tags and not any(t in ["Next.js", "React", "Vue", "Vite"] for t in tags):
            tags.append("Node.js")

    # 2. Check Rust / Cargo
    if os.path.exists(os.path.join(folder_path, "Cargo.toml")):
        if "Rust" not in tags:
            tags.append("Rust")
        if os.path.exists(os.path.join(folder_path, "src-tauri")) and "Tauri" not in tags:
            tags.append("Tauri")

    # 3. Check Python
    py_files = ["requirements.txt", "pyproject.toml", "Pipfile", "main.py", "app.py"]
    if any(os.path.exists(os.path.join(folder_path, f)) for f in py_files):
        if "Python" not in tags:
            tags.append("Python")
        # Check for FastAPI / Flask / Django
        req_path = os.path.join(folder_path, "requirements.txt")
        if os.path.exists(req_path):
            try:
                with open(req_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read().lower()
                    if "fastapi" in content and "FastAPI" not in tags:
                        tags.append("FastAPI")
                    if "django" in content and "Django" not in tags:
                        tags.append("Django")
                    if "flask" in content and "Flask" not in tags:
                        tags.append("Flask")
            except Exception:
                pass

    # 4. Check Flutter / Dart
    if os.path.exists(os.path.join(folder_path, "pubspec.yaml")):
        if "Flutter" not in tags:
            tags.append("Flutter")

    # 5. Check Go
    if os.path.exists(os.path.join(folder_path, "go.mod")):
        if "Go" not in tags:
            tags.append("Go")

    # 6. Check C#
    try:
        if any(f.endswith((".csproj", ".sln")) for f in os.listdir(folder_path)):
            if "C#" not in tags:
                tags.append("C#")
    except Exception:
        pass

    # 7. Fallback to HTML/Web
    if not tags and os.path.exists(os.path.join(folder_path, "index.html")):
        tags = ["HTML5", "JavaScript"]

    return tags if tags else ["Software"]

def extract_git_metadata(folder_path: str) -> Dict[str, Optional[str]]:
    """Extracts git branch, last commit, and remote URL without heavy operations."""
    git_dir = os.path.join(folder_path, ".git")
    if not os.path.exists(git_dir):
        return {"branch": None, "last_commit": None, "remote": None}
        
    branch = None
    remote = None
    last_commit = None
    
    # Branch from HEAD
    try:
        head_path = os.path.join(git_dir, "HEAD")
        if os.path.exists(head_path):
            with open(head_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().strip()
                if content.startswith("ref: refs/heads/"):
                    branch = content.replace("ref: refs/heads/", "")
                else:
                    branch = content[:7]
    except Exception:
        pass

    # Remote from config
    try:
        config_path = os.path.join(git_dir, "config")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if "url = " in line:
                        remote = line.split("url = ", 1)[1].strip()
                        break
    except Exception:
        pass

    # Fast last commit check using git command if available
    try:
        out = subprocess.check_output(
            ["git", "log", "-1", "--format=%cd|%s", "--date=relative"],
            cwd=folder_path,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        ).strip()
        if out:
            last_commit = out
    except Exception:
        pass

    return {"branch": branch, "last_commit": last_commit, "remote": remote}

def read_project_description(folder_path: str) -> str:
    """Reads clean plain-text description from package.json or README.md."""
    # 1. package.json description
    pkg_path = os.path.join(folder_path, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8", errors="ignore") as f:
                pkg = json.load(f)
                desc = pkg.get("description", "").strip()
                if desc and not desc.startswith(("<", "!", "[")):
                    return desc
        except Exception:
            pass

    # 2. README.md snippet with HTML and Markdown filtering
    import re
    for readme_name in ["README.md", "readme.md", "README.txt"]:
        rm_path = os.path.join(folder_path, readme_name)
        if os.path.exists(rm_path):
            try:
                with open(rm_path, "r", encoding="utf-8", errors="ignore") as f:
                    for raw_line in f:
                        line = raw_line.strip()
                        # Skip empty lines, markdown headers, and badge blocks
                        if not line or line.startswith(("#", "```", "---", "===", "![")):
                            continue
                        # Strip HTML tags
                        clean = re.sub(r'<[^>]+>', '', line).strip()
                        # Strip markdown links / images
                        clean = re.sub(r'!\[.*?\]\(.*?\)', '', clean).strip()
                        clean = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', clean).strip()
                        clean = clean.replace("**", "").replace("__", "").replace("`", "").strip()
                        if clean and len(clean) > 8 and not clean.startswith(("<", "!", "[", "{")):
                            return clean[:160]
            except Exception:
                pass

    return "Local project workspace in active development."

def inspect_single_project(folder_path: str) -> Dict[str, Any]:
    """Deeply inspects a single project directory."""
    folder_name = os.path.basename(folder_path)
    stack = detect_project_stack(folder_path)
    git_info = extract_git_metadata(folder_path)
    description = read_project_description(folder_path)
    
    # Calculate node_modules / cache size
    nm_path = os.path.join(folder_path, "node_modules")
    has_nm = os.path.exists(nm_path)
    nm_size = calculate_folder_size_mb(nm_path) if has_nm else 0.0

    # Project modification time
    try:
        mtime = os.path.getmtime(folder_path)
        mod_date = datetime.fromtimestamp(mtime)
        now = datetime.now()
        delta_days = (now - mod_date).days
        
        if delta_days == 0:
            updated_str = "Today"
        elif delta_days == 1:
            updated_str = "Yesterday"
        elif delta_days < 7:
            updated_str = f"{delta_days} days ago"
        elif delta_days < 30:
            updated_str = f"{delta_days // 7} weeks ago"
        else:
            updated_str = f"{delta_days // 30} months ago"
    except Exception:
        updated_str = "Recently"
        delta_days = 5

    # Auto category heuristics
    lower_name = folder_name.lower()
    if any(k in lower_name for k in ["client", "sold", "customer", "deliverable", "amer", "selling"]):
        status = "client"
    elif any(k in lower_name for k in ["test", "demo", "sample", "mvp", "temp", "experiment", "3d"]):
        status = "experiment"
    elif delta_days > 60:
        status = "archived"
    else:
        status = "active"

    return {
        "id": f"proj-{abs(hash(folder_path)) % 10000000}",
        "name": folder_name,
        "path": os.path.abspath(folder_path),
        "description": description,
        "status": status,
        "stack": stack,
        "progress": 75 if status == "active" else (100 if status == "client" else 40),
        "updated": updated_str,
        "disk_size_mb": nm_size, # initial proxy
        "node_modules_size_mb": nm_size,
        "has_node_modules": has_nm,
        "git_branch": git_info["branch"],
        "git_last_commit": git_info["last_commit"],
        "git_remote": git_info["remote"],
        "ai_summary": None
    }

def scan_workspace_directory(root_path: str) -> Dict[str, Any]:
    """Scans all project subdirectories in the specified workspace root."""
    if not root_path or not os.path.exists(root_path):
        return {
            "ok": False,
            "path": root_path,
            "count": 0,
            "total_disk_mb": 0.0,
            "total_node_modules_mb": 0.0,
            "projects": [],
            "error": f"Directory not found: {root_path}"
        }

    ignored_dirs = {
        ".git", "node_modules", ".vscode", ".idea", "dist", "build",
        "__pycache__", "venv", ".venv", "$RECYCLE.BIN", "System Volume Information"
    }

    projects = []
    total_nm_mb = 0.0

    try:
        entries = sorted(os.listdir(root_path))
        for entry in entries:
            if entry in ignored_dirs or entry.startswith("."):
                continue
                
            full_path = os.path.join(root_path, entry)
            if os.path.isdir(full_path):
                try:
                    proj = inspect_single_project(full_path)
                    total_nm_mb += proj["node_modules_size_mb"]
                    projects.append(proj)
                except Exception as e:
                    print(f"[scanner] Skipping {entry}: {e}")
    except Exception as e:
        return {
            "ok": False,
            "path": root_path,
            "count": 0,
            "total_disk_mb": 0.0,
            "total_node_modules_mb": 0.0,
            "projects": [],
            "error": str(e)
        }

    return {
        "ok": True,
        "path": os.path.abspath(root_path),
        "count": len(projects),
        "total_disk_mb": round(total_nm_mb, 2),
        "total_node_modules_mb": round(total_nm_mb, 2),
        "projects": projects,
        "error": None
    }

def get_project_file_tree(project_path: str, max_depth: int = 2) -> Dict[str, Any]:
    """Returns a clean list of top-level files and directories inside the project folder."""
    if not os.path.exists(project_path) or not os.path.isdir(project_path):
        return {"ok": False, "error": "Folder not found", "items": []}

    ignored = {".git", "node_modules", ".next", "dist", "build", "__pycache__", "venv", ".venv"}
    items = []

    try:
        for root, dirs, files in os.walk(project_path):
            rel_path = os.path.relpath(root, project_path)
            depth = 0 if rel_path == "." else rel_path.count(os.sep) + 1
            if depth > max_depth:
                continue

            dirs[:] = [d for d in dirs if d not in ignored and not d.startswith(".")]

            if rel_path == ".":
                for d in dirs:
                    items.append({"name": d, "type": "dir", "path": d, "depth": 0})
                for f in files:
                    if f.startswith("."):
                        continue
                    fp = os.path.join(root, f)
                    size = os.path.getsize(fp) if os.path.exists(fp) else 0
                    items.append({"name": f, "type": "file", "path": f, "size": size, "depth": 0})
            elif depth == 1:
                for f in files[:8]:
                    if f.startswith("."):
                        continue
                    fp = os.path.join(root, f)
                    size = os.path.getsize(fp) if os.path.exists(fp) else 0
                    items.append({"name": f, "type": "file", "path": os.path.join(rel_path, f), "size": size, "depth": 1})

        items.sort(key=lambda x: (x["type"] != "dir", x["name"].lower()))
        return {"ok": True, "path": os.path.abspath(project_path), "items": items[:60]}
    except Exception as e:
        return {"ok": False, "error": str(e), "items": []}
