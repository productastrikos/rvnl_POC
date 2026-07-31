# RVNL Nirman Setu — Platform Blueprint
## Part 1 · Design System Contract, Product Overview, Information Architecture, Dashboards

> **Working name:** *Nirman Setu* (निर्माण सेतु — "construction bridge") — RVNL Integrated Project Command Centre (IPCC).
> **Scope of this part:** §0 Design System Contract · §1 Product Overview · §2 Information Architecture · §3 Dashboard Design
> **Other parts:** [`02-ARCHITECTURE-AND-DATA.md`](02-ARCHITECTURE-AND-DATA.md) (§4–§7) · [`03-WORKFLOWS-AND-PLATFORM.md`](03-WORKFLOWS-AND-PLATFORM.md) (§8–§12)

---

# §0 · DESIGN SYSTEM CONTRACT (READ FIRST)

Everything below is derived from the **existing template**, not invented. The contract states precisely what is **frozen** and what is **open**, so engineering can move fast without drifting the visual language.

## 0.1 Frozen tokens — do not change

Source of truth: [`src/index.css`](../src/index.css) `:root` / `body[data-theme='light']`.

| Token group | Dark (default) | Light | Rule |
|---|---|---|---|
| Panel / card | `--app-panel #0a0a0a`, `--app-surface #202020` | `#ffffff`, `#ffffff` | Every card is `--app-surface`. Never hardcode a hex. |
| Page background | `--app-bg #1c1c1c` | `#f1f5fa` | — |
| Borders | `--app-border transparent` | `rgba(0,0,0,0.12)` | Dark mode is **borderless**; separation comes from surface contrast. Do not add borders in dark. |
| Text | `#e8eef5` / `#afc3d8` / `#8ca0b6` | `#0d0d0d` / `#1f1f1f` / `#4a4a4a` | `--app-text` / `-muted` / `-faint` |
| Action button | `--app-btn #3d3d3d` | `#3b7de8` | `.app-primary-btn` / `.app-btn` only |
| Status | success `#16a34a` · warning `#d97706` · danger `#dc2626` · info `#0ea5e9` | `#15803d` · `#c2410c` · `#b91c1c` · `#0369a1` | **Reserved.** Never reused as a chart series colour. |
| Advisory (AI) | `--app-advisory #8b5cf6`, panel `rgb(130,90,210)` | `#7c3aed` | Purple is reserved for AI advisory surfaces only. |
| Layout | `--app-sidebar-w 244px` (collapsed `60px`), `--app-header-h 62px` | same | — |
| Type | Inter, 14px base, `-webkit-font-smoothing: antialiased` | same | — |
| Radius | cards `16px`, controls `8px`, chips `20px` | same | — |

## 0.2 Frozen components — reuse, never re-implement

| Component | File | Reuse rule |
|---|---|---|
| `KPICard` | [`components/KPICard.js`](../src/components/KPICard.js) | The **only** stat tile. Extend by adding icons, never by editing layout. |
| Icon library (`Ico*`) | same file | All new icons follow §0.4 exactly. |
| `AlertPanel` | [`components/AlertPanel.js`](../src/components/AlertPanel.js) | Right slide-over, `w-80`, grouped critical→warning→info. |
| `AdvisoryPanel` | [`components/AdvisoryPanel.js`](../src/components/AdvisoryPanel.js) | Purple slide-over, `w-96`. Advisory JSON shape is frozen (§9). |
| `ZoneFilterBar` | [`components/ZoneFilterBar.js`](../src/components/ZoneFilterBar.js) | Generalise `ZONES` → Railway Zone / Corridor. Markup unchanged. |
| `ChartTimeframeControl` | [`components/chartUtils.js`](../src/components/chartUtils.js) | Only permitted timeframe control. |
| `Layout` shell | [`components/Layout.js`](../src/components/Layout.js) | Sidebar + topbar + slide-overs. Extend `NAV_SECTIONS` / `SEARCH_INDEX` / `PAGE_TITLES` only. |
| Utility classes | `index.css` | `.glass-panel`, `.status-chip-*`, `.progress-track/fill`, `.page-header-block`, `.page-title`, `.page-subtitle`, `.app-control-btn`, `.icon-btn`, `.app-timeframe-control` |

## 0.3 KPI card anatomy — frozen, memorise it

`KPICard` renders four rows inside a `16px`-radius `--app-surface` tile at `18px 20px 16px` padding:

```
┌──────────────────────────────────────────────┐
│ [32px icon]  LABEL (12px, muted, 600)   ▲2.1%│  ← row 1: icon · label · trend badge
│                                              │
│ 47                          Projects         │  ← row 2: value clamp(2rem,3.5vw,2.8rem) 700
│                                              │
│ AT RISK        DELAYED       ON TRACK        │  ← row 3: subValues (9px caps label / 13px value)
│ 6              11            30              │
│ ────────────────────────────────────────────  │  ← divider 1px
│ ● WARNING                       VIEW DETAILS │  ← row 4: RAG badge · cyan #22d3ee action
└──────────────────────────────────────────────┘
```

**Rules.** Max **3** `subValues` (4 wraps ugly at 1280px). `trend` is percent change vs the previous equivalent period — omit it entirely rather than pass `0`. `rag` is passed explicitly for every RVNL card (never rely on `deriveRag`, which infers from a Tailwind class string). `onClick` is supplied only when a real drill-down page exists.

**Grid.** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3` for a 4-up strip; `sm:grid-cols-3` for a 3-up. Never more than 4 per row.

## 0.4 Icon rules — frozen style, new glyphs allowed

Every icon is line-art on a `24×24` viewBox: `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}` (nav: `1.6`), round caps and joins, rendered `w-[28px] h-[24px]` via the `Ico` wrapper. No fills except tiny `r="0.5"` dots. No emoji in production surfaces.

**New RVNL glyphs** — add to `KPICard.js` beside the existing exports, same `<Ico>` wrapper:

```jsx
export const IcoTrack    = () => <Ico><path d="M7 3L4 21"/><path d="M17 3l3 18"/><line x1="5.5" y1="8" x2="18.5" y2="8"/><line x1="4.9" y1="13" x2="19.1" y2="13"/><line x1="4.3" y1="18" x2="19.7" y2="18"/></Ico>;
export const IcoTrain    = () => <Ico><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 11h14"/><circle cx="9" cy="13.5" r="0.5" fill="currentColor"/><circle cx="15" cy="13.5" r="0.5" fill="currentColor"/><path d="M7.5 16L5 21M16.5 16L19 21"/><path d="M4 21h16"/></Ico>;
export const IcoBridge   = () => <Ico><path d="M2 8h20"/><path d="M3 8v11M21 8v11"/><path d="M3 15a9 7 0 0118 0"/><path d="M8 19v-5M16 19v-5M12 19v-7"/></Ico>;
export const IcoTunnel   = () => <Ico><path d="M3 21V12a9 9 0 0118 0v9"/><path d="M8.5 21v-9a3.5 3.5 0 017 0v9"/><path d="M2 21h20"/></Ico>;
export const IcoLand     = () => <Ico><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/></Ico>;
export const IcoRupee    = () => <Ico><path d="M7 4h10"/><path d="M7 9h10"/><path d="M15 4c0 4-2.7 5-6 5H7l8 11"/></Ico>;
export const IcoHelmet   = () => <Ico><path d="M3.5 17a8.5 8.5 0 0117 0"/><path d="M8 8.5V5a1 1 0 011-1h6a1 1 0 011 1v3.5"/><path d="M2 17h20"/></Ico>;
export const IcoGavel    = () => <Ico><path d="M13 3l8 8"/><path d="M17.5 2.5l4 4"/><path d="M11.5 4.5l4 4"/><path d="M14 10l-8 8"/><path d="M3 21h9"/></Ico>;
export const IcoLayers   = () => <Ico><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></Ico>;
export const IcoSync     = () => <Ico><path d="M21 2v6h-6"/><path d="M3 22v-6h6"/><path d="M3.5 9a9 9 0 0114.9-3.4L21 8"/><path d="M20.5 15a9 9 0 01-14.9 3.4L3 16"/></Ico>;
export const IcoSignature= () => <Ico><path d="M3 17c3-6 5-6 6-3s3 3 5-1 4-2 7 1"/><path d="M3 21h18"/></Ico>;
```

## 0.5 Chart contract — **validated**, and it corrects a real defect

Charts read tokens through [`chartUtils.js`](../src/components/chartUtils.js) (`getChartTokens`, `chartTooltip`, `chartScales`). Keep that plumbing.

**Finding.** The current `CHART_PALETTES.categorical` — `[accent, info, #14b8a6, #f59e0b, #ec4899, #6366f1, #a3e635, #94a3b8]` — **fails accessibility validation in both themes**:

| Check | Light | Dark |
|---|---|---|
| Lightness band | FAIL `#a3e635` (L 0.849) | FAIL 6 of 8 slots |
| Chroma floor | FAIL `#94a3b8` (reads gray) | FAIL `#c8c8c8`, `#94a3b8` |
| CVD separation (adjacent) | **FAIL** `#0369a1↔#3b6dbf` ΔE 5.0 deutan | PASS |
| Normal-vision floor | **FAIL** ΔE 6.0 — indistinguishable to *everyone* | FAIL ΔE 12.8 |

Slots 1 and 2 are two blues sitting next to each other. Any two-series chart built on the default order is unreadable.

**Fix — no new design system.** Every hue below is already present in the template (`--app-btn`, `--app-warning`, the `chartUtils` teal/pink/violet, and the dark line stroke `#5b8de0` at [`index.css:346`](../src/index.css#L346)). This is a **re-ordering and per-theme step selection**, nothing more. It passes all six checks in both themes:

```js
// chartUtils.js — replace the categorical array
categorical: isDark
  ? ['#5b8de0', '#d97706', '#0d9488', '#8b5cf6', '#ec4899']   // dark steps
  : ['#3b7de8', '#d97706', '#0d9488', '#7c3aed', '#ec4899'],  // light steps
```

```
Light  PASS lightness · PASS chroma · PASS CVD (worst adjacent ΔE 12.5 protan) · PASS normal-vision (24.3) · PASS contrast
Dark   PASS lightness · PASS chroma · PASS CVD (worst adjacent ΔE 12.5 protan) · PASS normal-vision (22.6) · PASS contrast
```

**Series rules.**

1. **Five series maximum.** The 6th+ folds into "Other", becomes small multiples, or moves to a table. (All-pairs validation degrades past 5.)
2. **Colour follows the entity, not its rank.** `Zone` NR is always slot 1 wherever it appears; filtering out a zone must not repaint the survivors. Maintain an explicit `entity → slot` map.
3. **One y-axis. Never dual-axis.** Budget (₹ Cr) vs Progress (%) are two charts or one indexed chart — never two scales.
4. **Status colours never become series colours.** `--app-success/warning/danger` mean RAG state only, and always ship with a text label (`.status-chip-*`), never colour alone.
5. **Sequential** (progress %, risk density) = one hue light→dark, from the blue ramp. **Diverging** (schedule variance ±, cost variance ±) = `--app-danger` ← neutral gray → `--app-success`, with a gray midpoint, never a hue.
6. **Legend for ≥2 series, always**; direct-label ≤4 series. Never a number on every point.
7. Thin marks: `borderWidth: 1.6–2`, `pointRadius: 0` on trend lines, 4px rounded bar ends, 2px surface gap between stacked segments.
8. Grid recessive: `--app-chart-grid`; tooltip via `chartTooltip()`.
9. Timeframes: only `12H / 24H / 7D / 30D` exist today. RVNL adds a **project-horizon** set — see §0.6.

## 0.6 One permitted extension: project timeframes

Construction is measured in months and quarters, not hours. Add to `TIMEFRAME_OPTIONS` **without touching the existing presets** (they remain for live/ops telemetry):

```js
// Construction & portfolio horizons — RVNL
progress:  [ { value:'30D', label:'30D', points:30 }, { value:'QTD', label:'QTD', points:13 }, { value:'FYTD', label:'FYTD', points:12 } ],
portfolio: [ { value:'FYTD', label:'FYTD', points:12 }, { value:'3Y', label:'3Y', points:36 }, { value:'LIFE', label:'LIFE', points:60 } ],
```

`FYTD` = Indian financial year, 1 April → 31 March. All fiscal aggregation in the platform uses this, never the calendar year.

## 0.7 Mobile adaptation — same tokens, different chrome

The shell is currently desktop-locked (`h-screen w-screen overflow-hidden`). Field use needs a responsive variant. **No new visual language** — the same tokens, re-laid out:

| Breakpoint | Sidebar | KPI grid | Charts |
|---|---|---|---|
| `≥1024px` | 244px expanded | 4-up | full |
| `768–1023px` | 60px icon rail | 2-up | full |
| `<768px` | hidden → **bottom tab bar**, 5 items, `--app-surface`, 56px, safe-area inset | 1-up, `value` clamps to `2rem` | sparkline only; full charts behind "View chart" |

The bottom bar reuses `.nav-item` typography and the `.nav-item.active` treatment (`--app-accent-bg` + `--app-accent`). Slide-over panels (`w-80` / `w-96`) become full-screen sheets below `768px`.

---

# §1 · PRODUCT OVERVIEW

## 1.1 What the system does

**Nirman Setu** is RVNL's single command-and-control layer over its entire project portfolio — every new line, doubling, gauge conversion, electrification, metro, workshop, bridge, tunnel and ROB/RUB executed across its **~60 Project Implementation Units (PIUs)**.

It replaces the current reality — Excel MPRs mailed to HQ, WhatsApp site photos, physical Measurement Books, and a sanction status nobody can see without phoning the CPM — with one authoritative, chainage-aware, audit-complete system that runs **offline at the railhead** and **live at Corporate Office**.

Concretely, it is the system of record for:

- **Sanction → DPR → GAD → tender → award → execution → CRS → commissioning**, as one unbroken chain with an immutable trail.
- **Physical progress measured in the units RVNL actually uses** — earthwork in cum, ballast in cum, track linking in TKM, OHE wiring in TKM, girders launched in nos, and BOQ-item quantities against USSOR rates — not an abstract "% complete".
- **The three delay drivers that actually kill railway projects**: land acquisition (Railways Act §20A–20G), forest/environment clearance (FCA 1980, PARIVESH), and utility shifting. These are first-class tracked entities, not "issues".
- **Money against sanction**: Pink Book allocation, Detailed Estimate, contract value, on-account (RA) bills, PVC escalation, deductions, and PFMS-released payment — reconciled at BOQ-item granularity.

## 1.2 Stakeholders

| Stakeholder | Real designation | Where they live in the product | Primary need |
|---|---|---|---|
| **HQ Executive** | CMD, Director (Operations), Director (Finance), Director (Personnel) | Executive Dashboard, Portfolio, Board Pack | "Which of my 180 projects will slip this quarter, and what is the exposure in ₹ Cr?" |
| **HQ Functional** | ED/GM Planning, Finance, Contracts, Safety | Module dashboards, Approvals inbox | Sanction pipeline, tender pipeline, DoP-bound approvals |
| **Regional Head** | GM / CGM (Region) | Region-scoped Portfolio + Approvals | Roll-up of PIUs under them; second-level approvals |
| **Project Director** | CPM / Dy. CPM (PIU) | Project Dashboard, Milestones, Billing, Land, Blocks | "Is my package on the critical path, and is my contractor billing honestly?" |
| **Site Engineer** | SE / JE / AXEN | **Field app** (mobile, offline) | Daily Site Report, measurements, photos, safety observations, block requests |
| **Contractor** | Contractor PM & site staff | Contractor Portal (restricted tenant) | Submit DSR, raise RA bill, upload QAP/test results, view payment status |
| **Auditor** | CAG, Internal Audit, Vigilance (CVC) | Audit Console — read-only, full history | "Show me every approval, every rate deviation, every variation on this contract, with who and when." |
| **Ministry** | Railway Board ED/Member | Read-only Ministry view + export | Portfolio status for PRAGATI / Rail Drishti reporting |

## 1.3 Problems solved

| Problem today | How the platform solves it |
|---|---|
| **Visibility lag.** MPR reaches HQ 10–15 days after month-end; by then the slip is a quarter old. | Daily Site Report syncs from the field; portfolio KPIs recompute nightly and on-write. HQ sees yesterday, not last month. |
| **Progress is self-declared.** "85% complete" with no basis. | Progress is *derived* from BOQ quantity executed × item weightage, cross-checked against the digital Measurement Book and geo-stamped photos at a chainage. |
| **Cost overrun discovered at closure.** Variation statements surface only when the contract is 90% billed. | Live commitment tracking: sanction vs estimate vs award vs billed vs projected-at-completion, with deviation limits (±25% per item) alarmed at 15%. |
| **Land & clearance opacity.** Status lives in a CPM's notebook; the same village blocks three packages. | Land parcels are geometry with statutory state (§20A notified → §20E declared → §20F awarded → possession). Alignment km blocked by un-acquired land is computed, not estimated. |
| **Contractor performance is anecdotal.** | Objective Contractor Performance Index from schedule adherence, quality rejection rate, safety incidents, and billing hygiene — portfolio-wide, across all their contracts. |
| **Audit is an archaeology exercise.** CAG queries take weeks to answer. | Hash-chained, append-only audit log. Any approval, rate, or quantity reconstructs its full lineage in one query. |
| **The site has no internet.** Any online-only system is abandoned within a month. | Offline-first field app with an operation log and deterministic conflict resolution (§10). Nothing is lost, nothing is silently overwritten. |
| **Blocks and clearances collide.** Two packages request the same traffic block. | Block/OHE-power-block calendar per section, with conflict detection at request time. |

## 1.4 Key benefits

- **Weeks → hours** on monthly progress consolidation for Railway Board reporting.
- **Early warning, not post-mortem**: delay and cost-overrun prediction at the milestone level (§9), typically 6–10 weeks before slippage is visible in conventional reporting.
- **One number, everywhere.** Physical %, financial %, and land % are computed once from primary records; there is no second version in a different spreadsheet.
- **Audit-ready by construction.** Every state transition is signed, timestamped, and immutable — CAG/CVC readiness is a property of the system, not a project.

---

# §2 · INFORMATION ARCHITECTURE

## 2.1 Design principles

1. **Role determines the landing page, not a menu choice.** A Site Engineer opening the app lands on today's site work; the CMD lands on the portfolio. Same nav tree, different default route and different visible sections.
2. **Two levels deep, maximum.** Section → Page → (tabs within page). Nothing is three clicks from the sidebar.
3. **The project is the spine.** Every operational page can be entered globally (all projects) or scoped to one project via the same route with a `projectId`.
4. **Grouping follows how RVNL is organised** — Portfolio, Delivery, Commercial, Governance, Intelligence — not by technical module.

## 2.2 Navigation structure

Drop-in replacement for `NAV_SECTIONS` in [`Layout.js`](../src/components/Layout.js). Icon strings are 24×24 path data in the existing 1.6-stroke nav style.

```js
const NAV_SECTIONS = [
  {
    label: 'Command',
    items: [
      { path: '/',            label: 'Executive Dashboard', roles: ['HQ_EXEC','HQ_FUNCTIONAL','REGIONAL_HEAD','AUDITOR','MOR_OBSERVER'],
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
      { path: '/portfolio',   label: 'Project Portfolio',   roles: ['*'],
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { path: '/map',         label: 'Corridor Map',        roles: ['*'],
        icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { path: '/construction', label: 'Construction',   roles: ['PIU_CPM','SITE_ENGINEER','CONTRACTOR_PM','HQ_FUNCTIONAL','REGIONAL_HEAD'],
        icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
      { path: '/field',        label: 'Field Reporting', roles: ['SITE_ENGINEER','CONTRACTOR_SITE','PIU_CPM'],
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { path: '/milestones',   label: 'Milestones & Schedule', roles: ['*'],
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { path: '/resources',    label: 'Resources & Plant',  roles: ['PIU_CPM','SITE_ENGINEER','CONTRACTOR_PM'],
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { path: '/finance',     label: 'Budget & Expenditure', roles: ['HQ_FINANCE','PIU_CPM','HQ_EXEC','AUDITOR'],
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { path: '/billing',     label: 'Contractor Billing',   roles: ['PIU_CPM','HQ_FINANCE','CONTRACTOR_PM','AUDITOR'],
        icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
      { path: '/procurement', label: 'Procurement & Tenders', roles: ['HQ_FUNCTIONAL','PIU_CPM','HQ_EXEC','AUDITOR'],
        icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
      { path: '/contractors', label: 'Contractors',           roles: ['*'],
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { path: '/land',        label: 'Land Acquisition',  roles: ['PIU_CPM','HQ_FUNCTIONAL','HQ_EXEC','AUDITOR'],
        icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
      { path: '/compliance',  label: 'Clearances & Compliance', roles: ['*'],
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
      { path: '/safety',      label: 'Safety & Quality',  roles: ['*'],
        icon: 'M12 9v2m0 4h.01M5.062 19h13.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
      { path: '/risks',       label: 'Risk & Issues',     roles: ['*'],
        icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { path: '/approvals',   label: 'Approvals Inbox',   roles: ['*'],
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', badge: 'pendingApprovals' },
      { path: '/audit',       label: 'Audit Trail',       roles: ['AUDITOR','HQ_EXEC','HQ_FUNCTIONAL'],
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { path: '/documents',  label: 'Document Vault', roles: ['*'],
        icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2zM9 13h6M9 17h6M9 9h1' },
      { path: '/assistant',  label: 'Project Assistant', roles: ['*'],
        icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
      { path: '/reports',    label: 'Reports & Exports', roles: ['*'],
        icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
];
```

`roles: ['*']` = visible to all authenticated roles; the *data* is still scoped by PIU/project (§7.5). Sections render only if at least one child is permitted — a Site Engineer sees Delivery + a trimmed Governance, never an empty "Commercial" header.

## 2.3 Route map & page hierarchy

| Route | Page | Tabs / sub-views | Default for role |
|---|---|---|---|
| `/` | Executive Dashboard | — | HQ_EXEC, MOR_OBSERVER |
| `/portfolio` | Project Portfolio | Grid · Table · Gantt roll-up | REGIONAL_HEAD, HQ_FUNCTIONAL |
| `/projects/:id` | Project Dashboard | Overview · Packages · Schedule · Progress · Commercial · Risks · Docs | PIU_CPM |
| `/projects/:id/packages/:pkgId` | Package workspace | BOQ · Measurements · Bills · Quality · Blocks | — |
| `/map` | Corridor Map (GIS) | Alignment · Land · Structures · Progress heat · Layers | — |
| `/construction` | Construction | Live activity · DSR review queue · Quantity ledger | — |
| `/field` | Field Reporting | Today · My tasks · Submit DSR · Sync queue | SITE_ENGINEER, CONTRACTOR_SITE |
| `/milestones` | Milestones & Schedule | Gantt · Critical path · Slippage · Baselines | — |
| `/resources` | Resources & Plant | Manpower · Plant & machinery · Materials · Utilisation | — |
| `/finance` | Budget & Expenditure | Sanction vs estimate · Expenditure · Cash flow · Variance | HQ_FINANCE |
| `/billing` | Contractor Billing | RA bills · Measurement Book · Deductions · PFMS status | — |
| `/procurement` | Procurement & Tenders | Pipeline · Live tenders · Evaluation · Awards (LOA) | — |
| `/contractors` | Contractors | Directory · Performance index · Contracts · Blacklist watch | — |
| `/land` | Land Acquisition | Parcel register · §20 status board · Encumbrance map · Compensation | — |
| `/compliance` | Clearances & Compliance | Statutory register · Clearance tracker · CRS · Conditions | — |
| `/safety` | Safety & Quality | Incidents · Observations · QAP/ITP · Test results · NCRs | — |
| `/risks` | Risk & Issues | Register · Heatmap · Issue log · Mitigation | — |
| `/approvals` | Approvals Inbox | Pending me · Delegated · Raised by me · History | — |
| `/audit` | Audit Trail | Event log · Entity lineage · Rate deviations · Exports | AUDITOR |
| `/documents` | Document Vault | DPR · Drawings/GAD · Contracts · Correspondence · Test certs | — |
| `/assistant` | Project Assistant (AI) | Chat · Cited sources | — |
| `/reports` | Reports & Exports | MPR · Board pack · Ministry format · Custom | — |

## 2.4 Cross-cutting navigation

- **Global search (`Ctrl+K`)** — extend `SEARCH_INDEX` with live entity types: project code (`RVNL/NR/2019/DBL/14`), package, contractor name/PAN, tender no., BOQ item, village name, chainage (`KM 143+500`). Chainage input jumps straight to the map at that point.
- **Zone/Corridor filter** — `ZoneFilterBar` with `ZONES` replaced by Railway zones (`ALL, NR, NCR, NER, NFR, ER, ECR, SER, SECR, SR, SCR, SWR, CR, WR, WCR, NWR, ECoR, METRO`). The selection is **sticky across pages** in session storage — an HQ user filtered to SER stays filtered when they move from Portfolio to Finance.
- **Alerts bell** (existing) — operational alerts (§9).
- **AI Advisory** (existing purple button) — advisories in the frozen JSON shape (§9.2).
- **Breadcrumb** in `.page-header-block`: `Portfolio › Rishikesh–Karnaprayag › Package 4 (T-8 Tunnel) › BOQ`.

---

# §3 · DASHBOARD DESIGN

All three dashboards use `KPICard` unmodified, `.glass-panel` chart cards, `.status-chip-*` badges, `ChartTimeframeControl`, and the validated 5-slot series palette.

## 3.A Executive Dashboard — `/`

**Audience:** CMD, Directors, Railway Board observers. **Question it answers:** *Where is the portfolio bleeding, and how much?*

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ .page-header-block   RVNL Portfolio Command      [Zone ▾] [FYTD|3Y|LIFE]   │
├────────────────────────────────────────────────────────────────────────────┤
│ KPI STRIP — grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3                 │
│ ┌──────────┬──────────┬──────────┬──────────┐                              │
│ │Portfolio │ Physical │Expenditure│ Projects │                             │
│ │  Value   │ Progress │ vs Budget │ At Risk  │                             │
│ └──────────┴──────────┴──────────┴──────────┘                              │
│ ┌──────────┬──────────┬──────────┬──────────┐                              │
│ │   Land   │Clearances│ Milestone│  Safety  │                              │
│ │ Acquired │  Pending │ Slippage │  (LTIFR) │                              │
│ └──────────┴──────────┴──────────┴──────────┘                              │
├──────────────────────────────────┬─────────────────────────────────────────┤
│ Budget vs Expenditure by Zone    │ Risk Heatmap                            │
│ (grouped bar, 2 series, ₹ Cr)    │ (5×5 likelihood × impact matrix)        │
│ .glass-panel  lg:col-span-2      │ .glass-panel                            │
├──────────────────────────────────┼─────────────────────────────────────────┤
│ Portfolio S-Curve                │ Top Bottlenecks                         │
│ (planned vs actual vs forecast)  │ (ranked list, cause-tagged)             │
├──────────────────────────────────┴─────────────────────────────────────────┤
│ Projects Requiring Attention  — table, RAG-sorted, 8 rows + "View all"      │
└────────────────────────────────────────────────────────────────────────────┘
```

### KPI cards — exact props

```jsx
<KPICard label="Portfolio Value" value="₹1,48,320" unit="Cr" icon={<IcoRupee />}
  rag="normal" trend={4.2}
  subValues={[{label:'PROJECTS', value:'184'}, {label:'SANCTIONED FY26', value:'₹18,940 Cr'}]}
  onClick={() => navigate('/portfolio')} />

<KPICard label="Physical Progress" value="63.4" unit="%" icon={<IcoTrack />}
  rag="warning" trend={-1.8}
  subValues={[{label:'PLANNED', value:'68.1%'}, {label:'VARIANCE', value:'-4.7 pp'}]}
  onClick={() => navigate('/milestones')} />

<KPICard label="Expenditure vs Budget" value="71.2" unit="%" icon={<IcoBarChart />}
  rag="normal" trend={2.4}
  subValues={[{label:'SPENT FYTD', value:'₹13,486 Cr'}, {label:'TARGET', value:'₹18,940 Cr'}]}
  onClick={() => navigate('/finance')} />

<KPICard label="Projects At Risk" value="17" icon={<IcoAlert />}
  rag="critical" trend={12.5}
  subValues={[{label:'CRITICAL', value:'6'}, {label:'EXPOSURE', value:'₹4,210 Cr'}]}
  onClick={() => navigate('/risks')} />

<KPICard label="Land Acquired" value="78.6" unit="%" icon={<IcoLand />}
  rag="warning"
  subValues={[{label:'PARCELS PENDING', value:'2,140'}, {label:'BLOCKED KM', value:'214'}]}
  onClick={() => navigate('/land')} />

<KPICard label="Clearances Pending" value="43" icon={<IcoLeaf />}
  rag="warning" trend={-8.1}
  subValues={[{label:'FOREST (STAGE-II)', value:'11'}, {label:'>180 DAYS', value:'9'}]}
  onClick={() => navigate('/compliance')} />

<KPICard label="Milestone Slippage" value="11.4" unit="%" icon={<IcoHourglass />}
  rag="critical" trend={3.2}
  subValues={[{label:'SLIPPED', value:'142 / 1,248'}, {label:'AVG DELAY', value:'74 d'}]}
  onClick={() => navigate('/milestones')} />

<KPICard label="Safety — LTIFR" value="0.42" icon={<IcoHelmet />}
  rag="normal" trend={-16.0}
  subValues={[{label:'INCIDENTS FYTD', value:'23'}, {label:'FATALITIES', value:'1'}]}
  onClick={() => navigate('/safety')} />
```

### Charts

| Panel | Form | Encoding | Rules applied |
|---|---|---|---|
| **Budget vs Expenditure by Zone** | Grouped horizontal bar, zones on y | Series 1 `Sanctioned` slot-1 blue, series 2 `Expenditure` slot-2 amber. One axis (₹ Cr). | Legend present; 4px rounded ends; 2px gap between paired bars; direct-label the value at bar end. |
| **Portfolio S-Curve** | Line, 3 series | `Planned` slot-1, `Actual` slot-3 teal, `AI Forecast` slot-4 violet **dashed** (`borderDash:[5,4]`). | `pointRadius:0`, `borderWidth:2`, crosshair tooltip, `tension:0.35`. Forecast dash = a second encoding, so the line is identifiable without colour. |
| **Risk Heatmap** | 5×5 matrix, likelihood × impact | **Sequential single hue** (blue ramp light→dark) for count; the cell's RAG band is shown by a `.status-chip` in the tooltip, not by cell hue. | Never rainbow. Cell count printed inside when ≥1. 2px surface gap between cells. |
| **Top Bottlenecks** | Ranked list, not a chart | Each row: cause chip (`LAND` / `FOREST` / `UTILITY` / `BLOCK` / `CONTRACTOR` / `FUNDS`), affected km, ₹ exposure, days open. | A bar chart of 6 categorical causes adds nothing over a sorted list with magnitudes. |

### Alert & advisory integration

The existing bell and purple advisory button carry executive-grade signals: alert `category` ∈ `{schedule, cost, land, clearance, safety, quality, contract}`; `zone` = railway zone; `assetId` = project code. Advisories are generated by the models in §9 and rendered by the untouched `AdvisoryPanel`.

---

## 3.B Project Dashboard — `/projects/:id`

**Audience:** CPM / Dy. CPM, Regional Head. **Question it answers:** *Is my project on track, and where exactly is it stuck?*

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ .page-header-block                                                          │
│  Rishikesh–Karnaprayag New BG Line (125.20 km)     [status-chip: EXECUTION] │
│  RVNL/NR/2016/NL/07 · PIU Dehradun · CPM: <name>   [30D|QTD|FYTD]           │
├────────────────────────────────────────────────────────────────────────────┤
│ KPI STRIP (4-up)                                                            │
│  Physical Progress │ Financial Progress │ Milestones On Track │ Open NCRs   │
├──────────────────────────────────────────┬─────────────────────────────────┤
│ Progress vs BOQ (by work head)           │ Chainage Strip                  │
│ horizontal bar, executed vs contracted   │ 0 ────▓▓▓▓▓░░░──── 125.20 km    │
│                                          │ colour = section RAG            │
├──────────────────────────────────────────┼─────────────────────────────────┤
│ Milestone Gantt (top 12, critical path)  │ Compliance Status               │
│                                          │ clearance checklist + CRS       │
├──────────────────────────────────────────┼─────────────────────────────────┤
│ Contractor Performance (per package)     │ Land Status for this alignment  │
│                                          │ donut + blocked-km callout      │
├──────────────────────────────────────────┴─────────────────────────────────┤
│ Recent Site Activity — DSR feed with thumbnails, chainage, submitter        │
└────────────────────────────────────────────────────────────────────────────┘
```

### KPI cards

```jsx
<KPICard label="Physical Progress" value="41.8" unit="%" icon={<IcoTrack />}
  rag="warning" trend={2.1}
  subValues={[{label:'PLANNED', value:'52.0%'}, {label:'SLIP', value:'-10.2 pp'}]} />

<KPICard label="Financial Progress" value="38.4" unit="%" icon={<IcoRupee />}
  rag="warning" trend={1.6}
  subValues={[{label:'BILLED', value:'₹6,142 Cr'}, {label:'SANCTION', value:'₹16,216 Cr'}]} />

<KPICard label="Milestones On Track" value="18 / 26" icon={<IcoCalendar />}
  rag="warning"
  subValues={[{label:'SLIPPED', value:'6'}, {label:'AT RISK', value:'2'}]} />

<KPICard label="Open NCRs" value="9" icon={<IcoClipboard />}
  rag="critical" trend={28.6}
  subValues={[{label:'>30 DAYS', value:'4'}, {label:'CRITICAL', value:'2'}]} />
```

### Panels

- **Progress vs BOQ** — horizontal bars per work head (Earthwork, Bridges, Tunnels, Track, OHE, S&T, Buildings). Two series: `Executed Qty` and `Contracted Qty`, in the item's own unit (cum / TKM / nos). **Never a single "% complete"** — the underlying quantity is always visible on hover, with the source Measurement Book entry linked.
- **Chainage Strip** — a horizontal band representing 0 → project length, segmented by section, coloured by section RAG (`--app-success/warning/danger`), with markers at major structures. Clicking a segment deep-links to `/map?chainage=…`. This is the single most-used control on the page: it turns "where is the problem" into one glance.
- **Milestone Gantt** — planned bar (slot-1) with actual overlay (slot-3), critical path marked with a 2px `--app-danger` left edge, baseline shown as a thin tick. Slipped milestones carry `.status-chip-danger`.
- **Compliance Status** — checklist of statutory items for this project (GAD approval, forest Stage-I/II, EC, NBWL, CRS) each with a chip and days-pending. Not a chart.
- **Contractor Performance** — one row per package: CPI score, schedule adherence, quality rejection %, safety incidents, billing hygiene. Sorted worst-first.
- **Land Status** — donut of parcel state (`§20A notified / §20E declared / §20F awarded / possession taken / disputed`) with a prominent "**214 km blocked**" callout, since the km number drives decisions and the donut only contextualises it.

---

## 3.C Field Dashboard — `/field` (mobile-first)

**Audience:** Site Engineer, Contractor site staff, on Android in a tunnel portal with no signal. **Question it answers:** *What do I do today, and did my work reach HQ?*

### Design constraints

Everything is thumb-reachable, single-column, and **works with the network off**. The sync state is never hidden — an engineer must always know whether their morning's measurements are safe.

```
┌─────────────────────────────┐
│ ◉ OFFLINE · 7 queued  [↻]   │  ← sync bar, sticky top, ALWAYS visible
├─────────────────────────────┤
│ Today · 28 Jul 2026         │
│ Pkg 4 · KM 143+000–147+500  │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Today's Progress        │ │  ← KPICard, 1-up, unchanged component
│ │ 1,240 cum               │ │
│ │ TARGET 1,500 · 82.7%    │ │
│ │ ● WARNING               │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Open Tasks    6         │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ [ + SUBMIT DAILY REPORT ]   │  ← .app-primary-btn, full-width, 48px
├─────────────────────────────┤
│ MY TASKS                    │
│ ▸ Cube test — Pier P-14  ●  │
│ ▸ Block request 04:00–06:00 │
│ ▸ NCR-2291 closure evidence │
├─────────────────────────────┤
│ SYNC QUEUE           7 items│
│ ▸ DSR 27-Jul      ✓ synced  │
│ ▸ 12 photos       ⟳ 3.2 MB  │
│ ▸ MB entry #4471  ⧗ queued  │
└─────────────────────────────┘
│ [Home] [Report] [Tasks] [Map] [More] │  ← bottom tab bar (<768px)
```

### Sync indicator states

| State | Dot | Label | Token |
|---|---|---|---|
| Online, all synced | solid | `SYNCED · 09:42` | `--app-success` |
| Online, syncing | pulsing | `SYNCING · 3 of 7` | `--app-info` |
| Offline, queue clean | hollow | `OFFLINE` | `--app-text-faint` |
| Offline, queued | hollow + count | `OFFLINE · 7 queued` | `--app-warning` |
| Conflict / rejected | solid | `2 NEED ATTENTION` | `--app-danger` — tappable |

Reuse `.status-chip-*` for the pill and the KPI RAG dot markup (6px circle) for the indicator. `IcoSync` for the manual retry button.

### Daily Site Report form

One screen, top to bottom, resumable from a local draft on crash or battery death:

1. **Location** — auto GPS + nearest chainage (snapped to the alignment), manually overridable with a reason.
2. **Work performed** — BOQ item picker (recent items first, searchable offline), quantity, unit auto-filled from the item.
3. **Manpower & plant** — counts by trade; plant hours by machine.
4. **Photos** — camera capture, EXIF GPS + timestamp retained, client-side compression to ~200 KB, min 2 / max 12.
5. **Weather & hindrance** — hindrance reason from a fixed list (`rain / block not given / material / labour / land / utility / power / other`) with free text. This list feeds the delay model in §9.
6. **Safety observation** — optional; a near-miss here creates a Safety record.
7. **Submit** — writes to the local op-log immediately and returns to Home. Never blocks on the network.

---

## 3.D Shared dashboard components

| Component | Build | Basis |
|---|---|---|
| **Alert panel** | Existing `AlertPanel`, unchanged | `category` extended to RVNL domains |
| **Advisory panel** | Existing `AdvisoryPanel`, unchanged | Advisory JSON frozen (§9.2) |
| **Map component** | `react-leaflet` (already a dependency) | §5.3 |
| **Chainage strip** | New, ~80 LOC | Uses `.progress-track` / `.progress-fill` tokens |
| **Approval timeline** | New | Vertical stepper, `--app-success` done / `--app-warning` current / `--app-text-faint` pending |
| **Table** | New shared `DataTable` | `--app-surface` rows, `--app-border` dividers, `.status-chip-*` cells, sticky header, virtualised past 100 rows |

**Empty, loading, error states** — mandatory for every panel. Loading uses the existing `.app-loading-orbit`. Empty states state the reason and the action ("No DSR submitted for 28 Jul. **Submit report**"), never a bare "No data".

---

*Continue to [`02-ARCHITECTURE-AND-DATA.md`](02-ARCHITECTURE-AND-DATA.md) for system architecture, modules, data model and APIs.*
