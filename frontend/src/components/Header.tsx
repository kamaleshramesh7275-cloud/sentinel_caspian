import React from 'react';
import { AiStatus } from '../types';
import {
  ShieldCheck,
  Radio,
  Activity,
  Sliders,
  Plus,
  Terminal,
  ExternalLink,
  Cpu,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { VoiceBriefingButton } from './VoiceBriefingButton';

interface Props {
  channels: string[];
  wsConnected: boolean;
  lastRefresh: Date;
  aiStatus: AiStatus | null;
  onOpenInspector: () => void;
  onOpenBehindTheScenes: () => void;
  onOpenTriggerIncident: () => void;
  onOpenModelArch?: () => void;
  onOpenLlmInspector?: () => void;
  activeTab: 'mission_control' | 'agents_hub' | 'incidents' | 'liveops';
  onTabChange: (tab: 'mission_control' | 'agents_hub' | 'incidents' | 'liveops') => void;
  activityCount?: number;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function Header({
  channels,
  wsConnected,
  lastRefresh,
  aiStatus,
  onOpenInspector,
  onOpenBehindTheScenes,
  onOpenTriggerIncident,
  onOpenModelArch,
  onOpenLlmInspector,
  activeTab,
  onTabChange,
  activityCount,
}: Props) {
  return (
    <header className="flex flex-col border-b border-[#1F2937] bg-[#0F172A] text-slate-100 z-20 shrink-0">
      
      {/* ── Sub-header: Cluster Metadata & Model Specifications ────────────── */}
      <div className="flex flex-wrap items-center justify-between px-6 py-1.5 bg-[#0B0F19] border-b border-[#1E293B] text-[11px] text-slate-400 gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Environment Pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>PROD · us-east-1</span>
          </div>

          <span className="text-slate-700">|</span>

          {/* Model Specification (Clickable) */}
          <button
            onClick={onOpenModelArch}
            className="flex items-center gap-1.5 text-slate-300 hover:text-blue-300 hover:bg-blue-950/40 px-2 py-0.5 rounded border border-transparent hover:border-blue-500/40 transition cursor-pointer font-mono text-[11px]"
            title="Inspect 14B Model Architecture & Training Corpus"
          >
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold text-white">Qwen2.5-14B LoRA</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">NVIDIA B200 (192GB)</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">76.01 GB Corpus</span>
            <span className="text-[10px] text-blue-400 underline ml-1">View Specs ↗</span>
          </button>

          <span className="text-slate-700">|</span>

          {/* Prompt & Output Inspector Button */}
          <button
            id="open-llm-prompts-btn"
            onClick={onOpenLlmInspector}
            className="flex items-center gap-1.5 text-slate-200 bg-slate-800/90 hover:bg-slate-750 hover:text-white px-2.5 py-0.5 rounded border border-slate-700 hover:border-slate-500 transition cursor-pointer font-mono text-[11px] font-medium shadow-sm"
            title="View Live LLM System Prompts, Telemetry Context Injections, and Raw JSON Model Outputs"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-slate-100">LLM Prompts &amp; Telemetry</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              5 Agents
            </span>
          </button>

          <span className="text-slate-700">|</span>

          {/* SRE Bench Badge */}
          <div className="flex items-center gap-1 text-slate-300 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>SRE-Bench 99.1% Safe Fix Rate</span>
          </div>
        </div>

        {/* Actions & Voice Commander */}
        <div className="flex items-center gap-3">
          <VoiceBriefingButton />
          
          <span className="text-slate-700">|</span>

          <a
            href="https://huggingface.co/kamaleshkumarR/sentinell"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors font-mono text-[11px]"
          >
            <span>Model Weights</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-700">|</span>
          <a
            href="https://huggingface.co/spaces/kamaleshkumarR/sentinel-sre-demo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors font-mono text-[11px]"
          >
            <span>Cloud Instance</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Main Navigation Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#0F172A]">
        {/* Left: Brand + View Switcher */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">
                  SENTINEL
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  SRE 14B
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                Autonomous Incident Commander &amp; Causal Reasoning Engine
              </p>
            </div>
          </div>

          {/* Segmented View Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
            <button
              id="tab-mission-control"
              onClick={() => onTabChange('mission_control')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                activeTab === 'mission_control'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>SRE Mission Control</span>
            </button>

            <button
              id="tab-agents-hub"
              onClick={() => onTabChange('agents_hub')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                activeTab === 'agents_hub'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Agents Hub</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                4 Subpages
              </span>
            </button>

            <button
              id="tab-incident-board"
              onClick={() => onTabChange('incidents')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === 'incidents'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Incident Queue</span>
            </button>

            <button
              id="tab-live-ops"
              onClick={() => onTabChange('liveops')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === 'liveops'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Ops</span>
              {activityCount !== undefined && activityCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200">
                  {activityCount}
                </span>
              )}
            </button>
          </div>

          {/* Active Channels */}
          {channels.length > 0 && (
            <div className="hidden xl:flex items-center gap-1.5">
              {channels.map((ch) => (
                <span
                  key={ch}
                  className="text-[11px] px-2 py-0.5 rounded bg-[#162032] border border-[#1F2937] text-slate-300 flex items-center gap-1 font-mono capitalize"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{ch}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions & Telemetry Controls */}
        <div className="flex items-center gap-2.5">
          {/* AI Observability Console */}
          <button
            id="behind-the-scenes-btn"
            onClick={onOpenBehindTheScenes}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition cursor-pointer bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600"
            title="Open AI Inference & Observability Workbench"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>AI Observability</span>
          </button>

          {/* Declare Incident Button */}
          <button
            id="open-trigger-incident-btn"
            onClick={onOpenTriggerIncident}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition cursor-pointer bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-sm"
            title="Declare / Trigger Incident"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Declare Incident</span>
          </button>

          {/* AI Inspector Button */}
          <button
            id="ai-inspector-btn"
            onClick={onOpenInspector}
            className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition cursor-pointer bg-[#162032] hover:bg-[#1E293B] text-slate-300 border border-[#1F2937]"
            title="Open AI Model Inspector"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">Inference Latency</span>
            {aiStatus && (
              <span className="text-emerald-400 text-[11px] font-mono">
                {aiStatus.latency_ms}ms
              </span>
            )}
          </button>

          {/* Connection Status */}
          <div
            className={`text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium border font-mono ${
              wsConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
            <span>{wsConnected ? 'Connected' : 'Polling'}</span>
          </div>

          {/* Timestamp */}
          <span className="hidden lg:inline text-[11px] text-slate-400 font-mono">
            {formatTime(lastRefresh)}
          </span>
        </div>
      </div>
    </header>
  );
}
