import React from 'react';
import { AiStatus } from '../types';

interface Props {
  channels: string[];
  wsConnected: boolean;
  lastRefresh: Date;
  aiStatus: AiStatus | null;
  onOpenInspector: () => void;
  onOpenTriggerIncident: () => void;
  activeTab: 'incidents' | 'liveops';
  onTabChange: (tab: 'incidents' | 'liveops') => void;
  activityCount?: number;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export function Header({
  channels,
  wsConnected,
  lastRefresh,
  aiStatus,
  onOpenInspector,
  onOpenTriggerIncident,
  activeTab,
  onTabChange,
  activityCount,
}: Props) {
  return (
    <header className="relative flex items-center justify-between px-6 py-3 border-b border-[#1E2738] bg-[#111622] text-[#F1F5F9] z-20">
      {/* Left: Brand & Navigation */}
      <div className="flex items-center gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-sm text-blue-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-white">
                SENTINEL
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                SRE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">
              Autonomous Incident Response Platform
            </p>
          </div>
        </div>

        {/* View Switcher: Incident Board vs Live Ops Feed */}
        <div className="flex items-center p-1 rounded-lg bg-[#0B0E14] border border-[#1E2738]">
          <button
            id="tab-incident-board"
            onClick={() => onTabChange('incidents')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'incidents'
                ? 'bg-[#1E2738] text-white shadow-sm border border-slate-600/50'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9 3 3-3 3" />
            </svg>
            <span>Incident Queue</span>
          </button>
          <button
            id="tab-live-ops"
            onClick={() => onTabChange('liveops')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'liveops'
                ? 'bg-[#1E2738] text-white shadow-sm border border-slate-600/50'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
              <circle cx="12" cy="12" r="2" />
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
              <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
            </svg>
            <span>Live Ops Stream</span>
            {activityCount !== undefined && activityCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {activityCount}
              </span>
            )}
          </button>
        </div>

        {/* Channel connectivity pills */}
        {channels.length > 0 && (
          <div className="hidden xl:flex items-center gap-2">
            {channels.map((ch) => (
              <span
                key={ch}
                className="text-[11px] px-2.5 py-0.5 rounded-md bg-[#161C2A] border border-[#1E2738] text-slate-300 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="capitalize">{ch}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: Controls & Status */}
      <div className="flex items-center gap-3">
        {/* Declare Incident Button */}
        <button
          id="open-trigger-incident-btn"
          onClick={onOpenTriggerIncident}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all cursor-pointer bg-red-600 hover:bg-red-500 text-white shadow-sm border border-red-500/40"
          title="Declare / Trigger Incident"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Declare Incident</span>
        </button>

        {/* AI Model Telemetry Button */}
        <button
          id="ai-inspector-btn"
          onClick={onOpenInspector}
          className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-md transition-all cursor-pointer bg-[#161C2A] hover:bg-[#1C2436] text-slate-300 border border-[#283347] shadow-sm"
          title="Open AI Model Inspector"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          <span className="text-white font-medium">
            {aiStatus?.model ? aiStatus.model.replace('models/', '') : 'Gemini Flash'}
          </span>
          {aiStatus && (
            <span className="text-emerald-400 text-[11px] font-mono">
              {aiStatus.latency_ms}ms
            </span>
          )}
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">
            Inspect ↗
          </span>
        </button>

        {/* WS Status Indicator */}
        <span
          className={`text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium border ${
            wsConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
          />
          <span>{wsConnected ? 'Connected' : 'Polling'}</span>
        </span>

        {/* Last refresh */}
        <span className="hidden lg:inline text-[11px] text-slate-400 font-mono">
          {formatTime(lastRefresh)}
        </span>
      </div>
    </header>
  );
}
