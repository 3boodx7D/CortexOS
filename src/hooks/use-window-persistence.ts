import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';

export function useWindowPersistence() {
  const isRestored = useRef(false);

  useEffect(() => {
    const hasTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
    if (!hasTauri) return;

    const appWindow = getCurrentWindow();

    async function restoreWindowState() {
      if (isRestored.current) return;
      isRestored.current = true;
      try {
        const raw = localStorage.getItem('cortex_window_geometry');
        if (raw) {
          const state = JSON.parse(raw);
          if (state.isMaximized) {
            await appWindow.maximize();
            return;
          }
          if (typeof state.width === 'number' && typeof state.height === 'number' && state.width >= 800 && state.height >= 550) {
            await appWindow.setSize(new PhysicalSize(state.width, state.height));
          }
          if (typeof state.x === 'number' && typeof state.y === 'number' && state.x >= -100 && state.y >= -100) {
            await appWindow.setPosition(new PhysicalPosition(state.x, state.y));
          }
        }
      } catch (e) {
        console.warn('Failed to restore window geometry:', e);
      }
    }

    restoreWindowState();

    let saveTimeout: any = null;
    const saveState = async () => {
      try {
        const isMax = await appWindow.isMaximized();
        if (isMax) {
          localStorage.setItem('cortex_window_geometry', JSON.stringify({ isMaximized: true }));
          return;
        }
        const size = await appWindow.outerSize();
        const pos = await appWindow.outerPosition();
        if (size && size.width >= 600 && size.height >= 400) {
          localStorage.setItem(
            'cortex_window_geometry',
            JSON.stringify({
              width: size.width,
              height: size.height,
              x: pos.x,
              y: pos.y,
              isMaximized: false,
            })
          );
        }
      } catch {
        // ignore
      }
    };

    const triggerSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveState, 400);
    };

    let unlistenResize: (() => void) | undefined;
    let unlistenMove: (() => void) | undefined;

    appWindow.listen('tauri://resize', triggerSave).then((unlisten) => {
      unlistenResize = unlisten;
    }).catch(() => {});

    appWindow.listen('tauri://move', triggerSave).then((unlisten) => {
      unlistenMove = unlisten;
    }).catch(() => {});

    window.addEventListener('beforeunload', saveState);

    return () => {
      clearTimeout(saveTimeout);
      saveState();
      window.removeEventListener('beforeunload', saveState);
      if (unlistenResize) unlistenResize();
      if (unlistenMove) unlistenMove();
    };
  }, []);
}
