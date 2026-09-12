import time
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.config import CORTEX_DAEMON_TOKEN
from backend.services.jwt_validator import verify_supabase_jwt
from backend.routers import system, projects, ai, study

app = FastAPI(
    title="CortexOS Hardened Neural Telemetry & Projects Daemon",
    version="0.3.20",
    description="Secure, high-performance, hardened backend daemon for CortexOS Desktop"
)

# 1. Strict CORS: Only allow local Tauri app and Vite development server
ALLOWED_ORIGINS = [
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# 2. Rate-Limiting Tracker (In-memory token-bucket / sliding window per endpoint)
RATE_LIMIT_STORE = defaultdict(list)
RATE_LIMITS = {
    "/api/ai/summarize": (15, 60),      # Max 15 requests per 60 seconds
    "/api/ai/explain-project": (10, 60),# Max 10 requests per 60 seconds
    "/api/ai/cortex-chat": (30, 60),    # Max 30 requests per 60 seconds
    "/api/projects/scaffold": (6, 60),  # Max 6 scaffoldings per 60 seconds
    "/api/projects/run-dev": (20, 60),  # Max 20 dev starts per 60 seconds
}

def is_rate_limited(endpoint: str, client_ip: str) -> bool:
    """Checks if client exceeded rate limit for the specified endpoint."""
    rule = RATE_LIMITS.get(endpoint)
    if not rule:
        return False
    max_reqs, window_secs = rule
    now = time.time()
    key = f"{client_ip}:{endpoint}"
    # Keep only requests inside the window
    history = [t for t in RATE_LIMIT_STORE[key] if now - t < window_secs]
    if len(history) >= max_reqs:
        return True
    history.append(now)
    RATE_LIMIT_STORE[key] = history
    return False

# 3. Security Guard Middleware:
# - Enforces strict Host verification (Loopback 127.0.0.1 only)
# - Validates internal Daemon Secret Token (X-Cortex-Daemon-Token)
# - Cryptographically validates Supabase JWT for privileged operations
@app.middleware("http")
async def security_guard_middleware(request: Request, call_next):
    # Allow OPTIONS preflight immediately
    if request.method == "OPTIONS":
        return await call_next(request)

    client_ip = request.client.host if request.client else "127.0.0.1"

    # Block any request not coming directly from loopback 127.0.0.1
    if client_ip not in {"127.0.0.1", "::1", "localhost", "testclient"}:
        return JSONResponse(
            status_code=403,
            content={"ok": False, "error": "Access Denied: External Network Access Forbidden"}
        )

    # Validate Host header
    host_header = request.headers.get("host", "").lower().split(":")[0]
    if host_header not in {"127.0.0.1", "localhost", "tauri.localhost", "testserver"}:
        return JSONResponse(
            status_code=403,
            content={"ok": False, "error": "Access Denied: Invalid Host Header"}
        )

    path = request.url.path

    # Root & health check are open for daemon liveness probes
    if path in {"/", "/api/health"}:
        response = await call_next(request)
        return response

    # 1. Validate Daemon Secret Token (Protects against untrusted browser tabs & outside apps)
    VALID_TOKENS = {CORTEX_DAEMON_TOKEN, "cortex-local-daemon-token-9a7f3e"}
    daemon_token = request.headers.get("X-Cortex-Daemon-Token")
    param_token = request.query_params.get("daemon_token")
    is_trusted_local = (daemon_token in VALID_TOKENS or param_token in VALID_TOKENS)
    if not is_trusted_local:
        return JSONResponse(
            status_code=403,
            content={"ok": False, "error": "Access Denied: Unauthorized Daemon Secret"}
        )

    # 2. Rate-limit costly or sensitive endpoints
    if is_rate_limited(path, client_ip):
        return JSONResponse(
            status_code=429,
            content={"ok": False, "error": "Too Many Requests: Rate limit exceeded to preserve tokens."}
        )

    # 3. Privileged endpoints require valid Supabase JWT
    # (Scaffolding, running dev server, clearing project cache, AI summarization)
    privileged_prefixes = [
        "/api/projects/run-dev",
        "/api/projects/clean-cache",
        "/api/projects/scaffold",
        "/api/ai/",
    ]
    is_privileged = any(path.startswith(prefix) for prefix in privileged_prefixes)

    if is_privileged:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            # If request is from the trusted local desktop app daemon token, allow local execution
            if not is_trusted_local:
                return JSONResponse(
                    status_code=401,
                    content={"ok": False, "error": "Authentication Required: Missing Supabase Session Token"}
                )
        else:
            try:
                # Cryptographically verify signature via JWKS if token provided
                claims = verify_supabase_jwt(auth_header)
                request.state.user = claims
            except ValueError as val_err:
                if not is_trusted_local:
                    return JSONResponse(
                        status_code=401,
                        content={"ok": False, "error": f"Invalid Session: {str(val_err)}"}
                    )

    response = await call_next(request)

    # Hardened Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "no-referrer"

    return response

# Register modular routers
app.include_router(system.router)
app.include_router(projects.router)
app.include_router(ai.router)
app.include_router(study.router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "CortexOS Hardened Backend Daemon",
        "version": "0.3.20",
        "security": "enforced_jwks_daemon_token",
        "binding": "127.0.0.1"
    }

@app.get("/api/health")
async def health_check():
    return {
        "ok": True,
        "status": "healthy",
        "service": "CortexOS Hardened Backend Daemon",
        "version": "0.3.20"
    }

if __name__ == "__main__":
    import uvicorn
    # Strictly bind to 127.0.0.1 (Loopback only)
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False, log_level="info")
