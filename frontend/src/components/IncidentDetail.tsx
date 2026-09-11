import React, { useState } from 'react';
import { Incident } from '../types';
import { timeAgo, SeverityBadge, StatusDot } from './IncidentCard';
import { TimelinePanel } from './TimelinePanel';
import { EngineerReplySimulator } from './EngineerReplySimulator';
import { executeRemediation } from '../api';

interface MetaItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetaItem({ icon, label, value }: MetaItemProps) {
  return (
    <div className="rounded-lg p-3 flex flex-col gap-1 bg-[#151C2C] border border-[#1E2738]">
      <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-100 truncate">
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
  timelineKey: number;
}

export function IncidentDetail({
  incident,
  onClose,
  onUpdate,
  onReplySimulated,
  onError,
  onSuccess,
  timelineKey,
}: Props) {
  const [remediating, setRemediating] = useState(false);

  const handleRemediate = async () => {
    setRemediating(true);
    try {
      const action = incident.agent_reasoning?.includes('drain_db')
        ? 'drain_db_connections'
        : incident.agent_reasoning?.includes('flush_cache')
        ? 'flush_cache'
        : incident.agent_reasoning?.includes('scale_replicas')
        ? 'scale_replicas'
        : 'restart_service';

      await executeRemediation(incident.id, action);
      onSuccess('Mitigation executed', `Action: ${action.replace(/_/g, ' ')}`);
      onUpdate();
    } catch (err: any) {
      onError('Remediation failed', err.message);
    } finally {
      setRemediating(false);
    }
  };

  const metaItems: MetaItemProps[] = [
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      ),
      label: 'Channel',
      value: incident.current_channel ? incident.current_channel.toUpperCase() : '—',
    },
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
          <path d="M12 2v20" />
          <path d="m17 5-5-3-5 3" />
        </svg>
      ),
      label: 'Escalations',
      value: `Level ${incident.escalation_count}`,
    },
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      label: 'Created',
      value: timeAgo(incident.created_at),
    },
    {
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      label: 'Last Paged',
      value: timeAgo(incident.last_notified_at),
    },
    ...(incident.resolved_at
      ? [
          {
            icon: (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ),
            label: 'Resolved',
            value: timeAgo(incident.resolved_at),
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-xl bg-[#111622] border border-[#1E2738] p-6 flex flex-col gap-5 overflow-y-auto h-full shadow-sm">
      {/* Incident Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1E2738]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <SeverityBadge severity={incident.severity} />
            <StatusDot status={incident.status} />
          </div>
          <h2 className="text-lg font-semibold leading-snug text-white">
            {incident.title}
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Incident ID: {incident.id}
          </p>
        </div>

        <button
          onClick={onClose}
          aria-label="Close incident detail"
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1E2738] transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {metaItems.map((item) => (
          <MetaItem key={item.label} {...item} />
        ))}
      </div>

      {/* Agent Reasoning & Runbook Synthesis */}
      {incident.agent_reasoning && (
        <div className="rounded-xl p-4 bg-[#141824] border border-purple-500/20">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                </svg>
              </div>
              <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wide">
                Caspian AI Commander Analysis &amp; Runbook Assessment
              </h4>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(incident.agent_reasoning ?? '');
                onSuccess('Copied to clipboard');
              }}
              className="text-xs font-medium px-2 py-1 rounded bg-[#1E2738] hover:bg-[#283347] text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Copy analysis"
            >
              Copy
            </button>
          </div>

          <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono bg-[#0B0E14] p-3 rounded-lg border border-[#1E2738]">
            {incident.agent_reasoning}
          </p>
        </div>
      )}

      {/* Autonomous Mitigation Action */}
      {incident.status !== 'resolved' && (
        <div className="rounded-xl p-4 bg-[#121927] border border-blue-500/25">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wide flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Autonomous Remediation Playbook
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Trigger safe automated mitigation according to the matched SRE runbook (e.g. drain database connection pool, scale replicas, flush cache).
              </p>
            </div>

            <button
              id="remediate-btn"
              onClick={handleRemediate}
              disabled={remediating}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-sm shrink-0 disabled:opacity-50"
            >
              {remediating ? 'Executing…' : 'Execute Remediation'}
            </button>
          </div>
        </div>
      )}

      {/* Bi-Directional Engineer Reply Simulator */}
      {incident.status !== 'resolved' && (
        <EngineerReplySimulator
          incidentId={incident.id}
          incidentStatus={incident.status}
          onReplySimulated={onReplySimulated}
        />
      )}

      {/* Incident Audit Trail / Timeline */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Cross-Channel Incident Audit Trail
          </h4>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '42vh' }}>
          <TimelinePanel
            key={`${incident.id}-${timelineKey}`}
            incidentId={incident.id}
          />
        </div>
      </div>
    </div>
  );
}
