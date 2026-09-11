import React, { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  value: number | string;
  sub?: string;
  glow?: string;
  /** Numeric target to animate counter to. If value is not numeric, no animation. */
  animateTo?: number;
  statusVariant?: 'default' | 'warning' | 'danger' | 'success';
}

function useCountUp(target: number, duration = 600) {
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
      // Ease out cubic
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

  // Variant indicator
  const hasAlert = numeric !== null && numeric > 0;
  const isDanger = label.toLowerCase().includes('critical') && hasAlert;
  const isWarning = label.toLowerCase().includes('active') && hasAlert;

  return (
    <div className={`p-4 rounded-xl border transition-all duration-150 ${
      isDanger
        ? 'bg-[#18151D] border-red-900/40 hover:border-red-700/50'
        : isWarning
        ? 'bg-[#18181A] border-amber-900/30 hover:border-amber-700/40'
        : 'bg-[#111622] border-[#1E2738] hover:border-[#2C384F]'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        {isDanger && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
        {isWarning && !isDanger && (
          <span className="w-2 h-2 rounded-full bg-amber-500" />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold tracking-tight ${
          isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'
        }`}>
          {displayValue}
        </p>
      </div>

      {sub && (
        <p className="text-xs mt-1 text-slate-500 font-normal">
          {sub}
        </p>
      )}
    </div>
  );
}
