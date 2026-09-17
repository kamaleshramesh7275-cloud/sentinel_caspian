import React, { useState, useEffect, useCallback } from 'react';
import { Incident, AiStatus, ActivityEvent } from './types';
import { fetchIncidents, fetchIncident, fetchHealth, getWebSocketUrl, fetchAiStatus, fetchActivities } from './api';

// Components
import { Header } from './components/Header';
import { StatCard } from './components/StatCard';
import { ChaosPanel } from './components/ChaosPanel';
import { IncidentList } from './components/IncidentList';
import { IncidentDetail } from './components/IncidentDetail';
import { AiInspectorModal } from './components/AiInspectorModal';
import { BehindTheScenesConsole } from './components/BehindTheScenesConsole';
import { TriggerIncidentModal } from './components/TriggerIncidentModal';
import { LiveOpsFeed } from './components/LiveOpsFeed';
import { AutoPilotStepper } from './components/AutoPilotStepper';
import { ModelArchitectureModal } from './components/ModelArchitectureModal';
import { LlmPromptInspectorModal } from './components/LlmPromptInspectorModal';
import { SloBurnGauge } from './components/SloBurnGauge';
import { MissionControlView } from './components/MissionControlView';
import { AiAgentsHub } from './components/AiAgentsHub';
import { ToastContainer } from './components/Toast';

// Lucide icons
import { ShieldCheck, Plus, Activity, Layers, Play, CheckCircle2 } from 'lucide-react';

// Hooks
import { useToast } from './hooks/useToast';

import './index.css';

// ── Welcome / Empty Canvas ───────────────────────────────────────────────────
interface WelcomeProps {
  onOpenTrigger: () => void;
  onSwitchToLiveOps: () => void;
}

function WelcomePanel({ onOpenTrigger, onSwitchToLiveOps }: WelcomeProps) {
  return (
    <div className="rounded-xl bg-[#0F172A] border border-[#1F2937] flex flex-col items-center justify-center p-8 text-center h-full min-h-[520px] shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
        <ShieldCheck className="w-6 h-6" />
      </div>

      <h3 className="text-base font-bold text-white tracking-tight">
        Sentinel Caspian · Autonomous Incident Commander
      </h3>
      <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed font-sans">
        Select an active incident from the triage queue or trigger a synthetic failure scenario to inspect real-time Causal RCA graphs, speculative safe runbooks, and cross-channel orchestration.
      </p>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={onOpenTrigger}
          className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-500 border border-red-500 transition cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Declare Incident</span>
        </button>

        <button
          onClick={onSwitchToLiveOps}
          className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium text-slate-300 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] transition cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>View Live Ops Stream</span>
        </button>
      </div>
    </div>
  );
}

// ── App Main Component ────────────────────────────────────────────────────────
export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [filter, setFilter] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [wsConnected, setWsConnected] = useState(false);
  const [showAiInspector, setShowAiInspector] = useState(false);
  const [showBehindTheScenes, setShowBehindTheScenes] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showModelArch, setShowModelArch] = useState(false);
  const [showLlmInspector, setShowLlmInspector] = useState(false);
  const [llmInspectorAgentId, setLlmInspectorAgentId] = useState<string | undefined>(undefined);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [timelineKey, setTimelineKey] = useState(0);

  // Live Ops Stream State
  const [activeTab, setActiveTab] = useState<'mission_control' | 'agents_hub' | 'incidents' | 'liveops'>('mission_control');
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [selectedIncidentForActivity, setSelectedIncidentForActivity] = useState<string | null>(null);

  const { toasts, dismiss, success, error: toastError, info } = useToast();

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const data = await fetchIncidents(filter || undefined);
      setIncidents(data.incidents);
      setTotal(data.total);
      setLastRefresh(new Date());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingIncidents(false);
    }
  }, [filter]);

  const loadActivities = useCallback(async () => {
    try {
      setLoadingActivities(true);
      const data = await fetchActivities(undefined, selectedIncidentForActivity || undefined, 100);
      setActivities(data);
    } catch (e: any) {
      console.error('Failed to load activities', e);
    } finally {
      setLoadingActivities(false);
    }
  }, [selectedIncidentForActivity]);

  useEffect(() => {
    setLoadingIncidents(true);
    load();
    loadActivities();
    fetchHealth().then((h) => setChannels(h.channels_available)).catch(() => {});
    fetchAiStatus().then(setAiStatus).catch(console.error);

    const interval = setInterval(() => {
      load();
      loadActivities();
      fetchAiStatus().then(setAiStatus).catch(() => {});
    }, 10000);

    // Real-time WebSocket
    let socket: WebSocket | null = null;
    try {
      const wsUrl = getWebSocketUrl();
      socket = new WebSocket(wsUrl);
      socket.onopen = () => setWsConnected(true);
      socket.onclose = () => setWsConnected(false);
      socket.onerror = () => setWsConnected(false);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'activity_logged' && payload.data) {
            setActivities((prev) => {
              if (prev.some((a) => a.id === payload.data.id)) return prev;
              return [payload.data, ...prev];
            });
          }
          if (payload?.type) {
            load();
          }
        } catch { /* ignore */ }
      };
    } catch { /* ignore */ }

    return () => {
      clearInterval(interval);
      socket?.close();
    };
  }, [load, loadActivities]);

  // Keep selected incident synchronized
  useEffect(() => {
    if (!selected) return;
    const fresh = incidents.find((i) => i.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [incidents]);

  // Handle manual select
  const handleSelectIncident = async (id: string) => {
    try {
      const inc = await fetchIncident(id);
      setSelected(inc);
    } catch {
      const fallback = incidents.find((i) => i.id === id);
      if (fallback) setSelected(fallback);
    }
  };

  const handleFilterChange = (f: string) => {
    setFilter(f);
  };

  const handleChaosSuccess = (result: any) => {
    success(
      `Scenario Injected (${result.events_fired} events)`,
      `Severity: ${result.severity?.toUpperCase()} — Alert dispatched`
    );
    load();
    loadActivities();
    if (result.incident_id) {
      handleSelectIncident(result.incident_id);
    }
  };

  const handleTriggerSuccess = (result: any) => {
    success(
      `Incident Declared: ${result.severity?.toUpperCase()}`,
      `Title: ${result.title}`
    );
    load();
    loadActivities();
    if (result.incident_id) {
      handleSelectIncident(result.incident_id);
    }
  };

  const handleReplySimulated = () => {
    setTimelineKey((k) => k + 1);
    load();
    loadActivities();
  };

  // Compute stat counts
  const openCount = incidents.filter((i) => i.status === 'open' || i.status === 'ack').length;
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
  const highCount = incidents.filter((i) => i.severity === 'high').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;

  return (
    <div className="flex flex-col h-screen bg-[#0B0F17] text-slate-100 overflow-hidden font-sans">
      {/* Header */}
      <Header
        channels={channels}
        wsConnected={wsConnected}
        lastRefresh={lastRefresh}
        aiStatus={aiStatus}
        onOpenInspector={() => setShowAiInspector(true)}
        onOpenBehindTheScenes={() => setShowBehindTheScenes(true)}
        onOpenTriggerIncident={() => setShowTriggerModal(true)}
        onOpenModelArch={() => setShowModelArch(true)}
        onOpenLlmInspector={() => {
          setLlmInspectorAgentId(undefined);
          setShowLlmInspector(true);
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activityCount={activities.length}
      />

      {/* Top Stat & SLO Ribbon */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 px-6 py-2 border-b border-[#1F2937] bg-[#0F172A] shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
          <StatCard
            label="Active Incidents"
            value={openCount}
            sub="Unresolved in queue"
            statusVariant={openCount > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label="Critical Alerts (P0)"
            value={criticalCount}
            sub="Immediate Action"
            statusVariant={criticalCount > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label="High Severity (P1)"
            value={highCount}
            sub="Degraded Performance"
            statusVariant={highCount > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Auto-Resolved"
            value={resolvedCount}
            sub="Postmortem Committed"
            statusVariant="success"
          />
        </div>

        {/* Live SLO & Error Budget Gauge */}
        <div className="shrink-0">
          <SloBurnGauge
            targetSlo={99.99}
            currentSlo={criticalCount > 0 ? 98.42 : 99.98}
            burnRateMultiplier={criticalCount > 0 ? 14.4 : 0.05}
            isPatched={criticalCount === 0 && resolvedCount > 0}
          />
        </div>
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {activeTab === 'mission_control' ? (
          <div className="flex-1 min-h-[580px] flex flex-col">
            <MissionControlView
              onIncidentCreated={(incId) => {
                load();
                loadActivities();
                handleSelectIncident(incId);
              }}
              onOpenLlmInspector={(agentId) => {
                setLlmInspectorAgentId(agentId);
                setShowLlmInspector(true);
              }}
              onError={(title, msg) => toastError(title, msg)}
              onSuccess={(title, msg) => success(title, msg)}
            />
          </div>
        ) : activeTab === 'agents_hub' ? (
          <div className="flex-1 min-h-[620px] flex flex-col">
            <AiAgentsHub
              onError={(title, msg) => toastError(title, msg)}
              onSuccess={(title, msg) => success(title, msg)}
            />
          </div>
        ) : activeTab === 'liveops' ? (
          <div className="flex-1 min-h-[500px] rounded-xl bg-[#0F172A] border border-[#1F2937] overflow-hidden shadow-sm flex flex-col">
            <LiveOpsFeed
              activities={activities}
              loading={loadingActivities}
              onSelectIncident={(incId) => {
                setActiveTab('incidents');
                handleSelectIncident(incId);
              }}
              onRefresh={loadActivities}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 h-full overflow-hidden" style={{ minHeight: 0 }}>
            {/* Top Auto-Pilot Stepper */}
            <div className="shrink-0">
              <AutoPilotStepper
                onIncidentCreated={(incId) => {
                  load();
                  loadActivities();
                  handleSelectIncident(incId);
                }}
                onStepChange={(stepIdx) => {
                  // Step navigation feedback
                }}
                selectedIncidentId={selected?.id ?? null}
                onError={(title, msg) => toastError(title, msg)}
                onSuccess={(title, msg) => success(title, msg)}
              />
            </div>

            {/* 2-Column Split: Left Fault Harness & Incident Queue | Right War Room */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              {/* Left Column */}
              <div className="lg:col-span-5 flex flex-col gap-2 h-full overflow-hidden" style={{ minHeight: 0 }}>
                <div className="shrink-0">
                  <ChaosPanel
                    onChaosSuccess={handleChaosSuccess}
                    onError={(title, msg) => toastError(title, msg)}
                  />
                </div>

                <div className="flex-1 min-h-0 overflow-hidden rounded-xl bg-[#0F172A] border border-[#1F2937] shadow-sm flex flex-col" style={{ minHeight: 0 }}>
                  <IncidentList
                    incidents={incidents}
                    loading={loadingIncidents}
                    filter={filter}
                    onFilterChange={handleFilterChange}
                    selectedId={selected?.id ?? null}
                    onSelect={(inc) => handleSelectIncident(inc.id)}
                  />
                </div>
              </div>

              {/* Right Main Area: Incident War Room or Welcome Panel */}
              <div className="lg:col-span-7 overflow-hidden h-full" style={{ minHeight: 0 }}>
                {selected ? (
                  <IncidentDetail
                    incident={selected}
                    onClose={() => setSelected(null)}
                    onUpdate={load}
                    onReplySimulated={handleReplySimulated}
                    onOpenLlmInspector={(agentId) => {
                      setLlmInspectorAgentId(agentId);
                      setShowLlmInspector(true);
                    }}
                    onError={(title, msg) => toastError(title, msg)}
                    onSuccess={(title, msg) => success(title, msg)}
                    timelineKey={timelineKey}
                  />
                ) : (
                  <WelcomePanel
                    onOpenTrigger={() => setShowTriggerModal(true)}
                    onSwitchToLiveOps={() => setActiveTab('liveops')}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Dialog Modals */}
      <AiInspectorModal isOpen={showAiInspector} onClose={() => setShowAiInspector(false)} />
      <ModelArchitectureModal
        isOpen={showModelArch}
        onClose={() => setShowModelArch(false)}
        aiStatus={aiStatus}
      />
      <LlmPromptInspectorModal
        isOpen={showLlmInspector}
        onClose={() => setShowLlmInspector(false)}
        initialAgentId={llmInspectorAgentId}
      />
      <BehindTheScenesConsole
        isOpen={showBehindTheScenes}
        onClose={() => setShowBehindTheScenes(false)}
        selectedIncident={selected}
        aiStatus={aiStatus}
        activities={activities}
      />
      <TriggerIncidentModal
        isOpen={showTriggerModal}
        onClose={() => setShowTriggerModal(false)}
        onSuccess={handleTriggerSuccess}
        onError={(title, msg) => toastError(title, msg)}
      />

      {/* Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
