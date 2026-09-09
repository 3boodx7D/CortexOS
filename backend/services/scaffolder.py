import os
import json
import re
from typing import Dict, Any, List
from backend.services.ai_service import call_gemini, call_deepseek
from backend.config import GEMINI_PRO_MODEL, DEEPSEEK_MODEL

# 1. Ready-made production templates
STARTER_TEMPLATES = {
    "saas-next15": {
        "name": "Modern SaaS Starter",
        "description": "Next.js 15 App Router + Supabase Auth + Tailwind CSS + Lucide + Dark Mode",
        "stack": ["Next.js 15", "React 19", "Supabase", "Tailwind CSS", "TypeScript"],
        "category": "active",
        "files": {
            "package.json": {
                "name": "{NAME}",
                "version": "0.1.0",
                "private": True,
                "scripts": {
                    "dev": "next dev",
                    "build": "next build",
                    "start": "next start",
                    "lint": "next lint"
                },
                "dependencies": {
                    "next": "^15.1.0",
                    "react": "^19.0.0",
                    "react-dom": "^19.0.0",
                    "@supabase/supabase-js": "^2.48.0",
                    "lucide-react": "^0.475.0",
                    "clsx": "^2.1.1",
                    "tailwind-merge": "^3.0.1"
                },
                "devDependencies": {
                    "typescript": "^5.7.0",
                    "@types/node": "^22.0.0",
                    "@types/react": "^19.0.0",
                    "tailwindcss": "^4.0.0",
                    "@tailwindcss/postcss": "^4.0.0"
                }
            },
            "tsconfig.json": {
                "compilerOptions": {
                    "target": "ES2022",
                    "lib": ["dom", "dom.iterable", "esnext"],
                    "allowJs": True,
                    "skipLibCheck": True,
                    "strict": True,
                    "noEmit": True,
                    "esModuleInterop": True,
                    "module": "esnext",
                    "moduleResolution": "bundler",
                    "resolveJsonModule": True,
                    "isolatedModules": True,
                    "jsx": "preserve",
                    "incremental": True,
                    "plugins": [{"name": "next"}],
                    "paths": {"@/*": ["./src/*"]}
                },
                "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
                "exclude": ["node_modules"]
            },
            ".env.example": "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key\n",
            "README.md": "# {TITLE}\n\nHigh-performance SaaS platform built with Next.js 15 App Router and Supabase.\n\n## Quick Start\n```bash\npnpm install\npnpm dev\n```\n",
            "src/app/layout.tsx": 'import type { Metadata } from "next";\nimport "./globals.css";\n\nexport const metadata: Metadata = {\n  title: "{TITLE}",\n  description: "Built with CortexOS Neural Scaffolder",\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en" className="dark">\n      <body className="bg-black text-white antialiased min-h-screen font-sans">{children}</body>\n    </html>\n  );\n}\n',
            "src/app/page.tsx": 'import { Rocket, ShieldCheck, Zap } from "lucide-react";\n\nexport default function Home() {\n  return (\n    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-radial from-zinc-900 to-black">\n      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-6">\n        <Zap size={13} /> {TITLE} · PRODUCTION READY\n      </div>\n      <h1 className="text-5xl font-bold tracking-tight mb-4">Welcome to {TITLE}</h1>\n      <p className="text-zinc-400 max-w-md mb-8">Architected with Next.js 15, Tailwind v4, and Supabase cloud authentication.</p>\n      <div className="flex gap-4">\n        <button className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition">\n          <Rocket size={16} /> Launch App\n        </button>\n      </div>\n    </main>\n  );\n}\n',
            "src/app/globals.css": '@import "tailwindcss";\n\n:root {\n  --background: #000000;\n  --foreground: #ffffff;\n}\n'
        }
    },
    "discord-bot": {
        "name": "Discord Bot Master",
        "description": "Discord.js v14 + TypeScript + Slash Commands + Event Handlers + .env template",
        "stack": ["Discord.js", "TypeScript", "Node.js"],
        "category": "active",
        "files": {
            "package.json": {
                "name": "{NAME}",
                "version": "1.0.0",
                "main": "dist/index.js",
                "scripts": {
                    "build": "tsc",
                    "start": "node dist/index.js",
                    "dev": "tsx watch src/index.ts"
                },
                "dependencies": {
                    "discord.js": "^14.17.3",
                    "dotenv": "^16.4.7"
                },
                "devDependencies": {
                    "typescript": "^5.7.0",
                    "tsx": "^4.19.2",
                    "@types/node": "^22.0.0"
                }
            },
            "tsconfig.json": {
                "compilerOptions": {
                    "target": "ES2022",
                    "module": "NodeNext",
                    "moduleResolution": "NodeNext",
                    "outDir": "./dist",
                    "rootDir": "./src",
                    "strict": True,
                    "esModuleInterop": True,
                    "skipLibCheck": True
                }
            },
            ".env.example": "DISCORD_TOKEN=your_bot_token_here\nCLIENT_ID=your_client_id_here\nGUILD_ID=your_guild_id_here\n",
            "README.md": "# {TITLE}\n\nModular Discord.js v14 Bot.\n\n## Setup\n1. Copy `.env.example` to `.env` and fill tokens.\n2. `npm install`\n3. `npm run dev`\n",
            "src/index.ts": 'import { Client, GatewayIntentBits, Events } from "discord.js";\nimport * as dotenv from "dotenv";\ndotenv.config();\n\nconst client = new Client({\n  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]\n});\n\nclient.once(Events.ClientReady, (c) => {\n  console.log(`⚡ {TITLE} is online as ${c.user.tag}!`);\n});\n\nclient.on(Events.InteractionCreate, async (interaction) => {\n  if (!interaction.isChatInputCommand()) return;\n  if (interaction.commandName === "ping") {\n    await interaction.reply("🏓 Pong! Latency: " + client.ws.ping + "ms");\n  }\n});\n\nclient.login(process.env.DISCORD_TOKEN);\n'
        }
    },
    "tauri-desktop": {
        "name": "Tauri v2 Native Desktop App",
        "description": "Tauri v2 + React 19 + Vite 6 + Tailwind CSS + Rust Daemon",
        "stack": ["Tauri", "Rust", "React 19", "Vite", "Tailwind CSS"],
        "category": "active",
        "files": {
            "package.json": {
                "name": "{NAME}",
                "version": "0.1.0",
                "private": True,
                "type": "module",
                "scripts": {
                    "dev": "vite",
                    "build": "tsc && vite build",
                    "tauri": "tauri"
                },
                "dependencies": {
                    "react": "^19.0.0",
                    "react-dom": "^19.0.0",
                    "lucide-react": "^0.475.0",
                    "@tauri-apps/api": "^2.0.0"
                },
                "devDependencies": {
                    "@tauri-apps/cli": "^2.0.0",
                    "typescript": "^5.7.0",
                    "vite": "^6.0.0",
                    "@vitejs/plugin-react": "^4.3.0"
                }
            },
            "README.md": "# {TITLE}\n\nHigh-performance native desktop application with Tauri v2 & React 19.\n\n```bash\npnpm install\npnpm tauri dev\n```\n",
            "src/App.tsx": 'import { useState } from "react";\nimport { Cpu, Terminal } from "lucide-react";\n\nexport default function App() {\n  return (\n    <div className="min-h-screen bg-black text-white p-8 font-sans">\n      <header className="flex items-center gap-3 border-b border-zinc-800 pb-4">\n        <Cpu className="text-cyan-400" />\n        <h1 className="text-xl font-bold">{TITLE}</h1>\n      </header>\n      <main className="mt-8">\n        <p className="text-zinc-400">Desktop window rendered via Tauri v2.</p>\n      </main>\n    </div>\n  );\n}\n'
        }
    },
    "fastapi-ai": {
        "name": "Python FastAPI AI Backend",
        "description": "FastAPI + Uvicorn + Pydantic v2 + Gemini & DeepSeek Integration + Dockerfile",
        "stack": ["Python", "FastAPI", "Uvicorn", "Gemini", "DeepSeek"],
        "category": "active",
        "files": {
            "requirements.txt": "fastapi>=0.115.0\nuvicorn[standard]>=0.32.0\npydantic>=2.10.0\npython-dotenv>=1.0.1\nhttpx>=0.28.0\n",
            ".env.example": "PORT=8000\nGOOGLE_AI_API_KEY=\nDEEPSEEK_API_KEY=\n",
            "README.md": "# {TITLE}\n\nFastAPI Neural API with high-throughput streaming endpoints.\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload --port 8000\n```\n",
            "main.py": 'from fastapi import FastAPI\nfrom pydantic import BaseModel\nimport os\n\napp = FastAPI(title="{TITLE}")\n\n@app.get("/")\ndef root():\n    return {"status": "online", "app": "{TITLE}"}\n\n@app.get("/health")\ndef health():\n    return {"ok": True}\n'
        }
    }
}

def scaffold_template_project(workspace_path: str, project_name: str, template_id: str) -> Dict[str, Any]:
    """Scaffolds a project from a pre-built template."""
    clean_name = re.sub(r'[^a-zA-Z0-9_\-]', '-', project_name).lower().strip('-')
    if not clean_name:
        clean_name = "new-cortex-project"
        
    target_dir = os.path.join(workspace_path, clean_name)
    if os.path.exists(target_dir):
        # Append timestamp to avoid overwriting
        import time
        target_dir = f"{target_dir}-{int(time.time()) % 10000}"
        
    os.makedirs(target_dir, exist_ok=True)
    
    template = STARTER_TEMPLATES.get(template_id, STARTER_TEMPLATES["saas-next15"])
    files_created = []
    
    for rel_path, content in template["files"].items():
        full_path = os.path.join(target_dir, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        if isinstance(content, dict):
            # JSON format
            text_content = json.dumps(content, indent=2)
        else:
            text_content = str(content)
            
        # Replace variables
        text_content = text_content.replace("{NAME}", clean_name).replace("{TITLE}", project_name)
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(text_content)
            
        files_created.append(rel_path)
        
    return {
        "ok": True,
        "project_path": os.path.abspath(target_dir),
        "project_name": project_name,
        "files_created": files_created,
        "error": None
    }

def scaffold_ai_custom_project(workspace_path: str, project_name: str, prompt: str, stack_type: str = "web", provider: str = "gemini-pro") -> Dict[str, Any]:
    """
    Uses Gemini 3.6 Flash (or DeepSeek) to design and scaffold an entire project based on user prompt.
    """
    clean_name = re.sub(r'[^a-zA-Z0-9_\-]', '-', project_name).lower().strip('-')
    if not clean_name:
        clean_name = "ai-generated-app"
        
    target_dir = os.path.join(workspace_path, clean_name)
    if os.path.exists(target_dir):
        import time
        target_dir = f"{target_dir}-{int(time.time()) % 10000}"
        
    os.makedirs(target_dir, exist_ok=True)
    
    system_instruction = (
        "You are CortexOS Neural Scaffolder. When given a project idea, generate a complete, working project scaffold. "
        "Return ONLY a JSON dictionary where keys are relative filepaths (e.g. 'package.json', 'README.md', 'src/index.ts') "
        "and values are the complete, runnable file contents (strings). No markdown formatting or extra talk."
    )
    
    user_prompt = (
        f"Project Name: {project_name}\n"
        f"Category/Target: {stack_type}\n"
        f"User Idea & Specification: {prompt}\n\n"
        f"Generate at least:\n"
        f"1. package.json or requirements.txt with all modern dependencies\n"
        f"2. README.md explaining what the app does, setup commands, and architecture\n"
        f"3. Configuration files (.env.example, tsconfig.json or similar)\n"
        f"4. Realistic starter code in src/ implementing the core idea (not just empty placeholders)!"
    )
    
    raw_text = ""
    try:
        if provider == "deepseek":
            res = call_deepseek(user_prompt, model=DEEPSEEK_MODEL, system_prompt=system_instruction, timeout=30)
            raw_text = res["text"]
        else:
            res = call_gemini(user_prompt, model=GEMINI_PRO_MODEL, system_prompt=system_instruction, timeout=25)
            raw_text = res["text"]
    except Exception as e:
        print(f"[scaffolder] AI generation error: {e}, falling back to template")
        return scaffold_template_project(workspace_path, project_name, "saas-next15")
        
    # Extract JSON
    try:
        cleaned = raw_text.strip()
        if "```" in cleaned:
            # Extract content between first ``` and last ```
            parts = cleaned.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{") and part.endswith("}"):
                    cleaned = part
                    break
        files_dict = json.loads(cleaned)
    except Exception as e:
        print(f"[scaffolder] Failed to parse AI JSON: {e}, falling back to template")
        return scaffold_template_project(workspace_path, project_name, "saas-next15")
        
    files_created = []
    abs_target_dir = os.path.abspath(target_dir)

    for rel_path, file_content in files_dict.items():
        if not rel_path or not isinstance(rel_path, str):
            continue
        # Security: Strip leading slashes, backslashes, drive letters
        clean_rel = rel_path.lstrip("/\\").replace("\\", "/")
        # Reject path traversal (e.g. ../../)
        if any(part in {"..", "", "."} for part in clean_rel.split("/")):
            parts = [p for p in clean_rel.split("/") if p not in {"..", "", "."}]
            if not parts:
                continue
            clean_rel = "/".join(parts)

        full_path = os.path.abspath(os.path.join(abs_target_dir, clean_rel))
        
        # Security assertion: full_path MUST be strictly inside abs_target_dir
        if not full_path.startswith(abs_target_dir):
            continue

        if isinstance(file_content, dict):
            file_content = json.dumps(file_content, indent=2)
        else:
            file_content = str(file_content)

        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(file_content)
        files_created.append(clean_rel)
        
    return {
        "ok": True,
        "project_path": abs_target_dir,
        "project_name": project_name,
        "files_created": files_created,
        "error": None
    }
