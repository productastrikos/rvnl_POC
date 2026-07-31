import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KPICard, { IcoFolder, IcoSearchDoc, IcoClipboard, IcoLayers } from '../components/KPICard';
import {
  PageHeader, Panel, Chip, Loading, DataTable, Btn, Select, SearchBox, KpiGrid,
  Drawer, Facts,
} from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { Pager } from './Portfolio';
import { getDocuments } from '../services/api';
import { useData } from '../services/socket';
import { fmtDate } from '../data/rvnlData';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All document types' },
  { value: 'dpr', label: 'Detailed Project Report' },
  { value: 'gad', label: 'General Arrangement Drawing' },
  { value: 'drawing', label: 'Construction Drawing' },
  { value: 'contract', label: 'Contract Agreement' },
  { value: 'test_cert', label: 'Test Certificate' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'clearance_doc', label: 'Clearance Document' },
  { value: 'bill', label: 'Bill Document' },
];

const TYPE_TONE = {
  dpr: 'accent', gad: 'info', drawing: 'info', contract: 'warning',
  test_cert: 'normal', correspondence: 'info', clearance_doc: 'warning', bill: 'accent',
};

const fmtSize = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

export default function Documents() {
  const navigate = useNavigate();
  const { zone, setZone, lastUpdate } = useData();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);

  useEffect(() => { setPage(1); }, [q, type, zone]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDocuments({ q, type, page, pageSize: 25 })
      .then(r => { if (alive) { setRows(r.data); setMeta(r.meta); setLoading(false); } });
    return () => { alive = false; };
  }, [q, type, page, zone, lastUpdate]);

  const byType = meta.byType || {};

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Document Vault" breadcrumb={['Knowledge']}
        subtitle="Versioned DPRs, drawings, contracts and certificates — nothing is ever hard-deleted">
        <div className="mt-2.5"><ZoneFilterBar value={zone} onChange={setZone} /></div>
      </PageHeader>

      <KpiGrid>
        <KPICard label="Documents" value={(meta.totalItems ?? 0).toLocaleString('en-IN')} icon={<IcoFolder />} rag="normal"
          subValues={[{ label: 'STORAGE', value: fmtSize(meta.totalSize || 0) }]} />
        <KPICard label="DPRs & Estimates" value={String(byType.dpr || 0)} icon={<IcoClipboard />} rag="normal"
          subValues={[{ label: 'CONTRACTS', value: String(byType.contract || 0) }]} />
        <KPICard label="Drawings" value={String((byType.gad || 0) + (byType.drawing || 0))} icon={<IcoLayers />} rag="normal"
          subValues={[{ label: 'GAD', value: String(byType.gad || 0) }, { label: 'CONSTRUCTION', value: String(byType.drawing || 0) }]} />
        <KPICard label="Test Certificates" value={String(byType.test_cert || 0)} icon={<IcoSearchDoc />} rag="normal"
          subValues={[{ label: 'CLEARANCE DOCS', value: String(byType.clearance_doc || 0) }]} />
      </KpiGrid>

      <Panel>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBox value={q} onChange={setQ} placeholder="Search title, project, uploader… (full text incl. OCR)" width={320} />
          <Select value={type} onChange={setType} options={TYPE_OPTIONS} width={215} />
          {(q || type !== 'all') && <Btn onClick={() => { setQ(''); setType('all'); }}>Clear</Btn>}
        </div>
      </Panel>

      {loading ? <Loading /> : (
        <Panel title="Vault" subtitle="Click a document for version history and checksum">
          <DataTable
            rows={rows}
            emptyTitle="No documents match"
            onRowClick={setDrawer}
            columns={[
              { key: 'title', label: 'Document', maxWidth: 340, render: r => (
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--app-text)' }}>{r.title}</div>
                  <div className="text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>{r.projectName}</div>
                </div>
              ) },
              { key: 'typeLabel', label: 'Type', width: 168, render: r => <Chip tone={TYPE_TONE[r.type] || 'info'}>{r.typeLabel}</Chip> },
              { key: 'revisionLabel', label: 'Revision', width: 92, render: r => (
                <span className="font-mono" style={{ color: r.isSuperseded ? 'var(--app-text-faint)' : 'var(--app-text)' }}>{r.revisionLabel}</span>
              ) },
              { key: 'sizeBytes', label: 'Size', align: 'right', width: 84, render: r => fmtSize(r.sizeBytes) },
              { key: 'uploadedBy', label: 'Uploaded by', maxWidth: 140 },
              { key: 'uploadedAt', label: 'Uploaded', width: 108, render: r => fmtDate(r.uploadedAt) },
              { key: 'isSuperseded', label: 'Status', align: 'right', width: 116, sortable: false, render: r =>
                r.isSuperseded ? <Chip tone="warning">SUPERSEDED</Chip> : <Chip tone="normal">CURRENT</Chip> },
            ]} />
          <Pager meta={meta} onPage={setPage} />
        </Panel>
      )}

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} width={480}
        title={drawer?.title || ''} subtitle={drawer?.typeLabel}
        footer={drawer && (
          <div className="flex gap-2">
            <Btn variant="primary" style={{ flex: 1 }}
              onClick={() => window.alert('In production this issues a short-lived signed URL from object storage and writes a download entry to the audit log.')}>
              Download
            </Btn>
            <Btn style={{ flex: 1 }} onClick={() => { setDrawer(null); navigate(`/projects/${drawer.projectId}`); }}>Open project</Btn>
          </div>
        )}>
        {drawer && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone={TYPE_TONE[drawer.type] || 'info'}>{drawer.typeLabel}</Chip>
              <Chip tone={drawer.isSuperseded ? 'warning' : 'normal'}>{drawer.isSuperseded ? 'SUPERSEDED' : 'CURRENT'}</Chip>
              {drawer.tags?.map(t => <Chip key={t} tone="accent">{t.toUpperCase()}</Chip>)}
            </div>

            <Facts items={[
              { label: 'Project', value: drawer.projectName, full: true },
              { label: 'Current revision', value: drawer.revisionLabel },
              { label: 'Version', value: `v${drawer.currentVersion}` },
              { label: 'File size', value: fmtSize(drawer.sizeBytes) },
              { label: 'MIME type', value: drawer.mimeType },
              { label: 'Uploaded by', value: drawer.uploadedBy },
              { label: 'Uploaded on', value: fmtDate(drawer.uploadedAt) },
              { label: 'SHA-256', value: drawer.sha256, full: true },
            ]} />

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--app-text-faint)' }}>Version history</div>
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: drawer.currentVersion }).map((_, i) => {
                  const v = drawer.currentVersion - i;
                  const isCurrent = v === drawer.currentVersion;
                  return (
                    <div key={v} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: 'var(--app-surface-soft)' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isCurrent ? 'var(--app-success)' : 'transparent',
                        border: `2px solid ${isCurrent ? 'var(--app-success)' : 'var(--app-text-faint)'}`,
                      }} />
                      <span className="text-[11px] font-mono flex-1" style={{ color: 'var(--app-text)' }}>
                        Rev {String.fromCharCode(64 + v)} · v{v}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                        {isCurrent ? 'Current' : 'Superseded'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] rounded-lg p-2.5" style={{ background: 'var(--app-info-bg)', color: 'var(--app-text-muted)' }}>
              Superseded revisions are retained and clearly marked. Every version carries a checksum, and downloads of
              sensitive documents are themselves recorded in the audit log.
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
