import React, { useState } from 'react';
import { simulateReply } from '../api';
import { SimulateReplyResult } from '../types';

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
    <div className="rounded-xl p-4 bg-[#111622] border border-[#1E2738] space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            Bi-Directional Chat &amp; Intent Simulator
          </h4>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          Slack / Telegram Inbound
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-normal">
        Simulate an on-call engineer responding to paging alerts. Sentinel parses conversational intent, updates the incident lifecycle state, and commits postmortems upon resolution.
      </p>

      {/* Preset quick replies */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-slate-400 block">
          Quick Response Scenarios:
        </span>
        <div className="flex flex-wrap gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => {
                setMessage(p.text);
                handleSend(p.text);
              }}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer disabled:opacity-50 ${p.color}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type custom response (e.g. 'I drained the connection pool, metrics back to normal')..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-[#1E2738] text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !message.trim()}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Evaluating…' : 'Send'}
        </button>
      </div>

      {/* Result Card */}
      {lastResult && (
        <div className="p-3 rounded-lg bg-[#0E131E] border border-blue-500/30 space-y-2 text-xs animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-medium">
              Parsed Intent: <strong className="text-blue-400 uppercase">{lastResult.intent}</strong>
            </span>
            {lastResult.confidence !== undefined && (
              <span className="text-emerald-400 text-[11px] font-mono">
                {Math.round(lastResult.confidence * 100)}% confidence
              </span>
            )}
          </div>

          {lastResult.reasoning && (
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <span className="text-purple-300 font-medium">Model Reasoning: </span>
              {lastResult.reasoning}
            </p>
          )}

          {lastResult.follow_up_question && (
            <p className="text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/30 text-[11px]">
              <strong>Clarification prompt:</strong> {lastResult.follow_up_question}
            </p>
          )}

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Action: {lastResult.action_taken}</span>
            {lastResult.action_taken.includes('http') && (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                ✓ Postmortem committed to GitHub
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          Error: {error}
        </div>
      )}
    </div>
  );
}
