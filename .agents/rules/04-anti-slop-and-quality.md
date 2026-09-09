# 🚫 RULE 04: STRICT ANTI-SLOP & CODE QUALITY
### *Prohibited Antipatterns, Anti-Hallucination & Quality Gates ("ممنوعات الكود والهبد")*
> **Enforcement Scope:** All pull requests, code modifications, component refactors, and styling additions.

---

## 1. Zero Uninstalled Packages & Real Dependencies

1. **Check `package.json` First:** Never assume a package exists. Inspect `package.json` before importing.
2. **Approved Routing:** The application strictly uses **`wouter`**.
   - ❌ DO NOT import `react-router-dom` (`useNavigate`, `Link`, `useParams`).
   - ❌ DO NOT import `next/router` or `next/navigation`.
   - ✅ DO import from `wouter` (`useLocation`, `Link`, `Route`, `Switch`).
3. **Approved UI Components:** Radix UI primitives (`@radix-ui/react-*`), Lucide Icons (`lucide-react`), Framer Motion (`framer-motion`), Recharts (`recharts`).

---

## 2. Pixel-Perfect Switch / Toggle Buttons (CRITICAL FIX)

The toggle thumb (the moving circle) **MUST NEVER OVERFLOW OR STICK OUTSIDE** the capsule boundary!

### The Exact Geometric Formula:
- **Capsule Track:** `height: 22px`, `width: 42px`, `border-radius: 9999px`, `padding: 3px`.
- **Thumb Circle:** `height: 16px`, `width: 16px`, `border-radius: 9999px`, pure white `#ffffff`.
- **Translation in LTR:** `translateX(20px)`.
- **Translation in RTL:** `translateX(-20px)`.
- **Active State Color:** Electric Cyan `#00aff4` or Emerald `#10b981`. **NEVER washed-out pink or red!**

```css
/* Standard CortexOS switch in src/index.css */
.cortex-toggle {
  width: 42px;
  height: 22px;
  border-radius: 9999px;
  background-color: #27272a;
  position: relative;
  transition: background-color 150ms ease;
  padding: 3px;
  cursor: pointer;
}
.cortex-toggle.is-active {
  background-color: #00aff4;
}
.cortex-toggle .thumb {
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  background: #ffffff;
  transition: transform 150ms ease;
  transform: translateX(0);
}
[dir="ltr"] .cortex-toggle.is-active .thumb {
  transform: translateX(20px);
}
[dir="rtl"] .cortex-toggle.is-active .thumb {
  transform: translateX(-20px);
}
```

---

## 3. No Fake Copy or Demo Disclaimers

1. **NO Cheesy Filler:**
   - ❌ *"This is a simulated demo, no actual system settings were modified."*
   - ❌ *"Demo mode only, please connect backend."*
2. **Authoritative Engineering Copy Only:**
   - ✅ *"High-performance power plan engaged · RAM cache purged · Background dev threads suspended."*
   - ✅ *"System telemetry synchronized with local kernel daemon (FastAPI 8000)."*

---

## 4. Full Bilingual Parity (Arabic RTL & English LTR)

1. **Zero Hardcoded Strings:**
   - Every string presented to the user must be fetched via `t('key')` from `src/lib/i18n.tsx`.
   - Every new key added to `src/locales/en.json` **MUST** have an exact corresponding Arabic translation in `src/locales/ar.json`.
2. **Logical CSS Properties:**
   - Use `border-inline-start`, `padding-inline-end`, `margin-inline-start`, or explicit `[dir="rtl"]` selectors.
   - Chevron icons must dynamically reverse direction in RTL.

---

## 5. Desktop Window Titlebar & Drag Regions

1. The desktop window has no native OS frame (`decorations: false`).
2. The top bar is designated as `data-tauri-drag-region`.
3. All interactive elements (search inputs, icons, buttons, window controls `-`, `□`, `✕`) **MUST HAVE** `data-tauri-drag-region="false"`. If you forget this, buttons will not register click events!
