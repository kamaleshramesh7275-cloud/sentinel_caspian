import React, { useState, useEffect } from 'react';
import { FileCode, CheckCircle2, AlertTriangle, RotateCcw, Play, Check, ShieldCheck, Terminal, Copy } from 'lucide-react';
import { fetchSourceCode, applyDemoPatch, resetDemoCode } from '../api';

interface Props {
  onCodePatched?: () => void;
  onCodeReset?: () => void;
  onTestOutput?: (output: any) => void;
  onError: (title: string, msg?: string) => void;
  onSuccess: (title: string, msg?: string) => void;
}

export function LiveSourceCodeViewer({
  onCodePatched,
  onCodeReset,
  onTestOutput,
  onError,
  onSuccess,
}: Props) {
  const [codeData, setCodeData] = useState<{
    target_file: string;
    is_patched: boolean;
    status: string;
    content: string;
    total_lines: number;
    defective_lines_range: number[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [patching, setPatching] = useState(false);

  const loadCode = async () => {
    try {
      setLoading(true);
      const data = await fetchSourceCode();
      setCodeData(data);
    } catch (err: any) {
      console.error('Failed to load source code', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCode();
  }, []);

  const handleApplyPatch = async () => {
    setPatching(true);
    try {
      const res = await applyDemoPatch();
      await loadCode();
      if (res.test) {
        onTestOutput?.(res.test);
      }
      onSuccess('Defensive Patch Applied to Disk', 'services/payment_gateway.py updated & verified with pytest');
      onCodePatched?.();
    } catch (err: any) {
      onError('Patch application failed', err.message);
    } finally {
      setPatching(false);
    }
  };

  const handleResetCode = async () => {
    try {
      await resetDemoCode();
      await loadCode();
      onSuccess('Code Reset', 'services/payment_gateway.py restored to vulnerable defect state');
      onCodeReset?.();
    } catch (err: any) {
      onError('Reset failed', err.message);
    }
  };

  const lines = codeData?.content ? codeData.content.split('\n') : [];

  return (
    <div className="rounded-xl bg-[#0F172A] border border-[#1F2937] overflow-hidden flex flex-col h-full shadow-sm font-sans">
      
      {/* Editor Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#0B0F19] border-b border-[#1F2937] gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <FileCode className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="font-mono text-xs font-bold text-white">
              {codeData?.target_file || 'services/payment_gateway.py'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono ml-2">
              ({lines.length} lines · UTF-8)
            </span>
          </div>
        </div>

        {/* Live Status Pill & Actions */}
        <div className="flex items-center gap-2">
          {codeData?.is_patched ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>PATCHED &amp; RESILIENT</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/70 text-red-300 border border-red-500/50 flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>DEFECT: UNRELEASED SOCKET LEAK</span>
            </span>
          )}

          <button
            onClick={handleApplyPatch}
            disabled={patching || codeData?.is_patched}
            className="px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-sm"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>{patching ? 'Patching...' : 'Apply Patch'}</span>
          </button>

          <button
            onClick={handleResetCode}
            title="Reset to defective code state"
            className="p-1 rounded bg-slate-800 hover:bg-red-950/50 hover:text-red-300 text-slate-400 transition cursor-pointer border border-slate-700"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="flex-1 p-0 overflow-y-auto bg-black/90 font-mono text-xs leading-relaxed min-h-[440px] max-h-[600px]">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Reading filesystem...</div>
        ) : (
          <div className="py-2">
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isDefectRange = lineNum >= 75 && lineNum <= 95;
              const isFinallyLine = line.includes('finally:') || line.includes('release_socket');

              return (
                <div
                  key={idx}
                  className={`flex items-start px-3 py-0.5 hover:bg-slate-900/60 ${
                    isFinallyLine
                      ? 'bg-emerald-950/30 border-l-2 border-emerald-500 text-emerald-200'
                      : isDefectRange && !codeData?.is_patched && (line.includes('acquire_raw_socket') || line.includes('BUG:'))
                      ? 'bg-red-950/30 border-l-2 border-red-500 text-red-200'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="w-8 select-none text-slate-600 text-right pr-3 shrink-0 text-[10px]">
                    {lineNum}
                  </span>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap break-all flex-1 m-0">
                    {line}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-1.5 bg-[#0B0F19] border-t border-[#1F2937] flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Filesystem Path: c:\projects\sentinel_caspian\services\payment_gateway.py</span>
        <span className={codeData?.is_patched ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
          {codeData?.is_patched ? '✓ Safe Socket Context Management' : '⚠ Lines 78-85 Contain Connection Leak'}
        </span>
      </div>

    </div>
  );
}
