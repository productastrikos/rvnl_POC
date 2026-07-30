import React, { useEffect, useState } from 'react';
import KPICard, { IcoClipboard, IcoRupee, IcoClock, IcoSignature } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Btn, Select, SearchBox, Tabs, KpiGrid,
  Drawer, Facts, ApprovalTimeline,
} from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { Pager } from './Portfolio';
import { getApprovals, actApproval } from '../services/api';
import { useData } from '../services/socket';
import { inr, fmtDate } from '../data/rvnlData';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'ra_bill', label: 'RA Bill' },
  { value: 'variation', label: 'Variation Order' },
  { value: 'eot', label: 'Extension of Time' },
  { value: 'rebaseline', label: 'Milestone Rebaseline' },
  { value: 'tender_award', label: 'Tender Award' },
  { value: 'rate_analysis', label: 'Rate Analysis' },
  { value: 'dsr', label: 'Daily Site Report' },
];
const LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: 'site', label: 'Site' },
  { value: 'piu', label: 'PIU (CPM)' },
  { value: 'regional', label: 'Regional (GM)' },
  { value: 'hq', label: 'Corporate HQ' },
  { value: 'ministry', label: 'Railway Board' },
];

export default function Approvals() {
  const { zone, setZone, lastUpdate, user } = useData();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [level, setLevel] = useState('all');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPage(1); }, [q, entityType, level, tab, zone]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getApprovals({
      q, entityType, currentLevel: level,
      status: tab === 'pending' ? 'pending' : tab === 'history' ? undefined : 'pending',
      page, pageSize: 20,
    }).then(r => { if (alive) { setRows(r.data); setMeta(r.meta); setLoading(false); } });
    return () => { alive = false; };
  }, [q, entityType, level, tab, page, zone, lastUpdate]);

  const act = async (action) => {
    setBusy(true);
    await actApproval(drawer.id, action,
      remarks || { approved: 'Approved within delegated powers', rejected: 'Not approved', returned: 'Returned for clarification' }[action]);
    setBusy(false);
    setDrawer(null);
    setRemarks('');
  };

  const s = meta.stats || {};
  const shown = tab === 'breached' ? rows.filter(r => r.slaBreached) : rows;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Approvals Inbox" breadcrumb={['Governance']}
        subtitle="Delegation-of-powers driven chain — amount and entity type determine the levels required"
        actions={<Tabs value={tab} onChange={setTab} tabs={[
          { value: 'pending', label: 'Pending', count: s.pending },
          { value: 'breached', label: 'SLA breached', count: s.breached },
          { value: 'history', label: 'All' },
        ]} />}>
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      <KpiGrid>
        <KPICard label="Pending on Me" value={String(s.pending ?? 0)} icon={<IcoClipboard />}
          rag={(s.breached ?? 0) > 6 ? 'critical' : (s.pending ?? 0) > 15 ? 'warning' : 'normal'}
          subValues={[{ label: 'ROLE', value: user.designation?.split('(')[0]?.trim() || '—' }]} />
        <KPICard label="Value Pending" value={inr(s.value || 0, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoRupee />} rag="normal"
          subValues={[{ label: 'REQUESTS', value: String(s.pending ?? 0) }]} />
        <KPICard label="SLA Breached" value={String(s.breached ?? 0)} icon={<IcoClock />}
          rag={(s.breached ?? 0) > 6 ? 'critical' : (s.breached ?? 0) > 0 ? 'warning' : 'normal'}
          subValues={[{ label: 'NORM', value: '7 working days' }]} />
        <KPICard label="Actioned" value={String(s.approved ?? 0)} icon={<IcoSignature />} rag="normal"
          subValues={[{ label: 'THIS SESSION', value: 'signed' }]} />
      </KpiGrid>

      <Panel>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBox value={q} onChange={setQ} placeholder="Search request, project, raiser…" width={280} />
          <Select value={entityType} onChange={setEntityType} options={TYPE_OPTIONS} width={190} />
          <Select value={level} onChange={setLevel} options={LEVEL_OPTIONS} width={165} />
          {(q || entityType !== 'all' || level !== 'all') && <Btn onClick={() => { setQ(''); setEntityType('all'); setLevel('all'); }}>Clear</Btn>}
        </div>
      </Panel>

      {loading ? <Loading /> : (
        <Panel title="Requests" subtitle="Click to review the chain and act">
          <DataTable
            rows={shown}
            emptyTitle="Nothing pending"
            emptyHint="Requests routed to your level will appear here."
            onRowClick={r => { setDrawer(r); setRemarks(''); }}
            initialSort={{ key: 'ageingDays', dir: 'desc' }}
            columns={[
              { key: 'entityLabel', label: 'Type', width: 152, render: r => <Chip tone="info">{r.entityLabel}</Chip> },
              { key: 'projectName', label: 'Project', maxWidth: 260, render: r => (
                <div><div className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{r.projectName}</div>
                  <div className="text-[9.5px] font-mono" style={{ color: 'var(--app-text-faint)' }}>{r.projectCode}</div></div>
              ) },
              { key: 'amount', label: 'Amount', align: 'right', width: 108, render: r => r.amount ? inr(r.amount, { unit: 'cr' }) : '—' },
              { key: 'currentLevel', label: 'At level', width: 128, render: r => (
                <Chip tone={r.currentLevel === 'ministry' ? 'critical' : r.currentLevel === 'hq' ? 'warning' : 'info'}>
                  {{ site: 'SITE', piu: 'PIU', regional: 'REGIONAL', hq: 'HQ', ministry: 'RLY BOARD' }[r.currentLevel] || '—'}
                </Chip>
              ) },
              { key: 'raisedBy', label: 'Raised by', maxWidth: 128 },
              { key: 'raisedAt', label: 'Raised', width: 104, render: r => fmtDate(r.raisedAt) },
              { key: 'ageingDays', label: 'Ageing', align: 'right', width: 84, render: r => (
                <span style={{ fontWeight: 700, color: r.slaBreached ? 'var(--app-danger)' : 'var(--app-text-muted)' }}>{r.ageingDays}d</span>
              ) },
              { key: 'status', label: 'Status', align: 'right', width: 110, sortable: false, render: r => (
                <Chip tone={r.status === 'approved' ? 'normal' : r.status === 'rejected' ? 'critical' : r.status === 'returned' ? 'warning' : 'warning'}>
                  {r.status.toUpperCase()}
                </Chip>
              ) },
            ]} />
          <Pager meta={meta} onPage={setPage} />
        </Panel>
      )}

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} width={510}
        title={drawer?.entityLabel || ''} subtitle={drawer?.projectName}
        footer={drawer?.status === 'pending' && (
          <div className="space-y-2">
            <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)}
              placeholder="Remarks (recorded against your signature in the audit trail)…"
              className="w-full rounded-lg text-[11.5px] p-2"
              style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)', fontFamily: 'inherit', resize: 'vertical' }} />
            <div className="flex gap-2">
              <Btn variant="success" onClick={() => act('approved')} disabled={busy} style={{ flex: 1 }}>
                {busy ? 'Signing…' : 'Approve'}
              </Btn>
              <Btn onClick={() => act('returned')} disabled={busy} style={{ flex: 1 }}>Return</Btn>
              <Btn variant="danger" onClick={() => act('rejected')} disabled={busy} style={{ flex: 1 }}>Reject</Btn>
            </div>
            {drawer.amount > 50000 && (
              <div className="text-[9.5px] text-center" style={{ color: 'var(--app-text-faint)' }}>
                Above ₹5 Cr — a DSC / eSign signature is required and its hash is written to the audit chain
              </div>
            )}
          </div>
        )}>
        {drawer && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone={drawer.status === 'approved' ? 'normal' : drawer.status === 'rejected' ? 'critical' : 'warning'}>{drawer.status.toUpperCase()}</Chip>
              {drawer.slaBreached && drawer.status === 'pending' && <Chip tone="critical">SLA BREACHED · {drawer.ageingDays} DAYS</Chip>}
              {drawer.amount > 50000 && <Chip tone="warning">DSC REQUIRED</Chip>}
            </div>

            {drawer.amount && (
              <div className="rounded-xl p-3.5 text-center" style={{ background: 'var(--app-surface-soft)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--app-text-faint)' }}>Amount for approval</div>
                <div className="text-[26px] font-bold leading-none" style={{ color: 'var(--app-text)' }}>{inr(drawer.amount, { unit: 'cr' })}</div>
              </div>
            )}

            <Facts items={[
              { label: 'Request', value: drawer.title, full: true },
              { label: 'Project code', value: drawer.projectCode, full: true },
              { label: 'Raised by', value: drawer.raisedBy },
              { label: 'Raised on', value: fmtDate(drawer.raisedAt) },
              { label: 'Ageing', value: `${drawer.ageingDays} days`, tone: drawer.slaBreached ? 'var(--app-danger)' : undefined },
              { label: 'Zone', value: drawer.zone },
            ]} />

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-faint)' }}>
                Approval chain (Delegation of Powers)
              </div>
              <ApprovalTimeline steps={drawer.steps} />
            </div>

            <div className="text-[10px] rounded-lg p-2.5" style={{ background: 'var(--app-info-bg)', color: 'var(--app-text-muted)' }}>
              Chain determined by entity type and amount. Steps are sequential; a “return” sends the request back to the raiser
              with the chain intact. Every action is written to the hash-chained audit log with the signer's identity.
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
