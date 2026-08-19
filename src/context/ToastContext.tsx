import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl shadow-lg border p-4 animate-slide-in-right ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/80 dark:border-emerald-800'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/80 dark:border-rose-800'
              : toast.type === 'warning'
              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/80 dark:border-amber-800'
              : 'bg-sky-50 border-sky-200 dark:bg-sky-950/80 dark:border-sky-800'
          }`}
        >
          <div className={`mt-0.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-500'
            : toast.type === 'error' ? 'bg-rose-500'
            : toast.type === 'warning' ? 'bg-amber-500'
            : 'bg-sky-500'
          }`} />
          <p className={`text-sm font-medium flex-1 ${
            toast.type === 'success' ? 'text-emerald-800 dark:text-emerald-200'
            : toast.type === 'error' ? 'text-rose-800 dark:text-rose-200'
            : toast.type === 'warning' ? 'text-amber-800 dark:text-amber-200'
            : 'text-sky-800 dark:text-sky-200'
          }`}>{toast.message}</p>
          <button
            onClick={() => onDismiss(toast.id)}
            className={`flex-shrink-0 ${
              toast.type === 'success' ? 'text-emerald-400 hover:text-emerald-600'
              : toast.type === 'error' ? 'text-rose-400 hover:text-rose-600'
              : toast.type === 'warning' ? 'text-amber-400 hover:text-amber-600'
              : 'text-sky-400 hover:text-sky-600'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
