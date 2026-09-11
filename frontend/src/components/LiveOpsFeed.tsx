import React, { useState, useMemo } from 'react';
import { ActivityEvent, ActivityCategory } from '../types';

interface Props {
  activities: ActivityEvent[];
  loading: boolean;
  onRefresh: () => void;
  onSelectIncident?: (incidentId: string) => void;
  selectedIncidentId?: string | null;
  onClearIncidentFilter?: () => void;
}

// Crisp inline SVGs for channel and system brands
const ChannelIcons: Record<string, React.ReactNode> = {
  all: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  slack: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  ),
  telegram: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  email: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  llm: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  ),
  github: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  ),
  remediation: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  system: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

const CATEGORY_CONFIG: Record<
  ActivityCategory,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  all: {
    label: 'All Channels',
    color: '#60A5FA',
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.3)',
    desc: 'Unified stream of all communications and AI decisions',
  },
  slack: {
    label: 'Slack',
    color: '#EAB308',
    bg: 'rgba(234, 179, 8, 0.1)',
    border: 'rgba(234, 179, 8, 0.3)',
    desc: 'Inbound threads, bot alerts, and engineer reactions',
  },
  telegram: {
    label: 'Telegram',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.1)',
    border: 'rgba(56, 189, 248, 0.3)',
    desc: 'Escalation pings and instant SRE command replies',
  },
  email: {
    label: 'Email / Resend',
    color: '#FB923C',
    bg: 'rgba(251, 146, 60, 0.1)',
    border: 'rgba(251, 146, 60, 0.3)',
    desc: 'Formal incident reports & quota-saver simulations',
  },
  llm: {
    label: 'Gemini LLM',
    color: '#C084FC',
    bg: 'rgba(192, 132, 252, 0.1)',
    border: 'rgba(192, 132, 252, 0.3)',
    desc: 'Autonomous severity triage, intent reasoning & synthesis',
  },
  github: {
    label: 'GitHub CI/CD',
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.1)',
    border: 'rgba(52, 211, 153, 0.3)',
    desc: 'Automated postmortem commits & branch updates',
  },
  remediation: {
    label: 'Auto-Remediation',
    color: '#22D3EE',
    bg: 'rgba(34, 211, 238, 0.1)',
    border: 'rgba(34, 211, 238, 0.3)',
    desc: 'Automated remediation runs, rollbacks & restarts',
  },
  system: {
    label: 'Operations',
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.1)',
    border: 'rgba(148, 163, 184, 0.3)',
    desc: 'Incident declarations and system lifecycle triggers',
  },
};

const SEVERITY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: '#F87171', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' },
  high: { text: '#FBBF24', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
  medium: { text: '#FDE047', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)' },
  low: { text: '#34D399', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' },
};

function formatRelativeTime(iso: string): string {
  if (!iso) return 'just now';
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 10) return 'just now';
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'recently';
  }
}

export function LiveOpsFeed({
  activities,
  loading,
  onRefresh,
  onSelectIncident,
  selectedIncidentId,
  onClearIncidentFilter,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activities.length };
    activities.forEach((act) => {
      counts[act.category] = (counts[act.category] || 0) + 1;
    });
    return counts;
  }, [activities]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (selectedCategory !== 'all' && act.category !== selectedCategory) {
        return false;
      }
      if (selectedIncidentId && act.incident_id !== selectedIncidentId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = act.title.toLowerCase().includes(q);
        const inSummary = act.summary.toLowerCase().includes(q);
        const inDetails = act.details?.toLowerCase().includes(q);
        const inInc = act.incident_title?.toLowerCase().includes(q);
        const inSender = act.metadata?.sender?.toLowerCase().includes(q);
        if (!inTitle && !inSummary && !inDetails && !inInc && !inSender) {
          return false;
        }
      }
      return true;
    });
  }, [activities, selectedCategory, selectedIncidentId, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#111622] border border-[#1E2738] rounded-xl overflow-hidden shadow-sm">
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-[#1E2738] bg-[#0E131E] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
              <circle cx="12" cy="12" r="2" />
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
              <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Live Operations Telemetry Stream
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                STREAM ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live audit trail of Slack, Telegram, Email, Gemini LLM, GitHub commits, and Automated Remediation
            </p>
          </div>
        </div>

        {/* Right Controls: Filter tag + Search + Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {selectedIncidentId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 font-mono">
              <span>Incident #{selectedIncidentId.slice(0, 8)}</span>
              {onClearIncidentFilter && (
                <button
                  onClick={onClearIncidentFilter}
                  className="hover:text-white font-bold ml-1 cursor-pointer"
                  title="Show all incidents"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Search box */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search feed activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-[#0B0E14] border border-[#1E2738] rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 md:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white bg-[#161C2A] hover:bg-[#1E2738] border border-[#1E2738] rounded-md transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh stream"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Channel Filter Tabs ───────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-[#0B0E14] border-b border-[#1E2738] flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
        {(Object.keys(CATEGORY_CONFIG) as ActivityCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const isSelected = selectedCategory === cat;
          const count = categoryCounts[cat] || 0;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                isSelected
                  ? 'bg-[#1E2738] text-white border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent hover:bg-white/5'
              }`}
            >
              <span className={isSelected ? 'text-blue-400' : 'text-slate-500'}>
                {ChannelIcons[cat] || ChannelIcons.system}
              </span>
              <span>{cfg.label}</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-slate-700 text-white font-bold' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Stream Entries ───────────────────────────────────────────────── */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
        {loading && activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs">Synchronizing telemetry events...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2 border border-dashed border-[#1E2738] rounded-xl p-8">
            <p className="text-sm text-slate-300 font-medium">No activity matching this filter</p>
            <p className="text-xs text-slate-500 text-center max-w-sm">
              Trigger a resilience drill or send an inbound reply from Slack / Telegram to observe live telemetry.
            </p>
            {(selectedCategory !== 'all' || searchQuery || selectedIncidentId) && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  if (onClearIncidentFilter) onClearIncidentFilter();
                }}
                className="mt-2 text-xs text-blue-400 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredActivities.map((act) => {
            const cfg = CATEGORY_CONFIG[act.category] || CATEGORY_CONFIG.system;
            const isExpanded = expandedEventId === act.id;
            const sevConfig = act.severity ? SEVERITY_COLORS[act.severity] : null;

            return (
              <div
                key={act.id}
                className="rounded-lg border bg-[#151C2C] hover:bg-[#182133] border-[#1E2738] transition-colors p-3.5 space-y-2"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category pill */}
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#1A2234] text-slate-300 border border-[#283347]">
                      <span className="text-blue-400">{ChannelIcons[act.category] || ChannelIcons.system}</span>
                      <span>{cfg.label}</span>
                    </span>

                    {/* Incident link badge */}
                    {act.incident_id && (
                      <button
                        onClick={() => onSelectIncident && onSelectIncident(act.incident_id!)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="View incident"
                      >
                        <span>#{act.incident_id.slice(0, 8)}</span>
                        {act.incident_title && (
                          <span className="truncate max-w-[160px] text-slate-400">
                            · {act.incident_title}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Severity pill */}
                    {sevConfig && act.severity && (
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border"
                        style={{
                          background: sevConfig.bg,
                          color: sevConfig.text,
                          borderColor: sevConfig.border,
                        }}
                      >
                        {act.severity}
                      </span>
                    )}
                  </div>

                  {/* Relative timestamp */}
                  <span
                    className="text-xs text-slate-400 shrink-0 font-mono"
                    title={act.timestamp}
                  >
                    {formatRelativeTime(act.timestamp)}
                  </span>
                </div>

                {/* Title & Summary */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 leading-snug">
                    {act.title}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {act.summary}
                  </p>
                </div>

                {/* GitHub postmortem button if present */}
                {act.metadata?.github_url && (
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={act.metadata.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors font-medium"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                        <path d="M9 18c-4.51 2-5-2-7-2" />
                      </svg>
                      <span>View Committed Postmortem on GitHub ↗</span>
                    </a>
                    {act.metadata.branch && (
                      <span className="text-xs text-slate-400 font-mono">
                        branch: <code className="text-slate-300">{act.metadata.branch}</code>
                      </span>
                    )}
                  </div>
                )}

                {/* Footer metadata & toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1E2738] text-xs text-slate-400">
                  <div className="flex items-center gap-3 flex-wrap text-[11px]">
                    {act.metadata?.sender && (
                      <span>Sender: <strong className="text-slate-300">{act.metadata.sender}</strong></span>
                    )}
                    {act.metadata?.model && (
                      <span>Model: <strong className="text-purple-300">{act.metadata.model}</strong></span>
                    )}
                    {act.metadata?.action && (
                      <span>Action: <strong className="text-blue-300">{act.metadata.action}</strong></span>
                    )}
                    {act.metadata?.simulated && (
                      <span className="text-amber-400 font-medium">[Simulated Quota Saver]</span>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedEventId(isExpanded ? null : act.id)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Payload' : 'Inspect Payload'}</span>
                    <span className="text-[9px]">{isExpanded ? '▲' : '▼'}</span>
                  </button>
                </div>

                {/* Payload inspect */}
                {isExpanded && (
                  <div className="mt-2 p-3 bg-[#0B0E14] rounded-lg border border-[#1E2738] text-xs space-y-2 font-mono">
                    {act.details && (
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                          Payload &amp; Run Details
                        </span>
                        <pre className="p-2 bg-[#111622] rounded text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                          {act.details}
                        </pre>
                      </div>
                    )}

                    {act.metadata && Object.keys(act.metadata).length > 0 && (
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                          Metadata JSON
                        </span>
                        <pre className="p-2 bg-[#111622] rounded text-slate-300 whitespace-pre-wrap text-[10px]">
                          {JSON.stringify(act.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
