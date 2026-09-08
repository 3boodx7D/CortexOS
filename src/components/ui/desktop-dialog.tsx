import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  variant?: 'danger' | 'info';
}

interface DesktopDialogContextType {
  confirmDialog: (options: DialogOptions) => Promise<boolean>;
}

const DesktopDialogContext = createContext<DesktopDialogContextType | null>(null);

export function DesktopDialogProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    isDanger: false,
  });
  const [resolver, setResolver] = useState<((val: boolean) => void) | null>(null);

  const confirmDialog = useCallback((opts: DialogOptions): Promise<boolean> => {
    setOptions({
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText || 'Confirm',
      cancelText: opts.cancelText || 'Cancel',
      isDanger: opts.isDanger || opts.variant === 'danger',
    });
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolver) resolver(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolver) resolver(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, resolver]);

  return (
    <DesktopDialogContext.Provider value={{ confirmDialog }}>
      {children}
      {isOpen && (
        <div className="desktop-dialog-backdrop" onClick={handleCancel}>
          <div 
            className="desktop-dialog-panel panel" 
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="desktop-dialog-header">
              <div className={`desktop-dialog-icon-box ${options.isDanger ? 'icon-danger' : 'icon-info'}`}>
                {options.isDanger ? <AlertTriangle size={20} /> : <Info size={20} />}
              </div>
              <div className="desktop-dialog-titles">
                <h3>{options.title}</h3>
                <p>{options.message}</p>
              </div>
              <button 
                type="button" 
                className="desktop-dialog-close" 
                onClick={handleCancel}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="desktop-dialog-actions">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={handleCancel}
              >
                {options.cancelText}
              </button>
              <button 
                type="button" 
                className={`btn ${options.isDanger ? 'btn-danger' : 'btn-accent'}`} 
                onClick={handleConfirm}
                autoFocus
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DesktopDialogContext.Provider>
  );
}

export function useDesktopDialog() {
  const ctx = useContext(DesktopDialogContext);
  if (!ctx) {
    throw new Error('useDesktopDialog must be used within a DesktopDialogProvider');
  }
  return ctx;
}
