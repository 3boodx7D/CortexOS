import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from backend.config import (
    GOOGLE_AI_API_KEY,
    DEEPSEEK_API_KEY,
    GEMINI_CHEAP_MODEL,
    GEMINI_PRO_MODEL,
    DEEPSEEK_MODEL
)

def call_gemini(prompt: str, model: str = GEMINI_CHEAP_MODEL, system_prompt: Optional[str] = None, timeout: int = 15) -> Dict[str, Any]:
    """Call Google Gemini API using pure urllib."""
    if not GOOGLE_AI_API_KEY:
        raise ValueError("Google AI API Key is not configured")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GOOGLE_AI_API_KEY}"
    
    contents = []
    if system_prompt:
        contents.append({"role": "user", "parts": [{"text": f"SYSTEM INSTRUCTION:\n{system_prompt}"}]})
        contents.append({"role": "model", "parts": [{"text": "Understood. I will follow these instructions."}]})
    
    contents.append({"role": "user", "parts": [{"text": prompt}]})
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        return {
            "ok": True,
            "provider": "google",
            "model": model,
            "text": text
        }

def call_deepseek(prompt: str, model: str = DEEPSEEK_MODEL, system_prompt: Optional[str] = None, timeout: int = 20) -> Dict[str, Any]:
    """Call DeepSeek API using standard OpenAI-compatible format."""
    if not DEEPSEEK_API_KEY:
        raise ValueError("DeepSeek API Key is not configured")
    
    url = "https://api.deepseek.com/chat/completions"
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 2048
    }
    
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
        text = data["choices"][0]["message"]["content"].strip()
        return {
            "ok": True,
            "provider": "deepseek",
            "model": model,
            "text": text
        }

def summarize_text(text: str, provider: str = "auto", system_prompt: Optional[str] = None, task_type: str = "summary") -> Dict[str, Any]:
    """Summarizes text using the most cost-effective model (Gemini 3.5 Flash Lite first)."""
    if system_prompt is None:
        system_prompt = "You are CortexOS Neural Synthesizer. Provide a sharp, structured technical summary with key concepts and practical takeaways."
    prompt = f"Please summarize the following lecture or technical notes clearly and concisely:\n\n{text}"
    
    # Try lightweight Gemini first to save credits
    if provider in ["auto", "gemini-lite", "google"]:
        try:
            res = call_gemini(prompt, model=GEMINI_CHEAP_MODEL, system_prompt=system_prompt)
            return {"summary": res["text"], "provider": "google", "model": res["model"], "quiz": None, "flashcards": None, "text": res["text"]}
        except Exception as e:
            print(f"[ai_service] Gemini lite failed: {e}")
            if provider != "auto":
                raise e
    
    # Fallback to DeepSeek
    try:
        res = call_deepseek(prompt, system_prompt=system_prompt)
        return {"summary": res["text"], "provider": "deepseek", "model": res["model"], "quiz": None, "flashcards": None, "text": res["text"]}
    except Exception as e:
        print(f"[ai_service] DeepSeek failed: {e}")
        # Last resort fallback: try Gemini Pro
        res = call_gemini(prompt, model=GEMINI_PRO_MODEL, system_prompt=system_prompt)
        return {"summary": res["text"], "provider": "google", "model": res["model"], "quiz": None, "flashcards": None, "text": res["text"]}

def generate_quiz(text: str, provider: str = "auto") -> Dict[str, Any]:
    """Generate quiz questions from text using cost-effective models."""
    system_prompt = (
        "You are CortexOS Recall Engine. Generate exactly 5 high-quality multiple-choice questions from the lecture.\n"
        "Return JSON array: [{\"question\":\"...\",\"choices\":[\"A\",\"B\",\"C\"],\"correct\":0,\"explanation\":\"why this is right\"}]\n"
        "- Test understanding, not memorization\n"
        "- Mix conceptual and applied questions\n"
        "- Explanations must be clear and educational\n"
        "- Return ONLY valid JSON array"
    )
    prompt = f"Please generate quiz questions from the following lecture:\n\n{text}"

    if provider in ["auto", "gemini-lite", "google"]:
        try:
            res = call_gemini(prompt, model=GEMINI_CHEAP_MODEL, system_prompt=system_prompt)
            return {"ok": True, "provider": "google", "model": res["model"], "quiz": json.loads(res["text"])}
        except Exception as e:
            print(f"[ai_service] Gemini quiz failed: {e}")
            if provider != "auto":
                raise e

    try:
        res = call_deepseek(prompt, system_prompt=system_prompt)
        return {"ok": True, "provider": "deepseek", "model": res["model"], "quiz": json.loads(res["text"])}
    except Exception as e:
        print(f"[ai_service] DeepSeek quiz failed: {e}")
        return {"ok": False, "error": str(e)}

def generate_flashcards(text: str, provider: str = "auto") -> Dict[str, Any]:
    """Generate flashcards from text using cost-effective models."""
    system_prompt = (
        "You are CortexOS Memory Architect. Generate 5-8 high-yield flashcards from the lecture.\n"
        "Return JSON array: [{\"front\":\"Question/Concept\",\"back\":\"Answer/Explanation\"}]\n"
        "- Focus on key definitions, relationships, and principles\n"
        "- Front: concise question or term\n"
        "- Back: clear, complete answer with context\n"
        "- Return ONLY valid JSON array"
    )
    prompt = f"Please generate flashcards from the following lecture:\n\n{text}"

    if provider in ["auto", "gemini-lite", "google"]:
        try:
            res = call_gemini(prompt, model=GEMINI_CHEAP_MODEL, system_prompt=system_prompt)
            return {"ok": True, "provider": "google", "model": res["model"], "flashcards": json.loads(res["text"])}
        except Exception as e:
            print(f"[ai_service] Gemini flashcards failed: {e}")
            if provider != "auto":
                raise e

    try:
        res = call_deepseek(prompt, system_prompt=system_prompt)
        return {"ok": True, "provider": "deepseek", "model": res["model"], "flashcards": json.loads(res["text"])}
    except Exception as e:
        print(f"[ai_service] DeepSeek flashcards failed: {e}")
        return {"ok": False, "error": str(e)}

def explain_project_outside(project_name: str, stack: list, package_json_snippet: str = "", readme_snippet: str = "", provider_preference: str = "auto") -> Dict[str, Any]:
    """
    Explains a project from the outside without requiring the user to open it.
    Uses lightweight Gemini 3.5 Flash Lite to conserve credits.
    """
    system_prompt = (
        "You are CortexOS Project Vault Intelligence. You analyze code projects from the outside. "
        "Return a raw JSON object (WITHOUT markdown backticks or commentary) with these exact keys:\n"
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
        f"Package Info / Config:\n{package_json_snippet[:800]}\n\n"
        f"README Snippet:\n{readme_snippet[:1000]}\n"
    )
    
    # Choose model based on preference
    selected_model = GEMINI_CHEAP_MODEL
    use_deepseek = False
    if provider_preference == "gemini-pro":
        selected_model = GEMINI_PRO_MODEL
    elif provider_preference == "deepseek":
        use_deepseek = True
    
    raw_text = ""
    provider_used = "google"
    model_used = selected_model
    
    if not use_deepseek:
        try:
            res = call_gemini(user_prompt, model=selected_model, system_prompt=system_prompt)
            raw_text = res["text"]
            provider_used = res["provider"]
            model_used = res["model"]
        except Exception as e:
            print(f"[ai_service] Gemini explainer error: {e}, falling back to DeepSeek")
            use_deepseek = True
    
    if use_deepseek:
        res = call_deepseek(user_prompt, system_prompt=system_prompt)
        raw_text = res["text"]
        provider_used = "deepseek"
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
    except Exception as e:
        # Graceful fallback parsing
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
        f"```\n{logs[-3000:]}\n```\n\n"
        f"Please analyze this error and tell me how to fix it immediately."
    )

    try:
        if provider == "deepseek":
            res = call_deepseek(user_prompt, system_prompt=system_prompt)
        else:
            res = call_gemini(user_prompt, model=GEMINI_PRO_MODEL, system_prompt=system_prompt)

        return {
            "ok": True,
            "provider": res["provider"],
            "model": res["model"],
            "analysis": res["text"]
        }
    except Exception as e:
        # Fallback to alternative provider
        try:
            alt_res = call_deepseek(user_prompt, system_prompt=system_prompt)
            return {
                "ok": True,
                "provider": alt_res["provider"],
                "model": alt_res["model"],
                "analysis": alt_res["text"]
            }
        except Exception as alt_err:
            return {"ok": False, "error": f"AI Debugger failed: {alt_err}"}

