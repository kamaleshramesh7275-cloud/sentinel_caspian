import React from 'react';
import { Incident } from '../types';
import { IncidentCard } from './IncidentCard';
import { EmptyState } from './EmptyState';
import { Layers } from 'lucide-react';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'ack', label: 'Acked' },
  { id: 'resolved', label: 'Resolved' },
] as const;

function SkeletonCard() {
  return (
    <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937] space-y-2">
      <div className="flex justify-between items-start">
        <div className="space-y-1 flex-1 mr-3">
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-2.5 w-1/3 rounded" />
        </div>
        <div className="skeleton h-3.5 w-12 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-2.5 w-10 rounded" />
        <div className="skeleton h-2.5 w-14 rounded" />
      </div>
    </div>
  );
}

interface Props {
  incidents: Incident[];
  loading: boolean;
  filter: string;
  onFilterChange: (f: string) => void;
  selectedId: string | null;
  onSelect: (incident: Incident) => void;
}

export function IncidentList({ incidents, loading, filter, onFilterChange, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden gap-2.5 p-3.5" style={{ minHeight: 0 }}>
      {/* Header & Filter Bar */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
              Incident Triage Queue
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {loading ? '...' : `${incidents.length} active`}
          </span>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center p-0.5 rounded-md bg-[#0B0F19] border border-[#1F2937]">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                id={`filter-btn-${f.id || 'all'}`}
                onClick={() => onFilterChange(f.id)}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition cursor-pointer text-center ${
                  active
                    ? 'bg-[#1E293B] text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1" style={{ minHeight: 0 }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : incidents.length === 0 ? (
          <div className="rounded-lg bg-[#111827] border border-[#1F2937] p-6 text-center">
            <EmptyState filter={filter || undefined} />
          </div>
        ) : (
          incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              selected={selectedId === incident.id}
              onClick={() => onSelect(incident)}
            />
          ))
        )}
      </div>
    </div>
  );
}
