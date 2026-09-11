import React, { useState, useEffect } from 'react';
import { AiStatus, AgentTestResult } from '../types';
import { fetchAiStatus, testAgent } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AiInspectorModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'status' | 'severity' | 'intent' | 'postmortem'>('status');
  const [statusData, setStatusData] = useState<AiStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

  // Severity tester state
  const [sevService, setSevService] = useState('payment-service');
  const [sevMessage, setSevMessage] = useState('Stripe webhook 504 Gateway Timeout: payment processing halted for users');
  const [sevResult, setSevResult] = useState<AgentTestResult | null>(null);
  const [sevLoading, setSevLoading] = useState(false);

  // Intent tester state
  const [intentMessage, setIntentMessage] = useState('Investigating now, looks like Redis cache memory is maxed out.');
  const [intentResult, setIntentResult] = useState<AgentTestResult | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);

  // Postmortem tester state
  const [pmResult, setPmResult] = useState<AgentTestResult | null>(null);
  const [pmLoading, setPmLoading] = useState(false);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await fetchAiStatus();
      setStatusData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestSeverity = async () => {
    setSevLoading(true);
    try {
      const res = await testAgent('severity', {
        service: sevService,
        message: sevMessage,
      });
      setSevResult(res);
    } catch (err: any) {
      setSevResult({
        agent: 'Severity Classifier',
        model: statusData?.model || 'Gemini',
        status: 'error',
        duration_ms: 0,
        output: null,
        error: err.message,
      });
    } finally {
      setSevLoading(false);
    }
  };

  const handleTestIntent = async () => {
    setIntentLoading(true);
    try {
      const res = await testAgent('intent', {
        message: intentMessage,
      });
      setIntentResult(res);
    } catch (err: any) {
      setIntentResult({
        agent: 'Intent Parser',
        model: statusData?.model || 'Gemini',
        status: 'error',
        duration_ms: 0,
        output: null,
        error: err.message,
      });
    } finally {
      setIntentLoading(false);
    }
  };

  const handleTestPostmortem = async () => {
    setPmLoading(true);
    try {
      const res = await testAgent('postmortem', {
        title: 'Authentication token validation outage across all regions',
      });
      setPmResult(res);
    } catch (err: any) {
      setPmResult({
        agent: 'Postmortem Generator',
        model: statusData?.model || 'Gemini',
        status: 'error',
        duration_ms: 0,
        output: null,
        error: err.message,
      });
    } finally {
      setPmLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl bg-[#111622] border border-[#1E2738]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#1E2738] bg-[#0E131E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  AI Model Inspector &amp; Live Diagnostic Studio
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect real-time Google Gemini LLM inference, latency metrics, and reasoning chains
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {statusData && (
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#0B0E14] border border-[#1E2738] text-slate-300">
                Ping: <strong className="text-emerald-400">{statusData.latency_ms}ms</strong>
              </span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1E2738] px-6 pt-2 bg-[#0B0E14] gap-2">
          {[
            { id: 'status', label: 'Model Status & Health' },
            { id: 'severity', label: 'Severity Classifier' },
            { id: 'intent', label: 'Intent Parser (NLU)' },
            { id: 'postmortem', label: 'Postmortem Generator' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 px-3 text-xs font-medium transition-colors border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'text-white border-blue-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: STATUS & HEALTH */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-[#151C2C] border border-[#1E2738]">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Active LLM Model</p>
                  <p className="text-base font-bold font-mono text-white mt-1 truncate">
                    {statusData?.model || 'gemini-2.5-flash'}
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    Provider: {statusData?.provider || 'Google Generative AI'}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#151C2C] border border-[#1E2738]">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Connectivity Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-base font-bold text-emerald-400 uppercase">
                      {statusData?.status || 'ONLINE'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    HTTP 200 via Generative Language API
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#151C2C] border border-[#1E2738]">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Round-Trip Latency</p>
                  <p className="text-base font-bold font-mono text-purple-400 mt-1">
                    {statusData ? `${statusData.latency_ms} ms` : 'Measuring...'}
                  </p>
                  <button
                    onClick={loadStatus}
                    disabled={loadingStatus}
                    className="text-xs text-blue-400 hover:underline mt-1 block cursor-pointer"
                  >
                    {loadingStatus ? 'Pinging API...' : 'Re-measure latency'}
                  </button>
                </div>
              </div>

              {/* Architecture overview */}
              <div className="p-4 rounded-lg border border-[#1E2738] bg-[#151C2C]">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-200 mb-2">
                  Sentinel Multi-Agent Architecture
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Sentinel replaces static alert webhooks with continuous AI reasoning. Incoming telemetry is processed by coordinated reasoning agents running against <strong>Google Gemini</strong>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#0E131E] border border-[#1E2738]">
                    <p className="font-semibold text-blue-400">1. Severity Reasoning Agent</p>
                    <p className="text-slate-400 text-xs mt-1 leading-normal">
                      Analyzes error semantics, customer impact, applies 3-event 30m clustering override rule, and attaches RAG runbooks.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0E131E] border border-[#1E2738]">
                    <p className="font-semibold text-purple-300">2. Intent Parser Agent</p>
                    <p className="text-slate-400 text-xs mt-1 leading-normal">
                      Understands natural language engineer replies across Slack &amp; Telegram (ack / investigating / resolved / clarify).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0E131E] border border-[#1E2738]">
                    <p className="font-semibold text-amber-300">3. Caspian Escalation Engine</p>
                    <p className="text-slate-400 text-xs mt-1 leading-normal">
                      State machine tracking time-to-ack, escalates across Slack → Telegram → Email until acknowledged.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0E131E] border border-[#1E2738]">
                    <p className="font-semibold text-emerald-300">4. Postmortem Generator</p>
                    <p className="text-slate-400 text-xs mt-1 leading-normal">
                      Synthesizes complete multi-channel timelines upon resolution and pushes a structured Markdown postmortem to GitHub.
                    </p>
                  </div>
                </div>
              </div>

              {/* Endpoint info */}
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2738] font-mono text-xs space-y-1 text-slate-400">
                <p><span className="text-slate-500">Base URL:</span> {statusData?.base_url || 'https://generativelanguage.googleapis.com/v1beta/openai/'}</p>
                <p><span className="text-slate-500">Active Model:</span> {statusData?.model}</p>
                <p><span className="text-slate-500">Registered Agents:</span> {statusData?.active_agents.join(', ')}</p>
              </div>
            </div>
          )}

          {/* TAB 2: SEVERITY TESTER */}
          {activeTab === 'severity' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-300 mb-2">
                  Test the <strong>Severity Reasoning Agent</strong> with live LLM inference.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs text-slate-500 self-center">Presets:</span>
                  {[
                    { label: 'Stripe 504 Timeout', svc: 'payment-service', msg: 'Stripe webhook 504 Gateway Timeout: payment processing halted for users' },
                    { label: 'Postgres Pool Exhausted', svc: 'order-service', msg: 'OperationalError: connection to server at db.prod.internal failed: timeout expired' },
                    { label: 'Redis High Memory', svc: 'cache-service', msg: 'Redis memory usage reached 87% of maxmemory on redis-replica-02' },
                    { label: 'Background Sync Rate Limit', svc: 'sync-worker', msg: 'Background email batch worker skipped 2 retries due to rate limit' },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSevService(p.svc);
                        setSevMessage(p.msg);
                      }}
                      className="text-xs px-2.5 py-1 rounded bg-[#151C2C] border border-[#1E2738] hover:border-slate-600 text-slate-300 cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Service Name</label>
                  <input
                    type="text"
                    value={sevService}
                    onChange={(e) => setSevService(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-[#1E2738] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-slate-300 block mb-1">Telemetry Payload</label>
                  <input
                    type="text"
                    value={sevMessage}
                    onChange={(e) => setSevMessage(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-[#1E2738] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleTestSeverity}
                disabled={sevLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                {sevLoading ? 'Evaluating with Gemini...' : 'Run Severity Inference'}
              </button>

              {sevResult && (
                <div className="p-4 rounded-lg border bg-[#0E131E] border-blue-500/30 space-y-2.5 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{sevResult.agent}</span>
                      <span className="text-slate-400 font-mono text-[11px]">Latency: {sevResult.duration_ms}ms</span>
                    </div>
                    {sevResult.output?.severity && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/30">
                        {sevResult.output.severity}
                      </span>
                    )}
                  </div>

                  {sevResult.output?.reasoning && (
                    <div className="p-3 rounded bg-[#111622] border border-[#1E2738]">
                      <p className="text-xs font-medium text-purple-300 mb-1">Reasoning:</p>
                      <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line">
                        {sevResult.output.reasoning}
                      </p>
                    </div>
                  )}

                  {sevResult.error && (
                    <p className="text-xs text-red-400">Error: {sevResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INTENT PARSER */}
          {activeTab === 'intent' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-300 mb-2">
                  Test the <strong>Intent Parser Agent</strong> on free-text Slack or Telegram engineer replies.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs text-slate-500 self-center">Presets:</span>
                  {[
                    { label: 'Acknowledge', text: 'Got it, on it now.' },
                    { label: 'Investigate', text: 'Investigating now, looks like Redis cache memory is maxed out.' },
                    { label: 'Resolve & Postmortem', text: 'Root cause identified as bad canary config. Rolled back and all metrics green. Resolved.' },
                    { label: 'Clarification', text: 'Hey is this affecting user logins or just internal telemetry?' },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setIntentMessage(p.text)}
                      className="text-xs px-2.5 py-1 rounded bg-[#151C2C] border border-[#1E2738] hover:border-slate-600 text-slate-300 cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Engineer Message</label>
                <textarea
                  rows={3}
                  value={intentMessage}
                  onChange={(e) => setIntentMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0E14] border border-[#1E2738] text-xs text-white focus:outline-none focus:border-blue-500 font-mono resize-y"
                />
              </div>

              <button
                onClick={handleTestIntent}
                disabled={intentLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                {intentLoading ? 'Parsing with Gemini...' : 'Run Intent Parser'}
              </button>

              {intentResult && (
                <div className="p-4 rounded-lg border bg-[#0E131E] border-blue-500/30 space-y-2.5 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-semibold text-slate-200">{intentResult.agent}</span>
                    {intentResult.output?.intent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Intent: {intentResult.output.intent}
                      </span>
                    )}
                  </div>

                  {intentResult.output && (
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-slate-500">Confidence:</span>
                        <span className="font-bold text-emerald-400">
                          {Math.round((intentResult.output.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <div className="p-3 rounded bg-[#111622] border border-[#1E2738]">
                        <p className="text-purple-300 font-medium mb-1">Reasoning:</p>
                        <p className="text-slate-300">{intentResult.output.reasoning}</p>
                      </div>
                      {intentResult.output.follow_up_question && (
                        <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                          <strong>Clarification:</strong> {intentResult.output.follow_up_question}
                        </div>
                      )}
                    </div>
                  )}

                  {intentResult.error && (
                    <p className="text-xs text-red-400">Error: {intentResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: POSTMORTEM GENERATOR */}
          {activeTab === 'postmortem' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-300 mb-2">
                  Sentinel synthesizes the full multi-channel incident timeline upon resolution and commits a structured postmortem markdown file to GitHub.
                </p>
                <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2738] font-mono text-xs text-slate-400 space-y-1">
                  <p><strong>Sample Incident:</strong> Authentication token validation outage across all regions</p>
                  <p><strong>Timeline:</strong> Sentry alert → Alice acknowledged → Bob reverted JWKS rotation → Verified healthy</p>
                </div>
              </div>

              <button
                onClick={handleTestPostmortem}
                disabled={pmLoading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                {pmLoading ? 'Generating & Committing to GitHub...' : 'Run Postmortem Generator'}
              </button>

              {pmResult && (
                <div className="p-4 rounded-lg border bg-[#0E131E] border-emerald-500/30 space-y-2.5 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-semibold text-slate-200">{pmResult.agent}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      SUCCESS
                    </span>
                  </div>

                  {pmResult.output?.github_url && (
                    <div className="p-3 rounded bg-[#111622] border border-[#1E2738]">
                      <p className="text-xs font-semibold text-emerald-400 mb-1">GitHub Commit Artifact:</p>
                      <a
                        href={pmResult.output.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:underline break-all font-mono"
                      >
                        {pmResult.output.github_url} ↗
                      </a>
                    </div>
                  )}

                  {pmResult.error && (
                    <p className="text-xs text-red-400">Error: {pmResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#1E2738] bg-[#0E131E] flex items-center justify-between text-xs text-slate-400">
          <span>Google Gemini Flash · Continuous live AI inference</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#1E2738] hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
