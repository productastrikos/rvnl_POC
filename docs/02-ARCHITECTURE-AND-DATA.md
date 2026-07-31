# RVNL Nirman Setu — Platform Blueprint
## Part 2 · System Architecture, Core Modules, Data Model, API Design

> **Scope:** §4 System Architecture · §5 Core Modules · §6 Data Model · §7 API Design
> **Other parts:** [`01-PRODUCT-AND-UI.md`](01-PRODUCT-AND-UI.md) (§0–§3) · [`03-WORKFLOWS-AND-PLATFORM.md`](03-WORKFLOWS-AND-PLATFORM.md) (§8–§12)

---

# §4 · SYSTEM ARCHITECTURE

## 4.1 The decision: modular monolith with four carved-out services

**Recommendation: a modular monolith ("RVNL Core") plus four separately deployed services.** Not microservices. The reasoning is specific to RVNL, not a general preference.

### Why a monolith is right here

1. **The load doesn't justify distribution.** 10–100 concurrent users at launch, ~2,000 named users at full rollout across ~60 PIUs, ~184 live projects. A single well-indexed PostgreSQL instance handles this with room to spare. Microservices would buy scalability RVNL will not need for years, at the cost of complexity it must operate from day one.
2. **The core flows demand ACID transactions across "service" boundaries.** Recording a measurement must atomically update the BOQ executed quantity, recompute package progress, write the audit chain entry, and enqueue the outbox event. In a microservice topology this becomes a saga with compensating transactions — and a compensating transaction on a *government payment record* is not an acceptable design. Money and quantity must be consistent, not eventually consistent.
3. **Audit integrity requires a linear, single-writer log.** The hash-chained audit trail (§6.7) needs a total order. That is trivial in one database and genuinely hard across distributed services.
4. **Operating reality.** The platform may be deployed into a MeitY-empanelled CSP or an NIC/MeghRaj data centre, operated by a small team, possibly under an AMC. Every additional deployable unit is a real operational tax. Two or three well-understood processes beat twelve.
5. **PSU procurement and audit favour a legible system.** "One application, one database, one audit log" survives a CAG review far better than a mesh of services with distributed state.

### What is carved out, and why

Only where the **resource profile genuinely differs** from the request/response core:

| Service | Deployed separately because | Runtime |
|---|---|---|
| **GIS/Tile Service** | CPU- and memory-bound spatial queries and vector-tile generation; scales on a different curve; must be independently cacheable behind a CDN. | Node.js + PostGIS read replica + `pg_tileserv`-style tile endpoint |
| **Sync Service** | Long-lived connections, bursty multi-megabyte photo uploads from thin rural links, aggressive retry. Must never contend with interactive HQ traffic for the same worker pool. | Node.js, its own connection pool, direct-to-S3 presigned uploads |
| **Intelligence Service** | Python ML/AI stack, batch and scheduled workloads, optional GPU, entirely different dependency tree and release cadence. | Python (FastAPI), scikit-learn/XGBoost + RAG over the document corpus |
| **Notification Worker** | Fan-out I/O (SMS/email/push) with third-party latency and failure that must not block a request thread. | Node.js worker on the outbox/queue |

Inside RVNL Core, the ten domain modules are **hard-bounded**: each owns a PostgreSQL schema, exposes a typed in-process interface, and may not read another module's tables directly — only call its interface or consume its domain events. This is what makes extraction cheap *if* it is ever needed: each module already behaves like a service, minus the network.

## 4.2 Architecture diagram

```
                          ┌──────────────────────────────────────────────┐
                          │              CLIENTS                          │
                          ├──────────────┬───────────────┬───────────────┤
                          │ React SPA    │ Field App     │ Contractor    │
                          │ (HQ / PIU)   │ (Flutter,     │ Portal        │
                          │ desktop      │  offline)     │ (React, scoped)│
                          └──────┬───────┴───────┬───────┴──────┬────────┘
                                 │ HTTPS/WSS     │ HTTPS (sync) │
                                 ▼               ▼              ▼
              ┌───────────────────────────────────────────────────────────┐
              │   API GATEWAY / WAF   (TLS 1.3, rate limit, JWT verify)   │
              └───────┬───────────────┬──────────────┬───────────────┬────┘
                      │               │              │               │
        ┌─────────────▼─────┐  ┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼───────┐
        │   RVNL CORE       │  │ SYNC        │ │ GIS/TILE   │ │ INTELLIGENCE │
        │  (modular         │  │ SERVICE     │ │ SERVICE    │ │ SERVICE      │
        │   monolith,       │  │ (Node)      │ │ (Node)     │ │ (Python)     │
        │   Node/NestJS)    │  │             │ │            │ │              │
        │ ┌───────────────┐ │  │ op-log      │ │ vector     │ │ delay model  │
        │ │ identity/RBAC │ │  │ ingest,     │ │ tiles,     │ │ cost model   │
        │ │ project       │ │  │ conflict    │ │ spatial    │ │ risk scoring │
        │ │ construction  │ │  │ resolution, │ │ queries,   │ │ RAG over DPR │
        │ │ finance       │ │  │ presigned   │ │ chainage   │ │ advisory gen │
        │ │ compliance    │ │  │ uploads     │ │ snapping   │ │              │
        │ │ procurement   │ │  └──────┬──────┘ └─────┬──────┘ └──────┬───────┘
        │ │ resource      │ │         │              │               │
        │ │ risk          │ │         │              │               │
        │ │ document      │ │         │              │               │
        │ │ monitoring    │ │         │              │               │
        │ │ approval/audit│ │         │              │               │
        │ └───────────────┘ │         │              │               │
        │   WS gateway      │         │              │               │
        └────────┬──────────┘         │              │               │
                 │                    │              │               │
    ┌────────────┴────────────────────┴──────────────┴───────────────┴────────┐
    │                          DATA LAYER                                      │
    ├──────────────────┬──────────────┬───────────────┬───────────────────────┤
    │ PostgreSQL 15    │ Redis        │ Object Store  │ Event Bus             │
    │ + PostGIS 3      │ cache,       │ (S3/MinIO)    │ Phase 1: Redis Streams│
    │ primary + read   │ session,     │ DPR, GAD,     │ Phase 2: Kafka        │
    │ replica          │ rate limit,  │ drawings,     │ (outbox pattern —     │
    │ schema-per-module│ job queue    │ photos, bills │  txn-safe publish)    │
    └──────────────────┴──────────────┴───────────────┴───────────────────────┘
                 │
    ┌────────────┴──────────────────────────────────────────────────────────┐
    │              GOVERNMENT / EXTERNAL INTEGRATIONS                        │
    │  IREPS (tenders) · GeM · PFMS (payments) · IRPSM (MoR sanction)        │
    │  PARIVESH (forest/EC) · e-Office · Bhuvan/ISRO imagery · DSC/eSign     │
    │  SMS gateway (NIC) · Rail Drishti export                              │
    └───────────────────────────────────────────────────────────────────────┘
```

## 4.3 Module boundaries inside RVNL Core

| Module | Owns (schema) | Publishes events | Consumes |
|---|---|---|---|
| **identity** | `iam.*` — users, roles, PIU scope, DoP | `user.role_changed` | — |
| **project** | `prj.*` — project, package, section, milestone, baseline | `project.status_changed`, `milestone.slipped` | `construction.progress_recorded` |
| **construction** | `con.*` — DSR, measurement, quantity ledger, blocks | `progress.recorded`, `dsr.submitted` | `project.package_created` |
| **finance** | `fin.*` — budget, estimate, RA bill, deduction, payment | `bill.certified`, `payment.released` | `construction.measurement_approved` |
| **compliance** | `cmp.*` — clearance, condition, statutory record, CRS | `clearance.granted`, `clearance.overdue` | `project.created` |
| **procurement** | `prc.*` — tender, bid, evaluation, LOA, contract | `contract.awarded` | `project.package_created` |
| **resource** | `res.*` — manpower, plant, material, contractor | `contractor.performance_updated` | `construction.dsr_submitted` |
| **risk** | `rsk.*` — risk register, issue, mitigation | `risk.escalated` | all |
| **document** | `doc.*` — document, version, drawing, DPR | `document.approved` | — |
| **monitoring** | `mon.*` — alert, advisory, KPI snapshot, subscription | `alert.raised` | all |
| **approval** (cross-cutting) | `apr.*` — request, step, delegation | `approval.completed` | all |
| **audit** (cross-cutting) | `aud.*` — hash-chained log | — | all (write-only sink) |

**Domain events use the transactional outbox pattern**: the business write and the `outbox` insert share one transaction; a relay publishes to Redis Streams (later Kafka) and marks it dispatched. No event is ever lost or published for a rolled-back transaction.

## 4.4 Real-time layer

- **WebSocket gateway** in RVNL Core (Socket.IO), rooms per `project:{id}`, `piu:{id}`, `zone:{code}`, `user:{id}`.
- Server pushes: new alert, advisory generated, approval landed in your inbox, DSR submitted for review, bill status change, sync completion for your device.
- The client contract already exists: [`services/socket.js`](../src/services/socket.js) exposes `DataContext` with `{ kpis, alerts, advisories, lastUpdate, connected, acknowledgeAlert }`. **Keep this shape** — replace the seed constants with live subscription state and the UI needs no changes.
- Degradation: if WS is unavailable, the client falls back to 60s polling on `/api/v1/dashboard/*` with `If-None-Match`.

## 4.5 Storage strategy

| Content | Store | Notes |
|---|---|---|
| Transactional records | PostgreSQL | Row-level ownership by PIU; read replica serves dashboards & GIS |
| Geometry (alignment, parcels, structures) | PostGIS (`geometry(…,4326)`) | GIST indexes; generated `geography` column for metric distance |
| DPR, GAD, drawings, contracts | S3/MinIO, versioned, SSE-KMS | Immutable object per version; DB holds metadata + checksum |
| Site photos | S3/MinIO, `photos/{project}/{yyyy-mm}/…` | Originals retained; 400px thumbnails generated on ingest |
| Signed approvals (DSC/eSign) | S3 + hash in `apr.approval_step` | PDF with embedded signature; hash recorded in audit chain |
| Tiles | Generated on demand, cached in Redis + CDN | Invalidated on alignment/parcel change |

Retention: transactional data for project life + 10 years (CAG); audit log **permanent, append-only**; photos 7 years; tiles ephemeral.

---

# §5 · CORE MODULES

## 5.1 Project Management

**Features.** Project registry keyed by RVNL project code (`RVNL/{ZONE}/{YEAR}/{TYPE}/{SEQ}`, type ∈ NL/DBL/GC/RE/MTR/WS/BR). Project types: new line, doubling, gauge conversion, electrification, metro, workshop, bridge, ROB/RUB. Section and package breakdown. Milestone plan with baseline versioning (original sanction baseline vs current approved baseline — every rebaseline requires an approval and is retained). Critical path computation. Sanction lineage: Pink Book item → Detailed Estimate → sanctioned cost → revised estimate. SPV and deposit-work flagging with funding source. Physical/financial progress roll-up from packages. Project health scoring.

**Data.** `prj.project`, `prj.section`, `prj.package`, `prj.milestone`, `prj.baseline`, `prj.baseline_milestone`, `prj.progress_snapshot`.

**APIs.** `GET /projects`, `GET /projects/{id}`, `GET /projects/{id}/packages`, `GET /projects/{id}/milestones`, `POST /projects/{id}/rebaseline`, `GET /projects/{id}/progress?asOf=`, `GET /projects/{id}/critical-path`.

**UI.** `/portfolio` grid + table + Gantt roll-up; `/projects/:id` dashboard (§3.B); milestone Gantt with baseline ticks; chainage strip.

---

## 5.2 Construction Management

**Features.** Daily Site Report capture (online and offline). Digital **Measurement Book** — append-only, sequentially numbered per package, entries linked to BOQ item, chainage, and geo-stamped photographs; corrections are *reversal entries*, never edits. Quantity ledger per BOQ item (contracted / executed / certified / paid). Work-front tracking by chainage. Traffic-block and OHE power-block request calendar with conflict detection per section. Hindrance register feeding the delay model. Joint measurement recording (RVNL + contractor sign-off).

**Data.** `con.daily_site_report`, `con.dsr_activity`, `con.measurement`, `con.measurement_photo`, `con.block_request`, `con.hindrance`, `con.work_front`.

**APIs.** `POST /dsr`, `GET /dsr?packageId=&date=`, `POST /dsr/{id}/review`, `POST /measurements`, `GET /measurements?boqItemId=`, `POST /measurements/{id}/reverse`, `GET /quantity-ledger?packageId=`, `POST /blocks/request`, `GET /blocks/calendar?sectionId=&from=&to=`.

**UI.** `/construction` (DSR review queue, quantity ledger); `/field` mobile capture (§3.C); block calendar; MB viewer with reversal history.

---

## 5.3 Planning & GIS

**Features.** Alignment as a geometry with **linear referencing** — every entity (structure, parcel, work front, incident, photo) carries a `chainage_m` and is snapped to the alignment. Chainage ↔ coordinate conversion in both directions. Layer stack: alignment, existing track, land parcels, structures (bridges, tunnels, ROB/RUB, stations), forest boundaries, utilities to be shifted, work fronts, progress heat. Satellite imagery underlay (Bhuvan/ISRO). Progress visualised **on the corridor**, not just in tables. Blocked-km computation: alignment length whose overlapping parcels lack possession. Offline map packs — pre-clipped tiles per package for field use.

**Data.** `gis.alignment` (`geometry(LineStringZ,4326)`), `gis.chainage_marker`, `gis.structure`, `gis.land_parcel` (`geometry(MultiPolygon,4326)`), `gis.utility`, `gis.layer_config`.

**APIs.** `GET /gis/alignment/{projectId}` (GeoJSON), `GET /gis/tiles/{layer}/{z}/{x}/{y}.pbf`, `POST /gis/snap` (lat/lng → chainage), `GET /gis/chainage/{projectId}/{chainageM}` (→ lat/lng), `GET /gis/blocked-km/{projectId}`, `GET /gis/features?bbox=&layers=`.

**UI.** `/map` full-screen Leaflet with a layer switcher, chainage ruler, and click-to-inspect. Embedded mini-maps on project and land pages. Optional 3D digital twin (§9.5) using the existing `three` dependency.

---

## 5.4 Compliance & Regulatory

**Features.** Statutory clearance register per project with the real instruments: **forest clearance** under FCA 1980 (Stage-I → Stage-II via PARIVESH), **environmental clearance** (EIA Notification 2006), **wildlife/NBWL** where alignment crosses a sanctuary, **GAD approval** by the zonal railway, **CRS sanction** (Commissioner of Railway Safety) with speed certificate before opening, state NOCs (PWD, irrigation, pollution board), tree-cutting permission. Each clearance tracks: applied date, authority, current stage, days pending, expected date, **conditions imposed**, and compliance evidence against each condition. Escalation when a clearance crosses its SLA. Condition-compliance is tracked to closure — a granted clearance with 14 unmet conditions is not "done".

**Data.** `cmp.clearance`, `cmp.clearance_stage`, `cmp.clearance_condition`, `cmp.compliance_record`, `cmp.statutory_authority`.

**APIs.** `GET /compliance/clearances?projectId=&status=`, `POST /compliance/clearances`, `PATCH /compliance/clearances/{id}/stage`, `GET /compliance/conditions?clearanceId=`, `POST /compliance/conditions/{id}/evidence`, `GET /compliance/overdue?zone=`.

**UI.** `/compliance` statutory register (table + timeline per clearance), condition checklist with evidence upload, CRS readiness panel on the project dashboard.

---

## 5.5 Financial Management

**Features.** Sanction vs Detailed Estimate vs award vs commitment vs expenditure, at project, package and BOQ-item granularity. Annual budget allocation (Pink Book) and FYTD burn against it. Cash-flow forecasting from the milestone plan. **Price Variation Clause** computation against published RDSO/Railway Board indices. Variation and deviation control with the ±25% per-item limit enforced and alarmed at 15%. Cost-to-complete and projected-cost-at-completion. PFMS reconciliation of released payments. Fund-source split (MoR budgetary / EBR-IF / SPV / deposit works).

**Data.** `fin.budget_allocation`, `fin.estimate`, `fin.commitment`, `fin.expenditure`, `fin.pvc_index`, `fin.variation`, `fin.cash_flow_forecast`.

**APIs.** `GET /finance/summary?projectId=|zone=`, `GET /finance/budget-vs-expenditure?fy=&groupBy=zone|project`, `GET /finance/cash-flow?projectId=&horizon=`, `GET /finance/variations?contractId=`, `POST /finance/variations`, `GET /finance/pvc?contractId&period=`.

**UI.** `/finance` with budget-vs-expenditure bars, S-curve, variance waterfall, and a deviation-limit gauge per contract.

---

## 5.6 Procurement & Tendering

**Features.** Tender pipeline from packaging decision → NIT → publication (IREPS/GeM/CPP) → pre-bid → bid opening (two-packet: technical then financial) → technical evaluation → financial evaluation → reverse auction (where applicable) → L1 determination → LOA → agreement → performance guarantee. EMD/Bid Security Declaration tracking. Vendor eligibility against RDSO approval and past-performance/blacklist status. Tender cycle-time analytics (the metric that actually predicts award slippage). LOA-to-agreement and agreement-to-mobilisation lag tracking.

**Data.** `prc.tender`, `prc.tender_package`, `prc.bid`, `prc.bid_evaluation`, `prc.loa`, `prc.contract`, `prc.performance_guarantee`.

**APIs.** `GET /procurement/tenders?status=&piuId=`, `POST /procurement/tenders`, `POST /procurement/tenders/{id}/publish`, `POST /procurement/tenders/{id}/bids`, `POST /procurement/tenders/{id}/evaluate`, `POST /procurement/tenders/{id}/loa`, `GET /procurement/cycle-time?fy=`.

**UI.** `/procurement` Kanban pipeline by stage, live-tender table with countdowns, evaluation workspace, award history. Read-only mirroring of IREPS state where the integration is one-way.

---

## 5.7 Resource Management

**Features.** Contractor master with PAN/GSTIN, class of registration, and **Contractor Performance Index** aggregated across all their RVNL contracts. Manpower deployment by trade against contractual commitment. Plant & machinery register with deployment, utilisation and idle-time tracking (piling rigs, batching plants, tunnel boring, track-laying machines, tower wagons). Material tracking for key items (rails, sleepers, ballast, cement, steel, OHE mast). Deployment shortfall alerts against the contractual resource schedule.

**Data.** `res.contractor`, `res.contractor_score`, `res.manpower_log`, `res.plant`, `res.plant_deployment`, `res.material_ledger`.

**APIs.** `GET /contractors`, `GET /contractors/{id}/performance`, `GET /resources/manpower?packageId=&from=&to=`, `GET /resources/plant?packageId=&status=`, `GET /resources/shortfall?packageId=`.

**UI.** `/contractors` directory + performance scorecards; `/resources` deployment vs commitment charts and a plant utilisation table.

---

## 5.8 Risk & Issue Management

**Features.** Risk register per project with likelihood × impact scoring, RVNL-specific categories (land, forest/EC, utility shifting, traffic block, contractor capacity, funds, geology/tunnelling, monsoon, interface with zonal railway, third-party approvals). Mitigation plans with owners and due dates. Issue log for realised risks with escalation ladder (site → PIU → region → HQ) and auto-escalation on ageing. Portfolio risk heatmap. Every risk carries a financial exposure so the portfolio number is real.

**Data.** `rsk.risk`, `rsk.risk_assessment`, `rsk.mitigation`, `rsk.issue`, `rsk.escalation`.

**APIs.** `GET /risks?projectId=&severity=`, `POST /risks`, `PATCH /risks/{id}`, `POST /risks/{id}/mitigations`, `GET /risks/heatmap?zone=`, `POST /issues/{id}/escalate`.

**UI.** `/risks` register table + 5×5 heatmap (sequential single hue, per §0.5) + issue log with ageing.

---

## 5.9 Document Management

**Features.** Versioned vault for DPRs, GADs and drawings, contract agreements, correspondence, test certificates, and photographs. Drawing revision control with supersession (Rev A → Rev B, with the superseded revision retained and clearly marked). Transmittal tracking. Full-text search including OCR of scanned documents. Every document links to its project/package/contract and to the approval that accepted it. Checksums on every version; nothing is ever hard-deleted.

**Data.** `doc.document`, `doc.document_version`, `doc.drawing`, `doc.transmittal`, `doc.document_link`.

**APIs.** `POST /documents` (presigned upload), `GET /documents?projectId=&type=`, `GET /documents/{id}/versions`, `POST /documents/{id}/versions`, `GET /documents/search?q=`, `GET /documents/{id}/download` (short-lived signed URL).

**UI.** `/documents` vault with type/project facets, version timeline, inline PDF viewer, drawing comparison.

---

## 5.10 Monitoring & Intelligence

**Features.** Rule-based alerting (§9.1) and model-driven advisories (§9.2). KPI snapshotting for trend computation. Report generation in Railway Board formats (MPR, quarterly review, board pack) and Rail Drishti export. Subscription management — who gets alerted about what, on which channel.

**Data.** `mon.alert`, `mon.advisory`, `mon.kpi_snapshot`, `mon.subscription`, `mon.report_run`.

**APIs.** `GET /dashboard/executive`, `GET /dashboard/project/{id}`, `GET /dashboard/field`, `GET /alerts?acknowledged=`, `POST /alerts/{id}/acknowledge`, `GET /advisories`, `POST /reports/generate`.

**UI.** All three dashboards, the existing `AlertPanel` and `AdvisoryPanel`, and `/reports`.

---

# §6 · DATA MODEL

## 6.1 Entity relationships

```
                              ┌──────────────┐
                              │  RAILWAY_ZONE│
                              └──────┬───────┘
                                     │ 1:N
                              ┌──────▼───────┐
                              │     PIU      │ (Project Implementation Unit)
                              └──────┬───────┘
                                     │ 1:N
        ┌────────────────────────────▼──────────────────────────────┐
        │                        PROJECT                             │
        │  code · type · sanctioned_cost · length_km · status        │
        └──┬────────┬─────────┬──────────┬──────────┬───────────┬───┘
           │1:N     │1:1      │1:N       │1:N       │1:N        │1:N
     ┌─────▼──┐ ┌───▼─────┐ ┌─▼──────┐ ┌─▼──────┐ ┌─▼────────┐ ┌▼─────────┐
     │SECTION │ │ALIGNMENT│ │MILESTONE│ │  RISK  │ │CLEARANCE │ │ DOCUMENT │
     └─────┬──┘ └───┬─────┘ └────────┘ └────────┘ └────┬─────┘ └──────────┘
           │1:N     │ linear-ref                        │1:N
     ┌─────▼──────┐ │ (chainage_m)                 ┌────▼──────────┐
     │  PACKAGE   │ ├──────────┬─────────┐         │CLEARANCE_     │
     │ (tendered  │ │          │         │         │CONDITION      │
     │  unit)     │ ▼          ▼         ▼         └───────────────┘
     └──┬──┬──┬───┘ LAND_    STRUCTURE  UTILITY
        │  │  │     PARCEL
        │  │  └────────────────────┐
   1:1  │  │ 1:N                   │ 1:N
  ┌─────▼┐ └──────┐          ┌─────▼──────┐
  │CONTRACT│      │          │ BOQ_ITEM   │◄──── hierarchical (parent_id)
  └──┬───┬┘  ┌────▼────┐     └─────┬──────┘
     │   │   │ DAILY_  │           │ 1:N
     │   │   │ SITE_   │     ┌─────▼──────┐
     │   │   │ REPORT  │     │MEASUREMENT │ (append-only, MB entry)
     │   │   └────┬────┘     └─────┬──────┘
     │   │        │ 1:N            │ N:1
     │   │   ┌────▼─────┐          │
     │   │   │DSR_ACTIVITY├─────────┘
     │   │   └──────────┘
     │   │ 1:N
     │  ┌▼──────────┐  1:N   ┌──────────────┐
     │  │  RA_BILL  ├───────►│ RA_BILL_LINE │──► references MEASUREMENT
     │  └─┬─────────┘        └──────────────┘
     │    │ 1:N
     │  ┌─▼──────────┐
     │  │ DEDUCTION  │
     │  └────────────┘
     │ N:1
  ┌──▼────────┐
  │CONTRACTOR │──1:N──► CONTRACTOR_SCORE
  └───────────┘

  CROSS-CUTTING (polymorphic over entity_type + entity_id):
    APPROVAL_REQUEST ──1:N──► APPROVAL_STEP
    AUDIT_LOG  (hash-chained, append-only)
    SYNC_OPERATION  (offline op-log, idempotent)
```

## 6.2 Core schema — projects & structure

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE project_type   AS ENUM ('new_line','doubling','gauge_conversion','electrification',
                                    'metro','workshop','bridge','rob_rub','station','other');
CREATE TYPE project_status AS ENUM ('conceived','dpr_preparation','dpr_submitted','sanctioned',
                                    'tendering','under_execution','commissioned','closed','on_hold');
CREATE TYPE funding_source AS ENUM ('mor_budgetary','ebr_if','spv','deposit_work','state_share','other');
CREATE TYPE rag            AS ENUM ('normal','warning','critical');

CREATE TABLE prj.railway_zone (
  code        varchar(8) PRIMARY KEY,           -- NR, NCR, SER, SECR, METRO …
  name        text NOT NULL
);

CREATE TABLE prj.piu (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(16) UNIQUE NOT NULL,      -- PIU-DDN
  name        text NOT NULL,
  zone_code   varchar(8) NOT NULL REFERENCES prj.railway_zone(code),
  hq_city     text,
  cpm_user_id uuid,
  location    geometry(Point,4326)
);

CREATE TABLE prj.project (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              varchar(48) UNIQUE NOT NULL,   -- RVNL/NR/2016/NL/07
  name              text NOT NULL,
  type              project_type   NOT NULL,
  status            project_status NOT NULL DEFAULT 'conceived',
  piu_id            uuid NOT NULL REFERENCES prj.piu(id),
  zone_code         varchar(8) NOT NULL REFERENCES prj.railway_zone(code),
  funding_source    funding_source NOT NULL,
  spv_name          text,
  length_km         numeric(9,3),
  -- Sanction lineage
  pink_book_item    varchar(32),
  sanction_year     int,
  sanctioned_cost   numeric(16,2),               -- ₹ lakh
  latest_estimate   numeric(16,2),
  -- Schedule
  sanction_date     date,
  target_completion date,
  revised_completion date,
  actual_completion date,
  -- Derived (materialised by trigger/job — never hand-edited)
  physical_progress_pct  numeric(5,2) DEFAULT 0,
  financial_progress_pct numeric(5,2) DEFAULT 0,
  health            rag DEFAULT 'normal',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON prj.project (piu_id, status);
CREATE INDEX ON prj.project (zone_code, status);
CREATE INDEX ON prj.project USING gin (name gin_trgm_ops);

CREATE TABLE prj.section (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES prj.project(id) ON DELETE RESTRICT,
  name          text NOT NULL,                  -- 'Rishikesh – Shivpuri'
  from_chainage_m int NOT NULL,
  to_chainage_m   int NOT NULL,
  CONSTRAINT chk_section_chainage CHECK (to_chainage_m > from_chainage_m)
);

CREATE TABLE prj.package (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES prj.project(id),
  section_id      uuid REFERENCES prj.section(id),
  code            varchar(48) UNIQUE NOT NULL,   -- RKN/PKG-04
  name            text NOT NULL,
  scope_summary   text,
  from_chainage_m int,
  to_chainage_m   int,
  estimated_cost  numeric(16,2),
  contract_id     uuid,                          -- FK added after prc.contract
  status          varchar(24) NOT NULL DEFAULT 'planned',
  physical_progress_pct numeric(5,2) DEFAULT 0
);
CREATE INDEX ON prj.package (project_id, status);
```

## 6.3 Alignment, land & GIS

```sql
CREATE TABLE gis.alignment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL UNIQUE REFERENCES prj.project(id),
  geom        geometry(LineString,4326) NOT NULL,
  geog        geography(LineString,4326)
                GENERATED ALWAYS AS (geom::geography) STORED,
  length_m    numeric(12,2),
  survey_date date,
  version     int NOT NULL DEFAULT 1
);
CREATE INDEX ON gis.alignment USING gist (geom);

-- Chainage ⇄ coordinate helpers (linear referencing)
CREATE OR REPLACE FUNCTION gis.chainage_to_point(p_project uuid, p_chainage_m int)
RETURNS geometry(Point,4326) LANGUAGE sql STABLE AS $$
  SELECT ST_LineInterpolatePoint(a.geom, LEAST(1.0, p_chainage_m / NULLIF(a.length_m,0)))
  FROM gis.alignment a WHERE a.project_id = p_project;
$$;

CREATE OR REPLACE FUNCTION gis.point_to_chainage(p_project uuid, p_pt geometry)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT round(ST_LineLocatePoint(a.geom, p_pt) * a.length_m)::int
  FROM gis.alignment a WHERE a.project_id = p_project;
$$;

CREATE TYPE land_status AS ENUM
  ('identified','sec20a_notified','sec20e_declared','sec20f_awarded',
   'compensation_paid','possession_taken','disputed','court_stay');

CREATE TABLE gis.land_parcel (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES prj.project(id),
  parcel_ref        varchar(64) NOT NULL,        -- survey/khasra number
  village           text NOT NULL,
  tehsil            text,
  district          text NOT NULL,
  state             text NOT NULL,
  area_hectare      numeric(10,4) NOT NULL,
  land_type         varchar(24),                 -- private | government | forest | railway
  status            land_status NOT NULL DEFAULT 'identified',
  -- Railways Act 1989 §20A–20G milestones
  sec20a_date       date,
  sec20e_date       date,
  sec20f_date       date,
  compensation_amount numeric(16,2),
  compensation_paid_date date,
  possession_date   date,
  from_chainage_m   int,
  to_chainage_m     int,
  geom              geometry(MultiPolygon,4326),
  remarks           text,
  UNIQUE (project_id, parcel_ref, village)
);
CREATE INDEX ON gis.land_parcel USING gist (geom);
CREATE INDEX ON gis.land_parcel (project_id, status);

CREATE TABLE gis.structure (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES prj.project(id),
  package_id   uuid REFERENCES prj.package(id),
  type         varchar(24) NOT NULL,   -- major_bridge | minor_bridge | tunnel | rob | rub | station | tsp
  ref_code     varchar(32) NOT NULL,   -- 'T-8', 'MB-14'
  chainage_m   int NOT NULL,
  length_m     numeric(10,2),
  spec         jsonb,                  -- span config, tunnel dia, etc.
  progress_pct numeric(5,2) DEFAULT 0,
  geom         geometry(Geometry,4326)
);
CREATE INDEX ON gis.structure USING gist (geom);
CREATE INDEX ON gis.structure (project_id, type);
```

## 6.4 Contracts, BOQ, measurement & billing

```sql
CREATE TABLE res.contractor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  pan           varchar(10) UNIQUE,
  gstin         varchar(15),
  reg_class     varchar(16),
  is_blacklisted boolean NOT NULL DEFAULT false,
  blacklist_note text,
  contact       jsonb
);

CREATE TABLE prc.contract (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      uuid NOT NULL REFERENCES prj.package(id),
  contractor_id   uuid NOT NULL REFERENCES res.contractor(id),
  agreement_no    varchar(64) UNIQUE NOT NULL,
  tender_id       uuid,
  awarded_value   numeric(16,2) NOT NULL,
  loa_date        date NOT NULL,
  agreement_date  date,
  commencement_date date,
  original_completion date NOT NULL,
  extended_completion date,          -- after approved EOT
  security_deposit_pct numeric(5,2) DEFAULT 6.0,
  performance_guarantee_pct numeric(5,2) DEFAULT 3.0,
  pvc_applicable  boolean NOT NULL DEFAULT true,
  status          varchar(24) NOT NULL DEFAULT 'active'
);
ALTER TABLE prj.package ADD CONSTRAINT fk_pkg_contract
  FOREIGN KEY (contract_id) REFERENCES prc.contract(id);

CREATE TABLE con.boq_item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES prc.contract(id),
  parent_id       uuid REFERENCES con.boq_item(id),      -- hierarchy: work head → sub-head → item
  item_code       varchar(32) NOT NULL,
  ussor_code      varchar(32),                            -- Unified Standard Schedule of Rates
  description     text NOT NULL,
  unit            varchar(16) NOT NULL,                   -- cum | sqm | rmt | tkm | nos | MT
  contracted_qty  numeric(16,3) NOT NULL,
  rate            numeric(14,2) NOT NULL,                 -- ₹ per unit
  amount          numeric(16,2) GENERATED ALWAYS AS (contracted_qty * rate) STORED,
  work_head       varchar(32),                            -- earthwork | bridges | tunnels | track | ohe | s&t
  weightage_pct   numeric(6,3),                           -- share of package physical progress
  is_non_schedule boolean NOT NULL DEFAULT false,
  UNIQUE (contract_id, item_code)
);
CREATE INDEX ON con.boq_item (contract_id, work_head);

-- Digital Measurement Book: APPEND-ONLY. Corrections are reversal rows.
CREATE TABLE con.measurement (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_item_id     uuid NOT NULL REFERENCES con.boq_item(id),
  package_id      uuid NOT NULL REFERENCES prj.package(id),
  mb_no           varchar(32) NOT NULL,
  mb_page         int,
  entry_seq       bigint NOT NULL,                        -- monotonic per package
  measured_qty    numeric(16,3) NOT NULL,
  from_chainage_m int,
  to_chainage_m   int,
  measured_on     date NOT NULL,
  measured_by     uuid NOT NULL,                          -- RVNL site engineer
  contractor_rep  text,
  is_joint        boolean NOT NULL DEFAULT true,
  status          varchar(16) NOT NULL DEFAULT 'recorded', -- recorded|approved|billed|reversed
  reverses_id     uuid REFERENCES con.measurement(id),     -- non-null ⇒ this is a reversal entry
  dsr_id          uuid,
  client_op_id    uuid UNIQUE,                             -- offline idempotency key
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, entry_seq)
);
CREATE INDEX ON con.measurement (boq_item_id, status);
CREATE INDEX ON con.measurement (package_id, measured_on DESC);

-- Executed quantity is DERIVED, never stored as a mutable column
CREATE VIEW con.v_boq_executed AS
SELECT b.id AS boq_item_id,
       b.contract_id,
       b.contracted_qty,
       COALESCE(SUM(m.measured_qty) FILTER (WHERE m.status <> 'reversed'), 0) AS executed_qty,
       CASE WHEN b.contracted_qty > 0
            THEN LEAST(999.99, ROUND(COALESCE(SUM(m.measured_qty)
                 FILTER (WHERE m.status <> 'reversed'),0) / b.contracted_qty * 100, 2))
            ELSE 0 END AS executed_pct
FROM con.boq_item b
LEFT JOIN con.measurement m ON m.boq_item_id = b.id
GROUP BY b.id;

CREATE TABLE fin.ra_bill (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES prc.contract(id),
  bill_no         int NOT NULL,                           -- 1,2,3… ; last is 'final'
  is_final        boolean NOT NULL DEFAULT false,
  period_from     date NOT NULL,
  period_to       date NOT NULL,
  gross_amount    numeric(16,2) NOT NULL,
  pvc_amount      numeric(16,2) DEFAULT 0,
  total_deductions numeric(16,2) DEFAULT 0,
  net_payable     numeric(16,2),
  status          varchar(24) NOT NULL DEFAULT 'submitted',
    -- submitted → under_check → certified → passed → paid → rejected
  submitted_by    uuid,
  submitted_at    timestamptz,
  certified_by    uuid,
  certified_at    timestamptz,
  pfms_txn_ref    varchar(64),
  paid_at         timestamptz,
  UNIQUE (contract_id, bill_no)
);

CREATE TABLE fin.ra_bill_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_bill_id    uuid NOT NULL REFERENCES fin.ra_bill(id) ON DELETE CASCADE,
  boq_item_id   uuid NOT NULL REFERENCES con.boq_item(id),
  measurement_id uuid REFERENCES con.measurement(id),
  qty_this_bill numeric(16,3) NOT NULL,
  qty_upto_date numeric(16,3) NOT NULL,
  rate          numeric(14,2) NOT NULL,
  amount        numeric(16,2) NOT NULL
);
CREATE INDEX ON fin.ra_bill_line (ra_bill_id);

CREATE TABLE fin.deduction (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_bill_id  uuid NOT NULL REFERENCES fin.ra_bill(id) ON DELETE CASCADE,
  type        varchar(32) NOT NULL,   -- security_deposit | income_tax_tds | gst_tds |
                                      -- labour_cess | mobilisation_recovery | ld | other
  basis_pct   numeric(6,3),
  amount      numeric(16,2) NOT NULL,
  remarks     text
);
```

## 6.5 Milestones, risk, compliance, documents

```sql
CREATE TABLE prj.milestone (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES prj.project(id),
  package_id     uuid REFERENCES prj.package(id),
  code           varchar(16) NOT NULL,          -- M1, M2…
  name           text NOT NULL,
  planned_start  date,
  planned_finish date NOT NULL,
  baseline_finish date NOT NULL,                -- original sanction baseline, immutable
  actual_start   date,
  actual_finish  date,
  weightage_pct  numeric(6,3),
  is_critical    boolean NOT NULL DEFAULT false,
  predecessor_ids uuid[],
  status         varchar(16) NOT NULL DEFAULT 'not_started',
  slip_days      int GENERATED ALWAYS AS
                   (CASE WHEN actual_finish IS NOT NULL
                         THEN (actual_finish - baseline_finish) END) STORED
);
CREATE INDEX ON prj.milestone (project_id, status, planned_finish);

CREATE TABLE rsk.risk (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES prj.project(id),
  package_id    uuid REFERENCES prj.package(id),
  category      varchar(32) NOT NULL,   -- land | forest_ec | utility | traffic_block | contractor
                                        -- | funds | geology | monsoon | interface | approval
  title         text NOT NULL,
  description   text,
  likelihood    int NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact        int NOT NULL CHECK (impact BETWEEN 1 AND 5),
  score         int GENERATED ALWAYS AS (likelihood * impact) STORED,
  exposure_amount numeric(16,2),        -- ₹ lakh
  exposure_days   int,
  owner_user_id uuid,
  status        varchar(16) NOT NULL DEFAULT 'open',
  identified_on date NOT NULL DEFAULT CURRENT_DATE,
  target_closure date,
  closed_on     date
);
CREATE INDEX ON rsk.risk (project_id, status, score DESC);

CREATE TYPE clearance_type AS ENUM
  ('forest_stage1','forest_stage2','environmental','wildlife_nbwl','gad_approval',
   'crs_sanction','state_noc','tree_cutting','pollution_board','utility_shifting','other');

CREATE TABLE cmp.clearance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES prj.project(id),
  type            clearance_type NOT NULL,
  authority       text NOT NULL,          -- MoEFCC / Zonal Railway / CRS Northern Circle …
  reference_no    varchar(64),
  applied_on      date,
  expected_on     date,
  granted_on      date,
  valid_until     date,
  status          varchar(24) NOT NULL DEFAULT 'not_applied',
    -- not_applied → applied → query_raised → under_process → granted → rejected → lapsed
  sla_days        int,
  days_pending    int GENERATED ALWAYS AS
                    (CASE WHEN granted_on IS NULL AND applied_on IS NOT NULL
                          THEN (CURRENT_DATE - applied_on) END) STORED,
  portal_ref      varchar(64),            -- PARIVESH proposal number
  affected_from_chainage_m int,
  affected_to_chainage_m   int
);
CREATE INDEX ON cmp.clearance (project_id, status, type);

CREATE TABLE cmp.clearance_condition (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_id  uuid NOT NULL REFERENCES cmp.clearance(id) ON DELETE CASCADE,
  seq           int NOT NULL,
  condition_text text NOT NULL,
  compliance_status varchar(16) NOT NULL DEFAULT 'pending',
  evidence_doc_id uuid,
  due_date      date,
  closed_on     date
);

CREATE TABLE doc.document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES prj.project(id),
  package_id    uuid REFERENCES prj.package(id),
  type          varchar(32) NOT NULL,   -- dpr | gad | drawing | contract | test_cert |
                                        -- correspondence | photo | bill | clearance_doc
  title         text NOT NULL,
  current_version int NOT NULL DEFAULT 1,
  is_superseded boolean NOT NULL DEFAULT false,
  tags          text[],
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE doc.document_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES doc.document(id) ON DELETE RESTRICT,
  version       int NOT NULL,
  revision_label varchar(8),             -- 'Rev A', 'Rev B'
  storage_key   text NOT NULL,           -- S3 object key
  mime_type     varchar(96),
  size_bytes    bigint,
  sha256        char(64) NOT NULL,
  ocr_text      tsvector,
  uploaded_by   uuid NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
CREATE INDEX ON doc.document_version USING gin (ocr_text);
```

## 6.6 Daily Site Report (offline-originated)

```sql
CREATE TABLE con.daily_site_report (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      uuid NOT NULL REFERENCES prj.package(id),
  report_date     date NOT NULL,
  submitted_by    uuid NOT NULL,
  submitted_role  varchar(24) NOT NULL,          -- SITE_ENGINEER | CONTRACTOR_SITE
  from_chainage_m int,
  to_chainage_m   int,
  gps             geometry(Point,4326),
  weather         varchar(24),
  hindrance_type  varchar(32),                   -- rain|block_not_given|material|labour|
                                                 -- land|utility|power|none|other
  hindrance_hours numeric(4,1) DEFAULT 0,
  hindrance_note  text,
  manpower        jsonb,                         -- {"mason":12,"helper":30,…}
  plant           jsonb,                         -- [{"code":"EXC-04","hours":7.5}]
  narrative       text,
  status          varchar(16) NOT NULL DEFAULT 'submitted', -- submitted|reviewed|rejected
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  -- offline provenance
  client_op_id    uuid UNIQUE NOT NULL,
  device_id       varchar(64),
  captured_at     timestamptz NOT NULL,          -- device clock at capture
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, report_date, submitted_by)
);
CREATE INDEX ON con.daily_site_report (package_id, report_date DESC);
CREATE INDEX ON con.daily_site_report (status) WHERE status = 'submitted';

CREATE TABLE con.dsr_photo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dsr_id        uuid NOT NULL REFERENCES con.daily_site_report(id) ON DELETE CASCADE,
  storage_key   text NOT NULL,
  thumb_key     text,
  gps           geometry(Point,4326),
  chainage_m    int,
  captured_at   timestamptz,
  sha256        char(64),
  caption       text
);
```

## 6.7 Approvals & audit (cross-cutting)

```sql
CREATE TYPE approval_level AS ENUM ('site','piu','regional','hq','ministry');

CREATE TABLE apr.approval_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   varchar(48) NOT NULL,   -- ra_bill | variation | eot | dsr | rebaseline |
                                        -- tender_award | dpr | rate_analysis
  entity_id     uuid NOT NULL,
  project_id    uuid REFERENCES prj.project(id),
  title         text NOT NULL,
  amount        numeric(16,2),          -- drives the DoP level required
  required_levels approval_level[] NOT NULL,
  current_level approval_level,
  status        varchar(16) NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|withdrawn
  raised_by     uuid NOT NULL,
  raised_at     timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);
CREATE INDEX ON apr.approval_request (entity_type, entity_id);
CREATE INDEX ON apr.approval_request (status, current_level);

CREATE TABLE apr.approval_step (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES apr.approval_request(id) ON DELETE CASCADE,
  level         approval_level NOT NULL,
  seq           int NOT NULL,
  assignee_user_id uuid,
  assignee_role varchar(32),
  action        varchar(16),            -- approved | rejected | returned | delegated
  remarks       text,
  acted_by      uuid,
  acted_at      timestamptz,
  signature_key text,                   -- S3 key of DSC/eSign-signed PDF
  signature_hash char(64),
  UNIQUE (request_id, seq)
);

-- Hash-chained, append-only. No UPDATE, no DELETE (enforced by trigger + role grants).
CREATE TABLE aud.audit_log (
  id            bigserial PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_role    varchar(32),
  actor_ip      inet,
  action        varchar(48) NOT NULL,   -- create|update|approve|reject|download|login|export
  entity_type   varchar(48) NOT NULL,
  entity_id     uuid,
  project_id    uuid,
  before_state  jsonb,
  after_state   jsonb,
  reason        text,
  prev_hash     char(64),
  hash          char(64) NOT NULL
);
CREATE INDEX ON aud.audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX ON aud.audit_log (project_id, occurred_at DESC);
CREATE INDEX ON aud.audit_log (actor_user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION aud.chain_hash() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev char(64);
BEGIN
  SELECT hash INTO prev FROM aud.audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := prev;
  NEW.hash := encode(digest(
      coalesce(prev,'') || NEW.occurred_at::text || coalesce(NEW.actor_user_id::text,'') ||
      NEW.action || NEW.entity_type || coalesce(NEW.entity_id::text,'') ||
      coalesce(NEW.after_state::text,''), 'sha256'), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_audit_chain BEFORE INSERT ON aud.audit_log
  FOR EACH ROW EXECUTE FUNCTION aud.chain_hash();

CREATE RULE audit_no_update AS ON UPDATE TO aud.audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO aud.audit_log DO INSTEAD NOTHING;
```

## 6.8 Offline sync op-log

```sql
CREATE TABLE sync.operation (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_op_id   uuid UNIQUE NOT NULL,          -- generated on device; idempotency key
  device_id      varchar(64) NOT NULL,
  user_id        uuid NOT NULL,
  entity_type    varchar(48) NOT NULL,
  entity_id      uuid,
  op             varchar(8) NOT NULL,           -- create | update | delete
  payload        jsonb NOT NULL,
  base_version   int,                           -- server version the device last saw
  captured_at    timestamptz NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  status         varchar(16) NOT NULL DEFAULT 'pending',
    -- pending | applied | conflict | rejected
  conflict_reason text,
  resolution     varchar(24),                   -- server_wins | client_wins | merged | manual
  applied_at     timestamptz
);
CREATE INDEX ON sync.operation (device_id, status);
CREATE INDEX ON sync.operation (user_id, status) WHERE status = 'conflict';
```

---

# §7 · API DESIGN

## 7.1 Conventions

| Aspect | Rule |
|---|---|
| Base | `https://api.nirmansetu.rvnl.gov.in/api/v1` |
| Auth | `Authorization: Bearer <JWT>`; 15-min access token, 8-hour refresh; MFA for HQ_EXEC/HQ_FINANCE |
| Format | JSON; `snake_case` in the DB, `camelCase` on the wire |
| Money | Always ₹ **lakh** as a number, plus a formatted string. Never a float in the DB. |
| Dates | ISO-8601 with timezone; all business dates in IST (`Asia/Kolkata`) |
| Chainage | Integer metres (`chainageM`), rendered client-side as `KM 143+500` |
| Pagination | `?page=1&pageSize=25` (max 200), envelope below |
| Filtering | `?zone=SER&piuId=&projectId=&status=&fy=2026-27&from=&to=` — repeatable for OR (`status=delayed&status=at_risk`) |
| Sorting | `?sort=-physicalProgressPct,name` (`-` = desc) |
| Sparse fields | `?fields=id,name,status` |
| Idempotency | `Idempotency-Key` header required on all POST that create money/quantity records |
| Concurrency | `ETag` + `If-Match` on PATCH; 409 on mismatch |
| Errors | RFC 7807 `application/problem+json` |
| Rate limit | 600 req/min per user; 60/min on export endpoints |

**Response envelope**

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 25, "totalItems": 184, "totalPages": 8,
            "generatedAt": "2026-07-28T09:42:11+05:30", "scope": { "zone": "SER" } },
  "links": { "self": "...?page=1", "next": "...?page=2", "prev": null }
}
```

**Error**

```json
{
  "type": "https://api.nirmansetu.rvnl.gov.in/errors/deviation-limit-exceeded",
  "title": "BOQ deviation limit exceeded",
  "status": 422,
  "detail": "Item EW-102 executed quantity 132.4% of contracted exceeds the 125% limit. A variation order approved at HQ level is required before further measurement.",
  "instance": "/api/v1/measurements",
  "errors": [{ "field": "measuredQty", "code": "DEVIATION_LIMIT",
               "contractedQty": 45000, "executedQty": 59580, "limitPct": 125 }]
}
```

## 7.2 Endpoint catalogue

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `GET` | `/dashboard/executive` | Portfolio KPI strip + panels | HQ_EXEC, HQ_FUNCTIONAL, REGIONAL_HEAD, AUDITOR, MOR_OBSERVER |
| `GET` | `/dashboard/project/{id}` | Project dashboard payload | PIU_CPM, REGIONAL_HEAD, HQ_* |
| `GET` | `/dashboard/field` | Today's field payload for the caller | SITE_ENGINEER, CONTRACTOR_SITE |
| `GET` | `/projects` | List + filter portfolio | all (scoped) |
| `GET` | `/projects/{id}` | Project detail | all (scoped) |
| `GET` | `/projects/{id}/milestones` | Milestone plan + slippage | all (scoped) |
| `POST` | `/projects/{id}/rebaseline` | Revise baseline (approval-gated) | PIU_CPM → HQ |
| `GET` | `/packages/{id}/boq` | BOQ tree with executed qty | PIU_CPM, SITE_ENGINEER, CONTRACTOR_PM, AUDITOR |
| `POST` | `/dsr` | Submit daily site report | SITE_ENGINEER, CONTRACTOR_SITE |
| `GET` | `/dsr` | DSR feed / review queue | PIU_CPM, SITE_ENGINEER |
| `POST` | `/dsr/{id}/review` | Accept / reject a DSR | PIU_CPM |
| `POST` | `/measurements` | Record MB entry | SITE_ENGINEER |
| `POST` | `/measurements/{id}/reverse` | Reversal entry (never an edit) | PIU_CPM |
| `GET` | `/quantity-ledger` | Contracted/executed/certified/paid | PIU_CPM, HQ_FINANCE, AUDITOR |
| `POST` | `/bills` | Raise RA bill | CONTRACTOR_PM |
| `POST` | `/bills/{id}/certify` | Certify bill | PIU_CPM |
| `GET` | `/finance/budget-vs-expenditure` | Budget chart data | HQ_FINANCE, HQ_EXEC, PIU_CPM |
| `GET` | `/finance/cash-flow` | Forecast | HQ_FINANCE, PIU_CPM |
| `GET` | `/compliance/clearances` | Clearance register | all (scoped) |
| `PATCH` | `/compliance/clearances/{id}/stage` | Advance stage | PIU_CPM, HQ_FUNCTIONAL |
| `GET` | `/land/parcels` | Parcel register | PIU_CPM, HQ_FUNCTIONAL, AUDITOR |
| `GET` | `/gis/alignment/{projectId}` | Alignment GeoJSON | all (scoped) |
| `GET` | `/gis/tiles/{layer}/{z}/{x}/{y}.pbf` | Vector tiles | all (scoped) |
| `POST` | `/gis/snap` | lat/lng → chainage | all (scoped) |
| `GET` | `/risks` / `POST` `/risks` | Risk register | all (scoped) / PIU_CPM |
| `GET` | `/approvals/inbox` | Pending on me | all |
| `POST` | `/approvals/{id}/act` | Approve/reject/return | per DoP |
| `GET` | `/alerts` · `POST` `/alerts/{id}/acknowledge` | Alerts | all |
| `GET` | `/advisories` | AI advisories | all |
| `GET` | `/audit/log` | Audit query | AUDITOR, HQ_EXEC |
| `POST` | `/sync/push` · `GET` `/sync/pull` | Offline sync | SITE_ENGINEER, CONTRACTOR_SITE |

## 7.3 Example responses

### `GET /api/v1/dashboard/executive?zone=SER&timeframe=FYTD`

Maps 1:1 onto the KPI cards in §3.A — `rag` and `trend` are server-computed so the client never derives business state.

```json
{
  "data": {
    "kpis": [
      { "key": "portfolioValue", "label": "Portfolio Value", "value": 14832000,
        "display": "₹1,48,320", "unit": "Cr", "icon": "IcoRupee", "rag": "normal", "trend": 4.2,
        "subValues": [ { "label": "PROJECTS", "value": "184" },
                       { "label": "SANCTIONED FY26", "value": "₹18,940 Cr" } ],
        "drillTo": "/portfolio" },
      { "key": "physicalProgress", "label": "Physical Progress", "value": 63.4,
        "display": "63.4", "unit": "%", "icon": "IcoTrack", "rag": "warning", "trend": -1.8,
        "subValues": [ { "label": "PLANNED", "value": "68.1%" },
                       { "label": "VARIANCE", "value": "-4.7 pp" } ],
        "drillTo": "/milestones" },
      { "key": "projectsAtRisk", "label": "Projects At Risk", "value": 17,
        "display": "17", "icon": "IcoAlert", "rag": "critical", "trend": 12.5,
        "subValues": [ { "label": "CRITICAL", "value": "6" },
                       { "label": "EXPOSURE", "value": "₹4,210 Cr" } ],
        "drillTo": "/risks" }
    ],
    "budgetVsExpenditure": {
      "unit": "₹ Cr",
      "categories": ["NR", "SER", "SECR", "SCR", "ECoR"],
      "series": [
        { "name": "Sanctioned",  "slot": 1, "data": [24310, 18940, 15220, 12880, 9640] },
        { "name": "Expenditure", "slot": 2, "data": [17420, 13486, 10110,  8940, 7020] }
      ]
    },
    "sCurve": {
      "labels": ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"],
      "series": [
        { "name": "Planned",  "slot": 1, "data": [4.2,9.1,14.8,21.0,28.4,36.1,44.0,52.2,60.1,71.4,84.0,100] },
        { "name": "Actual",   "slot": 3, "data": [3.8,8.0,12.9,18.4,null,null,null,null,null,null,null,null] },
        { "name": "Forecast", "slot": 4, "style": "dashed",
          "data": [null,null,null,18.4,24.1,31.0,38.2,45.9,53.0,62.8,74.1,88.6] }
      ]
    },
    "riskHeatmap": {
      "encoding": "sequential",
      "cells": [ { "likelihood": 5, "impact": 5, "count": 3, "projectIds": ["…"] },
                 { "likelihood": 4, "impact": 5, "count": 6 },
                 { "likelihood": 3, "impact": 4, "count": 11 } ]
    },
    "bottlenecks": [
      { "cause": "LAND",    "label": "Land possession pending — 3 villages, Chandauli",
        "projectCode": "RVNL/ECR/2018/DBL/03", "affectedKm": 14.2,
        "exposureCr": 412.0, "daysOpen": 287, "rag": "critical" },
      { "cause": "FOREST",  "label": "FCA Stage-II awaited — Ramgarh division",
        "projectCode": "RVNL/SER/2019/NL/11", "affectedKm": 8.6,
        "exposureCr": 268.5, "daysOpen": 194, "rag": "critical" },
      { "cause": "UTILITY", "label": "220kV HT line shifting — state DISCOM",
        "projectCode": "RVNL/SECR/2020/DBL/06", "affectedKm": 3.1,
        "exposureCr": 96.2, "daysOpen": 121, "rag": "warning" }
    ]
  },
  "meta": { "generatedAt": "2026-07-28T09:42:11+05:30", "scope": { "zone": "SER" },
            "cacheTtlSeconds": 300 }
}
```

### `GET /api/v1/projects/{id}?include=progress,land,clearances`

```json
{
  "data": {
    "id": "8f2c…", "code": "RVNL/NR/2016/NL/07",
    "name": "Rishikesh – Karnaprayag New BG Line",
    "type": "new_line", "status": "under_execution",
    "zone": "NR", "piu": { "id": "…", "code": "PIU-DDN", "name": "PIU Dehradun" },
    "lengthKm": 125.20, "fundingSource": "mor_budgetary",
    "sanctionedCost": 1621600, "latestEstimate": 1685400, "costUnit": "₹ lakh",
    "sanctionDate": "2016-02-18", "targetCompletion": "2026-12-31",
    "revisedCompletion": "2028-03-31",
    "progress": {
      "physicalPct": 41.8, "plannedPhysicalPct": 52.0, "variancePp": -10.2,
      "financialPct": 38.4, "billedAmount": 614200,
      "byWorkHead": [
        { "workHead": "tunnels",  "contractedQty": 105.4, "executedQty": 61.2, "unit": "km", "pct": 58.1 },
        { "workHead": "bridges",  "contractedQty": 35,    "executedQty": 12,   "unit": "nos", "pct": 34.3 },
        { "workHead": "earthwork","contractedQty": 8420000,"executedQty": 5106000,"unit":"cum","pct": 60.6 },
        { "workHead": "track",    "contractedQty": 125.2, "executedQty": 0,    "unit": "tkm", "pct": 0 }
      ]
    },
    "land": { "totalParcels": 4218, "possessionTaken": 3315, "acquiredPct": 78.6,
              "blockedKm": 12.4, "disputedParcels": 61 },
    "clearances": [
      { "type": "forest_stage2", "status": "under_process", "authority": "MoEFCC",
        "appliedOn": "2025-11-04", "daysPending": 266, "slaDays": 180, "rag": "critical",
        "portalRef": "FP/UK/RAIL/44821/2025" },
      { "type": "crs_sanction", "status": "not_applied", "rag": "normal" }
    ],
    "health": "warning"
  }
}
```

### `POST /api/v1/dsr`

Request (from the field app; `clientOpId` makes replay safe):

```json
{
  "clientOpId": "b3f1a2c0-77d1-4e8a-9c31-2f0a8e91d4aa",
  "packageId": "1c9e…", "reportDate": "2026-07-28",
  "capturedAt": "2026-07-28T17:42:03+05:30", "deviceId": "FLD-DDN-114",
  "fromChainageM": 143000, "toChainageM": 147500,
  "gps": { "lat": 30.1284, "lng": 78.7419 },
  "weather": "rain", "hindranceType": "rain", "hindranceHours": 3.5,
  "manpower": { "mason": 12, "helper": 30, "operator": 4 },
  "plant": [ { "code": "EXC-04", "hours": 4.5 }, { "code": "BP-01", "hours": 6.0 } ],
  "activities": [
    { "boqItemId": "a71c…", "measuredQty": 1240.5, "unit": "cum",
      "fromChainageM": 143200, "toChainageM": 143800 }
  ],
  "photoKeys": [ "photos/8f2c/2026-07/dsr-114-1.jpg", "photos/8f2c/2026-07/dsr-114-2.jpg" ],
  "narrative": "Excavation at T-8 south portal. Stopped 14:00 due to rain."
}
```

Response `201`:

```json
{
  "data": { "id": "d4a2…", "status": "submitted", "entrySeq": 4471,
            "syncedAt": "2026-07-28T18:10:44+05:30",
            "derived": { "packagePhysicalPct": 41.9, "dayProgressVsTarget": 82.7 } },
  "meta": { "idempotent": false }
}
```

### `GET /api/v1/gis/alignment/{projectId}?include=structures,landStatus`

```json
{
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "id": "align-8f2c",
      "geometry": { "type": "LineString", "coordinates": [[78.2932,30.1074],[78.7419,30.1284]] },
      "properties": { "projectId": "8f2c…", "lengthM": 125200, "version": 3 } },
    { "type": "Feature", "id": "str-T8",
      "geometry": { "type": "Point", "coordinates": [78.7419, 30.1284] },
      "properties": { "type": "tunnel", "refCode": "T-8", "chainageM": 143520,
                      "lengthM": 14570, "progressPct": 61.2, "rag": "warning" } },
    { "type": "Feature", "id": "parcel-441",
      "geometry": { "type": "MultiPolygon", "coordinates": [[[[78.74,30.12],[78.75,30.12],
                                                              [78.75,30.13],[78.74,30.12]]]] },
      "properties": { "parcelRef": "142/3", "village": "Gular", "status": "sec20e_declared",
                      "areaHectare": 2.14, "rag": "critical", "blocksChainage": [143000,143600] } }
  ],
  "meta": { "blockedKm": 12.4, "generatedAt": "2026-07-28T09:42:11+05:30" }
}
```

### `GET /api/v1/finance/budget-vs-expenditure?fy=2026-27&groupBy=zone`

```json
{
  "data": {
    "fy": "2026-27", "unit": "₹ Cr", "asOf": "2026-07-28",
    "rows": [
      { "zone": "NR",  "allocated": 24310, "committed": 21880, "expenditure": 17420,
        "burnPct": 71.7, "rag": "normal" },
      { "zone": "SER", "allocated": 18940, "committed": 17020, "expenditure": 13486,
        "burnPct": 71.2, "rag": "normal" },
      { "zone": "ECoR","allocated":  9640, "committed":  7110, "expenditure":  4020,
        "burnPct": 41.7, "rag": "critical" }
    ],
    "totals": { "allocated": 148320, "committed": 128410, "expenditure": 94860, "burnPct": 64.0 }
  }
}
```

## 7.4 GIS filtering & performance

- `bbox=minLng,minLat,maxLng,maxLat` on all feature endpoints; server clips with `ST_Intersects` against the GIST index.
- `simplify=<tolerance>` applies `ST_SimplifyPreserveTopology` — alignments render at national zoom without shipping full geometry.
- Vector tiles (`.pbf`) generated with `ST_AsMVT`, cached in Redis keyed `{layer}:{z}/{x}/{y}:{dataVersion}`, invalidated on alignment/parcel writes.
- All GIS reads hit the **read replica**.

## 7.5 RBAC + ABAC

Role grants the *verb*; attributes grant the *scope*. Both must pass.

**JWT claims**

```json
{
  "sub": "u-8812", "name": "…", "role": "PIU_CPM",
  "scope": { "zones": ["NR"], "piuIds": ["piu-ddn"], "projectIds": ["*"] },
  "dopLimit": 50000000,
  "contractorId": null,
  "mfa": true,
  "iat": 1785000000, "exp": 1785000900
}
```

Every scoped query appends the tenant predicate server-side (also enforced by PostgreSQL **row-level security** as defence in depth):

```sql
CREATE POLICY piu_scope ON prj.project FOR SELECT
  USING (
    current_setting('app.role') IN ('HQ_EXEC','HQ_FUNCTIONAL','AUDITOR','MOR_OBSERVER')
    OR piu_id::text = ANY (string_to_array(current_setting('app.piu_ids'), ','))
  );
```

**Permission matrix** (`R` read · `W` write · `A` approve · `—` none)

| Capability | HQ_EXEC | HQ_FINANCE | REGIONAL_HEAD | PIU_CPM | SITE_ENGINEER | CONTRACTOR_PM | AUDITOR |
|---|---|---|---|---|---|---|---|
| Portfolio dashboard | R (all) | R (all) | R (region) | R (PIU) | R (project) | — | R (all) |
| Project master | R | R | R | W | R | R (own) | R |
| DSR | R | — | R | W/A | W | W (own) | R |
| Measurement (MB) | R | R | R | A | W | R (own) | R |
| RA bill | R | A | R | A | R | W (own) | R |
| Variation / EOT | A | A | A | W | — | W (request) | R |
| Tender award | A | R | A | W | — | — | R |
| Land parcel | R | — | R | W | R | — | R |
| Clearance | R | — | R | W | R | — | R |
| Risk register | R | R | W | W | W | R (own) | R |
| Document vault | R | R | R | W | W | W (own) | R |
| Audit log | R | R | — | — | — | — | R (full) |
| User & role admin | — | — | — | — | — | — | — |

`RVNL_ADMIN` holds user/role administration and nothing else — it can never read project financials. Separation of duties is a hard boundary: **no role both certifies a bill and releases its payment.**

Contractor scoping is strict: `CONTRACTOR_PM` sees only rows where `contract.contractor_id = jwt.contractorId`, enforced in the query layer *and* by RLS. A contractor never sees another contractor's rates, bids, or performance scores.

---

*Continue to [`03-WORKFLOWS-AND-PLATFORM.md`](03-WORKFLOWS-AND-PLATFORM.md) for workflows, real-time & AI, offline-first design, stack and NFRs.*
