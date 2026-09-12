import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { apiGet } from '@/lib/api-client';

export type TauriResult<T> = { source: 'tauri' | 'mock'; value: T };

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isTauri(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<TauriResult<T>> {
  const hasTauri = isTauri();
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
            brand: 'Unknown CPU (Mock)',
            usage: 0,
            cores: 0,
          },
          memory: {
              total_gb: 0,
              free_gb: 0,
              used_gb: 0,
              usage_percent: 0
          },
          gpus: ['Unknown GPU (Mock)'],
          gpu: 'Unknown GPU (Mock)',
          disks: []
      } as T) };
  }
  
  return { source: 'mock', value: ({ ok: true, command, args, timestamp: Date.now() } as T) };
}

export async function openExternal(target: string): Promise<TauriResult<{ opened: boolean }>> {
  const hasTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  if (hasTauri) {
    try {
      const { openUrl, openPath } = await import('@tauri-apps/plugin-opener');
      if (target.startsWith('http://') || target.startsWith('https://')) {
        await openUrl(target);
      } else {
        await openPath(target);
      }
      return { source: 'tauri', value: { opened: true } };
    } catch (e) {
      console.warn('tauri-plugin-opener error:', e);
    }
  }
  
  if (typeof window !== 'undefined' && (target.startsWith('http://') || target.startsWith('https://'))) {
    window.open(target, '_blank');
  }
  return { source: 'mock', value: { opened: true } };
}

export async function organizeWorkspace(): Promise<TauriResult<{ filesMoved: number; foldersCreated: number }>> {
  return invoke<{ filesMoved: number; foldersCreated: number }>('organize_workspace');
}

export async function pickDirectory(): Promise<string | null> {
  try {
    const data = await apiGet<{ path: string; canceled?: boolean }>('/api/system/pick-directory');
    if (data && data.path && !data.canceled) {
      return data.path;
    }
  } catch (err) {
    console.warn('pick-directory error:', err);
  }
  return null;
}