import ipaddress
import urllib.parse
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.routers import system, projects, ai

app = FastAPI(
    title="CortexOS Neural Telemetry & Projects Engine",
    version="1.1.0",
    description="High-performance, hardened backend daemon for CortexOS"
)

def is_safe_local_or_private_host(hostname: str) -> bool:
    if not hostname:
        return True
    hostname = hostname.lower().strip()
    if hostname in {"localhost", "127.0.0.1", "tauri.localhost"}:
        return True
    try:
        ip = ipaddress.ip_address(hostname)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False

# 1. CORS: Allow Localhost, Tauri, and Local Network (for phone / cross-device access)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?|tauri://localhost|https://tauri\.localhost)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# 2. Security Middleware: Block Public Internet Sites from Accessing Localhost
@app.middleware("http")
async def security_guard_middleware(request: Request, call_next):
    # Host header check (allow local addresses, reject external domains)
    host_header = request.headers.get("host", "").lower().split(":")[0]
    if host_header and not is_safe_local_or_private_host(host_header):
        return JSONResponse(
            status_code=403,
            content={"ok": False, "error": "Access Denied: External Host Not Permitted"}
        )

    # Origin header check: Block external internet sites from making fetch calls to this daemon
    origin = request.headers.get("origin")
    if origin:
        parsed = urllib.parse.urlparse(origin)
        if parsed.hostname and not is_safe_local_or_private_host(parsed.hostname):
            return JSONResponse(
                status_code=403,
                content={"ok": False, "error": "Access Denied: Cross-Origin Request from Public Internet Blocked"}
            )

    response = await call_next(request)

    # Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "no-referrer"

    return response

# Register modular routers
app.include_router(system.router)
app.include_router(projects.router)
app.include_router(ai.router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "CortexOS Hardened Backend Daemon",
        "version": "1.1.0",
        "security": "enforced"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
