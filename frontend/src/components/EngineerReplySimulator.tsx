import React, { useState } from 'react';
import { simulateReply } from '../api';
import { SimulateReplyResult } from '../types';
import { MessageSquare, Send, CheckCircle2, Search, CornerDownLeft, AlertCircle } from 'lucide-react';

interface Props {
  incidentId: string;
  incidentStatus: string;
  onReplySimulated: () => void;
}

export function EngineerReplySimulator({ incidentId, incidentStatus, onReplySimulated }: Props) {
  const [message, setMessage] = useState('');
  const [sender, setSender] = useState('Alex (Lead SRE)');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SimulateReplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    {
      label: 'Acknowledge',
      text: 'Acknowledged, on it now. Checking metrics.',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
    },
    {
      label: 'Investigating',
      text: 'Investigating now, looks like DB connection pool is maxed out. Draining stale connections.',
      color: 'bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20',
    },
    {
      label: 'Mark Resolved',
      text: 'Root cause identified as bad canary deploy. Rolled back and verified metrics green. Resolved.',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
    },
    {
      label: 'Ambiguous Query',
      text: 'Hey who triggered this alert? Is this still an issue?',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
    },
  ];

  const handleSend = async (textToSend?: string) => {
    const msg = (textToSend || message).trim();
    if (!msg) return;

    setLoading(true);
    setError(null);
    try {
      const res = await simulateReply(incidentId, msg, sender, 'evaluator-simulator');
      setLastResult(res);
      setMessage('');
      onReplySimulated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-4 bg-[#111827] border border-[#1F2937] space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            Bi-Directional ChatOps Responder Bridge
          </h4>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          Slack / Telegram / PagerDuty Inbound
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-normal">
        Simulate an on-call engineer responding to paging alerts. Sentinel parses conversational intent, updates the incident lifecycle state, and commits postmortems upon resolution.
      </p>

      {/* Preset quick replies */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-slate-400 block font-mono">
          Quick Response Scenarios:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => {
                setMessage(p.text);
                handleSend(p.text);
              }}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium transition cursor-pointer disabled:opacity-50 ${p.color}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input box */}
      <div className="space-y-2 pt-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="Responder Name"
            className="w-1/3 text-xs px-3 py-1.5 rounded-md bg-[#0B0F19] border border-[#1F2937] text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type responder reply (e.g. 'Looking into DB locks now')..."
              className="w-full text-xs px-3 py-1.5 pr-8 rounded-md bg-[#0B0F19] border border-[#1F2937] text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <button
              disabled={loading || !message.trim()}
              onClick={() => handleSend()}
              className="absolute right-1.5 top-1.5 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-1 text-xs text-red-400 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Intent Feedback */}
        {lastResult && (
          <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between font-mono animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Intent: <strong>{lastResult.intent.toUpperCase()}</strong> · Action: <strong>{lastResult.action_taken.toUpperCase()}</strong>
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Escalations Suppressed</span>
          </div>
        )}
      </div>
    </div>
  );
}
