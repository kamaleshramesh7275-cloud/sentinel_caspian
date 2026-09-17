import {
  Incident,
  TimelineEntry,
  ChaosResponse,
  AiStatus,
  AgentTestResult,
  SimulateReplyResult,
  TriggerIncidentRequest,
  TriggerIncidentResponse,
  ActivityEvent,
} from './types';

// Dynamic BASE_URL: points directly to backend port 8000 on the same host (e.g. localhost or 127.0.0.1)
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname || 'localhost'}:8000`
    : 'http://localhost:8000');

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (fetchErr: any) {
    // Only attempt alternative host fallback if fetch() itself threw a network exception
    if (typeof window !== 'undefined') {
      const altHost = window.location.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1';
      const altUrl = `${window.location.protocol}//${altHost}:8000${path}`;
      try {
        res = await fetch(altUrl, options);
      } catch {
        throw fetchErr;
      }
    } else {
      throw fetchErr;
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let detailMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      detailMsg = parsed.detail || parsed.message || errorText;
    } catch {
      // not json
    }
    throw new Error(detailMsg || `API error (${res.status})`);
  }

  return await res.json();
}

export async function fetchIncidents(status?: string): Promise<{ total: number; incidents: Incident[] }> {
  const params = status ? `?status=${status}&limit=50` : '?limit=50';
  return apiFetch(`/incidents${params}`);
}

export async function fetchIncident(id: string): Promise<Incident> {
  return apiFetch(`/incidents/${id}`);
}

export async function fetchTimeline(id: string): Promise<TimelineEntry[]> {
  return apiFetch(`/incidents/${id}/timeline`);
}

export async function triggerChaos(): Promise<ChaosResponse> {
  return apiFetch('/demo/chaos', { method: 'POST' });
}

export async function triggerIncident(data: TriggerIncidentRequest): Promise<TriggerIncidentResponse> {
  return apiFetch('/incidents/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchHealth(): Promise<{ status: string; channels_available: string[] }> {
  return apiFetch('/health');
}

export async function fetchRemediationActions(): Promise<{ actions: any[] }> {
  return apiFetch('/remediation/actions');
}

export async function executeRemediation(
  incidentId: string,
  action: string,
  params?: Record<string, any>,
  autoResolve: boolean = true
): Promise<any> {
  return apiFetch(`/incidents/${incidentId}/remediate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params, auto_resolve: autoResolve }),
  });
}

export function getWebSocketUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    const wsBase = import.meta.env.VITE_API_URL.replace(/^http/, 'ws');
    return `${wsBase}/ws/incidents`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
  return `${protocol}//${host}:8000/ws/incidents`;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  return apiFetch('/ai/status');
}

export async function testAgent(agent: string, payload: Record<string, any> = {}): Promise<AgentTestResult> {
  return apiFetch('/ai/test-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, payload }),
  });
}

export async function simulateReply(
  incidentId: string,
  message: string,
  sender: string = 'On-Call SRE (Simulator)',
  channel: string = 'dashboard-simulator'
): Promise<SimulateReplyResult> {
  return apiFetch(`/incidents/${incidentId}/simulate-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sender, channel }),
  });
}

export async function fetchActivities(
  category?: string,
  incidentId?: string,
  limit: number = 60
): Promise<ActivityEvent[]> {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.append('category', category);
  if (incidentId) params.append('incident_id', incidentId);
  params.append('limit', String(limit));
  return apiFetch(`/activities?${params.toString()}`);
}

export async function generateIncidentPatch(
  incidentId: string,
  customInstructions?: string
): Promise<any> {
  return apiFetch(`/incidents/${incidentId}/generate-patch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_instructions: customInstructions }),
  });
}

export async function commitIncidentPatch(
  incidentId: string,
  patchData: any
): Promise<any> {
  return apiFetch(`/incidents/${incidentId}/commit-patch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch_data: patchData }),
  });
}

export async function runModelArena(payload: {
  scenario?: string;
  error_signature?: string;
  stack_trace?: string;
  service?: string;
}): Promise<any> {
  return apiFetch('/ai/arena-compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchVectorMemory(): Promise<{ total_indexed_incidents: number; records: any[] }> {
  return apiFetch('/ai/vector-memory');
}

export async function triggerRealCodeFailure(): Promise<any> {
  return apiFetch('/demo/trigger-real-code-failure', { method: 'POST' });
}

export async function applyLocalPatch(incidentId?: string | null): Promise<any> {
  if (!incidentId || incidentId === '00000000-0000-0000-0000-000000000000') {
    return apiFetch('/demo/apply-patch', { method: 'POST' });
  }
  return apiFetch(`/incidents/${incidentId}/apply-local-patch`, { method: 'POST' });
}

export async function runRegressionTests(incidentId?: string | null): Promise<any> {
  if (!incidentId || incidentId === '00000000-0000-0000-0000-000000000000') {
    return apiFetch('/demo/run-tests', { method: 'POST' });
  }
  return apiFetch(`/incidents/${incidentId}/run-tests`, { method: 'POST' });
}

export async function resetLocalCode(incidentId?: string | null): Promise<any> {
  if (!incidentId || incidentId === '00000000-0000-0000-0000-000000000000') {
    return apiFetch('/demo/reset-code', { method: 'POST' });
  }
  return apiFetch(`/incidents/${incidentId}/reset-code`, { method: 'POST' });
}

export async function runSpeculativeHeal(incidentId: string): Promise<any> {
  return apiFetch(`/incidents/${incidentId}/speculative-heal`, { method: 'POST' });
}

export async function simulateCascade(incidentId: string): Promise<any> {
  return apiFetch(`/incidents/${incidentId}/simulate-cascade`, { method: 'POST' });
}

export async function generateChaosExperiment(incidentId: string): Promise<any> {
  return apiFetch(`/incidents/${incidentId}/chaos-experiment`, { method: 'POST' });
}

export async function fetchSourceCode(): Promise<{
  target_file: string;
  is_patched: boolean;
  status: string;
  content: string;
  total_lines: number;
  defective_lines_range: number[];
}> {
  return apiFetch('/demo/source-code');
}

export async function applyDemoPatch(): Promise<any> {
  return apiFetch('/demo/apply-patch', { method: 'POST' });
}

export async function resetDemoCode(): Promise<any> {
  return apiFetch('/demo/reset-code', { method: 'POST' });
}

export interface LiveAgentTelemetry {
  agent_id: string;
  name: string;
  subtitle: string;
  role: string;
  status: string;
  latency_ms: number;
  temperature: number;
  token_count: {
    prompt: number;
    completion: number;
    total: number;
  };
  system_prompt: string;
  injected_telemetry_prompt: string;
  raw_output: string;
  schema_type: string;
  timestamp: string;
  case_id?: string;
  target_file?: string;
  metadata?: Record<string, any>;
}

export async function fetchLiveAgentTelemetry(
  agentId: string,
  incidentId?: string,
  executeLive?: boolean,
  caseId?: string,
  customCode?: string,
  customError?: string
): Promise<LiveAgentTelemetry> {
  // If custom code or custom error is provided, use POST to avoid URL size limits
  if (customCode || customError || caseId === 'custom_repo') {
    return apiFetch('/incidents/agent-live-telemetry', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: agentId,
        incident_id: incidentId,
        execute_live: executeLive,
        case_id: caseId || 'custom_repo',
        custom_code: customCode,
        custom_error: customError,
      }),
    });
  }

  const params = new URLSearchParams();
  params.append('agent_id', agentId);
  if (incidentId) params.append('incident_id', incidentId);
  if (executeLive) params.append('execute_live', 'true');
  if (caseId) params.append('case_id', caseId);
  return apiFetch(`/incidents/agent-live-telemetry?${params.toString()}`);
}

