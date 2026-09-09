# 🚀 RULE 05: ONBOARDING & SETTINGS EXTENSIBILITY
### *First-Time User Wizard & Modular Settings Blueprint*
> **Enforcement Scope:** First-time onboarding flow (`src/components/onboarding.tsx`) and general settings (`src/pages/settings.tsx`).

---

## 1. The Extensibility Mandate

CortexOS is under active iterative development:
> **"بدي تشرح للـ AI إنو في قائمة إعدادات للمستخدم الجديد، وهي الإعدادات يمكن بالمستقبل بدي أضيف عليها أكيد، عشان لسى المشروع مش كامل."**

The first-run onboarding wizard and the settings matrix are built as a **modular pipeline**. Any AI assistant must be capable of smoothly inserting new steps or preference toggles without disrupting existing user configurations.

---

## 2. The Current Onboarding Flow (`src/components/onboarding.tsx`)

1. **Step 0 — Language:** User selects English (`en`) or Arabic (`ar`). Saves to `cortex-locale` and sets direction (`dir="ltr"` / `dir="rtl"`).
2. **Step 1 — Theme:** User chooses Obsidian Dark (`dark`) or Titanium Light (`light`). Updates `cortex-theme` and `data-theme`.
3. **Step 2 — Motion Engine:** User chooses 60 FPS Fluid & Smooth (`cinematic`) or 30 FPS Minimal & Fast (`minimal`). Updates `cortex-motion` and `data-motion`.
4. **Step 3 — Completion:** "Launch CortexOS" action, marks onboarding finished in persistent storage.

---

## 3. The 4-Step Blueprint for Adding New Settings or Steps

Whenever asked to add a new user setting (e.g., Default Code Editor path, Default AI Model selection, Auto-launch on Windows startup, Sound effects toggle):

### Step 1: Determine Storage Scope
- **Machine-Wide Setting (Local to this PC only):** Use `usePersistent<T>('cortex-your-key', defaultValue)` from `src/hooks/use-persistent.ts`.
- **User-Scoped Setting (Synced to Cloud per Supabase account):** Use `useUserPersistent<T>('your-key', defaultValue)` from `src/lib/user-store.tsx`.

### Step 2: Add Bilingual Translations
Add matching keys to both files:
- `src/locales/en.json`:
  ```json
  "onboarding": {
    "customSettingTitle": "Default Code Editor",
    "customSettingDesc": "Select your preferred IDE for opening projects."
  }
  ```
- `src/locales/ar.json`:
  ```json
  "onboarding": {
    "customSettingTitle": "محرر الأكواد الافتراضي",
    "customSettingDesc": "اختر بيئة التطوير المفضلة لديك لفتح المشاريع بنقرة واحدة."
  }
  ```

### Step 3: Extend `src/components/onboarding.tsx`
1. Expand the step count in progress dots:
   ```tsx
   {[0, 1, 2, 3, 4].map((i) => (...))}
   ```
2. Adjust `nextStep` ceiling check:
   ```tsx
   const nextStep = () => {
     if (step < 4) setStep(step + 1);
     else onComplete();
   };
   ```
3. Add step markup using standardized obsidian option cards.

### Step 4: Mirror the Setting in `src/pages/settings.tsx`
**Strict Rule:** Any preference introduced in Onboarding **MUST** also be adjustable later inside `src/pages/settings.tsx` under the relevant tab (`account`, `desktop`, `data`, `privacy`, or `about`). The UI card styling must be consistent:
```tsx
<div className="desktop-settings-group">
  <div className="group-header">
    <Icon size={16} className="text-cyan" />
    <div>
      <b>{t('settings.desktop.yourFeature')}</b>
      <small className="block text-muted-foreground">{t('settings.desktop.yourFeatureDesc')}</small>
    </div>
  </div>
  {/* Option controls */}
</div>
```
