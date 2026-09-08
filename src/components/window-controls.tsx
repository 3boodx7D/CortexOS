import { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const hasTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
    if (!hasTauri) return;
    try {
      const appWindow = getCurrentWindow();
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
      const unlisten = appWindow.listen('tauri://resize', async () => {
        try {
          const max = await appWindow.isMaximized();
          setIsMaximized(max);
        } catch {}
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => {});
      };
    } catch {}
  }, []);

  const handleMinimize = async () => {
    try { await getCurrentWindow().minimize(); } catch (e) { console.warn('Minimize error:', e); }
  };

  const handleMaximize = async () => {
    try { await getCurrentWindow().toggleMaximize(); } catch (e) { console.warn('Maximize error:', e); }
  };

  const handleClose = async () => {
    try { await getCurrentWindow().close(); } catch (e) { console.warn('Close error:', e); }
  };

  return (
    <div className="window-controls">
      <button 
        type="button" 
        className="window-btn" 
        onClick={handleMinimize} 
        title="Minimize"
        aria-label="Minimize window"
      >
        <Minus size={13} />
      </button>
      <button 
        type="button" 
        className="window-btn" 
        onClick={handleMaximize} 
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {isMaximized ? <Copy size={11} style={{ transform: 'rotate(90deg)' }} /> : <Square size={11} />}
      </button>
      <button 
        type="button" 
        className="window-btn window-btn-close" 
        onClick={handleClose} 
        title="Close"
        aria-label="Close window"
      >
        <X size={14} />
      </button>
    </div>
  );
}
