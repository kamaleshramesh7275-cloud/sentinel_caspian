import React, { useState } from 'react';
import { Cpu, X, Server, Database, Zap, Terminal, CheckCircle2, ShieldAlert, Sparkles, Layers, Activity } from 'lucide-react';
import { AiStatus } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  aiStatus: AiStatus | null;
}

export function ModelArchitectureModal({ isOpen, onClose, aiStatus }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'training' | 'telemetry'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-xl bg-[#0F172A] border border-[#1F2937] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2937] bg-[#0B0F19]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                14B SRE Foundation Model Architecture &amp; Telemetry
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ONLINE · B200 192GB
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Fine-tuned LoRA weights for Autonomous Incident Triage, Causal Graphing, and Code Remediation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white bg-[#1E293B] hover:bg-[#334155] transition border border-[#334155]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#111827] border-b border-[#1F2937] text-xs font-mono">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3 py-1 rounded-md transition cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Hardware &amp; Weights
          </button>
          <button
            onClick={() => setActiveSubTab('training')}
            className={`px-3 py-1 rounded-md transition cursor-pointer ${
              activeSubTab === 'training'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Training Corpus (18.9B Tokens)
          </button>
          <button
            onClick={() => setActiveSubTab('telemetry')}
            className={`px-3 py-1 rounded-md transition cursor-pointer ${
              activeSubTab === 'telemetry'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Live Prompt &amp; JSON Telemetry
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto font-sans text-xs">
          
          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              {/* Architecture Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F2937] space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Base Architecture</span>
                  <div className="text-xs font-bold text-white truncate">Qwen2.5-14B-Instruct</div>
                </div>
                <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F2937] space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">LoRA Adapter</span>
                  <div className="text-xs font-bold text-blue-400 truncate">kamaleshkumarR/sentinell</div>
                </div>
                <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F2937] space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Compute Cluster</span>
                  <div className="text-xs font-bold text-emerald-400 truncate">NVIDIA Blackwell B200</div>
                </div>
                <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F2937] space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">VRAM Allocation</span>
                  <div className="text-xs font-bold text-purple-400 truncate">192 GB HBM3e</div>
                </div>
              </div>

              {/* How it works explanation */}
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2937] space-y-2 text-slate-300 leading-relaxed">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  How the 14B SRE Autonomous Engine Operates:
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong>Deterministic Low-Latency Ingestion:</strong> Normalizes high-frequency telemetry from Sentry, Datadog, and CI/CD pipelines in &lt;50ms.
                  </li>
                  <li>
                    <strong>Clustering &amp; Sliding Window Override:</strong> Detects repetitive failure signatures within a 20-minute window and automatically escalates severity without human delay.
                  </li>
                  <li>
                    <strong>Vector Episodic Memory (RAG):</strong> Embeds and queries historical postmortems to match root cause patterns and known runbook solutions.
                  </li>
                  <li>
                    <strong>Zero-Shot Code Synthesis &amp; Pytest Verification:</strong> Generates unified git diffs with defensive context managers, writes them to the local codebase, and validates them instantly with real pytest unit tests.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeSubTab === 'training' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F2937] text-center">
                  <span className="text-slate-400 text-[10px]">Corpus Volume</span>
                  <div className="text-base font-bold text-white mt-1">76.01 GB</div>
                </div>
                <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F2937] text-center">
                  <span className="text-slate-400 text-[10px]">Tokens Processed</span>
                  <div className="text-base font-bold text-blue-400 mt-1">18.925 Billion</div>
                </div>
                <div className="p-3 rounded-lg bg-[#161F30] border border-[#1F2937] text-center">
                  <span className="text-slate-400 text-[10px]">LoRA Rank / Alpha</span>
                  <div className="text-base font-bold text-emerald-400 mt-1">r=64 / α=128</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2937] space-y-2">
                <h4 className="font-bold text-white">Fine-Tuning Dataset Distribution:</h4>
                <div className="space-y-2 text-[11px] font-mono">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Production Postmortems &amp; RCA Graphs (5.2B tokens)</span>
                      <span>42%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-blue-500 w-[42%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>RFC Remediation Runbooks &amp; Script Pairs (4.8B tokens)</span>
                      <span>35%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[35%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Kubernetes Chaos Mesh CRDs &amp; Locust Load Scripts (2.8B tokens)</span>
                      <span>23%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-purple-500 w-[23%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'telemetry' && (
            <div className="space-y-3 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>System Prompt &amp; JSON Schema Enforcement:</span>
                <span className="text-emerald-400">Pydantic Validated · Temp 0.1</span>
              </div>
              <pre className="p-3.5 rounded-lg bg-black border border-[#1F2937] text-slate-300 overflow-x-auto leading-relaxed max-h-64 overflow-y-auto">
{`{
  "system_prompt": "You are Sentinel 14B SRE Incident Commander. Analyze telemetry, detect clustering overrides, generate causal RCA DAGs, and synthesize unified git diffs.",
  "response_format": { "type": "json_object" },
  "example_output": {
    "severity": "critical",
    "override_triggered": true,
    "root_cause": "Unreleased database raw sockets in services/payment_gateway.py",
    "git_diff": "--- a/services/payment_gateway.py\\n+++ b/services/payment_gateway.py\\n@@ -78,4 +78,8 @@\\n+    finally:\\n+        await db_pool.release_socket(conn)",
    "sandbox_confidence": 0.985
  }
}`}
              </pre>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1F2937] bg-[#0B0F19] flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Hugging Face Space: sentinel-sre-demo</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-sans font-medium transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
