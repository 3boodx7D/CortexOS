from fastapi import APIRouter, Query, Body
from typing import Optional, Dict, Any
from backend.models.schemas import (
    ScanProjectsRequest,
    ScanProjectsResponse,
    LaunchIdeRequest,
    RunDevRequest,
    CleanCacheRequest,
    CleanCacheResponse
)
from backend.services.project_scanner import scan_workspace_directory, get_project_file_tree
from backend.services.ide_launcher import (
    get_installed_ides,
    launch_project_in_ide,
    run_project_dev_server,
    stop_project_dev_server,
    get_dev_server_status,
    get_all_active_dev_servers,
    detect_smart_dev_command,
    get_project_dev_logs
)
from backend.services.cleaner import clean_project_cache
from backend.services.ai_service import analyze_error_logs
from backend.services.backup_service import (
    create_project_zip_snapshot,
    list_project_zip_snapshots,
    restore_project_zip_snapshot,
    open_backup_directory
)
from backend.services.scaffolder import scaffold_ai_custom_project, scaffold_template_project
from backend.config import DEFAULT_WORKSPACE_PATH

router = APIRouter(prefix="/api/projects", tags=["projects"])

# Synchronous endpoints: FastAPI automatically runs standard 'def' in threadpool workers,
# preventing heavy disk I/O from blocking the main asyncio event loop!
@router.get("/scan", response_model=ScanProjectsResponse)
def scan_projects_get(path: Optional[str] = Query(None)):
    target_path = path or DEFAULT_WORKSPACE_PATH
    res = scan_workspace_directory(target_path)
    return res

@router.post("/scan", response_model=ScanProjectsResponse)
def scan_projects_post(req: ScanProjectsRequest):
    target_path = req.path or DEFAULT_WORKSPACE_PATH
    res = scan_workspace_directory(target_path)
    return res

@router.get("/available-ides")
def list_available_ides():
    return {"ides": get_installed_ides()}

@router.post("/launch-ide")
def launch_ide(req: LaunchIdeRequest):
    res = launch_project_in_ide(req.project_path, req.ide)
    return res

@router.post("/run-dev")
def run_dev(req: RunDevRequest):
    res = run_project_dev_server(req.project_path, req.command, req.mode or "hidden")
    return res

@router.post("/stop-dev")
def stop_dev(payload: Dict[str, Any] = Body(...)):
    path = payload.get("project_path", "")
    res = stop_project_dev_server(path)
    return res

@router.get("/dev-status")
def check_dev_status(path: str = Query(...)):
    res = get_dev_server_status(path)
    return res

@router.get("/active-devs")
def list_active_devs():
    return {"ok": True, "active": get_all_active_dev_servers()}

@router.get("/logs")
def get_logs(path: str = Query(...), max_lines: int = Query(150)):
    res = get_project_dev_logs(path, max_lines)
    return res

@router.post("/analyze-logs")
def analyze_logs_endpoint(payload: Dict[str, Any] = Body(...)):
    logs = payload.get("logs", "")
    project_name = payload.get("project_name", "Unknown Project")
    stack = payload.get("stack", [])
    provider = payload.get("provider", "auto")
    res = analyze_error_logs(logs, project_name, stack, provider)
    return res

@router.get("/detect-command")
def detect_command(path: str = Query(...)):
    res = detect_smart_dev_command(path)
    return res

@router.get("/files")
def get_files(path: str = Query(...)):
    res = get_project_file_tree(path)
    return res

@router.post("/clean-cache", response_model=CleanCacheResponse)
def clean_cache(req: CleanCacheRequest):
    res = clean_project_cache(req.project_path, req.targets)
    return res

# ------------------------------------------------------------------------------
# PROJECT ZIP BACKUP ENDPOINTS
# ------------------------------------------------------------------------------
@router.post("/backup/create")
def create_backup(payload: Dict[str, Any] = Body(...)):
    project_path = payload.get("project_path", "")
    version_tag = payload.get("version_tag", "v1.0.0")
    note = payload.get("note", "")
    backup_dir = payload.get("backup_dir", "")
    res = create_project_zip_snapshot(project_path, version_tag, note, backup_dir)
    return res

@router.get("/backup/list")
def list_backups(project_path: str = Query(...), backup_dir: Optional[str] = Query(None)):
    res = list_project_zip_snapshots(project_path, backup_dir or "")
    return res

@router.post("/backup/restore")
def restore_backup(payload: Dict[str, Any] = Body(...)):
    zip_path = payload.get("zip_path", "")
    target_dir = payload.get("target_dir", "")
    res = restore_project_zip_snapshot(zip_path, target_dir)
    return res

@router.post("/backup/open-folder")
def open_backup_folder(payload: Dict[str, Any] = Body(...)):
    backup_dir = payload.get("backup_dir", "")
    res = open_backup_directory(backup_dir)
    return res

# ------------------------------------------------------------------------------
# ZERO-TO-HERO AI SCAFFOLDING ENDPOINT
# ------------------------------------------------------------------------------
@router.post("/scaffold")
def scaffold_project(payload: Dict[str, Any] = Body(...)):
    mode = payload.get("mode", "ai")
    workspace_path = payload.get("workspace_path") or DEFAULT_WORKSPACE_PATH
    project_name = payload.get("project_name", "my-new-app")
    prompt = payload.get("prompt", "")
    stack_type = payload.get("stack_type", "web")
    template_id = payload.get("template_id", "saas-next15")
    provider = payload.get("provider", "gemini-pro")

    if mode == "ai" and prompt:
        res = scaffold_ai_custom_project(
            workspace_path=workspace_path,
            project_name=project_name,
            prompt=prompt,
            stack_type=stack_type,
            provider=provider
        )
    else:
        res = scaffold_template_project(
            workspace_path=workspace_path,
            project_name=project_name,
            template_id=template_id
        )
    return res

