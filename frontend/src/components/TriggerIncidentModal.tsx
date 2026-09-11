import React, { useState } from 'react';
import { TriggerIncidentRequest, TriggerIncidentResponse } from '../types';
import { triggerIncident } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: TriggerIncidentResponse) => void;
  onError: (title: string, msg?: string) => void;
}

type SeverityOption = 'critical' | 'high' | 'medium' | 'low' | 'auto';

interface Preset {
  name: string;
  badge: string;
  severity: SeverityOption;
  title: string;
  service: string;
  source: string;
  errorSignature: string;
  details: string;
}

const PRESETS: Preset[] = [
  {
    name: 'P0 Critical Database Outage',
    badge: 'CRITICAL',
    severity: 'critical',
    title: 'Database Connection Pool Exhausted & Queries Failing',
    service: 'database-cluster',
    source: 'datadog',
    errorSignature: 'postgres::pool::connection_timeout_503',
    details: 'FATAL: remaining connection slots are reserved for non-replication superuser connections.\nActive connection count reached 1,500 threshold. 450 requests queued in backlog.',
  },
  {
    name: 'P1 High Payment Gateway Timeout',
    badge: 'HIGH',
    severity: 'high',
    title: 'Payment Gateway Webhook 504 Gateway Timeout',
    service: 'payment-service',
    source: 'sentry',
    errorSignature: 'payment::stripe::webhook_504_timeout',
    details: 'HTTP 504 Gateway Timeout when contacting api.stripe.com/v1/charges.\nError rate 19.4% exceeds 5% SLA threshold for 3 consecutive check intervals.',
  },
  {
    name: 'P2 Medium Worker Memory Spike',
    badge: 'MEDIUM',
    severity: 'medium',
    title: 'High Memory Utilization on Asynchronous Worker Fleet',
    service: 'worker-fleet',
    source: 'aws-cloudwatch',
    errorSignature: 'worker::celery::oom_memory_spike',
    details: 'Worker pod memory utilization reached 89.2% of container limit (3.6GB / 4GB).\nTask queues accumulating backlog of 12,000 delayed jobs.',
  },
  {
    name: 'P3 Low Analytics Latency Degradation',
    badge: 'LOW',
    severity: 'low',
    title: 'Elevated Latency on Reporting & Analytics Endpoints',
    service: 'analytics-engine',
    source: 'datadog',
    errorSignature: 'analytics::query::slow_p99_latency',
    details: 'P99 query response time degraded from 180ms to 1,250ms on GET /api/v1/reports/daily.\nNo data loss or customer-facing errors detected.',
  },
];

export function TriggerIncidentModal({ isOpen, onClose, onSuccess, onError }: Props) {
  const [severity, setSeverity] = useState<SeverityOption>('high');
  const [title, setTitle] = useState('');
  const [service, setService] = useState('payment-service');
  const [source, setSource] = useState('datadog');
  const [errorSignature, setErrorSignature] = useState('');
  const [details, setDetails] = useState('');
  const [isDemo, setIsDemo] = useState(true);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const applyPreset = (preset: Preset) => {
    setSeverity(preset.severity);
    setTitle(preset.title);
    setService(preset.service);
    setSource(preset.source);
    setErrorSignature(preset.errorSignature);
    setDetails(preset.details);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onError('Validation Error', 'Please provide an incident title.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: TriggerIncidentRequest = {
        title: title.trim(),
        severity,
        service: service.trim(),
        source: source.trim(),
        error_signature: errorSignature.trim() || undefined,
        details: details.trim() || undefined,
        is_demo: isDemo,
        send_notifications: sendNotifications,
      };

      const result = await triggerIncident(payload);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      onError('Incident Trigger Failed', err.message || 'An error occurred while creating the incident.');
    } finally {
      setSubmitting(false);
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
        className="w-full max-w-2xl rounded-xl flex flex-col overflow-hidden shadow-2xl bg-[#111622] border border-[#1E2738]"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#1E2738] bg-[#0E131E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  Declare Production Incident
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  DISPATCH
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch an autonomous SRE triage workflow or simulate synthetic alerts
              </p>
            </div>
          </div>

          <button
            id="close-trigger-modal-btn"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Incident Scenarios (1-Click Autofill)
              </span>
              <span className="text-xs text-slate-500">Select to load defaults</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="p-3 rounded-lg text-left transition-colors bg-[#151C2C] hover:bg-[#1A2234] border border-[#1E2738] hover:border-slate-600 flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-200">
                      {p.name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase border ${
                      p.severity === 'critical'
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : p.severity === 'high'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : p.severity === 'medium'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    {p.service} · {p.source}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Severity Segmented Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-2">
                Target Severity Level
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'critical', label: 'CRITICAL', class: 'text-red-400 border-red-500/50 bg-red-500/10' },
                  { id: 'high', label: 'HIGH', class: 'text-amber-400 border-amber-500/50 bg-amber-500/10' },
                  { id: 'medium', label: 'MEDIUM', class: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10' },
                  { id: 'low', label: 'LOW', class: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' },
                  { id: 'auto', label: 'AI AUTO', class: 'text-blue-400 border-blue-500/50 bg-blue-500/10' },
                ].map((opt) => {
                  const isSelected = severity === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      id={`severity-select-${opt.id}`}
                      onClick={() => setSeverity(opt.id as SeverityOption)}
                      className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all text-center border cursor-pointer ${
                        isSelected
                          ? opt.class + ' shadow-sm'
                          : 'bg-[#0B0E14] text-slate-400 border-[#1E2738] hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {severity === 'auto'
                  ? 'Sentinel Gemini Agent will evaluate error logs and context to determine severity dynamically.'
                  : `Incident will initialize directly with ${severity.toUpperCase()} severity and escalation path.`}
              </p>
            </div>

            {/* Title Input */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Incident Title *
              </label>
              <input
                id="incident-title-input"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Payment Gateway 504 Gateway Timeout"
                className="w-full px-3.5 py-2 rounded-lg text-sm text-white placeholder-slate-500 bg-[#0B0E14] border border-[#1E2738] focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Service and Source Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Affected Service / Component
                </label>
                <input
                  id="incident-service-input"
                  type="text"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="e.g. payment-service"
                  list="service-suggestions"
                  className="w-full px-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-500 bg-[#0B0E14] border border-[#1E2738] focus:outline-none focus:border-blue-500 font-mono"
                />
                <datalist id="service-suggestions">
                  <option value="payment-service" />
                  <option value="auth-api" />
                  <option value="database-cluster" />
                  <option value="worker-fleet" />
                  <option value="ingress-gateway" />
                  <option value="analytics-engine" />
                </datalist>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Monitoring Source
                </label>
                <select
                  id="incident-source-select"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs text-white bg-[#0B0E14] border border-[#1E2738] focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="datadog">Datadog APM</option>
                  <option value="sentry">Sentry Errors</option>
                  <option value="github-actions">GitHub Actions CI/CD</option>
                  <option value="aws-cloudwatch">AWS CloudWatch</option>
                  <option value="pagerduty">PagerDuty Alert</option>
                  <option value="manual-ops">Operations Console (Manual)</option>
                </select>
              </div>
            </div>

            {/* Error Signature */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Error Signature / Clustering Key (Optional)
              </label>
              <input
                id="incident-signature-input"
                type="text"
                value={errorSignature}
                onChange={(e) => setErrorSignature(e.target.value)}
                placeholder="e.g. payment-service::stripe::504-timeout"
                className="w-full px-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-500 bg-[#0B0E14] border border-[#1E2738] focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Details */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Diagnostic Details / Logs / Stack Trace
              </label>
              <textarea
                id="incident-details-input"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Paste relevant error traces, log lines, or description of the failure..."
                className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-slate-500 bg-[#0B0E14] border border-[#1E2738] focus:outline-none focus:border-blue-500 font-mono resize-y"
              />
            </div>

            {/* Safety Options */}
            <div className="p-3.5 rounded-lg bg-[#151C2C] border border-[#1E2738] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="incident-demo-mode-checkbox"
                  checked={isDemo}
                  onChange={(e) => setIsDemo(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                />
                <label htmlFor="incident-demo-mode-checkbox" className="text-xs text-white cursor-pointer select-none">
                  <span className="font-semibold text-slate-200">Safe Simulation Mode</span>
                  <span className="block text-[11px] text-slate-400 font-normal">
                    Preserves third-party email quota while generating authentic AI reasoning and timeline events.
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="checkbox"
                  id="incident-notify-checkbox"
                  checked={sendNotifications}
                  onChange={(e) => setSendNotifications(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                />
                <label htmlFor="incident-notify-checkbox" className="text-xs text-slate-300 cursor-pointer select-none">
                  Dispatch Notification Tree
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-transparent border border-[#1E2738] hover:bg-slate-800 transition-colors cursor-pointer"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                id="submit-trigger-incident-btn"
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Declaring Incident…' : 'Declare Incident'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
