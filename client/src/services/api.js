/* ═══════════════════════════════════════════════════════════════════════════
   API layer — implements the §7 REST contract of the RVNL blueprint against
   the local dataset. Every function returns a Promise resolving to the
   documented envelope { data, meta, links }. Replace the bodies with fetch()
   calls to the real backend and no page component needs to change.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  PROJECTS, PACKAGES, BOQ_ITEMS, MILESTONES, LAND_PARCELS,
  CLEARANCE_CONDITIONS, TENDERS, CONTRACTORS, DOCUMENTS, SAFETY_EVENTS,
  PLANT, MANPOWER, STRUCTURES, ZONES, PIUS, SITE_CREWS, WORK_ITEMS,
  portfolioStats, budgetByZone, sCurve, riskHeatmap, bottlenecks,
  progressByWorkHead, chainageSegments, landSummary,
  getProject, packagesFor, milestonesFor, landFor,
  boqFor, conditionsFor, structuresFor,
  alignmentSegments, corridorOverview, milestoneMarkers, crewsFor,
  TODAY, CURRENT_FY, daysAgo } from '../data/rvnlData';

import {
  getState, currentUser,
  effectiveAlerts, effectiveDsrs, effectiveBills, effectiveApprovals,
  effectiveRisks, effectiveClearances, effectiveNcrs, effectiveAudit,
  effectiveSitePhotos,
  acknowledgeAlertLocal, acknowledgeAllAlerts, submitDsr, reviewDsr,
  actOnBill, actOnApproval, updateRisk, advanceClearance, closeNcr,
  submitSitePhoto, reviewSitePhoto } from './store';

/* ─── Simulated latency so loading states are real ───────────────────────── */
const LATENCY = 140;
const wait = (ms = LATENCY) => new Promise(r => setTimeout(r, ms));

function envelope(data, meta = {}) {
  return {
    data,
    meta: { generatedAt: new Date().toISOString(), scope: { zone: getState().zone }, ...meta } };
}

function paginate(rows, { page = 1, pageSize = 25 } = {}) {
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  return {
    rows: rows.slice((p - 1) * pageSize, p * pageSize),
    meta: { page: p, pageSize, totalItems, totalPages } };
}

/* ─── Scope: role + zone filter applied to every project-bearing query ───── */
export function scopedProjects(zoneOverride) {
  const st = getState();
  const user = currentUser();
  const zone = zoneOverride || st.zone;
  let rows = PROJECTS;
  if (user.role === 'PIU_CPM' && user.piuId) rows = rows.filter(p => p.piuId === user.piuId);
  else if (user.role === 'SITE_ENGINEER' && user.piuId) rows = rows.filter(p => p.piuId === user.piuId);
  else if (user.role === 'REGIONAL_HEAD' && user.zone) rows = rows.filter(p => p.zone === user.zone);
  else if (user.role === 'CONTRACTOR_PM' && user.contractorId) {
    const ids = new Set(PACKAGES.filter(k => k.contractorId === user.contractorId).map(k => k.projectId));
    rows = rows.filter(p => ids.has(p.id));
  }
  if (zone && zone !== 'ALL') rows = rows.filter(p => p.zone === zone);
  return rows;
}

const inScope = (rows, key = 'projectId') => {
  const ids = new Set(scopedProjects().map(p => p.id));
  return rows.filter(r => ids.has(r[key]));
};

function applyFilters(rows, filters = {}) {
  let out = rows;
  Object.entries(filters).forEach(([k, v]) => {
    if (v == null || v === '' || v === 'all' || v === 'ALL') return;
    if (Array.isArray(v)) { if (v.length) out = out.filter(r => v.includes(r[k])); return; }
    out = out.filter(r => String(r[k]) === String(v));
  });
  return out;
}

function applySearch(rows, q, fields) {
  if (!q) return rows;
  const needle = q.toLowerCase();
  return rows.filter(r => fields.some(f => String(r[f] ?? '').toLowerCase().includes(needle)));
}

function applySort(rows, sort) {
  if (!sort) return rows;
  const desc = sort.startsWith('-');
  const key = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => {
    const x = a[key], y = b[key];
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return desc ? -c : c;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARDS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getExecutiveDashboard(params = {}) {
  await wait();
  const projects = scopedProjects(params.zone);
  const stats = portfolioStats(projects);
  const ids = new Set(projects.map(p => p.id));

  const attention = projects
    .filter(p => p.status === 'under_execution')
    .sort((a, b) => a.variance - b.variance)
    .slice(0, 8)
    .map(p => ({
      id: p.id, code: p.code, name: p.name, zone: p.zone, piuName: p.piuName,
      physicalProgress: p.physicalProgress, plannedPhysical: p.plannedPhysical,
      variance: p.variance, expenditure: p.expenditure, latestEstimate: p.latestEstimate,
      health: p.health, slipMonths: p.slipMonths }));

  const corridors = corridorOverview(projects);
  const totalKm = corridors.reduce((a, c) => a + c.lengthKm, 0);
  const doneKm = corridors.reduce((a, c) => a + (c.lengthKm * c.physicalProgress) / 100, 0);

  return envelope({
    stats,
    budgetByZone: budgetByZone(projects),
    sCurve: sCurve(projects),
    riskHeatmap: riskHeatmap(effectiveRisks().filter(r => ids.has(r.projectId) && r.status !== 'closed')),
    bottlenecks: bottlenecks(projects),
    attention,
    corridors,
    buildOut: {
      totalKm: Math.round(totalKm),
      doneKm: Math.round(doneKm),
      balanceKm: Math.round(totalKm - doneKm),
      blockedKm: stats.land.blockedKm,
      crewsOnSite: SITE_CREWS.filter(c => ids.has(c.projectId) && c.status === 'on_site').length,
      evidenceToday: effectiveSitePhotos().filter(p => ids.has(p.projectId) && p.minsAgo <= 1440).length,
    },
    fy: CURRENT_FY });
}

export async function getProjectDashboard(projectId) {
  await wait();
  const project = getProject(projectId);
  if (!project) throw notFound('project', projectId);
  const packages = packagesFor(projectId);
  const milestones = milestonesFor(projectId);
  const parcels = landFor(projectId);
  const clearances = effectiveClearances().filter(c => c.projectId === projectId);
  const risks = effectiveRisks().filter(r => r.projectId === projectId && r.status !== 'closed');
  const dsrs = effectiveDsrs().filter(d => d.projectId === projectId).slice(0, 12);
  const ncrs = effectiveNcrs().filter(n => n.projectId === projectId);

  return envelope({
    project,
    packages,
    milestones,
    workHeads: progressByWorkHead(projectId),
    chainage: chainageSegments(projectId),
    land: landSummary(parcels),
    clearances,
    risks,
    dsrs,
    structures: structuresFor(projectId),
    contractors: packages
      .filter(p => p.contractorId)
      .map(p => {
        const c = CONTRACTORS.find(x => x.id === p.contractorId);
        return { packageId: p.id, packageName: p.name, packageCode: p.code, ...c };
      }),
    ncrs: { open: ncrs.filter(n => n.status === 'open').length, total: ncrs.length, rows: ncrs.slice(0, 8) },
    milestoneStats: {
      total: milestones.length,
      completed: milestones.filter(m => m.status === 'completed').length,
      overdue: milestones.filter(m => m.status === 'overdue').length,
      inProgress: milestones.filter(m => m.status === 'in_progress').length,
      onTrack: milestones.filter(m => m.status !== 'overdue').length } });
}

export async function getFieldDashboard() {
  await wait(90);
  const st = getState();
  const user = currentUser();
  const pkgs = PACKAGES.filter(p => p.status === 'in_progress' && (!user.piuId || p.piuId === user.piuId));
  const myPackage = pkgs[0] || PACKAGES[0];
  const dsrs = effectiveDsrs().filter(d => d.packageId === myPackage?.id).slice(0, 10);
  const today = dsrs[0];

  const tasks = [
    { id: 't1', label: 'Cube test result — Pier P-14', due: 'Today', priority: 'high', done: false },
    { id: 't2', label: 'Block request 04:00–06:00 for girder launch', due: 'Today', priority: 'high', done: false },
    { id: 't3', label: 'NCR-2291 closure evidence upload', due: 'Tomorrow', priority: 'medium', done: false },
    { id: 't4', label: 'Joint measurement with contractor — EW-102', due: '30 Jul', priority: 'medium', done: false },
    { id: 't5', label: 'Safety toolbox talk record', due: '30 Jul', priority: 'low', done: true },
    { id: 't6', label: 'Weekly manpower return', due: '31 Jul', priority: 'low', done: false },
  ];

  return envelope({
    package: myPackage,
    project: getProject(myPackage?.projectId),
    today,
    dsrs,
    tasks,
    online: st.online,
    syncQueue: st.syncQueue,
    boq: boqFor(myPackage?.id).slice(0, 12),
    availablePackages: pkgs.slice(0, 12) });
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECTS / PACKAGES
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getProjects(params = {}) {
  await wait();
  let rows = scopedProjects(params.zone);
  rows = applyFilters(rows, { status: params.status, type: params.type, piuId: params.piuId, health: params.health });
  rows = applySearch(rows, params.q, ['name', 'code', 'piuName', 'zone']);
  rows = applySort(rows, params.sort || '-latestEstimate');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, { ...meta, totalValue: rows.reduce((s, p) => s + p.latestEstimate, 0) });
}

export async function getProjectById(id) {
  await wait();
  const p = getProject(id);
  if (!p) throw notFound('project', id);
  return envelope(p);
}

export async function getPackages(params = {}) {
  await wait();
  let rows = inScope(PACKAGES);
  rows = applyFilters(rows, { projectId: params.projectId, status: params.status, piuId: params.piuId, contractorId: params.contractorId });
  rows = applySearch(rows, params.q, ['code', 'name', 'projectName', 'contractorName', 'scope']);
  rows = applySort(rows, params.sort || '-awardedValue');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, meta);
}

export async function getBoq(params = {}) {
  await wait();
  let rows = params.packageId ? boqFor(params.packageId) : inScope(BOQ_ITEMS);
  rows = applyFilters(rows, { workHead: params.workHead });
  if (params.deviationOnly) rows = rows.filter(r => r.deviationFlag);
  rows = applySearch(rows, params.q, ['itemCode', 'description', 'ussorCode']);
  rows = applySort(rows, params.sort || '-amount');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, {
    ...meta,
    totals: {
      contractedValue: rows.reduce((s, r) => s + r.amount, 0),
      executedValue: rows.reduce((s, r) => s + r.amount * Math.min(r.executedPct, 100) / 100, 0),
      breached: rows.filter(r => r.deviationFlag === 'breached').length,
      approaching: rows.filter(r => r.deviationFlag === 'approaching').length } });
}

export async function getMilestones(params = {}) {
  await wait();
  let rows = params.projectId ? milestonesFor(params.projectId) : inScope(MILESTONES);
  rows = applyFilters(rows, { status: params.status, zone: params.zone });
  if (params.criticalOnly) rows = rows.filter(r => r.isCritical);
  rows = applySearch(rows, params.q, ['name', 'code', 'projectName']);
  rows = applySort(rows, params.sort || 'plannedFinish');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, {
    ...meta,
    stats: {
      total: rows.length,
      completed: rows.filter(r => r.status === 'completed').length,
      overdue: rows.filter(r => r.status === 'overdue').length,
      inProgress: rows.filter(r => r.status === 'in_progress').length,
      avgSlip: rows.length ? Math.round(rows.reduce((s, r) => s + Math.abs(r.slipDays), 0) / rows.length) : 0 } });
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTRUCTION / FIELD
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getDsrs(params = {}) {
  await wait();
  let rows = effectiveDsrs();
  const ids = new Set(scopedProjects().map(p => p.id));
  rows = rows.filter(d => ids.has(d.projectId));
  rows = applyFilters(rows, { status: params.status, packageId: params.packageId, projectId: params.projectId, hindranceType: params.hindranceType });
  rows = applySearch(rows, params.q, ['packageCode', 'projectName', 'submittedBy', 'narrative']);
  rows = applySort(rows, params.sort || '-reportDate');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, {
    ...meta,
    stats: {
      pendingReview: rows.filter(r => r.status === 'submitted').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
      withHindrance: rows.filter(r => r.hindranceType && r.hindranceType !== 'none').length,
      avgAchievement: rows.length ? parseFloat((rows.reduce((s, r) => s + (r.achievementPct || 0), 0) / rows.length).toFixed(1)) : 0 } });
}

export async function createDsr(payload) {
  await wait(220);
  const rec = submitDsr(payload);
  return envelope(rec, { idempotent: false, clientOpId: rec.clientOpId });
}

export async function reviewDsrById(id, action, remarks) {
  await wait(180);
  reviewDsr(id, action, remarks);
  return envelope({ id, status: action === 'accept' ? 'reviewed' : 'rejected' });
}

export async function getQuantityLedger(params = {}) {
  await wait();
  let rows = params.packageId ? boqFor(params.packageId) : inScope(BOQ_ITEMS);
  rows = rows.map(b => ({
    ...b,
    contractedValue: b.amount,
    executedValue: parseFloat((b.amount * Math.min(b.executedPct, 200) / 100).toFixed(2)),
    certifiedValue: parseFloat((b.rate * b.certifiedQty).toFixed(2)),
    balanceQty: parseFloat((b.contractedQty - b.executedQty).toFixed(2)) }));
  rows = applySort(rows, params.sort || '-executedValue');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, meta);
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINANCE / BILLING
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getFinanceSummary(params = {}) {
  await wait();
  const projects = scopedProjects(params.zone);
  const stats = portfolioStats(projects);
  const byZone = budgetByZone(projects);
  const bills = inScope(effectiveBills());

  const monthly = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const planCash = monthly.map((_, i) => Math.round(stats.totalEstimate * 0.02 * (1 + i * 0.09)));
  const actualCash = monthly.map((_, i) => (i <= 3 ? Math.round(planCash[i] * (0.72 + i * 0.04)) : null));

  return envelope({
    stats,
    byZone,
    cashFlow: { labels: monthly, planned: planCash, actual: actualCash },
    billing: {
      total: bills.length,
      pending: bills.filter(b => ['submitted', 'under_check'].includes(b.status)).length,
      pendingValue: bills.filter(b => ['submitted', 'under_check'].includes(b.status)).reduce((s, b) => s + b.netPayable, 0),
      paidValue: bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.netPayable, 0),
      ageingOver21: bills.filter(b => b.status === 'under_check' && b.ageingDays > 21).length },
    variance: projects
      .filter(p => p.status === 'under_execution')
      .map(p => ({
        id: p.id, code: p.code, name: p.name, zone: p.zone,
        sanctioned: p.sanctionedCost, estimate: p.latestEstimate,
        overrunPct: parseFloat(((p.latestEstimate - p.sanctionedCost) / p.sanctionedCost * 100).toFixed(1)),
        expenditure: p.expenditure,
        projectedAtCompletion: Math.round(p.latestEstimate * (1 + Math.max(0, -p.variance) / 200)) }))
      .sort((a, b) => b.overrunPct - a.overrunPct),
    fy: CURRENT_FY });
}

export async function getBills(params = {}) {
  await wait();
  let rows = inScope(effectiveBills());
  const user = currentUser();
  if (user.role === 'CONTRACTOR_PM' && user.contractorId) rows = rows.filter(b => b.contractorId === user.contractorId);
  rows = applyFilters(rows, { status: params.status, projectId: params.projectId, contractorId: params.contractorId, packageId: params.packageId });
  rows = applySearch(rows, params.q, ['packageCode', 'projectName', 'contractorName']);
  rows = applySort(rows, params.sort || '-submittedAt');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, {
    ...meta,
    totals: {
      gross: rows.reduce((s, b) => s + b.grossAmount, 0),
      net: rows.reduce((s, b) => s + b.netPayable, 0),
      deductions: rows.reduce((s, b) => s + b.totalDeductions, 0),
      pending: rows.filter(b => ['submitted', 'under_check'].includes(b.status)).length } });
}

export async function certifyBill(id, status, remarks) {
  await wait(200);
  actOnBill(id, status, remarks);
  return envelope({ id, status });
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROCUREMENT / CONTRACTORS / RESOURCES
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getTenders(params = {}) {
  await wait();
  let rows = inScope(TENDERS);
  rows = applyFilters(rows, { stage: params.stage, portal: params.portal, projectId: params.projectId });
  rows = applySearch(rows, params.q, ['tenderNo', 'projectName', 'scope', 'l1Name']);
  rows = applySort(rows, params.sort || '-estimatedValue');
  const { rows: page, meta } = paginate(rows, params);
  const byStage = {};
  rows.forEach(t => { byStage[t.stage] = (byStage[t.stage] || 0) + 1; });
  return envelope(page, {
    ...meta, byStage,
    totalValue: rows.reduce((s, t) => s + t.estimatedValue, 0),
    avgCycleDays: rows.length ? Math.round(rows.reduce((s, t) => s + t.cycleDays, 0) / rows.length) : 0 });
}

export async function getContractors(params = {}) {
  await wait();
  let rows = CONTRACTORS.map(c => {
    const pkgs = inScope(PACKAGES).filter(p => p.contractorId === c.id);
    return {
      ...c,
      livePackages: pkgs.length,
      liveValue: pkgs.reduce((s, p) => s + (p.awardedValue || 0), 0),
      avgProgress: pkgs.length ? parseFloat((pkgs.reduce((s, p) => s + p.physicalProgress, 0) / pkgs.length).toFixed(1)) : 0 };
  });
  rows = applySearch(rows, params.q, ['name', 'pan', 'regClass']);
  rows = applyFilters(rows, { rag: params.rag });
  rows = applySort(rows, params.sort || '-liveValue');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, meta);
}

export async function getContractorById(id) {
  await wait();
  const c = CONTRACTORS.find(x => x.id === id);
  if (!c) throw notFound('contractor', id);
  const pkgs = PACKAGES.filter(p => p.contractorId === id);
  const bills = effectiveBills().filter(b => b.contractorId === id);
  return envelope({
    ...c,
    packages: pkgs,
    bills: bills.slice(0, 12),
    safety: SAFETY_EVENTS.filter(s => s.contractorName === c.name).length,
    ncrs: effectiveNcrs().filter(n => n.contractorName === c.name).length });
}

export async function getResources(params = {}) {
  await wait();
  let plant = inScope(PLANT);
  let manpower = inScope(MANPOWER);
  if (params.projectId) {
    plant = plant.filter(p => p.projectId === params.projectId);
    manpower = manpower.filter(m => m.projectId === params.projectId);
  }
  if (params.q) {
    plant = applySearch(plant, params.q, ['type', 'code', 'projectName', 'packageCode', 'contractorName']);
    manpower = applySearch(manpower, params.q, ['projectName', 'packageCode', 'contractorName']);
  }
  return envelope({
    plant: applySort(plant, params.sort || '-shortfall'),
    manpower: applySort(manpower, '-shortfallPct'),
    stats: {
      plantTotal: plant.reduce((s, p) => s + p.committed, 0),
      plantDeployed: plant.reduce((s, p) => s + p.deployed, 0),
      plantShortfall: plant.reduce((s, p) => s + p.shortfall, 0),
      avgUtilisation: plant.length ? parseFloat((plant.reduce((s, p) => s + p.utilisationPct, 0) / plant.length).toFixed(1)) : 0,
      manpowerCommitted: manpower.reduce((s, m) => s + m.committed, 0),
      manpowerDeployed: manpower.reduce((s, m) => s + m.deployed, 0),
      criticalPackages: manpower.filter(m => m.status === 'critical').length } });
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAND / COMPLIANCE / SAFETY / RISK
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getLandParcels(params = {}) {
  await wait();
  let rows = inScope(LAND_PARCELS);
  rows = applyFilters(rows, { status: params.status, projectId: params.projectId, landType: params.landType, state: params.state });
  rows = applySearch(rows, params.q, ['parcelRef', 'village', 'district', 'state', 'projectName']);
  rows = applySort(rows, params.sort || 'fromChainageM');
  const { rows: page, meta } = paginate(rows, params);
  const byStatus = {};
  rows.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  return envelope(page, { ...meta, summary: landSummary(rows), byStatus });
}

export async function getClearances(params = {}) {
  await wait();
  let rows = inScope(effectiveClearances());
  rows = applyFilters(rows, { status: params.status, type: params.type, projectId: params.projectId });
  if (params.breachedOnly) rows = rows.filter(r => r.breached);
  rows = applySearch(rows, params.q, ['typeLabel', 'authority', 'projectName', 'portalRef']);
  rows = applySort(rows, params.sort || '-daysPending');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, {
    ...meta,
    stats: {
      total: rows.length,
      granted: rows.filter(r => r.status === 'granted').length,
      pending: rows.filter(r => r.status !== 'granted').length,
      breached: rows.filter(r => r.breached).length,
      notApplied: rows.filter(r => r.status === 'not_applied').length,
      openConditions: CLEARANCE_CONDITIONS.filter(c => c.status !== 'closed').length } });
}

export async function getClearanceConditions(clearanceId) {
  await wait(80);
  return envelope(conditionsFor(clearanceId));
}

export async function updateClearance(id, patch, remarks) {
  await wait(180);
  advanceClearance(id, patch, remarks);
  return envelope({ id, ...patch });
}

export async function getRisks(params = {}) {
  await wait();
  let rows = inScope(effectiveRisks());
  rows = applyFilters(rows, { status: params.status, category: params.category, severity: params.severity, projectId: params.projectId });
  rows = applySearch(rows, params.q, ['title', 'projectName', 'categoryLabel', 'owner']);
  rows = applySort(rows, params.sort || '-score');
  const { rows: page, meta } = paginate(rows, params);
  const open = rows.filter(r => r.status !== 'closed');
  return envelope(page, {
    ...meta,
    heatmap: riskHeatmap(open),
    stats: {
      open: open.length,
      critical: open.filter(r => r.severity === 'critical').length,
      exposure: open.reduce((s, r) => s + r.exposureAmount, 0),
      closed: rows.filter(r => r.status === 'closed').length } });
}

export async function patchRisk(id, patch) {
  await wait(160);
  updateRisk(id, patch);
  return envelope({ id, ...patch });
}

export async function getSafety(params = {}) {
  await wait();
  let events = inScope(SAFETY_EVENTS);
  let ncrs = inScope(effectiveNcrs());
  if (params.projectId) {
    events = events.filter(e => e.projectId === params.projectId);
    ncrs = ncrs.filter(n => n.projectId === params.projectId);
  }
  events = applySearch(events, params.q, ['description', 'projectName', 'contractorName', 'typeLabel']);
  ncrs = applySearch(ncrs, params.q, ['description', 'projectName', 'ncrNo', 'contractorName']);
  return envelope({
    events: applySort(events, '-occurredOn'),
    ncrs: applySort(ncrs, '-ageingDays'),
    stats: {
      totalEvents: events.length,
      lti: events.filter(e => e.type === 'lost_time').length,
      fatalities: events.filter(e => e.type === 'fatality').length,
      nearMiss: events.filter(e => e.type === 'near_miss').length,
      openEvents: events.filter(e => e.status === 'open').length,
      openNcrs: ncrs.filter(n => n.status === 'open').length,
      ncrOver30: ncrs.filter(n => n.status === 'open' && n.ageingDays > 30).length,
      ltifr: parseFloat((events.filter(e => ['lost_time', 'fatality'].includes(e.type)).length / Math.max(1, events.length) * 2.4).toFixed(2)) } });
}

export async function closeNcrById(id, remarks) {
  await wait(160);
  closeNcr(id, remarks);
  return envelope({ id, status: 'closed' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPROVALS / AUDIT / DOCUMENTS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getApprovals(params = {}) {
  await wait();
  let rows = inScope(effectiveApprovals());
  rows = applyFilters(rows, { status: params.status, entityType: params.entityType, currentLevel: params.currentLevel });
  rows = applySearch(rows, params.q, ['title', 'projectName', 'entityLabel', 'raisedBy']);
  rows = applySort(rows, params.sort || '-ageingDays');
  const { rows: page, meta } = paginate(rows, params);
  return envelope(page, {
    ...meta,
    stats: {
      pending: rows.filter(r => r.status === 'pending').length,
      breached: rows.filter(r => r.slaBreached && r.status === 'pending').length,
      approved: rows.filter(r => r.status === 'approved').length,
      value: rows.filter(r => r.status === 'pending').reduce((s, r) => s + (r.amount || 0), 0) } });
}

export async function actApproval(id, action, remarks) {
  await wait(220);
  actOnApproval(id, action, remarks);
  return envelope({ id, action });
}

export async function getAuditLog(params = {}) {
  await wait();
  let rows = effectiveAudit();
  rows = applyFilters(rows, { action: params.action, entityType: params.entityType, actorRole: params.actorRole, projectId: params.projectId });
  rows = applySearch(rows, params.q, ['actor', 'actionLabel', 'entityId', 'projectName', 'entityType']);
  const { rows: page, meta } = paginate(rows, { ...params, pageSize: params.pageSize || 40 });
  return envelope(page, {
    ...meta,
    chainVerified: true,
    chainLength: rows.length,
    lastVerifiedAt: new Date().toISOString() });
}

export async function getDocuments(params = {}) {
  await wait();
  let rows = inScope(DOCUMENTS);
  rows = applyFilters(rows, { type: params.type, projectId: params.projectId });
  rows = applySearch(rows, params.q, ['title', 'typeLabel', 'projectName', 'uploadedBy']);
  rows = applySort(rows, params.sort || '-uploadedAt');
  const { rows: page, meta } = paginate(rows, params);
  const byType = {};
  rows.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1; });
  return envelope(page, {
    ...meta, byType,
    totalSize: rows.reduce((s, d) => s + d.sizeBytes, 0) });
}

/* ═══════════════════════════════════════════════════════════════════════════
   GIS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getGisFeatures(params = {}) {
  await wait();
  const projects = scopedProjects(params.zone);
  const ids = new Set(projects.map(p => p.id));
  return envelope({
    projects: projects.map(p => ({
      id: p.id, code: p.code, name: p.name, zone: p.zone, lat: p.lat, lng: p.lng,
      lengthKm: p.lengthKm, physicalProgress: p.physicalProgress, health: p.health,
      status: p.status, statusLabel: p.statusLabel, piuName: p.piuName,
      latestEstimate: p.latestEstimate, type: p.type, typeLabel: p.typeLabel })),
    structures: STRUCTURES.filter(s => ids.has(s.projectId)),
    parcels: LAND_PARCELS.filter(l => ids.has(l.projectId) && l.status !== 'possession_taken').slice(0, 400),
    pius: PIUS });
}

/* ═══════════════════════════════════════════════════════════════════════════
   DIGITAL TWIN
   One call returns everything the twin can draw for the current scope. The
   corridor layer is always present; heavier per-project layers (land bands,
   crews, evidence) resolve only when a project is in focus.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getTwinScene(params = {}) {
  await wait(120);
  const projects = scopedProjects(params.zone);
  const ids = new Set(projects.map(p => p.id));
  const asOf = params.asOfFactor == null ? 1 : params.asOfFactor;

  const scene = {
    corridors: corridorOverview(projects),
    structures: STRUCTURES.filter(s => ids.has(s.projectId)),
    crews: SITE_CREWS.filter(c => ids.has(c.projectId)),
    photos: effectiveSitePhotos().filter(p => !p.projectId || ids.has(p.projectId)).slice(0, 120),
    incidents: SAFETY_EVENTS.filter(s => ids.has(s.projectId) && s.status === 'open'),
    risks: effectiveRisks().filter(r => ids.has(r.projectId) && r.status !== 'closed' && r.severity !== 'normal'),
    clearances: effectiveClearances().filter(c => ids.has(c.projectId) && c.status !== 'granted'),
    plant: PLANT.filter(p => ids.has(p.projectId) && p.status !== 'ok'),
    parcels: [],
    segments: [],
    milestones: [],
    workItems: WORK_ITEMS,
    stats: portfolioStats(projects),
  };

  if (params.projectId && ids.has(params.projectId)) {
    const p = getProject(params.projectId);
    scene.project = p;
    scene.segments = alignmentSegments(params.projectId, asOf);
    scene.parcels = landFor(params.projectId);
    scene.landSummary = landSummary(scene.parcels);
    scene.milestones = milestoneMarkers(params.projectId);
    scene.packages = packagesFor(params.projectId);
    scene.projectCrews = crewsFor(params.projectId);
    scene.projectPhotos = effectiveSitePhotos().filter(x => x.projectId === params.projectId);
    scene.projectStructures = structuresFor(params.projectId);
    scene.projectRisks = effectiveRisks().filter(r => r.projectId === params.projectId && r.status !== 'closed');
    scene.projectClearances = effectiveClearances().filter(c => c.projectId === params.projectId);
    scene.projectIncidents = SAFETY_EVENTS.filter(s => s.projectId === params.projectId);
    scene.progressBands = {
      doneKm: parseFloat(scene.segments.filter(s => s.state === 'done').reduce((a, s) => a + s.lengthKm, 0).toFixed(1)),
      activeKm: parseFloat(scene.segments.filter(s => s.state === 'active').reduce((a, s) => a + s.lengthKm, 0).toFixed(1)),
      pendingKm: parseFloat(scene.segments.filter(s => s.state === 'pending').reduce((a, s) => a + s.lengthKm, 0).toFixed(1)),
      blockedKm: parseFloat(scene.segments.filter(s => s.blocked).reduce((a, s) => a + s.lengthKm, 0).toFixed(1)),
    };
  }

  return envelope(scene, { asOfFactor: asOf, projectId: params.projectId || null });
}

export async function getSitePhotos(params = {}) {
  await wait(90);
  const ids = new Set(scopedProjects().map(p => p.id));
  let rows = effectiveSitePhotos().filter(p => !p.projectId || ids.has(p.projectId));
  if (params.projectId) rows = rows.filter(p => p.projectId === params.projectId);
  if (params.verdict && params.verdict !== 'all') rows = rows.filter(p => p.verdict === params.verdict);
  if (params.workItem && params.workItem !== 'all') rows = rows.filter(p => p.workItem === params.workItem);
  return envelope(rows, {
    stats: {
      total: rows.length,
      verified: rows.filter(p => p.verdict === 'verified').length,
      partial: rows.filter(p => p.verdict === 'partial').length,
      flagged: rows.filter(p => p.verdict === 'flagged').length,
      rejected: rows.filter(p => p.verdict === 'rejected').length,
      awaitingReview: rows.filter(p => p.reviewStatus !== 'auto_accepted' && p.reviewStatus !== 'accepted').length,
    } });
}

/** Upload a site frame and run the work-validation model over it. */
export async function uploadSitePhoto(payload) {
  await wait(650);                       // vision inference takes a moment
  const rec = submitSitePhoto(payload);
  return envelope(rec, { model: 'nirman-vision-1', analysedAt: new Date().toISOString() });
}

export async function actOnSitePhoto(photoId, status, remarks) {
  await wait(160);
  reviewSitePhoto(photoId, status, remarks);
  return envelope({ photoId, status });
}

export async function snapToChainage(projectId, lat, lng) {
  await wait(60);
  const p = getProject(projectId);
  if (!p) throw notFound('project', projectId);
  const d = Math.abs(lat - p.lat) + Math.abs(lng - p.lng);
  const chainageM = Math.min(p.lengthM, Math.round(d * 40000) % Math.max(1, p.lengthM));
  return envelope({ projectId, chainageM, lat, lng });
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALERTS / ADVISORIES
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getAlerts(params = {}) {
  await wait(80);
  let rows = effectiveAlerts();
  if (params.acknowledged != null) rows = rows.filter(a => a.acknowledged === params.acknowledged);
  if (params.zone && params.zone !== 'ALL') rows = rows.filter(a => a.zone === params.zone || a.zone === 'ALL');
  if (params.category) rows = rows.filter(a => a.category === params.category);
  return envelope(rows);
}

export async function acknowledgeAlert(alertId) {
  await wait(80);
  acknowledgeAlertLocal(alertId);
  return envelope({ alertId, acknowledged: true });
}

export async function acknowledgeAll() {
  await wait(120);
  acknowledgeAllAlerts();
  return envelope({ acknowledged: true });
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPORTS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function generateReport(kind, params = {}) {
  await wait(900);
  const projects = scopedProjects(params.zone);
  const stats = portfolioStats(projects);
  return envelope({
    kind,
    generatedAt: new Date().toISOString(),
    rowCount: projects.length,
    stats,
    fy: CURRENT_FY,
    downloadName: `RVNL_${kind}_${CURRENT_FY.replace('-', '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
    rows: projects.map(p => ({
      code: p.code, name: p.name, zone: p.zone, piu: p.piuName, status: p.statusLabel,
      sanctioned: p.sanctionedCost, estimate: p.latestEstimate, expenditure: p.expenditure,
      physical: p.physicalProgress, planned: p.plannedPhysical, variance: p.variance,
      target: p.targetCompletion, revised: p.revisedCompletion || '', health: p.health })) });
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFERENCE
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getReference() {
  await wait(40);
  return envelope({ zones: ZONES, pius: PIUS, contractors: CONTRACTORS });
}

/* ─── Errors — RFC 7807 shaped ───────────────────────────────────────────── */
function notFound(entity, id) {
  const err = new Error(`${entity} ${id} not found`);
  err.problem = {
    type: `https://api.nirmansetu.rvnl.gov.in/errors/not-found`,
    title: 'Resource not found', status: 404,
    detail: `No ${entity} exists with identifier ${id}.` };
  return err;
}

/* ─── Legacy exports kept so nothing in the template breaks ──────────────── */
export const getItems = () => Promise.resolve({ data: [] });
export const getAssets = () => Promise.resolve({ data: [] });
export const getGroups = () => Promise.resolve({ data: [] });
export const getMetrics = () => Promise.resolve({ data: {} });
export const executeAdvisoryAction = () => Promise.resolve({ data: {} });

export { TODAY, CURRENT_FY, daysAgo };
