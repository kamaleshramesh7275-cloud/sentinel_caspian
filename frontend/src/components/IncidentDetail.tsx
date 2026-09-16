import React, { useState } from 'react';
import { Incident } from '../types';
import { timeAgo, SeverityBadge, StatusDot } from './IncidentCard';
import { TimelinePanel } from './TimelinePanel';
import { EngineerReplySimulator } from './EngineerReplySimulator';
import { executeRemediation, generateIncidentPatch, commitIncidentPatch } from '../api';

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

  // Autonomous Code Patch state
  const [patchGenerating, setPatchGenerating] = useState(false);
  const [patchData, setPatchData] = useState<any | null>(null);
  const [patchCommitting, setPatchCommitting] = useState(false);
  const [committedPatchUrl, setCommittedPatchUrl] = useState<string | null>(null);

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

      {/* Autonomous Code Patch Agent (7B Coder) */}
      <div className="rounded-xl p-4 bg-[#141828] border border-purple-500/30 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
              <span>🛠️</span> Autonomous Code Patch Agent (Fine-Tuned 7B Coder)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspects stack traces, analyzes failure mechanics, and synthesizes a unified git diff patch to commit to GitHub.
            </p>
          </div>

          <button
            onClick={handleGeneratePatch}
            disabled={patchGenerating}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors cursor-pointer shrink-0 disabled:opacity-50 shadow-sm"
          >
            {patchGenerating ? 'Synthesizing Patch...' : patchData ? '↻ Re-Generate Patch' : '⚡ Generate Code Patch'}
          </button>
        </div>

        {/* Patch Result & Diff Viewer */}
        {patchData && (
          <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-purple-500/40 space-y-3 text-xs animate-fadeIn font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Target File:</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 font-bold">
                  {patchData.target_file}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Confidence:</span>
                <span className="text-emerald-400 font-bold">
                  {Math.round((patchData.confidence_score || 0.9) * 100)}%
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 bg-[#111622] p-2.5 rounded border border-[#1E2738]">
              <span className="text-purple-300 font-semibold block mb-0.5">Defect Analysis:</span>
              <p className="text-slate-300">{patchData.root_cause || patchData.fault_summary}</p>
            </div>

            {/* Git Diff Block */}
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider block">Unified Git Diff</span>
              <pre className="p-3 rounded-lg bg-[#070A0F] border border-slate-800 text-[11px] text-slate-300 overflow-x-auto leading-relaxed whitespace-pre font-mono">
                {patchData.git_diff.split('\n').map((line: string, i: number) => {
                  let colorClass = 'text-slate-300';
                  if (line.startsWith('+') && !line.startsWith('+++')) colorClass = 'text-emerald-400 bg-emerald-950/30';
                  else if (line.startsWith('-') && !line.startsWith('---')) colorClass = 'text-red-400 bg-red-950/30';
                  else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) colorClass = 'text-cyan-400 font-bold';
                  return (
                    <div key={i} className={`px-1 rounded ${colorClass}`}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>

            {/* Regression Test Suggestions */}
            {patchData.regression_tests?.length > 0 && (
              <div className="text-[11px]">
                <span className="text-amber-300 font-semibold block mb-1">Recommended Regression Tests:</span>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                  {patchData.regression_tests.map((t: string, idx: number) => (
                    <li key={idx} className="truncate">{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Commit to GitHub Action */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              {committedPatchUrl ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <span>✅</span>
                  <a
                    href={committedPatchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline underline-offset-2 break-all text-xs"
                  >
                    View Patch on GitHub ↗
                  </a>
                </div>
              ) : (
                <p className="text-slate-500 text-[11px]">Patch is ready for repository commit</p>
              )}

              <button
                onClick={handleCommitPatch}
                disabled={patchCommitting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5"
              >
                {patchCommitting ? 'Committing to GitHub...' : '🚀 Commit Patch to GitHub'}
              </button>
            </div>
          </div>
        )}
      </div>

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
