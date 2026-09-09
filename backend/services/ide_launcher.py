import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List

# Common Windows locations for IDE executables
COMMON_IDE_PATHS = {
    "antigravity": [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Antigravity IDE\Antigravity IDE.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Antigravity IDE\bin\antigravity-ide.cmd"),
        os.path.expandvars(r"%USERPROFILE%\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe"),
        os.path.expandvars(r"%USERPROFILE%\AppData\Local\Programs\Antigravity IDE\bin\antigravity-ide.cmd"),
        "antigravity-ide.cmd",
        "antigravity.cmd",
        "antigravity.exe",
        "antigravity",
    ],
    "cursor": [
        "cursor.cmd",
        "cursor",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\cursor\Cursor.exe"),
        os.path.expandvars(r"%USERPROFILE%\AppData\Local\Programs\cursor\Cursor.exe"),
    ],
    "code": [
        "code.cmd",
        "code",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe"),
        r"C:\Program Files\Microsoft VS Code\Code.exe",
    ],
    "windsurf": [
        "windsurf.cmd",
        "windsurf",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Windsurf\Windsurf.exe"),
        os.path.expandvars(r"%USERPROFILE%\AppData\Local\Programs\Windsurf\Windsurf.exe"),
    ],
    "webstorm": [
        "webstorm.cmd",
        "webstorm64.exe",
        r"C:\Program Files\JetBrains\WebStorm*\bin\webstorm64.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\WebStorm\bin\webstorm64.exe"),
    ],
    "pycharm": [
        "pycharm.cmd",
        "pycharm64.exe",
        r"C:\Program Files\JetBrains\PyCharm*\bin\pycharm64.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\PyCharm\bin\pycharm64.exe"),
    ],
    "idea": [
        "idea.cmd",
        "idea64.exe",
        r"C:\Program Files\JetBrains\IntelliJ IDEA*\bin\idea64.exe",
    ],
    "subl": [
        "subl.exe",
        "subl",
        r"C:\Program Files\Sublime Text\sublime_text.exe",
        r"C:\Program Files\Sublime Text 3\sublime_text.exe",
    ],
    "explorer": [
        "explorer.exe",
    ]
}

def resolve_ide_command(ide_key: str) -> str:
    """Finds the executable command or path for the given IDE key."""
    ide_key = ide_key.lower().strip()
    candidates = COMMON_IDE_PATHS.get(ide_key, [ide_key])
    
    for candidate in candidates:
        # If it's a simple command name, check if in PATH
        if "\\" not in candidate:
            found = shutil.which(candidate)
            if found:
                return found
        else:
            # Check wildcard paths or direct paths
            if "*" in candidate:
                import glob
                matches = glob.glob(candidate)
                if matches:
                    return matches[-1]
            elif os.path.exists(candidate):
                return candidate
                
    # Fallback to key itself (will rely on Windows PATH)
    return ide_key

def get_installed_ides() -> List[Dict[str, Any]]:
    """Returns a list of detected IDEs with installed status."""
    results = []
    meta = {
        "antigravity": {"name": "Google Antigravity", "icon": "antigravity", "tag": "Google AI"},
        "cursor": {"name": "Cursor AI", "icon": "cursor", "tag": "AI First"},
        "code": {"name": "Visual Studio Code", "icon": "code", "tag": "Popular"},
        "windsurf": {"name": "Windsurf", "icon": "windsurf", "tag": "Agentic"},
        "webstorm": {"name": "WebStorm", "icon": "webstorm", "tag": "JetBrains"},
        "pycharm": {"name": "PyCharm", "icon": "pycharm", "tag": "Python"},
        "idea": {"name": "IntelliJ IDEA", "icon": "idea", "tag": "JVM"},
        "subl": {"name": "Sublime Text", "icon": "subl", "tag": "Lightweight"},
        "explorer": {"name": "Windows Explorer", "icon": "folder", "tag": "Folder"},
    }
    
    for key, info in meta.items():
        cmd = resolve_ide_command(key)
        # Check if actually found
        is_installed = False
        if "\\" in cmd and os.path.exists(cmd):
            is_installed = True
        elif shutil.which(cmd):
            is_installed = True
        elif key == "explorer":
            is_installed = True
            
        results.append({
            "id": key,
            "name": info["name"],
            "installed": is_installed,
            "tag": info["tag"],
            "resolvedCommand": cmd
        })
        
    return results

def launch_project_in_ide(project_path: str, ide_key: str = "code") -> Dict[str, Any]:
    """Launches the specified project directory in the requested IDE."""
    if not os.path.exists(project_path):
        return {"ok": False, "error": f"Project path does not exist: {project_path}"}
        
    resolved_cmd = resolve_ide_command(ide_key)
    
    try:
        if ide_key.lower() == "explorer":
            subprocess.Popen(["explorer.exe", os.path.abspath(project_path)])
            return {"ok": True, "ide": ide_key, "command": "explorer", "path": project_path}
            
        # Launch detached without keeping cmd window open
        if os.name == "nt":
            # For Windows cmd wrappers like code.cmd or cursor.cmd
            flags = subprocess.CREATE_NO_WINDOW if not resolved_cmd.lower().endswith((".exe", ".cmd", ".bat")) else 0
            cmd_line = f'"{resolved_cmd}" "{os.path.abspath(project_path)}"'
            subprocess.Popen(
                ["cmd.exe", "/c", "start", "", resolved_cmd, os.path.abspath(project_path)],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            subprocess.Popen([resolved_cmd, os.path.abspath(project_path)])
            
        return {
            "ok": True,
            "ide": ide_key,
            "command": resolved_cmd,
            "path": project_path
        }
    except Exception as e:
        # Fallback to direct shell execution
        try:
            subprocess.Popen(f'"{ide_key}" "{os.path.abspath(project_path)}"', shell=True)
            return {"ok": True, "ide": ide_key, "path": project_path}
        except Exception as err:
            return {"ok": False, "error": f"Failed to launch {ide_key}: {err}"}

# In-memory tracking of active background processes
ACTIVE_DEV_PROCESSES: Dict[str, subprocess.Popen] = {}

def detect_smart_dev_command(project_path: str) -> Dict[str, Any]:
    """Inspects project files, scripts, and subdirectories to determine the exact dev launch command."""
    if not os.path.exists(project_path):
        return {"command": "npm run dev", "working_dir": project_path, "framework": "Unknown", "port": 3000}

    # 1. Check root package.json
    pkg_path = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8", errors="ignore") as f:
                pkg = json.load(f)
                scripts = pkg.get("scripts", {})
                
                # Determine package manager
                pm = "npm"
                if os.path.exists(os.path.join(project_path, "pnpm-lock.yaml")):
                    pm = "pnpm"
                elif os.path.exists(os.path.join(project_path, "yarn.lock")):
                    pm = "yarn"
                elif os.path.exists(os.path.join(project_path, "bun.lockb")):
                    pm = "bun"

                # Pick preferred script
                for s in ["dev", "start", "serve", "watch", "preview"]:
                    if s in scripts:
                        return {
                            "command": f"{pm} run {s}" if pm != "yarn" and s != "dev" else f"{pm} {s}",
                            "working_dir": os.path.abspath(project_path),
                            "framework": "Node.js",
                            "port": 3000
                        }
        except Exception:
            pass

    # 2. Check Rust Cargo.toml
    if os.path.exists(os.path.join(project_path, "Cargo.toml")):
        if os.path.exists(os.path.join(project_path, "src-tauri")):
            return {"command": "cargo tauri dev", "working_dir": os.path.abspath(project_path), "framework": "Tauri", "port": 1420}
        return {"command": "cargo run", "working_dir": os.path.abspath(project_path), "framework": "Rust", "port": 8080}

    # 3. Check PHP Projects
    php_files = []
    try:
        php_files = [f for f in os.listdir(project_path) if f.endswith(".php")]
    except Exception:
        pass
    if php_files:
        return {
            "command": "php -S localhost:8000",
            "working_dir": os.path.abspath(project_path),
            "framework": "PHP Server",
            "port": 8000
        }

    # 4. Check Python
    py_files = []
    try:
        py_files = [f for f in os.listdir(project_path) if f.endswith(".py")]
    except Exception:
        pass
    if py_files:
        if "manage.py" in py_files:
            return {"command": "python manage.py runserver", "working_dir": os.path.abspath(project_path), "framework": "Django", "port": 8000}
        if "main.py" in py_files:
            try:
                with open(os.path.join(project_path, "main.py"), "r", encoding="utf-8", errors="ignore") as f:
                    c = f.read()
                    if "FastAPI" in c or "fastapi" in c:
                        return {"command": "uvicorn main:app --reload", "working_dir": os.path.abspath(project_path), "framework": "FastAPI", "port": 8000}
            except Exception:
                pass
            return {"command": "python main.py", "working_dir": os.path.abspath(project_path), "framework": "Python", "port": 5000}
        if "app.py" in py_files:
            return {"command": "python app.py", "working_dir": os.path.abspath(project_path), "framework": "Python", "port": 5000}

    # 5. Check subfolders for nested frontends (client, frontend, web)
    for sub in ["client", "frontend", "web", "app", "ui", "server", "backend"]:
        sub_dir = os.path.join(project_path, sub)
        if os.path.isdir(sub_dir):
            sub_pkg = os.path.join(sub_dir, "package.json")
            if os.path.exists(sub_pkg):
                return {
                    "command": f"cd {sub} && npm run dev",
                    "working_dir": os.path.abspath(project_path),
                    "framework": f"Nested {sub.capitalize()}",
                    "port": 3000
                }

    # 6. Static HTML fallback
    if os.path.exists(os.path.join(project_path, "index.html")):
        return {
            "command": "python -m http.server 3000",
            "working_dir": os.path.abspath(project_path),
            "framework": "Static HTML",
            "port": 3000
        }

    return {
        "command": "echo 'No dev script configured'",
        "working_dir": os.path.abspath(project_path),
        "framework": "Unknown",
        "port": 3000
    }

DANGEROUS_CMD_PATTERNS = [
    r"\bformat\b",
    r"\bdel\b",
    r"\berase\b",
    r"\brmdir\b",
    r"\brd\s+/[s|q]",
    r"\bshutdown\b",
    r"\breg\s+(add|delete)\b",
    r"\bnet\s+(user|localgroup)\b",
    r"\bvssadmin\b",
    r"\bcertutil\b",
    r"\bbitsadmin\b",
    r"\bpowershell.*(-enc|-encodedcommand)\b",
    r"\|\s*(iex|invoke-expression)",
    r"\|\s*(powershell|cmd|sh|bash)\b",
]

def is_command_safe(cmd_str: str) -> bool:
    if not cmd_str or not isinstance(cmd_str, str):
        return False
    import re
    lower_cmd = cmd_str.lower()
    for pattern in DANGEROUS_CMD_PATTERNS:
        if re.search(pattern, lower_cmd):
            return False
    return True

def run_project_dev_server(project_path: str, custom_cmd: str = None, mode: str = "hidden") -> Dict[str, Any]:
    """Launches the project dev server in hidden background mode or external terminal."""
    if not os.path.exists(project_path):
        return {"ok": False, "error": "Project path does not exist"}

    abs_path = os.path.abspath(project_path)
    lower_path = abs_path.lower()

    # Block launching dev servers in system directories
    for bad in ["c:\\windows", "c:\\program files", "c:\\program files (x86)", "c:\\programdata"]:
        if lower_path.startswith(bad):
            return {"ok": False, "error": "Security Alert: Access to system directories is restricted"}
    
    # Check if already running
    existing = ACTIVE_DEV_PROCESSES.get(abs_path)
    if existing and existing.poll() is None:
        return {
            "ok": True,
            "status": "already_running",
            "pid": existing.pid,
            "message": "Dev server is already active",
            "path": abs_path
        }

    # Detect command
    detected = detect_smart_dev_command(abs_path)
    run_cmd = custom_cmd.strip() if custom_cmd and custom_cmd.strip() else detected["command"]
    
    # Validate command safety
    if not is_command_safe(run_cmd):
        return {"ok": False, "error": "Security Alert: Command rejected by safety filter."}

    working_dir = detected.get("working_dir", abs_path)

    try:
        proj_name = os.path.basename(abs_path)

        if mode == "hidden":
            # Run detached in background without ANY popping CMD window
            log_dir = os.path.expanduser("~/.cortex/logs")
            os.makedirs(log_dir, exist_ok=True)
            log_file = os.path.join(log_dir, f"dev_{proj_name}.log")
            
            with open(log_file, "a", encoding="utf-8") as out:
                proc = subprocess.Popen(
                    run_cmd,
                    cwd=working_dir,
                    shell=True,
                    stdout=out,
                    stderr=out,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                )
                ACTIVE_DEV_PROCESSES[abs_path] = proc

            return {
                "ok": True,
                "status": "running",
                "mode": "hidden",
                "command": run_cmd,
                "pid": proc.pid,
                "framework": detected.get("framework", "Auto"),
                "port": detected.get("port", 3000),
                "path": abs_path
            }
        else:
            # Interactive Terminal Window
            full_command = f'start "{proj_name} - Dev Server" cmd.exe /k "cd /d "{working_dir}" && {run_cmd}"'
            subprocess.Popen(full_command, shell=True)
            return {
                "ok": True,
                "status": "launched_terminal",
                "mode": "terminal",
                "command": run_cmd,
                "path": abs_path
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def stop_project_dev_server(project_path: str) -> Dict[str, Any]:
    """Stops the active background dev server for the given project path."""
    abs_path = os.path.abspath(project_path)
    proc = ACTIVE_DEV_PROCESSES.get(abs_path)
    if proc and proc.poll() is None:
        try:
            if os.name == "nt":
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stderr=subprocess.DEVNULL)
            else:
                proc.terminate()
            ACTIVE_DEV_PROCESSES.pop(abs_path, None)
            return {"ok": True, "status": "stopped", "path": abs_path}
        except Exception as e:
            return {"ok": False, "error": str(e)}
            
    ACTIVE_DEV_PROCESSES.pop(abs_path, None)
    return {"ok": True, "status": "not_running", "path": abs_path}

def get_dev_server_status(project_path: str) -> Dict[str, Any]:
    """Returns the current execution status of a project's dev server."""
    abs_path = os.path.abspath(project_path)
    proc = ACTIVE_DEV_PROCESSES.get(abs_path)
    if proc and proc.poll() is None:
        return {"ok": True, "running": True, "pid": proc.pid, "path": abs_path}
    return {"ok": True, "running": False, "pid": None, "path": abs_path}

def get_all_active_dev_servers() -> List[Dict[str, Any]]:
    """Returns a list of all project paths with actively running background dev servers."""
    active = []
    for path, proc in list(ACTIVE_DEV_PROCESSES.items()):
        if proc and proc.poll() is None:
            active.append({"path": path, "pid": proc.pid})
        else:
            ACTIVE_DEV_PROCESSES.pop(path, None)
    return active

def get_project_dev_logs(project_path: str, max_lines: int = 150) -> Dict[str, Any]:
    """Reads the latest log output from the background dev server."""
    if not project_path:
        return {"ok": False, "error": "Missing project path", "logs": ""}

    proj_name = os.path.basename(os.path.abspath(project_path))
    log_dir = os.path.expanduser("~/.cortex/logs")
    log_file = os.path.join(log_dir, f"dev_{proj_name}.log")

    if not os.path.exists(log_file):
        return {"ok": True, "logs": "No active logs recorded yet for this project.", "path": log_file}

    try:
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            recent_lines = lines[-max_lines:] if len(lines) > max_lines else lines
            return {"ok": True, "logs": "".join(recent_lines), "path": log_file}
    except Exception as e:
        return {"ok": False, "error": str(e), "logs": ""}

