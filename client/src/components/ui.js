import React, { useState, useMemo } from 'react';
import { chainage, km } from '../data/rvnlData';

/* ═══════════════════════════════════════════════════════════════════════════
   Shared UI kit — built strictly on the template's existing tokens and
   utility classes (.glass-panel, .status-chip-*, .progress-track/fill,
   .page-header-block, .app-control-btn, .app-primary-btn, .app-loading-orbit).
   No new visual language is introduced.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Page header ────────────────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, breadcrumb, actions, children }) {
  return (
    <div className="page-header-block flex-wrap gap-3">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 truncate"
            style={{ color: 'var(--app-text-faint)' }}>
            {breadcrumb.join(' › ')}
          </div>
        )}
        <h1 className="page-title truncate">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

/* ─── Panel (chart / content card) ───────────────────────────────────────── */
export function Panel({ title, subtitle, actions, children, className = '', bodyClass = '', style }) {
  return (
    <div className={`glass-panel rounded-2xl flex flex-col ${className}`} style={style}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5 shrink-0">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-bold leading-tight truncate" style={{ color: 'var(--app-text)' }}>{title}</h3>}
            {subtitle && <p className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={`px-4 pb-4 flex-1 min-h-0 ${bodyClass}`}>{children}</div>
    </div>
  );
}

/* ─── Status chip ────────────────────────────────────────────────────────── */
const RAG_CHIP = { normal: 'success', warning: 'warning', critical: 'danger', info: 'info', accent: 'accent' };

export function Chip({ tone = 'info', children, dot = false, title }) {
  const cls = RAG_CHIP[tone] || tone;
  return (
    <span className={`status-chip status-chip-${cls}`} title={title}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
      {children}
    </span>
  );
}

export function RagChip({ rag, labels }) {
  const map = labels || { normal: 'ON TRACK', warning: 'AT RISK', critical: 'CRITICAL' };
  return <Chip tone={rag} dot>{map[rag] || String(rag).toUpperCase()}</Chip>;
}

/* ─── Progress bar ───────────────────────────────────────────────────────── */
export function Progress({ value, planned, rag = 'normal', height = 6, showLabel = false }) {
  const color = { normal: 'var(--app-success)', warning: 'var(--app-warning)', critical: 'var(--app-danger)' }[rag] || 'var(--app-info)';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="progress-track flex-1 relative" style={{ height }}>
        <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value || 0))}%`, background: color }} />
        {planned != null && (
          <span title={`Planned ${planned.toFixed(1)}%`}
            style={{
              position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, planned)}%`,
              width: 2, background: 'var(--app-text-faint)', opacity: 0.85, borderRadius: 1,
            }} />
        )}
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: 'var(--app-text-muted)', minWidth: 42, textAlign: 'right' }}>
          {(value || 0).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

/* ─── Loading / empty / error ────────────────────────────────────────────── */
export function Loading({ label = 'Loading…', className = '' }) {
  return (
    <div className={`app-loading py-10 ${className}`}>
      <div className="app-loading-orbit" />
      <div className="app-loading-text">{label}</div>
    </div>
  );
}

export function EmptyState({ title, hint, action, icon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-2">
      {icon && <div style={{ color: 'var(--app-text-faint)', opacity: 0.7 }}>{icon}</div>}
      <div className="text-[13px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>{title}</div>
      {hint && <div className="text-[11px] max-w-sm" style={{ color: 'var(--app-text-faint)' }}>{hint}</div>}
      {action}
    </div>
  );
}

/* ─── Data table — sortable, sticky header, RAG-aware ────────────────────── */
export function DataTable({
  columns, rows, keyField = 'id', onRowClick, emptyTitle = 'No records',
  emptyHint, maxHeight, dense = false, initialSort,
}) {
  const [sort, setSort] = useState(initialSort || null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    const acc = col?.sortValue || (r => r[sort.key]);
    return [...rows].sort((a, b) => {
      const x = acc(a), y = acc(b);
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'desc' ? -c : c;
    });
  }, [rows, sort, columns]);

  const toggle = (key) => setSort(s =>
    !s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null);

  if (!rows.length) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  const pad = dense ? '6px 10px' : '9px 12px';

  return (
    <div className="overflow-auto rounded-lg" style={{ maxHeight }}>
      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 520 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key}
                onClick={c.sortable === false ? undefined : () => toggle(c.key)}
                style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: 'var(--app-surface)',
                  padding: pad, textAlign: c.align || 'left',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--app-text-faint)', whiteSpace: 'nowrap',
                  cursor: c.sortable === false ? 'default' : 'pointer',
                  borderBottom: '1px solid var(--app-border-soft, rgba(255,255,255,0.08))',
                  width: c.width,
                }}>
                {c.label}
                {sort?.key === c.key && <span style={{ marginLeft: 4, fontSize: 8 }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r[keyField] ?? i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className="transition-colors"
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-surface-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              {columns.map(c => (
                <td key={c.key} style={{
                  padding: pad, textAlign: c.align || 'left',
                  fontSize: dense ? 11 : 11.5, color: 'var(--app-text-muted)',
                  borderBottom: '1px solid rgba(128,128,128,0.10)',
                  whiteSpace: c.wrap ? 'normal' : 'nowrap',
                  maxWidth: c.maxWidth,
                  overflow: c.wrap ? 'visible' : 'hidden', textOverflow: 'ellipsis',
                }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Chainage strip — the corridor at a glance ──────────────────────────── */
export function ChainageStrip({ segments, lengthM, onSelect, selectedId, structures = [] }) {
  const [hover, setHover] = useState(null);
  const color = { normal: 'var(--app-success)', warning: 'var(--app-warning)', critical: 'var(--app-danger)' };

  if (!segments?.length) return <EmptyState title="No sections defined" hint="Packages have not been created for this project yet." />;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold" style={{ color: 'var(--app-text-faint)' }}>KM 0</span>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--app-text-faint)' }}>KM {km(lengthM, 1)}</span>
      </div>

      <div className="relative w-full flex rounded-lg overflow-hidden" style={{ height: 34, background: 'var(--app-surface-soft)' }}>
        {segments.map(s => (
          <button key={s.id}
            onClick={() => onSelect && onSelect(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(null)}
            title={`${s.code} · ${s.progress.toFixed(1)}% · ${chainage(s.fromChainageM)} → ${chainage(s.toChainageM)}`}
            style={{
              width: `${s.widthPct}%`, position: 'relative', border: 'none',
              background: 'transparent', cursor: 'pointer', padding: 0,
              borderRight: '2px solid var(--app-surface)',
              outline: selectedId === s.id ? '2px solid #3b7de8' : 'none', outlineOffset: -2,
            }}>
            <span style={{
              position: 'absolute', inset: 0,
              background: color[s.rag] || 'var(--app-info)', opacity: 0.22,
            }} />
            <span style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${s.progress}%`, background: color[s.rag] || 'var(--app-info)', opacity: 0.9,
            }} />
            {s.blocked && (
              <span title="Land not in possession on this stretch" style={{
                position: 'absolute', top: 3, right: 4, width: 6, height: 6,
                borderRadius: '50%', background: 'var(--app-danger)',
                boxShadow: '0 0 0 2px var(--app-surface)',
              }} />
            )}
          </button>
        ))}
        {structures.slice(0, 40).map(st => (
          <span key={st.id} title={`${st.typeLabel} ${st.refCode} · ${chainage(st.chainageM)} · ${st.progressPct}%`}
            style={{
              position: 'absolute', top: -3, left: `${(st.chainageM / lengthM) * 100}%`,
              width: 1.5, height: 8, background: 'var(--app-text-faint)', opacity: 0.85,
            }} />
        ))}
      </div>

      <div className="mt-2 min-h-[30px]">
        {hover ? (
          <div className="flex items-center gap-3 flex-wrap text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
            <span className="font-bold" style={{ color: 'var(--app-text)' }}>{hover.code}</span>
            <span>{chainage(hover.fromChainageM)} → {chainage(hover.toChainageM)}</span>
            <span>{hover.progress.toFixed(1)}% complete</span>
            {hover.contractorName && <span className="truncate">{hover.contractorName}</span>}
            {hover.blocked && <Chip tone="critical">LAND BLOCKED</Chip>}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
            <LegendDot color="var(--app-success)" label="On track" />
            <LegendDot color="var(--app-warning)" label="At risk" />
            <LegendDot color="var(--app-danger)" label="Critical" />
            <span>· tick marks = structures · red dot = land blocked</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

/* ─── Approval timeline (vertical stepper) ───────────────────────────────── */
export function ApprovalTimeline({ steps }) {
  const tone = { approved: 'var(--app-success)', pending: 'var(--app-warning)', rejected: 'var(--app-danger)', returned: 'var(--app-danger)', waiting: 'var(--app-text-faint)' };
  return (
    <div className="flex flex-col">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center" style={{ width: 16 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', marginTop: 4,
              background: s.status === 'waiting' ? 'transparent' : tone[s.status],
              border: `2px solid ${tone[s.status]}`, flexShrink: 0,
            }} />
            {i < steps.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 22, background: 'var(--app-border-soft, rgba(128,128,128,0.25))' }} />}
          </div>
          <div className="pb-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11.5px] font-bold" style={{ color: 'var(--app-text)' }}>{s.levelLabel}</span>
              <Chip tone={s.status === 'approved' ? 'normal' : s.status === 'pending' ? 'warning' : s.status === 'waiting' ? 'info' : 'critical'}>
                {s.status.toUpperCase()}
              </Chip>
            </div>
            {s.actedBy && <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{s.actedBy} · {s.actedAt ? new Date(s.actedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</div>}
            {s.remarks && <div className="text-[10.5px] mt-0.5 italic" style={{ color: 'var(--app-text-muted)' }}>“{s.remarks}”</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Filter bar pieces ──────────────────────────────────────────────────── */
export function Select({ value, onChange, options, label, width = 150 }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      {label && <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>{label}</span>}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="app-control-btn text-[11.5px] font-medium"
        style={{ padding: '5px 8px', width, fontFamily: 'inherit', color: 'var(--app-text)' }}>
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: 'var(--app-panel)', color: 'var(--app-text)' }}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…', width = 220 }) {
  return (
    <div className="header-search" style={{ width, padding: '5px 10px' }}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-faint)', padding: 0, lineHeight: 1 }}>✕</button>
      )}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="app-timeframe-control" role="tablist" style={{ flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button key={t.value} role="tab" aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`app-timeframe-btn ${value === t.value ? 'is-active' : ''}`}
          style={{ padding: '5px 12px', fontSize: 11 }}>
          {t.label}{t.count != null && <span style={{ opacity: 0.7, marginLeft: 5 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ─── Slide-over drawer for detail views ─────────────────────────────────── */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 460 }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} className="app-modal-backdrop"
        style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div className="animate-slide-in-right flex flex-col"
        style={{
          position: 'fixed', top: 'var(--app-header-h, 62px)', right: 0, bottom: 0,
          width: `min(${width}px, 100vw)`, zIndex: 950,
          background: 'var(--app-panel)', boxShadow: 'var(--app-shadow-lg)',
          borderLeft: '1px solid var(--app-panel-border)',
        }}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(128,128,128,0.18)' }}>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-bold leading-tight" style={{ color: 'var(--app-text)' }}>{title}</h3>
            {subtitle && <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="icon-btn shrink-0" aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>{footer}</div>}
      </div>
    </>
  );
}

/* ─── Definition list used across detail drawers ─────────────────────────── */
export function Facts({ items, columns = 2 }) {
  return (
    <div className="grid gap-x-4 gap-y-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {items.filter(Boolean).map((it, i) => (
        <div key={i} style={{ gridColumn: it.full ? '1 / -1' : undefined }}>
          <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--app-text-faint)' }}>{it.label}</div>
          <div className="text-[12px] font-semibold" style={{ color: it.tone || 'var(--app-text)', wordBreak: 'break-word' }}>{it.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Small stat used inside panels (not a KPI card) ─────────────────────── */
export function MiniStat({ label, value, tone, sub }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>{label}</span>
      <span className="text-[17px] font-bold leading-none tabular-nums" style={{ color: tone || 'var(--app-text)' }}>{value}</span>
      {sub && <span className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>{sub}</span>}
    </div>
  );
}

/* ─── Button helpers ─────────────────────────────────────────────────────── */
export function Btn({ children, onClick, variant = 'control', disabled, className = '', style, title, type = 'button' }) {
  const base = { padding: '6px 12px', fontSize: 11.5, fontWeight: 600, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style };
  if (variant === 'primary') {
    return <button type={type} title={title} disabled={disabled} onClick={onClick} className={`app-primary-btn ${className}`} style={base}>{children}</button>;
  }
  if (variant === 'danger') {
    return <button type={type} title={title} disabled={disabled} onClick={onClick} className={className}
      style={{ ...base, background: 'var(--app-danger-bg)', color: 'var(--app-danger)', border: '1px solid var(--app-danger-border)' }}>{children}</button>;
  }
  if (variant === 'success') {
    return <button type={type} title={title} disabled={disabled} onClick={onClick} className={className}
      style={{ ...base, background: 'var(--app-success-bg)', color: 'var(--app-success)', border: '1px solid var(--app-success-border)' }}>{children}</button>;
  }
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={`app-control-btn ${className}`} style={base}>{children}</button>;
}

/* ─── Section grid helper ────────────────────────────────────────────────── */
export const KpiGrid = ({ children, cols = 4 }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3`}>{children}</div>
);
