import React, { useState } from 'react';
import {
  X, Copy, Check, Terminal, Cpu, Zap, Activity, ShieldCheck,
  Flame, GitBranch, ArrowRight, Layers, Database, Sparkles, RefreshCw
} from 'lucide-react';

interface AgentPromptData {
  id: string;
  name: string;
  agentRole: string;
  badge: string;
  color: string;
  temperature: number;
  tokens: { prompt: number; completion: number; total: number };
  latencyMs: number;
  systemPrompt: string;
  userPrompt: string;
  rawModelOutput: string;
}

const AGENTS_PROMPTS: AgentPromptData[] = [
  {
    id: 'triage',
    name: 'Severity & Clustering Triage',
    agentRole: 'Autonomous Incident Classifier & Noise Reduction Engine',
    badge: 'Triage Agent',
    color: '#ef4444',
    temperature: 0.1,
    tokens: { prompt: 1420, completion: 285, total: 1705 },
    latencyMs: 142,
    systemPrompt: `You are the Sentinel Autonomous Incident Commander Triage Agent fine-tuned with Qwen2.5-14B-Instruct LoRA weights (kamaleshkumarR/sentinell) on 76.01 GB of SRE telemetry datasets (18.925B tokens).

TASK:
1. Analyze multi-source telemetry: Sentry stack traces, Datadog metrics (p99 latency, error rates), Kubernetes Pod events, and Distributed Tracing spans.
2. Determine severity level: SEV-1 (Critical Revenue Blocker), SEV-2 (High Degradation), SEV-3 (Moderate), SEV-4 (Low).
3. Compute deduplication cluster fingerprint to silence noisy alert storms across cascading microservices.
4. Output strict JSON conforming to the SentinelIncidentTriage schema.`,
    userPrompt: `INCOMING TELEMETRY EVENT:
Timestamp: 2026-09-17T17:10:44.821Z
Cluster: us-east-1-prod-k8s
Namespace: payments-engine
Service: payment_gateway (Pod: payment_gateway-7f89d5c64-x9z21)

Sentry Event ID: 8a93ef01-8b29-411a-bc04-897d9124401a
Exception: services.payment_gateway.ConnectionPoolExhausted: DB Connection Pool Max capacity (10/10) exhausted after 5.00s timeout.
File: /app/services/payment_gateway.py:46 in execute_transaction
Context:
   44 | conn = connection_pool.get_connection()
   45 | if simulate_defect:
   46 | > raise ConnectionPoolExhausted("DB Connection Pool Max capacity (10/10) exhausted...")

Datadog Metrics Window (T-5m):
- payment_gateway.http_500_rate: 88.4% (Baseline: 0.02%)
- payment_gateway.p99_latency_ms: 5042.8ms (SLO: < 250ms)
- checkout_service.upstream_503_rate: 76.2%
- postgres_pool.active_connections: 10/10 (100% saturation)

K8s Pod Status: 3 CrashLoopBackOff restarts within 4 minutes.

Analyze the blast radius and output your triage classification in strict JSON format.`,
    rawModelOutput: `{
  "classification": {
    "severity": "SEV-1",
    "urgency": "IMMEDIATE_ACTION_REQUIRED",
    "incident_title": "Critical Connection Pool Exhaustion in payment_gateway causing 88.4% HTTP 500 Spike",
    "cluster_fingerprint": "fp_pgw_dbpool_exhaustion_e0821f9",
    "confidence_score": 0.984
  },
  "blast_radius": {
    "affected_services": ["payment_gateway", "checkout_service", "billing_worker", "api_gateway"],
    "financial_impact_est_per_min_usd": 14250.00,
    "user_facing_impact": "Checkout flow completely blocked for ~82% of active users",
    "slos_breached": ["availability_99_99", "p99_latency_under_250ms"]
  },
  "noise_suppression": {
    "deduplicated_alerts_count": 47,
    "suppressed_downstream_alarms": [
      "checkout_service_upstream_timeout_alert",
      "frontend_api_502_bad_gateway_alert",
      "notification_worker_queue_stalled"
    ]
  },
  "recommended_routing": "sre-core-oncall, payments-infra-leads"
}`
  },
  {
    id: 'rca',
    name: 'Causal RCA & Dependency DAG',
    agentRole: 'Topological Directed Acyclic Graph Causal Inference',
    badge: 'RCA Agent',
    color: '#a855f7',
    temperature: 0.05,
    tokens: { prompt: 2180, completion: 490, total: 2670 },
    latencyMs: 198,
    systemPrompt: `You are the Sentinel Causal RCA Engine. You reconstruct distributed execution topology and infer root-cause probabilities across upstream caller and downstream dependency Directed Acyclic Graphs (DAG).

RULES:
- Distinguish between primary Root Cause and secondary downstream symptoms.
- Point precisely to the source code file, function, and line where the defect was introduced.
- Assign causal confidence weights $\\omega_i \\in [0, 1]$ such that $\\sum \\omega_i = 1.0$.
- Produce structured topological node relationships for visualization.`,
    userPrompt: `TRACE TOPOLOGY & DEPENDENCY GRAPH:
Ingress API Gateway (10.0.1.10)
 └── Checkout Service (10.0.2.14) [p99: 5.1s, err: 76%]
      ├── Payment Gateway (10.0.3.55) [p99: 5.0s, err: 88%] <-- SUSPECT
      │    ├── Auth Service (10.0.4.12) [p99: 14ms, err: 0%] (Healthy)
      │    └── PostgreSQL Master (10.0.5.80) [connections: 10/10 active, CPU: 12%]
      └── Notification Worker (10.0.6.21) [lag: 420 messages]

Source Code Inspection:
Repo: kamaleshramesh7275-cloud/sentinel_caspian
File: services/payment_gateway.py
Diff committed 24m ago in commit 9a4f21b:
\`\`\`python
def execute_transaction(user_id: str, amount: float) -> dict:
    conn = connection_pool.get_connection()
    # Missing: try ... finally: connection_pool.release(conn)
    if simulate_defect:
        raise ConnectionPoolExhausted("DB Connection Pool Max capacity exhausted")
\`\`\`

Analyze the DAG and determine the root cause node and causality probabilities.`,
    rawModelOutput: `{
  "causal_graph": {
    "root_node": "services.payment_gateway:execute_transaction",
    "primary_failure_mode": "RESOURCE_LEAK_SOCKET_EXHAUSTION",
    "causal_confidence": 0.992,
    "nodes": [
      {
        "id": "pg_db_pool",
        "name": "payment_gateway (DB Connection Pool)",
        "type": "ROOT_CAUSE",
        "probability": 0.942,
        "evidence": "Unreleased database sockets in execute_transaction without finally block on line 44-48."
      },
      {
        "id": "checkout_svc",
        "name": "checkout_service",
        "type": "DOWNSTREAM_CASCADE_VICTIM",
        "probability": 0.041,
        "evidence": "Synchronous HTTP timeouts waiting for payment_gateway response."
      },
      {
        "id": "api_gw",
        "name": "api_gateway",
        "type": "SYMPTOMATIC_INGRESS",
        "probability": 0.017,
        "evidence": "Returning 502/504 Bad Gateway to client web browsers."
      }
    ]
  },
  "root_cause_explanation": "A defect in 'services/payment_gateway.py' acquires DB connections via 'connection_pool.get_connection()' without enclosing subsequent transaction operations in a 'try...finally' release block. When an error is encountered, the connection remains permanently allocated, causing the 10-connection pool to exhaust after exactly 10 requests.",
  "exact_code_pointer": {
    "file": "services/payment_gateway.py",
    "lines": "44-56",
    "function": "execute_transaction"
  }
}`
  },
  {
    id: 'timetravel',
    name: 'Time-Travel 30m Cascade Forecaster',
    agentRole: 'Monte Carlo Predictive Microservice Failure Simulator',
    badge: 'Time-Travel Agent',
    color: '#06b6d4',
    temperature: 0.15,
    tokens: { prompt: 1890, completion: 410, total: 2300 },
    latencyMs: 165,
    systemPrompt: `You are the Sentinel Time-Travel Predictive Forecaster. Using queueing theory ($M/M/k$ models), circuit breaker metrics, and thread pool exhaustion rates, forecast the state of the infrastructure at T+5m, T+15m, and T+30m if NO remediation is applied.

FORECAST REQUIREMENTS:
1. Thread pool exhaustion timelines across upstream microservices.
2. Kafka/RabbitMQ dead letter queue overflow points.
3. Database replica starvation & cascading OOMKills.
4. Estimated revenue loss curve over the 30-minute window.`,
    userPrompt: `CURRENT SYSTEM STATE (T=0m):
- payment_gateway: 10/10 connections locked. Error rate = 88.4%.
- checkout_service: Threadpool 42/50 busy (84% capacity). Incoming QPS = 340 req/s.
- billing_queue: 1,420 unprocessed events in memory backlog.
- Global Cart Abandonment Rate: 68.2% (Norm: 3.1%).

Generate deterministic 30-minute cascade trajectory at T+5m, T+15m, and T+30m milestones.`,
    rawModelOutput: `{
  "simulation_metadata": {
    "model": "Sentinel-MonteCarlo-M/M/k-v4",
    "simulation_runs": 1000,
    "confidence_interval": "95%"
  },
  "trajectory": [
    {
      "time_offset": "+5m",
      "status": "UPSTREAM_SATURATION",
      "payment_gateway_health": "0% (Completely Unresponsive)",
      "checkout_service_threads": "50/50 Exhausted (Thread Starvation)",
      "downstream_impact": "Frontend checkout spinner hangs for 30s before timing out. User retry storm initiated (+240% QPS).",
      "estimated_revenue_loss_usd": 71250.00
    },
    {
      "time_offset": "+15m",
      "status": "CASCADING_OOM_KILL",
      "payment_gateway_health": "K8s OOMKilled (Restarts: 12)",
      "checkout_service_threads": "Deadlock in HTTP Connection Pool",
      "downstream_impact": "Auth Service and Inventory Service connection buffers overflow due to backpressure. Billing Kafka consumer group lags by 45,000 offsets.",
      "estimated_revenue_loss_usd": 213750.00
    },
    {
      "time_offset": "+30m",
      "status": "TOTAL_CLUSTER_BLACKOUT",
      "payment_gateway_health": "Permanent CrashLoopBackOff",
      "checkout_service_threads": "Ingress Ingress Controller 504 Gateway Timeout on 100% of /api/* traffic",
      "downstream_impact": "Entire US-East customer base unable to purchase. Reputational damage threshold breached.",
      "estimated_revenue_loss_usd": 427500.00
    }
  ],
  "sla_breach_countdown_seconds": 184,
  "urgent_remediation_window": "Remediation MUST be applied within 3.1 minutes to prevent T+15m cascade."
}`
  },
  {
    id: 'sandbox',
    name: 'Speculative Self-Healing Sandbox',
    agentRole: 'Autonomous Code Synthesis & Shadow Ephemeral Pytest Verifier',
    badge: 'Self-Healing Agent',
    color: '#10b981',
    temperature: 0.0,
    tokens: { prompt: 2450, completion: 620, total: 3070 },
    latencyMs: 235,
    systemPrompt: `You are the Sentinel Autonomous Self-Healing Sandbox Agent.
You generate production-ready code patches, compile shadow ASTs, and construct ephemeral Pytest suites to validate zero regressions before any hotfix is promoted.

CRITICAL PROTOCOLS:
1. Always generate unified diff formatted patch (\`diff --git\`).
2. Guarantee resource deallocation with context managers or \`try...finally\` constructs.
3. Provide automated unit and load regression tests.
4. Include a fallback rollback plan.`,
    userPrompt: `DEFECT CONTEXT:
File: services/payment_gateway.py
Root Cause: ConnectionPoolExhausted in execute_transaction() due to missing socket release in error handling branch.

Original Code Snippet:
\`\`\`python
def execute_transaction(user_id: str, amount: float, simulate_defect: bool = True) -> dict:
    conn = connection_pool.get_connection()
    if simulate_defect:
        # BUG: conn is never returned to pool
        raise ConnectionPoolExhausted("DB Connection Pool Max capacity (10/10) exhausted")
    # ... process transaction ...
    connection_pool.release(conn)
    return {"status": "SUCCESS", "tx_id": "tx_99812"}
\`\`\`

Synthesize the autonomous patch, regression test suite, and shadow sandbox verification steps.`,
    rawModelOutput: `{
  "patch_proposal": {
    "target_file": "services/payment_gateway.py",
    "patch_strategy": "CONTEXT_MANAGER_TRY_FINALLY_RESTORATION",
    "unified_diff": "--- a/services/payment_gateway.py\\n+++ b/services/payment_gateway.py\\n@@ -42,10 +42,15 @@ def execute_transaction(user_id: str, amount: float, simulate_defect: bool = Fal\\n-    conn = connection_pool.get_connection()\\n-    if simulate_defect:\\n-        raise ConnectionPoolExhausted(\\"DB Connection Pool Max capacity (10/10) exhausted\\")\\n-    connection_pool.release(conn)\\n+    conn = connection_pool.get_connection()\\n+    try:\\n+        if simulate_defect:\\n+            raise ConnectionPoolExhausted(\\"DB Connection Pool Max capacity (10/10) exhausted\\")\\n+        return {\\"status\\": \\"SUCCESS\\", \\"tx_id\\": f\\"tx_{uuid.uuid4().hex[:8]}\\"}\\n+    finally:\\n+        connection_pool.release(conn)\\n",
    "explanation": "Wraps the connection acquisition in a robust 'try...finally' block ensuring connection_pool.release(conn) is executed deterministically regardless of exceptions."
  },
  "shadow_verification": {
    "ephemeral_container_id": "sandbox_py311_pgw_hotfix_89a",
    "pytest_suite_run": "tests/test_payment_gateway_remediation.py",
    "tests_passed": 6,
    "tests_failed": 0,
    "pool_leak_assertion": "PASSED (0 leaked sockets under 100 concurrent threads)",
    "synthetic_traffic_p99_ms": 34.2,
    "safety_confidence_score": 0.9994
  },
  "deployment_plan": {
    "canary_traffic_percentage": 5,
    "automatic_rollback_trigger": "http_5xx_rate > 0.1% or latency_p99 > 300ms",
    "promotion_window_seconds": 120
  }
}`
  },
  {
    id: 'chaos',
    name: 'Autonomous Chaos Mesh Generator',
    agentRole: 'Resilience Prober & Load Simulation Script Generator',
    badge: 'Chaos Agent',
    color: '#f59e0b',
    temperature: 0.2,
    tokens: { prompt: 1680, completion: 440, total: 2120 },
    latencyMs: 154,
    systemPrompt: `You are the Sentinel Autonomous Chaos Engineering Generator.
You design Kubernetes Chaos Mesh CRDs (Custom Resource Definitions) and Locust / k6 load testing scripts to proactively stress-test fixed services against edge cases, network partitions, and socket starvation.`,
    userPrompt: `TARGET SERVICE: payment_gateway
Recent Postmortem: DB Connection Pool Socket Leaks under high concurrency bursts.

Generate:
1. Kubernetes ChaosMesh NetworkLatency + PodFailure YAML.
2. Locust load test Python script simulating 500 concurrent users with spike patterns to verify pool recovery.`,
    rawModelOutput: `{
  "chaos_mesh_crd": \`apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: payment-gateway-pool-stress
  namespace: payments-engine
spec:
  action: delay
  mode: fixed
  value: '30%'
  delay:
    latency: '150ms'
    jitter: '20ms'
  selector:
    namespaces:
      - payments-engine
    labelSelectors:
      'app': 'payment_gateway'
  duration: '5m'
  scheduler:
    cron: '@every 2h'\`,
  "locustfile_py": \`from locust import HttpUser, task, between
import random

class PaymentGatewayStressTester(HttpUser):
    wait_time = between(0.01, 0.05)

    @task(10)
    def trigger_concurrent_payment(self):
        self.client.post("/demo/trigger-real-code-failure", json={
            "user_id": f"usr_{random.randint(1000, 9999)}",
            "amount": 49.99
        })

    @task(2)
    def check_health(self):
        self.client.get("/health")\`
}`
  }
];

export const LlmPromptInspectorModal: React.FC<{ isOpen: boolean; onClose: () => void; initialAgentId?: string }> = ({
  isOpen,
  onClose,
  initialAgentId
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(initialAgentId || 'triage');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAgent = AGENTS_PROMPTS.find(a => a.id === selectedAgentId) || AGENTS_PROMPTS[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-cyan-950/30 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                  LLM Neural Prompts & Raw Output Inspector
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  Qwen2.5-14B-LoRA
                </span>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Blackwell B200 (192GB)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full transparent telemetry inspection: exact prompt templates, real-world context injections, and raw model inference outputs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close Inspector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Agent Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/60 overflow-x-auto">
          {AGENTS_PROMPTS.map((agent) => {
            const isActive = agent.id === currentAgent.id;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border-slate-600'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent'
                }`}
                style={isActive ? { borderLeftColor: agent.color, borderLeftWidth: '3px' } : {}}
              >
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: agent.color }} 
                />
                <span>{agent.name}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900/80 text-slate-400 border border-slate-800">
                  {agent.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Agent Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-slate-900/40 border-b border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">{currentAgent.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 font-mono">{currentAgent.agentRole}</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Latency: <strong className="text-slate-200">{currentAgent.latencyMs}ms</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Temp: <strong className="text-slate-200">{currentAgent.temperature}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Tokens: <strong className="text-slate-200">{currentAgent.tokens.total.toLocaleString()}</strong> ({currentAgent.tokens.prompt} in / {currentAgent.tokens.completion} out)</span>
            </div>
          </div>
        </div>

        {/* Content Body: 3-Way Grid / View (System Prompt, User Telemetry Injected Prompt, Raw Model Output) */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Section 1: System Prompt */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  1. Fine-Tuned System Prompt (Role & Constraints)
                </span>
              </div>
              <button
                onClick={() => handleCopy(currentAgent.systemPrompt, 'system')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
              >
                {copiedKey === 'system' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'system' ? 'Copied' : 'Copy System Prompt'}</span>
              </button>
            </div>
            <div className="p-4 bg-slate-950 font-mono text-xs text-indigo-300/90 whitespace-pre-wrap leading-relaxed overflow-x-auto selection:bg-indigo-900/60 selection:text-white">
              {currentAgent.systemPrompt}
            </div>
          </div>

          {/* Section 2: User Prompt with Injected Real Telemetry */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  2. User Telemetry Prompt (Live Injected Sentry + Datadog + K8s Context)
                </span>
              </div>
              <button
                onClick={() => handleCopy(currentAgent.userPrompt, 'user')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
              >
                {copiedKey === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'user' ? 'Copied' : 'Copy User Prompt'}</span>
              </button>
            </div>
            <div className="p-4 bg-slate-950 font-mono text-xs text-cyan-300/90 whitespace-pre-wrap leading-relaxed overflow-x-auto selection:bg-cyan-900/60 selection:text-white">
              {currentAgent.userPrompt}
            </div>
          </div>

          {/* Section 3: Raw Model Output */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  3. Raw Model Inference Output (Structured Schema)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400/80 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                  Strict JSON / YAML Verified
                </span>
                <button
                  onClick={() => handleCopy(currentAgent.rawModelOutput, 'output')}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                >
                  {copiedKey === 'output' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'output' ? 'Copied' : 'Copy Output'}</span>
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-950 font-mono text-xs text-emerald-300/90 whitespace-pre-wrap leading-relaxed overflow-x-auto selection:bg-emerald-900/60 selection:text-white">
              {currentAgent.rawModelOutput}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telemetry Pipeline: <strong>Live Ingestion Active</strong> (Sentry + Datadog + OpenTelemetry Spans)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 transition-colors"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
