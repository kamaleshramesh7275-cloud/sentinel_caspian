import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Props {
  label: string;
  value: number | string;
  sub?: string;
  glow?: string;
  animateTo?: number;
  statusVariant?: 'default' | 'warning' | 'danger' | 'success';
}

function useCountUp(target: number, duration = 400) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const startVal = useRef(0);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    const from = startVal.current;

    const step = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        startVal.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return display;
}

export function StatCard({ label, value, sub, statusVariant = 'default', animateTo }: Props) {
  const numeric = typeof animateTo === 'number' ? animateTo : (typeof value === 'number' ? value : null);
  const animated = useCountUp(numeric ?? 0);
  const displayValue = numeric !== null ? animated : value;

  const hasAlert = numeric !== null && numeric > 0;
  const isCritical = label.toLowerCase().includes('critical') && hasAlert;
  const isHigh = (label.toLowerCase().includes('high') || label.toLowerCase().includes('active')) && hasAlert;
  const isResolved = label.toLowerCase().includes('resolved') || statusVariant === 'success';

  return (
    <div
      className={`p-3.5 rounded-lg border transition-all ${
        isCritical
          ? 'bg-[#181119] border-red-900/40 text-red-100'
          : isHigh
          ? 'bg-[#181510] border-amber-900/40 text-amber-100'
          : 'bg-[#111827] border-[#1F2937] text-slate-100 hover:border-[#374151]'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        {isCritical && (
          <ShieldAlert className="w-4 h-4 text-red-400" />
        )}
        {isHigh && !isCritical && (
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        )}
        {isResolved && (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold font-mono tracking-tight ${
          isCritical ? 'text-red-400' : isHigh ? 'text-amber-400' : isResolved ? 'text-emerald-400' : 'text-white'
        }`}>
          {displayValue}
        </p>
      </div>

      {sub && (
        <p className="text-[11px] mt-1 text-slate-400 font-normal">
          {sub}
        </p>
      )}
    </div>
  );
}
