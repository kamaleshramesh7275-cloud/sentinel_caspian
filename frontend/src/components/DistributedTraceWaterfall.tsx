import React, { useState } from 'react';
import {
  Activity, Clock, ChevronRight, ChevronDown, AlertCircle, CheckCircle2,
  Database, Server, Globe, Terminal, Copy, Check
} from 'lucide-react';

interface Span {
  id: string;
  service: string;
  name: string;
  durationMs: number;
  offsetMs: number;
  status: 'ok' | 'error';
  httpStatus?: number;
  tags: Record<string, string>;
  errorDetails?: {
    exception: string;
    message: string;
    stackTrace: string;
  };
  children?: Span[];
}

const TRACE_DATA: Span = {
  id: 'span_root_001',
  service: 'api-gateway',
  name: 'POST /api/v1/checkout/charge',
  durationMs: 5142.8,
  offsetMs: 0,
  status: 'error',
  httpStatus: 504,
  tags: {
    'http.method': 'POST',
    'http.route': '/api/v1/checkout/charge',
    'http.status_code': '504',
    'client.ip': '192.168.1.105',
  },
  children: [
    {
      id: 'span_auth_002',
      service: 'auth-service',
      name: 'validate_jwt_token',
      durationMs: 14.2,
      offsetMs: 2.1,
      status: 'ok',
      httpStatus: 200,
      tags: {
        'auth.user_id': 'usr_99812_corp',
        'auth.scope': 'checkout:write',
      },
    },
    {
      id: 'span_chk_003',
      service: 'checkout-service',
      name: 'process_order_cart',
      durationMs: 5120.4,
      offsetMs: 18.5,
      status: 'error',
      httpStatus: 503,
      tags: {
        'cart.items_count': '3',
        'cart.total_usd': '149.99',
        'error': 'true',
      },
      children: [
        {
          id: 'span_pgw_004',
          service: 'payment-gateway',
          name: 'services.payment_gateway:execute_transaction',
          durationMs: 5042.8,
          offsetMs: 24.2,
          status: 'error',
          tags: {
            'code.filepath': 'services/payment_gateway.py:46',
            'pool.capacity': '10',
            'pool.active': '10',
          },
          errorDetails: {
            exception: 'services.payment_gateway.ConnectionPoolExhausted',
            message: 'DB Connection Pool Max capacity (10/10) exhausted after 5.00s timeout.',
            stackTrace: `Traceback (most recent call last):
  File "/app/services/payment_gateway.py", line 46, in execute_transaction
    conn = connection_pool.get_connection()
  File "/app/services/payment_gateway.py", line 28, in get_connection
    raise ConnectionPoolExhausted("DB Connection Pool Max capacity (10/10) exhausted after 5.00s timeout.")
services.payment_gateway.ConnectionPoolExhausted: DB Connection Pool Max capacity (10/10) exhausted after 5.00s timeout.`,
          },
          children: [
            {
              id: 'span_db_005',
              service: 'postgresql-master',
              name: 'db_pool.acquire_socket',
              durationMs: 5000.0,
              offsetMs: 25.1,
              status: 'error',
              tags: {
                'db.system': 'postgresql',
                'db.instance': 'pg_prod_primary',
                'pool.wait_timeout': '5000ms',
              },
            }
          ]
        }
      ]
    }
  ]
};

export function DistributedTraceWaterfall() {
  const [selectedSpan, setSelectedSpan] = useState<Span>(TRACE_DATA.children![1].children![0]); // payment-gateway span
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    span_root_001: true,
    span_chk_003: true,
    span_pgw_004: true,
  });
  const [copied, setCopied] = useState(false);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalDuration = TRACE_DATA.durationMs;

  const renderSpan = (span: Span, depth = 0) => {
    const isExpanded = expandedIds[span.id] ?? true;
    const isSelected = selectedSpan?.id === span.id;
    const isError = span.status === 'error';
    const leftPct = (span.offsetMs / totalDuration) * 100;
    const widthPct = Math.max((span.durationMs / totalDuration) * 100, 1.5);

    return (
      <div key={span.id} className="space-y-1">
        <div
          onClick={() => setSelectedSpan(span)}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition text-xs font-mono select-none ${
            isSelected
              ? 'bg-slate-800 border-blue-500 shadow-sm'
              : 'bg-[#0B0F19] border-slate-800/80 hover:bg-slate-900/60'
          }`}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          {/* Left: Service & Operation */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {span.children && span.children.length > 0 ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(span.id, e)}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0 ${
              span.service.includes('gateway')
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : span.service.includes('postgres')
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            }`}>
              {span.service}
            </span>

            <span className="truncate text-slate-200 text-[11px]">{span.name}</span>

            {isError && (
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-500/20 text-red-400 border border-red-500/40 shrink-0 font-bold">
                {span.httpStatus ? `HTTP ${span.httpStatus}` : 'ERROR'}
              </span>
            )}
          </div>

          {/* Right: Gantt Timing Bar */}
          <div className="w-48 sm:w-64 flex items-center gap-3 shrink-0 ml-4">
            <div className="flex-1 h-3 rounded-full bg-slate-950 border border-slate-800 relative overflow-hidden">
              <div
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                className={`absolute top-0 bottom-0 rounded-full ${
                  isError ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-blue-500 to-emerald-500'
                }`}
              />
            </div>
            <span className={`w-16 text-right text-[11px] font-bold ${isError ? 'text-red-400' : 'text-slate-300'}`}>
              {span.durationMs.toFixed(1)}ms
            </span>
          </div>
        </div>

        {/* Render nested child spans */}
        {isExpanded && span.children && (
          <div className="space-y-1">
            {span.children.map(child => renderSpan(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full rounded-xl bg-[#090D16] border border-[#1F2937] overflow-hidden font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0B0F19] border-b border-[#1F2937] text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-100">OpenTelemetry Distributed Trace Waterfall</span>
            <span className="text-slate-500 ml-2 font-mono text-[10px]">Trace ID: tr_894a_0219ff_99c</span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-slate-400">Total Latency: <strong className="text-red-400">{totalDuration.toFixed(1)}ms</strong></span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 text-red-300 border border-red-500/40 font-bold">
            HTTP 504 TIMEOUT
          </span>
        </div>
      </div>

      {/* Waterfall Body + Span Inspector */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left: Gantt Waterfall Spans */}
        <div className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            <span>Nested Call Hierarchy</span>
            <span>Duration (ms) &amp; Timeline</span>
          </div>
          {renderSpan(TRACE_DATA)}
        </div>

        {/* Right: Selected Span Inspector Drawer */}
        {selectedSpan && (
          <div className="w-full lg:w-80 bg-[#0B0F19] border-t lg:border-t-0 lg:border-l border-[#1F2937] p-4 flex flex-col justify-between overflow-y-auto text-xs font-mono">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-200 truncate">{selectedSpan.service}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedSpan.status === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {selectedSpan.status.toUpperCase()}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase">Operation:</span>
                <div className="text-slate-200 text-[11px] font-semibold mt-0.5">{selectedSpan.name}</div>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase">Attributes &amp; Tags:</span>
                <div className="space-y-1 mt-1 bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                  {Object.entries(selectedSpan.tags).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">{k}:</span>
                      <span className="text-blue-300 truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exception & Stack Trace */}
              {selectedSpan.errorDetails && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-red-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Captured Exception:
                    </span>
                    <button
                      onClick={() => handleCopy(selectedSpan.errorDetails!.stackTrace)}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-red-950/40 border border-red-500/40 text-red-300 text-[10px] whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {selectedSpan.errorDetails.stackTrace}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Span ID: {selectedSpan.id}</span>
              <span className="text-slate-400 font-bold">{selectedSpan.durationMs.toFixed(1)}ms</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
