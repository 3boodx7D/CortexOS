# 🎨 RULE 02: DESIGN SYSTEM & VISUAL STANDARDS
### *The teampvoice.com Monochromatic Aesthetic & Desktop UI Benchmark*
> **Enforcement Scope:** All pages, cards, modals, navigation bars, typography, colors, and layout structures.

---

## 1. Visual Identity & Aesthetic Benchmark

CortexOS UI **MUST EXACTLY MATCH THE ULTRA-CLEAN, MINIMAL, MONOCHROMATIC AESTHETIC OF `teampvoice.com`**.

```yaml
Design_Benchmark: "teampvoice.com"
Color_Palette: "Pure Deep Black #000000 / #050505 + Zinc Borders border-zinc-800/80 + TempVoice Electric Cyan #00aff4 Accent ONLY"
Surface_Cards: "Deep Obsidian #0a0a0a with border border-zinc-800/80 hover:border-zinc-700"
Typography: "Inter / Geist font family exclusively (crisp, understated, high legibility)"
Target_Display: "Native Windows 11 Desktop (OLED & High-DPI optimized)"
```

---

## 2. Strict Color & Surface Rules

1. **Pure Deep Black Base:**
   - App background: `#000000` / `#050505` (`hsl(220 20% 3%)`).
   - Cards and modules: `#0a0a0a` (`hsl(var(--card))`).
   - Subtle radial glow: Dark obsidian with faint cyan/emerald luminance only.
2. **Hairline Zinc Borders:**
   - Standard card borders: `border border-zinc-800/80`.
   - Hover borders: `hover:border-zinc-700` or subtle cyan glow `hover:border-cyan-500/40`.
3. **Accent Colors:**
   - **Primary Accent:** TempVoice Electric Cyan `#00aff4` (`hsl(197 100% 48%)`).
   - **System Status Accent:** Subtle Emerald `#10b981` (Online/Healthy).
   - **Warning / Deadline Accent:** Amber `#f59e0b` or Rose `#f43f5e`.
4. **ABSOLUTELY FORBIDDEN:**
   - ❌ NO washed-out pink or purple tints.
   - ❌ NO cartoonish, bright rainbow gradients.
   - ❌ NO milky white card backgrounds in dark mode.

---

## 3. Desktop Native Layout & Window Controls

CortexOS is a **Native Windows 11 Desktop Application** wrapped in Tauri:

1. **NO Mobile Bottom Navigation Bar:**
   - A bottom navigation bar on Windows is strictly forbidden.
   - Navigation lives permanently in the sleek, collapsible left sidebar (`src/components/app-shell.tsx`) or the top command palette (`Ctrl+K`).
2. **Window Titlebar & Draggable Region:**
   - The Tauri window is frameless (`decorations: false`).
   - The top header acts as the titlebar with `data-tauri-drag-region`.
   - All interactive items (search bar, profile, minimize, maximize, close buttons) **MUST** have `data-tauri-drag-region="false"` so clicks are never swallowed by the OS drag handler.
   - Window controls (`-`, `□`, `✕`) must remain pixel-perfect and functional at all times.

---

## 4. The 8 Core Modules Matrix (Launchpad Grid)

The application matrix organizes user workflows into 8 high-performance modules:
1. 📁 **Projects Vault** (`d:\dev26-27` directory scanner, 60+ projects, Active/Sold/Experiment tags, 1-click VS Code launcher).
2. 🎓 **Study Hub** (PDF/DOCX lecture slides reader, ELI5 summaries, interactive practice exam quizzes, and audio TTS).
3. 🎮 **Game Hub & Turbo Mode** (Steam/Epic/Riot games scanner, pixel-perfect Turbo Boost switch with ZERO thumb overflow, RAM flush).
4. 🧹 **Clean Janitor** (1-click Desktop & Downloads organizer into structured folders).
5. 💾 **Versioned Project Backups** (Snapshot generator with `v1.0.0` SemVer, sorted newest to oldest, restore).
6. 🚨 **Deadline & Exam Radar** (Countdown timers for submissions and exams, warnings in Dynamic Island).
7. 🎵 **Music Hub** (Offline MP3 downloader from URLs, local player, waveform visualization).
8. ⚙️ **Settings & Hotkeys** (6-tab configuration matrix and keyboard shortcuts).

---

## 5. Desktop Dynamic Island (`components/island/DynamicIsland.tsx`)

- **Fixed Location:** `fixed top-3 left-1/2 -translate-x-1/2 z-50`.
- **Pure Black OLED Glass:**
  - Thin, understated timer (`24:50` in crisp white monospace font).
  - Tiny, delicate audio waveform bars in `#00aff4` (TempVoice cyan) when music or lecture audio is playing.
  - Subtle status dot (emerald for idle, cyan for turbo/active).
  - Smooth spring expansion on hover to reveal audio controls, timer pause, and quick actions.
