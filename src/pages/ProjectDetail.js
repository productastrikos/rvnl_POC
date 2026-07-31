import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from 'chart.js';

import KPICard, { IcoTrack, IcoRupee, IcoCalendar, IcoClipboard } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Progress, Btn, Tabs, ChainageStrip,
  Facts, MiniStat, EmptyState, Drawer, KpiGrid,
} from '../components/ui';
import { chartTooltip, seriesColor } from '../components/chartUtils';
import { getProjectDashboard } from '../services/api';
import { useData } from '../services/socket';
import {
  inr, pct, fmtDate, chainage, km, PROJECT_STATUS, LAND_STATUS,
} from '../data/rvnlData';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'packages', label: 'Packages' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'progress', label: 'Progress' },
  { value: 'governance', label: 'Land & Clearances' },
  { value: 'activity', label: 'Site Activity' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { lastUpdate } = useData();

  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(sp.get('tab') || 'overview');
  const [selectedPkg, setSelectedPkg] = useState(sp.get('package') || null);
  const [drawer, setDrawer] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getProjectDashboard(id)
      .then(res => { if (alive) { setD(res.data); setLoading(false); } })
      .catch(() => { if (alive) { setD(null); setLoading(false); } });
    return () => { alive = false; };
  }, [id, lastUpdate]);

  const changeTab = (v) => { setTab(v); sp.set('tab', v); setSp(sp, { replace: true }); };

  if (loading) return <Loading label="Loading project…" />;
  if (!d) return <EmptyState title="Project not found" hint="It may have been removed, or the link is wrong."
    action={<Btn variant="primary" onClick={() => navigate('/portfolio')}>Back to portfolio</Btn>} />;

  const { project: p, packages, milestones, workHeads, chainage: segs, land, clearances, risks, dsrs, structures, contractors, ncrs, milestoneStats } = d;

  const workHeadChart = {
    labels: workHeads.map(w => w.label),
    datasets: [
      { label: 'Contracted', data: workHeads.map(w => Math.round(w.value / 100)), backgroundColor: seriesColor(1), borderRadius: 4, borderSkipped: false, barPercentage: 0.68, categoryPercentage: 0.7 },
      { label: 'Executed', data: workHeads.map(w => Math.round(w.executedValue / 100)), backgroundColor: seriesColor(2), borderRadius: 4, borderSkipped: false, barPercentage: 0.68, categoryPercentage: 0.7 },
    ],
  };

  const landChart = {
    labels: Object.keys(LAND_STATUS).filter(k => !['disputed', 'court_stay'].includes(k)).concat(['Disputed']),
    datasets: [{
      data: [], backgroundColor: [], borderWidth: 0,
    }],
  };
  /* build land donut from parcel counts */
  {
    const counts = { possession_taken: land.taken, disputed: land.disputed, pending: land.pending - land.disputed };
    landChart.labels = ['Possession taken', 'In progress', 'Disputed / stay'];
    landChart.datasets = [{
      data: [counts.possession_taken, Math.max(0, counts.pending), counts.disputed],
      backgroundColor: ['var(--app-success)', seriesColor(2), 'var(--app-danger)'],
      borderWidth: 0,
    }];
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumb={['Portfolio', p.zone, p.piuName]}
        title={p.name}
        subtitle={`${p.code} · ${p.typeLabel}${p.lengthKm ? ` · ${p.lengthKm} km` : ''} · CPM ${p.cpm}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tone={PROJECT_STATUS[p.status]?.chip || 'info'}>{p.statusLabel}</Chip>
            <Chip tone={p.health} dot>{p.health === 'normal' ? 'ON TRACK' : p.health === 'warning' ? 'AT RISK' : 'CRITICAL'}</Chip>
            <Btn variant="primary" onClick={() => navigate(`/twin?project=${p.id}`)}>Open in digital twin</Btn>
          </div>
        }
      >
        <div className="mt-2.5"><Tabs tabs={TABS} value={tab} onChange={changeTab} /></div>
      </PageHeader>

      {/* KPI strip — always visible */}
      <KpiGrid>
        <KPICard label="Physical Progress" value={p.physicalProgress.toFixed(1)} unit="%" icon={<IcoTrack />}
          rag={p.health} trend={p.variance}
          subValues={[{ label: 'PLANNED', value: pct(p.plannedPhysical) }, { label: 'SLIP', value: `${p.variance} pp` }]} />
        <KPICard label="Financial Progress" value={p.financialProgress.toFixed(1)} unit="%" icon={<IcoRupee />}
          rag={p.financialProgress < p.physicalProgress - 10 ? 'warning' : 'normal'}
          subValues={[{ label: 'SPENT', value: inr(p.expenditure, { unit: 'cr', decimals: 0 }) }, { label: 'ESTIMATE', value: inr(p.latestEstimate, { unit: 'cr', decimals: 0 }) }]} />
        <KPICard label="Milestones On Track" value={`${milestoneStats.total - milestoneStats.overdue} / ${milestoneStats.total}`} icon={<IcoCalendar />}
          rag={milestoneStats.overdue > 3 ? 'critical' : milestoneStats.overdue > 0 ? 'warning' : 'normal'}
          subValues={[{ label: 'OVERDUE', value: String(milestoneStats.overdue) }, { label: 'DONE', value: String(milestoneStats.completed) }]}
          onClick={() => changeTab('schedule')} />
        <KPICard label="Open NCRs" value={String(ncrs.open)} icon={<IcoClipboard />}
          rag={ncrs.open > 4 ? 'critical' : ncrs.open > 0 ? 'warning' : 'normal'}
          subValues={[{ label: 'TOTAL RAISED', value: String(ncrs.total) }, { label: 'RISKS OPEN', value: String(risks.length) }]}
          onClick={() => navigate(`/twin?project=${p.id}`)} />
      </KpiGrid>

      {/* Chainage strip — the corridor at a glance */}
      {p.lengthM > 0 && (
        <Panel title="Corridor" subtitle={`${p.lengthKm} km · ${packages.length} packages · click a section to inspect`}>
          <ChainageStrip segments={segs} lengthM={p.lengthM} structures={structures}
            selectedId={selectedPkg}
            onSelect={(s) => { setSelectedPkg(s.id); setDrawer({ kind: 'package', data: packages.find(x => x.id === s.id) }); }} />
        </Panel>
      )}

      {/* ─── TAB: OVERVIEW ──────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Panel className="lg:col-span-2" title="Progress vs BOQ by work head" subtitle="Contracted vs executed value (₹ Cr) — hover for quantities">
              {workHeads.length ? (
                <div style={{ height: 240 }}>
                  <Bar data={workHeadChart} options={{
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 10 }, color: 'var(--app-text-muted)' } },
                      tooltip: chartTooltip({
                        callbacks: {
                          label: (c) => {
                            const w = workHeads[c.dataIndex];
                            return c.datasetIndex === 0
                              ? ` Contracted: ₹${c.parsed.x.toLocaleString('en-IN')} Cr · ${w.contracted.toLocaleString('en-IN')} ${w.unit}`
                              : ` Executed: ₹${c.parsed.x.toLocaleString('en-IN')} Cr · ${w.executed.toLocaleString('en-IN')} ${w.unit} (${w.pct}%)`;
                          },
                        },
                      }),
                    },
                    scales: {
                      x: { grid: { color: 'var(--app-chart-grid)', drawBorder: false }, ticks: { color: 'var(--app-text-faint)', font: { size: 9.5 } }, beginAtZero: true },
                      y: { grid: { display: false }, ticks: { color: 'var(--app-text-faint)', font: { size: 9.5 } } },
                    },
                  }} />
                </div>
              ) : <EmptyState title="No BOQ recorded" hint="BOQ is imported when the contract is awarded." />}
            </Panel>

            <Panel title="Land Status" subtitle={`${land.total} parcels on this alignment`}>
              <div className="flex flex-col items-center">
                <div style={{ height: 150, width: '100%' }}>
                  <Doughnut data={landChart} options={{
                    responsive: true, maintainAspectRatio: false, cutout: '68%',
                    plugins: { legend: { display: false }, tooltip: chartTooltip() },
                  }} />
                </div>
                <div className="text-center -mt-[92px] mb-[52px] pointer-events-none">
                  <div className="text-[26px] font-bold leading-none" style={{ color: 'var(--app-text)' }}>{land.acquiredPct}%</div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>acquired</div>
                </div>
                <div className="w-full rounded-lg p-2.5 text-center"
                  style={{ background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)' }}>
                  <div className="text-[20px] font-bold leading-none" style={{ color: 'var(--app-danger)' }}>{land.blockedKm} km</div>
                  <div className="text-[9.5px] mt-1" style={{ color: 'var(--app-text-muted)' }}>alignment blocked by land not in possession</div>
                </div>
                <div className="grid grid-cols-3 gap-2 w-full mt-3">
                  <MiniStat label="Taken" value={land.taken} />
                  <MiniStat label="Pending" value={land.pending} tone="var(--app-warning)" />
                  <MiniStat label="Disputed" value={land.disputed} tone="var(--app-danger)" />
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title="Compliance Status" subtitle="Statutory clearances for this project">
              {clearances.length ? (
                <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 260 }}>
                  {clearances.map(c => (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'var(--app-surface-soft)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: c.rag === 'normal' ? 'var(--app-success)' : c.rag === 'warning' ? 'var(--app-warning)' : 'var(--app-danger)' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{c.typeLabel}</div>
                        <div className="text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>{c.authority}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <Chip tone={c.status === 'granted' ? 'normal' : c.breached ? 'critical' : 'warning'}>{c.statusLabel}</Chip>
                        {c.daysPending != null && (
                          <div className="text-[9.5px] mt-0.5" style={{ color: c.breached ? 'var(--app-danger)' : 'var(--app-text-faint)' }}>
                            {c.daysPending} d / SLA {c.slaDays} d
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No clearances recorded" />}
            </Panel>

            <Panel title="Contractor Performance" subtitle="Package-wise composite index">
              {contractors.length ? (
                <DataTable dense maxHeight={260}
                  columns={[
                    { key: 'packageName', label: 'Package', render: r => <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{r.packageName}</span> },
                    { key: 'name', label: 'Contractor', maxWidth: 160 },
                    { key: 'cpi', label: 'CPI', align: 'right', width: 88, render: r => <Chip tone={r.rag}>{r.cpi}</Chip> },
                    { key: 'schedule', label: 'Schedule', align: 'right', width: 78, sortValue: r => r.scores.schedule, render: r => r.scores.schedule.toFixed(0) },
                    { key: 'quality', label: 'Quality', align: 'right', width: 72, sortValue: r => r.scores.quality, render: r => r.scores.quality.toFixed(0) },
                    { key: 'safety', label: 'Safety', align: 'right', width: 68, sortValue: r => r.scores.safety, render: r => r.scores.safety.toFixed(0) },
                  ]}
                  rows={contractors}
                  onRowClick={r => navigate(`/contractors?q=${encodeURIComponent(r.name)}`)} />
              ) : <EmptyState title="No contracts awarded yet" hint="This project is still at tendering stage." />}
            </Panel>
          </div>

          <Panel title="Open Risks" subtitle={`${risks.length} risks affecting this project`}>
            <DataTable maxHeight={300}
              emptyTitle="No open risks"
              columns={[
                { key: 'categoryLabel', label: 'Category', width: 150, render: r => <Chip tone={r.severity}>{r.categoryLabel}</Chip> },
                { key: 'title', label: 'Risk', wrap: true, render: r => <span style={{ color: 'var(--app-text)' }}>{r.title}</span> },
                { key: 'score', label: 'Score', align: 'right', width: 70, render: r => `${r.likelihood}×${r.impact}=${r.score}` },
                { key: 'exposureAmount', label: 'Exposure', align: 'right', width: 100, render: r => inr(r.exposureAmount, { unit: 'cr', decimals: 0 }) },
                { key: 'status', label: 'Status', align: 'right', width: 100, render: r => <Chip tone={r.status === 'open' ? 'warning' : 'info'}>{r.status.toUpperCase()}</Chip> },
              ]}
              rows={risks}
              onRowClick={() => navigate(`/twin?project=${p.id}`)} />
          </Panel>
        </>
      )}

      {/* ─── TAB: PACKAGES ──────────────────────────────────────────────── */}
      {tab === 'packages' && (
        <Panel title="Packages" subtitle={`${packages.length} packages · click for scope, contract and BOQ`}>
          <DataTable
            columns={[
              { key: 'code', label: 'Package', width: 150, render: r => (
                <div><div className="font-semibold" style={{ color: 'var(--app-text)' }}>{r.name}</div>
                  <div className="text-[9.5px] font-mono" style={{ color: 'var(--app-text-faint)' }}>{r.code}</div></div>
              ) },
              { key: 'scope', label: 'Scope', maxWidth: 240 },
              { key: 'fromChainageM', label: 'Chainage', width: 170, render: r => `${chainage(r.fromChainageM)} → ${chainage(r.toChainageM)}` },
              { key: 'contractorName', label: 'Contractor', maxWidth: 170, render: r => r.contractorName || <span style={{ color: 'var(--app-text-faint)' }}>Not awarded</span> },
              { key: 'awardedValue', label: 'Awarded', align: 'right', width: 100, render: r => r.awardedValue ? inr(r.awardedValue, { unit: 'cr', decimals: 0 }) : '—' },
              { key: 'physicalProgress', label: 'Progress', width: 140, render: r => <Progress value={r.physicalProgress} rag={r.health} showLabel /> },
              { key: 'health', label: 'Status', align: 'right', width: 100, sortable: false, render: r => <Chip tone={r.health} dot>{r.status.replace('_', ' ').toUpperCase()}</Chip> },
            ]}
            rows={packages}
            onRowClick={r => setDrawer({ kind: 'package', data: r })} />
        </Panel>
      )}

      {/* ─── TAB: SCHEDULE ──────────────────────────────────────────────── */}
      {tab === 'schedule' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Panel><MiniStat label="Total milestones" value={milestoneStats.total} /></Panel>
            <Panel><MiniStat label="Completed" value={milestoneStats.completed} tone="var(--app-success)" /></Panel>
            <Panel><MiniStat label="In progress" value={milestoneStats.inProgress} tone="var(--app-info)" /></Panel>
            <Panel><MiniStat label="Overdue" value={milestoneStats.overdue} tone="var(--app-danger)" /></Panel>
          </div>
          <Panel title="Milestone Schedule" subtitle="Baseline vs planned vs actual · critical path marked">
            <MilestoneGantt milestones={milestones} />
          </Panel>
        </>
      )}

      {/* ─── TAB: PROGRESS ──────────────────────────────────────────────── */}
      {tab === 'progress' && (
        <Panel title="Quantity Ledger by Work Head" subtitle="Executed against contracted quantity — the underlying number, not a headline percentage">
          <DataTable
            emptyTitle="No BOQ recorded"
            columns={[
              { key: 'label', label: 'Work head', render: r => <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{r.label}</span> },
              { key: 'unit', label: 'Unit', width: 70 },
              { key: 'contracted', label: 'Contracted', align: 'right', width: 120, render: r => r.contracted.toLocaleString('en-IN') },
              { key: 'executed', label: 'Executed', align: 'right', width: 120, render: r => r.executed.toLocaleString('en-IN') },
              { key: 'pct', label: 'Progress', width: 170, render: r => <Progress value={r.pct} rag={r.pct > 100 ? 'critical' : r.pct > 60 ? 'normal' : 'warning'} showLabel /> },
              { key: 'value', label: 'Value', align: 'right', width: 110, render: r => inr(r.value, { unit: 'cr', decimals: 0 }) },
            ]}
            rows={workHeads} />
        </Panel>
      )}

      {/* ─── TAB: GOVERNANCE ────────────────────────────────────────────── */}
      {tab === 'governance' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Panel><MiniStat label="Parcels" value={land.total} sub={`${land.areaTotal} ha`} /></Panel>
            <Panel><MiniStat label="Possession taken" value={land.taken} tone="var(--app-success)" sub={`${land.acquiredPct}%`} /></Panel>
            <Panel><MiniStat label="Blocked alignment" value={`${land.blockedKm} km`} tone="var(--app-danger)" /></Panel>
            <Panel><MiniStat label="Compensation" value={inr(land.compensationTotal, { unit: 'cr', decimals: 0 })} /></Panel>
          </div>
          <Panel title="Clearance Register" subtitle="Statutory approvals and their ageing">
            <DataTable
              columns={[
                { key: 'typeLabel', label: 'Clearance', maxWidth: 220, render: r => <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{r.typeLabel}</span> },
                { key: 'authority', label: 'Authority', maxWidth: 200 },
                { key: 'appliedOn', label: 'Applied', width: 110, render: r => fmtDate(r.appliedOn) },
                { key: 'daysPending', label: 'Pending', align: 'right', width: 100,
                  render: r => r.daysPending == null ? '—' : <span style={{ color: r.breached ? 'var(--app-danger)' : 'var(--app-text-muted)', fontWeight: r.breached ? 700 : 500 }}>{r.daysPending} d</span> },
                { key: 'slaDays', label: 'SLA', align: 'right', width: 66, render: r => `${r.slaDays} d` },
                { key: 'conditionCount', label: 'Conditions', align: 'right', width: 90, render: r => r.conditionCount || '—' },
                { key: 'status', label: 'Status', align: 'right', width: 130, sortable: false,
                  render: r => <Chip tone={r.status === 'granted' ? (r.conditionCount ? 'warning' : 'normal') : r.breached ? 'critical' : 'warning'}>
                    {r.status === 'granted' && r.conditionCount ? 'GRANTED · CONDITIONS' : r.statusLabel}</Chip> },
              ]}
              rows={clearances}
              onRowClick={() => navigate(`/twin?project=${p.id}`)} />
          </Panel>
        </>
      )}

      {/* ─── TAB: ACTIVITY ──────────────────────────────────────────────── */}
      {tab === 'activity' && (
        <Panel title="Recent Site Activity" subtitle="Daily site reports from the field, newest first">
          {dsrs.length ? (
            <div className="flex flex-col gap-2">
              {dsrs.map(r => (
                <div key={r.id} className="rounded-lg p-3" style={{ background: 'var(--app-surface-soft)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11.5px] font-bold" style={{ color: 'var(--app-text)' }}>{fmtDate(r.reportDate)}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--app-text-faint)' }}>{r.packageCode}</span>
                        <Chip tone={r.status === 'reviewed' ? 'normal' : r.status === 'rejected' ? 'critical' : 'warning'}>{r.status.toUpperCase()}</Chip>
                        {r.hindranceType !== 'none' && <Chip tone="warning">{r.hindranceLabel} · {r.hindranceHours}h</Chip>}
                      </div>
                      <div className="text-[11px] mb-1.5" style={{ color: 'var(--app-text-muted)' }}>{r.narrative}</div>
                      <div className="flex items-center gap-3 text-[10px] flex-wrap" style={{ color: 'var(--app-text-faint)' }}>
                        <span>{chainage(r.fromChainageM)} → {chainage(r.toChainageM)}</span>
                        <span>{r.submittedBy}</span>
                        <span>{r.photoCount} photos</span>
                        <span>{Object.values(r.manpower || {}).reduce((a, b) => a + b, 0)} workers</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[17px] font-bold leading-none" style={{ color: r.achievementPct >= 85 ? 'var(--app-success)' : r.achievementPct >= 60 ? 'var(--app-warning)' : 'var(--app-danger)' }}>
                        {r.achievementPct}%
                      </div>
                      <div className="text-[9.5px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{r.achievedQty} / {r.targetQty} {r.unit}</div>
                    </div>
                  </div>
                </div>
              ))}
              <Btn onClick={() => navigate(`/twin?project=${p.id}`)} className="self-start mt-1">Open site activity in the twin</Btn>
            </div>
          ) : <EmptyState title="No site reports yet" hint="Daily site reports appear here as soon as the field team submits them." />}
        </Panel>
      )}

      {/* ─── Package drawer ─────────────────────────────────────────────── */}
      <Drawer open={!!drawer} onClose={() => setDrawer(null)}
        title={drawer?.data?.name || ''} subtitle={drawer?.data?.code}
        footer={drawer && <Btn variant="primary" onClick={() => navigate(`/twin?project=${p.id}`)}>Locate package on the twin</Btn>}>
        {drawer?.data && (
          <div className="space-y-4">
            <Facts items={[
              { label: 'Scope', value: drawer.data.scope, full: true },
              { label: 'Chainage', value: `${chainage(drawer.data.fromChainageM)} → ${chainage(drawer.data.toChainageM)}` },
              { label: 'Length', value: `${km(drawer.data.toChainageM - drawer.data.fromChainageM)} km` },
              { label: 'Contractor', value: drawer.data.contractorName || 'Not awarded', full: true },
              { label: 'Agreement', value: drawer.data.agreementNo || '—', full: true },
              { label: 'Estimated', value: inr(drawer.data.estimatedCost, { unit: 'cr' }) },
              { label: 'Awarded', value: drawer.data.awardedValue ? inr(drawer.data.awardedValue, { unit: 'cr' }) : '—' },
              { label: 'Billed', value: inr(drawer.data.billedAmount, { unit: 'cr' }) },
              { label: 'Commencement', value: fmtDate(drawer.data.commencementDate) },
              { label: 'Completion', value: fmtDate(drawer.data.originalCompletion) },
              { label: 'Progress', value: pct(drawer.data.physicalProgress), tone: 'var(--app-success)' },
            ]} />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-text-faint)' }}>Physical progress</div>
              <Progress value={drawer.data.physicalProgress} rag={drawer.data.health} height={8} showLabel />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ─── Milestone Gantt — planned bar with actual overlay ─────────────────── */
function MilestoneGantt({ milestones }) {
  if (!milestones?.length) return <EmptyState title="No milestones defined" />;

  const dates = milestones.flatMap(m => [m.baselineFinish, m.plannedFinish, m.actualFinish].filter(Boolean)).map(d => new Date(d));
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  const span = Math.max(1, max - min);
  const posOf = (d) => ((new Date(d) - min) / span) * 100;

  const tone = { completed: 'var(--app-success)', overdue: 'var(--app-danger)', in_progress: 'var(--app-info)', not_started: 'var(--app-text-faint)' };

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 620 }}>
        {milestones.map(m => (
          <div key={m.id} className="flex items-center gap-3 py-1.5"
            style={{ borderLeft: m.isCritical ? '2px solid var(--app-danger)' : '2px solid transparent', paddingLeft: 8 }}>
            <div className="shrink-0" style={{ width: 190 }}>
              <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                <span style={{ color: 'var(--app-text-faint)', fontFamily: 'monospace', marginRight: 6 }}>{m.code}</span>{m.name}
              </div>
              <div className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
                baseline {fmtDate(m.baselineFinish)}
              </div>
            </div>

            <div className="flex-1 relative" style={{ height: 22 }}>
              <div style={{ position: 'absolute', top: 10, left: 0, right: 0, height: 1, background: 'rgba(128,128,128,0.18)' }} />
              {/* baseline tick */}
              <span title={`Baseline ${fmtDate(m.baselineFinish)}`}
                style={{ position: 'absolute', top: 4, left: `${posOf(m.baselineFinish)}%`, width: 2, height: 13, background: 'var(--app-text-faint)', opacity: 0.6 }} />
              {/* planned → actual bar */}
              <span title={`${m.status.replace('_', ' ')} · planned ${fmtDate(m.plannedFinish)}${m.actualFinish ? ` · actual ${fmtDate(m.actualFinish)}` : ''}`}
                style={{
                  position: 'absolute', top: 7,
                  left: `${Math.min(posOf(m.baselineFinish), posOf(m.actualFinish || m.plannedFinish))}%`,
                  width: `${Math.max(1.2, Math.abs(posOf(m.actualFinish || m.plannedFinish) - posOf(m.baselineFinish)))}%`,
                  height: 7, borderRadius: 4, background: tone[m.status], opacity: 0.92,
                }} />
            </div>

            <div className="shrink-0 text-right" style={{ width: 110 }}>
              <Chip tone={m.status === 'completed' ? 'normal' : m.status === 'overdue' ? 'critical' : m.status === 'in_progress' ? 'info' : 'info'}>
                {m.status.replace('_', ' ').toUpperCase()}
              </Chip>
            </div>
            <div className="shrink-0 text-right text-[10.5px] font-semibold tabular-nums" style={{ width: 64, color: m.slipDays > 0 ? 'var(--app-danger)' : 'var(--app-success)' }}>
              {m.slipDays > 0 ? `+${m.slipDays}d` : m.slipDays < 0 ? `${m.slipDays}d` : '—'}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-2 text-[10px] flex-wrap"
        style={{ borderTop: '1px solid rgba(128,128,128,0.14)', color: 'var(--app-text-faint)' }}>
        <span>Red left edge = critical path</span>
        <span>· Grey tick = original sanction baseline</span>
        <span>· Bar length = slip against baseline</span>
      </div>
    </div>
  );
}
