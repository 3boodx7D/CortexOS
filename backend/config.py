import os
from pathlib import Path

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
ENV_FILE = PROJECT_ROOT / ".env"

def load_env_file():
    """Load key-value pairs from .env if present into os.environ."""
    if ENV_FILE.exists():
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception as e:
            print(f"[config] Warning loading .env: {e}")

load_env_file()

# Credentials & API Keys
GOOGLE_AI_API_KEY = os.getenv("GOOGLE_AI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", ""))
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", ""))

# AI Models
GEMINI_CHEAP_MODEL = "gemini-3.6-flash"         # Fast, credit-saver for explanations & summaries
GEMINI_PRO_MODEL = "gemini-3.6-flash"           # Powerful reasoning for code scaffolding & architecture
DEEPSEEK_MODEL = "deepseek-chat"                # Alternative high-power model

# Default fallback path
DEFAULT_WORKSPACE_PATH = "D:\\dev26-27"
if not os.path.exists(DEFAULT_WORKSPACE_PATH):
    if os.path.exists("C:\\Projects"):
        DEFAULT_WORKSPACE_PATH = "C:\\Projects"
    else:
        DEFAULT_WORKSPACE_PATH = os.path.expanduser("~/Projects")
