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
    return { source: 'tauri', value: { command, args } as T };
  }
  await wait(70);
  return { source: 'mock', value: ({ ok: true, command, args, timestamp: Date.now() } as T) };
}

export async function openExternal(target: string): Promise<TauriResult<{ opened: boolean }>> {
  return invoke<{ opened: boolean }>('open_external', { target });
}

export async function organizeWorkspace(): Promise<TauriResult<{ filesMoved: number; foldersCreated: number }>> {
  return invoke<{ filesMoved: number; foldersCreated: number }>('organize_workspace');
}