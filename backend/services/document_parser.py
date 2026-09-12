import io
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from pathlib import Path

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False


def extract_text_from_pdf(file_bytes: bytes) -> Dict[str, Any]:
    """Extracts text, page count, and metadata from PDF bytes using pypdf."""
    if not PYPDF_AVAILABLE:
        return {
            "ok": False,
            "error": "pypdf is not installed. Please install pypdf to parse PDF documents.",
            "text": "",
            "pages": 0
        }
    
    try:
        pdf_reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages_text: List[str] = []
        for i, page in enumerate(pdf_reader.pages):
            page_content = page.extract_text() or ""
            if page_content.strip():
                pages_text.append(f"--- Page {i + 1} ---\n{page_content.strip()}")
        
        full_text = "\n\n".join(pages_text)
        return {
            "ok": True,
            "text": full_text,
            "pages": len(pdf_reader.pages),
            "pages_with_content": len(pages_text)
        }
    except Exception as e:
        return {
            "ok": False,
            "error": f"Failed to extract text from PDF: {str(e)}",
            "text": "",
            "pages": 0
        }


def extract_text_from_docx(file_bytes: bytes) -> Dict[str, Any]:
    """
    Extracts text, paragraphs, and tables from DOCX bytes using zipfile & XML parsing.
    Works natively with zero external dependencies.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx_zip:
            if "word/document.xml" not in docx_zip.namelist():
                return {"ok": False, "error": "Invalid DOCX format: missing word/document.xml", "text": ""}
            
            xml_content = docx_zip.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            
            # XML namespaces used in Word OpenXML
            namespaces = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
            }
            
            paragraphs: List[str] = []
            
            # Iterate through body elements (paragraphs and tables)
            body = tree.find('w:body', namespaces)
            if body is not None:
                for child in body:
                    tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                    
                    if tag == 'p':
                        # Paragraph
                        texts = [node.text for node in child.findall('.//w:t', namespaces) if node.text]
                        p_str = "".join(texts).strip()
                        if p_str:
                            paragraphs.append(p_str)
                            
                    elif tag == 'tbl':
                        # Table: format as markdown or clean rows
                        table_rows: List[str] = []
                        for row in child.findall('.//w:tr', namespaces):
                            row_cells = []
                            for cell in row.findall('.//w:tc', namespaces):
                                cell_texts = [node.text for node in cell.findall('.//w:t', namespaces) if node.text]
                                row_cells.append(" ".join("".join(cell_texts).split()))
                            if any(row_cells):
                                table_rows.append(" | ".join(row_cells))
                        
                        if table_rows:
                            paragraphs.append("\n[Table]\n" + "\n".join(table_rows) + "\n[/Table]")

            full_text = "\n\n".join(paragraphs)
            return {
                "ok": True,
                "text": full_text,
                "paragraph_count": len(paragraphs)
            }
    except Exception as e:
        return {
            "ok": False,
            "error": f"Failed to extract text from DOCX: {str(e)}",
            "text": ""
        }


def extract_text_from_plain(file_bytes: bytes) -> Dict[str, Any]:
    """Decodes plain text or markdown files with auto-encoding fallbacks."""
    encodings = ["utf-8", "utf-8-sig", "windows-1256", "cp1252", "latin-1"]
    for enc in encodings:
        try:
            decoded = file_bytes.decode(enc)
            return {"ok": True, "text": decoded, "encoding": enc}
        except UnicodeDecodeError:
            continue
    return {"ok": False, "error": "Unable to decode text with supported encodings", "text": ""}


def parse_document(filename: str, file_bytes: bytes) -> Dict[str, Any]:
    """
    Universal document parser for PDF, DOCX, TXT, and Markdown files.
    Calculates word count, estimated reading time, and topic summary hints.
    """
    ext = Path(filename).suffix.lower()
    
    if ext == ".pdf":
        res = extract_text_from_pdf(file_bytes)
    elif ext in [".docx", ".doc"]:
        res = extract_text_from_docx(file_bytes)
    elif ext in [".txt", ".md", ".markdown", ".csv", ".tsv"]:
        res = extract_text_from_plain(file_bytes)
    else:
        return {
            "ok": False,
            "error": f"Unsupported file type '{ext}'. Supported formats: .pdf, .docx, .txt, .md",
            "text": ""
        }
    
    if not res.get("ok"):
        return res
    
    text = res.get("text", "")
    words = re.findall(r'\b\w+\b', text)
    word_count = len(words)
    # Average reading speed ~ 200 words per minute
    reading_time = max(1, round(word_count / 200)) if word_count > 0 else 0
    
    # Deriving a smart title hint from the first substantial line or the filename
    lines = [line.strip("# -*\t") for line in text.splitlines() if line.strip()]
    title_hint = Path(filename).stem
    if lines:
        for candidate in lines[:5]:
            if 3 < len(candidate) < 100:
                title_hint = candidate
                break

    return {
        "ok": True,
        "filename": filename,
        "extension": ext,
        "text": text,
        "word_count": word_count,
        "reading_time_minutes": reading_time,
        "title_hint": title_hint,
        "pages": res.get("pages", 1)
    }
