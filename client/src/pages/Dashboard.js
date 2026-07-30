import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';

import KPICard, { IcoTrack, IcoRupee, IcoLand, IcoAlert } from '../components/KPICard';
import { PageHeader, Panel, Chip, Loading, Progress, Btn, KpiGrid, MiniStat } from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import TwinPreview from '../components/TwinPreview';
import { chartTooltip, seriesColor, seriesFill } from '../components/chartUtils';
import { getExecutiveDashboard } from '../services/api';
import { useData } from '../services/socket';
import { inr, pct, CURRENT_FY } from '../data/rvnlData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const CAUSE_TONE = {
  land: 'critical', forest_ec: 'critical', utility: 'warning', traffic_block: 'warning',
  contractor: 'warning', funds: 'critical', geology: 'warning', monsoon: 'info',
  interface: 'info', approval: 'warning',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { zone, setZone, lastUpdate, requestData } = useData();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getExecutiveDashboard({ zone }).then(res => {
      if (alive) { setPayload(res.data); setLoading(false); }
    });
    return () => { alive = false; };
  }, [zone, lastUpdate]);

  const s = payload?.stats;

  /* Portfolio S-curve — planned / actual / forecast */
  const sCurveChart = useMemo(() => {
    if (!payload) return null;
    const c = payload.sCurve;
    return {
      labels: c.labels,
      datasets: [
        { label: 'Planned', data: c.planned, borderColor: seriesColor(1), backgroundColor: seriesFill(1, 0.12), fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
        { label: 'Actual', data: c.actual, borderColor: seriesColor(3), backgroundColor: 'transparent', tension: 0.35, pointRadius: 0, borderWidth: 2.4 },
        { label: 'AI Forecast', data: c.forecast, borderColor: seriesColor(4), backgroundColor: 'transparent', borderDash: [5, 4], tension: 0.35, pointRadius: 0, borderWidth: 2 },
      ],
    };
  }, [payload]);

  const buildOutChart = useMemo(() => {
    if (!payload) return null;
    const b = payload.buildOut;
    return {
      labels: ['Completed', 'Balance'],
      datasets: [{
        data: [b.doneKm, b.balanceKm],
        backgroundColor: ['#16a34a', 'rgba(220,38,38,0.55)'],
        borderWidth: 0,
      }],
    };
  }, [payload]);

  /* Only the first load blanks the page — a later refresh swaps the data in
     underneath the existing panels so the preview map never remounts. */
  if (!payload) return <Loading label="Building northern portfolio view…" />;

  const b = payload.buildOut;
  const donePctKm = b.totalKm ? (b.doneKm / b.totalKm) * 100 : 0;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Northern Corridor Command"
        subtitle={`${s.projectCount} corridors · ${s.activeCount} under execution · ${b.totalKm.toLocaleString('en-IN')} route km · FY ${CURRENT_FY} · as at ${lastUpdate.toLocaleTimeString('en-IN', { hour12: false })}`}
        actions={
          <>
            <Btn onClick={requestData} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Btn>
            <Btn variant="primary" onClick={() => navigate('/twin')}>Open digital twin</Btn>
          </>
        }
      >
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      {/* ── The four that matter ──────────────────────────────────────────── */}
      <KpiGrid>
        <KPICard label="Physical Progress" value={s.physicalProgress.toFixed(1)} unit="%"
          icon={<IcoTrack />} rag={s.variance <= -10 ? 'critical' : s.variance < -3 ? 'warning' : 'normal'} trend={s.variance}
          subValues={[{ label: 'PLANNED', value: pct(s.plannedProgress) }, { label: 'TRACK DONE', value: `${b.doneKm.toLocaleString('en-IN')} km` }]}
          onClick={() => navigate('/twin')} />

        <KPICard label="Portfolio Value" value={inr(s.totalEstimate, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoRupee />} rag="normal" trend={4.2}
          subValues={[{ label: 'SPENT', value: inr(s.totalExpenditure, { unit: 'cr', decimals: 0 }) }, { label: 'BURN', value: `${s.burnPct}%` }]}
          onClick={() => navigate('/finance')} />

        <KPICard label="Land in Possession" value={s.land.acquiredPct.toFixed(1)} unit="%"
          icon={<IcoLand />} rag={s.land.acquiredPct < 70 ? 'critical' : s.land.acquiredPct < 88 ? 'warning' : 'normal'}
          subValues={[{ label: 'BLOCKED', value: `${s.land.blockedKm} km` }, { label: 'PARCELS DUE', value: s.land.pending.toLocaleString('en-IN') }]}
          onClick={() => navigate('/twin')} />

        <KPICard label="Corridors At Risk" value={String(s.projectsAtRisk)}
          icon={<IcoAlert />} rag={s.criticalProjects > 3 ? 'critical' : 'warning'} trend={12.5}
          subValues={[{ label: 'CRITICAL', value: String(s.criticalProjects) }, { label: 'EXPOSURE', value: inr(s.riskExposure, { unit: 'cr', decimals: 0 }) }]}
          onClick={() => navigate('/twin')} />
      </KpiGrid>

      {/* ── Twin preview + build-out ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel className="lg:col-span-2" title="Digital Twin — northern network"
          subtitle="Green is track laid, red is balance · click a corridor to open it in the twin"
          actions={<Btn onClick={() => navigate('/twin')} style={{ padding: '4px 9px', fontSize: 10.5 }}>Full twin →</Btn>}>
          <TwinPreview corridors={payload.corridors} height={340} zoom={5}
            onSelect={(id) => navigate(`/twin?project=${id}`)} />
        </Panel>

        <Panel title="Network build-out" subtitle="Route kilometres across the northern portfolio">
          <div className="flex flex-col items-center">
            <div style={{ height: 168, width: '100%', position: 'relative' }}>
              {buildOutChart && (
                <Doughnut data={buildOutChart} options={{
                  responsive: true, maintainAspectRatio: false, cutout: '72%',
                  plugins: {
                    legend: { display: false },
                    tooltip: chartTooltip({ callbacks: { label: (c) => ` ${c.label}: ${c.parsed.toLocaleString('en-IN')} km` } }),
                  },
                }} />
              )}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span className="text-[26px] font-bold leading-none" style={{ color: 'var(--app-text)' }}>{donePctKm.toFixed(0)}%</span>
                <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>track laid</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full mt-3">
              <MiniStat label="Completed" value={`${b.doneKm.toLocaleString('en-IN')} km`} tone="var(--app-success)" />
              <MiniStat label="Balance" value={`${b.balanceKm.toLocaleString('en-IN')} km`} tone="var(--app-danger)" />
              <MiniStat label="Blocked by land" value={`${b.blockedKm} km`} tone="var(--app-danger)" />
              <MiniStat label="Crews on site now" value={b.crewsOnSite} tone="var(--app-info)" sub={`${b.evidenceToday} AI-checked photos today`} />
            </div>
          </div>
        </Panel>
      </div>

      {/* ── S-curve + corridor bars ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel className="lg:col-span-2" title="Portfolio S-Curve"
          subtitle={`Cumulative physical progress · FY ${CURRENT_FY} · forecast is model-generated`}>
          <div style={{ height: 240 }}>
            {sCurveChart && (
              <Line data={sCurveChart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 10 }, color: 'var(--app-text-muted)', padding: 12 } },
                  tooltip: chartTooltip({ callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y == null ? '—' : c.parsed.y + '%'}` } }),
                },
                scales: {
                  x: { grid: { display: false }, ticks: { color: 'var(--app-text-faint)', font: { size: 9.5 } } },
                  y: { grid: { color: 'var(--app-chart-grid)', drawBorder: false }, ticks: { color: 'var(--app-text-faint)', font: { size: 9.5 }, callback: v => v + '%' }, beginAtZero: true },
                },
              }} />
            )}
          </div>
        </Panel>

        <Panel title="Corridor completion" subtitle="Worst schedule variance first"
          actions={<Btn onClick={() => navigate('/portfolio')} style={{ padding: '4px 9px', fontSize: 10.5 }}>All</Btn>}>
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 250 }}>
            {payload.attention.map(p => (
              <button key={p.id} onClick={() => navigate(`/twin?project=${p.id}`)}
                className="text-left rounded-lg p-2" style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{p.name}</span>
                  <span className="text-[9.5px] font-bold shrink-0"
                    style={{ color: p.variance < -8 ? 'var(--app-danger)' : p.variance < 0 ? 'var(--app-warning)' : 'var(--app-success)' }}>
                    {p.variance > 0 ? '+' : ''}{p.variance} pp
                  </span>
                </div>
                <Progress value={p.physicalProgress} planned={p.plannedPhysical} rag={p.health} height={5} />
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── What is holding the corridors up ──────────────────────────────── */}
      <Panel title="What is holding the corridors up" subtitle="Ranked by financial exposure · open in the twin at the affected chainage">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {payload.bottlenecks.map(x => (
            <button key={x.id} onClick={() => navigate(`/twin?project=${x.projectId}`)}
              className="text-left rounded-lg p-2.5" style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <Chip tone={CAUSE_TONE[x.cause] || 'info'}>{x.causeLabel}</Chip>
              </div>
              <div className="text-[11px] font-semibold leading-snug mb-1.5" style={{ color: 'var(--app-text)' }}>{x.label}</div>
              <div className="flex items-center justify-between text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
                <span>{inr(x.exposure, { unit: 'cr', decimals: 0 })}</span>
                <span>{x.daysOpen} d open</span>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
