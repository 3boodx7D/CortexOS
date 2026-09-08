import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export type TauriResult<T> = { source: 'tauri' | 'mock'; value: T };

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<TauriResult<T>> {
  const hasTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  if (hasTauri) {
    try {
      const result = await tauriInvoke<T>(command, args);
      return { source: 'tauri', value: result };
    } catch (e) {
      console.warn(`Tauri command ${command} failed:`, e);
      // Fall through to mock on error
    }
  }
  await wait(70);
  
  if (command === 'get_system_info') {
      return { source: 'mock', value: ({
          platform: 'windows',
          cpu: {
            brand: 'Intel(R) Core(TM) Ultra 7 155H',
            usage: 14.2,
            cores: 22,
          },
          memory: {
              total_gb: 15.4,
              free_gb: 3.8,
              used_gb: 11.6,
              usage_percent: 75.3
          },
          gpus: ['Intel(R) Arc(TM) Graphics', 'NVIDIA GeForce RTX 3050 6GB Laptop GPU'],
          gpu: 'NVIDIA GeForce RTX 3050 6GB Laptop GPU',
          disks: [
            { drive: 'C:', label: 'AboodOS', total_gb: 930.5, used_gb: 501.1, free_gb: 429.4, percent: 53.9 },
            { drive: 'D:', label: 'New Volume', total_gb: 931.5, used_gb: 191.3, free_gb: 740.2, percent: 20.5 }
          ]
      } as T) };
  }
  
  return { source: 'mock', value: ({ ok: true, command, args, timestamp: Date.now() } as T) };
}

export async function openExternal(target: string): Promise<TauriResult<{ opened: boolean }>> {
  return invoke<{ opened: boolean }>('open_external', { target });
}

export async function organizeWorkspace(): Promise<TauriResult<{ filesMoved: number; foldersCreated: number }>> {
  return invoke<{ filesMoved: number; foldersCreated: number }>('organize_workspace');
}

export async function pickDirectory(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:8000/api/system/pick-directory');
    if (res.ok) {
      const data = await res.json();
      if (data.path && !data.canceled) {
        return data.path;
      }
      if (data.canceled) {
        return null;
      }
    }
  } catch (err) {
    console.warn('pick-directory error:', err);
  }
  return null;
}