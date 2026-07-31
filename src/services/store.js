/* ═══════════════════════════════════════════════════════════════════════════
   Mutation store — holds user-authored changes on top of the seed dataset.
   Persisted to localStorage so the app behaves like a real system across
   reloads. Swap this for HTTP calls and the API surface stays identical.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  ALERTS, DSRS, BILLS, APPROVALS, RISKS, AUDIT_LOG, PACKAGES, BOQ_ITEMS,
  CLEARANCES, NCRS, TODAY, minutesAgo,
  SITE_PHOTOS, WORK_ITEMS, scorePhotoEvidence, getProject, chainageToLatLng,
} from '../data/rvnlData';

const KEY = 'rvnl_nirman_setu_state_v1';

const DEFAULT_STATE = {
  acknowledgedAlerts: [],      // alertId[]
  dsrDrafts: [],               // locally submitted DSRs
  syncQueue: [],               // { id, kind, label, sizeKb, status }
  billActions: {},             // billId → { status, actedBy, actedAt, remarks }
  approvalActions: {},         // approvalId → { action, remarks, actedAt, level }
  dsrReviews: {},              // dsrId → { status, remarks, actedAt }
  riskEdits: {},               // riskId → partial
  clearanceEdits: {},          // clearanceId → partial
  ncrEdits: {},                // ncrId → partial
  sitePhotos: [],              // site-worker uploads validated by the vision model
  photoReviews: {},            // photoId → { status, remarks, actedBy, actedAt }
  extraAudit: [],              // audit rows created by user actions
  online: true,
  role: 'HQ_EXEC',
  zone: 'ALL',
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota — ignore */ }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  persist();
  listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
}

export const getState = () => state;

export function setState(patch) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
  emit();
}

export function resetState() {
  state = { ...DEFAULT_STATE };
  emit();
}

/* ─── Audit helper — every mutation writes a chain entry ──────────────────── */
let auditSeq = 100000;
export function writeAudit({ action, actionLabel, entityType, entityId, projectId, projectName, reason }) {
  const prev = state.extraAudit[0];
  const hash = Math.random().toString(16).slice(2, 14);
  const row = {
    id: ++auditSeq,
    occurredAt: new Date().toISOString(),
    actor: currentUser().fullName,
    actorRole: state.role,
    actorIp: '10.24.11.42',
    action, actionLabel,
    entityType, entityId,
    projectId: projectId || null,
    projectName: projectName || null,
    zone: null,
    reason: reason || null,
    hash, prevHash: prev ? prev.hash : (AUDIT_LOG[0]?.hash || null),
    chainOk: true,
    isNew: true,
  };
  state.extraAudit = [row, ...state.extraAudit].slice(0, 400);
  return row;
}

/* ─── Current user derived from the active role ──────────────────────────── */
/* All users below are fictional personas used to demonstrate role-based scope. */
const USER_BY_ROLE = {
  HQ_EXEC:       { fullName: 'Aryan Trehan',    designation: 'Director (Operations)',          piuId: null,      zone: null },
  HQ_FINANCE:    { fullName: 'Simran Bajwa',    designation: 'Executive Director (Finance)',   piuId: null,      zone: null },
  REGIONAL_HEAD: { fullName: 'Dhruv Chhikara',  designation: 'General Manager (North)',        piuId: null,      zone: 'NR' },
  PIU_CPM:       { fullName: 'Devansh Kalra',   designation: 'Chief Project Manager — Dehradun', piuId: 'piu-ddn', zone: 'NR' },
  SITE_ENGINEER: { fullName: 'Harsh Bijlani',   designation: 'Sr. Section Engineer — Site',    piuId: 'piu-ddn', zone: 'NR' },
  CONTRACTOR_PM: { fullName: 'Ira Sondhi',      designation: 'Project Manager — Aravalli Engineering', piuId: null, zone: null, contractorId: 'ctr-3' },
  AUDITOR:       { fullName: 'Nikhil Dhawan',   designation: 'Internal Audit',                 piuId: null,      zone: null },
};

export function currentUser() {
  const role = state.role || 'HQ_EXEC';
  return { role, ...USER_BY_ROLE[role] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Effective (seed + overlay) collections
   ═══════════════════════════════════════════════════════════════════════════ */

export function effectiveAlerts() {
  const acked = new Set(state.acknowledgedAlerts);
  return ALERTS.map(a => (acked.has(a.alertId) ? { ...a, acknowledged: true } : a));
}

export function effectiveDsrs() {
  const local = state.dsrDrafts.map(d => ({ ...d, isLocal: true }));
  const merged = DSRS.map(d => {
    const rev = state.dsrReviews[d.id];
    return rev ? { ...d, status: rev.status, reviewRemarks: rev.remarks, reviewedAt: rev.actedAt } : d;
  });
  return [...local, ...merged];
}

export function effectiveBills() {
  return BILLS.map(b => {
    const act = state.billActions[b.id];
    if (!act) return b;
    return {
      ...b,
      status: act.status,
      statusLabel: { submitted: 'Submitted', under_check: 'Under Check', certified: 'Certified', passed: 'Passed', paid: 'Paid', rejected: 'Rejected' }[act.status],
      certifiedBy: act.actedBy || b.certifiedBy,
      actionRemarks: act.remarks,
      actedAt: act.actedAt,
    };
  });
}

export function effectiveApprovals() {
  return APPROVALS.map(a => {
    const act = state.approvalActions[a.id];
    if (!act) return a;
    const steps = a.steps.map(s =>
      s.level === act.level
        ? { ...s, status: act.action === 'approved' ? 'approved' : act.action, actedBy: currentUser().fullName, actedAt: act.actedAt, remarks: act.remarks }
        : s);
    const idx = a.requiredLevels.indexOf(act.level);
    const isLast = idx === a.requiredLevels.length - 1;
    return {
      ...a,
      steps,
      status: act.action === 'rejected' ? 'rejected'
            : act.action === 'returned' ? 'returned'
            : isLast ? 'approved' : 'pending',
      currentLevel: act.action === 'approved' && !isLast ? a.requiredLevels[idx + 1] : a.currentLevel,
      actedLocally: true,
    };
  });
}

export function effectiveRisks() {
  return RISKS.map(r => (state.riskEdits[r.id] ? { ...r, ...state.riskEdits[r.id] } : r));
}

export function effectiveClearances() {
  return CLEARANCES.map(c => (state.clearanceEdits[c.id] ? { ...c, ...state.clearanceEdits[c.id] } : c));
}

export function effectiveNcrs() {
  return NCRS.map(n => (state.ncrEdits[n.id] ? { ...n, ...state.ncrEdits[n.id] } : n));
}

export function effectiveAudit() {
  return [...state.extraAudit, ...AUDIT_LOG];
}

/* Uploaded frames live in memory only — localStorage is metadata-sized. */
const PHOTO_IMAGES = new Map();
export const photoImage = (id) => PHOTO_IMAGES.get(id) || null;

export function effectiveSitePhotos() {
  const local = state.sitePhotos.map(p => ({ ...p, isLocal: true, imageUrl: PHOTO_IMAGES.get(p.id) || null }));
  const seeded = SITE_PHOTOS.map(p => {
    const rev = state.photoReviews[p.id];
    return rev ? { ...p, reviewStatus: rev.status, reviewRemarks: rev.remarks, reviewedBy: rev.actedBy, reviewedAt: rev.actedAt } : p;
  });
  return [...local, ...seeded];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mutations
   ═══════════════════════════════════════════════════════════════════════════ */

export function acknowledgeAlertLocal(alertId) {
  if (state.acknowledgedAlerts.includes(alertId)) return;
  state.acknowledgedAlerts = [...state.acknowledgedAlerts, alertId];
  writeAudit({ action: 'update', actionLabel: 'Acknowledged alert', entityType: 'alert', entityId: alertId });
  emit();
}

export function acknowledgeAllAlerts() {
  state.acknowledgedAlerts = ALERTS.map(a => a.alertId);
  writeAudit({ action: 'update', actionLabel: 'Acknowledged all alerts', entityType: 'alert', entityId: 'bulk' });
  emit();
}

let dsrSeq = 0;
export function submitDsr(payload) {
  const pkg = PACKAGES.find(p => p.id === payload.packageId);
  const id = `dsr-local-${Date.now()}-${++dsrSeq}`;
  const clientOpId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const record = {
    id, clientOpId,
    packageId: payload.packageId,
    packageCode: pkg?.code || '—',
    packageName: pkg?.name || '—',
    projectId: pkg?.projectId,
    projectName: pkg?.projectName,
    zone: pkg?.zone, piuId: pkg?.piuId,
    reportDate: payload.reportDate,
    submittedBy: currentUser().fullName,
    submittedRole: state.role,
    fromChainageM: payload.fromChainageM,
    toChainageM: payload.toChainageM,
    gps: payload.gps || null,
    weather: payload.weather,
    hindranceType: payload.hindranceType,
    hindranceLabel: payload.hindranceLabel,
    hindranceHours: payload.hindranceHours || 0,
    manpower: payload.manpower || {},
    plant: payload.plant || [],
    targetQty: payload.targetQty || 0,
    achievedQty: payload.achievedQty || 0,
    unit: payload.unit || 'cum',
    achievementPct: payload.targetQty ? parseFloat((payload.achievedQty / payload.targetQty * 100).toFixed(1)) : 0,
    photoCount: payload.photoCount || 0,
    narrative: payload.narrative || '',
    status: 'submitted',
    capturedAt: new Date().toISOString(),
    syncedAt: state.online ? new Date().toISOString() : null,
    syncStatus: state.online ? 'synced' : 'queued',
    deviceId: 'FLD-DDN-114',
  };
  state.dsrDrafts = [record, ...state.dsrDrafts];

  if (!state.online) {
    state.syncQueue = [
      { id, kind: 'dsr', label: `DSR ${payload.reportDate} · ${pkg?.code || ''}`, sizeKb: 12, status: 'queued' },
      ...(payload.photoCount ? [{ id: `${id}-photos`, kind: 'photo', label: `${payload.photoCount} photos`, sizeKb: payload.photoCount * 200, status: 'queued' }] : []),
      ...state.syncQueue,
    ];
  }
  writeAudit({
    action: 'create', actionLabel: 'Submitted daily site report', entityType: 'dsr',
    entityId: id, projectId: pkg?.projectId, projectName: pkg?.projectName,
  });
  emit();
  return record;
}

export function reviewDsr(dsrId, action, remarks) {
  state.dsrReviews = { ...state.dsrReviews, [dsrId]: { status: action === 'accept' ? 'reviewed' : 'rejected', remarks, actedAt: new Date().toISOString() } };
  writeAudit({ action: action === 'accept' ? 'approve' : 'reject', actionLabel: action === 'accept' ? 'Accepted daily site report' : 'Rejected daily site report', entityType: 'dsr', entityId: dsrId, reason: remarks });
  emit();
}

export function actOnBill(billId, status, remarks) {
  const bill = BILLS.find(b => b.id === billId);
  state.billActions = { ...state.billActions, [billId]: { status, remarks, actedBy: currentUser().fullName, actedAt: new Date().toISOString() } };
  writeAudit({
    action: status === 'rejected' ? 'reject' : 'approve',
    actionLabel: { under_check: 'Moved RA Bill to check', certified: 'Certified RA Bill', passed: 'Passed RA Bill for payment', paid: 'Recorded payment against RA Bill', rejected: 'Returned RA Bill' }[status] || 'Updated RA Bill',
    entityType: 'ra_bill', entityId: billId,
    projectId: bill?.projectId, projectName: bill?.projectName, reason: remarks,
  });
  emit();
}

export function actOnApproval(approvalId, action, remarks) {
  const apr = APPROVALS.find(a => a.id === approvalId);
  state.approvalActions = {
    ...state.approvalActions,
    [approvalId]: { action, remarks, level: apr?.currentLevel, actedAt: new Date().toISOString() },
  };
  writeAudit({
    action: action === 'approved' ? 'approve' : action === 'rejected' ? 'reject' : 'update',
    actionLabel: { approved: 'Approved request', rejected: 'Rejected request', returned: 'Returned request for clarification' }[action],
    entityType: apr?.entityType || 'approval', entityId: approvalId,
    projectId: apr?.projectId, projectName: apr?.projectName, reason: remarks,
  });
  emit();
}

export function updateRisk(riskId, patch) {
  state.riskEdits = { ...state.riskEdits, [riskId]: { ...(state.riskEdits[riskId] || {}), ...patch } };
  const r = RISKS.find(x => x.id === riskId);
  writeAudit({ action: 'update', actionLabel: 'Updated risk', entityType: 'risk', entityId: riskId, projectId: r?.projectId, projectName: r?.projectName });
  emit();
}

export function advanceClearance(clearanceId, patch, remarks) {
  state.clearanceEdits = { ...state.clearanceEdits, [clearanceId]: { ...(state.clearanceEdits[clearanceId] || {}), ...patch } };
  const c = CLEARANCES.find(x => x.id === clearanceId);
  writeAudit({ action: 'update', actionLabel: 'Advanced clearance stage', entityType: 'clearance', entityId: clearanceId, projectId: c?.projectId, projectName: c?.projectName, reason: remarks });
  emit();
}

export function closeNcr(ncrId, remarks) {
  state.ncrEdits = { ...state.ncrEdits, [ncrId]: { status: 'closed', closedOn: new Date().toISOString().slice(0, 10), closureRemarks: remarks } };
  const n = NCRS.find(x => x.id === ncrId);
  writeAudit({ action: 'approve', actionLabel: 'Closed NCR', entityType: 'ncr', entityId: ncrId, projectId: n?.projectId, projectName: n?.projectName, reason: remarks });
  emit();
}

/* ─── Site-worker photo evidence ─────────────────────────────────────────────
   A worker on site uploads a frame against a work item. The vision model reads
   it, lists what it can see, and scores the claim. `scorePhotoEvidence` is the
   same routine that produced the seeded evidence, so live and historic records
   are judged identically. */

let photoSeq = 0;
export function submitSitePhoto(payload) {
  const pkg = PACKAGES.find(p => p.id === payload.packageId);
  const project = getProject(payload.projectId || pkg?.projectId);
  const id = `ph-local-${Date.now()}-${++photoSeq}`;
  const item = WORK_ITEMS.find(w => w.code === payload.workItem) || WORK_ITEMS[0];

  /* What the model reports it can see in the frame. */
  const detections = payload.detections || item.expects.map((label, i) => ({
    label, matchesScope: true,
    confidence: parseFloat((0.94 - i * 0.07).toFixed(2)),
  }));

  const ai = scorePhotoEvidence({
    workItem: item.code,
    claimedPct: payload.claimedPct,
    detections,
    gpsDeltaM: payload.gpsDeltaM,
    blurScore: payload.blurScore,
  });

  const point = project && payload.chainageM != null
    ? chainageToLatLng(project, payload.chainageM)
    : null;

  const record = {
    id,
    projectId: project?.id || null, projectName: project?.name || '—',
    packageId: pkg?.id || null, packageCode: pkg?.code || '—',
    zone: pkg?.zone || project?.zone, piuId: pkg?.piuId || null,
    workItem: item.code, workItemLabel: item.label,
    capturedBy: payload.capturedBy || currentUser().fullName,
    capturedRole: payload.capturedRole || 'Site Engineer',
    capturedAt: new Date().toISOString(),
    minsAgo: 0,
    chainageM: payload.chainageM ?? null,
    lat: point?.[0] ?? project?.lat ?? null,
    lng: point?.[1] ?? project?.lng ?? null,
    gpsDeltaM: payload.gpsDeltaM ?? null,
    blurScore: payload.blurScore ?? null,
    fileName: payload.fileName || null,
    detections,
    ...ai,
    reviewStatus: ai.verdict === 'verified' ? 'auto_accepted' : 'engineer_review',
    note: payload.note || '',
    syncStatus: state.online ? 'synced' : 'queued',
  };

  if (payload.imageUrl) PHOTO_IMAGES.set(id, payload.imageUrl);
  state.sitePhotos = [record, ...state.sitePhotos].slice(0, 60);

  if (!state.online) {
    state.syncQueue = [
      { id, kind: 'photo', label: `Site photo · ${item.label}`, sizeKb: payload.sizeKb || 820, status: 'queued' },
      ...state.syncQueue,
    ];
  }

  writeAudit({
    action: 'create', actionLabel: `Uploaded site photo — AI ${ai.verdict}`,
    entityType: 'site_photo', entityId: id,
    projectId: record.projectId, projectName: record.projectName,
    reason: `${item.label} · model confidence ${(ai.confidence * 100).toFixed(0)}%`,
  });
  emit();
  return record;
}

export function reviewSitePhoto(photoId, status, remarks) {
  const local = state.sitePhotos.find(p => p.id === photoId);
  if (local) {
    state.sitePhotos = state.sitePhotos.map(p =>
      p.id === photoId ? { ...p, reviewStatus: status, reviewRemarks: remarks, reviewedBy: currentUser().fullName, reviewedAt: new Date().toISOString() } : p);
  } else {
    state.photoReviews = {
      ...state.photoReviews,
      [photoId]: { status, remarks, actedBy: currentUser().fullName, actedAt: new Date().toISOString() },
    };
  }
  const rec = local || SITE_PHOTOS.find(p => p.id === photoId);
  writeAudit({
    action: status === 'rejected' ? 'reject' : 'approve',
    actionLabel: status === 'rejected' ? 'Rejected site photo evidence' : 'Accepted site photo evidence',
    entityType: 'site_photo', entityId: photoId,
    projectId: rec?.projectId, projectName: rec?.projectName, reason: remarks,
  });
  emit();
}

export function setOnline(online) {
  state.online = online;
  if (online && state.syncQueue.length) flush();
  emit();
}

function flush() {
  const now = new Date().toISOString();
  state.dsrDrafts = state.dsrDrafts.map(d => (d.syncStatus === 'queued' ? { ...d, syncStatus: 'synced', syncedAt: now } : d));
  state.sitePhotos = state.sitePhotos.map(p => (p.syncStatus === 'queued' ? { ...p, syncStatus: 'synced', syncedAt: now } : p));
  state.syncQueue = [];
}

export function flushSyncQueue() {
  flush();
  emit();
}

export function setRole(role) {
  state.role = role;
  emit();
}

export function setZone(zone) {
  state.zone = zone;
  emit();
}

/* ─── Derived counts used in nav badges ──────────────────────────────────── */
export function pendingApprovalCount() {
  return effectiveApprovals().filter(a => a.status === 'pending').length;
}

export { TODAY, minutesAgo, BOQ_ITEMS };
