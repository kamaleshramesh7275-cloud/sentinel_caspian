import React, { useState, useEffect } from 'react';
import { Toast as ToastType } from '../hooks/useToast';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

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

  const configMap = {
    success: { bg: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200', icon: CheckCircle2, iconColor: 'text-emerald-400' },
    error: { bg: 'bg-red-950/90 border-red-500/30 text-red-200', icon: AlertOctagon, iconColor: 'text-red-400' },
    warning: { bg: 'bg-amber-950/90 border-amber-500/30 text-amber-200', icon: AlertTriangle, iconColor: 'text-amber-400' },
    info: { bg: 'bg-blue-950/90 border-blue-500/30 text-blue-200', icon: Info, iconColor: 'text-blue-400' },
  };

  const curr = configMap[toast.type] || configMap.info;
  const IconComponent = curr.icon;

  return (
    <div
      className={`flex items-start gap-2.5 p-3 rounded-lg border shadow-xl backdrop-blur-md transition-all ${curr.bg} ${exiting ? 'opacity-0 translate-y-2' : 'opacity-100'}`}
      role="alert"
    >
      <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${curr.iconColor}`} />

      <div className="flex-1 min-w-0 font-sans">
        <p className="font-semibold text-xs text-white">{toast.title}</p>
        {toast.message && (
          <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>
        )}
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition cursor-pointer p-0.5"
      >
        <X className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
      </button>
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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
