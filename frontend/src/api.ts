import { Incident, TimelineEntry, ChaosResponse } from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  const wsBase = BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/ws/incidents`;
}
