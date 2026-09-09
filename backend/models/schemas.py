from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ProjectItem(BaseModel):
    id: str
    name: str
    path: str
    description: str = ""
    status: str = "active"  # "active" | "client" | "experiment" | "archived"
    stack: List[str] = Field(default_factory=list)
    progress: int = 0
    updated: str = "Recently"
    disk_size_mb: float = 0.0
    node_modules_size_mb: float = 0.0
    has_node_modules: bool = False
    git_branch: Optional[str] = None
    git_last_commit: Optional[str] = None
    git_remote: Optional[str] = None
    ai_summary: Optional[Dict[str, Any]] = None

class ScanProjectsRequest(BaseModel):
    path: str

class ScanProjectsResponse(BaseModel):
    ok: bool = True
    path: str = ""
    count: int = 0
    total_disk_mb: float = 0.0
    total_node_modules_mb: float = 0.0
    projects: List[ProjectItem] = Field(default_factory=list)
    error: Optional[str] = None

class LaunchIdeRequest(BaseModel):
    project_path: str
    ide: str = "code"  # code | cursor | windsurf | webstorm | pycharm | idea | subl | explorer

class RunDevRequest(BaseModel):
    project_path: str
    command: Optional[str] = None
    mode: Optional[str] = "hidden"

class CleanCacheRequest(BaseModel):
    project_path: str
    targets: List[str] = Field(default_factory=lambda: ["node_modules", ".next", "dist", "target", ".venv"])

class CleanCacheResponse(BaseModel):
    ok: bool
    freed_mb: float = 0.0
    deleted_folders: List[str] = Field(default_factory=list)
    error: Optional[str] = None

class ExplainProjectRequest(BaseModel):
    project_path: str
    provider: str = "gemini-lite"  # "gemini-lite" | "gemini-pro" | "deepseek" | "auto"

class ExplainProjectResponse(BaseModel):
    ok: bool = True
    provider: str = "google"
    model: str = "gemini-3.5-flash-lite"
    summary: str = ""
    role: str = ""
    architecture: str = ""
    run_command: str = ""
    error: Optional[str] = None

class ScaffoldProjectRequest(BaseModel):
    mode: str = "template"  # "template" | "ai"
    template_id: Optional[str] = None
    project_name: str
    workspace_path: str
    prompt: Optional[str] = None
    stack_type: Optional[str] = "web"
    provider: str = "gemini-pro"  # "gemini-pro" | "deepseek"

class ScaffoldProjectResponse(BaseModel):
    ok: bool = True
    project_path: str = ""
    project_name: str = ""
    files_created: List[str] = Field(default_factory=list)
    error: Optional[str] = None

class SummarizeRequest(BaseModel):
    text: str
    provider: str = "auto"
    systemPrompt: Optional[str] = None
    taskType: str = "summary"

class SummarizeResponse(BaseModel):
    summary: Optional[str] = None
    provider: str
    model: str
    quiz: Optional[List[Dict[str, Any]]] = None
    flashcards: Optional[List[Dict[str, str]]] = None
    text: Optional[str] = None

class QuizRequest(BaseModel):
    text: str
    provider: str = "auto"

class QuizResponse(BaseModel):
    ok: bool = True
    provider: str = "google"
    model: str = "gemini-3.5-flash-lite"
    quiz: Optional[List[Dict[str, Any]]] = None
    text: Optional[str] = None
    error: Optional[str] = None

class FlashcardsRequest(BaseModel):
    text: str
    provider: str = "auto"

class FlashcardsResponse(BaseModel):
    ok: bool = True
    provider: str = "google"
    model: str = "gemini-3.5-flash-lite"
    flashcards: Optional[List[Dict[str, str]]] = None
    text: Optional[str] = None
    error: Optional[str] = None
