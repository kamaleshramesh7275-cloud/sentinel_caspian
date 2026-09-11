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

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
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
  // If a full URL override is set (e.g. in production), use it directly
  if (import.meta.env.VITE_API_URL) {
    const wsBase = import.meta.env.VITE_API_URL.replace(/^http/, 'ws');
    return `${wsBase}/ws/incidents`;
  }
  // In dev, proxy is /api → http://localhost:8000, but WS isn't proxied.
  // Connect directly to the backend WS port.
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//localhost:8001/ws/incidents`;
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

