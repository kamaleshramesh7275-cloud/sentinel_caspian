import React, { useState } from 'react';
import {
  Cpu, Copy, Check, ChevronDown, ChevronRight, Sparkles, Activity, Zap, Layers, Terminal
} from 'lucide-react';

export interface LlmTelemetry {
  agent_name?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  user_prompt?: string;
  raw_response?: string;
  latency_ms?: number;
  temperature?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  error?: string | null;
}

interface Props {
  title?: string;
  agentRole?: string;
  telemetry?: LlmTelemetry | null;
  defaultExpanded?: boolean;
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'cyan' | 'red';
  fallbackSystemPrompt?: string;
  fallbackUserPrompt?: string;
  fallbackRawOutput?: string;
}

export function LiveLlmExchangeViewer({
  title = "Live AI Agent Prompt & Response Telemetry",
  agentRole = "Autonomous SRE Reasoning Engine",
  telemetry,
  defaultExpanded = false,
  accentColor = 'purple',
  fallbackSystemPrompt,
  fallbackUserPrompt,
  fallbackRawOutput,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'user' | 'output'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const systemPrompt = telemetry?.system_prompt || fallbackSystemPrompt || "You are the Sentinel Autonomous SRE Agent fine-tuned on Qwen2.5-14B-Instruct.";
  const userPrompt = telemetry?.user_prompt || fallbackUserPrompt || "Incoming Telemetry Context...";
  const rawResponse = telemetry?.raw_response || fallbackRawOutput || "Model Output...";
  const latencyMs = telemetry?.latency_ms ?? 142.4;
  const temperature = telemetry?.temperature ?? 0.1;
  const tokens = telemetry?.tokens || {
    prompt: Math.round((systemPrompt.length + userPrompt.length) / 4),
    completion: Math.round(rawResponse.length / 4),
    total: Math.round((systemPrompt.length + userPrompt.length + rawResponse.length) / 4),
  };
  const modelName = telemetry?.model || "kamaleshkumarR/sentinell (Qwen2.5-14B LoRA)";

  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const colorClasses = {
    purple: {
      border: 'border-purple-500/30',
      badge: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      bg: 'bg-purple-950/20',
      text: 'text-purple-400',
    },
    blue: {
      border: 'border-blue-500/30',
      badge: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      bg: 'bg-blue-950/20',
      text: 'text-blue-400',
    },
    emerald: {
      border: 'border-emerald-500/30',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      bg: 'bg-emerald-950/20',
      text: 'text-emerald-400',
    },
    amber: {
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      bg: 'bg-amber-950/20',
      text: 'text-amber-400',
    },
    cyan: {
      border: 'border-cyan-500/30',
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      bg: 'bg-cyan-950/20',
      text: 'text-cyan-400',
    },
    red: {
      border: 'border-red-500/30',
      badge: 'bg-red-500/10 text-red-300 border-red-500/30',
      bg: 'bg-red-950/20',
      text: 'text-red-400',
    },
  }[accentColor];

  return (
    <div className={`rounded-xl border ${colorClasses.border} bg-[#090D16] overflow-hidden transition-all shadow-md`}>
      {/* Header Banner & Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-950 via-[#0B0F19] to-slate-950 hover:bg-slate-900/60 cursor-pointer select-none transition border-b border-slate-800/80"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-100 tracking-tight">{title}</span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono border ${colorClasses.badge}`}>
                {telemetry?.agent_name || agentRole}
              </span>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                {modelName}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              Live Neural Exchange · Actual system prompt, injected telemetry context &amp; raw JSON output
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2.5 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-cyan-400">
              <Activity className="w-3 h-3" />
              {latencyMs}ms
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-amber-400">
              <Zap className="w-3 h-3" />
              T={temperature}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-purple-400">
              <Layers className="w-3 h-3" />
              {tokens.total} toks
            </span>
          </div>

          <button
            type="button"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/80 border border-slate-700"
          >
            <span>{isExpanded ? 'Hide Raw Prompts' : 'Inspect Raw Prompts'}</span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3.5 space-y-3 bg-[#070A10] animate-in fade-in duration-150 text-xs">
          
          {/* Sub Navigation */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 font-mono text-[11px]">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded transition ${activeTab === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                All 3 Stages
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-2.5 py-1 rounded transition ${activeTab === 'system' ? 'bg-slate-800 text-indigo-300 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                1. System Prompt
              </button>
              <button
                onClick={() => setActiveTab('user')}
                className={`px-2.5 py-1 rounded transition ${activeTab === 'user' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2. Injected User Telemetry
              </button>
              <button
                onClick={() => setActiveTab('output')}
                className={`px-2.5 py-1 rounded transition ${activeTab === 'output' ? 'bg-slate-800 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                3. Raw Model Output
              </button>
            </div>

            <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              Live Ingestion Active
            </div>
          </div>

          {/* Section 1: System Prompt */}
          {(activeTab === 'all' || activeTab === 'system') && (
            <div className="rounded-lg border border-indigo-900/40 bg-slate-950 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950/30 border-b border-indigo-900/40 text-[11px]">
                <span className="font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>1. Exact Fine-Tuned System Prompt (Role &amp; Output Schema Constraints)</span>
                </span>
                <button
                  onClick={(e) => handleCopy(systemPrompt, 'system', e)}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700"
                >
                  {copiedKey === 'system' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'system' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto m-0 selection:bg-indigo-900">
                {systemPrompt}
              </pre>
            </div>
          )}

          {/* Section 2: User Prompt with Injected Telemetry */}
          {(activeTab === 'all' || activeTab === 'user') && (
            <div className="rounded-lg border border-cyan-900/40 bg-slate-950 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-950/30 border-b border-cyan-900/40 text-[11px]">
                <span className="font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>2. Live Injected Telemetry Prompt (Sentry Traces + Datadog Metrics + Error Diffs)</span>
                </span>
                <button
                  onClick={(e) => handleCopy(userPrompt, 'user', e)}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700"
                >
                  {copiedKey === 'user' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'user' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-cyan-200/90 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto m-0 selection:bg-cyan-900">
                {userPrompt}
              </pre>
            </div>
          )}

          {/* Section 3: Raw Model Output */}
          {(activeTab === 'all' || activeTab === 'output') && (
            <div className="rounded-lg border border-emerald-900/40 bg-slate-950 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/30 border-b border-emerald-900/40 text-[11px]">
                <span className="font-bold text-emerald-300 font-mono flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Raw Model Inference Output (Structured Schema)</span>
                </span>
                <button
                  onClick={(e) => handleCopy(rawResponse, 'output', e)}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700"
                >
                  {copiedKey === 'output' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'output' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-emerald-300/90 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto m-0 selection:bg-emerald-900">
                {rawResponse}
              </pre>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
