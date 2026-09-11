export interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  status: 'open' | 'escalated' | 'ack' | 'resolved';
  current_channel: string | null;
  escalation_count: number;
  agent_reasoning: string | null;
  created_at: string;
  last_notified_at: string;
  resolved_at: string | null;
}

export interface TimelineEntry {
  id: string;
  incident_id: string;
  channel: string;
  sender: string;
  message: string;
  intent_parsed: string | null;
  created_at: string;
}

export interface ChaosResponse {
  message: string;
  events_fired: number;
  incident_id: string | null;
  severity: string | null;
  agent_reasoning: string | null;
}

export interface AiStatus {
  status: 'online' | 'error';
  model: string;
  provider: string;
  base_url?: string;
  latency_ms: number;
  active_agents: string[];
  error?: string | null;
}

export interface AgentTestResult {
  agent: string;
  model: string;
  status: 'success' | 'error';
  duration_ms: number;
  output: any;
  error?: string | null;
}

export interface SimulateReplyResult {
  incident_id: string;
  intent: string;
  action_taken: string;
  confidence?: number;
  reasoning?: string;
  follow_up_question?: string;
}

export interface TriggerIncidentRequest {
  title: string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | 'auto';
  source?: string;
  service?: string;
  error_signature?: string;
  details?: string;
  raw_payload?: Record<string, any>;
  send_notifications?: boolean;
  is_demo?: boolean;
}

export interface TriggerIncidentResponse {
  incident_id: string;
  title: string;
  severity: string;
  status: string;
  current_channel: string | null;
  agent_reasoning: string | null;
  action: string;
  message: string;
}

export type ActivityCategory = 'all' | 'slack' | 'telegram' | 'email' | 'llm' | 'github' | 'remediation' | 'system';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  category: 'slack' | 'telegram' | 'email' | 'llm' | 'github' | 'remediation' | 'system';
  title: string;
  summary: string;
  details?: string;
  incident_id?: string | null;
  incident_title?: string | null;
  severity?: 'low' | 'medium' | 'high' | 'critical' | null;
  metadata?: {
    channel?: string;
    sender?: string;
    intent?: string;
    github_url?: string;
    model?: string;
    action?: string;
    repo?: string;
    branch?: string;
    to?: string;
    simulated?: boolean;
    reason?: string;
    [key: string]: any;
  };
}

