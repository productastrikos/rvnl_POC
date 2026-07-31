# RVNL Nirman Setu — Platform Blueprint
## Part 3 · Workflows, Real-time & AI, Offline-First, Stack, NFRs

> **Scope:** §8 Workflows · §9 Real-time & AI · §10 Offline-First · §11 Technology Stack · §12 Non-Functional Requirements · §13 Delivery Roadmap
> **Other parts:** [`01-PRODUCT-AND-UI.md`](01-PRODUCT-AND-UI.md) (§0–§3) · [`02-ARCHITECTURE-AND-DATA.md`](02-ARCHITECTURE-AND-DATA.md) (§4–§7)

---

# §8 · WORKFLOWS

## 8.1 Project lifecycle — DPR to commissioning

```
 CONCEIVED
    │  Traffic/feasibility survey; RVNL nominated by MoR
    ▼
 DPR PREPARATION ──────────────────────────────────────────┐
    │  Final Location Survey · alignment · soil · hydrology │ consultant
    │  cost estimate · traffic projection · EIRR/FIRR       │ deliverables
    ▼                                                       ┘
 DPR SUBMITTED
    │  ① internal technical vetting (PIU → HQ Planning)
    │  ② HQ Finance concurrence on estimate
    │  ③ submission to Railway Board / IRPSM
    ▼
 SANCTIONED  ◄── Pink Book item + Detailed Estimate approved
    │  GAD approval from Zonal Railway
    │  Land acquisition initiated (§20A notification)
    │  Statutory clearances initiated (FCA Stage-I, EC, NBWL)
    ▼
 TENDERING  ── packaging decision → NIT → award (§8.4)
    │
    ▼
 UNDER EXECUTION ◄──────────────────────────────┐
    │  Daily site reporting (§8.2)              │
    │  Monthly billing (§8.3)                   │ loop until
    │  Milestone tracking, variations, EOT      │ scope complete
    │  Clearance conditions closed              │
    └───────────────────────────────────────────┘
    │
    ▼
 SAFETY CERTIFICATION
    │  CRS inspection → CRS sanction + speed certificate
    ▼
 COMMISSIONED
    │  Handover to Zonal Railway · DLP · final bill
    ▼
 CLOSED  ── completion report, asset register update, CAG-ready archive
```

**Gate rules.** A status transition is blocked, with a named reason, unless its gate passes:

| Transition | Gate |
|---|---|
| `dpr_submitted → sanctioned` | Pink Book item + Detailed Estimate + HQ Finance concurrence recorded |
| `sanctioned → tendering` | GAD approved; ≥1 package defined with an estimate |
| `tendering → under_execution` | LOA issued, agreement signed, PG received and within validity |
| `under_execution → commissioned` | All milestones complete; CRS sanction on record; **zero open critical NCRs**; all clearance conditions closed or formally extended |
| `commissioned → closed` | Final bill paid; DLP expired; completion report approved at HQ |

Each transition writes an `aud.audit_log` row and emits `project.status_changed`.

## 8.2 Daily site reporting

```
SITE ENGINEER (field app, offline)
  │ 08:00  opens app — today's package, work fronts, open tasks loaded from local DB
  │ 08:00–17:00  captures work as it happens; each entry writes to the local op-log
  │ 17:30  submits DSR → status LOCAL_QUEUED (never blocks on network)
  ▼
DEVICE SYNC (§10)
  │ on any connectivity: push op-log → /sync/push with clientOpId
  │ photos upload separately via presigned S3 URLs, resumable
  ▼
SERVER INGEST
  │ idempotency check on clientOpId → duplicate returns 200 with the original record
  │ validation: chainage within package bounds · BOQ item belongs to contract
  │             · deviation limit check · date not future · duplicate-day check
  │ on pass → con.daily_site_report (status = submitted) + con.measurement rows
  │ on fail → sync.operation status = rejected, with a human-readable reason
  ▼
PIU REVIEW  (Dy.CPM / CPM, next working morning)
  │ review queue sorted by package, oldest first
  │ ACCEPT  → measurements become 'approved', eligible for billing
  │ REJECT  → reason returned to the device; engineer sees it in "Need attention"
  ▼
DERIVED UPDATES (single transaction)
  │ BOQ executed qty (view) → package progress → project progress → portfolio KPI
  │ hindrance row → delay model feature store
  │ alert if: target shortfall > 25% for 3 consecutive days
  │        or hindrance recurring ≥ 5 days with the same cause
```

**Non-negotiable:** a DSR is never lost because the network was down, and never silently altered after submission. Corrections are new entries referencing the original.

## 8.3 Contractor billing (RA bill)

```
CONTRACTOR PM                     RVNL SITE ENGINEER            PIU / FINANCE
     │                                    │                           │
     │ 1. Request joint measurement       │                           │
     ├───────────────────────────────────►│                           │
     │                                    │ 2. Joint measurement at   │
     │                                    │    site; MB entry created │
     │                                    │    (append-only, signed   │
     │◄───────────────────────────────────┤    by both parties)       │
     │                                    │                           │
     │ 3. Raise RA Bill against APPROVED  │                           │
     │    measurements only               │                           │
     ├────────────────────────────────────┴──────────────────────────►│
     │                                                                 │ 4. Check:
     │                                                                 │  • qty ≤ approved MB
     │                                                                 │  • rate = BOQ rate
     │                                                                 │  • deviation ≤ 125%
     │                                                                 │  • PVC per index
     │                                                                 │  • deductions:
     │                                                                 │    SD 6% · IT TDS
     │                                                                 │    · GST TDS
     │                                                                 │    · labour cess 1%
     │                                                                 │    · mobilisation
     │                                                                 │      recovery · LD
     │                                                                 ▼
     │                                              5. APPROVAL CHAIN (per DoP)
     │                                                 Dy.CPM → CPM → [Regional] → [HQ Finance]
     │                                                 threshold-driven; each step DSC-signed
     │                                                                 │
     │                                              6. CERTIFIED → payment advice → PFMS
     │◄────────────────────────────────────────────────────────────────┤
     │ 7. Payment status visible in portal with UTR/PFMS reference     │
```

**Controls enforced by the system, not by discipline:**

- A bill line cannot exceed the approved measured quantity for that BOQ item (`qty_upto_date ≤ Σ approved measurements`).
- Rates are read from `con.boq_item`, never entered on the bill.
- Cumulative execution beyond **125%** of a contracted item quantity hard-blocks with `DEVIATION_LIMIT` (§7.1) until a variation order is approved; a soft warning fires at 115%.
- Non-schedule items require a rate analysis document and an explicit HQ approval before they can be billed.
- **Separation of duties:** the certifying officer and the payment-releasing officer are always different users; the system rejects the second action by the same `sub`.
- Every state change appends to the hash-chained audit log with the signer's identity.

## 8.4 Procurement lifecycle

```
PACKAGING DECISION ─► ESTIMATE (USSOR-based) ─► TENDER APPROVAL (per DoP)
        │
        ▼
NIT PUBLISHED (IREPS / GeM / CPP portal)  ── platform mirrors state, one-way
        │
        ▼
PRE-BID MEETING ─► CORRIGENDA (if any) ─► BID SUBMISSION CLOSES
        │
        ▼
TECHNICAL BID OPENING (packet 1)
        │  eligibility: turnover · similar-work experience · bid capacity
        │  · RDSO approval where applicable · blacklist check
        ▼
TECHNICAL EVALUATION ─► responsive bidders shortlisted
        │
        ▼
FINANCIAL BID OPENING (packet 2)  ─► [REVERSE AUCTION, if applicable]
        │
        ▼
L1 DETERMINATION ─► rate reasonableness vs estimate
        │           (variance beyond ±10% requires recorded justification)
        ▼
AWARD APPROVAL (DoP: CPM → Regional → HQ → Board, by value)
        │
        ▼
LOA ISSUED ─► PERFORMANCE GUARANTEE (3%) ─► AGREEMENT SIGNED
        │
        ▼
CONTRACT ACTIVE ─► BOQ imported ─► package linked ─► mobilisation advance (if any)
```

Tracked cycle times — `NIT → opening`, `opening → LOA`, `LOA → agreement`, `agreement → mobilisation`. These four numbers predict award slippage better than any subjective assessment, and they are the input to the procurement panel on the executive dashboard.

## 8.5 Multi-level approvals (Delegation of Powers)

A single generic engine (`apr.approval_request` / `apr.approval_step`) serves every approvable entity. The required chain is computed from **entity type × amount × project category**:

| Entity | Site | PIU (CPM) | Regional | HQ | Ministry |
|---|---|---|---|---|---|
| DSR | submit | approve | — | — | — |
| Measurement / MB | record | approve | — | — | — |
| RA bill ≤ ₹50 L | — | approve | — | — | — |
| RA bill ₹50 L – ₹5 Cr | — | recommend | approve | — | — |
| RA bill > ₹5 Cr | — | recommend | recommend | approve | — |
| Variation ≤ 5% of contract | — | approve | — | — | — |
| Variation 5–25% | — | recommend | recommend | approve | — |
| Variation > 25% | — | recommend | recommend | recommend | approve |
| EOT | — | recommend | approve | — | — |
| Tender award ≤ ₹10 Cr | — | approve | — | — | — |
| Tender award > ₹100 Cr | — | recommend | recommend | recommend | approve |
| Rebaseline | — | recommend | recommend | approve | — |
| DPR / revised estimate | — | recommend | recommend | recommend | approve |

**Engine rules.** Steps are strictly sequential; parallel consultation is modelled as a non-blocking "FYI" step. Any step may **return** (not reject) with remarks, sending it back to the raiser with the chain intact. Delegation is time-boxed and recorded — the acting officer's identity and the delegation instrument both appear in the audit trail. SLA per level (default 7 working days) with auto-escalation to the next level's inbox and an alert on breach. Approvals above ₹5 Cr require a **DSC/eSign signature**, and the signed PDF hash is written to the audit chain.

## 8.6 Land acquisition

```
ALIGNMENT FINALISED ─► LAND PLAN SCHEDULE (village-wise, survey-number-wise)
        │
        ▼
§20A NOTIFICATION (Railways Act 1989) ─► objections window (30 days)
        │
        ▼
OBJECTIONS HEARD ─► §20E DECLARATION of acquisition
        │
        ▼
§20F COMPENSATION AWARD by Competent Authority
        │
        ├─► ACCEPTED ─► compensation paid ─► POSSESSION TAKEN ─► handed to contractor
        │
        └─► DISPUTED ─► arbitration / court ─► [COURT STAY] ─► resolution
                                                    │
                                                    ▼
                                          alignment realignment
                                          or land substitution
```

Each parcel's state drives the **blocked-km** figure by geometry: `ST_Length` of alignment intersecting parcels not in `possession_taken`. That is a computed fact, not an estimate, and it is the number that appears on the executive dashboard. A parcel entering `disputed` or `court_stay` automatically raises a risk with category `land` and an exposure derived from the affected package value.

## 8.7 Compliance & clearance approvals

```
CLEARANCE IDENTIFIED (at DPR stage, from alignment intersection analysis)
        │  forest boundary crossed?  sanctuary within 10 km?  EC threshold met?
        ▼
APPLICATION PREPARED ─► submitted (PARIVESH / authority portal)
        │
        ▼
UNDER PROCESS ──► QUERY RAISED ──► response submitted ──┐
        │              ▲                                 │
        │              └─────────────────────────────────┘
        ▼
GRANTED  ─► CONDITIONS IMPOSED (n conditions, each tracked to closure)
        │
        ├─► condition evidence uploaded → verified → closed
        └─► condition overdue → alert → risk raised
        │
        ▼
FULLY COMPLIANT  (all conditions closed)   ── only now is the clearance "done"
```

A clearance in `granted` with open conditions renders as `.status-chip-warning`, never green. The distinction between "granted" and "complied" is exactly what CAG audits look for, and the UI never blurs it.

---

# §9 · REAL-TIME & AI FEATURES

## 9.1 Alert system

Alerts are emitted by rules evaluated on domain events and on a nightly batch. They reuse the **existing** alert shape from [`socket.js`](../src/services/socket.js) — `{ alertId, type, category, title, message, zone, assetId, acknowledged, createdAt }` — so `AlertPanel` needs no change.

| Rule | Trigger | Type | Category |
|---|---|---|---|
| Milestone slip imminent | Predicted finish > baseline + 15 d, ≥ 30 d before planned finish | warning | schedule |
| Milestone slipped | `actual_finish > baseline_finish` | critical | schedule |
| Progress stalled | No DSR for a package for 5 working days | warning | schedule |
| Deviation approaching limit | Item executed > 115% of contracted | warning | contract |
| Deviation breached | Item executed > 125% without variation | critical | contract |
| Budget burn anomaly | FYTD burn < 50% of pro-rata with < 90 d left in FY | critical | cost |
| Bill ageing | RA bill in `under_check` > 21 days | warning | cost |
| Clearance SLA breach | `days_pending > sla_days` | critical | clearance |
| Clearance condition overdue | Condition past due date | warning | clearance |
| Land dispute | Parcel → `disputed` / `court_stay` | critical | land |
| Blocked km rising | Blocked km up > 2 km week-on-week | warning | land |
| Safety incident | Any reportable incident | critical | safety |
| NCR ageing | NCR open > 30 days | warning | quality |
| Block conflict | Two block requests overlap on a section | warning | schedule |
| Contractor risk | CPI drops below 60, or PG expiring < 30 d | warning | contract |
| Sync stale | Device with queued ops and no contact > 72 h | info | schedule |

Delivery: WebSocket push (in-app), plus email/SMS for `critical` per `mon.subscription`. Alerts deduplicate on `(assetId, category, title)` — the existing `dedupeAlerts` in `AlertPanel` already does this client-side; the server does it authoritatively.

## 9.2 AI advisory insights

Advisories use the **frozen** shape already consumed by `AdvisoryPanel`: `{ advisoryId, priority, title, template, rootCause: { primary, contributing, systemic }, evidence[], recommendations[], impact }`. The three-level root cause is the valuable part — it separates *what happened* from *why it keeps happening*, which is what a CPM actually needs.

```json
{
  "advisoryId": "ADV-DLY-114",
  "priority": "high",
  "title": "Package 4 tunnelling will miss its Dec-2026 milestone by an estimated 84 days",
  "template": "delay_cluster",
  "rootCause": {
    "primary": "Heading advance at T-8 south portal has averaged 42 m/month against a planned 78 m/month for 5 consecutive months. At the current rate the remaining 3,180 m needs 76 months, not the 41 months in the plan.",
    "contributing": "Class-IV/V rock encountered from ch. 143+820 was not anticipated in the DPR geological profile; support type changed to heavy steel ribs, adding ~9 days per 100 m. Two of four drill jumbos have been unavailable since May.",
    "systemic": "Geological risk was carried at DPR-stage confidence into the contract programme without a contingency band. Packages with tunnel length > 5 km show the same pattern across 4 of 6 RVNL hill projects — the planning norm for hard-rock advance rate needs revision, not just this schedule."
  },
  "evidence": [
    "Advance rate 42 m/month vs 78 planned — 5-month rolling average",
    "Support type changed to Class-IV from ch. 143+820 (DSR 2026-03-14)",
    "Jumbo JB-02, JB-04 idle 61 and 48 days YTD (plant register)",
    "Comparable: RVNL/NR/2016/NL/07 T-5, T-6 slipped 71 and 96 days on the same cause"
  ],
  "recommendations": [
    "Approve second heading from the north portal — recovers an estimated 40–50 days",
    "Escalate jumbo availability to the contractor under clause 39 (resource deployment)",
    "Re-baseline Package 4 milestones M7–M9 and revise the DPR geological contingency",
    "Apply the revised hard-rock advance norm to the 3 tunnel packages still at tender stage"
  ],
  "impact": -12
}
```

Generation is grounded: the model may only cite records that exist (DSR entries, plant logs, measurements, comparable projects). Every advisory carries the record IDs behind each evidence line, and the panel links to them. **Nothing is generated without a citation**, which is what makes the output usable in a government review.

## 9.3 Delay prediction

| Aspect | Design |
|---|---|
| Target | Days of slip vs baseline at milestone completion |
| Model | Gradient-boosted regression (XGBoost) for the point estimate + quantile models at P10/P50/P90 for the band |
| Horizon | Retrained monthly; scored nightly |
| Features | Rolling progress rate vs plan (4/8/12 wk) · hindrance-days by cause (last 90 d) · DSR submission regularity · manpower & plant deployment vs commitment · blocked km on the work front · open clearance count and ageing · contractor CPI · monsoon-season flag by district · terrain class · milestone type · historical slip on comparable packages |
| Cold start | Until ~2 full FYs of history exist, fall back to a transparent rules-based estimate (rate extrapolation + hindrance adjustment). **Ship the rules version first** — it is explainable, and explainability matters more than accuracy in a PSU review setting. |
| Output | `predictedFinish`, `slipDays`, `confidence`, and the top 3 contributing features — surfaced on the milestone Gantt as a dashed forecast bar (slot-4 violet, per §0.5) |

## 9.4 Cost overrun prediction

Projected Cost at Completion, computed at package level and rolled up:

```
PCC = billed_to_date
    + (remaining_qty × current_rate × pvc_index_projection)
    + expected_variation_amount
    + (delay_days × time_related_cost_per_day)
    + open_risk_exposure × risk_probability
```

Flags: `PCC > sanctioned_cost × 1.05` → warning; `> 1.20` → critical, with the driver decomposed (quantity growth vs price variation vs time-related vs variation orders). Because every term is a real, auditable number rather than a model output, a Director can defend it in a Board review — which is the actual requirement.

## 9.5 GIS digital twin (optional, Phase 3)

The `three` dependency already present supports a corridor 3D view: terrain from DEM (Cartosat/SRTM), the alignment as a 3D polyline with gradient and curvature, structures as parametric solids (tunnel bores, bridge spans, station volumes), progress rendered as material state along the corridor, and a time slider replaying construction from DSR history. Value beyond a good 2D map is limited to tunnel/viaduct-heavy projects and Board presentations — so it is explicitly Phase 3, after the fundamentals earn their keep.

## 9.6 Project Assistant (RAG)

Grounded question-answering over the project corpus — DPRs, GADs, contract agreements, GCC clauses, IRS/RDSO specifications, correspondence, and the live transactional record.

- **Retrieval:** hybrid — `pgvector` embeddings over chunked documents plus PostgreSQL full-text (OCR'd scans included), re-ranked, then merged with structured facts pulled from the API layer under the caller's own permissions.
- **Permission-aware:** retrieval runs with the caller's scope. A contractor asking about rates gets their own contract only. This is enforced at retrieval, not by prompting.
- **Always cited:** every answer names the document, version, page or the record ID. Uncited claims are suppressed rather than shown.
- **Typical questions:** "What does the contract say about price variation for cement in Package 4?" · "Which packages in SER have forest clearance pending beyond 180 days?" · "Show earthwork executed vs contracted at Rishikesh–Karnaprayag by work head."
- Reuses the existing `/assistant` chat page pattern.

---

# §10 · OFFLINE-FIRST DESIGN

## 10.1 Why this is the make-or-break requirement

A tunnel portal in Uttarakhand, an embankment in Bastar, a bridge site in the Northeast — these have intermittent 2G at best. Any system requiring connectivity to record work will be bypassed within a month, and the platform's entire data foundation collapses with it. **Offline is not a feature here; it is the precondition for the data being real.**

## 10.2 Local storage architecture (field app)

```
┌────────────────────────────────────────────────────────┐
│                     FIELD APP                           │
├────────────────────────────────────────────────────────┤
│  UI  — reads ONLY from the local store, never the network│
├────────────────────────────────────────────────────────┤
│  LOCAL STORE (SQLite via Drift/WatermelonDB)            │
│   • reference data  (BOQ items, packages, work fronts,  │
│     chainage markers, users)  — pull-only, versioned    │
│   • my records      (DSRs, measurements, observations)  │
│   • op-log          (append-only, ordered, idempotent)  │
│   • media queue     (photo paths + upload state)        │
│   • map pack        (clipped MBTiles for my package)    │
├────────────────────────────────────────────────────────┤
│  SYNC ENGINE — background, opportunistic, resumable     │
└────────────────────────────────────────────────────────┘
```

Every user action writes an **op-log entry first**, then updates the local view. The UI never awaits the network. Op-log entries carry a device-generated `clientOpId` (UUIDv4) that is the idempotency key end to end.

Local storage budget: reference data ~15 MB per package; map pack ~80 MB; photos capped at 500 MB with oldest-synced eviction. Photos compress to ~200 KB client-side before queueing — a 12-photo DSR is ~2.4 MB, tolerable on 2G.

## 10.3 Sync protocol

```
PULL (reference + my records)
  GET /sync/pull?since=<serverCursor>&scope=package:1c9e
  → { changes:[…], deletions:[…], cursor:"…", serverTime:"…" }
  Cursor-based, not timestamp-based — immune to device clock skew.

PUSH (op-log)
  POST /sync/push
  { deviceId, ops:[ { clientOpId, entityType, op, payload, baseVersion, capturedAt }, … ] }
  → { results:[ { clientOpId, status:"applied"|"duplicate"|"conflict"|"rejected",
                  serverId, serverVersion, reason } ] }
  Ops apply in captured order, in one transaction per op. A rejected op never
  blocks the ops behind it.

MEDIA
  POST /sync/media/presign → { uploadUrl, storageKey }
  PUT direct to S3, resumable, chunked. The DSR references storageKey;
  the record is valid before its photos land, and photos attach on arrival.
```

Sync triggers: on connectivity regained, on app foreground, every 15 min while connected, on manual pull-to-refresh, and after each DSR submission. Backoff on failure: 30s → 2m → 10m → 30m → hourly.

## 10.4 Conflict resolution

Resolution is **per entity type**, chosen by what is safe for that data — never a blanket "last write wins".

| Entity | Strategy | Rationale |
|---|---|---|
| **Measurement / MB entry** | **Append-only, no conflict possible** | Every entry is a new immutable row. Two engineers measuring the same item produce two entries; both are retained and reviewed. Corrections are reversal entries. |
| **DSR** | Unique on `(package, date, submitter)`. Second submission for the same key → `conflict`, surfaced to the submitter to merge or discard. | A day's report is a single statement of fact by one person. |
| **Site photos** | Append-only | Media never conflicts. |
| **Task status** | Last-write-wins on `capturedAt`, with the loser retained in history | Low-stakes, and the history preserves the trail. |
| **Reference data** (BOQ, packages, rates) | **Server always wins**, pull-only | The device may never author a rate or a BOQ item. |
| **Approvals, bills, contracts** | **Server-authoritative, online-only** | These are money and legal state. They are never authored offline, by design. |
| **Risk / issue updates** | Field-level merge; concurrent edits to different fields both apply; same-field conflict → manual | Collaborative text; the losing version is kept and shown. |

**Conflicts are never silently resolved.** A conflicted op moves to `status = conflict`, the device shows it in "**Need attention**" on the sync bar (`--app-danger`, per §3.C), and the user sees both versions side by side with an explicit choice. Silent resolution on a government record is a defect, not a convenience.

**Clock skew:** `capturedAt` is the device clock and is retained for provenance, but ordering and cursors use server time. On push, a device clock more than 5 minutes off is recorded on the op and flagged to the reviewer, since it affects the credibility of a timestamped measurement.

## 10.5 Web offline (secondary)

The React SPA gets a service worker with a cached app shell, cached last-viewed dashboards (read-only, with a visible "as of" stamp), and an offline queue for lightweight actions (acknowledge alert, add remark). Heavy authoring stays online-only on the web — the field app is the offline surface.

---

# §11 · TECHNOLOGY STACK

| Layer | Choice | Reasoning |
|---|---|---|
| **Web frontend** | React 18 + React Router 6, Tailwind + CSS custom properties, Chart.js via `react-chartjs-2`, Leaflet via `react-leaflet`, `three` for the optional twin | **Already the template's stack** — [`package.json`](../package.json). No migration, no design-system drift. |
| **Mobile (field)** | **Flutter** | Better offline story than RN for this use case: mature SQLite (Drift), reliable background isolates for sync, consistent camera/GPS behaviour on the low-end Android devices actually used at site, and single-binary distribution. RN is viable if RVNL wants React skill reuse — but the offline engine is the hard part, and Flutter's is stronger. |
| **Backend** | **Node.js 20 + NestJS + TypeScript** | Modular monolith with first-class module boundaries and DI, which is exactly the §4 architecture. Shares TypeScript types with the React client. Large Indian talent pool for PSU staffing/AMC. *(Java/Spring Boot is an equally defensible choice if RVNL's IT policy standardises on Java — the architecture is unchanged.)* |
| **Intelligence** | Python 3.11 + FastAPI, XGBoost/scikit-learn, `pgvector` | Separate deployable (§4.1). |
| **Database** | **PostgreSQL 15 + PostGIS 3**, primary + read replica | Spatial and relational in one engine; linear referencing, RLS, JSONB, full-text and vector search all native. No second datastore to reconcile. |
| **Cache / queue** | **Redis 7** | Session, rate limiting, tile cache, job queue (BullMQ), and Streams as the phase-1 event bus. |
| **Messaging** | **Redis Streams → Kafka** | Start on Streams via the outbox pattern; the publisher interface is abstracted, so the Kafka move is a configuration change, not a rewrite. Kafka is justified only at multi-region or high-volume telemetry scale. |
| **Object storage** | S3-compatible — AWS S3 (Mumbai/Hyderabad) or **MinIO** on-prem | Versioning + SSE-KMS + lifecycle. MinIO keeps the on-prem/MeghRaj option open with an identical API. |
| **Search** | PostgreSQL FTS + `pg_trgm` + `pgvector` | Adequate at this corpus size. Do not add Elasticsearch until it is demonstrably needed. |
| **Auth** | Keycloak (OIDC) | SSO, MFA, LDAP/AD federation for RVNL staff, separate realm for contractors, DSC/eSign integration. |
| **Cloud** | **AWS India (ap-south-1 Mumbai, DR ap-south-2 Hyderabad)** or Azure India (Central/South) — MeitY-empanelled; **on-prem/MeghRaj deployable** via containers | Data residency is mandatory. The architecture stays portable: containers + PostgreSQL + S3-API, nothing cloud-proprietary in the core. |
| **Deploy** | Docker + ECS/AKS (or Kubernetes on-prem); GitHub Actions or GitLab CI; Terraform | Blue-green for the core; rolling for stateless services. |
| **Observability** | OpenTelemetry → Prometheus + Grafana; Loki logs; Sentry | Trace IDs propagate to the client for support. |
| **Maps** | Leaflet + self-hosted tiles; Bhuvan/ISRO imagery; Survey of India where licensed | Self-hosted tiles remove the external dependency and work behind a government firewall. |

**Explicitly not chosen:** GraphQL (REST + a typed client is enough here, and REST audits better), Elasticsearch (premature), Kubernetes at launch (operational cost exceeds benefit at this scale), microservices (§4.1), MongoDB (the domain is deeply relational — money, quantities and approvals need constraints and transactions).

---

# §12 · NON-FUNCTIONAL REQUIREMENTS

## 12.1 Security

| Control | Requirement |
|---|---|
| Transport | TLS 1.3 minimum; HSTS; certificate pinning in the mobile app |
| At rest | AES-256 — RDS/PostgreSQL TDE, S3 SSE-KMS, SQLCipher on the device |
| Auth | OIDC via Keycloak; 15-min access / 8-h refresh tokens; **MFA mandatory** for HQ_EXEC, HQ_FINANCE, RVNL_ADMIN, AUDITOR |
| Authorization | RBAC + ABAC (§7.5), enforced in the service layer **and** by PostgreSQL RLS |
| Digital signature | DSC (Class-3) / Aadhaar eSign for approvals above ₹5 Cr, tender awards, and final bills |
| Secrets | AWS Secrets Manager / HashiCorp Vault; no secret in code or environment files |
| Input | Parameterised queries only; schema validation on every endpoint; strict file-type and size validation on upload with server-side content sniffing |
| Uploads | Antivirus scan before the object becomes retrievable; documents served only via short-lived signed URLs |
| Contractor isolation | Separate Keycloak realm; RLS-enforced tenant predicate; no cross-contractor visibility of rates, bids or scores |
| Compliance | CERT-In directions (log retention, incident reporting within 6 hours); IT Act 2000; DPDP Act 2023 for personal data (land-owner compensation records are personal data and are access-restricted accordingly) |
| Testing | VAPT before go-live and annually; dependency scanning in CI; STQC certification if mandated |

## 12.2 Audit logging — mandatory

Non-negotiable, and treated as a core feature rather than infrastructure:

- **Every** state-changing operation writes `aud.audit_log` in the **same transaction** as the change. A business write that cannot log does not commit.
- Captured: actor, role, IP, action, entity, before/after JSONB, reason, timestamp.
- **Hash-chained** (`prev_hash` → `hash`, §6.7): any tampering with a historical row breaks the chain and is detectable. A nightly verification job walks the chain and alerts on any break.
- **Append-only** at the database level — `UPDATE`/`DELETE` rules make modification a no-op, and the application role holds `INSERT`-only grants on the schema.
- Read access is itself logged for sensitive entities (bills, rates, compensation, bid documents) — CAG and CVC ask who *looked*, not only who changed.
- Retention: **permanent**. Exportable per entity with full lineage in a single query.
- The `/audit` console reconstructs any entity's complete history — every approval, every rate, every quantity, with the signer, in chronological order.

## 12.3 Reliability

| Requirement | Target |
|---|---|
| Availability | **99.5%** business hours (07:00–22:00 IST); 99.0% overall |
| RPO | 15 minutes (continuous WAL archiving) |
| RTO | 4 hours (warm standby in the DR region) |
| Backups | Automated daily full + WAL; 35-day point-in-time recovery; **quarterly restore drill, tested, not assumed** |
| DR | Cross-region replica; documented and rehearsed failover |
| Graceful degradation | GIS or Intelligence service down → dashboards render without maps/forecasts and say so, rather than failing |
| Field app | Fully functional offline indefinitely; no server dependency for capture |
| Data integrity | FK constraints and CHECKs enforced in the database, not only in the application |

## 12.4 Performance

Sized for **10–100 concurrent users initially**, with headroom to ~500.

| Operation | Target (p95) |
|---|---|
| Dashboard load (KPI + panels) | < 1.5 s |
| Project detail | < 1.0 s |
| List/table query (25 rows, filtered) | < 500 ms |
| Map tile | < 300 ms (cached < 50 ms) |
| Alignment GeoJSON (125 km, simplified) | < 800 ms |
| DSR submit (online) | < 2 s |
| Sync push (50 ops) | < 5 s on 2G |
| Report generation (MPR) | < 30 s, async with notification |
| Field app cold start (offline) | < 3 s |

Techniques: materialised KPI snapshots refreshed on write and nightly (dashboards never aggregate the full transaction history at request time); read replica for all dashboard, GIS and report queries; Redis caching with a 5-minute TTL on portfolio aggregates; cursor pagination on large lists; virtualised tables past 100 rows; geometry simplification by zoom; `Content-Encoding: br` on API responses.

## 12.5 Scalability

| Dimension | Launch | Design ceiling | Path |
|---|---|---|---|
| Concurrent users | 100 | 2,000 | Horizontal core replicas behind the load balancer; Redis-backed sessions |
| Named users | 500 | 10,000 | — |
| Projects | 184 | 1,000 | Partition `con.measurement` and `aud.audit_log` by year |
| Measurements | ~2 M/yr | 50 M | Declarative range partitioning |
| Documents | 500 GB | 20 TB | S3 scales; lifecycle to infrequent-access after 2 years |
| Photos | ~1 M/yr | 20 M | Prefixed by project/month; CDN for thumbnails |
| Concurrent devices syncing | 200 | 3,000 | Sync service scales independently (§4.1) |

Scale-out order when needed: (1) read replicas, (2) partition the hot tables, (3) horizontally scale the sync and GIS services, (4) extract Finance or Construction into a true service — the module boundaries already permit it.

## 12.6 Usability & accessibility

- **Accessibility:** WCAG 2.1 AA. Chart palettes are colour-vision-validated (§0.5), status is never colour-alone (chip + icon + label), all interactive elements are keyboard-reachable, and every chart has a table view.
- **Language:** English at launch; Hindi for the field app in Phase 2 (labels externalised from day one). Devanagari must render correctly in village and district names throughout — including in PDF exports, which is where it usually breaks.
- **Low-end devices:** the field app targets Android 8+ on 2 GB RAM.
- **Training load:** a site engineer should complete their first DSR without training. That is the acceptance bar for §3.C.

---

# §13 · DELIVERY ROADMAP

| Phase | Duration | Scope | Proves |
|---|---|---|---|
| **0 — Foundation** | 6 wk | Auth/RBAC, project & package master, design-system port (nav, dashboard shell, KPI cards, palette fix), audit log skeleton | The shell and the security model |
| **1 — Field truth** | 10 wk | BOQ import, digital MB, DSR (web + Flutter offline), sync engine, conflict handling, progress derivation, project dashboard | **The hardest and most valuable part** — real progress data from real sites |
| **2 — Money** | 10 wk | RA billing, deductions, PVC, variation & deviation control, approval engine with DoP, PFMS integration, finance dashboard | Financial control and the approval chain |
| **3 — Corridor** | 8 wk | GIS service, alignment & linear referencing, land parcels with §20 tracking, blocked-km, clearance register with conditions, map page | Land and clearance visibility — the top delay drivers |
| **4 — Portfolio** | 8 wk | Executive dashboard, risk register & heatmap, contractor performance index, procurement pipeline, MPR/board reporting | HQ and Ministry-facing value |
| **5 — Intelligence** | 10 wk | Alert engine, advisory generation, delay & cost models, RAG assistant, digital twin (optional) | Prediction, once there is history to learn from |

**Sequencing rationale.** Phase 1 comes before everything because every downstream number — progress, billing, prediction, portfolio health — is derived from site measurements. Build the intelligence layer first and it learns from the same unreliable self-declared percentages the platform exists to replace.

---

## Blueprint index

| Part | Contents |
|---|---|
| [`01-PRODUCT-AND-UI.md`](01-PRODUCT-AND-UI.md) | §0 Design System Contract · §1 Product Overview · §2 Information Architecture · §3 Dashboard Design |
| [`02-ARCHITECTURE-AND-DATA.md`](02-ARCHITECTURE-AND-DATA.md) | §4 System Architecture · §5 Core Modules · §6 Data Model · §7 API Design |
| **`03-WORKFLOWS-AND-PLATFORM.md`** | §8 Workflows · §9 Real-time & AI · §10 Offline-First · §11 Stack · §12 NFRs · §13 Roadmap |
