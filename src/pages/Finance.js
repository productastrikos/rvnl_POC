import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js';
import KPICard, { IcoRupee, IcoBarChart, IcoTrendUp, IcoAlert } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Progress, KpiGrid, MiniStat, Tabs } from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { chartTooltip, seriesColor, seriesFill } from '../components/chartUtils';
import { getFinanceSummary } from '../services/api';
import { useData } from '../services/socket';
import { inr, CURRENT_FY } from '../data/rvnlData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

export default function Finance() {
  const navigate = useNavigate();
  const { zone, setZone, lastUpdate } = useData();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getFinanceSummary({ zone }).then(r => { if (alive) { setD(r.data); setLoading(false); } });
    return () => { alive = false; };
  }, [zone, lastUpdate]);

  if (loading || !d) return <Loading label="Loading financials…" />;
  const s = d.stats;

  const zoneChart = {
    labels: d.byZone.slice(0, 9).map(r => r.zone),
    datasets: [
      { label: 'Sanctioned', data: d.byZone.slice(0, 9).map(r => Math.round(r.allocated / 100)), backgroundColor: seriesColor(1), borderRadius: 4, borderSkipped: false, barPercentage: 0.72, categoryPercentage: 0.68 },
      { label: 'Expenditure', data: d.byZone.slice(0, 9).map(r => Math.round(r.expenditure / 100)), backgroundColor: seriesColor(2), borderRadius: 4, borderSkipped: false, barPercentage: 0.72, categoryPercentage: 0.68 },
    ] };

  const cashChart = {
    labels: d.cashFlow.labels,
    datasets: [
      { label: 'Planned outflow', data: d.cashFlow.planned.map(v => Math.round(v / 100)), borderColor: seriesColor(1), backgroundColor: seriesFill(1, 0.12), fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
      { label: 'Actual outflow', data: d.cashFlow.actual.map(v => v == null ? null : Math.round(v / 100)), borderColor: seriesColor(3), backgroundColor: 'transparent', tension: 0.35, pointRadius: 0, borderWidth: 2.4, spanGaps: false },
    ] };

  const opts = (unit = 'Cr') => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 10 }, color: 'var(--app-text-muted)', padding: 12 } },
      tooltip: chartTooltip({ callbacks: { label: c => ` ${c.dataset.label}: ₹${(c.parsed.y ?? 0).toLocaleString('en-IN')} ${unit}` } }) },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'var(--app-text-faint)', font: { size: 9.5 } } },
      y: { grid: { color: 'var(--app-chart-grid)', drawBorder: false }, ticks: { color: 'var(--app-text-faint)', font: { size: 9.5 }, callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v }, beginAtZero: true } } });

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Budget & Expenditure" breadcrumb={['Commercial']}
        subtitle={`FY ${CURRENT_FY} · sanction, estimate, commitment and actual expenditure`}
        actions={<Tabs value={tab} onChange={setTab} tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'variance', label: 'Cost Variance' },
          { value: 'zones', label: 'By Zone' },
        ]} />}>
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      <KpiGrid>
        <KPICard label="Sanctioned Cost" value={inr(s.totalSanction, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoRupee />} rag="normal"
          subValues={[{ label: 'PROJECTS', value: String(s.projectCount) }]} />
        <KPICard label="Current Estimate" value={inr(s.totalEstimate, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoTrendUp />}
          rag={s.totalEstimate > s.totalSanction * 1.15 ? 'critical' : s.totalEstimate > s.totalSanction * 1.05 ? 'warning' : 'normal'}
          trend={parseFloat((((s.totalEstimate - s.totalSanction) / s.totalSanction) * 100).toFixed(1))}
          subValues={[{ label: 'OVER SANCTION', value: `+${(((s.totalEstimate - s.totalSanction) / s.totalSanction) * 100).toFixed(1)}%` }]} />
        <KPICard label="Expenditure" value={inr(s.totalExpenditure, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoBarChart />}
          rag={s.burnPct < 45 ? 'critical' : s.burnPct < 62 ? 'warning' : 'normal'}
          subValues={[{ label: 'BURN', value: `${s.burnPct}%` }]} />
        <KPICard label="Bills Pending" value={String(d.billing.pending)} icon={<IcoAlert />}
          rag={d.billing.ageingOver21 > 5 ? 'critical' : d.billing.pending > 8 ? 'warning' : 'normal'}
          subValues={[{ label: 'VALUE', value: inr(d.billing.pendingValue, { unit: 'cr', decimals: 0 }) },
          { label: '>21 DAYS', value: String(d.billing.ageingOver21) }]}
          onClick={() => navigate('/billing')} />
      </KpiGrid>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title="Sanctioned vs Expenditure by Zone" subtitle="₹ Cr">
              <div style={{ height: 250 }}><Bar data={zoneChart} options={opts()} /></div>
            </Panel>
            <Panel title="Cash Flow" subtitle={`Planned vs actual outflow · FY ${CURRENT_FY} · ₹ Cr`}>
              <div style={{ height: 250 }}><Line data={cashChart} options={opts()} /></div>
            </Panel>
          </div>

          <Panel title="Financial Position">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <MiniStat label="Sanction" value={inr(s.totalSanction, { unit: 'cr', decimals: 0 })} />
              <MiniStat label="Estimate" value={inr(s.totalEstimate, { unit: 'cr', decimals: 0 })} tone="var(--app-warning)" />
              <MiniStat label="Expenditure" value={inr(s.totalExpenditure, { unit: 'cr', decimals: 0 })} />
              <MiniStat label="Balance to spend" value={inr(s.totalEstimate - s.totalExpenditure, { unit: 'cr', decimals: 0 })} />
              <MiniStat label="Bills paid" value={inr(d.billing.paidValue, { unit: 'cr', decimals: 0 })} tone="var(--app-success)" />
              <MiniStat label="Bills pending" value={inr(d.billing.pendingValue, { unit: 'cr', decimals: 0 })} tone="var(--app-warning)" />
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(128,128,128,0.14)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-faint)' }}>
                Portfolio burn against current estimate
              </div>
              <Progress value={s.burnPct} height={9} showLabel rag={s.burnPct < 45 ? 'critical' : s.burnPct < 62 ? 'warning' : 'normal'} />
            </div>
          </Panel>
        </>
      )}

      {tab === 'variance' && (
        <Panel title="Cost Variance & Projection" subtitle="Sanction vs current estimate vs projected cost at completion — worst first">
          <DataTable
            rows={d.variance}
            onRowClick={r => navigate(`/projects/${r.id}`)}
            columns={[
              { key: 'name', label: 'Project', maxWidth: 280, render: r => (
                <div><div className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{r.name}</div>
                  <div className="text-[9.5px] font-mono" style={{ color: 'var(--app-text-faint)' }}>{r.code}</div></div>
              ) },
              { key: 'zone', label: 'Zone', width: 62 },
              { key: 'sanctioned', label: 'Sanctioned', align: 'right', width: 108, render: r => inr(r.sanctioned, { unit: 'cr', decimals: 0 }) },
              { key: 'estimate', label: 'Estimate', align: 'right', width: 108, render: r => inr(r.estimate, { unit: 'cr', decimals: 0 }) },
              { key: 'overrunPct', label: 'Over sanction', align: 'right', width: 116, render: r => (
                <span style={{ fontWeight: 700, color: r.overrunPct > 20 ? 'var(--app-danger)' : r.overrunPct > 5 ? 'var(--app-warning)' : 'var(--app-success)' }}>
                  {r.overrunPct > 0 ? '+' : ''}{r.overrunPct}%
                </span>
              ) },
              { key: 'expenditure', label: 'Spent', align: 'right', width: 104, render: r => inr(r.expenditure, { unit: 'cr', decimals: 0 }) },
              { key: 'projectedAtCompletion', label: 'Projected at completion', align: 'right', width: 178, render: r => (
                <span style={{ color: r.projectedAtCompletion > r.sanctioned * 1.2 ? 'var(--app-danger)' : 'var(--app-text-muted)', fontWeight: 600 }}>
                  {inr(r.projectedAtCompletion, { unit: 'cr', decimals: 0 })}
                </span>
              ) },
              { key: 'flag', label: 'Flag', align: 'right', width: 108, sortable: false, sortValue: r => r.overrunPct, render: r =>
                r.projectedAtCompletion > r.sanctioned * 1.2 ? <Chip tone="critical">OVER 120%</Chip>
                  : r.projectedAtCompletion > r.sanctioned * 1.05 ? <Chip tone="warning">OVER 105%</Chip>
                    : <Chip tone="normal">WITHIN</Chip> },
            ]} />
          <div className="text-[10px] mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(128,128,128,0.14)', color: 'var(--app-text-faint)' }}>
            Projected cost at completion = billed to date + remaining quantity at current rate + price variation + time-related cost + risk exposure.
            Every term is an auditable number, not a model output.
          </div>
        </Panel>
      )}

      {tab === 'zones' && (
        <Panel title="Zone-wise Financial Position" subtitle="Allocation, commitment and burn by railway zone">
          <DataTable
            rows={d.byZone}
            columns={[
              { key: 'zone', label: 'Zone', width: 80, render: r => <span className="font-bold" style={{ color: 'var(--app-text)' }}>{r.zone}</span> },
              { key: 'projects', label: 'Projects', align: 'right', width: 88 },
              { key: 'allocated', label: 'Sanctioned', align: 'right', width: 120, render: r => inr(r.allocated, { unit: 'cr', decimals: 0 }) },
              { key: 'committed', label: 'Committed', align: 'right', width: 120, render: r => inr(r.committed, { unit: 'cr', decimals: 0 }) },
              { key: 'expenditure', label: 'Expenditure', align: 'right', width: 120, render: r => inr(r.expenditure, { unit: 'cr', decimals: 0 }) },
              { key: 'burnPct', label: 'Burn rate', width: 180, render: r => (
                <Progress value={r.burnPct} showLabel rag={r.burnPct < 45 ? 'critical' : r.burnPct < 62 ? 'warning' : 'normal'} />
              ) },
            ]} />
        </Panel>
      )}
    </div>
  );
}
