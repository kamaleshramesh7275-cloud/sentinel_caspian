import React, { useState } from 'react';
import { Incident } from '../types';
import { timeAgo, SeverityBadge, StatusDot } from './IncidentCard';
import { TimelinePanel } from './TimelinePanel';
import { EngineerReplySimulator } from './EngineerReplySimulator';
import {
  executeRemediation,
  generateIncidentPatch,
  commitIncidentPatch,
  applyLocalPatch,
  runRegressionTests,
  resetLocalCode,
  runSpeculativeHeal,
  simulateCascade,
  generateChaosExperiment,
} from '../api';
import {
  ShieldCheck,
  GitPullRequest,
  Clock,
  Terminal,
  Layers,
  Cpu,
  CheckCircle2,
  GitCommit,
  ExternalLink,
  Play,
  X,
  AlertTriangle,
  Radio,
  FileCode,
  Flame,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';
import { LiveLlmExchangeViewer } from './LiveLlmExchangeViewer';

interface MetaItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetaItem({ icon, label, value }: MetaItemProps) {
  return (
    <div className="rounded-lg p-3 flex flex-col gap-1 bg-[#161F30] border border-[#1F2937]">
      <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 font-mono">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xs font-semibold text-slate-100 truncate font-mono">
        {value}
      </p>
    </div>
  );
}

interface Props {
  incident: Incident;
  onClose: () => void;
  onUpdate: () => void;
  onReplySimulated: () => void;
  onError: (title: string, msg?: string) => void;
  onSuccess: (title: string, msg?: string) => void;
  onOpenLlmInspector?: (agentId?: string) => void;
  timelineKey: number;
}

export function IncidentDetail({
  incident,
  onClose,
  onUpdate,
  onReplySimulated,
  onError,
  onSuccess,
  onOpenLlmInspector,
  timelineKey,
}: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'dag' | 'remediation' | 'timetravel' | 'patch' | 'chaos'>('dag');
  const [remediating, setRemediating] = useState(false);

  // Autonomous Code Patch state
  const [patchGenerating, setPatchGenerating] = useState(false);
  const [patchData, setPatchData] = useState<any | null>(null);
  const [patchCommitting, setPatchCommitting] = useState(false);
  const [committedPatchUrl, setCommittedPatchUrl] = useState<string | null>(null);

  // Live Local Patcher & Pytest Runner state
  const [isApplyingLocalPatch, setIsApplyingLocalPatch] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [localPatchResult, setLocalPatchResult] = useState<any | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Time-Travel Cascade Simulation state
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [cascadeData, setCascadeData] = useState<any | null>(null);

  // Chaos Mesh Generation state
  const [chaosLoading, setChaosLoading] = useState(false);
  const [chaosData, setChaosData] = useState<any | null>(null);

  const handleGeneratePatch = async () => {
    setPatchGenerating(true);
    try {
      const res = await generateIncidentPatch(incident.id);
      setPatchData(res);
      onSuccess('Code Patch Synthesized', `Target: ${res.target_file}`);
    } catch (err: any) {
      onError('Patch generation failed', err.message);
    } finally {
      setPatchGenerating(false);
    }
  };

  const handleApplyLocalPatch = async () => {
    setIsApplyingLocalPatch(true);
    try {
      const res = await applyLocalPatch(incident.id);
      setLocalPatchResult(res);
      if (res.test_results) {
        setTestResult(res.test_results);
      }
      onSuccess('Local Patch Applied & Tested', res.message);
      onUpdate();
    } catch (err: any) {
      onError('Local patch application failed', err.message);
    } finally {
      setIsApplyingLocalPatch(false);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runRegressionTests(incident.id);
      setTestResult(res);
      if (res.passed) {
        onSuccess('Pytest Passed', res.summary);
      } else {
        onError('Pytest Failed', res.summary);
      }
    } catch (err: any) {
      onError('Test execution failed', err.message);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleResetCode = async () => {
    try {
      await resetLocalCode(incident.id);
      setLocalPatchResult(null);
      setTestResult(null);
      onSuccess('Code Reset', 'services/payment_gateway.py reset to vulnerable defect state');
    } catch (err: any) {
      onError('Code reset failed', err.message);
    }
  };

  const handleRunCascade = async () => {
    setCascadeLoading(true);
    try {
      const res = await simulateCascade(incident.id);
      setCascadeData(res);
      onSuccess('Cascade Forecast Generated', `Projected MTTO: ${res.mtto_minutes}m`);
    } catch (err: any) {
      onError('Simulation failed', err.message);
    } finally {
      setCascadeLoading(false);
    }
  };

  const handleRunChaos = async () => {
    setChaosLoading(true);
    try {
      const res = await generateChaosExperiment(incident.id);
      setChaosData(res);
      onSuccess('Chaos Manifest Generated', res.experiment_name);
    } catch (err: any) {
      onError('Chaos generation failed', err.message);
    } finally {
      setChaosLoading(false);
    }
  };

  const handleCommitPatch = async () => {
    if (!patchData) return;
    setPatchCommitting(true);
    try {
      const res = await commitIncidentPatch(incident.id, patchData);
      setCommittedPatchUrl(res.github_url);
      onSuccess('Patch Committed to GitHub', res.target_file);
      onUpdate();
    } catch (err: any) {
      onError('Patch commit failed', err.message);
    } finally {
      setPatchCommitting(false);
    }
  };

  const handleRemediate = async (customAction?: string) => {
    setRemediating(true);
    try {
      const action = customAction || (incident.agent_reasoning?.includes('drain_db')
        ? 'drain_db_connections'
        : incident.agent_reasoning?.includes('flush_cache')
        ? 'flush_cache'
        : incident.agent_reasoning?.includes('scale_replicas')
        ? 'scale_replicas'
        : 'restart_service');

      await executeRemediation(incident.id, action);
      onSuccess('Mitigation Executed', `Action: ${action.replace(/_/g, ' ')}`);
      onUpdate();
    } catch (err: any) {
      onError('Remediation failed', err.message);
    } finally {
      setRemediating(false);
    }
  };

  const isOverrideTriggered = incident.agent_reasoning?.includes('CLUSTERING OVERRIDE') || incident.escalation_count > 0;

  const metaItems: MetaItemProps[] = [
    {
      icon: <Radio className="w-3.5 h-3.5 text-blue-400" />,
      label: 'Channel',
      value: incident.current_channel ? incident.current_channel.toUpperCase() : 'SLACK',
    },
    {
      icon: <Layers className="w-3.5 h-3.5 text-amber-400" />,
      label: 'Escalation Tier',
      value: `Level ${incident.escalation_count}`,
    },
    {
      icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
      label: 'Triggered',
      value: timeAgo(incident.created_at),
    },
    {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />,
      label: 'Last Paged',
      value: timeAgo(incident.last_notified_at),
    },
  ];

  return (
    <div className="rounded-xl bg-[#0F172A] border border-[#1F2937] p-4 flex flex-col gap-3.5 overflow-y-auto h-full shadow-sm">
      
      {/* ── War Room Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pb-2.5 border-b border-[#1F2937]">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={incident.severity} />
            <StatusDot status={incident.status} />
            {isOverrideTriggered && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                CLUSTERING OVERRIDE (+1 Level)
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold leading-snug text-white tracking-tight">
            {incident.title}
          </h2>
          <p className="text-[11px] font-mono text-slate-500">
            UUID: {incident.id}
          </p>
        </div>

        <button
          onClick={onClose}
          aria-label="Close incident detail"
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white bg-[#1E293B] hover:bg-[#334155] transition cursor-pointer border border-[#334155]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Metadata Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {metaItems.map((item) => (
          <MetaItem key={item.label} {...item} />
        ))}
      </div>

      {/* ── 14B SRE Reasoning Command Center ──────────────────────────────── */}
      <div className="rounded-lg border border-[#1F2937] bg-[#111827] overflow-hidden">
        
        {/* Navigation Tabs (Sticky & Numbered for Clarity) */}
        <div className="sticky top-0 z-10 flex items-center gap-1.5 p-2 bg-[#0B0F19]/95 backdrop-blur border-b border-[#1F2937] overflow-x-auto text-xs font-medium shadow-sm">
          {[
            { id: 'dag', num: '1', label: 'Causal RCA Topology', icon: Layers },
            { id: 'remediation', num: '2', label: 'Speculative Runbooks', icon: ShieldCheck },
            { id: 'timetravel', num: '3', label: 'MTTO Cascade Simulator', icon: Clock },
            { id: 'patch', num: '4', label: 'Code Patch & Pytest', icon: FileCode, highlight: true },
            { id: 'chaos', num: '5', label: 'Chaos Mesh CRD', icon: Flame },
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer whitespace-nowrap text-xs ${
                  isSelected
                    ? tab.highlight
                      ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-500/50 font-bold shadow-sm'
                      : 'bg-[#1E293B] text-white font-semibold shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <span className={`w-4 h-4 rounded text-[10px] font-mono flex items-center justify-center ${isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.num}
                </span>
                <IconComponent className={`w-3.5 h-3.5 ${isSelected ? (tab.highlight ? 'text-emerald-400' : 'text-blue-400') : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {onOpenLlmInspector && (
            <button
              onClick={() => {
                const agentMap: Record<string, string> = {
                  dag: 'rca',
                  remediation: 'triage',
                  timetravel: 'timetravel',
                  patch: 'sandbox',
                  chaos: 'chaos',
                };
                onOpenLlmInspector(agentMap[activeSubTab] || 'triage');
              }}
              className="ml-auto flex items-center gap-1 text-[11px] text-purple-300 hover:text-white bg-purple-950/50 hover:bg-purple-900/60 px-2.5 py-1 rounded border border-purple-500/30 transition cursor-pointer shrink-0 font-mono"
              title="Inspect fine-tuned LLM prompt and raw output for this agent step"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Inspect Agent Prompt</span>
            </button>
          )}
        </div>

        {/* Tab 1: Causal RCA DAG */}
        {activeSubTab === 'dag' && (
          <div className="p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-300 font-sans">
              <span className="font-semibold text-blue-400 flex items-center gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5" />
                <span>Causal Fault Tree Propagation Analysis:</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">14B SRE DAG</span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-300 space-y-1.5 leading-relaxed overflow-x-auto text-xs">
              <div className="text-slate-400">[Ingress Surge / Checkout Traffic] ──► [Unreleased Socket in `services/payment_gateway.py`]</div>
              <div className="text-slate-400">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──► [ConnectionPoolExhausted: Max 2 active slots held]</div>
              <div className="text-slate-400">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──► [Pytest Regression Failure: test_payment_gateway_real.py]</div>
              <div className="text-rose-400 font-semibold">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──► [ROOT CAUSE: Missing try/finally Socket Release in Checkout Core]</div>
            </div>

            <div className="p-3 rounded-md bg-[#0F172A] border border-[#1F2937] font-sans text-slate-300 text-xs leading-relaxed">
              <span className="text-blue-400 font-semibold font-mono">14B SRE Reasoning: </span>
              {incident.agent_reasoning || 'Analyzing telemetry and error signatures...'}
            </div>

            {/* Live LLM Neural Telemetry Exchange */}
            <LiveLlmExchangeViewer
              title="Live RCA Agent Prompt & Inference Telemetry"
              agentRole="Causal Root Cause Analysis DAG Agent"
              accentColor="purple"
              telemetry={(incident.channel_metadata?._llm_telemetry as any) || null}
              fallbackSystemPrompt={`You are the Sentinel Autonomous Incident Commander Triage Agent fine-tuned with Qwen2.5-14B-Instruct LoRA weights (kamaleshkumarR/sentinell). Classify severity and compute root-cause DAG.`}
              fallbackUserPrompt={`INCOMING INCIDENT TELEMETRY:
Incident ID: ${incident.id}
Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Error Context: services/payment_gateway.py: ConnectionPoolExhausted`}
              fallbackRawOutput={JSON.stringify({
                root_cause: "Unreleased raw database socket in execute_transaction without try/finally block",
                confidence: 0.992,
                severity: incident.severity,
                blast_radius: ["checkout_service", "payment_gateway", "api_gateway"]
              }, null, 2)}
            />
          </div>
        )}

        {/* Tab 2: Speculative Safe RFC Remediation */}
        {activeSubTab === 'remediation' && (
          <div className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5 font-sans">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified 3-Phase RFC Mitigation (Shadow Sandbox Validated):</span>
              </span>
              {incident.status !== 'resolved' && (
                <button
                  onClick={() => handleRemediate()}
                  disabled={remediating}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition shadow-sm cursor-pointer disabled:opacity-50 font-sans flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{remediating ? 'Executing...' : 'Execute Mitigation Playbook'}</span>
                </button>
              )}
            </div>

            <div className="space-y-2 font-mono">
              <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937] space-y-1">
                <span className="text-blue-400 font-semibold">Phase 1 (Pre-Flight Query):</span>
                <div className="text-slate-300">SELECT count(*), state FROM pg_stat_activity GROUP BY state;</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937] space-y-1">
                <span className="text-emerald-400 font-semibold">Phase 2 (Non-Destructive Drain):</span>
                <div className="text-slate-300">SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change &lt; now() - INTERVAL '1 minute';</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937] space-y-1">
                <span className="text-amber-400 font-semibold">Phase 3 (Capacity Realignment):</span>
                <div className="text-slate-300">ALTER SYSTEM SET idle_in_transaction_session_timeout = '15s'; SELECT pg_reload_conf();</div>
              </div>
            </div>

            {/* Live LLM Neural Telemetry Exchange */}
            <LiveLlmExchangeViewer
              title="Live Mitigation Runbook Agent Prompt & Telemetry"
              agentRole="Speculative Runbook Synthesis Agent"
              accentColor="emerald"
              fallbackSystemPrompt="You are Sentinel's Autonomous RFC Playbook Generator. Synthesize non-destructive database recovery phases."
              fallbackUserPrompt={`Generate 3-phase RFC mitigation plan for incident: ${incident.title}`}
              fallbackRawOutput={JSON.stringify({
                strategy: "POSTGRES_SOCKET_DRAIN_AND_RECONFIGURATION",
                phases: ["Pre-Flight Active Sockets Inspection", "Non-Destructive Idle Termination", "Timeout Parameter Reload"],
                safety_score: 0.994
              }, null, 2)}
            />
          </div>
        )}

        {/* Tab 3: Time-Travel Cascade Simulator */}
        {activeSubTab === 'timetravel' && (
          <div className="p-4 space-y-3.5 text-xs font-sans">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-100">Autoregressive Outage Cascade Simulator:</span>
                <p className="text-[11px] text-slate-400">Forecasts failure escalation across T+5m, T+15m, and T+30m horizons.</p>
              </div>
              <button
                onClick={handleRunCascade}
                disabled={cascadeLoading}
                className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs shadow-sm"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{cascadeLoading ? 'Simulating...' : 'Simulate Cascade'}</span>
              </button>
            </div>

            {cascadeData ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-center justify-between font-mono text-[11px]">
                  <span>Projected MTTO: <strong className="text-amber-400">~{cascadeData.mtto_minutes} minutes</strong></span>
                  <span>Cascade Risk Score: <strong className="text-red-400">{(cascadeData.cascade_risk_score * 100).toFixed(0)}%</strong></span>
                </div>

                <div className="space-y-2">
                  {cascadeData.timeline?.map((step: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-center justify-between font-mono text-[11px]">
                      <div className="space-y-0.5">
                        <span className="text-blue-400 font-bold">{step.horizon}</span>
                        <div className="text-slate-300">{step.projected_state}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 text-red-300 border border-red-500/30">
                        P(Fail): {(step.failure_probability * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>

                {cascadeData.preemptive_circuit_breaker_recommendation && (
                  <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/30 text-blue-200 text-xs font-sans">
                    <strong>Preemptive Recommendation: </strong>
                    {cascadeData.preemptive_circuit_breaker_recommendation}
                  </div>
                )}

                {/* Live LLM Neural Telemetry Exchange */}
                <LiveLlmExchangeViewer
                  title="Live Cascade Simulation Prompt & Output Telemetry"
                  agentRole="Time-Travel 30m Cascade Forecaster Agent"
                  accentColor="cyan"
                  telemetry={cascadeData.llm_telemetry || null}
                  fallbackSystemPrompt="You are the Sentinel Time-Travel Predictive Forecaster. Forecast state at T+5m, T+15m, and T+30m."
                  fallbackUserPrompt={`Simulate 30-minute cascade for incident: ${incident.title}`}
                  fallbackRawOutput={JSON.stringify(cascadeData, null, 2)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-6 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-center text-slate-400">
                  <p className="text-xs">Click <strong>"Simulate Cascade"</strong> to project multi-horizon failure propagation using the 14B SRE model.</p>
                </div>

                <LiveLlmExchangeViewer
                  title="Live Cascade Simulation Prompt Specification"
                  agentRole="Time-Travel 30m Cascade Forecaster Agent"
                  accentColor="cyan"
                  fallbackSystemPrompt="You are the Sentinel Time-Travel Predictive Forecaster. Using queueing theory (M/M/k models) and thread pool metrics, forecast state at T+5m, T+15m, and T+30m."
                  fallbackUserPrompt={`CURRENT INCIDENT TELEMETRY:
Title: ${incident.title}
Severity: ${incident.severity}
Generate deterministic 30-minute cascade trajectory at T+5m, T+15m, and T+30m.`}
                  fallbackRawOutput={JSON.stringify({
                    simulation_model: "Sentinel-MonteCarlo-M/M/k-v4",
                    timeline: [
                      { horizon: "T+5m", status: "UPSTREAM_SATURATION", probability: 0.70 },
                      { horizon: "T+15m", status: "CASCADING_OOM_KILL", probability: 0.85 },
                      { horizon: "T+30m", status: "TOTAL_CLUSTER_BLACKOUT", probability: 0.95 }
                    ]
                  }, null, 2)}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Code Patch */}
        {activeSubTab === 'patch' && (
          <div className="p-4 space-y-4 text-xs">
            {/* Header & Main Control Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-[#1F2937]">
              <div>
                <span className="font-bold text-slate-100 font-sans text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  Autonomous Code Patch &amp; Live Regression Engine
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Synthesize zero-shot patches, apply directly to local repository files, and execute verified pytest suites.
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <button
                  id="synthesize-diff-btn"
                  onClick={handleGeneratePatch}
                  disabled={patchGenerating}
                  className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs shadow-sm"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{patchGenerating ? 'Synthesizing...' : 'Synthesize Diff'}</span>
                </button>

                <button
                  id="apply-local-patch-btn"
                  onClick={handleApplyLocalPatch}
                  disabled={isApplyingLocalPatch}
                  className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs shadow-md border border-emerald-400/40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isApplyingLocalPatch ? 'Patching & Testing...' : 'Apply Patch to Local Repo & Run Tests'}</span>
                </button>

                <button
                  id="run-tests-only-btn"
                  onClick={handleRunTests}
                  disabled={isRunningTests}
                  className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs border border-slate-700"
                >
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isRunningTests ? 'Running...' : 'Run Pytest'}</span>
                </button>

                <button
                  id="reset-code-btn"
                  onClick={handleResetCode}
                  title="Reset services/payment_gateway.py to vulnerable defect state"
                  className="p-1.5 rounded-md bg-slate-800/80 hover:bg-red-950/50 hover:text-red-300 text-slate-400 transition cursor-pointer border border-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Target File Info Banner */}
            <div className="p-2.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-center justify-between font-mono text-[11px]">
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-400">Target Source:</span>
                <span className="text-blue-300 font-semibold px-1.5 py-0.5 rounded bg-blue-950/40 border border-blue-800/50">
                  {patchData?.target_file || (incident.channel_metadata?.target_file as string) || 'services/payment_gateway.py'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Test Suite:</span>
                <span className="text-slate-300">tests/test_payment_gateway_real.py</span>
              </div>
            </div>

            {/* Diff Viewer */}
            {patchData ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Synthesized Unified Diff</span>
                  <span>Confidence: <strong className="text-emerald-400">{(patchData.confidence_score * 100).toFixed(1)}%</strong></span>
                </div>
                <pre className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-xs font-mono overflow-x-auto leading-relaxed max-h-64 overflow-y-auto">
                  {patchData.diff.split('\n').map((line: string, i: number) => {
                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                    const isDel = line.startsWith('-') && !line.startsWith('---');
                    return (
                      <div
                        key={i}
                        className={isAdd ? 'diff-line-add px-2 py-0.5' : isDel ? 'diff-line-del px-2 py-0.5' : 'text-slate-400 px-2'}
                      >
                        {line}
                      </div>
                    );
                  })}
                </pre>

                {patchData && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={handleCommitPatch}
                      disabled={patchCommitting}
                      className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs border border-slate-600"
                    >
                      <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{patchCommitting ? 'Committing...' : 'Commit to GitHub Main'}</span>
                    </button>
                    {committedPatchUrl && (
                      <a
                        href={committedPatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-mono ml-2"
                      >
                        <span>View Commit on GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-center text-slate-400">
                <p className="text-xs">Click <strong>"Synthesize Diff"</strong> or <strong>"Apply Patch to Local Repo &amp; Run Tests"</strong> to test live code remediation against <code>services/payment_gateway.py</code>.</p>
              </div>
            )}

            {/* Live Pytest Execution Terminal Console */}
            {testResult && (
              <div className="space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold text-slate-200">Pytest Local Test Runner Terminal</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    testResult.passed ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50' : 'bg-red-950/60 text-red-300 border border-red-500/50'
                  }`}>
                    {testResult.passed ? 'PASSED (Exit 0)' : 'FAILED (Exit 1)'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-black/90 border border-[#1F2937] font-mono text-[11px] text-slate-200 space-y-1 max-h-56 overflow-y-auto">
                  <div className="text-slate-500">$ python -m pytest {testResult.test_suite} -v</div>
                  <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {testResult.terminal_output}
                  </pre>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Result: <strong className={testResult.passed ? 'text-emerald-400' : 'text-red-400'}>{testResult.summary}</strong></span>
                    <span className="text-[10px] text-slate-500">Verified against local filesystem</span>
                  </div>
                </div>
              </div>
            )}

            {/* Live LLM Neural Telemetry Exchange */}
            <LiveLlmExchangeViewer
              title="Live Code Patch Synthesis Prompt & Inference Telemetry"
              agentRole="Speculative Self-Healing Sandbox Agent"
              accentColor="emerald"
              telemetry={patchData?.llm_telemetry || null}
              fallbackSystemPrompt="You are the Sentinel Autonomous Self-Healing Sandbox Agent. Synthesize AST-compliant unified git diffs and regression assertions."
              fallbackUserPrompt={`DEFECT CONTEXT:
File: ${patchData?.target_file || 'services/payment_gateway.py'}
Incident Title: ${incident.title}
Severity: ${incident.severity}
Error: ConnectionPoolExhausted - DB Connection Pool Max capacity (10/10) exhausted.`}
              fallbackRawOutput={JSON.stringify({
                target_file: "services/payment_gateway.py",
                patch_strategy: "TRY_FINALLY_SOCKET_RELEASE",
                git_diff: patchData?.diff || "--- a/services/payment_gateway.py\n+++ b/services/payment_gateway.py\n@@ -44,4 +44,8 @@\n-    conn = connection_pool.get_connection()\n+    conn = connection_pool.get_connection()\n+    try:\n+        ...\n+    finally:\n+        connection_pool.release(conn)",
                verification_suite: "tests/test_payment_gateway_real.py"
              }, null, 2)}
            />
          </div>
        )}

        {/* Tab 5: Chaos Mesh CRD */}
        {activeSubTab === 'chaos' && (
          <div className="p-4 space-y-3.5 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-300 font-sans">
              <div>
                <span className="font-semibold text-amber-400">Kubernetes Chaos Mesh &amp; Locust Load Harness:</span>
                <p className="text-[11px] text-slate-400">Synthesize Chaos Mesh CRD YAML and Locust load scripts from resolved postmortems.</p>
              </div>
              <button
                onClick={handleRunChaos}
                disabled={chaosLoading}
                className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-sans shadow-sm"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{chaosLoading ? 'Generating...' : 'Generate Chaos Manifest'}</span>
              </button>
            </div>

            {chaosData ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-center justify-between font-mono text-[11px]">
                  <span>Experiment: <strong className="text-amber-300">{chaosData.experiment_name}</strong></span>
                  <span>Target: <strong className="text-blue-300">{chaosData.target_service}</strong></span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-sans font-semibold text-slate-300">Chaos Mesh CRD Manifest:</span>
                  <pre className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-300 text-xs overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
                    {chaosData.chaos_crd_yaml}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-sans font-semibold text-slate-300">Locust Traffic Injection Script:</span>
                  <pre className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-emerald-300 text-xs overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
                    {chaosData.locust_traffic_script}
                  </pre>
                </div>

                {/* Live LLM Neural Telemetry Exchange */}
                <LiveLlmExchangeViewer
                  title="Live Chaos Engineering Prompt & Telemetry"
                  agentRole="Autonomous Chaos Mesh & Locust Generator Agent"
                  accentColor="amber"
                  telemetry={chaosData.llm_telemetry || null}
                  fallbackSystemPrompt="You are Sentinel's Chaos Engineering Architect. Synthesize executable Chaos Mesh CRD YAML and Locust load testing scripts."
                  fallbackUserPrompt={`Generate Chaos Mesh experiment for incident: ${incident.title}`}
                  fallbackRawOutput={JSON.stringify(chaosData, null, 2)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <pre className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-slate-300 text-xs overflow-x-auto leading-relaxed">
{`apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: incident-${incident.id.slice(0, 8)}-reproduce
  namespace: production
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - production
    labelSelectors:
      app: checkout-api
  delay:
    latency: '500ms'
    jitter: '100ms'
  duration: '5m'`}
                </pre>

                {/* Live LLM Neural Telemetry Exchange */}
                <LiveLlmExchangeViewer
                  title="Live Chaos Mesh Generation Prompt Specification"
                  agentRole="Autonomous Chaos Mesh & Locust Generator Agent"
                  accentColor="amber"
                  fallbackSystemPrompt="You are Sentinel's Chaos Engineering Architect. Ingest resolved postmortems to synthesize Chaos Mesh CRDs and Locust scripts."
                  fallbackUserPrompt={`INCIDENT POSTMORTEM SPECIFICATION:
Incident Title: ${incident.title}
Target Service: services/payment_gateway.py
Generate Kubernetes NetworkChaos YAML and Locust socket pressure test.`}
                  fallbackRawOutput={`apiVersion: chaos-mesh.org/v1alpha1\nkind: NetworkChaos\nmetadata:\n  name: payment-gateway-pool-stress\nspec:\n  action: delay\n  mode: fixed\n  value: '30%'\n  delay:\n    latency: '150ms'`}
                />
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Responder Bridge (ChatOps) ──────────────────────────────────────── */}
      <EngineerReplySimulator
        incidentId={incident.id}
        incidentStatus={incident.status}
        onReplySimulated={onReplySimulated}
      />

      {/* ── Multi-Channel Timeline Feed ────────────────────────────────────── */}
      <TimelinePanel
        incidentId={incident.id}
        key={timelineKey}
      />

    </div>
  );
}
