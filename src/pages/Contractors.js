import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import KPICard, { IcoPeople, IcoRupee, IcoShield, IcoAlert } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Btn, Select, SearchBox, Progress,
  KpiGrid, Drawer, Facts, MiniStat, EmptyState } from '../components/ui';
import { getContractors, getContractorById } from '../services/api';
import { useData } from '../services/socket';
import { inr } from '../data/rvnlData';

const RAG_OPTIONS = [
  { value: 'all', label: 'All performance' },
  { value: 'critical', label: 'Below 62 (critical)' },
  { value: 'warning', label: '62–78 (watch)' },
  { value: 'normal', label: 'Above 78 (good)' },
];

export default function Contractors() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { zone, lastUpdate } = useData();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(sp.get('q') || '');
  const [rag, setRag] = useState('all');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getContractors({ q, rag, pageSize: 50 })
      .then(r => { if (alive) { setRows(r.data); setLoading(false); } });
    return () => { alive = false; };
  }, [q, rag, zone, lastUpdate]);

  const open = async (row) => {
    setDetailLoading(true);
    setDetail({ id: row.id, name: row.name });
    const r = await getContractorById(row.id);
    setDetail(r.data);
    setDetailLoading(false);
  };

  const totals = rows.reduce((acc, c) => ({
    value: acc.value + c.liveValue,
    packages: acc.packages + c.livePackages,
    critical: acc.critical + (c.rag === 'critical' ? 1 : 0),
    pgExpiring: acc.pgExpiring + (c.pgExpiryDays < 30 ? 1 : 0) }), { value: 0, packages: 0, critical: 0, pgExpiring: 0 });

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Contractors" breadcrumb={['Commercial']}
        subtitle="Composite performance index across all RVNL contracts — schedule 40%, quality 25%, safety 20%, billing 15%" />

      <KpiGrid>
        <KPICard label="Empanelled Agencies" value={String(rows.length)} icon={<IcoPeople />} rag="normal"
          subValues={[{ label: 'LIVE PACKAGES', value: String(totals.packages) }]} />
        <KPICard label="Contract Value" value={inr(totals.value, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoRupee />} rag="normal"
          subValues={[{ label: 'IN SCOPE', value: 'awarded' }]} />
        <KPICard label="Below Threshold" value={String(totals.critical)} icon={<IcoAlert />}
          rag={totals.critical > 2 ? 'critical' : totals.critical > 0 ? 'warning' : 'normal'}
          subValues={[{ label: 'CPI', value: '< 62' }]} />
        <KPICard label="PG Expiring" value={String(totals.pgExpiring)} icon={<IcoShield />}
          rag={totals.pgExpiring > 2 ? 'critical' : totals.pgExpiring > 0 ? 'warning' : 'normal'}
          subValues={[{ label: 'WITHIN', value: '30 days' }]} />
      </KpiGrid>

      <Panel>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBox value={q} onChange={setQ} placeholder="Search contractor, PAN…" width={280} />
          <Select value={rag} onChange={setRag} options={RAG_OPTIONS} width={190} />
          {(q || rag !== 'all') && <Btn onClick={() => { setQ(''); setRag('all'); }}>Clear</Btn>}
        </div>
      </Panel>

      {loading ? <Loading /> : (
        <Panel title="Contractor Directory" subtitle="Click for contracts, bills and incident history">
          <DataTable
            rows={rows}
            emptyTitle="No contractors match"
            onRowClick={open}
            initialSort={{ key: 'cpi', dir: 'asc' }}
            columns={[
              { key: 'name', label: 'Contractor', maxWidth: 260, render: r => (
                <div><div className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{r.name}</div>
                  <div className="text-[9.5px] font-mono" style={{ color: 'var(--app-text-faint)' }}>{r.pan} · {r.regClass}</div></div>
              ) },
              { key: 'livePackages', label: 'Packages', align: 'right', width: 88 },
              { key: 'liveValue', label: 'Value', align: 'right', width: 106, render: r => r.liveValue ? inr(r.liveValue, { unit: 'cr', decimals: 0 }) : '—' },
              { key: 'avgProgress', label: 'Avg progress', width: 140, render: r => <Progress value={r.avgProgress} showLabel rag={r.avgProgress > 60 ? 'normal' : r.avgProgress > 30 ? 'warning' : 'critical'} /> },
              { key: 'cpi', label: 'CPI', width: 128, render: r => (
                <div className="flex items-center gap-2">
                  <Progress value={r.cpi} rag={r.rag} height={5} />
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: r.rag === 'normal' ? 'var(--app-success)' : r.rag === 'warning' ? 'var(--app-warning)' : 'var(--app-danger)' }}>{r.cpi}</span>
                </div>
              ) },
              { key: 'schedule', label: 'Schedule', align: 'right', width: 84, sortValue: r => r.scores.schedule, render: r => r.scores.schedule.toFixed(0) },
              { key: 'quality', label: 'Quality', align: 'right', width: 76, sortValue: r => r.scores.quality, render: r => r.scores.quality.toFixed(0) },
              { key: 'safety', label: 'Safety', align: 'right', width: 72, sortValue: r => r.scores.safety, render: r => r.scores.safety.toFixed(0) },
              { key: 'pgExpiryDays', label: 'PG', align: 'right', width: 96, render: r => (
                <span style={{ color: r.pgExpiryDays < 0 ? 'var(--app-danger)' : r.pgExpiryDays < 30 ? 'var(--app-warning)' : 'var(--app-text-muted)', fontWeight: r.pgExpiryDays < 30 ? 700 : 500 }}>
                  {r.pgExpiryDays < 0 ? `expired ${-r.pgExpiryDays}d` : `${r.pgExpiryDays}d`}
                </span>
              ) },
            ]} />
        </Panel>
      )}

      <Drawer open={!!detail} onClose={() => setDetail(null)} width={520}
        title={detail?.name || ''} subtitle={detail?.pan ? `${detail.pan} · ${detail.regClass} class` : ''}>
        {detailLoading || !detail?.scores ? <Loading label="Loading contractor…" /> : (
          <div className="space-y-4">
            <div className="rounded-xl p-3.5" style={{ background: 'var(--app-surface-soft)' }}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>Composite performance index</div>
                  <div className="text-[30px] font-bold leading-none mt-1"
                    style={{ color: detail.rag === 'normal' ? 'var(--app-success)' : detail.rag === 'warning' ? 'var(--app-warning)' : 'var(--app-danger)' }}>
                    {detail.cpi}
                  </div>
                </div>
                <Chip tone={detail.rag} dot>{detail.rag === 'normal' ? 'GOOD' : detail.rag === 'warning' ? 'WATCH' : 'BELOW THRESHOLD'}</Chip>
              </div>
              {[
                ['Schedule adherence', detail.scores.schedule, '40%'],
                ['Quality', detail.scores.quality, '25%'],
                ['Safety', detail.scores.safety, '20%'],
                ['Billing hygiene', detail.scores.billing, '15%'],
              ].map(([label, val, w]) => (
                <div key={label} className="mb-2">
                  <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--app-text-faint)' }}>
                    <span>{label} <span style={{ opacity: 0.7 }}>({w})</span></span>
                    <span className="font-semibold" style={{ color: 'var(--app-text-muted)' }}>{val.toFixed(0)}</span>
                  </div>
                  <Progress value={val} height={5} rag={val > 78 ? 'normal' : val > 62 ? 'warning' : 'critical'} />
                </div>
              ))}
            </div>

            <Facts items={[
              { label: 'GSTIN', value: detail.gstin },
              { label: 'Registration', value: `${detail.regClass} class` },
              { label: 'Contact', value: detail.contact?.person },
              { label: 'Phone', value: detail.contact?.phone },
              { label: 'PG validity', value: detail.pgExpiryDays < 0 ? `Expired ${-detail.pgExpiryDays} days ago` : `${detail.pgExpiryDays} days remaining`, tone: detail.pgExpiryDays < 30 ? 'var(--app-danger)' : undefined, full: true },
            ]} />

            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Packages" value={detail.packages?.length || 0} />
              <MiniStat label="Safety events" value={detail.safety || 0} tone={detail.safety > 3 ? 'var(--app-warning)' : undefined} />
              <MiniStat label="NCRs" value={detail.ncrs || 0} tone={detail.ncrs > 3 ? 'var(--app-warning)' : undefined} />
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-faint)' }}>
                Live packages ({detail.packages?.length || 0})
              </div>
              {detail.packages?.length ? (
                <div className="flex flex-col gap-1.5">
                  {detail.packages.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => { setDetail(null); navigate(`/projects/${p.projectId}`); }}
                      className="rounded-lg p-2.5 text-left" style={{ background: 'var(--app-surface-soft)', border: 'none' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10.5px] font-mono" style={{ color: 'var(--app-text)' }}>{p.code}</span>
                        <span className="text-[10.5px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>{p.awardedValue ? inr(p.awardedValue, { unit: 'cr', decimals: 0 }) : '—'}</span>
                      </div>
                      <div className="text-[10px] truncate mb-1.5" style={{ color: 'var(--app-text-faint)' }}>{p.projectName}</div>
                      <Progress value={p.physicalProgress} height={4} rag={p.health} />
                    </button>
                  ))}
                </div>
              ) : <EmptyState title="No live packages" />}
            </div>

            {detail.rag === 'critical' && (
              <div className="text-[10.5px] rounded-lg p-2.5" style={{ background: 'var(--app-danger-bg)', color: 'var(--app-text-muted)' }}>
                CPI below 62. Recommended action: issue a notice under GCC clause 39 (resource deployment) and add live RVNL
                commitment to the bid-capacity check before this agency is awarded further work.
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
