import React, { useState } from 'react';
import { Play, Bug, Database, AlertOctagon, CheckCircle2, Terminal, Flame, RefreshCw } from 'lucide-react';
import { triggerRealCodeFailure, triggerChaos } from '../api';

interface Props {
  onIncidentTriggered: (incidentId: string) => void;
  onError: (title: string, msg?: string) => void;
  onSuccess: (title: string, msg?: string) => void;
}

export function LiveMicroserviceConsole({
  onIncidentTriggered,
  onError,
  onSuccess,
}: Props) {
  const [isRunningBurst, setIsRunningBurst] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [capturedError, setCapturedError] = useState<string | null>(null);
  const [activeSocketCount, setActiveSocketCount] = useState<number>(0);

  const handleRunCheckoutBurst = async () => {
    setIsRunningBurst(true);
    setTransactions([]);
    setCapturedError(null);
    setActiveSocketCount(0);

    try {
      // Step 1: Simulate Txn 1
      await new Promise((r) => setTimeout(r, 300));
      setTransactions((prev) => [
        ...prev,
        { id: 'ord_101', user: 'usr_alice', amount: '$49.99', status: 'authorized', socket: 'socket_conn_1' },
      ]);
      setActiveSocketCount(1);

      // Step 2: Simulate Txn 2
      await new Promise((r) => setTimeout(r, 400));
      setTransactions((prev) => [
        ...prev,
        { id: 'ord_102', user: 'usr_bob', amount: '$125.00', status: 'authorized', socket: 'socket_conn_2 (Pool Maxed)' },
      ]);
      setActiveSocketCount(2);

      // Step 3: Trigger real failure on backend
      await new Promise((r) => setTimeout(r, 500));
      const resp = await triggerRealCodeFailure();

      if (resp.captured_exception) {
        setCapturedError(resp.captured_exception);
        setTransactions((prev) => [
          ...prev,
          { id: 'ord_103', user: 'usr_charlie', amount: '$89.00', status: 'crashed', error: resp.captured_exception },
        ]);
      }

      if (resp.incident_id) {
        onIncidentTriggered(resp.incident_id);
      }

      onSuccess('Real Code Defect Executed', 'Captured ConnectionPoolExhausted on 3rd transaction');
    } catch (err: any) {
      onError('Execution failed', err.message);
    } finally {
      setIsRunningBurst(false);
    }
  };

  return (
    <div className="rounded-xl bg-[#0F172A] border border-[#1F2937] p-4 flex flex-col gap-3 h-full shadow-sm font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1F2937]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <Bug className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Microservice Transaction Simulator
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              services/payment_gateway.py · Max Sockets: 2
            </p>
          </div>
        </div>

        <button
          onClick={handleRunCheckoutBurst}
          disabled={isRunningBurst}
          className="px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-sm"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isRunningBurst ? 'Processing...' : 'Run Checkout Burst'}</span>
        </button>
      </div>

      {/* Socket Pool Gauge */}
      <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1F2937] space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Database Connection Pool:</span>
          <span className={`font-bold ${activeSocketCount >= 2 ? 'text-red-400' : 'text-emerald-400'}`}>
            Active: {activeSocketCount} / 2 Slots
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-2 rounded border text-center text-[10px] ${
            activeSocketCount >= 1 ? 'bg-amber-950/40 border-amber-500/50 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            Slot 1: {activeSocketCount >= 1 ? 'LOCKED (ord_101)' : 'AVAILABLE'}
          </div>
          <div className={`p-2 rounded border text-center text-[10px] ${
            activeSocketCount >= 2 ? 'bg-red-950/40 border-red-500/50 text-red-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            Slot 2: {activeSocketCount >= 2 ? 'LOCKED (ord_102)' : 'AVAILABLE'}
          </div>
        </div>
      </div>

      {/* Live Transaction Feed */}
      <div className="space-y-1.5 flex-1 min-h-[120px] overflow-y-auto">
        <span className="text-[10px] font-mono text-slate-500 uppercase">Live Transaction Stream:</span>
        {transactions.length === 0 ? (
          <div className="p-4 rounded-lg bg-[#0B0F19] border border-[#1F2937] text-center text-slate-500 text-xs">
            Click <strong>"Run Checkout Burst"</strong> to simulate 3 sequential transactions against the raw pool.
          </div>
        ) : (
          transactions.map((t, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border flex items-center justify-between font-mono text-[11px] animate-fadeIn ${
                t.status === 'crashed'
                  ? 'bg-red-950/30 border-red-500/50 text-red-200'
                  : 'bg-[#0B0F19] border-[#1F2937] text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-400">{t.id}</span>
                <span className="text-blue-300">{t.user}</span>
                <span className="text-slate-100 font-bold">{t.amount}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                t.status === 'crashed' ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {t.status === 'crashed' ? '💥 CRASH' : '✓ OK'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Captured Exception Traceback */}
      {capturedError && (
        <div className="p-2.5 rounded-lg bg-black border border-red-500/50 font-mono text-[11px] text-red-300 space-y-1 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold text-red-400">
            <Terminal className="w-3.5 h-3.5" />
            <span>Captured Python Exception Traceback:</span>
          </div>
          <pre className="text-[10px] text-red-200 whitespace-pre-wrap leading-relaxed m-0 overflow-x-auto max-h-24">
            {capturedError}
          </pre>
        </div>
      )}

    </div>
  );
}
