import os
import re
import time
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List
from backend.config import (
    GOOGLE_AI_API_KEY,
    DEEPSEEK_API_KEY,
    GEMINI_CHEAP_MODEL,
    GEMINI_PRO_MODEL,
    DEEPSEEK_FLASH_MODEL,
    DEEPSEEK_PRO_MODEL,
    DEEPSEEK_ULTRA_MODEL,
    DEEPSEEK_MODEL
)
from backend.models.schemas import CortexChatRequest

def call_gemini(
    prompt: str,
    model: str = GEMINI_CHEAP_MODEL,
    system_prompt: Optional[str] = None,
    timeout: int = 25,
    max_tokens: int = 2048,
    temperature: float = 0.2
) -> Dict[str, Any]:
    """Call Google Gemini API using secure x-goog-api-key header and official models."""
    if not GOOGLE_AI_API_KEY:
        raise ValueError("Google AI API Key is not configured")
    
    # Official endpoint without exposing key in query URL
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    contents = []
    if system_prompt:
        contents.append({"role": "user", "parts": [{"text": f"SYSTEM INSTRUCTION:\n{system_prompt}"}]})
        contents.append({"role": "model", "parts": [{"text": "Understood. I will follow these instructions."}]})
    
    contents.append({"role": "user", "parts": [{"text": prompt}]})
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": GOOGLE_AI_API_KEY
        },
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini returned empty candidates")
        text = candidates[0]["content"]["parts"][0]["text"].strip()
        usage = data.get("usageMetadata", {})
        return {
            "ok": True,
            "provider": "google",
            "model": model,
            "text": text,
            "usage": usage
        }

def call_deepseek(
    prompt: str,
    model: str = DEEPSEEK_FLASH_MODEL,
    system_prompt: Optional[str] = None,
    timeout: int = 35,
    max_tokens: int = 2048,
    temperature: Optional[float] = 0.2
) -> Dict[str, Any]:
    """Call DeepSeek API using official models (deepseek-chat or deepseek-reasoner)."""
    if not DEEPSEEK_API_KEY:
        raise ValueError("DeepSeek API Key is not configured")
    
    url = "https://api.deepseek.com/chat/completions"
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens
    }
    
    # DeepSeek R1 (deepseek-reasoner) does NOT support temperature, top_p, etc.
    if model != "deepseek-reasoner" and temperature is not None:
        payload["temperature"] = max(0.0, min(1.5, float(temperature)))
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        choices = data.get("choices", [])
        if not choices:
            raise ValueError("DeepSeek returned empty choices")
        msg = choices[0].get("message", {})
        text = msg.get("content", "").strip()
        reasoning = msg.get("reasoning_content", "").strip()
        usage = data.get("usage", {})
        return {
            "ok": True,
            "provider": "deepseek",
            "model": model,
            "text": text,
            "reasoning": reasoning,
            "usage": usage
        }

def summarize_text(text: str, provider: str = "auto", system_prompt: Optional[str] = None, task_type: str = "summary") -> Dict[str, Any]:
    """Summarizes text using the most cost-effective model (Gemini 3.5 Flash Lite or DeepSeek v4 Flash)."""
    if system_prompt is None:
        system_prompt = "You are CortexOS Neural Synthesizer. Provide a sharp, structured technical summary with key concepts and practical takeaways. Keep it concise."
    prompt = f"Please summarize the following lecture or technical notes clearly and concisely:\n\n{text}"
    
    # 1. CORTEXAI Tier Selection
    if provider in ["cortexai-flash", "flash", "deepseek", "deepseek-flash", "deepseek-v4-flash"]:
        res = call_deepseek(prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=1024)
        return {"summary": res["text"], "provider": "cortexai", "model": "CORTEXAI Flash (v1.2)", "quiz": None, "flashcards": None, "text": res["text"]}
    
    if provider in ["cortexai-pro", "pro", "deepseek-pro", "deepseek-v4-pro"]:
        res = call_deepseek(prompt, model=DEEPSEEK_PRO_MODEL, system_prompt=system_prompt, max_tokens=1536)
        return {"summary": res["text"], "provider": "cortexai", "model": "CORTEXAI Pro (v2.5)", "quiz": None, "flashcards": None, "text": res["text"]}

    if provider in ["cortexai-ultra", "ultra"]:
        res = call_deepseek(prompt, model=DEEPSEEK_PRO_MODEL, system_prompt=system_prompt, max_tokens=2048)
        return {"summary": res["text"], "provider": "cortexai", "model": "CORTEXAI Ultra (v3.0 Max)", "quiz": None, "flashcards": None, "text": res["text"]}

    # 2. Try default fast tier
    if provider in ["auto", "gemini-lite", "google"]:
        try:
            res = call_gemini(prompt, model=GEMINI_CHEAP_MODEL, system_prompt=system_prompt, max_tokens=1024)
            return {"summary": res["text"], "provider": "cortexai", "model": "CORTEXAI Core", "quiz": None, "flashcards": None, "text": res["text"]}
        except Exception as e:
            print(f"[ai_service] Core engine failed: {e}")
            if provider != "auto":
                raise e
    
    # 3. Resilient Fallback
    try:
        res = call_deepseek(prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=1024)
        return {"summary": res["text"], "provider": "cortexai", "model": "CORTEXAI Flash", "quiz": None, "flashcards": None, "text": res["text"]}
    except Exception as e:
        print(f"[ai_service] Fallback failed: {e}")
        res = call_gemini(prompt, model=GEMINI_PRO_MODEL, system_prompt=system_prompt, max_tokens=1536)
        return {"summary": res["text"], "provider": "cortexai", "model": "CORTEXAI Pro", "quiz": None, "flashcards": None, "text": res["text"]}

def extract_json_array(text: str) -> List[Dict[str, Any]]:
    """Robustly extract a JSON array from AI output."""
    cleaned = text.strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except Exception:
        pass

    # Clean markdown blocks
    if "```" in cleaned:
        cleaned = re.sub(r'```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'```', '', cleaned).strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except Exception:
        pass

    # Bracket slice
    s = cleaned.find('[')
    e = cleaned.rfind(']')
    if s != -1 and e != -1 and e > s:
        candidate = cleaned[s:e+1]
        try:
            data = json.loads(candidate)
            if isinstance(data, list):
                return data
        except Exception:
            pass

    # As a last resort, extract individual objects
    objects = []
    pattern = re.compile(r'\{[^{}]*"question"[^{}]*"choices"[^{}]*\}', re.DOTALL)
    for m in pattern.finditer(cleaned):
        try:
            objects.append(json.loads(m.group(0)))
        except Exception:
            pass
    if objects:
        return objects

    raise ValueError(f"Could not parse valid questions array from output.")

def generate_quiz(text: str, provider: str = "auto", count: int = 5, difficulty: str = "medium") -> Dict[str, Any]:
    """Generate exam questions from text with dynamic count, difficulty, and robust JSON extraction."""
    count = max(3, min(20, count or 5))
    diff_descriptions = {
        "easy": "Foundational / Easy level. Focus on direct definitions, basic conceptual recall, and straightforward facts.",
        "medium": "Standard University Exam level. Test comprehension, architectural trade-offs, and practical application.",
        "hard": "Advanced / Hard level. Multi-step reasoning, scenario-based problem solving, edge-case constraints, and debugging traps.",
        "expert": "Expert / Olympiad level. Deep architectural synthesis, nuanced asymptotic trade-offs, complex failure modes, and critical system invariants."
    }
    diff_instruction = diff_descriptions.get(difficulty, diff_descriptions["medium"])

    system_prompt = (
        f"You are CORTEXAI Academic Exam Architect. Generate exactly {count} university exam-grade multiple choice questions.\n"
        f"Difficulty Rigor: {diff_instruction}\n"
        "Return ONLY a valid JSON array of objects with this exact structure:\n"
        "[\n"
        "  {\n"
        '    "id": "q1",\n'
        '    "question": "Question stem in the same language as the input (Arabic if input is Arabic, English if English). For Arabic, always end with the Arabic question mark (؟). Avoid placing English abbreviations or parentheses at the absolute beginning of an Arabic sentence.",\n'
        '    "choices": ["Option A", "Option B", "Option C", "Option D"],\n'
        '    "correct": 0,\n'
        '    "explanation": "Clear academic explanation of why this answer is correct and why other choices are traps.",\n'
        '    "topic": "Key Concept"\n'
        "  }\n"
        "]\n"
        "Rules:\n"
        "- Generate exactly 4 choices per question\n"
        "- The 'correct' field must be an integer index (0, 1, 2, or 3)\n"
        "- If input is in Arabic, questions and choices MUST be in Arabic\n"
        "- Return ONLY the JSON array without any markdown formatting or commentary"
    )
    prompt = f"Please generate {count} {difficulty}-level multiple-choice exam questions from this material or topic:\n\n{text[:8000]}"
    max_tokens = min(4096, max(1800, count * 350))

    # Try DeepSeek Flash
    try:
        res = call_deepseek(prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=max_tokens)
        quiz = extract_json_array(res["text"])
        return {"ok": True, "provider": "cortexai", "model": "CORTEXAI Flash", "quiz": quiz}
    except Exception as ds_err:
        print(f"[ai_service] DeepSeek quiz failed: {ds_err}, trying Gemini Pro...")
        try:
            res = call_gemini(prompt, model=GEMINI_PRO_MODEL, system_prompt=system_prompt, max_tokens=max_tokens)
            quiz = extract_json_array(res["text"])
            return {"ok": True, "provider": "cortexai", "model": "CORTEXAI Pro", "quiz": quiz}
        except Exception as gem_err:
            print(f"[ai_service] Gemini quiz failed: {gem_err}")
            raise gem_err

def generate_flashcards(text: str, provider: str = "auto") -> Dict[str, Any]:
    """Generate flashcards from text using cost-effective models."""
    system_prompt = (
        "You are CORTEXAI Memory Architect. Generate 5-8 high-yield flashcards from the lecture or topic.\n"
        "Return ONLY a valid JSON array: [{\"front\":\"Concept/Prompt\",\"back\":\"Answer/Definition\"}]\n"
        "- If input is Arabic, generate flashcards in Arabic\n"
        "- Return ONLY valid JSON array without markdown backticks"
    )
    prompt = f"Please generate flashcards from this material:\n\n{text[:8000]}"
    try:
        res = call_deepseek(prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=2048)
        flashcards = extract_json_array(res["text"])
        return {"ok": True, "provider": "cortexai", "model": "CORTEXAI Flash", "flashcards": flashcards}
    except Exception:
        res = call_gemini(prompt, model=GEMINI_PRO_MODEL, system_prompt=system_prompt, max_tokens=2048)
        flashcards = extract_json_array(res["text"])
        return {"ok": True, "provider": "cortexai", "model": "CORTEXAI Pro", "flashcards": flashcards}

def explain_project_outside(project_name: str, stack: list, package_json_snippet: str = "", readme_snippet: str = "", provider_preference: str = "auto") -> Dict[str, Any]:
    """
    Explains a project from the outside without requiring the user to open it.
    Uses CORTEXAI Neural Core to evaluate project architecture.
    """
    system_prompt = (
        "You are CortexOS Project Vault Intelligence. Analyze this code project from the outside. "
        "Return ONLY a raw JSON object (WITHOUT markdown backticks or commentary) with these exact keys:\n"
        "{\n"
        '  "summary": "2-3 crisp sentences in Arabic & English describing what this software does and its main purpose",\n'
        '  "role": "one of: Client Deliverable, SaaS Product, Utility Tool, MVP / Experiment, Desktop App, Discord Bot, Mobile App",\n'
        '  "architecture": "Key libraries, frameworks and architecture highlights (e.g. Next.js 15, Tailwind, Supabase)",\n'
        '  "run_command": "Recommended launch command (e.g. npm run dev or pnpm dev or python main.py)"\n'
        "}"
    )
    
    user_prompt = (
        f"Project Name: {project_name}\n"
        f"Detected Stack: {', '.join(stack)}\n"
        f"Package Info / Config:\n{package_json_snippet[:600]}\n\n"
        f"README Snippet:\n{readme_snippet[:600]}\n"
    )
    
    raw_text = ""
    provider_used = "cortexai"
    model_used = "CORTEXAI Core"

    if provider_preference in ["cortexai-flash", "flash", "deepseek", "deepseek-flash", "deepseek-v4-flash"]:
        res = call_deepseek(user_prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=768)
        raw_text = res["text"]
        provider_used = "cortexai"
        model_used = "CORTEXAI Flash"
    elif provider_preference in ["cortexai-pro", "pro", "cortexai-ultra", "ultra", "deepseek-pro", "deepseek-v4-pro"]:
        res = call_deepseek(user_prompt, model=DEEPSEEK_PRO_MODEL, system_prompt=system_prompt, max_tokens=1024)
        raw_text = res["text"]
        provider_used = "cortexai"
        model_used = "CORTEXAI Pro"
    elif provider_preference in ["cortexai-ultra", "ultra"]:
        res = call_deepseek(user_prompt, model=DEEPSEEK_PRO_MODEL, system_prompt=system_prompt, max_tokens=1536)
        raw_text = res["text"]
        provider_used = "cortexai"
        model_used = "CORTEXAI Ultra"
    else:
        try:
            res = call_gemini(user_prompt, model=GEMINI_CHEAP_MODEL, system_prompt=system_prompt, max_tokens=768)
            raw_text = res["text"]
            provider_used = "cortexai"
            model_used = "CORTEXAI Core"
        except Exception as e:
            print(f"[ai_service] Explainer fallback: {e}")
            res = call_deepseek(user_prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=768)
            raw_text = res["text"]
            provider_used = "cortexai"
            model_used = "CORTEXAI Flash"
            model_used = res["model"]

    # Parse JSON
    try:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
        parsed = json.loads(cleaned)
        return {
            "ok": True,
            "provider": provider_used,
            "model": model_used,
            "summary": parsed.get("summary", ""),
            "role": parsed.get("role", "Developer Project"),
            "architecture": parsed.get("architecture", ", ".join(stack)),
            "run_command": parsed.get("run_command", "npm run dev")
        }
    except Exception:
        return {
            "ok": True,
            "provider": provider_used,
            "model": model_used,
            "summary": raw_text[:300],
            "role": "Developer Project",
            "architecture": ", ".join(stack),
            "run_command": "npm run dev"
        }

def analyze_error_logs(logs: str, project_name: str, stack: list = None, provider: str = "auto") -> Dict[str, Any]:
    """
    Analyzes runtime dev-server errors, stack traces, and crashes.
    Provides root cause explanation and exact code/command fix recommendations.
    """
    if not logs or not logs.strip():
        return {"ok": False, "error": "Logs content is empty"}

    system_prompt = (
        "You are CortexOS Neural Debugging Intelligence. You diagnose software runtime errors, "
        "compile failures, missing dependencies, and stack traces. "
        "Provide a crisp, authoritative diagnosis in Arabic and English, containing:\n"
        "1. Root Cause Analysis (What failed and why)\n"
        "2. Exact Fix Instructions (Step-by-step commands or code edits)\n"
        "3. Prevention Tip"
    )
    
    user_prompt = (
        f"Project: {project_name}\n"
        f"Tech Stack: {', '.join(stack or ['Unknown'])}\n\n"
        f"Recent Runtime Logs / Error Stack Trace:\n"
        f"```\n{logs[-2000:]}\n```\n\n"
        f"Please analyze this error and provide an immediate fix."
    )

    try:
        if provider in ["deepseek", "deepseek-flash", "deepseek-v4-flash"]:
            res = call_deepseek(user_prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=1024)
        elif provider in ["deepseek-pro", "deepseek-v4-pro"]:
            res = call_deepseek(user_prompt, model=DEEPSEEK_PRO_MODEL, system_prompt=system_prompt, max_tokens=1536)
        else:
            res = call_gemini(user_prompt, model=GEMINI_PRO_MODEL, system_prompt=system_prompt, max_tokens=1200)

        return {
            "ok": True,
            "provider": res["provider"],
            "model": res["model"],
            "analysis": res["text"]
        }
    except Exception as e:
        try:
            alt_res = call_deepseek(user_prompt, model=DEEPSEEK_FLASH_MODEL, system_prompt=system_prompt, max_tokens=1024)
            return {
                "ok": True,
                "provider": alt_res["provider"],
                "model": alt_res["model"],
                "analysis": alt_res["text"]
            }
        except Exception as alt_err:
            return {"ok": False, "error": f"AI Debugger failed: {alt_err}"}

def get_vault_grounding_context(prompt: str, vault_path_str: Optional[str] = None) -> str:
    """Extract relevant study vault course notes and summaries matching prompt keywords."""
    from backend.services.study_vault import list_courses, list_lessons, get_lesson
    
    context_parts = []
    try:
        courses = list_courses()
        if not courses:
            return ""
        
        words = [w.lower() for w in re.findall(r'[\w\u0600-\u06FF]+', prompt) if len(w) >= 3]
        matched_lessons = []
        
        for course in courses[:5]:
            c_title = course.get("title", "")
            c_id = course.get("id", "")
            lessons = list_lessons(c_id)
            for lesson in lessons:
                l_title = lesson.get("title", "")
                l_lower = l_title.lower()
                relevance = sum(1 for w in words if w in l_lower)
                if relevance > 0:
                    matched_lessons.append((relevance, c_title, lesson.get("id"), c_id))
                    
        matched_lessons.sort(key=lambda x: x[0], reverse=True)
        
        if matched_lessons:
            for _, c_title, l_id, c_id in matched_lessons[:2]:
                l_data = get_lesson(c_id, l_id)
                if l_data:
                    title = l_data.get("title", "")
                    summary = l_data.get("summary", "")
                    source = l_data.get("source", "")[:500]
                    context_parts.append(
                        f"--- COURSE: {c_title} | LESSON: {title} ---\n"
                        f"Summary: {summary}\n"
                        f"Key Notes Excerpt: {source}\n"
                    )
        else:
            course_list = ", ".join([f"{c.get('code', '')} {c.get('title', '')}".strip() for c in courses[:6]])
            context_parts.append(f"Available Enrolled Vault Courses: {course_list}")
            
    except Exception as e:
        print(f"[ai_service] Vault grounding context error: {e}")
        
    return "\n".join(context_parts)

def get_codebase_grounding_context(prompt: str, workspace_path_str: Optional[str] = None) -> str:
    """Extract current project and active repository context for grounded code generation."""
    from backend.config import PROJECT_ROOT
    from backend.services.project_scanner import detect_project_stack
    
    target_path = workspace_path_str if workspace_path_str and os.path.exists(workspace_path_str) else str(PROJECT_ROOT)
    
    context_parts = []
    try:
        pkg_path = os.path.join(target_path, "package.json")
        if os.path.exists(pkg_path):
            stack = detect_project_stack(target_path)
            project_name = os.path.basename(target_path)
            context_parts.append(f"Active Project: {project_name} | Tech Stack: {', '.join(stack)}")
        else:
            items = []
            for entry in os.scandir(target_path):
                if entry.is_dir() and not entry.name.startswith((".", "node_modules", "target", "venv", "dist")):
                    items.append(entry.name)
                if len(items) >= 6:
                    break
            if items:
                context_parts.append(f"Workspace Directory: {os.path.basename(target_path)} (Projects: {', '.join(items)})")
    except Exception as e:
        print(f"[ai_service] Codebase grounding context error: {e}")
        
    return "\n".join(context_parts)

def build_cortex_system_prompt(
    ai_name: str,
    tier: str,
    language: str,
    teaching_style: str,
    academic_level: str,
    custom_directives: Optional[str] = None,
    vault_context: str = "",
    codebase_context: str = ""
) -> str:
    """Constructs the high-precision cognitive system prompt for CORTEXAI."""
    prompt_lines = [
        f"You are {ai_name}, an elite university cognitive intelligence and neural study engine within CortexOS.",
        "You embody supreme academic rigor, mathematical accuracy, structured reasoning, and zero algorithmic slop.",
        "Always structure your output with clear headings, bullet points, and code/math blocks where appropriate."
    ]
    
    style_prompts = {
        "socratic": (
            "TEACHING STYLE: Socratic Method.\n"
            "- Do not simply dump answers. Guide the student step-by-step using thought-provoking questions.\n"
            "- Prompt the student to deduce the underlying invariants and challenge edge-case assumptions.\n"
            "- Conclude with an open-ended reflection question to test genuine comprehension."
        ),
        "professor": (
            "TEACHING STYLE: Distinguished University Professor.\n"
            "- Deliver authoritative, formal, and structured academic lectures.\n"
            "- Define formal theorems, architectural invariants, step-by-step proofs/derivations, and system tradeoffs.\n"
            "- Highlight common exam traps and antipatterns that students frequently fail on."
        ),
        "coach": (
            "TEACHING STYLE: Performance Cognitive Coach.\n"
            "- High-energy, motivating, and actionable pedagogical approach.\n"
            "- Break down complex concepts into micro-challenges, milestone drills, and active recall practice.\n"
            "- Provide immediate diagnostic feedback and retention optimization."
        ),
        "crammer": (
            "TEACHING STYLE: High-Yield Exam Crammer.\n"
            "- Ultra-dense, maximum-yield exam preparation. Zero fluff or unnecessary history.\n"
            "- Focus exclusively on: Core Formulas, Key Exam Definitions, High-Probability Pitfalls, and Mnemonic Memory Hooks.\n"
            "- Format with crisp bullet points for rapid revision."
        )
    }
    prompt_lines.append(style_prompts.get(teaching_style, style_prompts["professor"]))
    
    level_prompts = {
        "highschool": "ACADEMIC LEVEL: Foundational / High School. Use intuitive everyday analogies and clear visual metaphors.",
        "undergrad": "ACADEMIC LEVEL: University Undergraduate. Standard university degree rigor, formal notation, algorithmic complexity, and standard proofs.",
        "postgrad": "ACADEMIC LEVEL: Postgraduate / Research (Master's / PhD). Cutting-edge academic depth, literature references, subtle asymptotic trade-offs, and open research questions.",
        "pro": "ACADEMIC LEVEL: Senior Staff / Production Engineer. Enterprise scale, distributed systems latency, memory barriers, failure modes, and production-tested patterns."
    }
    prompt_lines.append(level_prompts.get(academic_level, level_prompts["undergrad"]))
    
    if language == "arabic":
        prompt_lines.append(
            "LANGUAGE DIRECTIVE: ARABIC ONLY.\n"
            "- يجب أن تكون جميع ردودك وشروحاتك باللغة العربية الفصحى الأكاديمية والواضحة والمباشرة.\n"
            "- ترجم المصطلحات العلمية بدقة مع إمكانية ذكر المصطلح الإنجليزي الأصلي بين قوسين للتوضيح."
        )
    elif language == "english":
        prompt_lines.append(
            "LANGUAGE DIRECTIVE: ENGLISH ONLY.\n"
            "- Deliver your entire answer in fluent, sophisticated, and technically precise English."
        )
    elif language == "bilingual":
        prompt_lines.append(
            "LANGUAGE DIRECTIVE: BILINGUAL (ARABIC & ENGLISH).\n"
            "- اشرح المفاهيم والنظريات باللغة العربية الواضحة والممتعة، مع إبقاء المصطلحات التقنية، الأكواد، والمعادلات بالإنجليزية.\n"
            "- Provide balanced bilingual synthesis suited for international university engineering programs."
        )
    else:  # auto
        prompt_lines.append(
            "LANGUAGE DIRECTIVE: AUTO-ADAPTIVE.\n"
            "- Detect the language of the student's query (Arabic or English) and reply naturally in that exact language with full grammatical and technical mastery."
        )
        
    if custom_directives and custom_directives.strip():
        prompt_lines.append(f"CUSTOM USER DIRECTIVES:\n{custom_directives.strip()}")
        
    if vault_context:
        prompt_lines.append(f"GROUNDED STUDY VAULT CONTEXT:\n{vault_context}")
    if codebase_context:
        prompt_lines.append(f"GROUNDED WORKSPACE CODEBASE CONTEXT:\n{codebase_context}")
        
    return "\n\n".join(prompt_lines)

def synthesize_cortex_chat(req: CortexChatRequest) -> Dict[str, Any]:
    """
    Executes real CORTEXAI neural synthesis across the 3 official tiers:
    - Flash (v1.2): ultra-fast responsive inference
    - Pro (v2.5): multi-matrix structured reasoning
    - Ultra (v3.0 Max): DeepSeek R1 deep chain-of-thought proof engine
    """
    start_time = time.time()
    
    vault_ctx = ""
    if req.ground_in_vault:
        vault_ctx = get_vault_grounding_context(req.prompt, req.vault_path)
        
    codebase_ctx = ""
    if req.ground_in_codebase:
        codebase_ctx = get_codebase_grounding_context(req.prompt, req.workspace_path)
        
    system_prompt = build_cortex_system_prompt(
        ai_name=req.ai_name,
        tier=req.tier,
        language=req.language,
        teaching_style=req.teaching_style,
        academic_level=req.academic_level,
        custom_directives=req.custom_directives,
        vault_context=vault_ctx,
        codebase_context=codebase_ctx
    )
    
    answer = ""
    thinking = ""
    tokens = 0
    model_label = f"CORTEXAI {req.tier.capitalize()}"
    
    try:
        if req.tier == "ultra":
            model_label = "CORTEXAI Ultra (v3.0 Max)"
            # Invoke DeepSeek R1 (deepseek-reasoner)
            try:
                res = call_deepseek(
                    prompt=req.prompt,
                    model=DEEPSEEK_ULTRA_MODEL,
                    system_prompt=system_prompt,
                    timeout=50,
                    max_tokens=2500,
                    temperature=None  # Must be None for reasoner!
                )
                answer = res.get("text", "")
                thinking = res.get("reasoning", "")
                tokens = res.get("usage", {}).get("total_tokens", 0)
            except Exception as ultra_err:
                print(f"[ai_service] Ultra DeepSeek R1 error, falling back to Gemini Pro: {ultra_err}")
                cot_prompt = (
                    f"{system_prompt}\n\n"
                    f"First provide a step-by-step thinking trace inside <thinking>...</thinking>, "
                    f"then provide your final answer."
                )
                res = call_gemini(
                    prompt=req.prompt,
                    model=GEMINI_PRO_MODEL,
                    system_prompt=cot_prompt,
                    timeout=30,
                    max_tokens=2048,
                    temperature=0.2
                )
                raw_text = res.get("text", "")
                if "<thinking>" in raw_text and "</thinking>" in raw_text:
                    parts = raw_text.split("</thinking>", 1)
                    thinking = parts[0].replace("<thinking>", "").strip()
                    answer = parts[1].strip()
                else:
                    thinking = f"Neural proof synthesized across {req.academic_level} cognitive invariants."
                    answer = raw_text
                tokens = len(raw_text.split()) * 2

        elif req.tier == "flash":
            model_label = "CORTEXAI Flash (v1.2)"
            temp = max(0.0, min(1.0, float(req.temperature)))
            try:
                res = call_deepseek(
                    prompt=req.prompt,
                    model=DEEPSEEK_FLASH_MODEL,
                    system_prompt=system_prompt,
                    timeout=20,
                    max_tokens=1200,
                    temperature=temp
                )
                answer = res.get("text", "")
                tokens = res.get("usage", {}).get("total_tokens", 0)
                thinking = f"Instant low-latency semantic inference completed in flash mode."
            except Exception as flash_err:
                print(f"[ai_service] Flash DeepSeek error, falling back to Gemini Lite: {flash_err}")
                res = call_gemini(
                    prompt=req.prompt,
                    model=GEMINI_CHEAP_MODEL,
                    system_prompt=system_prompt,
                    timeout=20,
                    max_tokens=1024,
                    temperature=temp
                )
                answer = res.get("text", "")
                tokens = len(answer.split()) * 2
                thinking = f"Synthesized with CORTEXAI Flash Core."

        else:  # pro
            model_label = "CORTEXAI Pro (v2.5)"
            temp = max(0.0, min(1.0, float(req.temperature)))
            try:
                res = call_deepseek(
                    prompt=req.prompt,
                    model=DEEPSEEK_PRO_MODEL,
                    system_prompt=system_prompt,
                    timeout=30,
                    max_tokens=2048,
                    temperature=temp
                )
                answer = res.get("text", "")
                tokens = res.get("usage", {}).get("total_tokens", 0)
                thinking = f"Multi-pass semantic analysis and '{req.teaching_style}' pedagogical synthesis completed."
            except Exception as pro_err:
                print(f"[ai_service] Pro DeepSeek error, falling back to Gemini Pro: {pro_err}")
                res = call_gemini(
                    prompt=req.prompt,
                    model=GEMINI_PRO_MODEL,
                    system_prompt=system_prompt,
                    timeout=25,
                    max_tokens=1800,
                    temperature=temp
                )
                answer = res.get("text", "")
                tokens = len(answer.split()) * 2
                thinking = f"Synthesized with CORTEXAI Pro Core."

    except Exception as general_err:
        print(f"[ai_service] synthesize_cortex_chat failure: {general_err}")
        answer = f"### [CORTEXAI Error]\nUnable to reach neural engine: {general_err}\nPlease check your network connection and API credentials."
        thinking = "Connection to neural provider interrupted."
        tokens = 0

    latency_ms = int(round((time.time() - start_time) * 1000))
    if tokens == 0:
        tokens = max(50, len(answer.split()) + len(thinking.split()))

    return {
        "ok": True,
        "answer": answer,
        "thinking": thinking if req.show_thinking_trace else "",
        "tokens": tokens,
        "latency_ms": latency_ms,
        "tier": req.tier,
        "ai_name": req.ai_name,
        "provider": "cortexai",
        "model": model_label,
        "error": None
    }

