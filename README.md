# 🧠 CortexOS — Neural Command Center

نظام تشغيل وإدارة متقدم للمطورين والطلاب واللاعبين، مبني باستخدام **React 19** و **Tailwind CSS v4** و **Express Engine**.

---

## 🚀 تشغيل البرنامج والمحرك بأمر واحد (One Command Launch)

لشغيل الواجهة ومحرك الباك إند معاً في نفس الوقت، يمكنك استخدام أي من الطرق التالية:

### الطريقة 1: عبر التيرمينال (Terminal)
```bash
pnpm dev
# أو
npm run dev
```

### الطريقة 2: عبر ملف الاختصار المباشر (Windows Shortcut)
- اضغط مرتين على ملف **`dev.bat`**
- أو من التيرمينال: `.\dev.bat`

---

## 📡 الروابط والمنافذ (Ports & URLs)

- 🖥️ **واجهة البرنامج (Frontend UI):** [http://localhost:5173](http://localhost:5173)
- ⚡ **محرك الباك إند (Engine API):** [http://localhost:3001/api](http://localhost:3001/api)
- 🩺 **فحص الصحة (Health Check):** [http://localhost:3001/api/health](http://localhost:3001/api/health)
- 💻 **معلومات العتاد (System Info):** [http://localhost:3001/api/system/info](http://localhost:3001/api/system/info)

---

## 📁 هيكل المشروع المنظم (Clean Project Structure)

```
d:\dev26-27\app\
├── public/                 # الأيقونات والملفات الثابتة
├── src/                    # كود الواجهة الأمامية (React 19 + TypeScript)
│   ├── components/         # المكونات ومكتبة UI الكاملة (55 مكون)
│   ├── hooks/              # الـ Hooks المخصصة
│   ├── lib/                # أدوات مساعدة وجسر Tauri
│   ├── pages/              # صفحات المسارات
│   ├── App.tsx             # التطبيق الرئيسي والوحدات السبعة
│   ├── index.css           # التصميم وتنسيقات Tailwind v4
│   └── main.tsx            # نقطة انطلاق الواجهة
├── server/                 # محرك الباك إند (Express + TypeScript)
│   ├── routes/             # مسارات الـ API (جاهزة للتوسيع)
│   │   ├── health.ts
│   │   └── system.ts
│   └── index.ts            # ملف تشغيل المحرك
├── dev.bat                 # اختصار التشغيل بنقرة واحدة (Windows Batch)
├── dev.ps1                 # اختصار التشغيل عبر PowerShell
├── index.html              # ملف HTML الرئيسي
├── vite.config.ts          # إعدادات Vite مع بروكسي تلقائي للباك إند
├── tsconfig.json           # إعدادات TypeScript للواجهة
└── package.json            # الحزم وأوامر التشغيل الموحدة
```

---

## 🛠️ أوامر إضافية (Scripts)

| الأمر | الوصف |
| :--- | :--- |
| `pnpm run dev` | تشغيل الواجهة والمحرك بالتوازي |
| `pnpm run dev:ui` | تشغيل واجهة المستخدم فقط (Vite) |
| `pnpm run dev:server` | تشغيل محرك الباك إند فقط (Express Engine) |
| `pnpm run build` | بناء كل من الواجهة والباك إند للإنتاج |
| `pnpm run typecheck` | فحص أخطاء الـ TypeScript |
