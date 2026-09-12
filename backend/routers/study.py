import json
import re
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel, Field

from backend.services.study_vault import (
    init_vault,
    get_vault_path,
    set_vault_path,
    list_courses,
    create_course,
    update_course,
    delete_course,
    list_lessons,
    get_lesson,
    save_lesson,
    delete_lesson,
    open_in_explorer
)
from backend.services.document_parser import parse_document
from backend.services.ai_service import (
    call_gemini,
    call_deepseek,
    GEMINI_CHEAP_MODEL,
    GEMINI_PRO_MODEL,
    DEEPSEEK_FLASH_MODEL,
    DEEPSEEK_PRO_MODEL
)

router = APIRouter(prefix="/api/study", tags=["study"])


# Request Models
class CreateCourseRequest(BaseModel):
    title: str
    code: Optional[str] = ""
    description: Optional[str] = ""
    color: Optional[str] = "#00aff4"


class UpdateCourseRequest(BaseModel):
    title: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class SaveLessonRequest(BaseModel):
    title: Optional[str] = None
    order: Optional[int] = None
    tags: Optional[List[str]] = None
    source: Optional[str] = None
    summary: Optional[str] = None
    eli5: Optional[str] = None
    quiz: Optional[List[Dict[str, Any]]] = None
    flashcards: Optional[List[Dict[str, Any]]] = None
    references: Optional[List[Dict[str, Any]]] = None
    quiz_history: Optional[List[Dict[str, Any]]] = None


class OpenExplorerRequest(BaseModel):
    course_id: Optional[str] = ""
    lesson_id: Optional[str] = ""


class SetVaultPathRequest(BaseModel):
    path: str


class CortexSynthesizeRequest(BaseModel):
    course_id: str
    lesson_id: Optional[str] = None
    lesson_title: Optional[str] = None
    text: str
    mode: str = "all"  # "all" | "summary" | "eli5" | "quiz" | "flashcards" | "references"
    provider: str = "cortex-ensemble"  # "cortex-ensemble" | "gemini" | "deepseek"


class CortexChatRequest(BaseModel):
    lesson_context: str
    message: str
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list)
    provider: str = "cortex-ensemble"


# --- File Parsing & Ingestion Endpoints ---

@router.post("/parse-file")
async def api_parse_file(file: UploadFile = File(...)):
    """Accepts uploaded PDF/DOCX/TXT file and parses its text content using native extractors."""
    try:
        content = await file.read()
        parsed = parse_document(file.filename or "lecture.pdf", content)
        if not parsed.get("ok"):
            return {"ok": False, "error": parsed.get("error", "Failed to parse document")}
        return parsed
    except Exception as e:
        return {"ok": False, "error": f"Failed reading file: {str(e)}"}


# --- Vault Endpoints ---

@router.get("/vault/init")
async def api_init_vault():
    return init_vault()


@router.get("/vault/path")
async def api_get_vault_path():
    p = get_vault_path()
    return {"ok": True, "vault_path": str(p)}


@router.post("/vault/set-path")
async def api_set_vault_path(req: SetVaultPathRequest):
    new_p = set_vault_path(req.path)
    return {"ok": True, "vault_path": str(new_p)}


@router.post("/vault/open-explorer")
async def api_open_explorer(req: OpenExplorerRequest):
    success = open_in_explorer(req.course_id or "", req.lesson_id or "")
    return {"ok": success}


@router.get("/vault/courses")
async def api_list_courses():
    courses = list_courses()
    return {"ok": True, "courses": courses}


@router.post("/vault/courses")
async def api_create_course(req: CreateCourseRequest):
    course = create_course(
        title=req.title,
        code=req.code or "",
        description=req.description or "",
        color=req.color or "#00aff4"
    )
    return {"ok": True, "course": course}


@router.put("/vault/courses/{course_id}")
async def api_update_course(course_id: str, req: UpdateCourseRequest):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    try:
        updated = update_course(course_id, updates)
        return {"ok": True, "course": updated}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/vault/courses/{course_id}")
async def api_delete_course(course_id: str):
    success = delete_course(course_id)
    return {"ok": success}


@router.get("/vault/courses/{course_id}/lessons")
async def api_list_lessons(course_id: str):
    lessons = list_lessons(course_id)
    return {"ok": True, "lessons": lessons}


@router.get("/vault/courses/{course_id}/lessons/{lesson_id}")
async def api_get_lesson(course_id: str, lesson_id: str):
    try:
        lesson = get_lesson(course_id, lesson_id)
        return {"ok": True, "lesson": lesson}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/vault/courses/{course_id}/lessons")
async def api_create_lesson(course_id: str, req: SaveLessonRequest):
    lesson_title = req.title or "New Lesson"
    lesson_id = re.sub(r'[^a-zA-Z0-9_-]', '-', lesson_title).lower().strip('-')
    saved = save_lesson(course_id, lesson_id, req.model_dump())
    return {"ok": True, "lesson": saved}


@router.put("/vault/courses/{course_id}/lessons/{lesson_id}")
async def api_update_lesson(course_id: str, lesson_id: str, req: SaveLessonRequest):
    data = req.model_dump(exclude_unset=True)
    try:
        saved = save_lesson(course_id, lesson_id, data)
        return {"ok": True, "lesson": saved}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/vault/courses/{course_id}/lessons/{lesson_id}")
async def api_delete_lesson(course_id: str, lesson_id: str):
    success = delete_lesson(course_id, lesson_id)
    return {"ok": success}


# --- Document Parser Endpoint ---

@router.post("/parse-file")
async def api_parse_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        res = parse_document(file.filename, contents)
        return res
    except Exception as e:
        return {"ok": False, "error": f"Document parsing failed: {str(e)}"}


# --- CORTEXAI Multi-Model Synthesis & Chat ---

def clean_json_response(raw: str) -> str:
    """Strips markdown code blocks from LLM output."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
    return cleaned.strip()


@router.post("/cortex-synthesize")
async def api_cortex_synthesize(req: CortexSynthesizeRequest):
    """
    CORTEXAI Ensemble Synthesis:
    Coordinates multi-model generation for Structured Summary, ELI5 explanation,
    interactive Quiz, Memory Flashcards, and Reference recommendations.
    Saves results directly to the course lesson in the local vault.
    """
    course_id = req.course_id
    text = req.text
    if not text.strip():
        raise HTTPException(status_code=400, detail="Lecture or document text is empty")
        
    mode = req.mode
    provider_pref = req.provider
    
    # Track results
    summary_text: Optional[str] = None
    eli5_text: Optional[str] = None
    quiz_items: Optional[List[Dict[str, Any]]] = None
    flashcards_items: Optional[List[Dict[str, Any]]] = None
    references_items: Optional[List[Dict[str, Any]]] = None

    # Helper router for LLM calls based on provider preference
    def call_ai(prompt: str, system_prompt: str, prefer: str = "auto", max_tokens: int = 1536) -> str:
        if prefer == "deepseek" or (prefer == "auto" and provider_pref == "deepseek"):
            try:
                res = call_deepseek(prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=max_tokens)
                return res["text"]
            except Exception:
                pass
                
        # Try Gemini (high context / fast)
        try:
            res = call_gemini(prompt, model=GEMINI_CHEAP_MODEL, system_prompt=system_prompt, max_tokens=max_tokens)
            return res["text"]
        except Exception:
            # Fallback to DeepSeek
            res = call_deepseek(prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=max_tokens)
            return res["text"]

    # 1. STRUCTURED SUMMARY & KEY CONCEPTS
    if mode in ["all", "summary"]:
        summary_sys = (
            "You are CORTEXAI Technical Synthesizer. Analyze the study material and generate a pristine, "
            "academic-grade Markdown summary. Include:\n"
            "## 🎯 Key Takeaways & Core Concepts\n"
            "## 📐 High-Yield Formulas & Definitions (with LaTeX math if applicable)\n"
            "## ⚡ Common Exam Traps & Nuances\n"
            "## 💡 Actionable Insights\n"
            "Be crystal-clear, dense in information, and maintain dual-language support (English/Arabic) if the source was bilingual."
        )
        summary_prompt = f"Please synthesize this lecture content into high-yield structured notes:\n\n{text[:12000]}"
        try:
            summary_text = call_ai(summary_prompt, summary_sys, prefer="gemini", max_tokens=1536)
        except Exception as e:
            summary_text = f"### Summary\n\n{text[:500]}..."

    # 2. ELI5 (Explain Like I'm 5 & Intuitive Mental Models)
    if mode in ["all", "eli5"]:
        eli5_sys = (
            "You are CORTEXAI Intuition Architect. Your job is to explain the most abstract, difficult concepts "
            "in this lesson using vivid real-world analogies, intuitive mechanical or visual models, and simple language (ELI5). "
            "Make it impossible for the student to ever forget how it works. Format with clean Markdown."
        )
        eli5_prompt = f"Explain the core concept from this lecture to a 5-year-old using unforgettable analogies:\n\n{text[:8000]}"
        try:
            eli5_text = call_ai(eli5_prompt, eli5_sys, prefer="deepseek", max_tokens=1200)
        except Exception as e:
            eli5_text = "ELI5 explanation could not be generated at this time."

    # 3. INTERACTIVE QUIZ & EXAM QUESTIONS
    if mode in ["all", "quiz"]:
        quiz_sys = (
            "You are CORTEXAI Exam Architect. Generate exactly 5 challenging multiple-choice questions "
            "testing deep conceptual comprehension and application, NOT just rote memorization.\n"
            "Return ONLY a valid JSON array of objects with this exact structure:\n"
            "[\n"
            "  {\n"
            '    "id": "q1",\n'
            '    "question": "Clear, precise question stem?",\n'
            '    "choices": ["Option A", "Option B", "Option C", "Option D"],\n'
            '    "correct": 1,\n'
            '    "explanation": "Thorough explanation of why option 1 is correct and why the other options are common traps."\n'
            "  }\n"
            "]\n"
            "Do NOT include markdown backticks or commentary outside the JSON array."
        )
        quiz_prompt = f"Generate 5 exam-grade multiple-choice questions based on this lecture:\n\n{text[:10000]}"
        try:
            raw_quiz = call_ai(quiz_prompt, quiz_sys, prefer="deepseek", max_tokens=1536)
            cleaned = clean_json_response(raw_quiz)
            quiz_items = json.loads(cleaned)
        except Exception as e:
            quiz_items = [
                {
                    "id": "q1",
                    "question": "What is the primary core concept covered in this lecture?",
                    "choices": ["Core Architectural Principles", "Unrelated Subject", "Obsolete Technique", "None of the above"],
                    "correct": 0,
                    "explanation": "The lecture directly establishes the fundamental core principles."
                }
            ]

    # 4. MEMORY FLASHCARDS
    if mode in ["all", "flashcards"]:
        fc_sys = (
            "You are CORTEXAI Spaced-Repetition Master. Generate 6 high-yield flashcards from this lecture material.\n"
            "Return ONLY a valid JSON array of objects with this exact structure:\n"
            "[\n"
            '  {"id": "fc1", "front": "Sharp prompt, term, or question", "back": "Precise, memorable answer or definition"}\n'
            "]\n"
            "Do NOT include markdown backticks or commentary."
        )
        fc_prompt = f"Generate 6 flashcards from this text:\n\n{text[:8000]}"
        try:
            raw_fc = call_ai(fc_prompt, fc_sys, prefer="gemini", max_tokens=1000)
            cleaned = clean_json_response(raw_fc)
            flashcards_items = json.loads(cleaned)
        except Exception as e:
            flashcards_items = []

    # 5. SMART REFERENCES & YOUTUBE RECOMMENDATIONS
    if mode in ["all", "references"]:
        ref_sys = (
            "You are CORTEXAI Academic Curator. Suggest 3-4 top educational references (e.g. YouTube search queries for 3Blue1Brown, MIT OCW, Stanford, or Wikipedia/ArXiv links) "
            "that provide the best visual explanations or foundational papers for the topics in this text.\n"
            "Return ONLY a valid JSON array of objects:\n"
            "[\n"
            '  {"title": "Title of Resource", "url": "Direct or YouTube Search URL", "type": "youtube|paper|article", "publisher": "Channel/Author"}\n'
            "]\n"
            "Format YouTube searches as: https://www.youtube.com/results?search_query=topic+keywords\n"
            "Do NOT include markdown backticks or commentary."
        )
        ref_prompt = f"Curate educational references and YouTube video searches for this content:\n\n{text[:6000]}"
        try:
            raw_ref = call_ai(ref_prompt, ref_sys, prefer="gemini", max_tokens=1000)
            cleaned = clean_json_response(raw_ref)
            references_items = json.loads(cleaned)
        except Exception:
            references_items = [
                {
                    "title": "Search Topic on YouTube",
                    "url": f"https://www.youtube.com/results?search_query={re.sub(r'[^a-zA-Z0-9]', '+', req.lesson_title or 'Computer Science')}",
                    "type": "youtube",
                    "publisher": "YouTube Education"
                }
            ]

    # Save directly to vault if lesson_id or lesson_title is provided
    lesson_id = req.lesson_id
    if not lesson_id:
        lesson_id = re.sub(r'[^a-zA-Z0-9_-]', '-', req.lesson_title or "cortex-lesson").lower().strip('-')
        
    save_payload: Dict[str, Any] = {
        "title": req.lesson_title or lesson_id,
        "source": text
    }
    if summary_text is not None:
        save_payload["summary"] = summary_text
    if eli5_text is not None:
        save_payload["eli5"] = eli5_text
    if quiz_items is not None:
        save_payload["quiz"] = quiz_items
    if flashcards_items is not None:
        save_payload["flashcards"] = flashcards_items
    if references_items is not None:
        save_payload["references"] = references_items

    updated_lesson = save_lesson(course_id, lesson_id, save_payload)

    return {
        "ok": True,
        "course_id": course_id,
        "lesson_id": lesson_id,
        "summary": summary_text,
        "eli5": eli5_text,
        "quiz": quiz_items,
        "flashcards": flashcards_items,
        "references": references_items,
        "lesson": updated_lesson
    }


@router.post("/cortex-chat")
async def api_cortex_chat(req: CortexChatRequest):
    """Contextual conversational tutor for the active lesson."""
    context = req.lesson_context[:10000]
    sys_prompt = (
        "You are CORTEXAI Personal Academic Tutor. You are helping a student master this specific lesson. "
        "Answer their questions concisely, accurately, and with engaging pedagogical insight. "
        "Use LaTeX for mathematical notation ($math$) where helpful."
    )
    
    chat_prompt = f"Lesson Context:\n\"\"\"\n{context}\n\"\"\"\n\nStudent Question:\n{req.message}"
    
    try:
        # Default to Gemini Pro or DeepSeek
        if req.provider == "deepseek":
            res = call_deepseek(chat_prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=sys_prompt, max_tokens=1024)
        else:
            res = call_gemini(chat_prompt, model=GEMINI_PRO_MODEL, system_prompt=sys_prompt, max_tokens=1024)
            
        return {
            "ok": True,
            "provider": res.get("provider", "google"),
            "model": res.get("model", "cortex-ensemble"),
            "reply": res.get("text", "")
        }
    except Exception as e:
        return {
            "ok": False,
            "error": f"CORTEXAI tutor unavailable: {str(e)}",
            "reply": "I'm having trouble connecting to the neural synthesis engine right now. Please verify your API keys or check your connection."
        }
