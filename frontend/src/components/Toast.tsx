import React, { useState, useEffect } from 'react';
import { Toast as ToastType, ToastType as TType } from '../hooks/useToast';

const ICONS: Record<TType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type} ${exiting ? 'toast-exit' : ''}`}
      style={{ '--toast-duration': `${(toast.duration ?? 4000) / 1000}s` } as React.CSSProperties}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <span
        className="text-base font-bold shrink-0 mt-0.5"
        style={{ lineHeight: 1 }}
        aria-hidden="true"
      >
        {ICONS[toast.type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs">{toast.title}</p>
        {toast.message && (
          <p className="text-xs mt-0.5 opacity-75">{toast.message}</p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1 cursor-pointer"
        style={{ lineHeight: 1, fontSize: 14, background: 'none', border: 'none', color: 'inherit', padding: '2px' }}
      >
        ✕
      </button>

      {/* Progress bar */}
      <div className="toast-progress" />
    </div>
  );
}

interface Props {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
