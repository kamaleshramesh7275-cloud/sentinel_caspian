import React from 'react';
import { Incident } from '../types';

// ── Utility helpers ───────────────────────────────────────────────────────────
export function timeAgo(dateStr: string): string {
  if (!dateStr) return 'just now';
  const delta = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (delta < 60) return `${Math.max(1, Math.floor(delta))}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
export function SeverityBadge({ severity }: { severity: string | null }) {
  const sev = (severity || 'unknown').toLowerCase();
  
  const configMap: Record<string, { label: string; className: string }> = {
    critical: {
      label: 'SEV-0 Critical',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
    },
    high: {
      label: 'SEV-1 High',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    medium: {
      label: 'SEV-2 Medium',
      className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    },
    low: {
      label: 'SEV-3 Low',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    unknown: {
      label: 'SEV-TBD',
      className: 'bg-slate-800 text-slate-400 border-slate-700',
    },
  };

  const current = configMap[sev] || configMap.unknown;

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border inline-flex items-center gap-1 ${current.className}`}>
      {current.label}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; dot: string; text: string }> = {
    open: { label: 'Open', dot: 'bg-blue-400', text: 'text-blue-400' },
    escalated: { label: 'Escalated', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400' },
    ack: { label: 'Acknowledged', dot: 'bg-purple-400', text: 'text-purple-300' },
    resolved: { label: 'Resolved', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  };

  const curr = statusMap[status.toLowerCase()] || { label: status, dot: 'bg-slate-400', text: 'text-slate-400' };

  return (
    <span className={`text-[11px] font-medium inline-flex items-center gap-1.5 ${curr.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${curr.dot}`} />
      <span>{curr.label}</span>
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded bg-[#1A2234] border border-[#283347] text-slate-300 capitalize font-medium">
      {channel}
    </span>
  );
}

// ── IncidentCard ──────────────────────────────────────────────────────────────
interface Props {
  incident: Incident;
  onClick: () => void;
  selected: boolean;
}

export function IncidentCard({ incident, onClick, selected }: Props) {
  const sev = incident.severity || 'unknown';

  return (
    <div
      id={`incident-card-${incident.id}`}
      className={`incident-card sev-${sev} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`Incident: ${incident.title}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Top row: Title + Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-snug text-slate-100 hover:text-white transition-colors">
            {incident.title}
          </h4>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
            <span className="font-mono text-[11px] text-slate-400">
              #{incident.id.slice(0, 8)}
            </span>
            <span>·</span>
            <span>{timeAgo(incident.created_at)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <SeverityBadge severity={incident.severity} />
          <StatusDot status={incident.status} />
        </div>
      </div>

      {/* Meta tags */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {incident.current_channel && <ChannelBadge channel={incident.current_channel} />}
        {incident.escalation_count > 0 && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
            Escalation #{incident.escalation_count}
          </span>
        )}
      </div>

      {/* Autonomous reasoning snippet */}
      {incident.agent_reasoning && (
        <div className="mt-2.5 p-2 rounded-md bg-[#0E131E] border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
          <span className="text-purple-400 font-medium mr-1">Caspian AI:</span>
          {incident.agent_reasoning.length > 115
            ? incident.agent_reasoning.slice(0, 115) + '…'
            : incident.agent_reasoning}
        </div>
      )}
    </div>
  );
}
