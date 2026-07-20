import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastInput = Omit<Toast, 'id'>;

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const toastId = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((currentToasts) => [...currentToasts, { ...toast, id: toastId }].slice(-4));
      window.setTimeout(() => dismissToast(toastId), toast.type === 'error' ? 6200 : 4200);
    },
    [dismissToast],
  );

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div>
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}
