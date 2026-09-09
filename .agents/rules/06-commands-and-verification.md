# 💻 RULE 06: COMMANDS & QUALITY VERIFICATION
### *Runtime Commands, Build Targets & Mandatory Verification Gates*
> **Enforcement Scope:** All command execution, testing, and pre-completion quality assurance.

---

## 1. Primary Runtime & Development Commands

Always use `pnpm` inside `d:\dev26-27\app`:

| Command | Purpose & Description |
| :--- | :--- |
| `pnpm run desktop` | **Full Native Desktop Experience**: Spawns Tauri v2 + Vite 6 + Python FastAPI telemetry daemon concurrently. |
| `pnpm run dev` | **Web + Telemetry**: Starts Vite web interface (port 5173) and Python hardware server (port 8000). |
| `pnpm run dev:ui` | **Frontend Only**: Starts only Vite on port 5173 (browser mode with mock IPC). |
| `pnpm run dev:server` | **Backend Only**: Starts only the Python FastAPI hardware telemetry engine on port 8000. |
| `pnpm run typecheck` | **Mandatory Type Verification**: Executes `tsc -b` across the entire project. |
| `pnpm run build` | **Production Bundle**: Builds the optimized web assets into `dist/`. |

---

## 2. The Mandatory Pre-Completion Quality Gate

Before declaring ANY task complete, you **MUST** run:
```powershell
pnpm run typecheck
```

### Passing Criteria:
- **0 errors, 0 warnings.**
- If `tsc -b` fails, you must inspect the error, repair types, and re-run until completely clean.
- Never use `@ts-ignore` or `any` to silence legitimate TypeScript type errors.

---

## 3. The AI Pre-Completion Checklist

Before reporting back to the user, ensure you have verified:
1. ✅ **Dual-Motion Supported:** Does the UI work in both `minimal` (0ms snappy) and `cinematic` (smooth 280ms cascade) modes?
2. ✅ **No Switch Overflow:** Are all toggle switches aligned, with the thumb cleanly inside the capsule boundary in both LTR and RTL?
3. ✅ **No Missing Translations:** Are all newly added labels defined in both `src/locales/en.json` and `src/locales/ar.json`?
4. ✅ **Windows Native Controls:** Does the top bar have `data-tauri-drag-region` while interactive buttons have `data-tauri-drag-region="false"`?
5. ✅ **Clean Typecheck:** Did `pnpm run typecheck` complete with zero errors?
