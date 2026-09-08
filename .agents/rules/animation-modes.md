# CortexOS Animation & Motion Guidelines

When working on animations or transitions in CortexOS, you MUST respect the user's selected motion mode. The application has two distinct animation modes that dictate how movement should behave:

## 1. Cinematic Mode (`60fps`)
- **Key value:** `data-motion="cinematic"`
- **Behavior:** Smooth, elegant, and fluid animations.
- **Rules:**
  - Use standard easing functions (e.g., `ease-out`, `ease-in-out`).
  - Durations should be noticeable but snappy (e.g., `200ms` - `300ms`).
  - Enable all micro-interactions, scale effects (`zoom-in-95`), and slide transitions.

## 2. Minimal Mode (`30fps`)
- **Key value:** `data-motion="minimal"`
- **Behavior:** Snappy, instantaneous, or highly reduced motion.
- **Rules:**
  - Avoid large scaling or long sliding animations.
  - If animations must exist, use extremely short durations (e.g., `33ms` or `0ms`) and `linear` easing.
  - Prefer simple fade-ins over complex structural animations to save processing power and reduce visual noise for users who prefer minimal movement.

## Implementation Details
These settings are globally controlled via CSS variables attached to `:root` based on the `data-motion` attribute on the `<html>` element.

Example CSS pattern:
```css
/* Default cinematic */
.my-element {
  transition: all var(--motion-duration, 250ms) var(--motion-ease, ease-out);
}

/* Minimal override is handled globally in index.css */
[data-motion="minimal"] {
  --motion-duration: 33ms;
  --motion-ease: linear;
}
```

Never hardcode long animation durations. Always use the `--motion-duration` and `--motion-ease` CSS variables to ensure the user's performance preference is respected globally!
