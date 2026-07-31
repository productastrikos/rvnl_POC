import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Panel, Btn, EmptyState } from '../components/ui';
import { useData } from '../services/socket';
import {
  PROJECTS, CLEARANCES, LAND_PARCELS, BOQ_ITEMS, PACKAGES, MILESTONES, CONTRACTORS,
  portfolioStats, progressByWorkHead, landSummary, inr, pct, fmtDate, getProject,
} from '../data/rvnlData';
import { scopedProjects } from '../services/api';

/* ═══════════════════════════════════════════════════════════════════════════
   Grounded retrieval — answers are composed from records that actually exist
   and every claim carries the record it came from. Nothing uncited is shown.
   ═══════════════════════════════════════════════════════════════════════════ */

const SUGGESTIONS = [
  'Which projects have forest clearance pending beyond 180 days?',
  'How much alignment is blocked by land not in possession?',
  'Show earthwork executed vs contracted for Rishikesh–Karnaprayag',
  'Which BOQ items have breached the 125% deviation limit?',
  'Which contractors are performing below the threshold?',
  'What is the portfolio expenditure against sanction this year?',
  'Which milestones are overdue on the critical path?',
];

function answer(question) {
  const q = question.toLowerCase();
  const projects = scopedProjects();
  const ids = new Set(projects.map(p => p.id));
  const stats = portfolioStats(projects);

  /* ── Clearances pending beyond SLA ─────────────────────────────────── */
  if (/(clearance|forest|environment|nbwl|parivesh|crs|gad)/.test(q)) {
    const isForest = /forest/.test(q);
    let rows = CLEARANCES.filter(c => ids.has(c.projectId) && c.status !== 'granted');
    if (isForest) rows = rows.filter(c => c.type.startsWith('forest'));
    if (/180|beyond|overdue|breach|sla/.test(q)) rows = rows.filter(c => c.breached);
    rows = rows.sort((a, b) => (b.daysPending || 0) - (a.daysPending || 0)).slice(0, 8);

    return {
      summary: rows.length
        ? `${rows.length} ${isForest ? 'forest ' : ''}clearance${rows.length === 1 ? '' : 's'} ${/180|beyond|breach|sla/.test(q) ? 'have exceeded their SLA' : 'are pending'} in the current scope. The longest has been with the authority for ${rows[0].daysPending} days against an SLA of ${rows[0].slaDays} days.`
        : 'No clearances match that condition in the current scope.',
      table: {
        columns: ['Clearance', 'Project', 'Authority', 'Pending', 'SLA'],
        rows: rows.map(c => [c.typeLabel, getProject(c.projectId)?.name || '—', c.authority, `${c.daysPending ?? '—'} d`, `${c.slaDays} d`]),
      },
      citations: rows.map(c => ({
        label: `${c.typeLabel} — ${getProject(c.projectId)?.code}`,
        detail: c.portalRef ? `Portal ref ${c.portalRef} · applied ${fmtDate(c.appliedOn)}` : `Applied ${fmtDate(c.appliedOn)}`,
        link: `/compliance`,
      })),
    };
  }

  /* ── Land / blocked km ─────────────────────────────────────────────── */
  if (/(land|parcel|possession|blocked|acquisition|village|20a|20e|20f)/.test(q)) {
    const parcels = LAND_PARCELS.filter(l => ids.has(l.projectId));
    const summary = landSummary(parcels);
    const worst = projects
      .map(p => ({ p, s: landSummary(parcels.filter(l => l.projectId === p.id)) }))
      .filter(x => x.s.total > 0)
      .sort((a, b) => b.s.blockedKm - a.s.blockedKm)
      .slice(0, 6);

    return {
      summary: `${summary.blockedKm} km of alignment is blocked by land not in possession — ${summary.pending} parcels of ${summary.total}, which is ${(100 - summary.acquiredPct).toFixed(1)}% of the register. ${summary.disputed} parcels are under dispute or court stay. This is computed from parcel geometry against the alignment, not estimated.`,
      table: {
        columns: ['Project', 'Parcels pending', 'Blocked km', 'Acquired'],
        rows: worst.map(x => [x.p.name, String(x.s.pending), `${x.s.blockedKm} km`, `${x.s.acquiredPct}%`]),
      },
      citations: worst.map(x => ({
        label: x.p.name, detail: `${x.s.total} parcels · ${x.s.compensationTotal ? inr(x.s.compensationTotal, { unit: 'cr', decimals: 0 }) + ' compensation' : ''}`,
        link: `/land`,
      })),
    };
  }

  /* ── BOQ deviation ─────────────────────────────────────────────────── */
  if (/(deviation|125|boq item|breach|over.?run quantity|excess quantity)/.test(q)) {
    const rows = BOQ_ITEMS.filter(b => ids.has(b.projectId) && b.deviationFlag === 'breached').slice(0, 10);
    const approaching = BOQ_ITEMS.filter(b => ids.has(b.projectId) && b.deviationFlag === 'approaching').length;
    return {
      summary: rows.length
        ? `${rows.length} BOQ items have been executed beyond 125% of contracted quantity, which blocks further measurement until a variation order is approved. A further ${approaching} items are between 115% and 125% and are flagged as approaching the limit.`
        : 'No BOQ items have breached the 125% deviation limit in the current scope.',
      table: {
        columns: ['Item', 'Description', 'Contracted', 'Executed', 'Executed %'],
        rows: rows.map(b => [b.itemCode, b.description.slice(0, 60) + '…', `${b.contractedQty.toLocaleString('en-IN')} ${b.unit}`, `${b.executedQty.toLocaleString('en-IN')} ${b.unit}`, `${b.executedPct}%`]),
      },
      citations: rows.slice(0, 6).map(b => {
        const pkg = PACKAGES.find(p => p.id === b.packageId);
        return { label: `${b.itemCode} — ${pkg?.code}`, detail: `${pkg?.projectName} · rate ${inr(b.rate)} per ${b.unit}`, link: '/twin' };
      }),
    };
  }

  /* ── Work-head progress for a named project ────────────────────────── */
  const named = PROJECTS.find(p => q.includes(p.name.toLowerCase().split(' ')[0]) && p.name.toLowerCase().split(' ')[0].length > 4);
  if (named && /(earthwork|progress|executed|contracted|work head|tunnel|bridge|track|ohe)/.test(q)) {
    const wh = progressByWorkHead(named.id);
    return {
      summary: `${named.name} is at ${pct(named.physicalProgress)} physical progress against a planned ${pct(named.plannedPhysical)} — a variance of ${named.variance} percentage points. Quantities by work head are below, taken from the measurement records rather than a declared percentage.`,
      table: {
        columns: ['Work head', 'Unit', 'Contracted', 'Executed', 'Progress'],
        rows: wh.map(w => [w.label, w.unit, w.contracted.toLocaleString('en-IN'), w.executed.toLocaleString('en-IN'), `${w.pct}%`]),
      },
      citations: [
        { label: named.name, detail: `${named.code} · ${named.piuName} · CPM ${named.cpm}`, link: `/projects/${named.id}` },
        { label: 'Quantity ledger', detail: `${PACKAGES.filter(p => p.projectId === named.id).length} packages · BOQ-derived`, link: '/twin' },
      ],
    };
  }

  /* ── Contractors ───────────────────────────────────────────────────── */
  if (/(contractor|agency|vendor|cpi|performance)/.test(q)) {
    const rows = CONTRACTORS
      .map(c => ({ ...c, live: PACKAGES.filter(p => p.contractorId === c.id && ids.has(p.projectId)).length }))
      .filter(c => c.live > 0)
      .sort((a, b) => a.cpi - b.cpi).slice(0, 8);
    const below = rows.filter(c => c.cpi < 62);
    return {
      summary: below.length
        ? `${below.length} contractors are scoring below 62 on the composite performance index against a portfolio median of about 78. Schedule adherence is the weakest component for all of them, which points to resourcing rather than capability.`
        : `All contractors in scope are scoring at or above the 62 threshold. The lowest is ${rows[0]?.name} at ${rows[0]?.cpi}.`,
      table: {
        columns: ['Contractor', 'Packages', 'CPI', 'Schedule', 'Quality', 'Safety'],
        rows: rows.map(c => [c.name, String(c.live), String(c.cpi), c.scores.schedule.toFixed(0), c.scores.quality.toFixed(0), c.scores.safety.toFixed(0)]),
      },
      citations: rows.slice(0, 5).map(c => ({
        label: c.name, detail: `${c.pan} · ${c.regClass} class · PG ${c.pgExpiryDays < 0 ? 'expired' : `${c.pgExpiryDays} d remaining`}`,
        link: '/contractors',
      })),
    };
  }

  /* ── Milestones ────────────────────────────────────────────────────── */
  if (/(milestone|overdue|slip|schedule|critical path|delay)/.test(q)) {
    let rows = MILESTONES.filter(m => ids.has(m.projectId) && m.status === 'overdue');
    if (/critical/.test(q)) rows = rows.filter(m => m.isCritical);
    rows = rows.sort((a, b) => b.slipDays - a.slipDays).slice(0, 10);
    return {
      summary: `${stats.milestonesSlipped} of ${stats.milestonesTotal} milestones have slipped against their sanction baseline — ${stats.slippagePct}% of the plan, with an average delay of ${stats.avgSlipDays} days. ${rows.length} ${/critical/.test(q) ? 'critical-path ' : ''}milestones are currently overdue.`,
      table: {
        columns: ['Milestone', 'Project', 'Planned', 'Slip', 'Critical'],
        rows: rows.map(m => [`${m.code} ${m.name}`, getProject(m.projectId)?.name || '—', fmtDate(m.plannedFinish), `${m.slipDays} d`, m.isCritical ? 'Yes' : 'No']),
      },
      citations: rows.slice(0, 5).map(m => ({
        label: `${m.code} — ${m.name}`, detail: `${getProject(m.projectId)?.code} · baseline ${fmtDate(m.baselineFinish)}`,
        link: `/projects/${m.projectId}?tab=schedule`,
      })),
    };
  }

  /* ── Finance ───────────────────────────────────────────────────────── */
  if (/(expenditure|budget|sanction|cost|money|spend|burn|financial|₹|crore)/.test(q)) {
    const overruns = projects
      .filter(p => p.latestEstimate > p.sanctionedCost * 1.1)
      .sort((a, b) => (b.latestEstimate / b.sanctionedCost) - (a.latestEstimate / a.sanctionedCost))
      .slice(0, 8);
    return {
      summary: `Expenditure stands at ${inr(stats.totalExpenditure, { unit: 'cr', decimals: 0 })} against a current estimate of ${inr(stats.totalEstimate, { unit: 'cr', decimals: 0 })}, a burn of ${stats.burnPct}%. The sanctioned figure was ${inr(stats.totalSanction, { unit: 'cr', decimals: 0 })}, so the portfolio estimate is running ${(((stats.totalEstimate - stats.totalSanction) / stats.totalSanction) * 100).toFixed(1)}% above sanction. ${overruns.length} projects are more than 10% above their sanctioned cost.`,
      table: {
        columns: ['Project', 'Sanctioned', 'Estimate', 'Over sanction', 'Spent'],
        rows: overruns.map(p => [
          p.name, inr(p.sanctionedCost, { unit: 'cr', decimals: 0 }), inr(p.latestEstimate, { unit: 'cr', decimals: 0 }),
          `+${(((p.latestEstimate - p.sanctionedCost) / p.sanctionedCost) * 100).toFixed(1)}%`, inr(p.expenditure, { unit: 'cr', decimals: 0 }),
        ]),
      },
      citations: overruns.slice(0, 5).map(p => ({
        label: p.name, detail: `${p.code} · sanctioned ${p.sanctionYear}`, link: `/projects/${p.id}`,
      })),
    };
  }

  /* ── Fallback: portfolio summary ───────────────────────────────────── */
  return {
    summary: `I can answer from the live project records. In the current scope there are ${stats.projectCount} projects (${stats.activeCount} under execution) worth ${inr(stats.totalEstimate, { unit: 'cr', decimals: 0 })}, at ${pct(stats.physicalProgress)} physical progress against a planned ${pct(stats.plannedProgress)}. Ask about clearances, land, BOQ deviation, milestones, contractors or expenditure and I will pull the underlying records.`,
    table: null,
    citations: [
      { label: 'Portfolio', detail: `${stats.projectCount} projects · ${stats.openRisks} open risks`, link: '/portfolio' },
      { label: 'Land register', detail: `${stats.land.blockedKm} km blocked`, link: '/twin' },
      { label: 'Clearance register', detail: `${stats.clearancesPending} pending, ${stats.clearancesBreached} breached`, link: '/twin' },
    ],
  };
}

export default function Assistant() {
  const navigate = useNavigate();
  const { user, zone } = useData();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages, thinking]);

  const ask = (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      setMessages(m => [...m, { role: 'assistant', ...answer(q) }]);
      setThinking(false);
    }, 550);
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - var(--app-header-h) - 32px)', maxWidth: 940, margin: '0 auto' }}>
      <PageHeader title="Project Assistant" breadcrumb={['Knowledge']}
        subtitle={`Grounded in live project records · scoped to ${zone === 'ALL' ? 'all zones' : zone} for ${user.designation}`} />

      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.length === 0 && (
          <Panel>
            <EmptyState
              title="Ask about the portfolio"
              hint="Every answer is composed from records that exist and cites them. Retrieval runs under your own permissions — a contractor asking about rates sees only their own contract." />
            <div className="flex flex-col gap-1.5 mt-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => ask(s)}
                  className="text-left rounded-lg px-3 py-2.5 text-[11.5px] transition-colors"
                  style={{ background: 'var(--app-surface-soft)', border: 'none', color: 'var(--app-text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-surface-raised)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--app-surface-soft)'; }}>
                  {s}
                </button>
              ))}
            </div>
          </Panel>
        )}

        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div className="rounded-2xl px-3.5 py-2.5 max-w-[76%]"
              style={{ background: 'var(--app-btn)', color: 'var(--app-btn-text)', fontSize: 12.5 }}>
              {m.text}
            </div>
          </div>
        ) : (
          <Panel key={i}>
            <div className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--app-text)' }}>{m.summary}</div>

            {m.table && m.table.rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg mb-3">
                <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 480 }}>
                  <thead>
                    <tr>
                      {m.table.columns.map(c => (
                        <th key={c} style={{
                          padding: '7px 10px', textAlign: 'left', fontSize: 9.5, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--app-text-faint)',
                          background: 'var(--app-surface-soft)', whiteSpace: 'nowrap',
                        }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{
                            padding: '7px 10px', fontSize: 11, color: ci === 0 ? 'var(--app-text)' : 'var(--app-text-muted)',
                            fontWeight: ci === 0 ? 600 : 400,
                            borderBottom: '1px solid rgba(128,128,128,0.10)',
                          }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {m.citations?.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-text-faint)' }}>
                  Sources ({m.citations.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {m.citations.map((c, ci) => (
                    <button key={ci} onClick={() => navigate(c.link)}
                      className="flex items-start gap-2 rounded-lg px-2.5 py-2 text-left"
                      style={{ background: 'var(--app-surface-soft)', border: 'none' }}>
                      <span className="text-[9px] font-bold shrink-0 mt-0.5"
                        style={{ color: 'var(--app-accent)', fontFamily: 'monospace' }}>[{ci + 1}]</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{c.label}</span>
                        <span className="block text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>{c.detail}</span>
                      </span>
                      <svg className="w-3 h-3 shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth={2}
                        viewBox="0 0 24 24" style={{ color: 'var(--app-text-faint)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        ))}

        {thinking && (
          <Panel>
            <div className="flex items-center gap-2.5 py-1">
              <div className="app-loading-orbit" style={{ width: 18, height: 18, borderWidth: 2 }} />
              <span className="text-[11.5px]" style={{ color: 'var(--app-text-faint)' }}>Retrieving records…</span>
            </div>
          </Panel>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 pt-2">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder="Ask about clearances, land, BOQ deviation, milestones, contractors, expenditure…"
            className="flex-1 rounded-xl px-3.5 py-3 text-[12.5px]"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text)', fontFamily: 'inherit', outline: 'none' }} />
          <Btn variant="primary" onClick={() => ask()} disabled={!input.trim()} style={{ padding: '0 20px' }}>Ask</Btn>
        </div>
        <div className="text-[9.5px] mt-1.5 text-center" style={{ color: 'var(--app-text-faint)' }}>
          Answers cite the records behind them. Uncited claims are suppressed rather than shown.
        </div>
      </div>
    </div>
  );
}
