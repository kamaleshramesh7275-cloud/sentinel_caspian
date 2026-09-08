import React, { useState, useEffect, useCallback } from 'react';
import { Incident, TimelineEntry, ChaosResponse } from './types';
import { fetchIncidents, fetchTimeline, triggerChaos, fetchHealth, getWebSocketUrl, executeRemediation } from './api';
import './index.css';

// ── Utility helpers ────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const delta = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (delta < 60) return `${Math.floor(delta)}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

const SEV_EMOJI: Record<string, string> = {
  low: '🟡', medium: '🟠', high: '🔴', critical: '🚨',
};

const CHANNEL_ICON: Record<string, string> = {
  slack: '💬', telegram: '✈️', email: '📧', system: '🤖', unknown: '❓',
};

// ── Components ─────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string | null }) {
  const sev = severity || 'unknown';
  return (
    <span className={`badge-${sev} px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider`}>
      {SEV_EMOJI[sev] || '⚠️'} {sev}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    open: 'status-open',
    escalated: 'status-escalated',
    ack: 'status-ack',
    resolved: 'status-resolved',
  };
  return (
    <span className={`${classMap[status] || ''} text-xs font-mono font-semibold uppercase tracking-widest`}>
      {status === 'open' && '● OPEN'}
      {status === 'escalated' && '▲ ESCALATED'}
      {status === 'ack' && '✓ ACK'}
      {status === 'resolved' && '✔ RESOLVED'}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const icon = CHANNEL_ICON[channel] || '❓';
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded"
      style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
      {icon} {channel}
    </span>
  );
}

function StatCard({ label, value, sub, glow }: { label: string; value: number | string; sub?: string; glow?: string }) {
  return (
    <div className="panel p-5" style={glow ? { boxShadow: `0 0 25px ${glow}` } : {}}>
      <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-4xl font-mono font-bold mt-2" style={{ color: 'var(--cyan)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  );
}

function IncidentCard({ incident, onClick, selected }: {
  incident: Incident; onClick: () => void; selected: boolean;
}) {
  const sev = incident.severity || 'unknown';
  return (
    <div
      className={`incident-card sev-${sev} ${selected ? 'glow-cyan' : ''}`}
      onClick={onClick}
      style={selected ? { borderColor: 'rgba(0,212,255,0.5)', background: 'var(--bg-elevated)' } : {}}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {incident.title}
          </p>
          <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {incident.id.slice(0, 8)} · {timeAgo(incident.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <SeverityBadge severity={incident.severity} />
          <StatusDot status={incident.status} />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {incident.current_channel && <ChannelBadge channel={incident.current_channel} />}
        {incident.escalation_count > 0 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', color: 'var(--orange)' }}>
            ⏫ ×{incident.escalation_count}
          </span>
        )}
      </div>

      {incident.agent_reasoning && (
        <div className="mt-3 p-2 rounded text-xs font-mono"
          style={{ background: 'rgba(0,212,255,0.04)', borderLeft: '2px solid rgba(0,212,255,0.3)', color: 'var(--text-secondary)' }}>
          🤖 {incident.agent_reasoning.slice(0, 120)}…
        </div>
      )}
    </div>
  );
}

function TimelinePanel({ incidentId }: { incidentId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTimeline(incidentId)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [incidentId]);

  if (loading) return (
    <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-muted)' }}>
      <span className="font-mono text-sm animate-pulse">Loading timeline...</span>
    </div>
  );

  if (!entries.length) return (
    <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
      <p className="font-mono text-sm">No thread context yet</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const icon = CHANNEL_ICON[entry.channel] || '❓';
        const isSystem = entry.sender === 'system' || entry.sender === 'sentinel-agent';
        return (
          <div key={entry.id} className="flex gap-3 group"
            style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{
                  background: isSystem ? 'rgba(124,58,237,0.2)' : 'rgba(0,212,255,0.1)',
                  border: `1px solid ${isSystem ? 'rgba(124,58,237,0.4)' : 'rgba(0,212,255,0.2)'}`,
                }}>
                {isSystem ? '🤖' : icon}
              </div>
              <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)' }} />
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-semibold" style={{
                  color: isSystem ? 'var(--violet-light)' : 'var(--cyan)',
                }}>
                  {entry.sender}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {formatTime(entry.created_at)}
                </span>
                {entry.intent_parsed && (
                  <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'rgba(0,212,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {entry.intent_parsed}
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {entry.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChaosPanel({ onChaosSuccess }: { onChaosSuccess: (result: ChaosResponse) => void }) {
  const [firing, setFiring] = useState(false);
  const [result, setResult] = useState<ChaosResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fire = async () => {
    setFiring(true);
    setError(null);
    setResult(null);
    try {
      const resp = await triggerChaos();
      setResult(resp);
      onChaosSuccess(resp);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFiring(false);
    }
  };

  return (
    <div className="panel p-6" style={{ borderColor: 'rgba(255,56,96,0.3)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--red)', boxShadow: '0 0 8px var(--red)', animation: 'pulse-critical 2s infinite' }} />
        <h3 className="font-mono font-semibold text-sm uppercase tracking-widest" style={{ color: 'var(--red)' }}>
          Demo Chaos Mode
        </h3>
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Fire a synthetic 3-event burst with matching error signatures to trigger
        Sentinel's clustering detection and severity override logic live.
      </p>
      <button className="btn-chaos w-full" onClick={fire} disabled={firing}>
        {firing ? '⚡ Firing events...' : '🔥 Trigger Chaos Burst'}
      </button>

      {result && (
        <div className="mt-4 p-4 rounded" style={{
          background: 'rgba(255,56,96,0.05)',
          border: '1px solid rgba(255,56,96,0.2)',
          animation: 'slide-in 0.3s ease',
        }}>
          <p className="text-xs font-mono font-bold mb-2" style={{ color: 'var(--red)' }}>
            ⚡ {result.events_fired} events fired · severity → {result.severity?.toUpperCase()}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--orange)' }}>{result.message}</p>
          {result.agent_reasoning && (
            <div className="p-3 rounded text-xs font-mono" style={{
              background: 'rgba(0,0,0,0.3)',
              borderLeft: '2px solid var(--violet-light)',
              color: 'var(--text-secondary)',
            }}>
              <p className="font-bold mb-1" style={{ color: 'var(--violet-light)' }}>🤖 Agent Reasoning:</p>
              <p style={{ lineHeight: '1.6' }}>{result.agent_reasoning}</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded text-xs font-mono" style={{
          background: 'rgba(255,56,96,0.08)',
          border: '1px solid rgba(255,56,96,0.3)',
          color: 'var(--red)',
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [channels, setChannels] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchIncidents(filter || undefined);
      setIncidents(data.incidents);
      setTotal(data.total);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
  }, [filter]);

  useEffect(() => {
    load();
    fetchHealth().then(h => setChannels(h.channels_available)).catch(() => {});
    const interval = setInterval(load, 10000); // fallback polling every 10s

    // Real-time WebSocket connection
    let socket: WebSocket | null = null;
    try {
      const wsUrl = getWebSocketUrl();
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type) {
            load();
          }
        } catch (err) {
          console.debug('WS parse error:', err);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
      };

      socket.onerror = () => {
        setWsConnected(false);
      };
    } catch (e) {
      console.debug('WS init error:', e);
    }

    return () => {
      clearInterval(interval);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [load]);

  const stats = {
    total: incidents.length,
    active: incidents.filter(i => ['open', 'escalated'].includes(i.status)).length,
    critical: incidents.filter(i => i.severity === 'critical').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  return (
    <div className="relative z-10 min-h-screen">

      {/* Header */}
      <header className="scanline relative px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, var(--cyan), var(--violet))' }}>
              🛡️
            </div>
            <div>
              <h1 className="gradient-text text-xl font-bold font-mono leading-none">SENTINEL</h1>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Autonomous Incident Commander</p>
            </div>
          </div>

          {/* Channel indicators */}
          {channels.length > 0 && (
            <div className="flex gap-2 ml-4">
              {channels.map(ch => (
                <span key={ch} className="text-xs font-mono px-2 py-0.5 rounded flex items-center gap-1"
                  style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', color: 'var(--green)' }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--green)' }} />
                  {ch}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className={`text-xs font-mono px-2 py-0.5 rounded flex items-center gap-1.5 ${
            wsConnected 
              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' 
              : 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
          }`}>
            <span className={`w-2 h-2 rounded-full inline-block ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {wsConnected ? 'LIVE STREAM' : 'POLLING'}
          </span>

          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            ⟳ {formatTime(lastRefresh.toISOString())}
          </p>
        </div>
      </header>

      <div className="p-6 max-w-screen-2xl mx-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Incidents" value={total} sub="all time" />
          <StatCard label="Active" value={stats.active} sub="open + escalated"
            glow={stats.active > 0 ? 'rgba(255,153,0,0.15)' : undefined} />
          <StatCard label="Critical" value={stats.critical} sub="need immediate action"
            glow={stats.critical > 0 ? 'rgba(139,0,0,0.2)' : undefined} />
          <StatCard label="Resolved" value={stats.resolved} sub="with postmortems" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Incident List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Chaos Panel */}
            <ChaosPanel onChaosSuccess={() => setTimeout(load, 1500)} />

            {/* Filter */}
            <div className="panel p-4">
              <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Filter Incidents
              </p>
              <div className="flex flex-wrap gap-2">
                {['', 'open', 'escalated', 'ack', 'resolved'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs font-mono px-3 py-1 rounded transition-all ${filter === f
                      ? 'text-white'
                      : ''
                    }`}
                    style={{
                      background: filter === f
                        ? 'linear-gradient(135deg, var(--cyan), var(--violet))'
                        : 'rgba(0,212,255,0.05)',
                      border: `1px solid ${filter === f ? 'transparent' : 'var(--border)'}`,
                      color: filter === f ? 'white' : 'var(--text-secondary)',
                    }}>
                    {f || 'ALL'}
                  </button>
                ))}
              </div>
            </div>

            {/* Incident cards */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {incidents.length === 0 && (
                <div className="panel p-8 text-center">
                  <p className="text-4xl mb-3">🛡️</p>
                  <p className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>No incidents</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>System nominal</p>
                </div>
              )}
              {incidents.map(i => (
                <IncidentCard
                  key={i.id}
                  incident={i}
                  onClick={() => setSelected(selected?.id === i.id ? null : i)}
                  selected={selected?.id === i.id}
                />
              ))}
            </div>
          </div>

          {/* Right: Detail Panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="panel p-6 space-y-6">
                {/* Incident header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <SeverityBadge severity={selected.severity} />
                      <StatusDot status={selected.status} />
                    </div>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {selected.title}
                    </h2>
                    <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                      ID: {selected.id}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="text-xs font-mono px-3 py-1 rounded"
                    style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    ✕ Close
                  </button>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Channel', value: selected.current_channel || '—', icon: CHANNEL_ICON[selected.current_channel || ''] || '❓' },
                    { label: 'Escalations', value: `×${selected.escalation_count}`, icon: '⏫' },
                    { label: 'Created', value: timeAgo(selected.created_at), icon: '🕐' },
                    { label: 'Last Notified', value: timeAgo(selected.last_notified_at), icon: '🔔' },
                    selected.resolved_at && { label: 'Resolved', value: timeAgo(selected.resolved_at), icon: '✅' },
                  ].filter(Boolean).map((item: any) => (
                    <div key={item.label} className="rounded p-3"
                      style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid var(--border)' }}>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{item.icon} {item.label}</p>
                      <p className="text-sm font-mono font-semibold mt-1" style={{ color: 'var(--cyan)' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Agent Reasoning & Suggested Runbook */}
                {selected.agent_reasoning && (
                  <div className="rounded p-4"
                    style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <p className="text-xs font-mono font-bold mb-2" style={{ color: 'var(--violet-light)' }}>
                      🤖 AI Agent Reasoning & RAG Runbook Analysis
                    </p>
                    <p className="text-sm font-mono whitespace-pre-line" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                      {selected.agent_reasoning}
                    </p>
                  </div>
                )}

                {/* Auto-Remediation Panel */}
                {selected.status !== 'resolved' && (
                  <div className="rounded p-4" style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.25)' }}>
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div>
                        <p className="text-xs font-mono font-bold" style={{ color: 'var(--green)' }}>
                          ⚡ Autonomous Auto-Remediation
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          Execute safe automated mitigations (restart service, drain connection pool, flush cache).
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const action = selected.agent_reasoning?.includes('drain_db') 
                              ? 'drain_db_connections'
                              : selected.agent_reasoning?.includes('flush_cache') 
                              ? 'flush_cache' 
                              : selected.agent_reasoning?.includes('scale_replicas')
                              ? 'scale_replicas'
                              : 'restart_service';
                            await executeRemediation(selected.id, action);
                            load();
                          } catch (err: any) {
                            alert('Remediation error: ' + err.message);
                          }
                        }}
                        className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider text-black transition-all hover:opacity-90 cursor-pointer shadow-lg"
                        style={{ background: 'var(--green)', boxShadow: '0 0 12px rgba(0,229,160,0.4)' }}>
                        ⚡ Execute Auto-Fix
                      </button>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <p className="text-xs font-mono font-semibold uppercase tracking-widest mb-4"
                    style={{ color: 'var(--text-muted)' }}>
                    📋 Cross-Channel Timeline
                  </p>
                  <div className="max-h-[50vh] overflow-y-auto pr-2">
                    <TimelinePanel incidentId={selected.id} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="panel p-12 flex flex-col items-center justify-center h-full"
                style={{ minHeight: '500px' }}>
                <div className="text-6xl mb-6">🛡️</div>
                <h3 className="gradient-text text-2xl font-bold font-mono mb-3">Sentinel</h3>
                <p className="text-center text-sm max-w-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                  It doesn't just tell you what's happening.<br />
                  It decides <em>who</em> needs to know, <em>how urgently</em>,<br />
                  and follows up until it's resolved.
                </p>
                <p className="text-xs font-mono mt-6" style={{ color: 'var(--text-muted)' }}>
                  Select an incident or fire a chaos burst →
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
