import React, { useState } from 'react';
import KPICard, { IcoClipboard, IcoBarChart, IcoRupee, IcoTrack } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Btn, DataTable, KpiGrid, MiniStat, Loading, EmptyState,
} from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { generateReport } from '../services/api';
import { useData } from '../services/socket';
import { inr, pct, CURRENT_FY, fmtDate } from '../data/rvnlData';

const REPORTS = [
  {
    kind: 'MPR', title: 'Monthly Progress Report',
    desc: 'Railway Board format. Physical and financial progress per project, milestone status, land and clearance position, and reasons for slippage.',
    cadence: 'Monthly · due by the 7th', recipient: 'Railway Board / IRPSM',
  },
  {
    kind: 'BOARD_PACK', title: 'Board Review Pack',
    desc: 'Portfolio position for the Board — value, burn, projects at risk, exposure, and the top bottlenecks with cause attribution.',
    cadence: 'Quarterly', recipient: 'RVNL Board of Directors',
  },
  {
    kind: 'MINISTRY', title: 'Ministry Status Return',
    desc: 'Ministry of Railways format for PRAGATI and parliamentary questions. Sanction, expenditure, completion target and revised target.',
    cadence: 'On demand', recipient: 'Ministry of Railways',
  },
  {
    kind: 'RAIL_DRISHTI', title: 'Rail Drishti Export',
    desc: 'Machine-readable extract for the Rail Drishti public dashboard — project code, status, progress and target dates.',
    cadence: 'Weekly', recipient: 'Rail Drishti platform',
  },
  {
    kind: 'CAG_EXTRACT', title: 'Audit Extract (CAG)',
    desc: 'Entity lineage with the full approval chain, rate deviations, variation orders and the hash-chained audit trail for the selected period.',
    cadence: 'On demand', recipient: 'CAG / Internal Audit',
  },
  {
    kind: 'LAND_STATUS', title: 'Land & Clearance Return',
    desc: 'Village-wise parcel position under §20A–20G with blocked km, and the statutory clearance register with ageing against SLA.',
    cadence: 'Monthly', recipient: 'HQ Planning / State liaison',
  },
];

export default function Reports() {
  const { zone, setZone } = useData();
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);

  const run = async (kind) => {
    setBusy(kind);
    setResult(null);
    const r = await generateReport(kind, { zone });
    setResult(r.data);
    setBusy(null);
  };

  const download = () => {
    if (!result) return;
    const cols = Object.keys(result.rows[0] || {});
    const csv = [
      cols.join(','),
      ...result.rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.downloadName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = result?.stats;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Reports & Exports" breadcrumb={['Knowledge']}
        subtitle={`Statutory and management reporting for FY ${CURRENT_FY} — generated from primary records, not re-keyed`}>
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORTS.map(r => (
          <Panel key={r.kind} className="flex flex-col">
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[13px] font-bold leading-snug" style={{ color: 'var(--app-text)' }}>{r.title}</h3>
                <Chip tone="info">{r.kind.replace('_', ' ')}</Chip>
              </div>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--app-text-muted)' }}>{r.desc}</p>
              <div className="flex flex-col gap-1 mb-3 text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                <span>Cadence · {r.cadence}</span>
                <span>Recipient · {r.recipient}</span>
              </div>
            </div>
            <Btn variant="primary" onClick={() => run(r.kind)} disabled={!!busy} style={{ width: '100%' }}>
              {busy === r.kind ? 'Generating…' : 'Generate'}
            </Btn>
          </Panel>
        ))}
      </div>

      {busy && <Loading label={`Generating ${busy.replace('_', ' ')} for ${zone === 'ALL' ? 'all zones' : zone}…`} />}

      {result && !busy && (
        <>
          <KpiGrid>
            <KPICard label="Projects in Report" value={String(result.rowCount)} icon={<IcoClipboard />} rag="normal"
              subValues={[{ label: 'SCOPE', value: zone === 'ALL' ? 'All zones' : zone }]} />
            <KPICard label="Physical Progress" value={s.physicalProgress.toFixed(1)} unit="%" icon={<IcoTrack />}
              rag={s.variance <= -10 ? 'critical' : s.variance < -3 ? 'warning' : 'normal'}
              subValues={[{ label: 'PLANNED', value: pct(s.plannedProgress) }, { label: 'VARIANCE', value: `${s.variance} pp` }]} />
            <KPICard label="Expenditure" value={inr(s.totalExpenditure, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
              unit="₹ Cr" icon={<IcoRupee />} rag="normal"
              subValues={[{ label: 'BURN', value: `${s.burnPct}%` }]} />
            <KPICard label="Projects At Risk" value={String(s.projectsAtRisk)} icon={<IcoBarChart />}
              rag={s.criticalProjects > 3 ? 'critical' : 'warning'}
              subValues={[{ label: 'CRITICAL', value: String(s.criticalProjects) }]} />
          </KpiGrid>

          <Panel
            title={`${result.kind.replace('_', ' ')} — FY ${result.fy}`}
            subtitle={`Generated ${new Date(result.generatedAt).toLocaleString('en-IN')} · ${result.rowCount} rows`}
            actions={<Btn variant="primary" onClick={download}>Download CSV</Btn>}>
            <DataTable
              maxHeight={460}
              rows={result.rows}
              keyField="code"
              emptyTitle="No rows in this report"
              columns={[
                { key: 'code', label: 'Project code', width: 175, render: r => <span className="font-mono text-[10.5px]" style={{ color: 'var(--app-text)' }}>{r.code}</span> },
                { key: 'name', label: 'Project', maxWidth: 250 },
                { key: 'zone', label: 'Zone', width: 60 },
                { key: 'piu', label: 'PIU', maxWidth: 130 },
                { key: 'status', label: 'Status', width: 130 },
                { key: 'sanctioned', label: 'Sanctioned', align: 'right', width: 110, render: r => inr(r.sanctioned, { unit: 'cr', decimals: 0 }) },
                { key: 'expenditure', label: 'Expenditure', align: 'right', width: 110, render: r => inr(r.expenditure, { unit: 'cr', decimals: 0 }) },
                { key: 'physical', label: 'Physical', align: 'right', width: 84, render: r => pct(r.physical) },
                { key: 'variance', label: 'Variance', align: 'right', width: 88, render: r => (
                  <span style={{ fontWeight: 700, color: r.variance < -8 ? 'var(--app-danger)' : r.variance < 0 ? 'var(--app-warning)' : 'var(--app-success)' }}>
                    {r.variance > 0 ? '+' : ''}{r.variance}
                  </span>
                ) },
                { key: 'target', label: 'Target', width: 108, render: r => fmtDate(r.target) },
                { key: 'revised', label: 'Revised', width: 108, render: r => r.revised ? <span style={{ color: 'var(--app-warning)' }}>{fmtDate(r.revised)}</span> : '—' },
              ]} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-3" style={{ borderTop: '1px solid rgba(128,128,128,0.14)' }}>
              <MiniStat label="Total sanction" value={inr(s.totalSanction, { unit: 'cr', decimals: 0 })} />
              <MiniStat label="Current estimate" value={inr(s.totalEstimate, { unit: 'cr', decimals: 0 })} tone="var(--app-warning)" />
              <MiniStat label="Milestones slipped" value={`${s.milestonesSlipped} / ${s.milestonesTotal}`} tone="var(--app-danger)" />
              <MiniStat label="Land blocked" value={`${s.land.blockedKm} km`} tone="var(--app-danger)" />
            </div>
          </Panel>
        </>
      )}

      {!result && !busy && (
        <Panel>
          <EmptyState title="No report generated yet"
            hint="Pick a report above. Figures are computed from the same primary records the dashboards use, so there is never a second version in a different spreadsheet." />
        </Panel>
      )}
    </div>
  );
}
