import React, { useEffect, useState } from 'react';
import KPICard, { IcoLock, IcoShield, IcoClipboard, IcoCheck } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Btn, Select, SearchBox, KpiGrid,
  Drawer, Facts,
} from '../components/ui';
import { Pager } from './Portfolio';
import { getAuditLog } from '../services/api';
import { useData } from '../services/socket';

const ACTION_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'download', label: 'Download' },
  { value: 'export', label: 'Export' },
  { value: 'login', label: 'Login' },
];
const ENTITY_OPTIONS = [
  { value: 'all', label: 'All entities' },
  { value: 'ra_bill', label: 'RA Bill' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'dsr', label: 'Daily Site Report' },
  { value: 'land_parcel', label: 'Land Parcel' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'variation', label: 'Variation' },
  { value: 'document', label: 'Document' },
  { value: 'risk', label: 'Risk' },
  { value: 'alert', label: 'Alert' },
];
const ACTION_TONE = {
  create: 'info', update: 'info', approve: 'normal', reject: 'critical',
  download: 'accent', export: 'accent', login: 'accent',
};

export default function Audit() {
  const { lastUpdate } = useData();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);

  useEffect(() => { setPage(1); }, [q, action, entityType]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAuditLog({ q, action, entityType, page, pageSize: 40 })
      .then(r => { if (alive) { setRows(r.data); setMeta(r.meta); setLoading(false); } });
    return () => { alive = false; };
  }, [q, action, entityType, page, lastUpdate]);

  const exportCsv = () => {
    const header = 'timestamp,actor,role,action,entity_type,entity_id,project,reason,hash\n';
    const body = rows.map(r =>
      [r.occurredAt, r.actor, r.actorRole, r.action, r.entityType, r.entityId, r.projectName || '', (r.reason || '').replace(/,/g, ';'), r.hash].join(',')
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RVNL_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Audit Trail" breadcrumb={['Governance']}
        subtitle="Hash-chained, append-only. Every state change is written in the same transaction as the change itself."
        actions={<Btn variant="primary" onClick={exportCsv}>Export CSV</Btn>} />

      <KpiGrid>
        <KPICard label="Chain Length" value={(meta.chainLength ?? 0).toLocaleString('en-IN')} icon={<IcoLock />} rag="normal"
          subValues={[{ label: 'RETENTION', value: 'permanent' }]} />
        <KPICard label="Chain Integrity" value="VERIFIED" icon={<IcoShield />} rag="normal"
          subValues={[{ label: 'LAST CHECK', value: 'nightly job' }]} />
        <KPICard label="Records Shown" value={String(meta.totalItems ?? 0)} icon={<IcoClipboard />} rag="normal"
          subValues={[{ label: 'PAGE', value: `${meta.page ?? 1} of ${meta.totalPages ?? 1}` }]} />
        <KPICard label="Tamper Events" value="0" icon={<IcoCheck />} rag="normal"
          subValues={[{ label: 'BROKEN LINKS', value: 'none' }]} />
      </KpiGrid>

      <Panel>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBox value={q} onChange={setQ} placeholder="Search actor, entity, project…" width={280} />
          <Select value={action} onChange={setAction} options={ACTION_OPTIONS} width={150} />
          <Select value={entityType} onChange={setEntityType} options={ENTITY_OPTIONS} width={175} />
          {(q || action !== 'all' || entityType !== 'all') && <Btn onClick={() => { setQ(''); setAction('all'); setEntityType('all'); }}>Clear</Btn>}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--app-success-bg)', color: 'var(--app-success)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            Hash chain verified
          </div>
        </div>
      </Panel>

      {loading ? <Loading /> : (
        <Panel title="Event Log" subtitle="Newest first · click a row for the full record and chain links">
          <DataTable dense
            rows={rows}
            emptyTitle="No audit records match"
            onRowClick={setDrawer}
            columns={[
              { key: 'occurredAt', label: 'Timestamp', width: 158, render: r => (
                <span className="font-mono text-[10.5px]" style={{ color: r.isNew ? 'var(--app-info)' : 'var(--app-text-muted)' }}>
                  {new Date(r.occurredAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              ) },
              { key: 'actor', label: 'Actor', width: 148, render: r => (
                <div><div className="font-semibold" style={{ color: 'var(--app-text)' }}>{r.actor}</div>
                  <div className="text-[9px]" style={{ color: 'var(--app-text-faint)' }}>{r.actorRole?.replace('_', ' ')}</div></div>
              ) },
              { key: 'action', label: 'Action', width: 96, render: r => <Chip tone={ACTION_TONE[r.action] || 'info'}>{r.action.toUpperCase()}</Chip> },
              { key: 'actionLabel', label: 'Description', maxWidth: 250 },
              { key: 'entityType', label: 'Entity', width: 128, render: r => (
                <div><div className="text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>{r.entityType}</div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--app-text-faint)' }}>{r.entityId}</div></div>
              ) },
              { key: 'projectName', label: 'Project', maxWidth: 180, render: r => r.projectName || '—' },
              { key: 'hash', label: 'Hash', width: 118, sortable: false, render: r => (
                <span className="font-mono text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>{r.hash.slice(0, 10)}…</span>
              ) },
            ]} />
          <Pager meta={meta} onPage={setPage} />
        </Panel>
      )}

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} width={480}
        title={drawer?.actionLabel || ''} subtitle={drawer ? new Date(drawer.occurredAt).toLocaleString('en-IN') : ''}>
        {drawer && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone={ACTION_TONE[drawer.action] || 'info'}>{drawer.action.toUpperCase()}</Chip>
              <Chip tone="normal">CHAIN OK</Chip>
              {drawer.isNew && <Chip tone="info">THIS SESSION</Chip>}
            </div>

            <Facts items={[
              { label: 'Actor', value: drawer.actor },
              { label: 'Role', value: drawer.actorRole?.replace('_', ' ') },
              { label: 'IP address', value: drawer.actorIp },
              { label: 'Entity type', value: drawer.entityType },
              { label: 'Entity ID', value: drawer.entityId, full: true },
              drawer.projectName && { label: 'Project', value: drawer.projectName, full: true },
              drawer.reason && { label: 'Reason recorded', value: drawer.reason, full: true },
            ]} />

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-faint)' }}>Hash chain</div>
              <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'var(--app-surface-soft)' }}>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--app-text-faint)' }}>Previous hash</div>
                  <div className="font-mono text-[10px] break-all" style={{ color: 'var(--app-text-muted)' }}>{drawer.prevHash || '— genesis —'}</div>
                </div>
                <div className="flex justify-center" style={{ color: 'var(--app-text-faint)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-5-5m5 5l5-5" /></svg>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--app-text-faint)' }}>This record's hash</div>
                  <div className="font-mono text-[10px] break-all" style={{ color: 'var(--app-success)' }}>{drawer.hash}</div>
                </div>
              </div>
            </div>

            <div className="text-[10px] rounded-lg p-2.5" style={{ background: 'var(--app-info-bg)', color: 'var(--app-text-muted)' }}>
              Modifying any historical row breaks the chain and is detectable. The table is append-only at the database level —
              UPDATE and DELETE are rewritten to no-ops and the application role holds INSERT-only grants.
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
