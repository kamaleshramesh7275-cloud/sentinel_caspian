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
import { TriggerIncidentModal } from './components/TriggerIncidentModal';
import { LiveOpsFeed } from './components/LiveOpsFeed';
import { ToastContainer } from './components/Toast';

// Hooks
import { useToast } from './hooks/useToast';

import './index.css';

// ── Welcome / Placeholder Canvas ──────────────────────────────────────────────
interface WelcomeProps {
  onOpenTrigger: () => void;
  onSwitchToLiveOps: () => void;
}

function WelcomePanel({ onOpenTrigger, onSwitchToLiveOps }: WelcomeProps) {
  return (
    <div className="rounded-xl bg-[#111622] border border-[#1E2738] flex flex-col items-center justify-center p-8 text-center h-full min-h-[520px]">
      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-4 shadow-sm">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-white tracking-tight">
        Sentinel Incident Commander
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
        Select an active incident from the queue to review Caspian AI reasoning, run automated mitigation, or track cross-channel escalation.
      </p>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2.5 mt-6">
        <button
          onClick={onOpenTrigger}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Declare Incident</span>
        </button>

        <button
          onClick={onSwitchToLiveOps}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-[#161C2A] hover:bg-[#1C2436] border border-[#283347] transition-colors cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
            <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
            <circle cx="12" cy="12" r="2" />
          </svg>
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
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [timelineKey, setTimelineKey] = useState(0);

  // Live Ops Stream State
  const [activeTab, setActiveTab] = useState<'incidents' | 'liveops'>('incidents');
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
      socket.onopen  = () => setWsConnected(true);
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
      if (socket?.readyState === WebSocket.OPEN) socket.close();
    };
  }, [load, loadActivities]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const stats = {
    total,
    active:   incidents.filter((i) => ['open', 'escalated'].includes(i.status)).length,
    critical: incidents.filter((i) => i.severity === 'critical').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectIncident = (incident: Incident) => {
    setSelected((prev) => (prev?.id === incident.id ? null : incident));
  };

  const handleReplySimulated = () => {
    load();
    setTimelineKey((k) => k + 1);
    if (selected) {
      fetchIncident(selected.id).then(setSelected).catch(console.error);
    }
  };

  const handleFilterChange = (f: string) => {
    setFilter(f);
    setSelected(null);
  };

  const handleTriggerSuccess = async (result: any) => {
    await load();
    if (result.incident_id) {
      try {
        const inc = await fetchIncident(result.incident_id);
        setSelected(inc);
      } catch { /* ignore */ }
    }
    success(
      'Incident Declared',
      `${result.title} [${result.severity?.toUpperCase() ?? 'MEDIUM'}]`
    );
  };

  const handleSelectIncidentFromFeed = (incId: string) => {
    const found = incidents.find((i) => i.id === incId);
    if (found) {
      setSelected(found);
      setActiveTab('incidents');
    } else {
      fetchIncident(incId)
        .then((inc) => {
          setSelected(inc);
          setActiveTab('incidents');
        })
        .catch(console.error);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 flex flex-col min-h-screen bg-[#0B0E14] text-[#F1F5F9]">
      {/* Top Header */}
      <Header
        channels={channels}
        wsConnected={wsConnected}
        lastRefresh={lastRefresh}
        aiStatus={aiStatus}
        onOpenInspector={() => setShowAiInspector(true)}
        onOpenTriggerIncident={() => setShowTriggerModal(true)}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        activityCount={activities.length}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Metric KPI Row */}
        <div className="px-6 pt-5 pb-3 max-w-screen-2xl mx-auto w-full">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total Incidents"
              value={stats.total}
              animateTo={stats.total}
              sub="All logged incidents"
            />
            <StatCard
              label="Active Operations"
              value={stats.active}
              animateTo={stats.active}
              sub="Open + escalated incidents"
            />
            <StatCard
              label="Critical P0 / SEV-0"
              value={stats.critical}
              animateTo={stats.critical}
              sub="Requiring immediate action"
            />
            <StatCard
              label="Resolved Incidents"
              value={stats.resolved}
              animateTo={stats.resolved}
              sub="Postmortems generated"
            />
          </div>
        </div>

        {/* View Switcher: Queue & Detail vs Live Ops Stream */}
        {activeTab === 'liveops' ? (
          <div className="flex-1 px-6 pb-6 max-w-screen-2xl mx-auto w-full overflow-hidden" style={{ minHeight: '580px' }}>
            <LiveOpsFeed
              activities={activities}
              loading={loadingActivities}
              onRefresh={loadActivities}
              selectedIncidentId={selectedIncidentForActivity}
              onSelectIncident={handleSelectIncidentFromFeed}
              onClearIncidentFilter={() => setSelectedIncidentForActivity(null)}
            />
          </div>
        ) : (
          <div
            className="flex-1 grid px-6 pb-6 gap-4 max-w-screen-2xl mx-auto w-full overflow-hidden"
            style={{ gridTemplateColumns: '340px 1fr', minHeight: 0 }}
          >
            {/* Left Sidebar: Resilience Drill + Incident Queue */}
            <div className="flex flex-col gap-3.5 overflow-hidden" style={{ minHeight: 0 }}>
              <ChaosPanel
                onChaosSuccess={(result) => {
                  setTimeout(load, 1500);
                  info(
                    'Fault Drill Executed',
                    `${result.events_fired} events fired · triage: ${result.severity?.toUpperCase() ?? '—'}`
                  );
                }}
                onError={(title, msg) => toastError(title, msg)}
              />

              <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                <IncidentList
                  incidents={incidents}
                  loading={loadingIncidents}
                  filter={filter}
                  onFilterChange={handleFilterChange}
                  selectedId={selected?.id ?? null}
                  onSelect={handleSelectIncident}
                />
              </div>
            </div>

            {/* Right Main Area: Incident Detail or Welcome Panel */}
            <div className="overflow-hidden" style={{ minHeight: 0 }}>
              {selected ? (
                <IncidentDetail
                  incident={selected}
                  onClose={() => setSelected(null)}
                  onUpdate={load}
                  onReplySimulated={handleReplySimulated}
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
        )}
      </main>

      {/* Dialog Modals */}
      <AiInspectorModal isOpen={showAiInspector} onClose={() => setShowAiInspector(false)} />
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
