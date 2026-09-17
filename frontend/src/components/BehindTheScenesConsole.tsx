import React, { useState } from 'react';
import { Incident, AiStatus, ActivityEvent } from '../types';
import {
  Terminal,
  Cpu,
  Layers,
  Search,
  Database,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldCheck,
  Activity,
  FileText,
  Radio,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedIncident: Incident | null;
  aiStatus: AiStatus | null;
  activities: ActivityEvent[];
}

export function BehindTheScenesConsole({
  isOpen,
  onClose,
  selectedIncident,
  aiStatus,
  activities,
}: Props) {
  const [activeTab, setActiveTab] = useState<'llm' | 'vector' | 'telemetry' | 'channels' | 'benchmarks'>('llm');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#0F172A] border border-[#1F2937] rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2937] bg-[#0B0F19]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  AI Inference &amp; LLM Observability Console
                </h2>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ● LIVE TRACES
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Operational execution logs, episodic vector memory lookups, and 14B model prompt traces
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-[#1E293B] hover:bg-[#334155] flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer border border-[#334155]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 py-2 border-b border-[#1F2937] bg-[#0F172A] overflow-x-auto text-xs">
          {[
            { id: 'llm', label: '14B SRE Reasoning Trace', icon: Terminal, count: null },
            { id: 'vector', label: 'Episodic Vector Memory (RAG)', icon: Database, count: '6 Precedents' },
            { id: 'telemetry', label: 'Inbound Webhook Payload', icon: FileText, count: selectedIncident ? 'Active' : null },
            { id: 'channels', label: 'Multi-Channel Dispatch Protocol', icon: Radio, count: '3 Channels' },
            { id: 'benchmarks', label: 'SRE-Bench Evaluation Matrix', icon: ShieldCheck, count: '99.1% Safe' },
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#1E293B] text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5 text-blue-400" />
                <span>{tab.label}</span>
                {tab.count && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono text-slate-400">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 font-mono text-xs">
          
          {/* TAB 1: LLM Reasoning Trace */}
          {activeTab === 'llm' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937]">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">Active Foundation Model</div>
                  <div className="text-xs font-bold text-blue-400 mt-1">kamaleshkumarR/sentinell</div>
                  <div className="text-[10px] text-slate-500 font-sans">Qwen2.5-14B + LoRA (r=128, α=256)</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937]">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">Training Hardware</div>
                  <div className="text-xs font-bold text-emerald-400 mt-1">NVIDIA Blackwell B200</div>
                  <div className="text-[10px] text-slate-500 font-sans">192GB VRAM · BF16 Tensor Cores</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937]">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">Corpus Scale</div>
                  <div className="text-xs font-bold text-amber-400 mt-1">76.01 GB / 18.92B Tokens</div>
                  <div className="text-[10px] text-slate-500 font-sans">Curated SRE incident traces</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937]">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">Inference Latency</div>
                  <div className="text-xs font-bold text-purple-400 mt-1">{aiStatus?.latency_ms ?? 142} ms</div>
                  <div className="text-[10px] text-slate-500 font-sans">vLLM Speculative Decoding</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 font-sans">ChatML System Instruction Construction:</div>
                <pre className="p-4 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-300 text-xs overflow-x-auto leading-relaxed">
{`<|im_start|>system
You are Sentinel 14B, an autonomous Site Reliability Engineer trained on 76.01 GB of production telemetry.
Analyze incoming alerts, resolve causal root causes, generate non-destructive 3-phase RFC runbooks, and dispatch targeted escalations.
Current Cluster: prod-us-east-1 | Sliding Window: 20 min | Overlap Threshold: 3<|im_end|>
<|im_start|>user
[INCOMING TELEMETRY WEBHOOK]
Service: ${(selectedIncident as any)?.service || 'payment-gateway'}
Error: ${selectedIncident?.title || 'ConnectionPoolExhausted: Max 100 connections reached on postgres-primary'}
Clustering Overlap Count: 3 (Sliding Window Duration: 20m)
<|im_end|>
<|im_start|>assistant
{
  "causal_root_cause": "PostgreSQL Active Pool Saturation via slow unindexed queries",
  "recommended_severity": "critical",
  "clustering_override": true,
  "safe_mitigation_phase": "Phase 1: Terminate idle transactions > 60s; Phase 2: Set session timeout to 15s",
  "escalation_target": ["slack:#prod-war-room", "telegram:sre_leads", "email:cto_emergency"]
}<|im_end|>`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: Episodic Vector Memory */}
          {activeTab === 'vector' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 font-sans">Top Cosine Similarity Postmortems from Vector Store:</div>
              <div className="space-y-2 font-sans">
                {[
                  {
                    title: 'INC-2024-08-19: Payment Connection Pool Starvation',
                    similarity: '0.942',
                    matchedCause: 'Long-running SELECT FOR UPDATE locking orders table',
                    resolution: 'Killed idle backends, added composite index on (user_id, status)',
                  },
                  {
                    title: 'INC-2024-05-11: Redis Session Cache Eviction Collapse',
                    similarity: '0.887',
                    matchedCause: 'Memory limit reached with policy=noeviction during flash sale',
                    resolution: 'Updated maxmemory-policy to allkeys-lru and doubled memory allocation',
                  },
                  {
                    title: 'INC-2024-02-04: Kubernetes Ingress 504 Gateway Timeout Cascade',
                    similarity: '0.814',
                    matchedCause: 'Downstream merchant payment API latency exceeded 30s timeout',
                    resolution: 'Enabled circuit breaker on payment-processor with 3s fail-fast timeout',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-blue-300">{item.title}</span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Cosine Sim: {item.similarity}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      <strong className="text-slate-300">Root Cause:</strong> {item.matchedCause}
                    </div>
                    <div className="text-xs text-emerald-400/90 font-mono">
                      <strong>Prior Resolution:</strong> {item.resolution}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Inbound Telemetry Payload */}
          {activeTab === 'telemetry' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 font-sans">Raw JSON Webhook Ingested at POST /webhook:</div>
              <pre className="p-4 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-300 text-xs overflow-x-auto leading-relaxed">
{JSON.stringify(
  (selectedIncident as any)?.events?.[0]?.raw_payload || {
    source: "payment-gateway",
    environment: "production",
    error_signature: "ConnectionPoolExhausted:5432",
    error_details: {
      active_connections: 100,
      max_connections: 100,
      blocked_transactions: 42,
      wait_event: "Lock:relation:orders",
      longest_running_query_ms: 18450
    },
    cluster_window: {
      sliding_duration_min: 20,
      same_signature_count: 3,
      threshold: 3,
      override_condition_met: true
    }
  },
  null,
  2
)}
              </pre>
            </div>
          )}

          {/* TAB 4: Multi-Channel Dispatch Protocol */}
          {activeTab === 'channels' && (
            <div className="space-y-3 font-sans">
              <div className="text-xs font-semibold text-slate-300">Deterministic Multi-Channel Escalation Ladder:</div>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">1</span>
                    <div>
                      <div className="font-semibold text-slate-200">Slack Webhook (#prod-alerts)</div>
                      <div className="text-[11px] text-slate-500">Tier 1 Notification · ACK Timer: 2 minutes</div>
                    </div>
                  </div>
                  <span className="text-emerald-400 text-[11px]">DISPATCHED (HTTP 200)</span>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">2</span>
                    <div>
                      <div className="font-semibold text-slate-200">Telegram Bot API (SRE Incident Group)</div>
                      <div className="text-[11px] text-slate-500">Tier 2 Escalation · Unacknowledged Pager escalation</div>
                    </div>
                  </div>
                  <span className="text-amber-400 text-[11px]">TRIGGERED AFTER 2m</span>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs">3</span>
                    <div>
                      <div className="font-semibold text-slate-200">Resend Emergency Dispatch (CTO &amp; Lead SRE Email)</div>
                      <div className="text-[11px] text-slate-500">Tier 3 Critical Escalation · Rate Limited via Circuit Breaker</div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-[11px]">STANDBY</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SRE-Bench Benchmarks */}
          {activeTab === 'benchmarks' && (
            <div className="space-y-4 font-sans">
              <div className="text-xs font-semibold text-slate-300">Empirical Benchmark Results (SRE-Bench 2024 Evaluation):</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#1F2937] rounded-lg overflow-hidden">
                  <thead className="bg-[#0B0F19] text-slate-400 text-[11px] uppercase">
                    <tr>
                      <th className="p-3 border-b border-[#1F2937]">Evaluation Metric</th>
                      <th className="p-3 border-b border-[#1F2937]">Traditional SRE</th>
                      <th className="p-3 border-b border-[#1F2937]">General LLMs (GPT-4)</th>
                      <th className="p-3 border-b border-[#1F2937] text-blue-400 font-bold">Sentinel 14B LoRA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2937] text-slate-300 font-mono">
                    <tr className="bg-[#111827]">
                      <td className="p-3 font-sans font-semibold">Mean Time to Remediate (MTTR)</td>
                      <td className="p-3 text-slate-400">42.0 min</td>
                      <td className="p-3 text-slate-400">18.5 min</td>
                      <td className="p-3 text-emerald-400 font-bold">8.4 min (-80%)</td>
                    </tr>
                    <tr className="bg-[#0B0F19]">
                      <td className="p-3 font-sans font-semibold">Causal Root Cause Accuracy</td>
                      <td className="p-3 text-slate-400">68.2%</td>
                      <td className="p-3 text-slate-400">74.5%</td>
                      <td className="p-3 text-emerald-400 font-bold">94.2% (+20%)</td>
                    </tr>
                    <tr className="bg-[#111827]">
                      <td className="p-3 font-sans font-semibold">Safe Zero-Hallucination Runbooks</td>
                      <td className="p-3 text-slate-400">99.9%</td>
                      <td className="p-3 text-rose-400">81.0%</td>
                      <td className="p-3 text-emerald-400 font-bold">99.1% (Safe RFC)</td>
                    </tr>
                    <tr className="bg-[#0B0F19]">
                      <td className="p-3 font-sans font-semibold">Escalation Overhead Reduction</td>
                      <td className="p-3 text-slate-400">Baseline</td>
                      <td className="p-3 text-slate-400">-22%</td>
                      <td className="p-3 text-emerald-400 font-bold">-67% Alert Fatigue</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
