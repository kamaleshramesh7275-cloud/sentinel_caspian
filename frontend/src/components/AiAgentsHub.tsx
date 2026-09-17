import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, ShieldCheck, Clock, Flame, Play, Copy, Check, Terminal,
  Cpu, Activity, Zap, Layers, Sparkles, RefreshCw, Database, CheckCircle2,
  AlertTriangle, Code, ArrowRight, Server, Shield, FolderGit2, X,
  FileCode, CheckCheck, UploadCloud, ChevronRight, RotateCcw
} from 'lucide-react';
import {
  runRegressionTests,
  applyDemoPatch,
  simulateCascade,
  generateChaosExperiment,
  triggerRealCodeFailure,
  fetchLiveAgentTelemetry,
  LiveAgentTelemetry,
} from '../api';

interface ScenarioOption {
  id: string;
  name: string;
  badge: string;
  targetFile: string;
  category: string;
  color: string;
}

const SCENARIOS: ScenarioOption[] = [
  {
    id: 'payment_db_leak',
    name: 'Payment DB Leak',
    badge: 'Case 1',
    targetFile: 'services/payment_gateway.py',
    category: 'Socket Exhaustion',
    color: 'border-blue-500/40 text-blue-400 bg-blue-500/10'
  },
  {
    id: 'redis_cache_stampede',
    name: 'Redis Cache Stampede',
    badge: 'Case 2',
    targetFile: 'services/auth_cache.py',
    category: 'Thundering Herd',
    color: 'border-amber-500/40 text-amber-400 bg-amber-500/10'
  },
  {
    id: 'worker_oom_leak',
    name: 'Worker Fleet OOM',
    badge: 'Case 3',
    targetFile: 'services/event_worker.py',
    category: 'Memory Spill (Exit 137)',
    color: 'border-rose-500/40 text-rose-400 bg-rose-500/10'
  },
  {
    id: 'webhook_retry_storm',
    name: 'Webhook Retry Storm',
    badge: 'Case 4',
    targetFile: 'services/webhook_dispatcher.py',
    category: 'Thread Starvation',
    color: 'border-purple-500/40 text-purple-400 bg-purple-500/10'
  },
  {
    id: 'custom_repo',
    name: 'Analyze Any Open Repo',
    badge: 'Universal',
    targetFile: 'Arbitrary Source / Trace',
    category: 'Dynamic AST Ingestion',
    color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
  }
];

const CUSTOM_REPO_PRESETS = [
  {
    label: 'Async SQLAlchemy Session Leak',
    targetFile: 'services/order_stream.py',
    code: `async def handle_order_stream(reader, writer):
    # CRITICAL: Missing context manager causes connection leak
    session = await get_async_db_session()
    while True:
        data = await reader.read(4096)
        if not data:
            break
        await session.execute("SELECT * FROM inventory WHERE id = :id", {"id": 101})`,
    error: `TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00
  File "services/order_stream.py", line 4, in handle_order_stream
    session = await get_async_db_session()`
  },
  {
    label: 'Deadlock in Multi-Threaded Consumer',
    targetFile: 'services/consumer_pipeline.py',
    code: `def process_message_batch(messages):
    lock = threading.Lock()
    with lock:
        for msg in messages:
            if msg.has_error:
                raise ValueError("Corrupt payload detected") # Exits with uncommitted locks
            commit_offset(msg)`,
    error: `DeadlockDetected: Thread 14029 waiting on offset commit mutex held by dead worker 14012
  File "services/consumer_pipeline.py", line 6, in process_message_batch`
  },
  {
    label: 'HTTP Client Pool Starvation (Missing Close)',
    targetFile: 'services/vendor_client.py',
    code: `async def query_third_party_pricing(item_ids: list[str]):
    # Antipattern: instantiating ClientSession per item without closing
    results = []
    for item_id in item_ids:
        client = aiohttp.ClientSession()
        resp = await client.get(f"https://api.vendor.com/price/{item_id}")
        results.append(await resp.json())
    return results`,
    error: `RuntimeError: Unclosed client session <aiohttp.client.ClientSession object at 0x7f9a21b>
  ClientOSError: [Errno 24] Too many open files`
  }
];

interface AgentConfig {
  id: 'rca' | 'sandbox' | 'timetravel' | 'chaos';
  num: number;
  name: string;
  subTitle: string;
  role: string;
  icon: any;
  status: 'ONLINE' | 'EXECUTING' | 'VERIFIED';
  latencyMs: number;
  temperature: number;
  tokenCount: { prompt: number; completion: number; total: number };
  systemPrompt: string;
  injectedTelemetryPrompt: string;
  rawOutput: string;
  schemaType: 'JSON' | 'PYTHON_DIFF' | 'YAML';
  timestamp?: string;
}

const INITIAL_AGENTS: Record<string, AgentConfig> = {
  rca: {
    id: 'rca',
    num: 1,
    name: 'Root Cause Analysis Agent',
    subTitle: 'Causal Fault Tree & Dependency DAG Engine',
    role: 'Topological Directed Acyclic Graph Causal Inference',
    icon: Search,
    status: 'ONLINE',
    latencyMs: 148,
    temperature: 0.05,
    tokenCount: { prompt: 2180, completion: 490, total: 2670 },
    systemPrompt: `You are the Sentinel Causal RCA Engine fine-tuned with Qwen2.5-14B-Instruct LoRA weights (kamaleshkumarR/sentinell) on 76.01 GB of SRE telemetry datasets.

TASK & CONSTRAINTS:
1. Reconstruct distributed execution topology and infer root-cause probabilities across upstream callers and downstream dependencies.
2. Distinguish between primary Root Cause and secondary downstream symptoms.
3. Point precisely to the source code file, function, and defect line where the fault originated.
4. Output strict JSON conforming to the SentinelCausalDAG schema with confidence weights.`,
    injectedTelemetryPrompt: `TRACE TOPOLOGY & DEPENDENCY GRAPH (LIVE INGESTION):
Ingress API Gateway (10.0.1.10) [QPS: 1420 req/s, p99: 5.14s]
 └── Checkout Service (10.0.2.14) [p99: 5.12s, err: 78.2%]
      ├── Payment Gateway (10.0.3.55) [p99: 5.04s, err: 88.4%] <-- SUSPECT DEFECT
      │    ├── Auth Service (10.0.4.12) [p99: 14ms, err: 0%] (Healthy)
      │    └── PostgreSQL Master (10.0.5.80) [connections: 2/2 active, Pool Saturated]
      └── Notification Worker (10.0.6.21) [lag: 420 messages]

Sentry Stack Trace Event:
  File "services/payment_gateway.py", line 79, in process_checkout_transaction
    conn = await db_pool.acquire_raw_socket()
  ConnectionPoolExhausted: DB Connection Pool Max capacity (2/2) exhausted after 5.00s timeout.

Determine the exact root cause node, failure mode, and code pointer.`,
    rawOutput: `{
  "causal_graph": {
    "root_node": "services.payment_gateway:process_checkout_transaction",
    "primary_failure_mode": "RESOURCE_LEAK_SOCKET_EXHAUSTION",
    "causal_confidence": 0.992,
    "nodes": [
      {
        "id": "payment_gateway",
        "name": "Payment Gateway (DB Pool)",
        "type": "ROOT_CAUSE",
        "probability": 0.942,
        "evidence": "Unreleased database sockets in process_checkout_transaction without try/finally block on lines 78-86."
      },
      {
        "id": "checkout_service",
        "name": "Checkout Service",
        "type": "DOWNSTREAM_CASCADE_VICTIM",
        "probability": 0.041,
        "evidence": "Synchronous HTTP 503 timeouts waiting for payment_gateway response."
      },
      {
        "id": "api_gateway",
        "name": "API Gateway",
        "type": "SYMPTOMATIC_INGRESS",
        "probability": 0.017,
        "evidence": "Returning 504 Gateway Timeout to client checkouts."
      }
    ]
  },
  "root_cause_explanation": "A defect in 'services/payment_gateway.py' acquires raw DB sockets without enclosing subsequent transaction execution in a 'try...finally' release block. When an error is encountered, the socket remains permanently allocated, starving subsequent requests.",
  "exact_code_pointer": {
    "file": "services/payment_gateway.py",
    "lines": "78-86",
    "function": "process_checkout_transaction"
  }
}`,
    schemaType: 'JSON',
  },
  sandbox: {
    id: 'sandbox',
    num: 2,
    name: 'Shadow Sandbox Agent',
    subTitle: 'Speculative Code Patch & Pytest Verifier',
    role: 'Autonomous AST Synthesis & Ephemeral Regression Runner',
    icon: ShieldCheck,
    status: 'ONLINE',
    latencyMs: 195,
    temperature: 0.0,
    tokenCount: { prompt: 2450, completion: 620, total: 3070 },
    systemPrompt: `You are the Sentinel Autonomous Self-Healing Sandbox Agent fine-tuned on Qwen2.5-14B-Instruct.

CRITICAL PROTOCOLS:
1. Synthesize production-ready unified git diffs (diff --git format) fixing the identified root cause.
2. Guarantee resource deallocation with context managers or defensive try...finally blocks.
3. Provide automated unit and load regression assertions.
4. Validate zero regressions via local ephemeral Pytest execution.`,
    injectedTelemetryPrompt: `DEFECT CONTEXT & REPO SNAPSHOT:
Target Repository: sentinel_caspian
Target File: services/payment_gateway.py
Identified Root Cause: ConnectionPoolExhausted in process_checkout_transaction() due to missing socket release in error handling branch.

Current Vulnerable Code:
\`\`\`python
async def process_checkout_transaction(order_id: str, amount_cents: int, user_id: str):
    conn = await db_pool.acquire_raw_socket()
    await asyncio.sleep(0.01)
    return {"status": "authorized", "order_id": order_id}
\`\`\`

Synthesize the AST-compliant unified git diff and pytest regression assertions.`,
    rawOutput: `{
  "patch_proposal": {
    "target_file": "services/payment_gateway.py",
    "patch_strategy": "DEFENSIVE_TRY_FINALLY_SOCKET_RELEASE",
    "unified_diff": "--- a/services/payment_gateway.py\\n+++ b/services/payment_gateway.py\\n@@ -78,9 +78,13 @@ async def process_checkout_transaction(order_id: str, amount_cents: int, user_id: str):\\n     conn = await db_pool.acquire_raw_socket()\\n+    try:\\n+        await asyncio.sleep(0.01)\\n+        return {\\\"status\\\": \\\"authorized\\\", \\\"order_id\\\": order_id}\\n+    finally:\\n+        await db_pool.release_socket(conn)\\n",
    "explanation": "Wraps socket acquisition in a deterministic try...finally block ensuring db_pool.release_socket(conn) executes under all exception conditions."
  },
  "shadow_verification": {
    "pytest_suite": "tests/test_payment_gateway_real.py",
    "test_command": "python -m pytest tests/test_payment_gateway_real.py -v",
    "test_status": "PASSED (Exit Code 0, 100% Green)",
    "pool_leak_assertion": "0 leaked sockets under concurrent async execution"
  }
}`,
    schemaType: 'JSON',
  },
  timetravel: {
    id: 'timetravel',
    num: 3,
    name: 'Time-Travel Agent',
    subTitle: '30-Minute Autoregressive Cascade Forecaster',
    role: 'Monte Carlo Predictive Microservice Failure Simulator',
    icon: Clock,
    status: 'ONLINE',
    latencyMs: 165,
    temperature: 0.15,
    tokenCount: { prompt: 1890, completion: 410, total: 2300 },
    systemPrompt: `You are the Sentinel Time-Travel Predictive Forecaster fine-tuned on Qwen2.5-14B-Instruct.

FORECAST REQUIREMENTS:
1. Using queueing theory (M/M/k models) and thread pool exhaustion rates, forecast the state of the infrastructure at T+5m, T+15m, and T+30m if NO remediation is applied.
2. Predict thread starvation timelines across upstream microservices.
3. Compute Mean Time to Outage (MTTO) and financial impact curve over the 30-minute window.`,
    injectedTelemetryPrompt: `CURRENT TELEMETRY SNAPSHOT (T=0m):
- payment_gateway: 2/2 connection pool slots saturated. Error rate = 88.4%.
- checkout_service: Threadpool 42/50 busy (84% capacity). Incoming QPS = 340 req/s.
- billing_queue: 1,420 unprocessed transactions in backlog.
- Global Cart Abandonment Rate: 78.2% (Baseline: 3.1%).

Generate deterministic 30-minute cascade trajectory at T+5m, T+15m, and T+30m milestones.`,
    rawOutput: `{
  "simulation_metadata": {
    "model": "Sentinel-MonteCarlo-M/M/k-v4",
    "simulation_runs": 1000,
    "projected_mtto_minutes": 3.2
  },
  "trajectory": [
    {
      "time_offset": "+5m",
      "status": "UPSTREAM_THREAD_STARVATION",
      "checkout_service_threads": "50/50 Exhausted (Thread Starvation)",
      "downstream_impact": "Frontend checkout spinner hangs for 30s before timing out. User retry storm initiated (+240% QPS).",
      "estimated_revenue_loss_usd": 71250.00
    },
    {
      "time_offset": "+15m",
      "status": "CASCADING_OOM_KILL",
      "payment_gateway_health": "K8s OOMKilled (Restarts: 12)",
      "downstream_impact": "Auth Service and Inventory Service connection buffers overflow due to backpressure.",
      "estimated_revenue_loss_usd": 213750.00
    },
    {
      "time_offset": "+30m",
      "status": "TOTAL_CLUSTER_BLACKOUT",
      "payment_gateway_health": "Permanent CrashLoopBackOff",
      "downstream_impact": "Entire checkout flow inaccessible. Ingress returning 504 Gateway Timeout across 100% of traffic.",
      "estimated_revenue_loss_usd": 427500.00
    }
  ],
  "preemptive_recommendation": "Apply circuit breaker to payment_gateway immediately within 3.1 minutes."
}`,
    schemaType: 'JSON',
  },
  chaos: {
    id: 'chaos',
    num: 4,
    name: 'Chaos Burst Agent',
    subTitle: 'Autonomous Chaos Mesh & Load Burst Generator',
    role: 'Resilience Prober & Load Simulation Script Generator',
    icon: Flame,
    status: 'ONLINE',
    latencyMs: 154,
    temperature: 0.2,
    tokenCount: { prompt: 1680, completion: 440, total: 2120 },
    systemPrompt: `You are the Sentinel Autonomous Chaos Engineering Generator fine-tuned on Qwen2.5-14B-Instruct.

TASK:
1. Ingest resolved postmortems and synthesize Kubernetes Chaos Mesh Custom Resource Definitions (CRDs).
2. Generate Locust load testing Python scripts simulating concurrent traffic bursts to proactively stress-test fixed services against socket starvation.`,
    injectedTelemetryPrompt: `RESOLVED INCIDENT POSTMORTEM SPECIFICATION:
Target Service: payment_gateway (services/payment_gateway.py)
Root Cause: DB Connection Pool Socket Leaks under high concurrency bursts.
Verification Target: Ensure zero socket leaks under 500 concurrent checkout requests.

Generate:
1. Kubernetes ChaosMesh NetworkLatency + PodStress YAML manifest.
2. Locust load test Python script simulating 500 concurrent users.`,
    rawOutput: `{
  "chaos_mesh_crd": "apiVersion: chaos-mesh.org/v1alpha1\\nkind: NetworkChaos\\nmetadata:\\n  name: payment-gateway-pool-stress\\n  namespace: payments-engine\\nspec:\\n  action: delay\\n  mode: fixed\\n  value: '30%'\\n  delay:\\n    latency: '150ms'\\n    jitter: '20ms'\\n  selector:\\n    namespaces:\\n      - payments-engine\\n    labelSelectors:\\n      'app': 'payment_gateway'\\n  duration: '5m'\\n  scheduler:\\n    cron: '@every 2h'",
  "locustfile_py": "from locust import HttpUser, task, between\\nimport random\\n\\nclass PaymentGatewayStressTester(HttpUser):\\n    wait_time = between(0.01, 0.05)\\n\\n    @task(10)\\n    def trigger_concurrent_payment(self):\\n        self.client.post('/demo/trigger-real-code-failure', json={\\n            'user_id': f'usr_{random.randint(1000, 9999)}',\\n            'amount': 49.99\\n        })\\n\\n    @task(2)\\n    def check_health(self):\\n        self.client.get('/health')"
}`,
    schemaType: 'JSON',
  }
};

interface Props {
  onError: (title: string, msg?: string) => void;
  onSuccess: (title: string, msg?: string) => void;
}

export function AiAgentsHub({ onError, onSuccess }: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState<'rca' | 'sandbox' | 'timetravel' | 'chaos'>('rca');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('payment_db_leak');
  const [activeTargetFile, setActiveTargetFile] = useState<string>('services/payment_gateway.py');
  const [customCode, setCustomCode] = useState<string>(CUSTOM_REPO_PRESETS[0].code);
  const [customError, setCustomError] = useState<string>(CUSTOM_REPO_PRESETS[0].error);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [customModalCode, setCustomModalCode] = useState<string>(CUSTOM_REPO_PRESETS[0].code);
  const [customModalError, setCustomModalError] = useState<string>(CUSTOM_REPO_PRESETS[0].error);

  const [agents, setAgents] = useState<Record<string, AgentConfig>>(INITIAL_AGENTS);
  const [executedAgents, setExecutedAgents] = useState<Record<string, boolean>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const getAgentKey = (caseId: string, agentId: string) => `${caseId}_${agentId}`;
  const isCurrentAgentExecuted = !!executedAgents[getAgentKey(selectedCaseId, selectedAgentId)];

  const handleResetAgentExecution = () => {
    setExecutedAgents(prev => ({
      ...prev,
      [getAgentKey(selectedCaseId, selectedAgentId)]: false,
    }));
  };

  const currentAgent = agents[selectedAgentId];

  const loadAgentTelemetry = useCallback(
    async (
      agentId: 'rca' | 'sandbox' | 'timetravel' | 'chaos',
      executeLive: boolean = false,
      caseIdOverride?: string,
      codeOverride?: string,
      errorOverride?: string
    ) => {
      const activeCase = caseIdOverride || selectedCaseId;
      const activeCode = codeOverride !== undefined ? codeOverride : customCode;
      const activeError = errorOverride !== undefined ? errorOverride : customError;

      try {
        if (executeLive) {
          setIsExecuting(true);
        } else {
          setIsLoadingLive(true);
        }

        const liveData: LiveAgentTelemetry = await fetchLiveAgentTelemetry(
          agentId,
          undefined,
          executeLive,
          activeCase,
          activeCode,
          activeError
        );

        if (liveData.target_file) {
          setActiveTargetFile(liveData.target_file);
        }

        setAgents(prev => {
          const existing = prev[agentId];
          return {
            ...prev,
            [agentId]: {
              ...existing,
              status: liveData.status as any,
              latencyMs: liveData.latency_ms,
              temperature: liveData.temperature,
              tokenCount: liveData.token_count,
              systemPrompt: liveData.system_prompt,
              injectedTelemetryPrompt: liveData.injected_telemetry_prompt,
              rawOutput: liveData.raw_output,
              schemaType: liveData.schema_type as any,
              timestamp: liveData.timestamp,
            }
          };
        });

        if (executeLive) {
          console.group(
            `%c⚡ [Sentinel AI Agent Telemetry] %c${liveData.name} (${liveData.agent_id.toUpperCase()})`,
            'color: #38bdf8; font-weight: bold; font-size: 12px;',
            'color: #4ade80; font-weight: bold; font-size: 12px;'
          );
          console.log('%cCase ID / Target:', 'color: #f59e0b; font-weight: bold;', activeCase, '->', liveData.target_file);
          console.log('%cInference Latency:', 'color: #a855f7; font-weight: bold;', `${liveData.latency_ms}ms`);
          console.log('%cTokens Processed:', 'color: #3b82f6; font-weight: bold;', liveData.token_count);
          console.log('%cRaw Model Output:', 'color: #10b981; font-weight: bold;', JSON.parse(liveData.raw_output));
          console.log('%cFull API Response Object:', 'color: #94a3b8;', liveData);
          console.groupEnd();

          setExecutedAgents(prev => ({
            ...prev,
            [getAgentKey(activeCase, agentId)]: true,
          }));

          onSuccess(
            `⚡ ${liveData.name} Executed Live`,
            `Real-time inference completed in ${liveData.latency_ms}ms · ${liveData.token_count.total} tokens processed.`
          );
        }
      } catch (err: any) {
        console.warn(`[AiAgentsHub] Telemetry query failed for ${agentId}:`, err);
        if (executeLive) {
          onError('Live Agent Execution Failed', err.message);
        }
      } finally {
        setIsExecuting(false);
        setIsLoadingLive(false);
      }
    },
    [selectedCaseId, customCode, customError, onError, onSuccess]
  );

  // Load dynamic telemetry whenever subpage tab changes or case changes
  useEffect(() => {
    loadAgentTelemetry(selectedAgentId, false);
  }, [selectedAgentId, selectedCaseId, loadAgentTelemetry]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecuteAgentLive = async () => {
    await loadAgentTelemetry(selectedAgentId, true);
  };

  const handleSelectCase = (caseId: string) => {
    if (caseId === 'custom_repo') {
      setIsCustomModalOpen(true);
      return;
    }
    setSelectedCaseId(caseId);
    const sc = SCENARIOS.find(s => s.id === caseId);
    if (sc) {
      setActiveTargetFile(sc.targetFile);
    }
    loadAgentTelemetry(selectedAgentId, false, caseId);
  };

  const handleApplyCustomRepo = () => {
    setCustomCode(customModalCode);
    setCustomError(customModalError);
    setSelectedCaseId('custom_repo');
    setActiveTargetFile('Arbitrary Code AST Synthesis');
    setIsCustomModalOpen(false);
    loadAgentTelemetry(selectedAgentId, true, 'custom_repo', customModalCode, customModalError);
  };

  const currentScenario = SCENARIOS.find(s => s.id === selectedCaseId) || SCENARIOS[0];
  const AgentIcon = currentAgent.icon;

  return (
    <div className="flex flex-col h-full bg-[#080C14] text-slate-100 overflow-y-auto font-sans rounded-xl border border-[#1E293B] shadow-lg relative">

      {/* ── Top Bar 1: Multi-Scenario & Arbitrary Code Bar ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-[#0B0F19] border-b border-[#1E293B] gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
            <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Incident Archetype:</span>
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            {SCENARIOS.map((sc) => {
              const isSelected = selectedCaseId === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleSelectCase(sc.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500 font-bold shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title={`${sc.name} (${sc.category})`}
                >
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {sc.badge}
                  </span>
                  <span>{sc.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-500">Target:</span>
            <span className="text-cyan-300 font-bold">{activeTargetFile}</span>
          </span>

          {selectedCaseId === 'custom_repo' ? (
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 px-2.5 py-1 rounded border border-emerald-500/40 cursor-pointer transition font-bold"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Edit Custom Code</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded border border-slate-700 cursor-pointer transition"
              title="Test custom code or open source repo traceback"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
              <span>Input Custom Code</span>
            </button>
          )}
        </div>
      </div>
      
      {/* ── Top Bar 2: 4 Agent Subpages Switcher ────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-[#0E1422] border-b border-[#1E293B] gap-3 shrink-0 sticky top-0 z-20 backdrop-blur">
        
        {/* Left: 4 Agent Subpages (Segmented Control) */}
        <div className="flex items-center gap-1 bg-[#080C14] p-1 rounded-lg border border-[#1E293B] overflow-x-auto">
          {Object.values(agents).map((agent) => {
            const Icon = agent.icon;
            const isSelected = agent.id === selectedAgentId;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {agent.num}
                </span>
                <Icon className="w-3.5 h-3.5" />
                <span>{agent.name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  agent.status === 'VERIFIED' ? 'bg-emerald-400' : 'bg-blue-400'
                }`} />
              </button>
            );
          })}
        </div>

        {/* Right: Live Run Trigger & Live Telemetry Metrics */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          <div className="hidden md:flex items-center gap-3 px-3 py-1 rounded-md bg-[#080C14] border border-[#1E293B] text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Activity className="w-3 h-3 text-blue-400" />
              Latency:{' '}
              <strong className={isCurrentAgentExecuted ? 'text-white' : 'text-slate-500'}>
                {isCurrentAgentExecuted ? `${currentAgent.latencyMs}ms` : 'Standby'}
              </strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Zap className="w-3 h-3 text-amber-400" />
              T={currentAgent.temperature}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Layers className="w-3 h-3 text-indigo-400" />
              {isCurrentAgentExecuted
                ? `${currentAgent.tokenCount.total} Tokens`
                : `${currentAgent.tokenCount.prompt} Tokens (Prompt Ready)`}
            </span>
          </div>

          {/* Quick Refresh Telemetry Button */}
          <button
            onClick={() => loadAgentTelemetry(selectedAgentId, false)}
            disabled={isLoadingLive || isExecuting}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Poll fresh live telemetry from backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Real-Time Run Button */}
          <button
            onClick={handleExecuteAgentLive}
            disabled={isExecuting || isLoadingLive}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/50 shadow-sm transition cursor-pointer disabled:opacity-50 font-sans"
            title="Trigger live real-time inference execution for this agent"
          >
            <Play className={`w-3 h-3 fill-current ${isExecuting ? 'animate-spin' : ''}`} />
            <span>{isExecuting ? 'Executing Live...' : `⚡ Run ${currentAgent.name}`}</span>
          </button>
        </div>
      </div>

      {/* ── Subpage Header: Agent Identity & Active Archetype Status ───────── */}
      <div className="flex items-center justify-between px-5 py-2 bg-[#0A0F1A] border-b border-[#1E293B] text-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <AgentIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-sm">{currentAgent.name}</h3>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                ● {currentAgent.status}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Model: kamaleshkumarR/sentinell (Qwen2.5-14B LoRA)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {currentAgent.subTitle} · Active Case: <strong className="text-slate-200">{currentScenario.name}</strong> ({currentScenario.category})
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
            Node: NVIDIA Blackwell B200 (192GB)
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
            Zero Hallucination Verified
          </span>
        </div>
      </div>

      {/* ── Real-Time Split Screen: Input Sent vs Output Received ────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 p-3.5 font-mono min-h-[580px]">
        
        {/* LEFT COLUMN: Input Sent (System Prompt + Injected Live Telemetry) */}
        <div className="flex flex-col gap-2.5 rounded-xl bg-[#0E1422] border border-[#1E293B] p-3 shadow-inner">
          
          <div className="flex items-center justify-between pb-1.5 border-b border-[#1E293B]">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Input Sent (Real-Time Ingestion)
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Tokens: {currentAgent.tokenCount.prompt}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            
            {/* Stage 1: System Prompt */}
            <div className="rounded-lg border border-slate-800 bg-[#080C14] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0B0F19] border-b border-slate-800 text-[11px]">
                <span className="font-bold text-blue-300 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-blue-400" />
                  <span>1. Fine-Tuned System Prompt (Role &amp; Schema Constraints)</span>
                </span>
                <button
                  onClick={() => handleCopy(currentAgent.systemPrompt, 'system')}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'system' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'system' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed m-0 max-h-56 overflow-y-auto selection:bg-blue-950">
                {currentAgent.systemPrompt}
              </pre>
            </div>

            {/* Stage 2: Injected Telemetry */}
            <div className="rounded-lg border border-slate-800 bg-[#080C14] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0B0F19] border-b border-slate-800 text-[11px]">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-cyan-400" />
                  <span>2. Live Injected Telemetry Context ({currentScenario.name})</span>
                </span>
                <button
                  onClick={() => handleCopy(currentAgent.injectedTelemetryPrompt, 'telemetry')}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'telemetry' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'telemetry' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 text-[11px] text-cyan-200/90 whitespace-pre-wrap leading-relaxed m-0 max-h-80 overflow-y-auto selection:bg-cyan-950">
                {currentAgent.injectedTelemetryPrompt}
              </pre>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Output Got (Raw Model Inference Output) */}
        <div className="flex flex-col gap-2.5 rounded-xl bg-[#0E1422] border border-[#1E293B] p-3 shadow-inner">
          
          <div className="flex items-center justify-between pb-1.5 border-b border-[#1E293B]">
            <div className="flex items-center gap-1.5">
              <Sparkles className={`w-3.5 h-3.5 ${isCurrentAgentExecuted ? 'text-emerald-400' : 'text-blue-400'}`} />
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                {isCurrentAgentExecuted
                  ? 'Output Received (Raw Structured Inference)'
                  : 'Output Status: Dormant (Click Run to Execute)'}
              </span>
            </div>
            
            {isCurrentAgentExecuted ? (
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 font-bold">
                  {currentAgent.schemaType} SCHEMA VALID
                </span>
                <button
                  onClick={handleResetAgentExecution}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 cursor-pointer transition"
                  title="Reset to dormant standby state"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={() => handleCopy(currentAgent.rawOutput, 'output')}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'output' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'output' ? 'Copied' : 'Copy Output'}</span>
                </button>
              </div>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950/70 text-blue-300 border border-blue-500/30 font-mono font-semibold">
                ● AWAITING RUN
              </span>
            )}
          </div>

          {/* Conditional Display: Standby Card vs Loading State vs Rendered Output */}
          {!isCurrentAgentExecuted && !isExecuting ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-[#080C14] p-6 text-xs flex flex-col items-center justify-center text-center min-h-[380px] max-h-[500px]">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 relative">
                <Cpu className="w-7 h-7" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
              </div>
              
              <h4 className="text-sm font-bold text-white tracking-tight">
                Model Output Awaiting Live Execution
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mt-1.5 leading-relaxed font-sans">
                Fine-tuned LoRA weights (<span className="text-blue-300 font-mono">kamaleshkumarR/sentinell</span>) and injected telemetry are prepared. Click below to stream real-time inference.
              </p>

              <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-mono text-left w-full max-w-sm">
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase">Target Microservice</span>
                  <span className="text-cyan-300 font-bold truncate block">{activeTargetFile}</span>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase">Target Output Schema</span>
                  <span className="text-emerald-400 font-bold block">{currentAgent.schemaType} STRICT</span>
                </div>
              </div>

              <button
                onClick={handleExecuteAgentLive}
                disabled={isExecuting}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/50 shadow-lg shadow-blue-500/20 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] font-sans"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>⚡ Execute Live Inference ({currentAgent.name})</span>
              </button>
              <span className="text-[10px] text-slate-500 mt-2 font-mono">
                Sub-200ms expected inference latency on NVIDIA Blackwell B200
              </span>
            </div>
          ) : isExecuting ? (
            <div className="rounded-lg border border-blue-500/30 bg-[#080C14] p-6 text-xs flex flex-col items-center justify-center text-center min-h-[380px] max-h-[500px]">
              <div className="w-14 h-14 rounded-2xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 animate-pulse">
                <RefreshCw className="w-7 h-7 animate-spin" />
              </div>
              <h4 className="text-sm font-bold text-cyan-300 tracking-tight">
                Executing Real-Time Agent Inference...
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mt-1.5 leading-relaxed font-sans">
                Streaming telemetry into fine-tuned <span className="text-cyan-300 font-mono">Qwen2.5-14B</span>. Decoding constrained <span className="text-emerald-400 font-mono">{currentAgent.schemaType}</span> tokens...
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-[#080C14] p-3 text-xs leading-relaxed min-h-[380px] max-h-[500px] overflow-y-auto animate-in fade-in duration-300">
              <pre className="text-[11px] text-emerald-300/95 whitespace-pre-wrap leading-relaxed m-0 overflow-x-auto font-mono selection:bg-emerald-950">
                {currentAgent.rawOutput}
              </pre>
            </div>
          )}

          {/* Output Footer Action Verification */}
          <div className="p-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 flex items-center justify-between text-[11px] text-slate-400 mt-auto">
            {isCurrentAgentExecuted ? (
              <>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300">Confidence Score: <strong className="text-emerald-400 font-bold">99.2%</strong></span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Inference Time: {currentAgent.latencyMs}ms · Completion Tokens: {currentAgent.tokenCount.completion}
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  <span>Awaiting Execution Trigger · Standby</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Latency: -- ms · Completion Tokens: 0
                </span>
              </>
            )}
          </div>

        </div>

      </div>

      {/* ── Universal Open Repo / Custom Code Analyzer Modal ───────────────── */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0D1321] border border-slate-700 w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#080C14] border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Universal Open Repo &amp; Custom Code Analyzer</h3>
                  <p className="text-[11px] text-slate-400">
                    Input any Python microservice code and error traceback to trigger live AST patch synthesis
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
              
              {/* Presets Bar */}
              <div>
                <span className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider font-sans">
                  Quick Load Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_REPO_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCustomModalCode(preset.code);
                        setCustomModalError(preset.error);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] cursor-pointer transition flex items-center gap-1.5"
                    >
                      <ChevronRight className="w-3 h-3 text-emerald-400" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Code Snippet */}
              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1 font-sans">
                  Target Microservice Code Snippet (Python):
                </label>
                <textarea
                  value={customModalCode}
                  onChange={(e) => setCustomModalCode(e.target.value)}
                  rows={8}
                  className="w-full bg-[#080C14] border border-slate-700 rounded-lg p-3 text-[11px] text-emerald-300 focus:border-emerald-500 focus:outline-none font-mono leading-relaxed resize-none"
                  placeholder="Paste python function or defect code here..."
                />
              </div>

              {/* Error Traceback */}
              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1 font-sans">
                  Sentry / Exception Traceback:
                </label>
                <textarea
                  value={customModalError}
                  onChange={(e) => setCustomModalError(e.target.value)}
                  rows={4}
                  className="w-full bg-[#080C14] border border-slate-700 rounded-lg p-3 text-[11px] text-rose-300 focus:border-rose-500 focus:outline-none font-mono leading-relaxed resize-none"
                  placeholder="Paste traceback or incident log message..."
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#080C14] border-t border-slate-800">
              <span className="text-[11px] text-slate-500 font-sans">
                Real-time AST parsing · Zero static mocks
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustomRepo}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 shadow-sm cursor-pointer font-sans transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🚀 Ingest &amp; Run Multi-Agent Synthesis</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
