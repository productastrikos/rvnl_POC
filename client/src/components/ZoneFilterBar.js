import React from 'react';
import { ZONES } from '../data/rvnlData';

/* Railway zone filter — same markup and tokens as the template's segment bar.
   Selection is sticky across pages (held in the data context / store). */
const OPTIONS = [{ code: 'ALL', name: 'All Zones' }, ...ZONES];

export default function ZoneFilterBar({ value = 'ALL', onChange, className = '', compact = false }) {
  const shown = compact ? OPTIONS.slice(0, 9) : OPTIONS;
  return (
    <div className={`flex items-center flex-wrap gap-1.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide mr-0.5"
        style={{ color: 'var(--app-text-faint)' }}>Zone:</span>
      {shown.map(z => {
        const active = value === z.code;
        return (
          <button
            key={z.code}
            onClick={() => onChange(z.code)}
            title={z.name}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all"
            style={{
              background:  active ? 'rgba(59, 125, 232, 0.15)' : 'transparent',
              borderColor: active ? 'rgba(59, 125, 232, 0.45)' : 'var(--app-border)',
              color:       active ? '#3b7de8'                   : 'var(--app-text-faint)',
            }}
          >
            {z.code === 'ALL' ? 'All Zones' : z.code}
          </button>
        );
      })}
    </div>
  );
}
