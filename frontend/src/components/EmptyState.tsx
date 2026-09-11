import React from 'react';

interface Props {
  title?: string;
  subtitle?: string;
  filter?: string;
}

export function EmptyState({ title, subtitle, filter }: Props) {
  const displayTitle = title ?? (filter ? `No ${filter.toUpperCase()} incidents` : 'System Nominal');
  const displaySub = subtitle ?? (filter ? `No incidents matching the "${filter}" filter state.` : 'All monitored services are operating within normal SLA thresholds.');

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-fadeIn">
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <p className="font-semibold text-sm text-slate-200">
        {displayTitle}
      </p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
        {displaySub}
      </p>
    </div>
  );
}
