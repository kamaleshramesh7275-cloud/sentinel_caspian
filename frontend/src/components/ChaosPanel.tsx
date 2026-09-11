import React, { useState } from 'react';
import { triggerChaos } from '../api';
import { ChaosResponse } from '../types';

interface Props {
  onChaosSuccess: (result: ChaosResponse) => void;
  onError: (title: string, msg?: string) => void;
}

type ArmState = 'idle' | 'armed' | 'firing';

export function ChaosPanel({ onChaosSuccess, onError }: Props) {
  const [armState, setArmState] = useState<ArmState>('idle');
  const [result, setResult] = useState<ChaosResponse | null>(null);
  let armTimer: ReturnType<typeof setTimeout>;

  const handleArm = () => {
    setArmState('armed');
    setResult(null);
    armTimer = setTimeout(() => setArmState('idle'), 6000);
  };

  const handleFire = async () => {
    clearTimeout(armTimer);
    setArmState('firing');
    try {
      const resp = await triggerChaos();
      setResult(resp);
      onChaosSuccess(resp);
      setArmState('idle');
    } catch (e: any) {
      onError('Drill execution failed', e.message);
      setArmState('idle');
    }
  };

  const handleCancel = () => {
    clearTimeout(armTimer);
    setArmState('idle');
  };

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 ${
      armState === 'armed'
        ? 'bg-[#181216] border-red-500/50 shadow-md'
        : 'bg-[#111622] border-[#1E2738]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            Resilience &amp; Fault Injection Drill
          </h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          Simulation
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed mb-4">
        Inject a synthetic 3-event burst with correlated error signatures to test Sentinel's automated clustering, severity override, and multi-channel notification tree.
      </p>

      {/* Action controls */}
      {armState === 'idle' && (
        <button
          id="chaos-arm-btn"
          onClick={handleArm}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium bg-[#1A2234] hover:bg-[#222C42] text-slate-200 border border-[#2A3650] transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M12 2v4" />
            <path d="m4.93 4.93 2.83 2.83" />
            <path d="M2 12h4" />
            <path d="m4.93 19.07 2.83-2.83" />
            <path d="M12 22v-4" />
            <path d="m19.07 19.07-2.83-2.83" />
            <path d="M22 12h-4" />
            <path d="m19.07 4.93-2.83 2.83" />
          </svg>
          <span>Arm Fault Simulation</span>
        </button>
      )}

      {armState === 'armed' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-red-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              Confirmation required to execute drill
            </span>
          </div>
          <div className="flex gap-2">
            <button
              id="chaos-fire-btn"
              onClick={handleFire}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer shadow-sm"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Execute Outage Drill</span>
            </button>
            <button
              onClick={handleCancel}
              className="py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-[#161C2A] border border-[#283347] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {armState === 'firing' && (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/40 cursor-wait"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
          <span>Injecting telemetry events…</span>
        </button>
      )}

      {/* Execution outcome report */}
      {result && (
        <div className="mt-3 p-3 rounded-lg bg-[#0E131E] border border-red-500/30 text-xs space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-red-400">
              {result.events_fired} Events Injected
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/30">
              {result.severity}
            </span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {result.message}
          </p>
          {result.agent_reasoning && (
            <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span className="text-purple-300 font-medium">Triage Synthesis: </span>
              {result.agent_reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
