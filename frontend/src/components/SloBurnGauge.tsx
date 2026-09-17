import React from 'react';
import { ShieldCheck, AlertTriangle, Flame, Clock, TrendingDown, CheckCircle2 } from 'lucide-react';

interface Props {
  targetSlo?: number; // e.g. 99.99
  currentSlo?: number; // e.g. 98.42
  errorBudgetMinutes?: number; // e.g. 14.2
  burnRateMultiplier?: number; // e.g. 14.4
  isPatched?: boolean;
}

export function SloBurnGauge({
  targetSlo = 99.99,
  currentSlo: initialCurrentSlo = 98.42,
  errorBudgetMinutes = 14.2,
  burnRateMultiplier: initialBurnRate = 14.4,
  isPatched = false,
}: Props) {
  const currentSlo = isPatched ? 99.98 : initialCurrentSlo;
  const burnRateMultiplier = isPatched ? 0.05 : initialBurnRate;
  const isBreaching = currentSlo < targetSlo;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 rounded-xl bg-[#0F172A] border border-[#1F2937] text-xs font-mono">
      {/* Target vs Actual SLO */}
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg border ${
          isPatched
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
        }`}>
          {isPatched ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px] uppercase font-bold">SLO Availability</span>
            <span className="text-[10px] text-slate-500">(30-Day Window)</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-sm font-bold ${isPatched ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentSlo.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-500">Target: {targetSlo}%</span>
          </div>
        </div>
      </div>

      {/* Error Budget Progress Bar */}
      <div className="hidden sm:flex flex-col gap-1 min-w-[140px] flex-1 max-w-[200px]">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">Error Budget:</span>
          <span className={isPatched ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {isPatched ? '43.2 min left' : `${errorBudgetMinutes} min left`}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isPatched ? 'w-[92%] bg-emerald-500' : 'w-[28%] bg-amber-500'
            }`}
          />
        </div>
      </div>

      {/* Burn Rate Velocity Alert */}
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-[10px] text-slate-400">Burn Velocity:</div>
          <div className={`text-xs font-bold ${
            burnRateMultiplier > 5 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
          }`}>
            {burnRateMultiplier.toFixed(1)}x {burnRateMultiplier > 5 ? '(P0 Critical)' : '(Normal)'}
          </div>
        </div>
        <div className={`p-1.5 rounded-lg border ${
          burnRateMultiplier > 5
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        }`}>
          <Flame className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
