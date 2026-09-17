import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

interface Props {
  title?: string;
  subtitle?: string;
  filter?: string;
}

export function EmptyState({ title, subtitle, filter }: Props) {
  const displayTitle = title ?? (filter ? `No ${filter.toUpperCase()} incidents` : 'System Nominal');
  const displaySub = subtitle ?? (filter ? `No incidents matching the "${filter}" filter state.` : 'All monitored services are operating within normal SLA thresholds.');

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center animate-fadeIn">
      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
        <ShieldCheck className="w-5 h-5" />
      </div>

      <p className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
        {displayTitle}
      </p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-sans">
        {displaySub}
      </p>
    </div>
  );
}
