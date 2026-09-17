import React from 'react';
import { Incident } from '../types';
import { Clock, Radio, MessageSquare, Send, Mail, AlertTriangle, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

// ── Utility helpers ───────────────────────────────────────────────────────────
export function timeAgo(dateStr: string): string {
  if (!dateStr) return 'just now';
  const delta = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (delta < 60) return `${Math.max(1, Math.floor(delta))}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

// ── Severity Badge ────────────────────────────────────────────────────────────
export function SeverityBadge({ severity }: { severity: string | null }) {
  const sev = (severity || 'unknown').toLowerCase();
  
  const configMap: Record<string, { label: string; className: string; icon: any }> = {
    critical: {
      label: 'SEV-1 Critical',
      className: 'badge-critical',
      icon: ShieldAlert,
    },
    high: {
      label: 'SEV-2 High',
      className: 'badge-high',
      icon: AlertTriangle,
    },
    medium: {
      label: 'SEV-3 Medium',
      className: 'badge-medium',
      icon: AlertTriangle,
    },
    low: {
      label: 'SEV-4 Low',
      className: 'badge-low',
      icon: CheckCircle2,
    },
    unknown: {
      label: 'SEV-TBD',
      className: 'bg-slate-800 text-slate-400 border-slate-700',
      icon: AlertTriangle,
    },
  };

  const current = configMap[sev] || configMap.unknown;
  const IconComponent = current.icon;

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide border inline-flex items-center gap-1 ${current.className}`}>
      <IconComponent className="w-3 h-3" />
      <span>{current.label}</span>
    </span>
  );
}

// ── Status Dot ────────────────────────────────────────────────────────────────
export function StatusDot({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; dot: string; text: string }> = {
    open: { label: 'Open (Paging)', dot: 'bg-blue-400', text: 'text-blue-400' },
    escalated: { label: 'Escalated', dot: 'bg-amber-400', text: 'text-amber-400' },
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

function ChannelIcon({ channel }: { channel: string }) {
  const c = channel.toLowerCase();
  if (c.includes('slack')) return <MessageSquare className="w-3 h-3 text-slate-400" />;
  if (c.includes('telegram')) return <Send className="w-3 h-3 text-slate-400" />;
  if (c.includes('email')) return <Mail className="w-3 h-3 text-slate-400" />;
  return <Radio className="w-3 h-3 text-slate-400" />;
}

// ── IncidentCard ──────────────────────────────────────────────────────────────
interface Props {
  incident: Incident;
  onClick: () => void;
  selected: boolean;
}

export function IncidentCard({ incident, onClick, selected }: Props) {
  const hasOverride = incident.agent_reasoning?.includes('CLUSTERING OVERRIDE') || incident.escalation_count > 0;

  return (
    <div
      id={`incident-card-${incident.id}`}
      className={`incident-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`Incident: ${incident.title}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Top row: Title + Severity */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-medium text-slate-500">
              #INC-{incident.id.slice(0, 8)}
            </span>
            <span className="text-slate-700">·</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {timeAgo(incident.created_at)}
            </span>
          </div>
          <h4 className="font-semibold text-xs leading-snug text-slate-200 hover:text-white transition-colors truncate">
            {incident.title}
          </h4>
        </div>
        <SeverityBadge severity={incident.severity} />
      </div>

      {/* Reasoning Snippet */}
      {incident.agent_reasoning && (
        <p className="text-[11px] text-slate-400 mt-2 line-clamp-1 leading-relaxed font-sans">
          {incident.agent_reasoning}
        </p>
      )}

      {/* Bottom row: Status + Channel Metadata */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#1F2937]/60">
        <StatusDot status={incident.status} />

        <div className="flex items-center gap-2">
          {hasOverride && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
              Clustered (+1)
            </span>
          )}

          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <ChannelIcon channel={incident.current_channel || 'slack'} />
            <span className="capitalize">{incident.current_channel || 'slack'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
