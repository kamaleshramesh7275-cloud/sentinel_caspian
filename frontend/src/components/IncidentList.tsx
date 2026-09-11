import React from 'react';
import { Incident } from '../types';
import { IncidentCard } from './IncidentCard';
import { EmptyState } from './EmptyState';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'ack', label: 'Acked' },
  { id: 'resolved', label: 'Resolved' },
] as const;

function SkeletonCard() {
  return (
    <div className="p-4 rounded-lg bg-[#111622] border border-[#1E2738] space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1 mr-4">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
        <div className="skeleton h-5 w-16 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-4 w-12 rounded" />
        <div className="skeleton h-4 w-16 rounded" />
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
    <div className="flex flex-col h-full gap-2.5">
      {/* Filter Segmented Control */}
      <div className="p-2 rounded-xl bg-[#111622] border border-[#1E2738]">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Incident Queue
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {loading ? '...' : `${incidents.length} active`}
          </span>
        </div>

        <div className="flex items-center p-0.5 rounded-lg bg-[#0B0E14] border border-[#1A2234]">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                id={`filter-btn-${f.id || 'all'}`}
                onClick={() => onFilterChange(f.id)}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all cursor-pointer text-center ${
                  active
                    ? 'bg-[#1E2738] text-white shadow-sm font-semibold'
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
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ minHeight: 0 }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : incidents.length === 0 ? (
          <div className="rounded-xl bg-[#111622] border border-[#1E2738] p-6 text-center">
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
