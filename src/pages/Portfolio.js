import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Progress, Btn, Select, SearchBox, Tabs, EmptyState, MiniStat,
} from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { getProjects } from '../services/api';
import { useData } from '../services/socket';
import { inr, pct, fmtDate, PROJECT_STATUS, PIUS } from '../data/rvnlData';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...Object.entries(PROJECT_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
];
const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'new_line', label: 'New Line' },
  { value: 'doubling', label: 'Doubling' },
  { value: 'gauge_conversion', label: 'Gauge Conversion' },
  { value: 'electrification', label: 'Electrification' },
  { value: 'metro', label: 'Metro' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'bridge', label: 'Bridge / ROB' },
];
const HEALTH_OPTIONS = [
  { value: 'all', label: 'All health' },
  { value: 'critical', label: 'Critical only' },
  { value: 'warning', label: 'At risk' },
  { value: 'normal', label: 'On track' },
];

export default function Portfolio() {
  const navigate = useNavigate();
  const { zone, setZone, lastUpdate } = useData();
  const [view, setView] = useState('table');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [health, setHealth] = useState('all');
  const [piuId, setPiuId] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [q, status, type, health, piuId, zone]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getProjects({ zone, q, status, type, health, piuId, page, pageSize: view === 'grid' ? 24 : 20 })
      .then(res => { if (alive) { setRows(res.data); setMeta(res.meta); setLoading(false); } });
    return () => { alive = false; };
  }, [zone, q, status, type, health, piuId, page, view, lastUpdate]);

  const piuOptions = useMemo(() => [
    { value: 'all', label: 'All PIUs' },
    ...PIUS.map(p => ({ value: p.id, label: p.name })),
  ], []);

  const columns = [
    {
      key: 'name', label: 'Project', maxWidth: 320, render: r => (
        <div className="min-w-0">
          <div className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{r.name}</div>
          <div className="text-[9.5px] font-mono truncate" style={{ color: 'var(--app-text-faint)' }}>{r.code} · {r.typeLabel}</div>
        </div>
      ),
    },
    { key: 'zone', label: 'Zone', width: 62 },
    { key: 'piuName', label: 'PIU', maxWidth: 132 },
    { key: 'lengthKm', label: 'Length', align: 'right', width: 78, render: r => r.lengthKm ? `${r.lengthKm.toFixed(1)} km` : '—' },
    {
      key: 'physicalProgress', label: 'Physical', width: 150,
      render: r => <Progress value={r.physicalProgress} planned={r.plannedPhysical} rag={r.health} showLabel />,
    },
    {
      key: 'variance', label: 'Var.', align: 'right', width: 74,
      render: r => <span style={{ fontWeight: 700, color: r.variance < -8 ? 'var(--app-danger)' : r.variance < 0 ? 'var(--app-warning)' : 'var(--app-success)' }}>{r.variance > 0 ? '+' : ''}{r.variance}</span>,
    },
    { key: 'latestEstimate', label: 'Estimate', align: 'right', width: 104, render: r => inr(r.latestEstimate, { unit: 'cr', decimals: 0 }) },
    { key: 'expenditure', label: 'Spent', align: 'right', width: 104, render: r => inr(r.expenditure, { unit: 'cr', decimals: 0 }) },
    {
      key: 'targetCompletion', label: 'Target', align: 'right', width: 108,
      render: r => (
        <span style={{ color: r.revisedCompletion ? 'var(--app-warning)' : 'var(--app-text-muted)' }}>
          {fmtDate(r.revisedCompletion || r.targetCompletion)}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status', align: 'right', width: 122, sortable: false,
      render: r => <Chip tone={PROJECT_STATUS[r.status]?.chip || 'info'}>{r.statusLabel}</Chip>,
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Project Portfolio"
        subtitle={`${meta.totalItems ?? 0} projects · ${inr(meta.totalValue || 0, { unit: 'cr', decimals: 0 })} current estimate`}
        breadcrumb={['Command']}
        actions={
          <Tabs value={view} onChange={setView}
            tabs={[{ value: 'table', label: 'Table' }, { value: 'grid', label: 'Cards' }]} />
        }
      >
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      <Panel>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBox value={q} onChange={setQ} placeholder="Search project, code, PIU…" width={250} />
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} width={165} />
          <Select value={type} onChange={setType} options={TYPE_OPTIONS} width={165} />
          <Select value={health} onChange={setHealth} options={HEALTH_OPTIONS} width={140} />
          <Select value={piuId} onChange={setPiuId} options={piuOptions} width={175} />
          {(q || status !== 'all' || type !== 'all' || health !== 'all' || piuId !== 'all') && (
            <Btn onClick={() => { setQ(''); setStatus('all'); setType('all'); setHealth('all'); setPiuId('all'); }}>Clear</Btn>
          )}
        </div>
      </Panel>

      {loading ? <Loading label="Loading projects…" /> : rows.length === 0 ? (
        <Panel><EmptyState title="No projects match these filters"
          hint="Try widening the zone or clearing the search."
          action={<Btn variant="primary" onClick={() => { setQ(''); setStatus('all'); setType('all'); setHealth('all'); setPiuId('all'); setZone('ALL'); }}>Reset filters</Btn>} /></Panel>
      ) : view === 'table' ? (
        <Panel bodyClass="pt-0">
          <DataTable columns={columns} rows={rows} onRowClick={r => navigate(`/projects/${r.id}`)} />
          <Pager meta={meta} onPage={setPage} />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map(p => (
              <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                className="glass-panel rounded-2xl p-4 text-left transition-transform"
                style={{ border: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold leading-snug line-clamp-2" style={{ color: 'var(--app-text)' }}>{p.name}</div>
                    <div className="text-[9.5px] font-mono mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{p.code}</div>
                  </div>
                  <Chip tone={p.health} dot>{p.health === 'normal' ? 'ON TRACK' : p.health === 'warning' ? 'AT RISK' : 'CRITICAL'}</Chip>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Chip tone={PROJECT_STATUS[p.status]?.chip || 'info'}>{p.statusLabel}</Chip>
                  <span className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>{p.zone} · {p.piuName}</span>
                </div>
                <Progress value={p.physicalProgress} planned={p.plannedPhysical} rag={p.health} height={7} />
                <div className="flex items-center justify-between mt-1.5 text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                  <span>{pct(p.physicalProgress)} physical</span>
                  <span>plan {pct(p.plannedPhysical)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(128,128,128,0.14)' }}>
                  <MiniStat label="Estimate" value={inr(p.latestEstimate, { unit: 'cr', decimals: 0 })} />
                  <MiniStat label="Spent" value={inr(p.expenditure, { unit: 'cr', decimals: 0 })} />
                  <MiniStat label="Length" value={p.lengthKm ? `${p.lengthKm} km` : '—'} />
                </div>
              </button>
            ))}
          </div>
          <Panel><Pager meta={meta} onPage={setPage} /></Panel>
        </>
      )}
    </div>
  );
}

export function Pager({ meta, onPage }) {
  if (!meta?.totalPages || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3 mt-1 flex-wrap"
      style={{ borderTop: '1px solid rgba(128,128,128,0.14)' }}>
      <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
        Showing page {meta.page} of {meta.totalPages} · {meta.totalItems} records
      </span>
      <div className="flex items-center gap-1.5">
        <Btn disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Btn>
        <Btn disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</Btn>
      </div>
    </div>
  );
}
