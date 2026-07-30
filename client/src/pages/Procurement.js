import React, { useEffect, useState } from 'react';
import KPICard, { IcoGavel, IcoRupee, IcoClock, IcoPeople } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Btn, Select, SearchBox, Tabs,
  KpiGrid, Drawer, Facts } from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { Pager } from './Portfolio';
import { getTenders } from '../services/api';
import { useData } from '../services/socket';
import { inr, fmtDate, TENDER_STAGES, STAGE_LABEL } from '../data/rvnlData';

const STAGE_OPTIONS = [{ value: 'all', label: 'All stages' }, ...TENDER_STAGES.map(s => ({ value: s, label: STAGE_LABEL[s] }))];
const PORTAL_OPTIONS = [
  { value: 'all', label: 'All portals' },
  { value: 'IREPS', label: 'IREPS' },
  { value: 'GeM', label: 'GeM' },
  { value: 'CPP Portal', label: 'CPP Portal' },
];

export default function Procurement() {
  const { zone, setZone, lastUpdate } = useData();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pipeline');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');
  const [portal, setPortal] = useState('all');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);

  useEffect(() => { setPage(1); }, [q, stage, portal, zone]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getTenders({ q, stage, portal, page, pageSize: view === 'pipeline' ? 200 : 20 })
      .then(r => { if (alive) { setRows(r.data); setMeta(r.meta); setLoading(false); } });
    return () => { alive = false; };
  }, [q, stage, portal, page, view, zone, lastUpdate]);

  const byStage = meta.byStage || {};

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Procurement & Tenders" breadcrumb={['Commercial']}
        subtitle="Packaging decision → NIT → evaluation → LOA → agreement"
        actions={<Tabs value={view} onChange={setView} tabs={[
          { value: 'pipeline', label: 'Pipeline' },
          { value: 'table', label: 'Table' },
        ]} />}>
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      <KpiGrid>
        <KPICard label="Live Tenders" value={String(meta.totalItems ?? 0)} icon={<IcoGavel />} rag="normal"
          subValues={[{ label: 'AWARDED', value: String((byStage.loa_issued || 0) + (byStage.agreement_signed || 0)) }]} />
        <KPICard label="Tendered Value" value={inr(meta.totalValue || 0, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoRupee />} rag="normal"
          subValues={[{ label: 'ACROSS', value: `${meta.totalItems ?? 0} tenders` }]} />
        <KPICard label="Avg Cycle Time" value={String(meta.avgCycleDays ?? 0)} unit="days" icon={<IcoClock />}
          rag={(meta.avgCycleDays ?? 0) > 220 ? 'critical' : (meta.avgCycleDays ?? 0) > 150 ? 'warning' : 'normal'}
          subValues={[{ label: 'NIT → LOA', value: 'target 120d' }]} />
        <KPICard label="Under Evaluation" value={String((byStage.technical_evaluation || 0) + (byStage.financial_opening || 0))}
          icon={<IcoPeople />} rag="warning"
          subValues={[{ label: 'TECHNICAL', value: String(byStage.technical_evaluation || 0) },
          { label: 'FINANCIAL', value: String(byStage.financial_opening || 0) }]} />
      </KpiGrid>

      <Panel>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBox value={q} onChange={setQ} placeholder="Search tender no., project, bidder…" width={280} />
          <Select value={stage} onChange={setStage} options={STAGE_OPTIONS} width={185} />
          <Select value={portal} onChange={setPortal} options={PORTAL_OPTIONS} width={150} />
          {(q || stage !== 'all' || portal !== 'all') && <Btn onClick={() => { setQ(''); setStage('all'); setPortal('all'); }}>Clear</Btn>}
        </div>
      </Panel>

      {loading ? <Loading /> : view === 'pipeline' ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: 1100 }}>
            {TENDER_STAGES.map(st => {
              const items = rows.filter(r => r.stage === st);
              return (
                <div key={st} className="flex-1" style={{ minWidth: 190 }}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>{STAGE_LABEL[st]}</span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.length === 0 ? (
                      <div className="rounded-xl text-center py-4 text-[10px]"
                        style={{ background: 'var(--app-surface-soft)', color: 'var(--app-text-faint)' }}>None</div>
                    ) : items.map(t => (
                      <button key={t.id} onClick={() => setDrawer(t)}
                        className="glass-panel rounded-xl p-2.5 text-left"
                        style={{ border: 'none' }}>
                        <div className="text-[10px] font-mono mb-1 truncate" style={{ color: 'var(--app-text-faint)' }}>{t.tenderNo}</div>
                        <div className="text-[11px] font-semibold leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--app-text)' }}>{t.projectName}</div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10.5px] font-bold" style={{ color: 'var(--app-text-muted)' }}>{inr(t.estimatedValue, { unit: 'cr', decimals: 0 })}</span>
                          <Chip tone={t.rag}>{t.portal}</Chip>
                        </div>
                        {t.biddersCount > 0 && (
                          <div className="text-[9.5px] mt-1.5" style={{ color: 'var(--app-text-faint)' }}>{t.biddersCount} bidders · {t.cycleDays}d</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Panel title="Tender Register">
          <DataTable
            rows={rows}
            emptyTitle="No tenders match these filters"
            onRowClick={setDrawer}
            columns={[
              { key: 'tenderNo', label: 'Tender', width: 165, render: r => <span className="font-mono text-[10.5px]" style={{ color: 'var(--app-text)' }}>{r.tenderNo}</span> },
              { key: 'projectName', label: 'Project', maxWidth: 220 },
              { key: 'scope', label: 'Scope', maxWidth: 200 },
              { key: 'estimatedValue', label: 'Estimate', align: 'right', width: 108, render: r => inr(r.estimatedValue, { unit: 'cr', decimals: 0 }) },
              { key: 'biddersCount', label: 'Bidders', align: 'right', width: 78, render: r => r.biddersCount || '—' },
              { key: 'l1Name', label: 'L1', maxWidth: 160, render: r => r.l1Name || <span style={{ color: 'var(--app-text-faint)' }}>—</span> },
              { key: 'variancePct', label: 'Vs estimate', align: 'right', width: 108, render: r =>
                r.variancePct == null ? '—' : (
                  <span style={{ fontWeight: 700, color: Math.abs(r.variancePct) > 10 ? 'var(--app-warning)' : 'var(--app-success)' }}>
                    {r.variancePct > 0 ? '+' : ''}{r.variancePct}%
                  </span>
                ) },
              { key: 'cycleDays', label: 'Cycle', align: 'right', width: 76, render: r => `${r.cycleDays}d` },
              { key: 'stage', label: 'Stage', align: 'right', width: 150, sortable: false, render: r => <Chip tone={r.rag}>{r.stageLabel}</Chip> },
            ]} />
          <Pager meta={meta} onPage={setPage} />
        </Panel>
      )}

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} width={480}
        title={drawer?.tenderNo || ''} subtitle={drawer?.projectName}>
        {drawer && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone={drawer.rag}>{drawer.stageLabel}</Chip>
              <Chip tone="info">{drawer.portal}</Chip>
              {drawer.variancePct != null && Math.abs(drawer.variancePct) > 10 && (
                <Chip tone="warning">RATE VARIANCE {drawer.variancePct > 0 ? '+' : ''}{drawer.variancePct}%</Chip>
              )}
            </div>

            <Facts items={[
              { label: 'Scope', value: drawer.scope, full: true },
              { label: 'Estimated value', value: inr(drawer.estimatedValue, { unit: 'cr' }) },
              { label: 'Zone', value: drawer.zone },
              { label: 'NIT date', value: fmtDate(drawer.nitDate) },
              { label: 'Closing date', value: fmtDate(drawer.closingDate) },
              { label: 'Bidders', value: drawer.biddersCount || 'Not yet opened' },
              { label: 'Cycle time', value: `${drawer.cycleDays} days` },
              drawer.l1Name && { label: 'L1 bidder', value: drawer.l1Name, full: true },
              drawer.l1Value && { label: 'L1 value', value: inr(drawer.l1Value, { unit: 'cr' }) },
              drawer.variancePct != null && { label: 'Variance vs estimate', value: `${drawer.variancePct > 0 ? '+' : ''}${drawer.variancePct}%`, tone: Math.abs(drawer.variancePct) > 10 ? 'var(--app-warning)' : 'var(--app-success)' },
            ]} />

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-faint)' }}>Stage progress</div>
              <div className="flex flex-col gap-1.5">
                {TENDER_STAGES.map((st, i) => {
                  const current = TENDER_STAGES.indexOf(drawer.stage);
                  const done = i < current, active = i === current;
                  return (
                    <div key={st} className="flex items-center gap-2.5">
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: done ? 'var(--app-success)' : active ? 'var(--app-warning)' : 'transparent',
                        border: `2px solid ${done ? 'var(--app-success)' : active ? 'var(--app-warning)' : 'var(--app-text-faint)'}` }} />
                      <span className="text-[11px]" style={{ color: active ? 'var(--app-text)' : done ? 'var(--app-text-muted)' : 'var(--app-text-faint)', fontWeight: active ? 700 : 500 }}>
                        {STAGE_LABEL[st]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {Math.abs(drawer.variancePct || 0) > 10 && (
              <div className="text-[10.5px] rounded-lg p-2.5" style={{ background: 'var(--app-warning-bg)', color: 'var(--app-text-muted)' }}>
                L1 rate is more than 10% away from the estimate. A recorded justification is required before award approval.
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
