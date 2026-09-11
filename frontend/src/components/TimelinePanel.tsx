import React, { useState, useEffect } from 'react';
import { TimelineEntry } from '../types';
import { fetchTimeline } from '../api';

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function IntentPill({ intent }: { intent: string }) {
  const norm = intent.toLowerCase();
  const configMap: Record<string, { label: string; className: string }> = {
    ack: { label: 'ACKNOWLEDGED', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    acknowledged: { label: 'ACKNOWLEDGED', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    investigating: { label: 'INVESTIGATING', className: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
    resolved: { label: 'RESOLVED', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    unclear: { label: 'UNCLEAR', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  };

  const current = configMap[norm] || { label: intent.toUpperCase(), className: 'bg-slate-800 text-slate-400 border-slate-700' };

  return (
    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${current.className}`}>
      {current.label}
    </span>
  );
}

function SkeletonEntry() {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="skeleton w-7 h-7 rounded-full shrink-0" />
        <div className="w-px flex-1 mt-1 bg-slate-800" />
      </div>
      <div className="pb-5 flex-1">
        <div className="skeleton h-3 w-32 mb-2 rounded" />
        <div className="skeleton h-3 w-full mb-1 rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
      </div>
    </div>
  );
}

interface Props {
  incidentId: string;
}

export function TimelinePanel({ incidentId }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTimeline(incidentId)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [incidentId]);

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        <SkeletonEntry />
        <SkeletonEntry />
        <SkeletonEntry />
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p className="text-xs font-medium">No cross-channel timeline events logged yet</p>
        <p className="text-[11px] text-slate-600 mt-1">
          Inbound and outbound messages will synchronize here automatically
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, idx) => {
        const isSystem = entry.sender === 'system' || entry.sender === 'sentinel-agent';
        const isLast = idx === entries.length - 1;

        return (
          <div
            key={entry.id}
            className="flex gap-3 animate-fadeIn"
          >
            {/* Avatar node + connecting line */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 border ${
                isSystem
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
              }`}>
                {isSystem ? 'AI' : entry.channel.slice(0, 3).toUpperCase()}
              </div>
              {!isLast && (
                <div className="w-px flex-1 mt-1 bg-[#1E2738] min-h-[16px]" />
              )}
            </div>

            {/* Event details */}
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-semibold ${isSystem ? 'text-purple-300' : 'text-slate-200'}`}>
                  {entry.sender}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {formatTime(entry.created_at)}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 capitalize">
                  {entry.channel}
                </span>
                {entry.intent_parsed && <IntentPill intent={entry.intent_parsed} />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal bg-[#0B0E14] p-2.5 rounded-lg border border-[#1E2738]">
                {entry.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
