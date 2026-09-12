import sys
import os
import io

# Setup safe stdout/stderr streams before importing any library
# When packaged as a Windows GUI app (--noconsole), sys.stdout and sys.stderr are None,
# which causes libraries like uvicorn (which call sys.stdout.isatty()) to crash.
log_path = os.path.join(os.environ.get("TEMP", os.path.expanduser("~")), "cortex-backend.log")
try:
    log_file = open(log_path, "a", encoding="utf-8", buffering=1)
except Exception:
    log_file = None

class SafeStream:
    def __init__(self, fallback):
        self.fallback = fallback
    def write(self, s):
        if self.fallback:
            try:
                self.fallback.write(s)
            except Exception:
                pass
    def flush(self):
        if self.fallback:
            try:
                self.fallback.flush()
            except Exception:
                pass
    def isatty(self):
        return False

if sys.stdout is None:
    sys.stdout = SafeStream(log_file)
if sys.stderr is None:
    sys.stderr = SafeStream(log_file)
if sys.stdin is None:
    sys.stdin = io.StringIO()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.main import app
import uvicorn

if __name__ == "__main__":
    # Ensure Windows console encoding handles utf-8 cleanly when running with console
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    # In GUI mode without console, disable uvicorn's colored log formatter
    # which tries to inspect terminal tty
    log_config = uvicorn.config.LOGGING_CONFIG.copy()
    if "formatters" in log_config:
        for fmt in log_config["formatters"].values():
            if isinstance(fmt, dict) and "use_colors" in fmt:
                fmt["use_colors"] = False

    # Strictly bind to 127.0.0.1
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_config=log_config,
        log_level="info",
        access_log=False
    )
