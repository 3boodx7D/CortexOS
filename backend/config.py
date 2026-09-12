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

# AI Models (Cost-optimized and verified via official APIs)
GEMINI_CHEAP_MODEL = "gemini-3.5-flash-lite"     # Ultra-fast, credit-saver for explanations, quizzes & summaries
GEMINI_PRO_MODEL = "gemini-3.6-flash"           # High-performance reasoning for scaffolding & code architecture
DEEPSEEK_FLASH_MODEL = "deepseek-chat"           # Ultra-fast, responsive chat generation
DEEPSEEK_PRO_MODEL = "deepseek-chat"             # Balanced reasoning tier
DEEPSEEK_ULTRA_MODEL = "deepseek-reasoner"       # R1 multi-matrix reasoning & proof engine
DEEPSEEK_MODEL = DEEPSEEK_FLASH_MODEL            # Default alias

# Daemon Security Token (In-memory token passed via environment variable)
CORTEX_DAEMON_TOKEN = os.getenv("CORTEX_DAEMON_TOKEN", os.getenv("VITE_CORTEX_DAEMON_TOKEN", "cortex-local-daemon-token-9a7f3e"))

# Supabase Auth JWKS Endpoint
SUPABASE_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""

# Default fallback path
DEFAULT_WORKSPACE_PATH = "D:\\dev26-27"
if not os.path.exists(DEFAULT_WORKSPACE_PATH):
    if os.path.exists("C:\\Projects"):
        DEFAULT_WORKSPACE_PATH = "C:\\Projects"
    else:
        DEFAULT_WORKSPACE_PATH = os.path.expanduser("~/Projects")

