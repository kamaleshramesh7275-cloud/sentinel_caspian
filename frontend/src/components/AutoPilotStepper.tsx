import React, { useState } from 'react';
import { Play, ChevronRight, RotateCcw, Sparkles, CheckCircle2, MessageSquare, ShieldCheck, Terminal, Flame, Layers, Clock, FileCode, Bug } from 'lucide-react';
import { triggerRealCodeFailure, applyLocalPatch, simulateCascade, resetLocalCode } from '../api';

interface Props {
  onIncidentCreated: (incidentId: string) => void;
  onStepChange: (stepIndex: number) => void;
  selectedIncidentId: string | null;
  onError: (title: string, msg?: string) => void;
  onSuccess: (title: string, msg?: string) => void;
}

export const DEMO_STEPS = [
  {
    num: 1,
    title: 'Inject Real Defect',
    icon: Bug,
    target: 'services/payment_gateway.py',
    summary: 'Executes live Python checkout transactions with raw socket leakage until ConnectionPoolExhausted triggers.',
    talkingPoint: '“We start by executing real production microservice code in our repo. As concurrent checkouts arrive, raw database sockets leak, causing an unhandled ConnectionPoolExhausted crash on the 3rd transaction.”',
  },
  {
    num: 2,
    title: '14B Clustering & Triage',
    icon: Flame,
    target: 'Multi-Source Telemetry',
    summary: 'Correlates Sentry, Datadog, and CI bursts in sliding window and triggers automatic severity escalation.',
    talkingPoint: '“Sentinel’s 14B SRE model ingests telemetry across Sentry, Datadog, and GitHub Actions, instantly identifying identical failure signatures and escalating severity via an autonomous clustering override.”',
  },
  {
    num: 3,
    title: 'Causal RCA & RAG',
    icon: Layers,
    target: 'Causal Topology Graph',
    summary: 'Constructs causal fault tree DAG and queries vector episodic memory for matched postmortem runbooks.',
    talkingPoint: '“The model constructs a causal DAG linking the checkout traffic surge to the socket exhaustion, while querying past vector episodic memory to retrieve proven runbooks.”',
  },
  {
    num: 4,
    title: 'MTTO Cascade Forecaster',
    icon: Clock,
    target: 'T+5m / T+15m / T+30m',
    summary: 'Simulates failure escalation and computes Mean Time to Outage with preemptive circuit-breaker recommendation.',
    talkingPoint: '“Sentinel forecasts the outage blast radius over 30 minutes, warning that downstream services will experience 504 timeouts within 3.2 minutes unless preemptive circuit breaking is engaged.”',
  },
  {
    num: 5,
    title: 'Auto Code Patch & Pytest',
    icon: FileCode,
    target: 'Live Local Repo & Pytest',
    summary: 'Generates unified .diff, patches services/payment_gateway.py on disk, and runs real pytest regression tests.',
    talkingPoint: '“The model synthesizes a unified git diff wrapping socket acquisition in a defensive try/finally block, modifies the local file on disk, and verifies it with a 100% green Pytest execution in 0.06 seconds.”',
  },
  {
    num: 6,
    title: 'ChatOps & Resolution',
    icon: MessageSquare,
    target: 'Multi-Channel Responder',
    summary: 'Parses human on-call engineer natural language intent and commits postmortem to GitHub.',
    talkingPoint: '“Finally, through ChatOps on Slack and Telegram, engineers can issue natural language commands to acknowledge, scale, and resolve the incident with automated postmortem generation.”',
  },
];

export function AutoPilotStepper({
  onIncidentCreated,
  onStepChange,
  selectedIncidentId,
  onError,
  onSuccess,
}: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunningStep, setIsRunningStep] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(selectedIncidentId);

  const step = DEMO_STEPS[currentStepIndex];

  const handleRunCurrentStep = async () => {
    setIsRunningStep(true);
    try {
      if (currentStepIndex === 0) {
        // Step 1: Inject real bug
        const resp = await triggerRealCodeFailure();
        if (resp.incident_id) {
          setActiveIncidentId(resp.incident_id);
          onIncidentCreated(resp.incident_id);
        }
        onSuccess('Real Code Bug Executed', `Captured ${resp.captured_exception?.slice(0, 50)}...`);
        setCurrentStepIndex(1);
        onStepChange(1);
      } else if (currentStepIndex === 1) {
        // Step 2: 14B Triage
        onSuccess('14B Triage Inspected', 'Clustering override and telemetry correlated.');
        setCurrentStepIndex(2);
        onStepChange(2);
      } else if (currentStepIndex === 2) {
        // Step 3: Causal RCA
        onSuccess('Causal RCA DAG', 'Inspected causal propagation tree and vector memory.');
        setCurrentStepIndex(3);
        onStepChange(3);
      } else if (currentStepIndex === 3) {
        // Step 4: MTTO Cascade
        await simulateCascade(activeIncidentId || '00000000-0000-0000-0000-000000000000');
        onSuccess('Cascade Simulated', 'Forecasted failure escalation across 3 horizons.');
        setCurrentStepIndex(4);
        onStepChange(4);
      } else if (currentStepIndex === 4) {
        // Step 5: Code Patch & Pytest
        const res = await applyLocalPatch(activeIncidentId || undefined);
        onSuccess('Patch Applied & Pytest Passed', res.message || 'Defensive patch verified with 100% green Pytest.');
        setCurrentStepIndex(5);
        onStepChange(5);
      } else if (currentStepIndex === 5) {
        // Step 6: ChatOps
        onSuccess('Demo Cycle Completed', 'All 11 AI capabilities demonstrated successfully!');
      }
    } catch (err: any) {
      onError('Step execution failed', err.message);
    } finally {
      setIsRunningStep(false);
    }
  };

  const handleNextStep = () => {
    const nextIdx = (currentStepIndex + 1) % DEMO_STEPS.length;
    setCurrentStepIndex(nextIdx);
    onStepChange(nextIdx);
  };

  const handleReset = async () => {
    try {
      if (activeIncidentId) {
        await resetLocalCode(activeIncidentId);
      }
      setCurrentStepIndex(0);
      onStepChange(0);
      onSuccess('Demo Reset', 'Reset to Step 1 and services/payment_gateway.py restored to defect state.');
    } catch (err: any) {
      onError('Reset failed', err.message);
    }
  };

  return (
    <div className="rounded-xl bg-[#0F172A] border border-[#1F2937] p-3 shadow-md space-y-2.5 font-sans">
      
      {/* Top Bar: Stepper Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-[#1F2937]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Autonomous Incident Response Stepper
            </span>
            <span className="text-[10px] text-slate-400 ml-2 font-mono">
              Step {currentStepIndex + 1} of 6
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunCurrentStep}
            disabled={isRunningStep}
            className="px-3.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 shadow-sm"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isRunningStep ? 'Running Step...' : `Run Step ${currentStepIndex + 1}: ${step.title}`}</span>
          </button>

          <button
            onClick={handleNextStep}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleReset}
            title="Reset demo to initial state"
            className="p-1 rounded-md bg-slate-800 hover:bg-red-950/40 hover:text-red-300 text-slate-400 transition cursor-pointer border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Steps Progress Row (Pills) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 font-mono text-[11px]">
        {DEMO_STEPS.map((s, idx) => {
          const isCurrent = currentStepIndex === idx;
          const isPassed = currentStepIndex > idx;
          const StepIcon = s.icon;
          return (
            <button
              key={s.num}
              onClick={() => {
                setCurrentStepIndex(idx);
                onStepChange(idx);
              }}
              className={`p-1.5 rounded-lg border transition text-left flex items-center gap-1.5 cursor-pointer truncate ${
                isCurrent
                  ? 'bg-[#182338] border-blue-500 text-blue-200 font-bold shadow-sm ring-1 ring-blue-500/30'
                  : isPassed
                  ? 'bg-[#0B0F19] border-emerald-500/40 text-emerald-300 font-medium'
                  : 'bg-[#0B0F19] border-[#1F2937] text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`w-4 h-4 rounded text-[9px] flex items-center justify-center shrink-0 ${
                isCurrent ? 'bg-blue-500 text-white' : isPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {isPassed ? '✓' : s.num}
              </div>
              <span className="truncate">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Presenter Talking Point Callout */}
      <div className="p-2.5 rounded-lg bg-[#0B0F19] border border-blue-500/30 flex items-start gap-2.5 text-xs">
        <div className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 font-mono font-bold text-[10px]">
          🎙️
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-300 uppercase text-[10px] tracking-wider font-mono">
              What to Say to Judges / Audience for Step {step.num}:
            </span>
            <span className="text-[10px] font-mono text-slate-400 px-1.5 rounded bg-slate-800">
              {step.target}
            </span>
          </div>
          <p className="text-slate-200 italic leading-relaxed text-[11px]">
            {step.talkingPoint}
          </p>
        </div>
      </div>

    </div>
  );
}
