# 🎬 RULE 03: THE GOLDEN DUAL-MOTION ENGINE
### *Strict Two Animation Modes: Minimal (Snappy) vs Cinematic (Fluid)*
> **Enforcement Scope:** All page transitions, card cascades, hover states, micro-interactions, and Framer Motion logic.

---

## 1. The Core Requirement

In CortexOS, animations are **NOT** one-size-fits-all. The user switches between two distinct performance/aesthetic modes via Settings (`src/pages/settings.tsx`) and Onboarding (`src/components/onboarding.tsx`):

> **"إذا ضفت صفحة يعمللها أنميشن ضعيف وأنميشن قوي، لأنو بالإعدادات في خيار أنميشن ضعيف وأنميشن قوي."**

The active mode is stored in `localStorage.getItem('cortex-motion')` and rendered onto `<html data-motion="...">`:

| Mode | Technical Value | UI Name | Arabic Name | Behavior & Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Light & Snappy** | `"minimal"` | `Light & Snappy` | **خفيف وسريع** | `0ms` instant response, no delays, no transitions, zero bouncing/sliding. Optimized for low-end hardware & rapid workflow. |
| **Fluid & Cinematic** | `"cinematic"` | `Fluid & Cinematic` | **سينمائي وسلس** | 60 FPS smooth entrances (`cortex-page-cinematic 280ms cubic-bezier(0.16, 1, 0.3, 1)`), staggered card cascade, subtle depth lifts (`translateY(-2px)`), radiant cyan glow. |

---

## 2. Technical Wiring Under the Hood

### 1. Root Configuration (`src/App.tsx`):
```tsx
const [motion] = usePersistent<string>('cortex-motion', 'cinematic');
useEffect(() => {
  document.documentElement.setAttribute('data-motion', motion);
}, [motion]);
```

### 2. Global CSS Engine (`src/index.css`):
```css
/* Mode 1: Minimal (Light & Snappy) */
[data-motion="minimal"] .page-in,
[data-motion="minimal"] .page-in *,
[data-motion="minimal"] .settings-tab-pane,
[data-motion="minimal"] .settings-tab-pane * {
  animation: none !important;
}
[data-motion="minimal"] * {
  transition-duration: 0ms !important;
  animation-duration: 0ms !important;
}
[data-motion="minimal"] .pulse-dot,
[data-motion="minimal"] .pulse-dot-green,
[data-motion="minimal"] .tiny-led,
[data-motion="minimal"] .motion-dot {
  animation: none !important;
}

/* Mode 2: Cinematic (Fluid & Cinematic) */
[data-motion="cinematic"] .page-in {
  animation: cortex-page-cinematic 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
[data-motion="cinematic"] .page-in .module-card,
[data-motion="cinematic"] .page-in .project-card,
[data-motion="cinematic"] .page-in .game-card {
  animation: cortex-card-cascade 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
[data-motion="cinematic"] .page-in .module-card:nth-child(1) { animation-delay: 20ms; }
[data-motion="cinematic"] .page-in .module-card:nth-child(2) { animation-delay: 40ms; }
[data-motion="cinematic"] .page-in .module-card:nth-child(3) { animation-delay: 60ms; }
[data-motion="cinematic"] .page-in .module-card:nth-child(4) { animation-delay: 80ms; }
```

---

## 3. Strict Rules for Adding or Modifying Pages

Whenever you create or update a page or component:

1. **Always wrap in `.page-in`:** In `src/components/app-shell.tsx`, the main view is wrapped in:
   ```tsx
   <div className="page-wrap page-in" key={location}>{children}</div>
   ```
   **Never remove `key={location}`** — it is what triggers page re-entrance upon route changes!
2. **Card Staggering:** Assign cards classes such as `.module-card`, `.project-card`, or `.game-card` so they automatically cascade in Cinematic mode.
3. **If Using Framer Motion:**
   Never hardcode fixed animations that ignore `data-motion`. Always inspect the active motion setting:
   ```tsx
   import { usePersistent } from '@/hooks/use-persistent';
   
   const [motion] = usePersistent<'minimal' | 'cinematic'>('cortex-motion', 'cinematic');
   const isCinematic = motion === 'cinematic';

   <motion.div
     initial={isCinematic ? { opacity: 0, y: 8 } : false}
     animate={{ opacity: 1, y: 0 }}
     transition={isCinematic ? { duration: 0.28, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
   >
     {content}
   </motion.div>
   ```
4. **Zero Layout Shifts:** Animations must NEVER cause horizontal scrollbars or sudden layout jumps.
