import os
import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Default vault path
DEFAULT_VAULT_PATH = Path("D:/CortexOS_Study")
CONFIG_FILE = Path.home() / ".cortexos" / "study_config.json"


def sanitize_filename(name: str) -> str:
    """Sanitizes folder/file names for Windows compatibility."""
    cleaned = re.sub(r'[\\/*?:"<>|]', "", name).strip()
    return cleaned if cleaned else "untitled"


def get_vault_path() -> Path:
    """Gets configured study vault root path or falls back safely."""
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                custom_path = data.get("vault_path")
                if custom_path:
                    p = Path(custom_path)
                    p.mkdir(parents=True, exist_ok=True)
                    return p
    except Exception:
        pass
    
    # Try default D:\ drive, fallback to home directory if D: drive is not writable/present
    try:
        DEFAULT_VAULT_PATH.mkdir(parents=True, exist_ok=True)
        return DEFAULT_VAULT_PATH
    except Exception:
        fallback = Path.home() / "CortexOS_Study"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def set_vault_path(new_path: str) -> Path:
    """Sets user preference for study vault path."""
    p = Path(new_path)
    p.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"vault_path": str(p)}, f, indent=2)
    return p


def init_vault() -> Dict[str, Any]:
    """Initializes the vault folder structure. Seeds an initial demo course if empty."""
    vault = get_vault_path()
    vault.mkdir(parents=True, exist_ok=True)
    
    courses = list_courses()
    if not courses:
        # Seed an initial starter course
        starter = create_course(
            title="CS301 - Neural Networks & AI",
            code="CS301",
            description="Deep Learning, Large Language Models, and Cognitive Architecture",
            color="#00aff4"
        )
        course_id = starter.get("id", "cs301")
        
        # Seed an initial lesson
        sample_source = (
            "# Lecture 01: Introduction to Neural Networks & Transformers\n\n"
            "Deep learning has transformed artificial intelligence. Modern Large Language Models (LLMs) "
            "rely on the Transformer architecture introduced by Vaswani et al. in 2017.\n\n"
            "## Key Core Principles:\n"
            "1. Self-Attention Mechanism: Computes dynamic relationships between all tokens across sequence length N.\n"
            "2. Scaled Dot-Product Attention: Formula: Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V.\n"
            "3. Multi-Head Attention: Allows the model to attend to information from different representation subspaces simultaneously.\n"
            "4. Residual Connections & Layer Normalization: Prevent gradient vanishing and ensure training stability."
        )
        
        sample_summary = (
            "# Structured Summary: Transformer Architecture\n\n"
            "### 🎯 Core Highlights\n"
            "- **Breakthrough**: Solved the sequential bottleneck of RNNs/LSTMs through parallelizable attention.\n"
            "- **Query, Key, Value (QKV)**: Attention maps queries to key-value pairs through projection matrices.\n"
            "- **Computational Complexity**: O(N^2) in sequence length for standard full attention.\n\n"
            "### 🔑 High-Yield Exam Formulas\n"
            "$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\n"
            "### 🚀 Practical Takeaways\n"
            "- Self-attention provides global receptive fields in a single step.\n"
            "- Positional encodings (sinusoidal or RoPE) are required because attention is permutation-invariant."
        )
        
        sample_eli5 = (
            "# 💡 ELI5: How Transformers & Self-Attention Work\n\n"
            "Imagine a crowded classroom where the teacher asks a question. In an old system (RNN), students could only whisper the message down a single line of desks one by one. If someone forgot a word in the middle, the whole message got lost.\n\n"
            "The **Transformer** gives every single student a laser pointer! Every student can instantly point to anyone else in the room who has the answer they need right now. The **Query** is what you are searching for, the **Key** is the badge showing what each person knows, and the **Value** is the actual knowledge they pass to you."
        )
        
        sample_quiz = [
            {
                "id": "q1",
                "question": "What primary limitation of Recurrent Neural Networks (RNNs) did the Transformer address?",
                "choices": [
                    "Inability to run on CPU architectures",
                    "Sequential computation bottleneck preventing full parallelization across tokens",
                    "Inability to handle binary classification tasks",
                    "Excessive memory usage during inference only"
                ],
                "correct": 1,
                "explanation": "RNNs must process tokens one by one sequentially (t-1 before t). Transformers allow parallel training across the entire sequence via self-attention."
            },
            {
                "id": "q2",
                "question": "Why is the dot product scaled by sqrt(d_k) in the Attention formula?",
                "choices": [
                    "To prevent gradients from vanishing into tiny values near zero",
                    "To push softmax into regions where gradients are larger and avoid vanishing gradients for large dimensions",
                    "To ensure sequence length is always a prime number",
                    "To reduce floating point precision to 8-bit"
                ],
                "correct": 1,
                "explanation": "For large d_k, dot products grow large in magnitude, pushing softmax into regions with extremely small gradients. Scaling by sqrt(d_k) counteracts this effect."
            },
            {
                "id": "q3",
                "question": "True or False: Standard Self-Attention is naturally permutation-invariant and requires Positional Encoding.",
                "choices": [
                    "True",
                    "False"
                ],
                "correct": 0,
                "explanation": "Without positional encodings, the attention score between two words does not depend on their positions in the sentence. Positional encodings restore order awareness."
            }
        ]
        
        sample_flashcards = [
            {
                "id": "fc1",
                "front": "What is the core formula for Scaled Dot-Product Attention?",
                "back": "Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V"
            },
            {
                "id": "fc2",
                "front": "Why are Positional Encodings strictly needed in Transformers?",
                "back": "Self-attention has no innate sense of sequence order (it is permutation-invariant). Positional encodings inject token sequence positions."
            },
            {
                "id": "fc3",
                "front": "What is the computational complexity of standard self-attention relative to sequence length N?",
                "back": "O(N^2) time and memory complexity."
            }
        ]
        
        sample_references = [
            {
                "title": "Attention Is All You Need (Original Paper)",
                "url": "https://arxiv.org/abs/1706.03762",
                "type": "paper",
                "publisher": "NeurIPS 2017"
            },
            {
                "title": "Visualizing Attention & Transformers - 3Blue1Brown",
                "url": "https://www.youtube.com/results?search_query=3blue1brown+transformers+neural+networks",
                "type": "youtube",
                "publisher": "3Blue1Brown"
            },
            {
                "title": "The Illustrated Transformer - Jay Alammar",
                "url": "https://jalammar.github.io/illustrated-transformer/",
                "type": "article",
                "publisher": "Jay Alammar"
            }
        ]
        
        save_lesson(course_id, "lecture-01-transformers", {
            "title": "Lecture 01: Attention & Transformers",
            "source": sample_source,
            "summary": sample_summary,
            "eli5": sample_eli5,
            "quiz": sample_quiz,
            "flashcards": sample_flashcards,
            "references": sample_references
        })
        
    return {
        "ok": True,
        "vault_path": str(vault),
        "course_count": len(list_courses())
    }


def list_courses() -> List[Dict[str, Any]]:
    """Lists all courses in the vault directory with lesson counts and metadata."""
    vault = get_vault_path()
    if not vault.exists():
        return []
    
    courses = []
    for item in vault.iterdir():
        if item.is_dir() and not item.name.startswith("."):
            meta_file = item / "metadata.json"
            meta: Dict[str, Any] = {}
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                except Exception:
                    pass
            
            # Count lessons (subdirectories)
            lesson_count = sum(1 for sub in item.iterdir() if sub.is_dir() and not sub.name.startswith("."))
            
            courses.append({
                "id": meta.get("id", item.name),
                "folder_name": item.name,
                "title": meta.get("title", item.name),
                "code": meta.get("code", ""),
                "description": meta.get("description", ""),
                "color": meta.get("color", "#00aff4"),
                "created_at": meta.get("created_at", datetime.fromtimestamp(item.stat().st_ctime).isoformat()),
                "updated_at": meta.get("updated_at", datetime.fromtimestamp(item.stat().st_mtime).isoformat()),
                "lesson_count": lesson_count
            })
            
    courses.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return courses


def create_course(title: str, code: str = "", description: str = "", color: str = "#00aff4") -> Dict[str, Any]:
    """Creates a new course folder and saves its metadata."""
    vault = get_vault_path()
    folder_name = sanitize_filename(f"{code} - {title}" if code else title)
    course_dir = vault / folder_name
    
    counter = 1
    base_name = folder_name
    while course_dir.exists():
        folder_name = f"{base_name} ({counter})"
        course_dir = vault / folder_name
        counter += 1
        
    course_dir.mkdir(parents=True, exist_ok=True)
    
    now = datetime.now().isoformat()
    course_id = re.sub(r'[^a-zA-Z0-9_-]', '-', folder_name).lower().strip('-')
    meta = {
        "id": course_id,
        "title": title,
        "code": code,
        "description": description,
        "color": color,
        "created_at": now,
        "updated_at": now
    }
    
    with open(course_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        
    return {
        **meta,
        "folder_name": folder_name,
        "lesson_count": 0
    }


def update_course(course_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Updates metadata for an existing course."""
    course_dir = find_course_dir(course_id)
    if not course_dir:
        raise FileNotFoundError(f"Course '{course_id}' not found")
        
    meta_file = course_dir / "metadata.json"
    meta = {}
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass
            
    meta.update(updates)
    meta["updated_at"] = datetime.now().isoformat()
    
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        
    return meta


def delete_course(course_id: str) -> bool:
    """Deletes a course folder and all its contents."""
    course_dir = find_course_dir(course_id)
    if not course_dir:
        return False
    shutil.rmtree(course_dir, ignore_errors=True)
    return True


def find_course_dir(course_id: str) -> Optional[Path]:
    """Locates a course directory by ID or folder name."""
    vault = get_vault_path()
    if not vault.exists():
        return None
        
    for item in vault.iterdir():
        if item.is_dir():
            if item.name == course_id:
                return item
            meta_file = item / "metadata.json"
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data.get("id") == course_id:
                            return item
                except Exception:
                    pass
    return None


def list_lessons(course_id: str) -> List[Dict[str, Any]]:
    """Lists all lessons within a course."""
    course_dir = find_course_dir(course_id)
    if not course_dir:
        return []
        
    lessons = []
    for item in course_dir.iterdir():
        if item.is_dir() and not item.name.startswith("."):
            meta_file = item / "metadata.json"
            meta: Dict[str, Any] = {}
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                except Exception:
                    pass
                    
            has_summary = (item / "summary.md").exists()
            has_eli5 = (item / "eli5.md").exists()
            has_quiz = (item / "quiz.json").exists()
            has_flashcards = (item / "flashcards.json").exists()
            
            lessons.append({
                "id": meta.get("id", item.name),
                "folder_name": item.name,
                "title": meta.get("title", item.name),
                "order": meta.get("order", 0),
                "date": meta.get("date", datetime.fromtimestamp(item.stat().st_mtime).strftime("%Y-%m-%d")),
                "updated_at": meta.get("updated_at", datetime.fromtimestamp(item.stat().st_mtime).isoformat()),
                "has_summary": has_summary,
                "has_eli5": has_eli5,
                "has_quiz": has_quiz,
                "has_flashcards": has_flashcards,
                "tags": meta.get("tags", [])
            })
            
    lessons.sort(key=lambda x: (x.get("order", 0), x.get("updated_at", "")), reverse=False)
    return lessons


def find_lesson_dir(course_dir: Path, lesson_id: str) -> Optional[Path]:
    """Locates a lesson directory inside a course directory."""
    for item in course_dir.iterdir():
        if item.is_dir():
            if item.name == lesson_id:
                return item
            meta_file = item / "metadata.json"
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data.get("id") == lesson_id:
                            return item
                except Exception:
                    pass
    return None


def get_lesson(course_id: str, lesson_id: str) -> Dict[str, Any]:
    """Retrieves full lesson data including notes, summary, ELI5, quiz, and references."""
    course_dir = find_course_dir(course_id)
    if not course_dir:
        raise FileNotFoundError(f"Course '{course_id}' not found")
        
    lesson_dir = find_lesson_dir(course_dir, lesson_id)
    if not lesson_dir:
        raise FileNotFoundError(f"Lesson '{lesson_id}' not found in course '{course_id}'")
        
    meta = {}
    meta_file = lesson_dir / "metadata.json"
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass
            
    def read_text(filename: str) -> str:
        f = lesson_dir / filename
        if f.exists():
            try:
                return f.read_text(encoding="utf-8")
            except Exception:
                return ""
        return ""
        
    def read_json(filename: str) -> Any:
        f = lesson_dir / filename
        if f.exists():
            try:
                with open(f, "r", encoding="utf-8") as file:
                    return json.load(file)
            except Exception:
                return []
        return []

    return {
        "id": meta.get("id", lesson_dir.name),
        "course_id": course_id,
        "title": meta.get("title", lesson_dir.name),
        "folder_name": lesson_dir.name,
        "order": meta.get("order", 0),
        "tags": meta.get("tags", []),
        "source": read_text("source.md"),
        "summary": read_text("summary.md"),
        "eli5": read_text("eli5.md"),
        "quiz": read_json("quiz.json"),
        "flashcards": read_json("flashcards.json"),
        "references": read_json("references.json"),
        "quiz_history": read_json("quiz_history.json"),
        "updated_at": meta.get("updated_at", datetime.fromtimestamp(lesson_dir.stat().st_mtime).isoformat())
    }


def save_lesson(course_id: str, lesson_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Saves or updates lesson content (source, summary, eli5, quiz, flashcards, references)."""
    course_dir = find_course_dir(course_id)
    if not course_dir:
        raise FileNotFoundError(f"Course '{course_id}' not found")
        
    lesson_dir = find_lesson_dir(course_dir, lesson_id)
    now = datetime.now().isoformat()
    
    if not lesson_dir:
        # Create new lesson directory
        title = data.get("title") or lesson_id
        folder_name = sanitize_filename(title)
        lesson_dir = course_dir / folder_name
        
        counter = 1
        base_name = folder_name
        while lesson_dir.exists():
            folder_name = f"{base_name} ({counter})"
            lesson_dir = course_dir / folder_name
            counter += 1
            
        lesson_dir.mkdir(parents=True, exist_ok=True)
        meta_id = re.sub(r'[^a-zA-Z0-9_-]', '-', folder_name).lower().strip('-')
    else:
        meta_id = lesson_id

    # Update metadata.json
    meta_file = lesson_dir / "metadata.json"
    meta = {}
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass
            
    meta["id"] = meta_id
    if "title" in data:
        meta["title"] = data["title"]
    if "order" in data:
        meta["order"] = data["order"]
    if "tags" in data:
        meta["tags"] = data["tags"]
    meta["updated_at"] = now
    
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        
    # Write text and json files
    if "source" in data and data["source"] is not None:
        (lesson_dir / "source.md").write_text(data["source"], encoding="utf-8")
        
    if "summary" in data and data["summary"] is not None:
        (lesson_dir / "summary.md").write_text(data["summary"], encoding="utf-8")
        
    if "eli5" in data and data["eli5"] is not None:
        (lesson_dir / "eli5.md").write_text(data["eli5"], encoding="utf-8")
        
    if "quiz" in data and data["quiz"] is not None:
        with open(lesson_dir / "quiz.json", "w", encoding="utf-8") as f:
            json.dump(data["quiz"], f, indent=2, ensure_ascii=False)
            
    if "flashcards" in data and data["flashcards"] is not None:
        with open(lesson_dir / "flashcards.json", "w", encoding="utf-8") as f:
            json.dump(data["flashcards"], f, indent=2, ensure_ascii=False)
            
    if "references" in data and data["references"] is not None:
        with open(lesson_dir / "references.json", "w", encoding="utf-8") as f:
            json.dump(data["references"], f, indent=2, ensure_ascii=False)

    if "quiz_history" in data and data["quiz_history"] is not None:
        with open(lesson_dir / "quiz_history.json", "w", encoding="utf-8") as f:
            json.dump(data["quiz_history"], f, indent=2, ensure_ascii=False)
            
    return get_lesson(course_id, meta_id)


def delete_lesson(course_id: str, lesson_id: str) -> bool:
    """Deletes a lesson directory from a course."""
    course_dir = find_course_dir(course_id)
    if not course_dir:
        return False
        
    lesson_dir = find_lesson_dir(course_dir, lesson_id)
    if not lesson_dir:
        return False
        
    shutil.rmtree(lesson_dir, ignore_errors=True)
    return True


def open_in_explorer(course_id: str = "", lesson_id: str = "") -> bool:
    """Opens Windows Explorer at the vault root, course, or lesson folder."""
    target_path = get_vault_path()
    
    if course_id:
        course_dir = find_course_dir(course_id)
        if course_dir:
            target_path = course_dir
            if lesson_id:
                lesson_dir = find_lesson_dir(course_dir, lesson_id)
                if lesson_dir:
                    target_path = lesson_dir
                    
    try:
        os.startfile(str(target_path))
        return True
    except Exception:
        try:
            subprocess.Popen(["explorer", str(target_path)])
            return True
        except Exception:
            return False
