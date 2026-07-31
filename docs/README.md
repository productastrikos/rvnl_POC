# RVNL Nirman Setu — Platform Blueprint

Production-grade design for **Rail Vikas Nigam Limited's** Integrated Project Command Centre, built on the existing UI design system in [the repository root](../client).

## Read in order

| Part | Deliverables | Contents |
|---|---|---|
| [**01 · Product & UI**](01-PRODUCT-AND-UI.md) | §0–§3 | Design System Contract (what is frozen vs open) · Product overview & stakeholders · Information architecture & navigation · Executive / Project / Field dashboards |
| [**02 · Architecture & Data**](02-ARCHITECTURE-AND-DATA.md) | §4–§7 | System architecture + diagram · 10 core modules · PostgreSQL/PostGIS schema · REST API design, examples, RBAC matrix |
| [**03 · Workflows & Platform**](03-WORKFLOWS-AND-PLATFORM.md) | §8–§13 | Lifecycle, billing, procurement, approvals, land, compliance workflows · Real-time & AI · Offline-first · Stack · NFRs · Roadmap |

## UI constraint compliance

The blueprint preserves the existing colour theme, KPI card design, icon style and visual language. §0 states the contract explicitly — every frozen token, component and rule is traced to its source file.

**One correction is proposed, with evidence.** The current `CHART_PALETTES.categorical` in [`chartUtils.js`](../src/components/chartUtils.js) fails colour-vision validation in both themes (slots 1 and 2 are two adjacent blues — ΔE 6.0 normal vision, indistinguishable to *everyone*). §0.5 supplies a validated replacement drawn **entirely from hues already present in the design system** — a re-ordering and per-theme step selection, not a new palette.

## Quick reference

- **Frozen design tokens** → §0.1
- **KPI card anatomy and rules** → §0.3
- **New icon glyphs (ready to paste into `KPICard.js`)** → §0.4
- **Validated chart palette + series rules** → §0.5
- **Navigation structure (drop-in `NAV_SECTIONS`)** → §2.2
- **KPI card props for every dashboard** → §3.A–§3.C
- **SQL schema** → §6.2–§6.8
- **API examples** → §7.3
- **Permission matrix** → §7.5
- **Conflict resolution table** → §10.4
- **Build sequence** → §13
