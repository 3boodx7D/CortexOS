# 🧠 CORTEXOS (v1.0) — BESPOKE HUMAN-ENGINEERED COMMAND CENTER
### *Strict teampvoice.com Aesthetic · Zero Generic AI Clichés · Pixel-Perfect UI*

```yaml
Product: "CortexOS"
Founder: "Abdulrahman (Abood) — Founder of teampvoice.com & Full-Stack Engineer"
Design_Reference: "MUST EXACTLY MATCH THE ULTRA-CLEAN, MINIMAL, MONOCHROMATIC AESTHETIC OF teampvoice.com"
Color_Palette: "Pure Deep Black #000000 / #050505 + Zinc Borders border-zinc-800/80 + TempVoice Electric Cyan #00aff4 Accent ONLY"
Font: "Inter / Geist font exclusively (crisp, elegant, understated)"
```

---

## 🚫 STRICT ANTI-AI DESIGN RULES (DO NOT VIOLATE)
1. **NO Ugly Washed-Out Colors or Pink/Purple Tints**:
   - Look at the broken toggle in the user's screenshot: NO washed-out pink/red background tints! NO cartoon gradients.
   - All card surfaces must be **Pure Deep Black `#050505`** with crisp hairline borders `border border-zinc-800/80`.
2. **NO Broken Switch / Toggle Buttons (CRITICAL FIX)**:
   - The toggle thumb (white circle) **MUST NEVER OVERFLOW OR STICK OUTSIDE** the capsule boundary!
   - Use pixel-perfect switch CSS where the thumb is strictly contained:
     `h-6 w-11 rounded-full bg-zinc-800 relative transition-colors p-[2px]` and thumb `h-5 w-5 rounded-full bg-white transition-transform transform translate-x-0 peer-checked:translate-x-5 peer-checked:bg-white`.
     When active, the switch track turns into **Electric Cyan `#00aff4`** or clean Emerald, NOT ugly pink.
3. **NO Cheap Disclaimers**:
   - DO NOT write cheesy filler text like *"Simulated profile; system settings remain untouched."*
   - Write real, professional technical feedback: *"High-performance power plan engaged · Background dev processes suspended · Standby RAM purged"*.
4. **NO Mobile Bottom Bar on Windows**:
   - This is a native Windows desktop app. A mobile bottom navigation bar looks completely ridiculous on desktop. Use a clean top bar or minimal side navigation.
5. **NO Bloated Animations**:
   - Only instant, crisp 150ms transitions on hover/click. No slow, annoying floating or bouncing animations.

---

## 🎛️ CORE LAYOUT: THE "TEAMPVOICE-STYLE" APP MATRIX (LAUNCHPAD)
Instead of a scattered dashboard, the main screen is an ultra-clean, spacious **Application Matrix** inspired directly by the "Everything you need" grid on **teampvoice.com**:

### The Grid of 8 Core Modules (Cards with `bg-[#0a0a0a] border border-zinc-800/80 hover:border-zinc-700`):
1. 📁 **Projects Vault** (`d:\dev26-27` with 64 projects, Active/Sold/Experiment tags, 1-click VS Code launcher).
2. 🎓 **Study Hub** (PDF/DOCX lecture slides reader, ELI5 summaries, interactive practice exam quizzes, and audio TTS).
3. 🎮 **Game Hub & Turbo Mode** (Steam/Epic/Riot games scanner, pixel-perfect Turbo Boost switch with zero thumb overflow, RAM flush).
4. 🧹 **Clean Janitor** (1-click Desktop & Downloads organizer into structured folders).
5. 💾 **Versioned Project Backups** (Snapshot generator with `v1.0.0` SemVer, history sorted newest to oldest, restore).
6. 🚨 **Deadline & Exam Radar** (Countdown timers for submissions and exams, warnings in Dynamic Island).
7. 🎵 **Music Hub** (Offline MP3 downloader from URLs, ad-free local player, audio waveform).
8. ⚙️ **Settings & Hotkeys** (Rebindable keyboard shortcuts matrix).

---

## 🏝️ THE DESKTOP DYNAMIC ISLAND (MINIMALIST HARDWARE PILL)
- Positioned: `fixed top-3 left-1/2 -translate-x-1/2 z-50`.
- **Pure Black OLED Glass (`h-9 px-4 rounded-full bg-black border border-zinc-800/80 shadow-2xl flex items-center gap-3`)**:
  - Thin, understated timer (`24:50` in crisp white font-mono).
  - Tiny, delicate audio waveform bars in `#00aff4` (TempVoice cyan) when music or lecture audio is playing.
  - Subtle status dot.
  - Smooth spring expansion on hover to reveal audio controls, timer pause, and quick project launch.

---

## 📁 COMPONENT ARCHITECTURE TO OUTPUT
- `components/island/DynamicIsland.tsx` (Minimalist pure black pill, audio waveform, timer).
- `components/gaming/GameHub.tsx` (Installed games grid, pixel-perfect Turbo Boost toggle with ZERO overflow).
- `components/projects/ProjectsVault.tsx` (Teampvoice-style clean project cards, VS Code launcher).
- `components/projects/BackupModal.tsx` (Versioned backups timeline).
- `components/study/StudyHub.tsx` (PDF/DOCX reader, quiz engine, audio TTS).
- `components/janitor/JanitorModal.tsx` (1-click Desktop and Downloads cleanup).
- `components/radar/DeadlineRadar.tsx` (Exam and assignment countdowns).
- `components/music/MusicHub.tsx` (Offline audio player and downloader).
- `components/settings/SettingsShortcuts.tsx` (Keybindings matrix).
- `app/page.tsx` (The Teampvoice-inspired launchpad matrix).

Deliver production-ready, clean TypeScript code matching the exact caliber of **teampvoice.com**!
