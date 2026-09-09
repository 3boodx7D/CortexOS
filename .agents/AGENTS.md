# 🧠 CORTEXOS — AGENT ORCHESTRATION & RULES HUB
### *The Definitive AI Reference Manual & Rules of Engagement*
> **Version:** 1.0.0 (Living Architecture Document)  
> **Workspace Root:** `d:\dev26-27\app`  
> **Target Audience:** Any AI Assistant (Gemini, Claude, GPT, DeepSeek, Cursor, Copilot) interacting with this repository.

---

## ⚡ Welcome, Agent!
Welcome to **CortexOS**, a high-performance native Windows 11 Neural Command Center and Second Brain engineered for developers, university students, and gamers.

This project enforces **strict engineering, architectural, and visual standards**. You must adhere to the rules outlined below. Every rule in this directory is mandatory and actively enforced.

---

## 📚 The Rulebook Matrix (`.agents/rules/`)

Before writing, modifying, or refactoring any code in this repository, you **MUST** consult and obey the specific rule files in `.agents/rules/`:

| Order | Rule File | Primary Focus & Domain | When to Read |
| :---: | :--- | :--- | :--- |
| **01** | [`01-architecture-and-stack.md`](file:///d:/dev26-27/app/.agents/rules/01-architecture-and-stack.md) | **System Architecture & Stack**: Tauri v2 Rust daemon, FastAPI telemetry server (Port 8000), React 19 + Vite 6 frontend, Supabase cloud sync, file tree anatomy. | Whenever creating new files, modifying backend/frontend IPC, adding routes, or touching system architecture. |
| **02** | [`02-design-system-and-ui.md`](file:///d:/dev26-27/app/.agents/rules/02-design-system-and-ui.md) | **Design System & Aesthetics**: Strict `teampvoice.com` minimalist monochromatic identity, pure deep black `#000000`/`#050505`, zinc hairline borders `border-zinc-800/80`, TempVoice cyan `#00aff4`, Desktop Dynamic Island. | Whenever building, styling, or reviewing any UI component, page, modal, or layout. |
| **03** | [`03-dual-motion-engine.md`](file:///d:/dev26-27/app/.agents/rules/03-dual-motion-engine.md) | **The Golden Dual-Motion Engine**: Strict two animation modes: **Minimal** (`data-motion="minimal"` / 0ms instant) vs **Cinematic** (`data-motion="cinematic"` / 60 FPS smooth cascade). | Whenever adding animations, creating pages with `.page-in`, cascading cards, or using Framer Motion. |
| **04** | [`04-anti-slop-and-quality.md`](file:///d:/dev26-27/app/.agents/rules/04-anti-slop-and-quality.md) | **Strict Anti-Slop Rules ("ممنوعات الكود والهبد")**: Pixel-perfect switches (thumb NEVER overflows capsule), zero uninstalled packages (use `wouter`, not `react-router-dom`), zero fake disclaimers, native window controls, full RTL/LTR parity. | Always! This is the mandatory quality gate for all code contributions. |
| **05** | [`05-onboarding-and-extensibility.md`](file:///d:/dev26-27/app/.agents/rules/05-onboarding-and-extensibility.md) | **Onboarding & Settings Extensibility**: Step-by-step blueprint to add new user onboarding steps and mirror them in `settings.tsx` with proper persistence scope (`usePersistent` vs `useUserPersistent`) and i18n. | Whenever introducing a new configuration option, onboarding step, or user preference. |
| **06** | [`06-commands-and-verification.md`](file:///d:/dev26-27/app/.agents/rules/06-commands-and-verification.md) | **Commands & Quality Verification**: How to launch Tauri, Vite, and FastAPI; mandatory pre-completion checklist (`pnpm run typecheck`). | Before executing or finishing any development task. |

---

## 🎯 Quick Rules Summary (Never Break These)

1. **Aesthetic Compliance:** Must exactly match the ultra-clean, minimal, monochromatic aesthetic of **`teampvoice.com`**.
2. **Switch Buttons:** The toggle thumb **MUST NEVER OVERFLOW OR JUMP OUTSIDE** the capsule boundary!
3. **No Uninstalled Packages:** Only use packages declared in [package.json](file:///d:/dev26-27/app/package.json). CortexOS uses **`wouter`**, NOT `react-router-dom`.
4. **Dual-Motion Parity:** Every newly added page or card group must seamlessly support both `minimal` and `cinematic` modes.
5. **Bilingual Parity:** Every UI string must exist in both [en.json](file:///d:/dev26-27/app/src/locales/en.json) and [ar.json](file:///d:/dev26-27/app/src/locales/ar.json). Never hardcode raw strings in components.
6. **Mandatory Typecheck:** Run `pnpm run typecheck` and ensure 0 errors before declaring any task complete.
