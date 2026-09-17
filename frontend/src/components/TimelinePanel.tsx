import React, { useState, useEffect } from 'react';
import { TimelineEntry } from '../types';
import { fetchTimeline } from '../api';
import { Bot, User, Radio, MessageSquare, Send, Mail, Clock } from 'lucide-react';

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
        <div className="skeleton w-6 h-6 rounded-full shrink-0" />
        <div className="w-px flex-1 mt-1 bg-slate-800" />
      </div>
      <div className="pb-4 flex-1">
        <div className="skeleton h-3 w-28 mb-2 rounded" />
        <div className="skeleton h-3 w-full mb-1 rounded" />
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
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="text-center py-6 text-slate-500 font-sans">
        <p className="text-xs font-medium">No cross-channel timeline events logged yet</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Inbound and outbound messages will synchronize here automatically
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5 font-mono">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>Incident Timeline &amp; Escalation Log</span>
      </div>

      {entries.map((entry, idx) => {
        const isSystem = entry.sender === 'system' || entry.sender === 'sentinel-agent';
        const isLast = idx === entries.length - 1;

        return (
          <div
            key={entry.id}
            className="flex gap-3 animate-fadeIn"
          >
            {/* Avatar node + line */}
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                isSystem
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
              }`}>
                {isSystem ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
              </div>
              {!isLast && <div className="w-px flex-1 my-1 bg-[#1F2937]" />}
            </div>

            {/* Content card */}
            <div className="pb-3 flex-1 min-w-0">
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937] space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-200">
                      {isSystem ? 'Sentinel Autonomous Commander' : entry.sender}
                    </span>
                    <span className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-black/40 border border-[#1F2937] font-mono capitalize">
                      {entry.channel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {entry.intent_parsed && (
                      <IntentPill intent={entry.intent_parsed} />
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatTime(entry.created_at)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                  {entry.message}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
