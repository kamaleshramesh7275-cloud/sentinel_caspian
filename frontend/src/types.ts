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
