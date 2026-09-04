export const projects = [
  {
    id: "cortexos",
    name: "CortexOS",
    path: "D:/dev26-27/cortexos",
    status: "active" as const,
    stack: ["Tauri", "React", "Supabase"],
    updatedAt: "Today, 09:42",
    progress: 68,
  },
  {
    id: "atlas",
    name: "Atlas Commerce",
    path: "D:/dev26-27/atlas-commerce",
    status: "client" as const,
    stack: ["Next.js", "Stripe", "Postgres"],
    updatedAt: "Yesterday, 18:12",
    progress: 84,
  },
  {
    id: "study-lab",
    name: "Study Lab",
    path: "D:/dev26-27/study-lab",
    status: "experiment" as const,
    stack: ["Python", "FastAPI", "AI"],
    updatedAt: "Aug 31, 14:20",
    progress: 36,
  },
  {
    id: "orbit",
    name: "Orbit Landing",
    path: "D:/dev26-27/orbit-landing",
    status: "archived" as const,
    stack: ["Vite", "Tailwind"],
    updatedAt: "Aug 25, 11:08",
    progress: 100,
  },
];

export const notes = [
  {
    id: "note-1",
    title: "CortexOS launch sequence",
    content: "Finish the command center surface, then connect the native Windows daemon.",
    tag: "CortexOS",
    pinned: true,
    updatedAt: "12 min ago",
  },
  {
    id: "note-2",
    title: "Networks revision",
    content: "Review TCP congestion control and subnetting examples before the next lab.",
    tag: "University",
    pinned: false,
    updatedAt: "Yesterday",
  },
  {
    id: "note-3",
    title: "Turbo mode checklist",
    content: "Capture running processes, lower priorities, restore the work profile.",
    tag: "Gaming",
    pinned: false,
    updatedAt: "2 days ago",
  },
];

export const deadlines = [
  {
    id: "deadline-1",
    title: "Computer Networks midterm",
    category: "exam" as const,
    targetAt: "2026-09-18T09:00:00.000Z",
    completed: false,
  },
  {
    id: "deadline-2",
    title: "CortexOS interface review",
    category: "submission" as const,
    targetAt: "2026-09-12T20:00:00.000Z",
    completed: false,
  },
  {
    id: "deadline-3",
    title: "Client staging renewal",
    category: "server" as const,
    targetAt: "2026-09-27T12:00:00.000Z",
    completed: false,
  },
  {
    id: "deadline-4",
    title: "Gym membership",
    category: "personal" as const,
    targetAt: "2026-10-01T08:00:00.000Z",
    completed: false,
  },
];

export const integrations = [
  {
    id: "replit-api",
    name: "Cortex API",
    category: "Core",
    status: "connected" as const,
    detail: "Command center data is online",
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "Cloud sync",
    status: "ready" as const,
    detail: "Connect when cloud sync is enabled",
  },
  {
    id: "gemini",
    name: "Gemini",
    category: "AI routing",
    status: "planned" as const,
    detail: "Large document analysis",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    category: "AI routing",
    status: "planned" as const,
    detail: "Code and reasoning workflows",
  },
];

export const activities = [
  {
    id: "activity-1",
    title: "CortexOS synced",
    detail: "The project vault is up to date",
    time: "12 min ago",
    type: "project" as const,
  },
  {
    id: "activity-2",
    title: "Study session completed",
    detail: "Computer Networks · 42 minutes",
    time: "1 hr ago",
    type: "study" as const,
  },
  {
    id: "activity-3",
    title: "Work mode restored",
    detail: "Development processes are running again",
    time: "Yesterday",
    type: "system" as const,
  },
];