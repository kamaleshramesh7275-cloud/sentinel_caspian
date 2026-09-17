import React, { useState } from 'react';
import { triggerChaos, triggerIncident, triggerRealCodeFailure } from '../api';
import { ChaosResponse } from '../types';
import { Flame, Database, Server, Cpu, Play, CheckCircle2, AlertOctagon, Terminal, Bug } from 'lucide-react';
import { LiveLlmExchangeViewer } from './LiveLlmExchangeViewer';

interface Props {
  onChaosSuccess: (result: ChaosResponse) => void;
  onError: (title: string, msg?: string) => void;
}

const SCENARIOS = [
  {
    id: 'db_pool',
    shortTitle: 'Postgres Pool',
    title: 'PostgreSQL Pool Saturation',
    service: 'checkout-api',
    signature: 'ConnectionPoolExhausted:5432',
    severity: 'SEV-1',
    badgeClass: 'badge-critical',
    desc: 'Simulates 42 blocked transactions causing 100/100 connection pool lockup and 1-level clustering override.',
    icon: Database,
  },
  {
    id: 'redis_oom',
    shortTitle: 'Redis OOM',
    title: 'Redis Cache Cluster OOM',
    service: 'cache-cluster',
    signature: 'OOMCommandRejected',
    severity: 'SEV-2',
    badgeClass: 'badge-high',
    desc: 'Simulates unbounded session key growth hitting maxmemory with policy=noeviction.',
    icon: Server,
  },
  {
    id: 'k8s_flap',
    shortTitle: 'K8s CrashLoop',
    title: 'Kubernetes Pod CrashLoop',
    service: 'auth-service',
    signature: 'PodOOMKilled:Exit137',
    severity: 'SEV-1',
    badgeClass: 'badge-critical',
    desc: 'Simulates JVM max heap memory exceeded causing container cgroups exit code 137 flapping.',
    icon: Cpu,
  },
  {
    id: 'stripe_timeout',
    shortTitle: 'Payment 504',
    title: 'Payment Gateway 504 Timeout',
    service: 'payment-processor',
    signature: 'StripeGatewayTimeout:504',
    severity: 'SEV-2',
    badgeClass: 'badge-high',
    desc: 'Simulates downstream merchant API latency spikes creating queue backpressure.',
    icon: AlertOctagon,
  },
];

export function ChaosPanel({ onChaosSuccess, onError }: Props) {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [isFiring, setIsFiring] = useState(false);
  const [isExecutingRealBug, setIsExecutingRealBug] = useState(false);
  const [result, setResult] = useState<ChaosResponse | null>(null);

  const handleFireScenario = async (scenario = selectedScenario) => {
    setIsFiring(true);
    setResult(null);
    try {
      let resp: ChaosResponse;
      if (scenario.id === 'db_pool') {
        resp = await triggerChaos();
      } else {
        const incResp = await triggerIncident({
          title: scenario.title,
          severity: scenario.severity.includes('1') ? 'critical' : 'high',
          service: scenario.service,
          source: 'chaos-harness',
          error_signature: scenario.signature,
          details: scenario.desc,
          is_demo: true,
          send_notifications: true,
        });
        resp = {
          message: `Injected synthetic failure scenario: ${scenario.title}`,
          events_fired: 1,
          incident_id: incResp.incident_id,
          severity: incResp.severity,
          agent_reasoning: incResp.agent_reasoning,
        };
      }
      setResult(resp);
      onChaosSuccess(resp);
    } catch (e: any) {
      onError('Scenario Injection Failed', e.message);
    } finally {
      setIsFiring(false);
    }
  };

  const handleExecuteRealBug = async () => {
    setIsExecutingRealBug(true);
    setResult(null);
    try {
      const realResp = await triggerRealCodeFailure();
      const chaosResp: ChaosResponse = {
        message: `💥 Executed real defective code in services/payment_gateway.py! Captured ${realResp.captured_exception?.slice(0, 60)}...`,
        events_fired: 3,
        incident_id: realResp.incident_id,
        severity: realResp.severity || 'high',
        agent_reasoning: realResp.agent_reasoning,
      };
      setResult(chaosResp);
      onChaosSuccess(chaosResp);
    } catch (e: any) {
      onError('Real Code Execution Failed', e.message);
    } finally {
      setIsExecutingRealBug(false);
    }
  };

  return (
    <div className="p-3 rounded-xl border border-[#1F2937] bg-[#111827] shadow-sm space-y-2.5">
      {/* Real Code Defect Demo Banner */}
      <div className="p-2.5 rounded-lg bg-gradient-to-r from-red-950/40 via-amber-950/30 to-blue-950/30 border border-red-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <Bug className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-red-300">Live Repo Defect Demo</span>
              <span className="text-[9px] font-mono bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30">
                services/payment_gateway.py
              </span>
            </div>
            <p className="text-[10px] text-slate-300">
              Executes real python code with unreleased raw sockets, captures runtime traceback, and triggers full AI triage & auto-patcher.
            </p>
          </div>
        </div>

        <button
          id="run-real-code-bug-btn"
          disabled={isExecutingRealBug || isFiring}
          onClick={handleExecuteRealBug}
          className="w-full sm:w-auto px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-md shrink-0 font-sans"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isExecutingRealBug ? 'Executing Defect...' : 'Run Real Code Bug Test'}</span>
        </button>
      </div>

      {/* Top row: Title + Inject Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider truncate">
              Synthetic Chaos Scenarios
            </h3>
          </div>
        </div>

        <button
          id="fire-chaos-scenario-btn"
          disabled={isFiring || isExecutingRealBug}
          onClick={() => handleFireScenario()}
          className="px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 bg-amber-600 hover:bg-amber-500 text-white border border-amber-500 shadow-sm shrink-0 font-sans"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isFiring ? 'Injecting...' : 'Inject Fault'}</span>
        </button>
      </div>

      {/* Scenario Selector Row (Compact Pills) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-sans">
        {SCENARIOS.map((sc) => {
          const isSelected = selectedScenario.id === sc.id;
          const IconComponent = sc.icon;
          return (
            <button
              key={sc.id}
              onClick={() => setSelectedScenario(sc)}
              className={`p-1.5 rounded-lg border transition text-left flex flex-col gap-0.5 cursor-pointer truncate ${
                isSelected
                  ? 'bg-[#182338] border-blue-500/70 shadow-sm ring-1 ring-blue-500/30'
                  : 'bg-[#0B0F19] border-[#1F2937] hover:border-slate-700 hover:bg-[#141B2A]'
              }`}
              title={`${sc.title} (${sc.service})`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <IconComponent className={`w-3 h-3 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-blue-200' : 'text-slate-300'}`}>
                    {sc.shortTitle}
                  </span>
                </div>
                <span className={`text-[8px] font-mono px-1 rounded border shrink-0 ${sc.badgeClass}`}>
                  {sc.severity}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono truncate">
                {sc.service}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feedback status */}
      {result && (
        <div className="space-y-2">
          <div className="p-2 rounded-md bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-between font-mono animate-fadeIn">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Injected: {result.incident_id ? `INC-${result.incident_id.slice(0, 8)}` : 'Logged'} ({result.events_fired} events)</span>
            </div>
            <span className="font-bold text-[9px] uppercase shrink-0 ml-2">{result.severity}</span>
          </div>

          <LiveLlmExchangeViewer
            title="Live Chaos Triage Prompt & Model Output"
            agentRole="Severity Triage & Clustering Override Agent"
            accentColor="amber"
            telemetry={(result as any).llm_telemetry || null}
            fallbackSystemPrompt="You are the Sentinel Autonomous Incident Commander Triage Agent fine-tuned on Qwen2.5-14B-Instruct LoRA."
            fallbackUserPrompt={`INJECTED SCENARIO TELEMETRY:
Scenario: ${selectedScenario.title}
Service: ${selectedScenario.service}
Signature: ${selectedScenario.signature}
Details: ${selectedScenario.desc}`}
            fallbackRawOutput={JSON.stringify({
              severity: selectedScenario.severity.toLowerCase().includes('1') ? 'critical' : 'high',
              override_triggered: true,
              reasoning: result.agent_reasoning || "Clustering override triggered across repeated microservice faults."
            }, null, 2)}
          />
        </div>
      )}
    </div>
  );
}
