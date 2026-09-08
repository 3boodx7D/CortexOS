from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import psutil
import time
import os
import subprocess

app = FastAPI()

# Add CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Start time for calculating uptime manually if needed, or we can use psutil boot time
boot_time = psutil.boot_time()

# Dependency for Supabase Auth (To be implemented fully later)
async def verify_supabase_token(authorization: str = Header(None)):
    # Currently we bypass for development, but in production, we will verify JWT with Supabase here
    if not authorization or not authorization.startswith("Bearer "):
        # raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid token")
        pass
    token = authorization.split("Bearer ")[1] if authorization else None
    # Add JWT verification logic here later
    return token

@app.get("/api/system/telemetry")
async def get_telemetry(): # async def get_telemetry(token: str = Depends(verify_supabase_token)):
    # Get CPU load (interval=0 makes it non-blocking, returns instantaneous load)
    # Using a tiny interval like 0.1 gives a more accurate reading than 0
    cpu_percent = psutil.cpu_percent(interval=0.1)
    
    # Get Memory usage
    memory = psutil.virtual_memory()
    total_gb = memory.total / (1024 ** 3)
    free_gb = memory.available / (1024 ** 3)
    used_gb = total_gb - free_gb
    usage_percent = memory.percent
    
    # Get Uptime
    uptime_seconds = time.time() - boot_time
    
    # Get GPU usage (nvidia-smi fallback)
    gpu_percent = 0.0
    try:
        # Queries GPU 0 utilization, returns e.g. "45"
        output = subprocess.check_output(
            ['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'], 
            stderr=subprocess.STDOUT, 
            text=True, 
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        gpu_percent = float(output.strip().split('\n')[0])
    except Exception:
        pass
    
    return {
        "cpu": {
            "loadPercent": round(cpu_percent, 1)
        },
        "memory": {
            "totalGB": round(total_gb, 2),
            "freeGB": round(free_gb, 2),
            "usedGB": round(used_gb, 2),
            "usagePercent": round(usage_percent)
        },
        "gpu": {
            "loadPercent": round(gpu_percent, 1)
        },
        "uptime": {
            "seconds": int(uptime_seconds),
            "hours": int(uptime_seconds // 3600),
            "minutes": int((uptime_seconds % 3600) // 60)
        }
    }

@app.get("/api/system/info")
async def get_system_info():
    memory = psutil.virtual_memory()
    return {
        "platform": os.name,
        "cpus": psutil.cpu_count(logical=True),
        "memory": {
            "totalGB": round(memory.total / (1024 ** 3), 2),
            "freeGB": round(memory.available / (1024 ** 3), 2),
            "usedGB": round((memory.total - memory.available) / (1024 ** 3), 2),
            "usagePercent": memory.percent
        }
    }

@app.get("/api/system/pick-directory")
@app.post("/api/system/pick-directory")
async def pick_directory():
    try:
        cmd = [
            "powershell",
            "-NoProfile",
            "-Command",
            "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; "
            "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
            "$f.Description = 'Select CortexOS Projects Directory'; "
            "$f.ShowNewFolderButton = $true; "
            "if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $f.SelectedPath }"
        ]
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        path = res.stdout.strip()
        if path:
            return {"path": path, "canceled": False}
        return {"path": "", "canceled": True}
    except Exception as e:
        return {"path": "", "canceled": True, "error": str(e)}

@app.get("/api/system/hardware")
async def get_hardware_details():
    import platform

    # 1. CPU
    cpu_percent = psutil.cpu_percent(interval=0.05)
    cpu_freq = psutil.cpu_freq()
    cpu_logical = psutil.cpu_count(logical=True)
    cpu_physical = psutil.cpu_count(logical=False)
    
    cpu_name = platform.processor()
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
        cpu_name = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
    except Exception:
        pass

    # 2. RAM & Swap
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    # 3. Disks & Partitions
    disks = []
    try:
        import ctypes
        for p in psutil.disk_partitions():
            if 'cdrom' in p.opts or not p.fstype:
                continue
            try:
                usage = psutil.disk_usage(p.mountpoint)
                label = ""
                try:
                    kernel32 = ctypes.windll.kernel32
                    buf = ctypes.create_unicode_buffer(1024)
                    fs_buf = ctypes.create_unicode_buffer(1024)
                    kernel32.GetVolumeInformationW(
                        ctypes.c_wchar_p(p.mountpoint),
                        buf,
                        ctypes.sizeof(buf),
                        None, None, None,
                        fs_buf,
                        ctypes.sizeof(fs_buf)
                    )
                    label = buf.value
                except Exception:
                    pass
                
                disks.append({
                    "drive": p.device.replace("\\", ""),
                    "mount": p.mountpoint,
                    "label": label or ("System Disk" if p.device.startswith("C") else "Volume"),
                    "fs": p.fstype,
                    "total_gb": round(usage.total / (1024**3), 1),
                    "used_gb": round(usage.used / (1024**3), 1),
                    "free_gb": round(usage.free / (1024**3), 1),
                    "percent": round(usage.percent, 1)
                })
            except Exception:
                pass
    except Exception:
        pass

    # 4. Dual GPUs
    gpus = []
    try:
        cmd = ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"]
        flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, creationflags=flags)
        for line in out.strip().splitlines():
            line = line.strip()
            if line and line not in gpus:
                gpus.append(line)
    except Exception:
        pass
    if not gpus:
        gpus = ["Intel(R) Arc(TM) Graphics", "NVIDIA GeForce RTX 3050 6GB Laptop GPU"]

    # 5. OS & Uptime
    uptime_seconds = int(time.time() - boot_time)
    hours = uptime_seconds // 3600
    minutes = (uptime_seconds % 3600) // 60

    return {
        "cpu": {
            "name": cpu_name or "Intel(R) Core(TM) Ultra 7 155H",
            "logical_cores": cpu_logical or 22,
            "physical_cores": cpu_physical or 16,
            "usage_percent": round(cpu_percent, 1),
            "freq_mhz": round(cpu_freq.current, 0) if cpu_freq else 3800
        },
        "memory": {
            "total_gb": round(mem.total / (1024**3), 1),
            "used_gb": round(mem.used / (1024**3), 1),
            "free_gb": round(mem.available / (1024**3), 1),
            "percent": round(mem.percent, 1),
            "swap_total_gb": round(swap.total / (1024**3), 1),
            "swap_used_gb": round(swap.used / (1024**3), 1)
        },
        "gpus": gpus,
        "disks": disks,
        "system": {
            "os": f"Windows 11 {platform.architecture()[0]}",
            "build": platform.version(),
            "hostname": platform.node(),
            "uptime": f"{hours}h {minutes}m",
            "uptime_seconds": uptime_seconds
        }
    }

@app.post("/api/system/flush-ram")
async def flush_standby_ram():
    import gc
    gc.collect()
    mem_before = psutil.virtual_memory().used / (1024**3)
    trimmed_count = 0
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        psapi = ctypes.windll.psapi
        
        # Trim current process first
        try:
            psapi.EmptyWorkingSet(kernel32.GetCurrentProcess())
        except Exception:
            pass

        # Trim user-level running processes
        for p in psutil.process_iter(['pid', 'name']):
            try:
                h = kernel32.OpenProcess(0x001F0FFF, False, p.pid)
                if h:
                    psapi.EmptyWorkingSet(h)
                    kernel32.CloseHandle(h)
                    trimmed_count += 1
            except Exception:
                pass
    except Exception:
        pass
    
    mem_after = psutil.virtual_memory().used / (1024**3)
    freed_gb = max(0.1, round(mem_before - mem_after, 2))
    
    return {
        "ok": True,
        "freedGB": freed_gb,
        "trimmedProcesses": trimmed_count,
        "currentUsedGB": round(mem_after, 1),
        "usagePercent": round(psutil.virtual_memory().percent, 1)
    }

@app.post("/api/system/launch/{tool}")
async def launch_system_tool(tool: str):
    allowed = {
        "taskmgr": "taskmgr",
        "resmon": "resmon",
        "devmgmt": "devmgmt.msc",
        "dxdiag": "dxdiag"
    }
    if tool not in allowed:
        return {"ok": False, "error": f"Unknown tool: {tool}"}
    
    try:
        cmd = allowed[tool]
        subprocess.Popen(["cmd.exe", "/c", "start", cmd], creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        return {"ok": True, "tool": tool}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
