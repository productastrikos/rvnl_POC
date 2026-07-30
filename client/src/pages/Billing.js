import React, { useEffect, useState } from 'react';
import KPICard, { IcoRupee, IcoClipboard, IcoHourglass, IcoCheck } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Btn, Select, SearchBox, KpiGrid,
  Drawer, Facts, ApprovalTimeline } from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { Pager } from './Portfolio';
import { getBills, certifyBill } from '../services/api';
import { useData } from '../services/socket';
import { inr, fmtDate, BILL_STATUS } from '../data/rvnlData';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...Object.entries(BILL_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
];

/* Which action a bill can move to next, and who may do it */
const NEXT_ACTION = {
  submitted:   { to: 'under_check', label: 'Take up for check', variant: 'primary' },
  under_check: { to: 'certified',   label: 'Certify bill',      variant: 'success' },
  certified:   { to: 'passed',      label: 'Pass for payment',  variant: 'success' },
  passed:      { to: 'paid',        label: 'Record payment',    variant: 'success' } };

export default function Billing() {
  const { zone, setZone, lastUpdate, role, user } = useData();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPage(1); }, [q, status, zone]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getBills({ q, status, page, pageSize: 20 })
      .then(r => { if (alive) { setRows(r.data); setMeta(r.meta); setLoading(false); } });
    return () => { alive = false; };
  }, [q, status, page, zone, lastUpdate]);

  const act = async (to) => {
    setBusy(true);
    await certifyBill(drawer.id, to, remarks || 'Verified against approved measurements');
    setBusy(false);
    setDrawer(null);
    setRemarks('');
  };

  const reject = async () => {
    setBusy(true);
    await certifyBill(drawer.id, 'rejected', remarks || 'Returned — quantity exceeds approved measurement');
    setBusy(false);
    setDrawer(null);
    setRemarks('');
  };

  const t = meta.totals || {};
  /* Separation of duties: the same user may not certify and then pass for payment */
  const canAct = role !== 'CONTRACTOR_PM';

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Contractor Billing" breadcrumb={['Commercial']}
        subtitle="RA bills, deductions and payment status — bills draw on approved measurements only">
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      <KpiGrid>
        <KPICard label="Bills in Scope" value={String(meta.totalItems ?? 0)} icon={<IcoClipboard />} rag="normal"
          subValues={[{ label: 'PENDING', value: String(t.pending ?? 0) }]} />
        <KPICard label="Gross Value" value={inr(t.gross || 0, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoRupee />} rag="normal"
          subValues={[{ label: 'NET PAYABLE', value: inr(t.net || 0, { unit: 'cr', decimals: 0 }) }]} />
        <KPICard label="Total Deductions" value={inr(t.deductions || 0, { unit: 'cr', decimals: 0 }).replace('₹', '').replace(' Cr', '')}
          unit="₹ Cr" icon={<IcoHourglass />} rag="normal"
          subValues={[{ label: 'SD · TDS · CESS', value: 'per GCC' }]} />
        <KPICard label="Pending Certification" value={String(t.pending ?? 0)} icon={<IcoCheck />}
          rag={(t.pending ?? 0) > 12 ? 'critical' : (t.pending ?? 0) > 5 ? 'warning' : 'normal'}
          subValues={[{ label: 'NORM', value: '21 days' }]} />
      </KpiGrid>

      <Panel>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBox value={q} onChange={setQ} placeholder="Search package, project, contractor…" width={280} />
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} width={160} />
          {(q || status !== 'all') && <Btn onClick={() => { setQ(''); setStatus('all'); }}>Clear</Btn>}
          {role === 'CONTRACTOR_PM' && (
            <div className="text-[10.5px] ml-auto px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--app-info-bg)', color: 'var(--app-info)' }}>
              Scoped to {user.designation} — you see only your own contracts
            </div>
          )}
        </div>
      </Panel>

      {loading ? <Loading /> : (
        <Panel title="RA Bills" subtitle="Click a bill to view the deduction breakdown and act on it">
          <DataTable
            rows={rows}
            emptyTitle="No bills match these filters"
            onRowClick={r => { setDrawer(r); setRemarks(''); }}
            columns={[
              { key: 'billNo', label: 'Bill', width: 78, render: r => (
                <div><div className="font-bold" style={{ color: 'var(--app-text)' }}>RA {r.billNo}</div>
                  <div className="text-[9px]" style={{ color: 'var(--app-text-faint)' }}>{r.isFinal ? 'Final' : 'On account'}</div></div>
              ) },
              { key: 'packageCode', label: 'Package', width: 130, render: r => (
                <div><div className="font-mono text-[10.5px]" style={{ color: 'var(--app-text)' }}>{r.packageCode}</div>
                  <div className="text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)', maxWidth: 120 }}>{r.projectName}</div></div>
              ) },
              { key: 'contractorName', label: 'Contractor', maxWidth: 170 },
              { key: 'grossAmount', label: 'Gross', align: 'right', width: 104, render: r => inr(r.grossAmount, { unit: 'cr' }) },
              { key: 'totalDeductions', label: 'Deductions', align: 'right', width: 108, render: r => (
                <span style={{ color: 'var(--app-warning)' }}>−{inr(r.totalDeductions, { unit: 'cr' }).replace('₹', '')}</span>
              ) },
              { key: 'netPayable', label: 'Net payable', align: 'right', width: 116, render: r => (
                <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{inr(r.netPayable, { unit: 'cr' })}</span>
              ) },
              { key: 'submittedAt', label: 'Submitted', width: 106, render: r => fmtDate(r.submittedAt) },
              { key: 'ageingDays', label: 'Ageing', align: 'right', width: 82, render: r => (
                <span style={{ fontWeight: 700, color: r.ageingDays > 21 && ['submitted', 'under_check'].includes(r.status) ? 'var(--app-danger)' : 'var(--app-text-muted)' }}>
                  {r.ageingDays}d
                </span>
              ) },
              { key: 'status', label: 'Status', align: 'right', width: 118, sortable: false, render: r => (
                <Chip tone={BILL_STATUS[r.status]?.chip || 'info'}>{r.statusLabel}</Chip>
              ) },
            ]} />
          <Pager meta={meta} onPage={setPage} />
        </Panel>
      )}

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} width={520}
        title={drawer ? `RA Bill ${drawer.billNo} — ${drawer.packageCode}` : ''}
        subtitle={drawer?.projectName}
        footer={drawer && canAct && NEXT_ACTION[drawer.status] && (
          <div className="space-y-2">
            <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)}
              placeholder="Remarks (recorded in the audit trail)…"
              className="w-full rounded-lg text-[11.5px] p-2"
              style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)', fontFamily: 'inherit', resize: 'vertical' }} />
            <div className="flex gap-2">
              <Btn variant={NEXT_ACTION[drawer.status].variant} disabled={busy}
                onClick={() => act(NEXT_ACTION[drawer.status].to)} style={{ flex: 1 }}>
                {busy ? 'Saving…' : NEXT_ACTION[drawer.status].label}
              </Btn>
              <Btn variant="danger" disabled={busy} onClick={reject} style={{ flex: 1 }}>Return bill</Btn>
            </div>
            <div className="text-[9.5px] text-center" style={{ color: 'var(--app-text-faint)' }}>
              Signed as {user.fullName} · {user.designation}
            </div>
          </div>
        )}>
        {drawer && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone={BILL_STATUS[drawer.status]?.chip || 'info'}>{drawer.statusLabel}</Chip>
              {drawer.ageingDays > 21 && ['submitted', 'under_check'].includes(drawer.status) && <Chip tone="critical">AGEING {drawer.ageingDays} DAYS</Chip>}
              {drawer.pfmsRef && <Chip tone="normal">PFMS {drawer.pfmsRef}</Chip>}
            </div>

            <div className="rounded-xl p-3.5" style={{ background: 'var(--app-surface-soft)' }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>Gross amount</span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--app-text)' }}>{inr(drawer.grossAmount)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>Price variation (PVC)</span>
                <span className="text-[12px] font-semibold" style={{ color: 'var(--app-success)' }}>+{inr(drawer.pvcAmount)}</span>
              </div>
              <div className="mt-3 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--app-text-faint)' }}>Deductions</div>
                <Deduction label="Security deposit (6%)" value={drawer.deductions.securityDeposit} />
                <Deduction label="Income tax TDS (2%)" value={drawer.deductions.incomeTaxTds} />
                <Deduction label="GST TDS (2%)" value={drawer.deductions.gstTds} />
                <Deduction label="Labour cess (1% BOCW)" value={drawer.deductions.labourCess} />
                {drawer.deductions.ld > 0 && <Deduction label="Liquidated damages" value={drawer.deductions.ld} danger />}
              </div>
              <div className="flex justify-between items-center mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
                <span className="text-[12px] font-bold" style={{ color: 'var(--app-text)' }}>Net payable</span>
                <span className="text-[18px] font-bold" style={{ color: 'var(--app-success)' }}>{inr(drawer.netPayable)}</span>
              </div>
            </div>

            <Facts items={[
              { label: 'Contractor', value: drawer.contractorName, full: true },
              { label: 'Period from', value: fmtDate(drawer.periodFrom) },
              { label: 'Period to', value: fmtDate(drawer.periodTo) },
              { label: 'Submitted', value: fmtDate(drawer.submittedAt) },
              { label: 'Ageing', value: `${drawer.ageingDays} days`, tone: drawer.ageingDays > 21 ? 'var(--app-danger)' : undefined },
              drawer.certifiedBy && { label: 'Certified by', value: drawer.certifiedBy, full: true },
              drawer.paidAt && { label: 'Paid on', value: fmtDate(drawer.paidAt) },
              drawer.pfmsRef && { label: 'PFMS reference', value: drawer.pfmsRef },
            ]} />

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-faint)' }}>Approval chain</div>
              <ApprovalTimeline steps={[
                { levelLabel: 'Contractor submission', status: 'approved', actedBy: drawer.contractorName, actedAt: drawer.submittedAt },
                { levelLabel: 'PIU technical check', status: ['under_check', 'certified', 'passed', 'paid'].includes(drawer.status) ? 'approved' : drawer.status === 'rejected' ? 'rejected' : 'pending', actedBy: drawer.certifiedBy, remarks: drawer.actionRemarks },
                { levelLabel: 'Certification (CPM)', status: ['certified', 'passed', 'paid'].includes(drawer.status) ? 'approved' : 'waiting', actedBy: drawer.certifiedBy },
                { levelLabel: 'Finance — pass for payment', status: ['passed', 'paid'].includes(drawer.status) ? 'approved' : 'waiting' },
                { levelLabel: 'PFMS release', status: drawer.status === 'paid' ? 'approved' : 'waiting', actedAt: drawer.paidAt },
              ]} />
            </div>

            <div className="text-[10px] rounded-lg p-2.5" style={{ background: 'var(--app-info-bg)', color: 'var(--app-text-muted)' }}>
              Bill lines are capped at the approved measured quantity for each BOQ item. Rates come from the contract BOQ and cannot be entered on the bill.
              The certifying officer and the payment-releasing officer must be different users.
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Deduction({ label, value, danger }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: danger ? 'var(--app-danger)' : 'var(--app-warning)' }}>
        −{inr(value).replace('₹', '')}
      </span>
    </div>
  );
}
