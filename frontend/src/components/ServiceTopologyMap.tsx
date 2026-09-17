import React, { useState } from 'react';
import {
  Server, Database, Globe, Shield, Radio, Activity, AlertTriangle,
  CheckCircle2, RefreshCw, ZoomIn, ZoomOut, Layers, ArrowRight, Zap
} from 'lucide-react';

interface ServiceNode {
  id: string;
  name: string;
  type: 'gateway' | 'service' | 'database' | 'cache' | 'worker';
  status: 'healthy' | 'degraded' | 'critical';
  qps: number;
  p99LatencyMs: number;
  errorRate: number;
  instances: number;
  x: number; // percentage
  y: number; // percentage
  details: string;
}

const DEFAULT_NODES: ServiceNode[] = [
  {
    id: 'api_gw',
    name: 'API Gateway',
    type: 'gateway',
    status: 'degraded',
    qps: 1420,
    p99LatencyMs: 5140,
    errorRate: 76.4,
    instances: 8,
    x: 10,
    y: 45,
    details: 'Ingress Envoy proxy routing traffic to checkout and auth services',
  },
  {
    id: 'auth_svc',
    name: 'Auth Service',
    type: 'service',
    status: 'healthy',
    qps: 890,
    p99LatencyMs: 14,
    errorRate: 0.0,
    instances: 4,
    x: 35,
    y: 18,
    details: 'JWT token validation and OAuth2 authorization provider',
  },
  {
    id: 'checkout_svc',
    name: 'Checkout Service',
    type: 'service',
    status: 'critical',
    qps: 1240,
    p99LatencyMs: 5120,
    errorRate: 78.2,
    instances: 6,
    x: 40,
    y: 65,
    details: 'Cart checkout orchestration and order placement workflow',
  },
  {
    id: 'payment_gw',
    name: 'Payment Gateway',
    type: 'service',
    status: 'critical',
    qps: 1180,
    p99LatencyMs: 5042,
    errorRate: 88.4,
    instances: 5,
    x: 70,
    y: 65,
    details: 'DEFECT NODE: Database connection pool (10/10) saturated',
  },
  {
    id: 'postgres_master',
    name: 'PostgreSQL Master',
    type: 'database',
    status: 'critical',
    qps: 2450,
    p99LatencyMs: 5000,
    errorRate: 65.0,
    instances: 1,
    x: 90,
    y: 80,
    details: 'Primary transactional database; unreleased connection pool locks',
  },
  {
    id: 'redis_cluster',
    name: 'Redis Cache',
    type: 'cache',
    status: 'healthy',
    qps: 3400,
    p99LatencyMs: 2.1,
    errorRate: 0.0,
    instances: 3,
    x: 65,
    y: 25,
    details: 'In-memory session state and idempotency lock cluster',
  },
  {
    id: 'notification_worker',
    name: 'Notification Worker',
    type: 'worker',
    status: 'healthy',
    qps: 310,
    p99LatencyMs: 45,
    errorRate: 0.2,
    instances: 4,
    x: 90,
    y: 35,
    details: 'Kafka consumer for order confirmation emails and webhooks',
  },
];

const EDGES = [
  { from: 'api_gw', to: 'auth_svc', healthy: true },
  { from: 'api_gw', to: 'checkout_svc', healthy: false },
  { from: 'checkout_svc', to: 'payment_gw', healthy: false },
  { from: 'checkout_svc', to: 'redis_cluster', healthy: true },
  { from: 'payment_gw', to: 'postgres_master', healthy: false },
  { from: 'payment_gw', to: 'notification_worker', healthy: true },
];

export function ServiceTopologyMap({ isPatched = false }: { isPatched?: boolean }) {
  const [nodes, setNodes] = useState<ServiceNode[]>(DEFAULT_NODES);
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(DEFAULT_NODES[3]); // Payment Gateway

  // Dynamic status if patched
  const activeNodes = nodes.map(n => {
    if (isPatched) {
      return {
        ...n,
        status: 'healthy' as const,
        p99LatencyMs: n.type === 'service' ? 34 : n.type === 'database' ? 8 : 12,
        errorRate: 0.0,
      };
    }
    return n;
  });

  const getNodeIcon = (type: ServiceNode['type']) => {
    switch (type) {
      case 'gateway': return <Globe className="w-4 h-4" />;
      case 'database': return <Database className="w-4 h-4" />;
      case 'cache': return <Zap className="w-4 h-4" />;
      case 'worker': return <Activity className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  const getStatusBorder = (status: ServiceNode['status']) => {
    switch (status) {
      case 'critical': return 'border-red-500 bg-red-950/40 text-red-400 shadow-lg shadow-red-950/50';
      case 'degraded': return 'border-amber-500 bg-amber-950/30 text-amber-400';
      default: return 'border-emerald-500/60 bg-slate-900 text-emerald-400';
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl bg-[#090D16] border border-[#1F2937] overflow-hidden font-sans">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0B0F19] border-b border-[#1F2937] text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-100">Live Microservice Service Map</span>
            <span className="text-slate-500 ml-2 font-mono text-[10px]">7 Nodes · 6 Edges · us-east-1</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Healthy
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Degraded
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Critical Fault
          </span>
        </div>
      </div>

      {/* Main Canvas & Details Split */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative" style={{ minHeight: '340px' }}>
        
        {/* Topology Visual Canvas */}
        <div className="flex-1 relative bg-[#070A10] overflow-hidden p-4 select-none">
          {/* Background Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* SVG Connection Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {EDGES.map((edge, idx) => {
              const fromNode = activeNodes.find(n => n.id === edge.from);
              const toNode = activeNodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const isFailing = !isPatched && (!edge.healthy || fromNode.status === 'critical' || toNode.status === 'critical');
              return (
                <g key={idx}>
                  <line
                    x1={`${fromNode.x}%`}
                    y1={`${fromNode.y}%`}
                    x2={`${toNode.x}%`}
                    y2={`${toNode.y}%`}
                    stroke={isFailing ? '#ef4444' : '#10b981'}
                    strokeWidth={isFailing ? '2.5' : '1.5'}
                    strokeDasharray={isFailing ? '6,4' : undefined}
                    strokeOpacity={isFailing ? 0.9 : 0.4}
                  />
                  {isFailing && (
                    <circle
                      r="4"
                      fill="#ef4444"
                      className="animate-ping"
                      cx={`${(fromNode.x + toNode.x) / 2}%`}
                      cy={`${(fromNode.y + toNode.y) / 2}%`}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Service Node Cards */}
          {activeNodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isCritical = node.status === 'critical';
            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute cursor-pointer rounded-xl p-2.5 border transition-all duration-200 z-10 ${
                  getStatusBorder(node.status)
                } ${isSelected ? 'ring-2 ring-blue-400 scale-105 shadow-xl' : 'hover:scale-102'}`}
              >
                {/* Critical Fault Radar Glow */}
                {isCritical && !isPatched && (
                  <span className="absolute -inset-1 rounded-xl bg-red-500/20 animate-ping -z-10" />
                )}

                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'}`}>
                    {getNodeIcon(node.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-100">{node.name}</span>
                      {isCritical && (
                        <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-red-500 text-white font-bold animate-pulse">
                          FAULT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                      <span>{node.qps} QPS</span>
                      <span>•</span>
                      <span className={node.p99LatencyMs > 500 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                        {node.p99LatencyMs}ms
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Node Telemetry Inspector Panel */}
        {selectedNode && (
          <div className="w-full md:w-72 bg-[#0B0F19] border-t md:border-t-0 md:border-l border-[#1F2937] p-3.5 flex flex-col justify-between text-xs font-mono">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {getNodeIcon(selectedNode.type)}
                  <span className="font-bold text-slate-100">{selectedNode.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  selectedNode.status === 'critical' ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {selectedNode.status}
                </span>
              </div>

              <p className="text-[11px] font-sans text-slate-300 leading-relaxed">
                {selectedNode.details}
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">p99 Latency:</span>
                  <span className={selectedNode.p99LatencyMs > 500 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                    {selectedNode.p99LatencyMs} ms
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Error Rate:</span>
                  <span className={selectedNode.errorRate > 5 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                    {selectedNode.errorRate}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Active Replicas:</span>
                  <span className="text-slate-200">{selectedNode.instances} Pods</span>
                </div>

                <div className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Incoming QPS:</span>
                  <span className="text-blue-400 font-bold">{selectedNode.qps} req/s</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
              <span>OpenTelemetry Ingestion</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live Spans
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
