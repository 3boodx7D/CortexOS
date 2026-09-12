import os
from fastapi import APIRouter
from backend.models.schemas import (
    SummarizeRequest,
    SummarizeResponse,
    ExplainProjectRequest,
    ExplainProjectResponse,
    ScaffoldProjectRequest,
    ScaffoldProjectResponse,
    QuizRequest,
    QuizResponse,
    FlashcardsRequest,
    FlashcardsResponse,
    CortexChatRequest,
    CortexChatResponse
)
from backend.services.ai_service import (
    summarize_text,
    explain_project_outside,
    generate_quiz,
    generate_flashcards,
    synthesize_cortex_chat
)
from backend.services.project_scanner import detect_project_stack
from backend.services.scaffolder import (
    STARTER_TEMPLATES,
    scaffold_template_project,
    scaffold_ai_custom_project
)

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/cortex-chat", response_model=CortexChatResponse)
async def cortex_chat_endpoint(req: CortexChatRequest):
    return synthesize_cortex_chat(req)

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest):
    res = summarize_text(req.text, req.provider)
    return res

@router.get("/templates")
async def get_templates():
    templates_summary = []
    for tid, info in STARTER_TEMPLATES.items():
        templates_summary.append({
            "id": tid,
            "name": info["name"],
            "description": info["description"],
            "stack": info["stack"],
            "category": info["category"]
        })
    return {"templates": templates_summary}

@router.post("/explain-project", response_model=ExplainProjectResponse)
async def explain_project(req: ExplainProjectRequest):
    project_path = req.project_path
    if not os.path.exists(project_path):
        return ExplainProjectResponse(
            ok=False,
            error=f"Project folder not found: {project_path}"
        )
        
    project_name = os.path.basename(project_path)
    stack = detect_project_stack(project_path)
    
    # Read snippet of package.json
    pkg_snippet = ""
    pkg_path = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8", errors="ignore") as f:
                pkg_snippet = f.read(1500)
        except Exception:
            pass
            
    # Read snippet of README.md
    readme_snippet = ""
    for r in ["README.md", "readme.md", "README.txt"]:
        rp = os.path.join(project_path, r)
        if os.path.exists(rp):
            try:
                with open(rp, "r", encoding="utf-8", errors="ignore") as f:
                    readme_snippet = f.read(2000)
                    break
            except Exception:
                pass
                
    # Run analysis using credit-saving Gemini 3.5 Flash Lite or DeepSeek
    res = explain_project_outside(
        project_name=project_name,
        stack=stack,
        package_json_snippet=pkg_snippet,
        readme_snippet=readme_snippet,
        provider_preference=req.provider
    )
    return res

@router.post("/scaffold", response_model=ScaffoldProjectResponse)
async def scaffold_project(req: ScaffoldProjectRequest):
    if req.mode == "ai" and req.prompt:
        res = scaffold_ai_custom_project(
            workspace_path=req.workspace_path,
            project_name=req.project_name,
            prompt=req.prompt,
            stack_type=req.stack_type or "web",
            provider=req.provider
        )
    else:
        template_id = req.template_id or "saas-next15"
        res = scaffold_template_project(
            workspace_path=req.workspace_path,
            project_name=req.project_name,
            template_id=template_id
        )
    return res

@router.post("/quiz", response_model=QuizResponse)
async def quiz_endpoint(req: QuizRequest):
    res = generate_quiz(req.text, req.provider, count=req.count, difficulty=req.difficulty)
    return res

@router.post("/flashcards", response_model=FlashcardsResponse)
async def flashcards_endpoint(req: FlashcardsRequest):
    res = generate_flashcards(req.text, req.provider)
    return res
