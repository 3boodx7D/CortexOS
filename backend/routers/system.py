from fastapi import APIRouter, Query, Body
from typing import Optional, Dict, Any
from backend.services.system_service import (
    get_telemetry_data,
    get_system_info_data,
    pick_directory_dialog,
    get_hardware_details_data,
    flush_standby_memory,
    launch_tool_cmd
)
from backend.services.backup_service import (
    save_cortex_backup,
    list_cortex_backups,
    read_cortex_backup,
    delete_cortex_backup,
    open_backup_directory,
    get_default_backup_dir
)

router = APIRouter(prefix="/api/system", tags=["system"])

@router.get("/telemetry")
def get_telemetry():
    return get_telemetry_data()

@router.get("/info")
def get_system_info():
    return get_system_info_data()

@router.get("/pick-directory")
@router.post("/pick-directory")
def pick_directory():
    return pick_directory_dialog()

@router.get("/hardware")
def get_hardware_details():
    return get_hardware_details_data()

@router.post("/flush-ram")
def flush_standby_ram():
    return flush_standby_memory()

@router.post("/launch/{tool}")
def launch_system_tool(tool: str):
    return launch_tool_cmd(tool)

# Backup System Endpoints (Threadpool managed)
@router.get("/backup/default-dir")
def get_default_backup_directory():
    return {"default_dir": get_default_backup_dir()}

@router.post("/backup/create")
def create_backup(payload: Dict[str, Any] = Body(...)):
    backup_dir = payload.get("backup_dir", "")
    data = payload.get("data", {})
    res = save_cortex_backup(backup_dir, data)
    return res

@router.get("/backup/list")
def list_backups(dir: Optional[str] = Query(None)):
    target_dir = dir or get_default_backup_dir()
    res = list_cortex_backups(target_dir)
    return res

@router.post("/backup/restore")
def restore_backup(payload: Dict[str, Any] = Body(...)):
    file_path = payload.get("file_path", "")
    res = read_cortex_backup(file_path)
    return res

@router.post("/backup/delete")
def delete_backup(payload: Dict[str, Any] = Body(...)):
    file_path = payload.get("file_path", "")
    res = delete_cortex_backup(file_path)
    return res

@router.post("/backup/open-folder")
def open_backup_folder(payload: Dict[str, Any] = Body(...)):
    backup_dir = payload.get("backup_dir", "")
    res = open_backup_directory(backup_dir or get_default_backup_dir())
    return res
