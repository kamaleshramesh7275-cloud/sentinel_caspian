import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

let counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const id = `toast-${++counter}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
      setTimeout(() => dismiss(id), duration + 300); // +300 for exit animation
      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string) => toast('success', title, message),
    [toast]
  );
  const error = useCallback(
    (title: string, message?: string) => toast('error', title, message),
    [toast]
  );
  const info = useCallback(
    (title: string, message?: string) => toast('info', title, message),
    [toast]
  );
  const warning = useCallback(
    (title: string, message?: string) => toast('warning', title, message),
    [toast]
  );

  return { toasts, dismiss, toast, success, error, info, warning };
}
