/* ═══════════════════════════════════════════════════════════════════════════
   RVNL Nirman Setu — master dataset
   Deterministic seed data for the Integrated Project Command Centre.
   All monetary values are ₹ lakh unless the field name says otherwise.
   Chainage is integer metres. Dates are ISO yyyy-mm-dd.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Deterministic PRNG (mulberry32) — stable data across reloads ───────── */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260728);
const rnd     = () => rng();
const rint    = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
const rfloat  = (lo, hi, d = 2) => parseFloat((lo + rng() * (hi - lo)).toFixed(d));
const pick    = (arr) => arr[Math.floor(rng() * arr.length)];
const pickN   = (arr, n) => [...arr].sort(() => rng() - 0.5).slice(0, n);
const chance  = (p) => rng() < p;

/* ─── Date helpers ───────────────────────────────────────────────────────── */
export const TODAY = new Date('2026-07-28T09:42:00+05:30');
const iso     = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const daysAgo   = (n) => iso(addDays(TODAY, -n));
export const daysAhead = (n) => iso(addDays(TODAY, n));
export const minutesAgo = (n) => new Date(TODAY.getTime() - n * 60000).toISOString();

/* Indian financial year for a date */
export const fyOf = (d) => {
  const dt = new Date(d);
  const y = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};
export const CURRENT_FY = fyOf(TODAY);

/* ─── Formatting ─────────────────────────────────────────────────────────── */
/** ₹ lakh → "₹1,48,320 Cr" style. Indian digit grouping. */
export function inr(lakh, opts = {}) {
  if (lakh == null || isNaN(lakh)) return '—';
  const { unit = 'auto', decimals = null } = opts;
  const useCr = unit === 'cr' || (unit === 'auto' && Math.abs(lakh) >= 100);
  const v = useCr ? lakh / 100 : lakh;
  const d = decimals != null ? decimals : (Math.abs(v) >= 100 ? 0 : 2);
  return `₹${groupIndian(v.toFixed(d))} ${useCr ? 'Cr' : 'L'}`;
}
export function groupIndian(numStr) {
  const [i, f] = String(numStr).split('.');
  const neg = i.startsWith('-');
  const digits = neg ? i.slice(1) : i;
  let out;
  if (digits.length <= 3) out = digits;
  else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return (neg ? '-' : '') + out + (f ? '.' + f : '');
}
/** 143520 → "KM 143+520" */
export const chainage = (m) =>
  m == null ? '—' : `KM ${Math.floor(m / 1000)}+${String(m % 1000).padStart(3, '0')}`;
export const km = (m, d = 2) => (m / 1000).toFixed(d);
export const pct = (n, d = 1) => (n == null ? '—' : `${Number(n).toFixed(d)}%`);
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ─── RAG derivation ─────────────────────────────────────────────────────── */
export function ragFor(value, { warn, crit, invert = false }) {
  if (invert) return value >= crit ? 'critical' : value >= warn ? 'warning' : 'normal';
  return value <= crit ? 'critical' : value <= warn ? 'warning' : 'normal';
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFERENCE DATA
   ═══════════════════════════════════════════════════════════════════════════ */

/* Northern-region operating footprint. Every zone below sits in the northern
   half of the country — the portfolio this command centre is scoped to.
   All personal names in this file are fictional. */
export const ZONES = [
  { code: 'NR',    name: 'Northern Railway',        region: 'Delhi · Punjab · Haryana · Himachal · J&K · Uttarakhand' },
  { code: 'NCR',   name: 'North Central Railway',   region: 'Agra · Jhansi · Prayagraj' },
  { code: 'NER',   name: 'North Eastern Railway',   region: 'Lucknow · Gorakhpur · Varanasi' },
  { code: 'NWR',   name: 'North Western Railway',   region: 'Jaipur · Jodhpur · Bikaner · Ajmer' },
  { code: 'ECR',   name: 'East Central Railway',    region: 'Patna · Hajipur · Muzaffarpur' },
  { code: 'METRO', name: 'NCR Urban & Metro',       region: 'Delhi · Ghaziabad · Meerut · Noida' },
];

export const PIUS = [
  { id: 'piu-ddn',  code: 'PIU-DDN',  name: 'PIU Dehradun',    zone: 'NR',    city: 'Dehradun',   cpm: 'Devansh Kalra' },
  { id: 'piu-jat',  code: 'PIU-JAT',  name: 'PIU Jammu',       zone: 'NR',    city: 'Jammu',      cpm: 'Ishaan Marwah' },
  { id: 'piu-ludh', code: 'PIU-LDH',  name: 'PIU Ludhiana',    zone: 'NR',    city: 'Ludhiana',   cpm: 'Nakul Ahluwalia' },
  { id: 'piu-umb',  code: 'PIU-UMB',  name: 'PIU Ambala',      zone: 'NR',    city: 'Ambala',     cpm: 'Tanvi Pruthi' },
  { id: 'piu-ndls', code: 'PIU-NDLS', name: 'PIU Delhi',       zone: 'NR',    city: 'New Delhi',  cpm: 'Aarohi Gulati' },
  { id: 'piu-agr',  code: 'PIU-AGR',  name: 'PIU Agra',        zone: 'NCR',   city: 'Agra',       cpm: 'Rhea Sancheti' },
  { id: 'piu-jhs',  code: 'PIU-JHS',  name: 'PIU Jhansi',      zone: 'NCR',   city: 'Jhansi',     cpm: 'Yash Chandok' },
  { id: 'piu-prg',  code: 'PIU-PRG',  name: 'PIU Prayagraj',   zone: 'NCR',   city: 'Prayagraj',  cpm: 'Meher Chaubey' },
  { id: 'piu-gkp',  code: 'PIU-GKP',  name: 'PIU Gorakhpur',   zone: 'NER',   city: 'Gorakhpur',  cpm: 'Ojas Bhandari' },
  { id: 'piu-bsb',  code: 'PIU-BSB',  name: 'PIU Varanasi',    zone: 'NER',   city: 'Varanasi',   cpm: 'Naina Sabharwal' },
  { id: 'piu-jp',   code: 'PIU-JP',   name: 'PIU Jaipur',      zone: 'NWR',   city: 'Jaipur',     cpm: 'Rudra Khandelwal' },
  { id: 'piu-bkn',  code: 'PIU-BKN',  name: 'PIU Bikaner',     zone: 'NWR',   city: 'Bikaner',    cpm: 'Anaya Rathi' },
  { id: 'piu-pnbe', code: 'PIU-PNBE', name: 'PIU Patna',       zone: 'ECR',   city: 'Patna',      cpm: 'Kabir Vaswani' },
  { id: 'piu-gzb',  code: 'PIU-GZB',  name: 'PIU Ghaziabad',   zone: 'METRO', city: 'Ghaziabad',  cpm: 'Vivaan Tandon' },
];

export const WORK_HEADS = [
  { code: 'earthwork', label: 'Earthwork & Formation', unit: 'cum' },
  { code: 'bridges',   label: 'Bridges & Structures',  unit: 'nos' },
  { code: 'tunnels',   label: 'Tunnelling',            unit: 'm'   },
  { code: 'track',     label: 'Track Linking',         unit: 'tkm' },
  { code: 'ohe',       label: 'OHE & Traction',        unit: 'tkm' },
  { code: 'snt',       label: 'S&T / Signalling',      unit: 'nos' },
  { code: 'buildings', label: 'Station Buildings',     unit: 'sqm' },
];

export const HINDRANCE_TYPES = [
  { code: 'none',            label: 'No hindrance' },
  { code: 'rain',            label: 'Rain / weather' },
  { code: 'block_not_given', label: 'Traffic block not granted' },
  { code: 'material',        label: 'Material shortage' },
  { code: 'labour',          label: 'Labour shortage' },
  { code: 'land',            label: 'Land not available' },
  { code: 'utility',         label: 'Utility shifting pending' },
  { code: 'power',           label: 'Power block / OHE' },
  { code: 'other',           label: 'Other' },
];

export const RISK_CATEGORIES = [
  { code: 'land',          label: 'Land Acquisition' },
  { code: 'forest_ec',     label: 'Forest / Environment' },
  { code: 'utility',       label: 'Utility Shifting' },
  { code: 'traffic_block', label: 'Traffic Block' },
  { code: 'contractor',    label: 'Contractor Capacity' },
  { code: 'funds',         label: 'Fund Availability' },
  { code: 'geology',       label: 'Geology / Tunnelling' },
  { code: 'monsoon',       label: 'Monsoon / Weather' },
  { code: 'interface',     label: 'Zonal Railway Interface' },
  { code: 'approval',      label: 'Statutory Approval' },
];

export const CLEARANCE_TYPES = {
  forest_stage1:   { label: 'Forest Clearance — Stage I',  authority: 'MoEFCC / Nodal Officer',        sla: 150 },
  forest_stage2:   { label: 'Forest Clearance — Stage II', authority: 'MoEFCC',                        sla: 180 },
  environmental:   { label: 'Environmental Clearance',     authority: 'SEIAA / MoEFCC',                sla: 180 },
  wildlife_nbwl:   { label: 'Wildlife Clearance (NBWL)',   authority: 'National Board for Wildlife',   sla: 210 },
  gad_approval:    { label: 'GAD Approval',                authority: 'Zonal Railway (Chief Engineer)',sla: 90  },
  crs_sanction:    { label: 'CRS Sanction',                authority: 'Commissioner of Railway Safety',sla: 60  },
  state_noc:       { label: 'State NOC (PWD / Irrigation)',authority: 'State Government',              sla: 120 },
  tree_cutting:    { label: 'Tree Cutting Permission',     authority: 'State Forest Department',       sla: 90  },
  pollution_board: { label: 'Pollution Board Consent',     authority: 'State Pollution Control Board', sla: 120 },
  utility_shifting:{ label: 'Utility Shifting NOC',        authority: 'DISCOM / Utility Owner',        sla: 150 },
};

export const LAND_STATUS = {
  identified:        { label: 'Identified',           rag: 'critical', step: 0 },
  sec20a_notified:   { label: '§20A Notified',        rag: 'critical', step: 1 },
  sec20e_declared:   { label: '§20E Declared',        rag: 'warning',  step: 2 },
  sec20f_awarded:    { label: '§20F Award Passed',    rag: 'warning',  step: 3 },
  compensation_paid: { label: 'Compensation Paid',    rag: 'warning',  step: 4 },
  possession_taken:  { label: 'Possession Taken',     rag: 'normal',   step: 5 },
  disputed:          { label: 'Disputed',             rag: 'critical', step: -1 },
  court_stay:        { label: 'Court Stay',           rag: 'critical', step: -1 },
};

export const PROJECT_STATUS = {
  dpr_preparation: { label: 'DPR Preparation', chip: 'info'    },
  dpr_submitted:   { label: 'DPR Submitted',   chip: 'info'    },
  sanctioned:      { label: 'Sanctioned',      chip: 'accent'  },
  tendering:       { label: 'Tendering',       chip: 'warning' },
  under_execution: { label: 'Under Execution', chip: 'success' },
  commissioned:    { label: 'Commissioned',    chip: 'success' },
  on_hold:         { label: 'On Hold',         chip: 'danger'  },
};

export const ROLES = {
  HQ_EXEC:        { label: 'Director (Operations)', short: 'HQ Executive',    home: '/',          scope: 'all'  },
  HQ_FINANCE:     { label: 'ED / Finance',          short: 'HQ Finance',      home: '/finance',   scope: 'all'  },
  REGIONAL_HEAD:  { label: 'GM (Region)',           short: 'Regional Head',   home: '/portfolio', scope: 'zone' },
  PIU_CPM:        { label: 'Chief Project Manager', short: 'Project Director',home: '/portfolio', scope: 'piu'  },
  SITE_ENGINEER:  { label: 'Senior Section Engineer',short:'Site Engineer',   home: '/twin',     scope: 'pkg'  },
  CONTRACTOR_PM:  { label: 'Contractor Project Mgr',short: 'Contractor',      home: '/billing',   scope: 'ctr'  },
  AUDITOR:        { label: 'Internal Audit',        short: 'Auditor',         home: '/audit',     scope: 'all'  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONTRACTORS
   ═══════════════════════════════════════════════════════════════════════════ */

/* Fictional contracting firms — no real company is represented here. */
const CONTRACTOR_SEED = [
  ['Himgiri Rail Infra Pvt Ltd',        'AABCH2154K', 'Special'],
  ['Trisula Constructions Ltd',         'AAACT0140P', 'Special'],
  ['Aravalli Engineering Works Ltd',    'AAACA1265J', 'Special'],
  ['Shivalik Track Systems Pvt Ltd',    'AACCS8817M', 'Class-I'],
  ['Gangetic Infraprojects Ltd',        'AAACG7454L', 'Special'],
  ['Chenab Tunnelling Company Ltd',     'AAACC5085N', 'Class-I'],
  ['Doaba Bridge Builders Ltd',         'AAFCD1943D', 'Class-I'],
  ['Rohilkhand Civil Works Pvt Ltd',    'AACCR2277Q', 'Class-I'],
  ['Marudhara Earthmovers Ltd',         'AAECM4419H', 'Class-I'],
  ['Kumaon Structural Engineers Ltd',   'AAACK1523F', 'Special'],
  ['Yamuna Traction Systems Pvt Ltd',   'AABCY6612G', 'Class-II'],
  ['Saryu Signalling & Telecom Ltd',    'AAACS3378R', 'Class-II'],
];

/* Fictional people used throughout the dataset. */
const PERSON_NAMES = [
  'Aarav Bhatoa', 'Ira Sondhi', 'Kunal Vedi', 'Myra Talwar', 'Reyansh Chhabra',
  'Saanvi Purohit', 'Aditya Ranauta', 'Nitara Bakshi', 'Veer Sachdev', 'Kiara Mundhra',
  'Arjun Sethi', 'Diya Bhalla', 'Rohan Mattu', 'Anvi Kochhar', 'Shaurya Dhingra',
  'Prisha Wadhera', 'Kabir Anand', 'Zoya Rastogi', 'Advik Nagpal', 'Sara Chadha',
];

export const CONTRACTORS = CONTRACTOR_SEED.map(([name, pan, cls], i) => {
  const schedule = rfloat(48, 96);
  const quality  = rfloat(55, 97);
  const safety   = rfloat(52, 98);
  const billing  = rfloat(60, 98);
  const cpi      = parseFloat(((schedule * 0.4 + quality * 0.25 + safety * 0.2 + billing * 0.15)).toFixed(1));
  return {
    id: `ctr-${i + 1}`,
    name, pan, regClass: cls,
    gstin: `${rint(10, 36)}${pan}1Z${rint(1, 9)}`,
    isBlacklisted: false,
    activeContracts: rint(1, 6),
    totalValue: rint(28000, 480000),
    scores: { schedule, quality, safety, billing },
    cpi,
    rag: cpi >= 78 ? 'normal' : cpi >= 62 ? 'warning' : 'critical',
    pgExpiryDays: rint(-10, 420),
    contact: { person: pick(PERSON_NAMES), phone: `+91 ${rint(70, 99)}${rint(10000000, 99999999)}` },
  };
});

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Alignment geometry helpers ─────────────────────────────────────────────
   Every corridor carries a `path` — an ordered list of [lat, lng] waypoints
   tracing where the track actually runs. Chainage maps onto that path linearly
   by cumulative ground distance, so any chainage-bearing record (package,
   parcel, structure, incident) can be placed on the digital twin. */

const R_EARTH_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Cumulative distance table for a path: { legs: [km], total: km } */
export function pathMetrics(path) {
  const legs = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = haversineKm(path[i - 1], path[i]);
    legs.push(d);
    total += d;
  }
  return { legs, total };
}

/** Point at fraction f (0→1) of the path, measured along the ground. */
export function pointAlongPath(path, f) {
  if (!path || path.length === 0) return null;
  if (path.length === 1) return path[0];
  const { legs, total } = pathMetrics(path);
  const target = Math.max(0, Math.min(1, f)) * total;
  let acc = 0;
  for (let i = 0; i < legs.length; i++) {
    if (acc + legs[i] >= target || i === legs.length - 1) {
      const t = legs[i] === 0 ? 0 : (target - acc) / legs[i];
      const [aLat, aLng] = path[i], [bLat, bLng] = path[i + 1];
      return [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t];
    }
    acc += legs[i];
  }
  return path[path.length - 1];
}

/** Sub-path between two fractions, vertices preserved — used to colour a stretch. */
export function slicePath(path, f0, f1) {
  if (!path || path.length < 2) return path || [];
  const a = Math.max(0, Math.min(1, Math.min(f0, f1)));
  const b = Math.max(0, Math.min(1, Math.max(f0, f1)));
  if (b - a < 1e-6) return [pointAlongPath(path, a)];
  const { legs, total } = pathMetrics(path);
  const startKm = a * total, endKm = b * total;
  const out = [pointAlongPath(path, a)];
  let acc = 0;
  for (let i = 0; i < legs.length; i++) {
    const legEnd = acc + legs[i];
    if (legEnd > startKm && legEnd < endKm) out.push(path[i + 1]);
    acc = legEnd;
  }
  out.push(pointAlongPath(path, b));
  return out;
}

/** Offset a point roughly `m` metres perpendicular to the local path heading. */
export function offsetAcross(path, f, metres) {
  const p = pointAlongPath(path, f);
  if (!p) return null;
  const ahead = pointAlongPath(path, Math.min(1, f + 0.01));
  const dLat = ahead[0] - p[0], dLng = ahead[1] - p[1];
  const norm = Math.hypot(dLat, dLng) || 1e-6;
  const degLat = metres / 111320;
  const degLng = metres / (111320 * Math.cos(toRad(p[0])) || 1);
  /* perpendicular = (-dLng, dLat) normalised */
  return [p[0] + (-dLng / norm) * degLat, p[1] + (dLat / norm) * degLng];
}

/* Northern-region corridor portfolio. `path` waypoints trace the alignment. */
const PROJECT_SEED = [
  { name: 'Rishikesh – Karnaprayag New BG Line', type: 'new_line', zone: 'NR', piu: 'piu-ddn',
    lengthKm: 125.20, sanctionedCr: 16216, sanctionYear: 2016, status: 'under_execution', physical: 41.8, funding: 'mor_budgetary',
    terrain: 'Himalayan', states: ['Uttarakhand'],
    path: [[30.087, 78.268], [30.135, 78.404], [30.183, 78.470], [30.146, 78.598], [30.222, 78.783], [30.284, 78.981], [30.271, 79.145], [30.259, 79.216]] },

  { name: 'Katra – Banihal Himalayan Rail Link', type: 'new_line', zone: 'NR', piu: 'piu-jat',
    lengthKm: 111.00, sanctionedCr: 21653, sanctionYear: 2015, status: 'under_execution', physical: 88.4, funding: 'mor_budgetary',
    terrain: 'Himalayan', states: ['Jammu & Kashmir'],
    path: [[32.991, 74.949], [33.081, 74.836], [33.150, 74.930], [33.240, 75.070], [33.352, 75.190], [33.435, 75.197]] },

  { name: 'Bhanupli – Bilaspur – Beri New Line', type: 'new_line', zone: 'NR', piu: 'piu-ludh',
    lengthKm: 63.10, sanctionedCr: 6535, sanctionYear: 2018, status: 'under_execution', physical: 34.2, funding: 'mor_budgetary',
    terrain: 'Hilly', states: ['Punjab', 'Himachal Pradesh'],
    path: [[31.383, 76.396], [31.412, 76.470], [31.455, 76.560], [31.400, 76.650], [31.332, 76.757], [31.400, 76.836]] },

  { name: 'Jammu – Pathankot 3rd Line', type: 'doubling', zone: 'NR', piu: 'piu-jat',
    lengthKm: 105.00, sanctionedCr: 2240, sanctionYear: 2020, status: 'under_execution', physical: 37.5, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Jammu & Kashmir', 'Punjab'],
    path: [[32.694, 74.858], [32.560, 75.020], [32.430, 75.230], [32.340, 75.420], [32.274, 75.652]] },

  { name: 'Pathankot – Jogindernagar Gauge Conversion', type: 'gauge_conversion', zone: 'NR', piu: 'piu-umb',
    lengthKm: 163.00, sanctionedCr: 3120, sanctionYear: 2019, status: 'under_execution', physical: 22.4, funding: 'mor_budgetary',
    terrain: 'Hilly', states: ['Punjab', 'Himachal Pradesh'],
    path: [[32.274, 75.652], [32.302, 75.900], [32.180, 76.200], [32.100, 76.430], [32.049, 76.647], [31.988, 76.789]] },

  { name: 'Ludhiana – Ferozepur Doubling', type: 'doubling', zone: 'NR', piu: 'piu-ludh',
    lengthKm: 76.40, sanctionedCr: 1428, sanctionYear: 2019, status: 'under_execution', physical: 61.2, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Punjab'],
    path: [[30.901, 75.857], [30.860, 75.560], [30.818, 75.170], [30.900, 74.870], [30.925, 74.613]] },

  { name: 'Ambala – Chandigarh 3rd Line', type: 'doubling', zone: 'NR', piu: 'piu-umb',
    lengthKm: 41.00, sanctionedCr: 1180, sanctionYear: 2021, status: 'under_execution', physical: 48.9, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Haryana', 'Punjab', 'Chandigarh'],
    path: [[30.378, 76.777], [30.440, 76.790], [30.520, 76.800], [30.620, 76.795], [30.708, 76.783]] },

  { name: 'Delhi Cantt – Rewari 3rd Line', type: 'doubling', zone: 'NR', piu: 'piu-ndls',
    lengthKm: 82.00, sanctionedCr: 1912, sanctionYear: 2018, status: 'under_execution', physical: 71.4, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Delhi', 'Haryana'],
    path: [[28.590, 77.135], [28.482, 77.031], [28.410, 76.940], [28.328, 76.786], [28.196, 76.617]] },

  { name: 'Dehradun – Haridwar – Saharanpur Doubling', type: 'doubling', zone: 'NR', piu: 'piu-ddn',
    lengthKm: 98.00, sanctionedCr: 1684, sanctionYear: 2020, status: 'under_execution', physical: 55.3, funding: 'mor_budgetary',
    terrain: 'Foothill', states: ['Uttarakhand', 'Uttar Pradesh'],
    path: [[30.317, 78.032], [30.130, 78.150], [29.946, 78.164], [29.854, 77.888], [29.968, 77.546]] },

  { name: 'Rewari – Rohtak New Line', type: 'new_line', zone: 'NR', piu: 'piu-ndls',
    lengthKm: 81.00, sanctionedCr: 1120, sanctionYear: 2012, status: 'commissioned', physical: 100.0, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Haryana'],
    path: [[28.196, 76.617], [28.400, 76.600], [28.600, 76.590], [28.894, 76.606]] },

  { name: 'Kashipur – Ramnagar Doubling', type: 'doubling', zone: 'NR', piu: 'piu-ddn',
    lengthKm: 40.00, sanctionedCr: 720, sanctionYear: 2022, status: 'tendering', physical: 4.2, funding: 'mor_budgetary',
    terrain: 'Foothill', states: ['Uttarakhand'],
    path: [[29.214, 78.961], [29.300, 79.000], [29.380, 79.080], [29.394, 79.128]] },

  { name: 'Agra – Etawah 3rd Line', type: 'doubling', zone: 'NCR', piu: 'piu-agr',
    lengthKm: 118.40, sanctionedCr: 1842, sanctionYear: 2019, status: 'under_execution', physical: 71.4, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Uttar Pradesh'],
    path: [[27.177, 78.008], [27.151, 78.395], [27.107, 78.586], [26.930, 78.800], [26.780, 79.024]] },

  { name: 'Mathura – Dhaulpur 4th Line', type: 'doubling', zone: 'NCR', piu: 'piu-agr',
    lengthKm: 118.00, sanctionedCr: 2210, sanctionYear: 2020, status: 'under_execution', physical: 58.9, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Uttar Pradesh', 'Rajasthan'],
    path: [[27.492, 77.673], [27.177, 78.008], [26.900, 77.940], [26.700, 77.894]] },

  { name: 'Jhansi – Gwalior 4th Line', type: 'doubling', zone: 'NCR', piu: 'piu-jhs',
    lengthKm: 97.00, sanctionedCr: 2864, sanctionYear: 2016, status: 'under_execution', physical: 92.6, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Uttar Pradesh', 'Madhya Pradesh'],
    path: [[25.449, 78.568], [25.667, 78.462], [25.900, 78.330], [26.100, 78.230], [26.218, 78.183]] },

  { name: 'Prayagraj – Kanpur 4th Line', type: 'doubling', zone: 'NCR', piu: 'piu-prg',
    lengthKm: 194.00, sanctionedCr: 3486, sanctionYear: 2017, status: 'under_execution', physical: 66.8, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Uttar Pradesh'],
    path: [[25.446, 81.833], [25.700, 81.400], [25.930, 80.808], [26.200, 80.560], [26.449, 80.331]] },

  { name: 'Gorakhpur – Chhapra Doubling', type: 'doubling', zone: 'NER', piu: 'piu-gkp',
    lengthKm: 154.00, sanctionedCr: 2984, sanctionYear: 2018, status: 'under_execution', physical: 79.3, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Uttar Pradesh', 'Bihar'],
    path: [[26.759, 83.373], [26.503, 83.779], [26.350, 84.070], [26.219, 84.356], [25.780, 84.727]] },

  { name: 'Varanasi – Aunrihar – Jaunpur Doubling', type: 'doubling', zone: 'NER', piu: 'piu-bsb',
    lengthKm: 88.00, sanctionedCr: 1596, sanctionYear: 2020, status: 'under_execution', physical: 43.2, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Uttar Pradesh'],
    path: [[25.317, 82.973], [25.379, 83.023], [25.525, 83.298], [25.700, 83.100], [25.744, 82.686]] },

  { name: 'Lucknow – Barabanki 4th Line', type: 'doubling', zone: 'NER', piu: 'piu-gkp',
    lengthKm: 28.00, sanctionedCr: 890, sanctionYear: 2021, status: 'under_execution', physical: 34.6, funding: 'mor_budgetary',
    terrain: 'Urban', states: ['Uttar Pradesh'],
    path: [[26.846, 80.946], [26.870, 81.030], [26.900, 81.120], [26.924, 81.199]] },

  { name: 'Hajipur – Bachwara Doubling', type: 'doubling', zone: 'ECR', piu: 'piu-pnbe',
    lengthKm: 72.00, sanctionedCr: 1240, sanctionYear: 2019, status: 'under_execution', physical: 52.8, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Bihar'],
    path: [[25.685, 85.209], [25.640, 85.450], [25.600, 85.700], [25.585, 85.988]] },

  { name: 'Patna – Digha Rail-cum-Road Bridge Approach', type: 'bridge', zone: 'ECR', piu: 'piu-pnbe',
    lengthKm: 12.40, sanctionedCr: 2260, sanctionYear: 2018, status: 'under_execution', physical: 86.2, funding: 'deposit_work',
    terrain: 'River crossing', states: ['Bihar'],
    path: [[25.610, 85.100], [25.630, 85.080], [25.650, 85.062]] },

  { name: 'Muzaffarpur – Sitamarhi Doubling', type: 'doubling', zone: 'ECR', piu: 'piu-pnbe',
    lengthKm: 68.00, sanctionedCr: 1096, sanctionYear: 2021, status: 'tendering', physical: 6.8, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Bihar'],
    path: [[26.120, 85.391], [26.300, 85.480], [26.500, 85.520], [26.595, 85.485]] },

  { name: 'Jaipur – Sawai Madhopur Doubling', type: 'doubling', zone: 'NWR', piu: 'piu-jp',
    lengthKm: 131.00, sanctionedCr: 2284, sanctionYear: 2019, status: 'under_execution', physical: 48.7, funding: 'mor_budgetary',
    terrain: 'Plain', states: ['Rajasthan'],
    path: [[26.912, 75.787], [26.833, 76.049], [26.600, 76.180], [26.300, 76.290], [26.021, 76.345]] },

  { name: 'Phulera – Degana Doubling', type: 'doubling', zone: 'NWR', piu: 'piu-jp',
    lengthKm: 109.00, sanctionedCr: 1842, sanctionYear: 2020, status: 'under_execution', physical: 41.0, funding: 'mor_budgetary',
    terrain: 'Desert fringe', states: ['Rajasthan'],
    path: [[26.876, 75.243], [27.000, 74.980], [27.045, 74.720], [26.950, 74.480], [26.892, 74.276]] },

  { name: 'Bikaner – Suratgarh Electrification', type: 'electrification', zone: 'NWR', piu: 'piu-bkn',
    lengthKm: 148.00, sanctionedCr: 1284, sanctionYear: 2021, status: 'under_execution', physical: 64.9, funding: 'mor_budgetary',
    terrain: 'Desert', states: ['Rajasthan'],
    path: [[28.022, 73.312], [28.300, 73.560], [28.503, 73.735], [28.900, 73.820], [29.320, 73.898]] },

  { name: 'Bikaner Workshop Modernisation', type: 'workshop', zone: 'NWR', piu: 'piu-bkn',
    lengthKm: 0.00, sanctionedCr: 684, sanctionYear: 2021, status: 'under_execution', physical: 57.3, funding: 'deposit_work',
    terrain: 'Urban', states: ['Rajasthan'],
    path: [[28.030, 73.320], [28.036, 73.330]] },

  { name: 'Sahibabad – Meerut Regional Rapid Corridor', type: 'rrts', zone: 'METRO', piu: 'piu-gzb',
    lengthKm: 82.00, sanctionedCr: 30274, sanctionYear: 2019, status: 'under_execution', physical: 74.1, funding: 'spv',
    terrain: 'Urban elevated', states: ['Uttar Pradesh', 'Delhi'],
    path: [[28.683, 77.375], [28.667, 77.437], [28.756, 77.501], [28.833, 77.578], [28.955, 77.686], [28.984, 77.706]] },

  { name: 'Delhi Metro — Rithala–Narela–Kundli Corridor', type: 'metro', zone: 'METRO', piu: 'piu-gzb',
    lengthKm: 26.50, sanctionedCr: 6230, sanctionYear: 2022, status: 'under_execution', physical: 28.4, funding: 'spv',
    terrain: 'Urban elevated', states: ['Delhi', 'Haryana'],
    path: [[28.721, 77.107], [28.735, 77.075], [28.798, 77.048], [28.853, 77.093], [28.883, 77.115]] },

  { name: 'Noida – Greater Noida Aqua Line Extension', type: 'metro', zone: 'METRO', piu: 'piu-gzb',
    lengthKm: 17.40, sanctionedCr: 2991, sanctionYear: 2021, status: 'under_execution', physical: 39.8, funding: 'spv',
    terrain: 'Urban elevated', states: ['Uttar Pradesh'],
    path: [[28.567, 77.325], [28.520, 77.400], [28.480, 77.480], [28.460, 77.530]] },
];

const TYPE_LABEL = {
  new_line: 'New Line', doubling: 'Doubling / Multi-tracking', gauge_conversion: 'Gauge Conversion',
  electrification: 'Electrification', metro: 'Metro', rrts: 'Regional Rapid Transit',
  workshop: 'Workshop', bridge: 'Bridge / ROB',
};
const TYPE_CODE = {
  new_line: 'NL', doubling: 'DBL', gauge_conversion: 'GC', electrification: 'RE',
  metro: 'MTR', rrts: 'RRTS', workshop: 'WS', bridge: 'BR',
};

export const PROJECTS = PROJECT_SEED.map((s, i) => {
  const { name, type, zone, piu: piuId, lengthKm, sanctionedCr, sanctionYear, status, physical, funding, path, terrain, states } = s;
  const mid = pointAlongPath(path, 0.5) || path[0];
  const [lat, lng] = mid;
  const piu = PIUS.find(p => p.id === piuId);
  const sanctionedCost = sanctionedCr * 100;                       // ₹ lakh
  const latestEstimate = Math.round(sanctionedCost * rfloat(1.0, 1.34, 3));
  const financial      = Math.max(0, parseFloat((physical * rfloat(0.86, 1.04)).toFixed(1)));
  const targetYears    = type === 'metro' ? 8 : type === 'new_line' ? 7 : 5;
  const target         = `${sanctionYear + targetYears}-12-31`;
  const elapsedPct     = Math.min(100, (daysBetween(`${sanctionYear}-04-01`, TODAY) / (targetYears * 365)) * 100);
  const plannedPhysical= status === 'commissioned' ? 100 : Math.min(100, parseFloat(elapsedPct.toFixed(1)));
  const variance       = parseFloat((physical - plannedPhysical).toFixed(1));
  const slipMonths     = variance < 0 ? Math.round(Math.abs(variance) / 100 * targetYears * 12) : 0;
  const revised        = slipMonths > 3 ? iso(addDays(new Date(target), slipMonths * 30)) : null;
  const health         = status === 'commissioned' ? 'normal'
                       : variance <= -12 ? 'critical' : variance <= -5 ? 'warning' : 'normal';

  return {
    id: `prj-${String(i + 1).padStart(3, '0')}`,
    code: `RVNL/${zone}/${sanctionYear}/${TYPE_CODE[type]}/${String(i + 1).padStart(2, '0')}`,
    name, type, typeLabel: TYPE_LABEL[type], status, statusLabel: PROJECT_STATUS[status].label,
    zone, piuId, piuName: piu.name, piuCode: piu.code, cpm: piu.cpm,
    lengthKm, lengthM: Math.round(lengthKm * 1000),
    fundingSource: funding,
    sanctionYear, sanctionDate: `${sanctionYear}-02-${String(rint(10, 28)).padStart(2, '0')}`,
    sanctionedCost, latestEstimate,
    targetCompletion: target, revisedCompletion: revised,
    physicalProgress: physical, plannedPhysical, variance, financialProgress: financial,
    expenditure: Math.round(latestEstimate * financial / 100),
    health,
    lat, lng,
    path, terrain, states,
    slipMonths,
  };
});

export const getProject = (id) => PROJECTS.find(p => p.id === id);

/** Chainage (metres) → [lat, lng] on the project's alignment. */
export function chainageToLatLng(project, chainageM) {
  if (!project?.path?.length) return null;
  const f = project.lengthM ? Math.max(0, Math.min(1, chainageM / project.lengthM)) : 0;
  return pointAlongPath(project.path, f);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PACKAGES + CONTRACTS
   ═══════════════════════════════════════════════════════════════════════════ */

const PKG_SCOPES = [
  'Earthwork, minor bridges & formation',
  'Major bridges & viaducts',
  'Tunnelling & portal works',
  'Track linking, ballast & LWR',
  'OHE, TSS & traction distribution',
  'Signalling, telecom & interlocking',
  'Station buildings & platform works',
];

export const PACKAGES = [];
PROJECTS.forEach((p) => {
  const n = p.status === 'tendering' ? 1 : p.lengthKm > 150 ? 5 : p.lengthKm > 60 ? 4 : 3;
  let cursor = 0;
  const segLen = Math.round(p.lengthM / n);
  for (let j = 0; j < n; j++) {
    const from = cursor;
    const to   = j === n - 1 ? p.lengthM : cursor + segLen;
    cursor = to;
    const share = (to - from) / Math.max(p.lengthM, 1) || 1 / n;
    const est   = Math.round(p.latestEstimate * (p.lengthM ? share : 1 / n) * rfloat(0.85, 1.15));
    const ctr   = pick(CONTRACTORS);
    const prog  = p.status === 'tendering' ? 0
                : Math.max(0, Math.min(100, parseFloat((p.physicalProgress * rfloat(0.72, 1.26)).toFixed(1))));
    const awarded = Math.round(est * rfloat(0.88, 1.06));
    PACKAGES.push({
      id: `pkg-${p.id.slice(4)}-${j + 1}`,
      projectId: p.id, projectName: p.name, projectCode: p.code, zone: p.zone, piuId: p.piuId,
      code: `${p.code.split('/').slice(-2).join('')}/PKG-${String(j + 1).padStart(2, '0')}`,
      name: `Package ${j + 1}`,
      scope: PKG_SCOPES[j % PKG_SCOPES.length],
      fromChainageM: from, toChainageM: to,
      estimatedCost: est,
      awardedValue: p.status === 'tendering' ? null : awarded,
      contractorId: p.status === 'tendering' ? null : ctr.id,
      contractorName: p.status === 'tendering' ? null : ctr.name,
      agreementNo: p.status === 'tendering' ? null : `RVNL/${p.piuCode}/AGR/${p.sanctionYear + 1}/${rint(100, 999)}`,
      status: p.status === 'tendering' ? 'tendering' : prog >= 100 ? 'completed' : 'in_progress',
      physicalProgress: prog,
      commencementDate: p.status === 'tendering' ? null : `${p.sanctionYear + 1}-${String(rint(1, 12)).padStart(2, '0')}-01`,
      originalCompletion: `${p.sanctionYear + (p.type === 'metro' ? 7 : 5)}-06-30`,
      billedAmount: p.status === 'tendering' ? 0 : Math.round(awarded * prog / 100 * rfloat(0.9, 1.0)),
      health: prog < p.plannedPhysical - 12 ? 'critical' : prog < p.plannedPhysical - 5 ? 'warning' : 'normal',
    });
  }
});

export const packagesFor = (projectId) => PACKAGES.filter(p => p.projectId === projectId);
export const getPackage   = (id) => PACKAGES.find(p => p.id === id);

/* ═══════════════════════════════════════════════════════════════════════════
   BOQ ITEMS
   ═══════════════════════════════════════════════════════════════════════════ */

const BOQ_TEMPLATES = [
  ['EW-101', 'earthwork', 'Excavation in all kinds of soil including disposal within 1 km lead',            'cum',  620,   180000, 900000],
  ['EW-102', 'earthwork', 'Embankment formation with approved borrow earth, compacted to 98% MDD',          'cum',  480,   240000, 1200000],
  ['EW-115', 'earthwork', 'Blanketing material spread and compacted below formation level',                 'cum',  1180,  40000,  180000],
  ['BR-204', 'bridges',   'PSC box girder casting and launching, span 30.5 m',                              'nos',  9840000, 4,    36],
  ['BR-211', 'bridges',   'RCC well foundation for major bridge piers, dia 6.0 m',                          'm',    186000, 120,  620],
  ['BR-240', 'bridges',   'Minor bridge / box culvert construction complete',                               'nos',  1420000, 8,   48],
  ['TN-301', 'tunnels',   'Tunnel excavation by NATM in Class III rock including support',                  'm',    486000, 400,  3200],
  ['TN-308', 'tunnels',   'Shotcrete lining 150 mm with steel fibre reinforcement',                         'sqm',  4820,  8000,  46000],
  ['TK-401', 'track',     'Supply and linking of 60 kg 90 UTS rails on PSC sleepers',                       'tkm',  8420000, 8,   120],
  ['TK-412', 'track',     'Machine ballast packing, alignment and LWR destressing',                         'tkm',  1240000, 8,   120],
  ['OH-501', 'ohe',       'OHE mast erection, foundation and small part steel',                             'nos',  48000,  600,  4200],
  ['OH-520', 'ohe',       'Contact and catenary wire stringing with regulating equipment',                  'tkm',  2860000, 10,  180],
  ['ST-601', 'snt',       'Electronic interlocking installation and commissioning per station',             'nos',  28400000, 2,  14],
  ['BL-701', 'buildings', 'Station building RCC framed structure with finishing',                           'sqm',  32800,  600,   4800],
];

export const BOQ_ITEMS = [];
PACKAGES.forEach((pkg) => {
  if (pkg.status === 'tendering') return;
  const n = rint(5, 9);
  const chosen = pickN(BOQ_TEMPLATES, n);
  const weights = chosen.map(() => rfloat(0.4, 2.2));
  const wsum = weights.reduce((a, b) => a + b, 0);
  chosen.forEach(([code, head, desc, unit, rate, qlo, qhi], k) => {
    const contractedQty = rint(qlo, qhi);
    const weightage = parseFloat((weights[k] / wsum * 100).toFixed(2));
    /* execution roughly tracks package progress, with item-level spread */
    let execPct = Math.max(0, Math.min(138, pkg.physicalProgress * rfloat(0.55, 1.35)));
    if (chance(0.06)) execPct = rfloat(116, 134);           // deviation cases
    const executedQty = parseFloat((contractedQty * execPct / 100).toFixed(2));
    BOQ_ITEMS.push({
      id: `boq-${pkg.id.slice(4)}-${k + 1}`,
      packageId: pkg.id, projectId: pkg.projectId, contractorId: pkg.contractorId,
      itemCode: code, ussorCode: `USSOR-${code}`, description: desc,
      workHead: head, unit,
      contractedQty, rate: rate / 100,                       // ₹ lakh per unit
      amount: parseFloat((contractedQty * rate / 100 / 100).toFixed(2)),
      executedQty,
      executedPct: parseFloat(execPct.toFixed(1)),
      certifiedQty: parseFloat((executedQty * rfloat(0.86, 1.0)).toFixed(2)),
      weightage,
      isNonSchedule: chance(0.08),
      deviationFlag: execPct > 125 ? 'breached' : execPct > 115 ? 'approaching' : null,
    });
  });
});

export const boqFor = (packageId) => BOQ_ITEMS.filter(b => b.packageId === packageId);

/* ═══════════════════════════════════════════════════════════════════════════
   MILESTONES
   ═══════════════════════════════════════════════════════════════════════════ */

const MILESTONE_TEMPLATES = [
  'DPR approval & sanction',
  'GAD approval from Zonal Railway',
  'Land acquisition — 50% possession',
  'Award of major civil packages',
  'Earthwork completion — 100%',
  'Major bridges completion',
  'Tunnel breakthrough',
  'Track linking completion',
  'OHE charging',
  'S&T commissioning',
  'CRS inspection & sanction',
  'Commercial commissioning',
];

export const MILESTONES = [];
PROJECTS.forEach((p) => {
  const total = MILESTONE_TEMPLATES.length;
  MILESTONE_TEMPLATES.forEach((name, k) => {
    const frac = (k + 1) / total;
    const spanDays = daysBetween(p.sanctionDate, p.targetCompletion);
    const baseline = iso(addDays(new Date(p.sanctionDate), Math.round(spanDays * frac)));
    const doneThreshold = p.physicalProgress;
    const isDone = frac * 100 <= doneThreshold;
    const slip = isDone ? rint(-14, 120) : 0;
    const actual = isDone ? iso(addDays(new Date(baseline), slip)) : null;
    const planned = p.revisedCompletion && !isDone
      ? iso(addDays(new Date(baseline), p.slipMonths * 30))
      : baseline;
    const overdue = !isDone && new Date(planned) < TODAY;
    MILESTONES.push({
      id: `ms-${p.id.slice(4)}-${k + 1}`,
      projectId: p.id, projectName: p.name, zone: p.zone, piuId: p.piuId,
      code: `M${k + 1}`, name,
      baselineFinish: baseline, plannedFinish: planned, actualFinish: actual,
      weightage: parseFloat((100 / total).toFixed(2)),
      isCritical: [2, 4, 6, 7, 10].includes(k),
      status: isDone ? 'completed' : overdue ? 'overdue' : frac * 100 <= doneThreshold + 14 ? 'in_progress' : 'not_started',
      slipDays: isDone ? slip : overdue ? daysBetween(planned, TODAY) : 0,
      predictedSlipDays: !isDone ? rint(0, 140) : 0,
    });
  });
});

export const milestonesFor = (projectId) => MILESTONES.filter(m => m.projectId === projectId);

/* ═══════════════════════════════════════════════════════════════════════════
   LAND PARCELS
   ═══════════════════════════════════════════════════════════════════════════ */

const VILLAGES = ['Gular', 'Shivpuri', 'Byasi', 'Kaudiyala', 'Devprayag', 'Maletha', 'Srinagar Garhwal',
  'Dhari', 'Chamkaur', 'Nangal Kalan', 'Sundarpur', 'Bharatgarh', 'Reasi Khas', 'Sangaldan', 'Dugga',
  'Barbaraiya', 'Piprahi', 'Bakhri', 'Sarai Aquil', 'Jaitpur', 'Bassi Khurd', 'Chaksu', 'Makrana Kalan',
  'Lunkaransar', 'Bawana Khurd', 'Duhai', 'Modinagar Dehat', 'Kharkhauda', 'Aunrihar Dehat', 'Kudarkot'];
const DISTRICTS = ['Tehri Garhwal', 'Pauri Garhwal', 'Rudraprayag', 'Chamoli', 'Dehradun', 'Haridwar',
  'Reasi', 'Ramban', 'Udhampur', 'Kathua', 'Pathankot', 'Ludhiana', 'Ferozepur', 'Ambala', 'Mohali',
  'Rewari', 'Rohtak', 'Agra', 'Firozabad', 'Etawah', 'Mathura', 'Dhaulpur', 'Jhansi', 'Gwalior',
  'Prayagraj', 'Fatehpur', 'Kanpur Dehat', 'Gorakhpur', 'Deoria', 'Siwan', 'Saran', 'Varanasi',
  'Jaunpur', 'Ghazipur', 'Lucknow', 'Barabanki', 'Vaishali', 'Samastipur', 'Muzaffarpur', 'Sitamarhi',
  'Jaipur', 'Tonk', 'Sawai Madhopur', 'Nagaur', 'Bikaner', 'Sri Ganganagar', 'Ghaziabad', 'Meerut',
  'North West Delhi', 'Gautam Buddha Nagar'];
const STATES_BY_ZONE = {
  NR: ['Uttarakhand', 'Punjab', 'Himachal Pradesh', 'Haryana', 'Jammu & Kashmir', 'Delhi'],
  NCR: ['Uttar Pradesh', 'Rajasthan', 'Madhya Pradesh'],
  NER: ['Uttar Pradesh', 'Bihar'],
  NWR: ['Rajasthan'],
  ECR: ['Bihar'],
  METRO: ['Delhi', 'Uttar Pradesh', 'Haryana'],
};
const LAND_FLOW = ['identified', 'sec20a_notified', 'sec20e_declared', 'sec20f_awarded', 'compensation_paid', 'possession_taken'];

export const LAND_PARCELS = [];
PROJECTS.forEach((p) => {
  if (p.lengthKm === 0) return;
  const n = Math.max(6, Math.round(p.lengthKm * rfloat(0.35, 0.8)));
  const segM = Math.round(p.lengthM / n);
  for (let k = 0; k < n; k++) {
    const acquiredBias = p.physicalProgress / 100;
    let status;
    if (chance(0.05)) status = chance(0.5) ? 'disputed' : 'court_stay';
    else if (chance(acquiredBias * 0.92 + 0.05)) status = 'possession_taken';
    else status = pick(LAND_FLOW.slice(0, 5));
    const from = Math.round((k / n) * p.lengthM);
    const to = from + segM;
    const area = rfloat(0.12, 6.4, 3);
    const rate = rfloat(8, 92);                     // ₹ lakh per hectare
    /* Corridor band drawn on the twin — width follows the acquired area. */
    const f0 = from / p.lengthM, f1 = Math.min(1, to / p.lengthM);
    const halfWidth = Math.max(14, Math.min(140, (area * 10000) / Math.max(segM, 1) / 2 * 6));
    const polygon = [
      offsetAcross(p.path, f0, halfWidth),
      offsetAcross(p.path, f1, halfWidth),
      offsetAcross(p.path, f1, -halfWidth),
      offsetAcross(p.path, f0, -halfWidth),
    ].filter(Boolean);
    LAND_PARCELS.push({
      id: `lp-${p.id.slice(4)}-${k + 1}`,
      projectId: p.id, projectName: p.name, zone: p.zone, piuId: p.piuId,
      parcelRef: `${rint(10, 480)}/${rint(1, 9)}`,
      village: pick(VILLAGES),
      district: pick(DISTRICTS),
      state: pick(STATES_BY_ZONE[p.zone] || ['Uttar Pradesh']),
      areaHectare: area,
      landType: chance(0.16) ? 'forest' : chance(0.2) ? 'government' : 'private',
      status, statusLabel: LAND_STATUS[status].label, rag: LAND_STATUS[status].rag,
      fromChainageM: from, toChainageM: to,
      polygon,
      centroid: pointAlongPath(p.path, (f0 + f1) / 2),
      compensationAmount: parseFloat((area * rate).toFixed(2)),
      compensationPaid: ['compensation_paid', 'possession_taken'].includes(status),
      sec20aDate: LAND_STATUS[status].step >= 1 ? daysAgo(rint(400, 1900)) : null,
      sec20eDate: LAND_STATUS[status].step >= 2 ? daysAgo(rint(250, 1400)) : null,
      sec20fDate: LAND_STATUS[status].step >= 3 ? daysAgo(rint(120, 900)) : null,
      possessionDate: status === 'possession_taken' ? daysAgo(rint(30, 800)) : null,
      remarks: status === 'disputed' ? 'Compensation quantum challenged before Arbitrator'
             : status === 'court_stay' ? `Stay granted by Hon'ble High Court — WP ${rint(1000, 9999)}/${rint(2023, 2026)}`
             : null,
    });
  }
});

export const landFor = (projectId) => LAND_PARCELS.filter(l => l.projectId === projectId);

export function landSummary(parcels) {
  const total = parcels.length;
  const taken = parcels.filter(p => p.status === 'possession_taken').length;
  const disputed = parcels.filter(p => ['disputed', 'court_stay'].includes(p.status)).length;
  const blockedM = parcels.filter(p => p.status !== 'possession_taken')
    .reduce((s, p) => s + (p.toChainageM - p.fromChainageM), 0);
  return {
    total, taken, disputed,
    pending: total - taken,
    acquiredPct: total ? parseFloat((taken / total * 100).toFixed(1)) : 0,
    blockedKm: parseFloat((blockedM / 1000).toFixed(1)),
    areaTotal: parseFloat(parcels.reduce((s, p) => s + p.areaHectare, 0).toFixed(2)),
    compensationTotal: parseFloat(parcels.reduce((s, p) => s + p.compensationAmount, 0).toFixed(2)),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLEARANCES
   ═══════════════════════════════════════════════════════════════════════════ */

const CONDITION_TEXTS = [
  'Compensatory afforestation over equivalent non-forest land to be completed',
  'Net Present Value (NPV) payment to be deposited with State Forest Department',
  'Wildlife mitigation plan — underpasses at chainages identified to be constructed',
  'Quarterly compliance report to be submitted to Regional Office, MoEFCC',
  'No felling of trees beyond the sanctioned count of trees',
  'Soil erosion and slope-stabilisation measures at all cut sections',
  'Noise barriers to be provided in habitation stretches',
  'Muck disposal only at designated dumping yards with retaining structures',
];

export const CLEARANCES = [];
export const CLEARANCE_CONDITIONS = [];
PROJECTS.forEach((p) => {
  const types = Object.keys(CLEARANCE_TYPES);
  const applicable = p.type === 'electrification' ? ['gad_approval', 'state_noc', 'crs_sanction']
    : pickN(types, rint(4, 7));
  applicable.forEach((t, k) => {
    const meta = CLEARANCE_TYPES[t];
    const roll = rnd();
    let status, appliedOn = null, grantedOn = null;
    if (p.status === 'commissioned' || roll < 0.46) { status = 'granted'; appliedOn = daysAgo(rint(400, 2000)); grantedOn = daysAgo(rint(60, 380)); }
    else if (roll < 0.62) { status = 'under_process'; appliedOn = daysAgo(rint(60, 420)); }
    else if (roll < 0.74) { status = 'query_raised'; appliedOn = daysAgo(rint(90, 500)); }
    else if (roll < 0.86) { status = 'applied'; appliedOn = daysAgo(rint(20, 180)); }
    else { status = 'not_applied'; }
    const daysPending = appliedOn && !grantedOn ? daysBetween(appliedOn, TODAY) : null;
    const breached = daysPending != null && daysPending > meta.sla;
    const id = `clr-${p.id.slice(4)}-${k + 1}`;
    const affectedCh = p.lengthM ? rint(0, Math.max(1, p.lengthM - 5000)) : null;
    const clrPoint = affectedCh != null ? chainageToLatLng(p, affectedCh) : [p.lat, p.lng];

    let conditionCount = 0;
    if (status === 'granted' && ['forest_stage2', 'environmental', 'wildlife_nbwl'].includes(t)) {
      conditionCount = rint(3, 8);
      pickN(CONDITION_TEXTS, conditionCount).forEach((text, ci) => {
        const closed = chance(0.55);
        CLEARANCE_CONDITIONS.push({
          id: `cnd-${id}-${ci + 1}`, clearanceId: id, projectId: p.id,
          seq: ci + 1, text,
          status: closed ? 'closed' : chance(0.35) ? 'overdue' : 'pending',
          dueDate: daysAhead(rint(-180, 300)),
          closedOn: closed ? daysAgo(rint(10, 300)) : null,
        });
      });
    }
    CLEARANCES.push({
      id, projectId: p.id, projectName: p.name, projectCode: p.code, zone: p.zone, piuId: p.piuId,
      type: t, typeLabel: meta.label, authority: meta.authority, slaDays: meta.sla,
      status,
      statusLabel: { granted: 'Granted', under_process: 'Under Process', query_raised: 'Query Raised', applied: 'Applied', not_applied: 'Not Applied' }[status],
      appliedOn, grantedOn, daysPending, breached,
      portalRef: ['forest_stage1', 'forest_stage2', 'environmental'].includes(t)
        ? `FP/${p.zone}/RAIL/${rint(10000, 99999)}/${rint(2022, 2026)}` : null,
      rag: status === 'granted' ? 'normal' : breached ? 'critical' : status === 'not_applied' ? 'warning' : 'warning',
      conditionCount,
      affectedFromChainageM: affectedCh,
      lat: clrPoint?.[0] ?? p.lat, lng: clrPoint?.[1] ?? p.lng,
    });
  });
});

export const clearancesFor = (projectId) => CLEARANCES.filter(c => c.projectId === projectId);
export const conditionsFor = (clearanceId) => CLEARANCE_CONDITIONS.filter(c => c.clearanceId === clearanceId);

/* ═══════════════════════════════════════════════════════════════════════════
   RISKS
   ═══════════════════════════════════════════════════════════════════════════ */

const RISK_TITLES = {
  land: ['Land possession pending in {v} village', 'Compensation dispute delaying handover at {v}', 'Court stay on acquisition — {v}'],
  forest_ec: ['Forest Clearance Stage-II awaited', 'Compensatory afforestation land not identified', 'Wildlife clearance pending for sanctuary crossing'],
  utility: ['220 kV HT transmission line shifting pending', 'Water pipeline diversion not started', 'OFC cable shifting with BSNL pending'],
  traffic_block: ['Traffic blocks not being granted as per programme', 'Mega block deferred by zonal railway', 'Power block availability below requirement'],
  contractor: ['Contractor mobilisation below contractual commitment', 'Sub-contractor payment dispute affecting labour', 'Plant availability short of deployment schedule'],
  funds: ['Budget allocation below projected requirement', 'Delay in PFMS release affecting contractor cash flow'],
  geology: ['Class IV/V rock encountered beyond DPR assumption', 'Heavy water ingress at tunnel face', 'Slope instability at deep cutting'],
  monsoon: ['Monsoon working window shorter than programmed', 'Flooding of work front at river crossing'],
  interface: ['GAD approval pending with zonal railway', 'Interface with ongoing zonal works at station yard'],
  approval: ['Drawing approval pending with RDSO', 'Speed certificate dependency on CRS schedule'],
};

export const RISKS = [];
PROJECTS.forEach((p) => {
  const n = p.status === 'commissioned' ? rint(0, 2) : rint(3, 9);
  for (let k = 0; k < n; k++) {
    const cat = pick(RISK_CATEGORIES).code;
    const titleTpl = pick(RISK_TITLES[cat] || ['Risk identified']);
    const likelihood = rint(1, 5), impact = rint(2, 5);
    const score = likelihood * impact;
    const riskCh = p.lengthM ? rint(0, p.lengthM) : 0;
    const riskPoint = chainageToLatLng(p, riskCh) || [p.lat, p.lng];
    RISKS.push({
      id: `rsk-${p.id.slice(4)}-${k + 1}`,
      projectId: p.id, projectName: p.name, projectCode: p.code, zone: p.zone, piuId: p.piuId,
      category: cat,
      categoryLabel: RISK_CATEGORIES.find(c => c.code === cat).label,
      title: titleTpl.replace('{v}', pick(VILLAGES)),
      likelihood, impact, score,
      severity: score >= 16 ? 'critical' : score >= 9 ? 'warning' : 'normal',
      exposureAmount: rint(120, 42000),
      exposureDays: rint(15, 420),
      chainageM: riskCh,
      lat: riskPoint[0], lng: riskPoint[1],
      owner: p.cpm,
      status: chance(0.16) ? 'closed' : chance(0.3) ? 'mitigating' : 'open',
      identifiedOn: daysAgo(rint(20, 700)),
      targetClosure: daysAhead(rint(-120, 360)),
      mitigation: pick([
        'Weekly review with District Collector; compensation enhancement proposal submitted',
        'Escalated to Railway Board; follow-up with MoEFCC Regional Office',
        'Additional work front opened to de-link the affected stretch',
        'Contractor issued notice under GCC clause 39 for resource deployment',
        'Revised programme submitted; EOT application under examination',
      ]),
    });
  }
});

export const risksFor = (projectId) => RISKS.filter(r => r.projectId === projectId);

/* ═══════════════════════════════════════════════════════════════════════════
   DAILY SITE REPORTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* Fictional site staff. */
const SE_NAMES = ['Harsh Bijlani', 'Ritika Sodhi', 'Manav Chibber', 'Sneha Dugal', 'Vihaan Kapasi',
  'Aditi Raheja', 'Parth Sabarwal', 'Nupur Bakhtiar', 'Ravish Kaicker', 'Tara Vohra'];

export const DSRS = [];
const activePkgs = PACKAGES.filter(p => p.status === 'in_progress');
pickN(activePkgs, Math.min(46, activePkgs.length)).forEach((pkg) => {
  const days = rint(4, 12);
  for (let d = 0; d < days; d++) {
    const hind = chance(0.42) ? pick(HINDRANCE_TYPES.filter(h => h.code !== 'none')) : HINDRANCE_TYPES[0];
    const target = rint(800, 2400);
    const achieved = Math.round(target * (hind.code === 'none' ? rfloat(0.82, 1.14) : rfloat(0.28, 0.82)));
    const proj = getProject(pkg.projectId);
    const pkgSpan = Math.max(1, pkg.toChainageM - pkg.fromChainageM);
    const fromCh = pkg.fromChainageM + rint(0, Math.round(pkgSpan * 0.5));
    const toCh = Math.min(pkg.toChainageM, fromCh + rint(600, 4200));
    const gpsPoint = chainageToLatLng(proj, (fromCh + toCh) / 2) || [proj.lat, proj.lng];
    DSRS.push({
      id: `dsr-${pkg.id.slice(4)}-${d}`,
      packageId: pkg.id, packageCode: pkg.code, packageName: pkg.name,
      projectId: pkg.projectId, projectName: pkg.projectName, zone: pkg.zone, piuId: pkg.piuId,
      reportDate: daysAgo(d),
      submittedBy: pick(SE_NAMES), submittedRole: chance(0.7) ? 'SITE_ENGINEER' : 'CONTRACTOR_SITE',
      fromChainageM: fromCh,
      toChainageM: toCh,
      gps: { lat: parseFloat(gpsPoint[0].toFixed(5)), lng: parseFloat(gpsPoint[1].toFixed(5)) },
      weather: pick(['Clear', 'Cloudy', 'Rain', 'Heavy Rain', 'Hot']),
      hindranceType: hind.code, hindranceLabel: hind.label,
      hindranceHours: hind.code === 'none' ? 0 : rfloat(0.5, 7.5, 1),
      manpower: { mason: rint(4, 22), helper: rint(12, 60), operator: rint(2, 10), supervisor: rint(1, 4) },
      plant: pickN(['EXC-04', 'BP-01', 'JB-02', 'CRN-11', 'TIP-07', 'DRL-03'], rint(2, 4))
        .map(code => ({ code, hours: rfloat(2, 9, 1) })),
      targetQty: target, achievedQty: achieved,
      unit: pick(['cum', 'sqm', 'm']),
      achievementPct: parseFloat((achieved / target * 100).toFixed(1)),
      photoCount: rint(2, 11),
      narrative: pick([
        'Excavation progressing at south portal. Muck disposal to designated yard.',
        'Embankment compaction completed in two layers; density tests taken.',
        'Girder launching preparation; bearings placed and levelled.',
        'Ballast spreading and packing carried out with tamping machine.',
        'OHE mast foundation concreting at alternate locations.',
        'Work stopped in afternoon due to hindrance recorded below.',
      ]),
      status: d === 0 ? 'submitted' : chance(0.86) ? 'reviewed' : chance(0.5) ? 'submitted' : 'rejected',
      capturedAt: minutesAgo(d * 1440 + rint(60, 600)),
      syncedAt: minutesAgo(d * 1440 + rint(10, 55)),
      deviceId: `FLD-${pkg.piuId.slice(4).toUpperCase()}-${rint(100, 199)}`,
    });
  }
});
DSRS.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

export const dsrFor = (projectId) => DSRS.filter(d => d.projectId === projectId);

/* ═══════════════════════════════════════════════════════════════════════════
   RA BILLS
   ═══════════════════════════════════════════════════════════════════════════ */

const BILL_STATUS = {
  submitted:   { label: 'Submitted',   chip: 'info'    },
  under_check: { label: 'Under Check', chip: 'warning' },
  certified:   { label: 'Certified',   chip: 'accent'  },
  passed:      { label: 'Passed',      chip: 'accent'  },
  paid:        { label: 'Paid',        chip: 'success' },
  rejected:    { label: 'Rejected',    chip: 'danger'  },
};
export { BILL_STATUS };

export const BILLS = [];
PACKAGES.filter(p => p.status === 'in_progress' || p.status === 'completed').forEach((pkg) => {
  const n = rint(2, 9);
  for (let b = 0; b < n; b++) {
    const gross = Math.round(pkg.billedAmount / n * rfloat(0.7, 1.3));
    if (gross <= 0) continue;
    const pvc = Math.round(gross * rfloat(0.01, 0.09));
    const sd  = Math.round(gross * 0.06);
    const itTds = Math.round(gross * 0.02);
    const gstTds = Math.round(gross * 0.02);
    const cess = Math.round(gross * 0.01);
    const ld = chance(0.15) ? Math.round(gross * rfloat(0.01, 0.05)) : 0;
    const deductions = sd + itTds + gstTds + cess + ld;
    const isLatest = b === n - 1;
    const status = isLatest
      ? pick(['submitted', 'under_check', 'certified'])
      : chance(0.9) ? 'paid' : 'passed';
    const submitted = daysAgo(rint(5, 40) + (n - b) * 28);
    BILLS.push({
      id: `bill-${pkg.id.slice(4)}-${b + 1}`,
      packageId: pkg.id, packageCode: pkg.code,
      projectId: pkg.projectId, projectName: pkg.projectName, zone: pkg.zone, piuId: pkg.piuId,
      contractorId: pkg.contractorId, contractorName: pkg.contractorName,
      billNo: b + 1, isFinal: false,
      periodFrom: daysAgo(rint(50, 70) + (n - b) * 28), periodTo: submitted,
      grossAmount: gross, pvcAmount: pvc,
      deductions: { securityDeposit: sd, incomeTaxTds: itTds, gstTds, labourCess: cess, ld },
      totalDeductions: deductions,
      netPayable: gross + pvc - deductions,
      status, statusLabel: BILL_STATUS[status].label,
      submittedAt: submitted,
      ageingDays: daysBetween(submitted, TODAY),
      certifiedBy: ['certified', 'passed', 'paid'].includes(status) ? PIUS.find(x => x.id === pkg.piuId)?.cpm : null,
      pfmsRef: status === 'paid' ? `PFMS/${rint(2025, 2026)}/${rint(100000, 999999)}` : null,
      paidAt: status === 'paid' ? daysAgo(rint(2, 25)) : null,
    });
  }
});
BILLS.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

/* ═══════════════════════════════════════════════════════════════════════════
   TENDERS
   ═══════════════════════════════════════════════════════════════════════════ */

const TENDER_STAGES = ['nit_published', 'pre_bid', 'bids_received', 'technical_evaluation', 'financial_opening', 'loa_issued', 'agreement_signed'];
const STAGE_LABEL = {
  nit_published: 'NIT Published', pre_bid: 'Pre-Bid Stage', bids_received: 'Bids Received',
  technical_evaluation: 'Technical Evaluation', financial_opening: 'Financial Opening',
  loa_issued: 'LOA Issued', agreement_signed: 'Agreement Signed',
};
export { STAGE_LABEL, TENDER_STAGES };

export const TENDERS = [];
pickN(PROJECTS, 22).forEach((p, i) => {
  const stage = pick(TENDER_STAGES);
  const est = Math.round(p.latestEstimate * rfloat(0.06, 0.34));
  const bidders = ['bids_received', 'technical_evaluation', 'financial_opening', 'loa_issued', 'agreement_signed'].includes(stage) ? rint(3, 11) : 0;
  const l1 = bidders ? pick(CONTRACTORS) : null;
  const l1Value = bidders ? Math.round(est * rfloat(0.87, 1.12)) : null;
  TENDERS.push({
    id: `tnd-${i + 1}`,
    tenderNo: `RVNL/${p.piuCode}/${CURRENT_FY.slice(0, 4)}/OT/${String(rint(10, 99))}`,
    projectId: p.id, projectName: p.name, projectCode: p.code, zone: p.zone, piuId: p.piuId,
    scope: pick(PKG_SCOPES),
    estimatedValue: est,
    stage, stageLabel: STAGE_LABEL[stage],
    portal: pick(['IREPS', 'IREPS', 'GeM', 'CPP Portal']),
    nitDate: daysAgo(rint(20, 300)),
    closingDate: daysAhead(rint(-220, 40)),
    biddersCount: bidders,
    l1ContractorId: l1?.id || null,
    l1Name: l1?.name || null,
    l1Value,
    variancePct: l1Value ? parseFloat(((l1Value - est) / est * 100).toFixed(1)) : null,
    cycleDays: rint(45, 340),
    rag: stage === 'agreement_signed' ? 'normal' : rint(0, 10) > 7 ? 'critical' : 'warning',
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SAFETY & QUALITY
   ═══════════════════════════════════════════════════════════════════════════ */

export const SAFETY_EVENTS = [];
pickN(PACKAGES.filter(p => p.status === 'in_progress'), 40).forEach((pkg, i) => {
  const n = rint(1, 3);
  const proj = getProject(pkg.projectId);
  for (let k = 0; k < n; k++) {
    const type = pick(['near_miss', 'first_aid', 'lost_time', 'property_damage', 'observation', 'fatality']);
    const isFatal = type === 'fatality' && chance(0.12);
    const evChainage = pkg.fromChainageM + rint(0, Math.max(1, pkg.toChainageM - pkg.fromChainageM));
    const evPoint = chainageToLatLng(proj, evChainage) || [proj.lat, proj.lng];
    SAFETY_EVENTS.push({
      id: `sfty-${i}-${k}`,
      packageId: pkg.id, packageCode: pkg.code, projectId: pkg.projectId, projectName: pkg.projectName,
      zone: pkg.zone, piuId: pkg.piuId, contractorName: pkg.contractorName,
      type: isFatal ? 'fatality' : type === 'fatality' ? 'lost_time' : type,
      typeLabel: { near_miss: 'Near Miss', first_aid: 'First Aid', lost_time: 'Lost Time Injury', property_damage: 'Property Damage', observation: 'Safety Observation', fatality: 'Fatality' }[isFatal ? 'fatality' : type === 'fatality' ? 'lost_time' : type],
      severity: isFatal ? 'critical' : ['lost_time', 'property_damage'].includes(type) ? 'warning' : 'normal',
      description: pick([
        'Worker not wearing full body harness while working at height on pier cap',
        'Excavator swing radius not barricaded near active work front',
        'Scaffolding platform without toe board at abutment shuttering',
        'Slip and fall on wet approach ramp during monsoon',
        'Muck tipper reversed without banksman assistance',
        'Electrical panel found without earthing at batching plant',
      ]),
      chainageM: evChainage,
      lat: evPoint[0], lng: evPoint[1],
      occurredOn: daysAgo(rint(1, 220)),
      status: chance(0.7) ? 'closed' : 'open',
      correctiveAction: 'Toolbox talk conducted; PPE compliance audit scheduled; supervisor counselled',
    });
  }
});

export const NCRS = [];
pickN(PACKAGES.filter(p => p.status === 'in_progress'), 34).forEach((pkg, i) => {
  const n = rint(1, 3);
  for (let k = 0; k < n; k++) {
    const raised = daysAgo(rint(3, 180));
    const open = chance(0.42);
    NCRS.push({
      id: `ncr-${i}-${k}`,
      ncrNo: `NCR-${rint(1000, 9999)}`,
      packageId: pkg.id, packageCode: pkg.code, projectId: pkg.projectId, projectName: pkg.projectName,
      zone: pkg.zone, piuId: pkg.piuId, contractorName: pkg.contractorName,
      description: pick([
        'Concrete cube strength below specified M35 at 28 days — pier P-14',
        'Compaction density 94% against specified 98% MDD in embankment layer',
        'Weld radiography shows porosity beyond acceptance in girder splice',
        'Ballast gradation not conforming to IRS-GE-1 specification',
        'Rail joint gap exceeds permissible tolerance at LWR location',
        'Cover to reinforcement short by 12 mm in abutment cap',
      ]),
      severity: chance(0.2) ? 'critical' : chance(0.5) ? 'warning' : 'normal',
      raisedOn: raised,
      ageingDays: daysBetween(raised, TODAY),
      status: open ? 'open' : 'closed',
      closedOn: open ? null : daysAgo(rint(1, 60)),
      raisedBy: pick(SE_NAMES),
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESOURCES — PLANT & MANPOWER
   ═══════════════════════════════════════════════════════════════════════════ */

const PLANT_TYPES = [
  ['Excavator', 'EXC'], ['Batching Plant', 'BP'], ['Drill Jumbo', 'JB'], ['Crawler Crane', 'CRN'],
  ['Tipper', 'TIP'], ['Rock Drill', 'DRL'], ['Tamping Machine', 'TMP'], ['Tower Wagon', 'TWR'],
  ['Piling Rig', 'PLR'], ['Transit Mixer', 'TMX'],
];

export const PLANT = [];
pickN(PACKAGES.filter(p => p.status === 'in_progress'), 50).forEach((pkg, i) => {
  const proj = getProject(pkg.projectId);
  pickN(PLANT_TYPES, rint(3, 6)).forEach(([label, code], k) => {
    const committed = rint(2, 12);
    const deployed = Math.max(0, committed - rint(0, 5));
    const span = Math.max(1, pkg.toChainageM - pkg.fromChainageM);
    const plantCh = pkg.fromChainageM + Math.round(span * rfloat(0.05, 0.95));
    const plantPt = chainageToLatLng(proj, plantCh) || [proj?.lat, proj?.lng];
    PLANT.push({
      chainageM: plantCh, lat: plantPt[0], lng: plantPt[1],
      id: `plt-${i}-${k}`,
      packageId: pkg.id, packageCode: pkg.code, projectId: pkg.projectId, projectName: pkg.projectName,
      zone: pkg.zone, piuId: pkg.piuId, contractorName: pkg.contractorName,
      type: label, code: `${code}-${String(rint(1, 24)).padStart(2, '0')}`,
      committed, deployed,
      shortfall: committed - deployed,
      utilisationPct: rfloat(38, 96, 1),
      idleDays: rint(0, 68),
      status: deployed === 0 ? 'not_deployed' : deployed < committed ? 'short' : 'ok',
    });
  });
});

export const MANPOWER = PACKAGES.filter(p => p.status === 'in_progress').slice(0, 60).map((pkg, i) => {
  const committed = rint(120, 900);
  const deployed = Math.max(20, committed - rint(0, 420));
  return {
    id: `mp-${i}`,
    packageId: pkg.id, packageCode: pkg.code, projectId: pkg.projectId, projectName: pkg.projectName,
    zone: pkg.zone, piuId: pkg.piuId, contractorName: pkg.contractorName,
    committed, deployed,
    shortfallPct: parseFloat(((committed - deployed) / committed * 100).toFixed(1)),
    trades: { mason: rint(10, 60), helper: rint(40, 400), operator: rint(5, 40), technician: rint(4, 30), supervisor: rint(3, 18) },
    status: deployed / committed < 0.6 ? 'critical' : deployed / committed < 0.85 ? 'warning' : 'normal',
  };
});

/* ═══════════════════════════════════════════════════════════════════════════
   DOCUMENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const DOC_TYPES = [
  ['dpr', 'Detailed Project Report'], ['gad', 'General Arrangement Drawing'], ['drawing', 'Construction Drawing'],
  ['contract', 'Contract Agreement'], ['test_cert', 'Test Certificate'], ['correspondence', 'Correspondence'],
  ['clearance_doc', 'Clearance Document'], ['bill', 'Bill Document'],
];

export const DOCUMENTS = [];
PROJECTS.forEach((p) => {
  const n = rint(4, 11);
  for (let k = 0; k < n; k++) {
    const [type, label] = pick(DOC_TYPES);
    const ver = rint(1, 4);
    DOCUMENTS.push({
      id: `doc-${p.id.slice(4)}-${k + 1}`,
      projectId: p.id, projectName: p.name, zone: p.zone, piuId: p.piuId,
      type, typeLabel: label,
      title: `${label} — ${p.name}${type === 'drawing' ? ` (Sheet ${rint(1, 48)})` : ''}`,
      currentVersion: ver,
      revisionLabel: `Rev ${String.fromCharCode(64 + ver)}`,
      sizeBytes: rint(240000, 86000000),
      mimeType: pick(['application/pdf', 'application/pdf', 'image/tiff', 'application/vnd.dwg']),
      sha256: Array.from({ length: 8 }, () => Math.floor(rng() * 16).toString(16)).join('') + '…',
      uploadedBy: pick(SE_NAMES.concat(PIUS.map(x => x.cpm))),
      uploadedAt: daysAgo(rint(2, 900)),
      isSuperseded: chance(0.12),
      tags: pickN(['sanction', 'approved', 'for-construction', 'as-built', 'statutory', 'audit'], rint(1, 3)),
    });
  }
});
DOCUMENTS.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

/* ═══════════════════════════════════════════════════════════════════════════
   APPROVALS
   ═══════════════════════════════════════════════════════════════════════════ */

const APPROVAL_KINDS = [
  ['ra_bill', 'RA Bill'], ['variation', 'Variation Order'], ['eot', 'Extension of Time'],
  ['rebaseline', 'Milestone Rebaseline'], ['tender_award', 'Tender Award'], ['rate_analysis', 'Non-Schedule Rate Analysis'],
  ['dsr', 'Daily Site Report'],
];
// eslint-disable-next-line no-unused-vars
const LEVELS = ['site', 'piu', 'regional', 'hq', 'ministry'];

export const APPROVALS = [];
for (let i = 0; i < 48; i++) {
  const p = pick(PROJECTS.filter(x => x.status === 'under_execution'));
  const [kind, kindLabel] = pick(APPROVAL_KINDS);
  const amount = kind === 'dsr' ? null : rint(80, 82000);
  const chain = amount == null ? ['site', 'piu']
    : amount < 5000 ? ['piu']
    : amount < 50000 ? ['piu', 'regional']
    : amount < 200000 ? ['piu', 'regional', 'hq']
    : ['piu', 'regional', 'hq', 'ministry'];
  const doneCount = rint(0, chain.length - 1);
  const raised = daysAgo(rint(1, 46));
  APPROVALS.push({
    id: `apr-${i + 1}`,
    entityType: kind, entityLabel: kindLabel,
    projectId: p.id, projectName: p.name, projectCode: p.code, zone: p.zone, piuId: p.piuId,
    title: `${kindLabel} — ${p.name}`,
    amount,
    requiredLevels: chain,
    currentLevel: chain[doneCount],
    steps: chain.map((lv, k) => ({
      level: lv,
      levelLabel: { site: 'Site', piu: 'PIU (CPM)', regional: 'Regional (GM)', hq: 'Corporate HQ', ministry: 'Railway Board' }[lv],
      status: k < doneCount ? 'approved' : k === doneCount ? 'pending' : 'waiting',
      actedBy: k < doneCount ? pick(PIUS).cpm : null,
      actedAt: k < doneCount ? daysAgo(rint(1, 40)) : null,
      remarks: k < doneCount ? pick(['Recommended for approval', 'Verified and forwarded', 'Approved within delegated powers', 'Concurred by Finance']) : null,
    })),
    status: 'pending',
    raisedBy: pick(SE_NAMES),
    raisedAt: raised,
    ageingDays: daysBetween(raised, TODAY),
    slaBreached: daysBetween(raised, TODAY) > 7,
  });
}
APPROVALS.sort((a, b) => b.ageingDays - a.ageingDays);

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT LOG
   ═══════════════════════════════════════════════════════════════════════════ */

const AUDIT_ACTIONS = [
  ['approve', 'ra_bill', 'Certified RA Bill'], ['create', 'measurement', 'Recorded MB entry'],
  ['update', 'land_parcel', 'Updated land parcel status'], ['approve', 'variation', 'Approved variation order'],
  ['create', 'dsr', 'Submitted daily site report'], ['download', 'document', 'Downloaded document'],
  ['update', 'clearance', 'Advanced clearance stage'], ['reject', 'ra_bill', 'Returned RA Bill'],
  ['create', 'risk', 'Raised new risk'], ['login', 'session', 'User signed in'],
  ['export', 'report', 'Exported MPR'], ['approve', 'tender_award', 'Approved tender award'],
];

export const AUDIT_LOG = [];
let prevHash = null;
for (let i = 0; i < 220; i++) {
  const [action, entity, label] = pick(AUDIT_ACTIONS);
  const p = pick(PROJECTS);
  const hash = Array.from({ length: 12 }, () => Math.floor(rng() * 16).toString(16)).join('');
  AUDIT_LOG.push({
    id: 220 - i,
    occurredAt: minutesAgo(i * rint(11, 190)),
    actor: pick(SE_NAMES.concat(PIUS.map(x => x.cpm))),
    actorRole: pick(['SITE_ENGINEER', 'PIU_CPM', 'HQ_FINANCE', 'REGIONAL_HEAD', 'CONTRACTOR_PM']),
    actorIp: `10.${rint(10, 60)}.${rint(1, 250)}.${rint(2, 250)}`,
    action, actionLabel: label,
    entityType: entity,
    entityId: `${entity.slice(0, 3)}-${rint(1000, 9999)}`,
    projectId: p.id, projectName: p.name, zone: p.zone,
    reason: chance(0.3) ? pick(['Within delegated powers', 'As per joint measurement', 'Site verification completed', 'Finance concurrence obtained']) : null,
    hash, prevHash,
    chainOk: true,
  });
  prevHash = hash;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALERTS  (shape matches the existing AlertPanel contract)
   ═══════════════════════════════════════════════════════════════════════════ */

function buildAlerts() {
  const out = [];
  let n = 1;
  const push = (type, category, title, message, project) => out.push({
    alertId: `ALT-${String(n++).padStart(3, '0')}`,
    type, category, title, message,
    zone: project?.zone || 'ALL',
    assetId: project?.code || null,
    projectId: project?.id || null,
    acknowledged: false,
    createdAt: minutesAgo(rint(3, 2600)),
  });

  CLEARANCES.filter(c => c.breached).slice(0, 6).forEach(c => {
    const p = getProject(c.projectId);
    push('critical', 'clearance', `${c.typeLabel} — SLA breached`,
      `${c.typeLabel} for ${p.name} pending ${c.daysPending} days against an SLA of ${c.slaDays} days with ${c.authority}.`, p);
  });
  BOQ_ITEMS.filter(b => b.deviationFlag === 'breached').slice(0, 5).forEach(b => {
    const p = getProject(b.projectId);
    push('critical', 'contract', `BOQ deviation breached — ${b.itemCode}`,
      `Item ${b.itemCode} executed at ${b.executedPct}% of contracted quantity, beyond the 125% limit. A variation order is required before further measurement.`, p);
  });
  LAND_PARCELS.filter(l => l.status === 'court_stay').slice(0, 4).forEach(l => {
    const p = getProject(l.projectId);
    push('critical', 'land', `Court stay on land acquisition — ${l.village}`,
      `Parcel ${l.parcelRef} at ${l.village} is under court stay. ${l.remarks}`, p);
  });
  MILESTONES.filter(m => m.status === 'overdue').slice(0, 6).forEach(m => {
    const p = getProject(m.projectId);
    push('critical', 'schedule', `Milestone overdue — ${m.name}`,
      `${m.code} "${m.name}" is ${m.slipDays} days past its planned finish of ${fmtDate(m.plannedFinish)}.`, p);
  });
  BILLS.filter(b => b.status === 'under_check' && b.ageingDays > 21).slice(0, 5).forEach(b => {
    const p = getProject(b.projectId);
    push('warning', 'cost', `RA Bill ageing — ${b.packageCode}`,
      `RA Bill ${b.billNo} of ${inr(b.netPayable)} has been under check for ${b.ageingDays} days, beyond the 21-day norm.`, p);
  });
  SAFETY_EVENTS.filter(s => s.severity === 'critical').slice(0, 3).forEach(s => {
    const p = getProject(s.projectId);
    push('critical', 'safety', `Reportable incident — ${s.typeLabel}`,
      `${s.description} at ${chainage(s.chainageM)}, ${s.packageCode}. Contractor: ${s.contractorName}.`, p);
  });
  NCRS.filter(x => x.status === 'open' && x.ageingDays > 30).slice(0, 5).forEach(x => {
    const p = getProject(x.projectId);
    push('warning', 'quality', `NCR open ${x.ageingDays} days — ${x.ncrNo}`, x.description, p);
  });
  CONTRACTORS.filter(c => c.pgExpiryDays < 30).slice(0, 3).forEach(c => {
    push('warning', 'contract', `Performance Guarantee expiring — ${c.name}`,
      `PG for ${c.name} ${c.pgExpiryDays < 0 ? `expired ${Math.abs(c.pgExpiryDays)} days ago` : `expires in ${c.pgExpiryDays} days`}. Renewal must be obtained before the next bill is certified.`, null);
  });
  DSRS.filter(d => d.hindranceType === 'block_not_given').slice(0, 3).forEach(d => {
    const p = getProject(d.projectId);
    push('warning', 'schedule', `Traffic block not granted — ${d.packageCode}`,
      `Block not granted on ${fmtDate(d.reportDate)}, ${d.hindranceHours} h lost at ${chainage(d.fromChainageM)}.`, p);
  });
  push('info', 'schedule', 'Field devices synced',
    `${rint(38, 74)} field devices synced in the last hour. 3 devices have queued operations pending more than 72 hours.`, null);
  push('info', 'cost', 'PFMS reconciliation complete',
    `${rint(18, 44)} payments totalling ${inr(rint(24000, 88000))} reconciled against PFMS for ${CURRENT_FY}.`, null);

  return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
export const ALERTS = buildAlerts();

/* ═══════════════════════════════════════════════════════════════════════════
   AI ADVISORIES  (shape matches the existing AdvisoryPanel contract)
   ═══════════════════════════════════════════════════════════════════════════ */

export const ADVISORIES = [
  {
    advisoryId: 'ADV-DLY-114', priority: 'high', template: 'delay_cluster',
    title: 'Rishikesh–Karnaprayag Package 3 tunnelling will miss its Dec-2026 milestone by an estimated 84 days',
    rootCause: {
      primary: 'Heading advance at the T-8 south portal has averaged 42 m/month against a planned 78 m/month for five consecutive months. At the current rate the remaining 3,180 m needs 76 months, not the 41 months in the approved programme.',
      contributing: 'Class IV/V rock encountered from KM 143+820 was not anticipated in the DPR geological profile; support type changed to heavy steel ribs, adding roughly 9 days per 100 m. Two of four drill jumbos have been unavailable since May.',
      systemic: 'Geological risk was carried at DPR-stage confidence straight into the contract programme without a contingency band. Packages with tunnel length above 5 km show the same pattern in 4 of 6 RVNL hill projects — the planning norm for hard-rock advance rate needs revision, not just this schedule.',
    },
    evidence: [
      'Advance rate 42 m/month against 78 planned — 5-month rolling average',
      'Support type changed to Class IV from KM 143+820 (DSR dated 14-Mar-2026)',
      'Drill jumbos JB-02 and JB-04 idle 61 and 48 days year-to-date (plant register)',
      'Comparable: T-5 and T-6 on the same project slipped 71 and 96 days on the same cause',
    ],
    recommendations: [
      'Approve a second heading from the north portal — recovers an estimated 40 to 50 days',
      'Escalate jumbo availability to the contractor under GCC clause 39 (resource deployment)',
      'Re-baseline Package 3 milestones M7 to M9 and revise the DPR geological contingency',
      'Apply the revised hard-rock advance norm to the three tunnel packages still at tender stage',
    ],
    impact: -12,
  },
  {
    advisoryId: 'ADV-LND-207', priority: 'high', template: 'land_cluster',
    title: '214 km of alignment across the portfolio is blocked by land not in possession — 61% concentrated in 4 districts',
    rootCause: {
      primary: 'Of 2,140 parcels pending possession, 1,306 lie in four districts. Three of those four have a §20F award passed but compensation undisbursed, which means the delay is administrative rather than legal.',
      contributing: 'Compensation disbursement is waiting on Competent Authority sittings that have averaged one per quarter against the two per quarter assumed in the programme.',
      systemic: 'Land is tracked at parcel level but escalated at project level, so a district-wide bottleneck affecting five projects reads as five separate project problems and never reaches the Collector as one case.',
    },
    evidence: [
      '1,306 of 2,140 pending parcels in 4 districts',
      '§20F award passed but compensation undisbursed on 71% of those',
      'Competent Authority sittings: 1 per quarter against 2 assumed',
      '5 projects affected by the same district-level bottleneck',
    ],
    recommendations: [
      'Raise a consolidated district-wise case with each Collector instead of project-wise follow-up',
      'Request additional Competent Authority sittings for the four districts',
      'Front-load disbursement for parcels on the critical path — 38 parcels unblock 84 km',
      'Add a district dimension to land escalation so cross-project bottlenecks surface automatically',
    ],
    impact: -9,
  },
  {
    advisoryId: 'ADV-CST-331', priority: 'medium', template: 'cost_cluster',
    title: 'Projected cost at completion exceeds sanction by more than 20% on 6 projects — quantity growth, not price variation, is the driver',
    rootCause: {
      primary: 'Six projects are trending to a completion cost above 120% of sanction. Decomposing the overrun, 63% comes from quantity growth against BOQ, 21% from price variation, and 16% from time-related cost.',
      contributing: 'Quantity growth is concentrated in earthwork and blanketing items where DPR-stage soil investigation was limited to 1 borehole per 2 km against the norm of 1 per km.',
      systemic: 'Deviation is being detected at billing stage rather than measurement stage. By the time a variation reaches approval the work is already executed, which removes the option to say no.',
    },
    evidence: [
      '6 projects with projected cost at completion above 120% of sanction',
      'Overrun split — 63% quantity growth, 21% price variation, 16% time-related',
      '14 BOQ items already executed beyond 125% of contracted quantity',
      'Soil investigation density 1 borehole per 2 km against the 1 per km norm',
    ],
    recommendations: [
      'Move the deviation check to measurement entry so 115% raises a block, not a report',
      'Require a variation proposal before executed quantity crosses 110% on any item',
      'Revise DPR soil-investigation norms for embankment-heavy alignments',
      'Review the 14 breached items for retrospective regularisation before the next bill',
    ],
    impact: -7,
  },
  {
    advisoryId: 'ADV-CTR-402', priority: 'medium', template: 'contractor_cluster',
    title: 'Three contractors holding 11 packages score below 62 on the performance index, with schedule adherence the common weakness',
    rootCause: {
      primary: 'Three contractors hold 11 active packages worth ₹18,420 Cr between them and score below 62 on the composite index, against a portfolio median of 78.',
      contributing: 'Schedule adherence is the weakest component for all three (average 51), while quality and safety scores are near the portfolio median — suggesting resourcing rather than capability.',
      systemic: 'Bid capacity is assessed at award against turnover and similar-work experience, but not against the contractor’s live commitment across all RVNL packages. Two of the three were awarded new work while already behind on three packages each.',
    },
    evidence: [
      '11 active packages worth ₹18,420 Cr held by 3 contractors scoring below 62',
      'Schedule adherence average 51 against portfolio median 78',
      'Quality and safety components near median — resourcing, not capability',
      '2 of 3 awarded new work while behind on 3 or more existing packages',
    ],
    recommendations: [
      'Add live RVNL commitment to the bid-capacity check at technical evaluation',
      'Issue GCC clause 39 notices on the 5 worst-performing packages',
      'Withhold further tender participation pending a recovery programme',
      'Review whether package sizes are beyond single-contractor capacity in hill terrain',
    ],
    impact: -6,
  },
  {
    advisoryId: 'ADV-FLD-508', priority: 'low', template: 'data_quality',
    title: 'Field reporting discipline improved to 87% — 9 packages still report fewer than 3 days per week',
    rootCause: {
      primary: 'Daily site report submission across active packages reached 87% of working days this month, up from 61% at rollout.',
      contributing: 'Nine packages still report fewer than three days per week. Seven of the nine are in low-connectivity locations where the offline queue is being used but not flushed.',
      systemic: 'Devices with queued operations older than 72 hours are not being surfaced to the PIU, only to the engineer holding the device.',
    },
    evidence: [
      'DSR submission at 87% of working days, up from 61% at rollout',
      '9 packages reporting under 3 days per week',
      '7 of 9 in low-connectivity locations with unflushed offline queues',
      '3 devices holding queued operations older than 72 hours',
    ],
    recommendations: [
      'Surface stale sync queues on the PIU dashboard, not only on the device',
      'Provide offline map packs to the seven low-connectivity packages',
      'Include reporting regularity in the monthly PIU review pack',
    ],
    impact: 4,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO AGGREGATES
   ═══════════════════════════════════════════════════════════════════════════ */

export function portfolioStats(projects = PROJECTS) {
  const ids = new Set(projects.map(p => p.id));
  const totalSanction = projects.reduce((s, p) => s + p.sanctionedCost, 0);
  const totalEstimate = projects.reduce((s, p) => s + p.latestEstimate, 0);
  const totalExpenditure = projects.reduce((s, p) => s + p.expenditure, 0);
  const active = projects.filter(p => p.status === 'under_execution');
  const wsum = active.reduce((s, p) => s + p.latestEstimate, 0) || 1;
  const physical = active.reduce((s, p) => s + p.physicalProgress * p.latestEstimate, 0) / wsum;
  const planned  = active.reduce((s, p) => s + p.plannedPhysical * p.latestEstimate, 0) / wsum;

  const land = landSummary(LAND_PARCELS.filter(l => ids.has(l.projectId)));
  const clr  = CLEARANCES.filter(c => ids.has(c.projectId));
  const ms   = MILESTONES.filter(m => ids.has(m.projectId));
  const slipped = ms.filter(m => m.status === 'overdue' || (m.status === 'completed' && m.slipDays > 0));
  const risks = RISKS.filter(r => ids.has(r.projectId) && r.status !== 'closed');
  const atRisk = projects.filter(p => p.health !== 'normal' && p.status === 'under_execution');
  const safety = SAFETY_EVENTS.filter(s => ids.has(s.projectId));
  const lti = safety.filter(s => ['lost_time', 'fatality'].includes(s.type)).length;

  return {
    projectCount: projects.length,
    activeCount: active.length,
    totalSanction, totalEstimate, totalExpenditure,
    burnPct: totalEstimate ? parseFloat((totalExpenditure / totalEstimate * 100).toFixed(1)) : 0,
    physicalProgress: parseFloat(physical.toFixed(1)),
    plannedProgress: parseFloat(planned.toFixed(1)),
    variance: parseFloat((physical - planned).toFixed(1)),
    land,
    clearancesPending: clr.filter(c => c.status !== 'granted').length,
    clearancesBreached: clr.filter(c => c.breached).length,
    forestStage2Pending: clr.filter(c => c.type === 'forest_stage2' && c.status !== 'granted').length,
    milestonesTotal: ms.length,
    milestonesSlipped: slipped.length,
    slippagePct: ms.length ? parseFloat((slipped.length / ms.length * 100).toFixed(1)) : 0,
    avgSlipDays: slipped.length ? Math.round(slipped.reduce((s, m) => s + Math.abs(m.slipDays), 0) / slipped.length) : 0,
    projectsAtRisk: atRisk.length,
    criticalProjects: projects.filter(p => p.health === 'critical' && p.status === 'under_execution').length,
    riskExposure: risks.reduce((s, r) => s + r.exposureAmount, 0),
    openRisks: risks.length,
    criticalRisks: risks.filter(r => r.severity === 'critical').length,
    ltifr: parseFloat((lti / Math.max(1, projects.length) * 0.9).toFixed(2)),
    safetyIncidents: safety.length,
    fatalities: safety.filter(s => s.type === 'fatality').length,
    openNcrs: NCRS.filter(n => ids.has(n.projectId) && n.status === 'open').length,
  };
}

/* Budget vs expenditure grouped by zone */
export function budgetByZone(projects = PROJECTS) {
  const map = {};
  projects.forEach(p => {
    if (!map[p.zone]) map[p.zone] = { zone: p.zone, allocated: 0, committed: 0, expenditure: 0, projects: 0 };
    map[p.zone].allocated += p.sanctionedCost;
    map[p.zone].committed += p.latestEstimate;
    map[p.zone].expenditure += p.expenditure;
    map[p.zone].projects += 1;
  });
  return Object.values(map)
    .map(r => ({ ...r, burnPct: parseFloat((r.expenditure / (r.committed || 1) * 100).toFixed(1)) }))
    .sort((a, b) => b.allocated - a.allocated);
}

/* Portfolio S-curve: planned / actual / AI forecast, FY months */
export function sCurve(projects = PROJECTS) {
  const labels = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const monthIdx = 3;                                    // Jul = index 3 in FY
  const planned = labels.map((_, i) => parseFloat((4.4 + i * 8.7 + (i > 8 ? i * 1.4 : 0)).toFixed(1)));
  const actual = labels.map((_, i) => (i <= monthIdx ? parseFloat((3.9 + i * 7.4).toFixed(1)) : null));
  const last = actual[monthIdx];
  const forecast = labels.map((_, i) => {
    if (i < monthIdx) return null;
    if (i === monthIdx) return last;
    return parseFloat((last + (i - monthIdx) * 7.1).toFixed(1));
  });
  return { labels, planned, actual, forecast };
}

/* 5×5 risk heatmap counts */
export function riskHeatmap(risks = RISKS.filter(r => r.status !== 'closed')) {
  const grid = [];
  for (let impact = 5; impact >= 1; impact--) {
    const row = [];
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const cell = risks.filter(r => r.likelihood === likelihood && r.impact === impact);
      row.push({ likelihood, impact, count: cell.length, score: likelihood * impact, risks: cell.slice(0, 5) });
    }
    grid.push(row);
  }
  return grid;
}

/* Top bottlenecks, cause-tagged */
export function bottlenecks(projects = PROJECTS) {
  const ids = new Set(projects.map(p => p.id));
  return RISKS
    .filter(r => ids.has(r.projectId) && r.status !== 'closed' && r.score >= 9)
    .sort((a, b) => b.exposureAmount - a.exposureAmount)
    .slice(0, 8)
    .map(r => {
      const p = getProject(r.projectId);
      return {
        id: r.id, cause: r.category, causeLabel: r.categoryLabel.toUpperCase(),
        label: r.title, projectId: r.projectId, projectCode: p.code, projectName: p.name,
        affectedKm: parseFloat((r.exposureDays / 28).toFixed(1)),
        exposure: r.exposureAmount, daysOpen: daysBetween(r.identifiedOn, TODAY),
        rag: r.severity,
      };
    });
}

/* Work-head progress rollup for a project */
export function progressByWorkHead(projectId) {
  const pkgIds = new Set(packagesFor(projectId).map(p => p.id));
  const items = BOQ_ITEMS.filter(b => pkgIds.has(b.packageId));
  const map = {};
  items.forEach(b => {
    if (!map[b.workHead]) {
      const wh = WORK_HEADS.find(w => w.code === b.workHead);
      map[b.workHead] = { code: b.workHead, label: wh?.label || b.workHead, unit: b.unit, contracted: 0, executed: 0, value: 0, executedValue: 0 };
    }
    map[b.workHead].contracted += b.contractedQty;
    map[b.workHead].executed += b.executedQty;
    map[b.workHead].value += b.amount;
    map[b.workHead].executedValue += b.amount * Math.min(b.executedPct, 100) / 100;
  });
  return Object.values(map).map(w => ({
    ...w,
    contracted: parseFloat(w.contracted.toFixed(1)),
    executed: parseFloat(w.executed.toFixed(1)),
    pct: w.contracted ? parseFloat((w.executed / w.contracted * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.value - a.value);
}

/* Chainage segments coloured by section health */
export function chainageSegments(projectId) {
  const p = getProject(projectId);
  if (!p || !p.lengthM) return [];
  const pkgs = packagesFor(projectId);
  const parcels = landFor(projectId);
  return pkgs.map(pkg => {
    const blocked = parcels.some(l =>
      l.status !== 'possession_taken' &&
      l.fromChainageM < pkg.toChainageM && l.toChainageM > pkg.fromChainageM);
    return {
      id: pkg.id, code: pkg.code, name: pkg.name,
      fromChainageM: pkg.fromChainageM, toChainageM: pkg.toChainageM,
      widthPct: (pkg.toChainageM - pkg.fromChainageM) / p.lengthM * 100,
      progress: pkg.physicalProgress,
      rag: pkg.health,
      blocked,
      contractorName: pkg.contractorName,
    };
  });
}

/* Structures along the alignment — positioned on the corridor by chainage */
export const STRUCTURES = [];
PROJECTS.filter(p => p.lengthKm > 0).forEach((p) => {
  const n = Math.max(2, Math.round(p.lengthKm / 12));
  const hilly = ['Himalayan', 'Hilly'].includes(p.terrain);
  for (let k = 0; k < n; k++) {
    const type = chance(hilly ? 0.42 : 0.08) ? 'tunnel'
      : chance(0.45) ? 'major_bridge' : chance(0.6) ? 'minor_bridge' : chance(0.5) ? 'rob' : 'station';
    const chainageM = Math.round((k + 0.5) / n * p.lengthM);
    const point = chainageToLatLng(p, chainageM) || [p.lat, p.lng];
    STRUCTURES.push({
      id: `str-${p.id.slice(4)}-${k + 1}`,
      projectId: p.id, projectName: p.name, zone: p.zone,
      type,
      typeLabel: { tunnel: 'Tunnel', major_bridge: 'Major Bridge', minor_bridge: 'Minor Bridge', rob: 'ROB / RUB', station: 'Station' }[type],
      refCode: `${{ tunnel: 'T', major_bridge: 'MB', minor_bridge: 'mB', rob: 'ROB', station: 'STN' }[type]}-${k + 1}`,
      chainageM,
      lengthM: type === 'tunnel' ? rint(320, 14600) : type.includes('bridge') ? rint(18, 940) : rint(30, 180),
      progressPct: Math.max(0, Math.min(100, parseFloat((p.physicalProgress * rfloat(0.6, 1.4)).toFixed(1)))),
      lat: point[0], lng: point[1],
    });
  }
});
STRUCTURES.forEach(s => { s.rag = s.progressPct > 70 ? 'normal' : s.progressPct > 35 ? 'warning' : 'critical'; });

export const structuresFor = (projectId) => STRUCTURES.filter(s => s.projectId === projectId);

/* ═══════════════════════════════════════════════════════════════════════════
   DIGITAL TWIN — alignment progress geometry
   Each package contributes up to three stretches of track:
     done      → already laid / completed        (green)
     active    → work front currently in hand    (orange)
     pending   → not yet started                 (red)
   A stretch is additionally flagged `blocked` when land on it is not in
   possession, which is what actually stops the front from moving.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SEGMENT_STATE = {
  done:    { label: 'Completed',        color: '#16a34a' },
  active:  { label: 'Work in progress', color: '#f59e0b' },
  pending: { label: 'Not started',      color: '#dc2626' },
  blocked: { label: 'Blocked — land',   color: '#7f1d1d' },
};

/**
 * Geo-referenced progress segments for a corridor.
 * @param projectId project
 * @param asOfFactor 0–1 multiplier used by the timeline scrubber to replay
 *        how the corridor looked earlier in the programme (1 = today).
 */
export function alignmentSegments(projectId, asOfFactor = 1) {
  const p = getProject(projectId);
  if (!p || !p.lengthM || !p.path?.length) return [];
  const pkgs = packagesFor(projectId);
  const parcels = landFor(projectId);
  const out = [];

  pkgs.forEach((pkg) => {
    const spanM = Math.max(1, pkg.toChainageM - pkg.fromChainageM);
    const prog = Math.max(0, Math.min(100, pkg.physicalProgress * asOfFactor));
    /* Active band: the front the crews are actually on — never past the end. */
    const activeBand = pkg.status === 'in_progress' && prog < 100
      ? Math.min(100 - prog, Math.max(4, 14 - prog / 12))
      : 0;

    const bands = [
      { state: 'done', from: 0, to: prog },
      { state: 'active', from: prog, to: prog + activeBand },
      { state: 'pending', from: prog + activeBand, to: 100 },
    ].filter(b => b.to - b.from > 0.4);

    bands.forEach((b, bi) => {
      const fromM = pkg.fromChainageM + (b.from / 100) * spanM;
      const toM = pkg.fromChainageM + (b.to / 100) * spanM;
      const blocked = b.state !== 'done' && parcels.some(l =>
        l.status !== 'possession_taken' && l.fromChainageM < toM && l.toChainageM > fromM);
      out.push({
        id: `${pkg.id}-${b.state}-${bi}`,
        projectId, projectName: p.name,
        packageId: pkg.id, packageCode: pkg.code, packageName: pkg.name,
        contractorName: pkg.contractorName,
        state: b.state,
        blocked,
        color: blocked && b.state === 'pending' ? SEGMENT_STATE.blocked.color : SEGMENT_STATE[b.state].color,
        fromChainageM: Math.round(fromM), toChainageM: Math.round(toM),
        lengthKm: parseFloat(((toM - fromM) / 1000).toFixed(2)),
        packageProgress: parseFloat(prog.toFixed(1)),
        coords: slicePath(p.path, fromM / p.lengthM, toM / p.lengthM),
      });
    });
  });

  return out.sort((a, b) => a.fromChainageM - b.fromChainageM);
}

/** Portfolio-level corridor geometry — one lightweight entry per project. */
export function corridorOverview(projects = PROJECTS) {
  return projects.filter(p => p.path?.length > 1).map(p => ({
    id: p.id, name: p.name, code: p.code, zone: p.zone, type: p.type, typeLabel: p.typeLabel,
    health: p.health, status: p.status, physicalProgress: p.physicalProgress,
    lengthKm: p.lengthKm, latestEstimate: p.latestEstimate, piuName: p.piuName,
    path: p.path,
    donePath: p.lengthM ? slicePath(p.path, 0, p.physicalProgress / 100) : p.path,
    lat: p.lat, lng: p.lng,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SITE WORKFORCE — crews on the corridor, visible live on the twin
   ═══════════════════════════════════════════════════════════════════════════ */

const CREW_ROLES = [
  ['Site Engineer', 'SITE_ENGINEER'], ['Junior Engineer', 'SITE_ENGINEER'],
  ['Safety Officer', 'SAFETY'], ['Quality Inspector', 'QUALITY'],
  ['Survey Team Lead', 'SURVEY'], ['Track Gang Supervisor', 'CONTRACTOR_SITE'],
];
const CREW_ACTIVITY = [
  'Formation compaction — layer 3', 'Girder bearing alignment', 'Tunnel face support installation',
  'OHE mast foundation concreting', 'Ballast spreading and packing', 'Pier cap reinforcement',
  'Survey — final location check', 'Rail welding and destressing', 'Culvert box casting',
  'Station platform coping', 'Cable trough laying', 'Blanketing material spread',
];

export const SITE_CREWS = [];
PACKAGES.filter(p => p.status === 'in_progress').forEach((pkg, i) => {
  const proj = getProject(pkg.projectId);
  if (!proj?.path?.length) return;
  const n = rint(1, 3);
  for (let k = 0; k < n; k++) {
    const span = Math.max(1, pkg.toChainageM - pkg.fromChainageM);
    const ch = pkg.fromChainageM + Math.round(span * rfloat(0.05, 0.95));
    const pt = chainageToLatLng(proj, ch) || [proj.lat, proj.lng];
    const [roleLabel, roleCode] = pick(CREW_ROLES);
    const minsAgo = rint(2, 480);
    SITE_CREWS.push({
      id: `crew-${i}-${k}`,
      projectId: pkg.projectId, projectName: pkg.projectName, packageId: pkg.id, packageCode: pkg.code,
      zone: pkg.zone, piuId: pkg.piuId,
      name: pick(SE_NAMES),
      roleLabel, roleCode,
      activity: pick(CREW_ACTIVITY),
      headcount: rint(6, 82),
      chainageM: ch, lat: pt[0], lng: pt[1],
      status: minsAgo < 120 ? 'on_site' : minsAgo < 300 ? 'reported' : 'stale',
      lastPingMins: minsAgo,
      lastPingAt: minutesAgo(minsAgo),
      deviceId: `FLD-${pkg.piuId.slice(4).toUpperCase()}-${rint(100, 199)}`,
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SITE PHOTOS + AI WORK VALIDATION
   A site worker photographs the work front; the vision model reads the frame,
   lists what it can see, and either corroborates the claimed progress or
   flags it for the engineer. Everything below is simulated seed evidence.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WORK_ITEMS = [
  { code: 'earthwork',  label: 'Earthwork & formation',  expects: ['compacted formation layer', 'excavator', 'level control pegs'] },
  { code: 'blanketing', label: 'Blanketing layer',       expects: ['blanket material spread', 'motor grader', 'density test plate'] },
  { code: 'bridge',     label: 'Bridge substructure',    expects: ['pier shuttering', 'reinforcement cage', 'concrete pour'] },
  { code: 'girder',     label: 'Girder launching',       expects: ['launching gantry', 'PSC girder', 'bearing pedestal'] },
  { code: 'tunnel',     label: 'Tunnel heading',         expects: ['shotcrete lining', 'steel rib support', 'drill jumbo'] },
  { code: 'track',      label: 'Track linking',          expects: ['rails laid on sleepers', 'ballast profile', 'fish plated joint'] },
  { code: 'ohe',        label: 'OHE erection',           expects: ['OHE mast', 'cantilever assembly', 'contact wire'] },
  { code: 'station',    label: 'Station building',       expects: ['RCC frame', 'platform coping', 'roof structure'] },
  { code: 'safety',     label: 'Safety compliance',      expects: ['workers in helmets', 'barricading', 'signage'] },
];

const AI_VERDICT = {
  verified:  { label: 'Work verified',    rag: 'normal',   chip: 'success' },
  partial:   { label: 'Partially verified', rag: 'warning', chip: 'warning' },
  flagged:   { label: 'Flagged for review', rag: 'warning', chip: 'warning' },
  rejected:  { label: 'Not corroborated', rag: 'critical', chip: 'danger'  },
  pending:   { label: 'Analysing…',       rag: 'normal',   chip: 'info'    },
};
export { AI_VERDICT };

/** Deterministic-ish scoring shared by seed data and live uploads. */
export function scorePhotoEvidence({ workItem, claimedPct, detections, gpsDeltaM, blurScore }) {
  const item = WORK_ITEMS.find(w => w.code === workItem) || WORK_ITEMS[0];
  const expected = item.expects.length;
  const matched = detections.filter(d => d.matchesScope).length;
  const coverage = expected ? matched / expected : 0;
  let estimate = Math.round(Math.max(0, Math.min(100, coverage * 100 * 0.72 + (detections.length ? 14 : 0))));
  if (claimedPct != null) estimate = Math.round(Math.min(100, (estimate * 0.62) + (claimedPct * 0.38)));
  const gap = claimedPct == null ? 0 : claimedPct - estimate;
  const geoOk = gpsDeltaM == null || gpsDeltaM <= 250;
  const clear = blurScore == null || blurScore < 0.45;

  let verdict;
  if (!geoOk) verdict = 'flagged';
  else if (!clear) verdict = 'partial';
  else if (coverage >= 0.66 && gap <= 12) verdict = 'verified';
  else if (coverage >= 0.34 && gap <= 25) verdict = 'partial';
  else if (coverage < 0.34 && gap > 25) verdict = 'rejected';
  else verdict = 'flagged';

  const confidence = parseFloat(Math.max(0.42, Math.min(0.98,
    0.5 + coverage * 0.4 - Math.abs(gap) / 260 - (geoOk ? 0 : 0.18) - (clear ? 0 : 0.1))).toFixed(2));

  return {
    verdict, confidence,
    estimatedPct: estimate,
    claimedPct: claimedPct ?? null,
    gapPct: claimedPct == null ? null : parseFloat(gap.toFixed(1)),
    checks: [
      { label: 'Scope items visible in frame', pass: coverage >= 0.34, detail: `${matched} of ${expected} expected elements detected` },
      { label: 'GPS within work front', pass: geoOk, detail: gpsDeltaM == null ? 'No GPS supplied' : `${Math.round(gpsDeltaM)} m from reported chainage` },
      { label: 'Image quality sufficient', pass: clear, detail: clear ? 'Sharp, adequately lit' : 'Motion blur / low light detected' },
      /* Only over-claiming matters — a frame that shows more than was claimed is not a defect. */
      { label: 'Claimed vs observed progress', pass: claimedPct == null || gap <= 12,
        detail: claimedPct == null ? 'No claim recorded'
          : gap > 12 ? `Claimed ${claimedPct}%, model reads only ${estimate}%`
          : `Claimed ${claimedPct}%, model reads ${estimate}%` },
    ],
  };
}

function buildDetections(workItem, quality) {
  const item = WORK_ITEMS.find(w => w.code === workItem) || WORK_ITEMS[0];
  const noise = ['site vehicle', 'stacked material', 'worker', 'temporary shed', 'survey tripod'];
  const keep = quality === 'high' ? item.expects.length
    : quality === 'mid' ? Math.max(1, item.expects.length - 1)
    : 1;
  const out = item.expects.slice(0, keep).map(label => ({
    label, matchesScope: true,
    confidence: parseFloat(rfloat(quality === 'high' ? 0.82 : 0.6, 0.97).toFixed(2)),
  }));
  pickN(noise, rint(1, 2)).forEach(label => out.push({
    label, matchesScope: false, confidence: parseFloat(rfloat(0.55, 0.9).toFixed(2)),
  }));
  return out;
}

/** Deterministic frame read used when a worker uploads a photo from the twin.
 *  `seed` is derived from the file itself so the same frame always reads the
 *  same way — a stand-in for the vision model's response. */
export function simulateFrameAnalysis(workItem, seed = 1) {
  const item = WORK_ITEMS.find(w => w.code === workItem) || WORK_ITEMS[0];
  const s = Math.max(1, Math.abs(Math.round(seed)));
  const quality = s % 7 === 0 ? 'low' : s % 3 === 0 ? 'mid' : 'high';
  const keep = quality === 'high' ? item.expects.length
    : quality === 'mid' ? Math.max(1, item.expects.length - 1) : 1;
  const detections = item.expects.slice(0, keep).map((label, i) => ({
    label, matchesScope: true,
    confidence: parseFloat(Math.max(0.4, 0.96 - i * 0.06 - (quality === 'low' ? 0.22 : 0)).toFixed(2)),
  }));
  const extras = ['worker in PPE', 'site vehicle', 'stacked material', 'temporary shed'];
  detections.push({
    label: extras[s % extras.length], matchesScope: false,
    confidence: parseFloat((0.58 + (s % 34) / 100).toFixed(2)),
  });
  return {
    detections, quality,
    blurScore: quality === 'low' ? 0.63 : quality === 'mid' ? 0.31 : 0.12,
    gpsDeltaM: s % 11 === 0 ? 380 + (s % 700) : 6 + (s % 130),
  };
}

export const SITE_PHOTOS = [];
PACKAGES.filter(p => p.status === 'in_progress').slice(0, 64).forEach((pkg, i) => {
  const proj = getProject(pkg.projectId);
  if (!proj?.path?.length) return;
  const n = rint(1, 4);
  for (let k = 0; k < n; k++) {
    const span = Math.max(1, pkg.toChainageM - pkg.fromChainageM);
    const ch = pkg.fromChainageM + Math.round(span * rfloat(0.02, 0.98));
    const pt = chainageToLatLng(proj, ch) || [proj.lat, proj.lng];
    const workItem = pick(WORK_ITEMS).code;
    const quality = chance(0.56) ? 'high' : chance(0.6) ? 'mid' : 'low';
    const detections = buildDetections(workItem, quality);
    const claimedPct = rint(20, 100);
    const gpsDeltaM = chance(0.12) ? rint(280, 1900) : rint(4, 180);
    const blurScore = quality === 'low' ? rfloat(0.45, 0.85) : rfloat(0.05, 0.4);
    const ai = scorePhotoEvidence({ workItem, claimedPct, detections, gpsDeltaM, blurScore });
    const minsAgo = rint(20, 20000);
    SITE_PHOTOS.push({
      id: `ph-${i}-${k}`,
      projectId: pkg.projectId, projectName: pkg.projectName,
      packageId: pkg.id, packageCode: pkg.code, zone: pkg.zone, piuId: pkg.piuId,
      workItem, workItemLabel: (WORK_ITEMS.find(w => w.code === workItem) || {}).label,
      capturedBy: pick(SE_NAMES),
      capturedRole: chance(0.62) ? 'Site Engineer' : chance(0.5) ? 'Safety Officer' : 'Contractor Supervisor',
      capturedAt: minutesAgo(minsAgo),
      minsAgo,
      chainageM: ch, lat: pt[0], lng: pt[1],
      gpsDeltaM, blurScore: parseFloat(blurScore.toFixed(2)),
      detections,
      ...ai,
      reviewStatus: ai.verdict === 'verified' ? 'auto_accepted' : chance(0.5) ? 'engineer_review' : 'open',
      note: pick([
        'Layer compacted, density test taken at three points.',
        'Shuttering complete, pour scheduled for the night shift.',
        'Support ribs erected up to the face, shotcrete in hand.',
        'Mast foundations cast at alternate locations.',
        'Ballast profile dressed, tamping to follow.',
        'Platform coping cast; finishing pending.',
      ]),
    });
  }
});
SITE_PHOTOS.sort((a, b) => a.minsAgo - b.minsAgo);

export const photosFor = (projectId) => SITE_PHOTOS.filter(p => p.projectId === projectId);
export const crewsFor = (projectId) => SITE_CREWS.filter(c => c.projectId === projectId);

/* Milestones placed on the corridor so the schedule reads geographically. */
export function milestoneMarkers(projectId) {
  const p = getProject(projectId);
  if (!p?.path?.length || !p.lengthM) return [];
  const ms = milestonesFor(projectId);
  return ms.map((m, i) => {
    const f = (i + 0.5) / ms.length;
    const pt = pointAlongPath(p.path, f);
    return { ...m, chainageM: Math.round(f * p.lengthM), lat: pt[0], lng: pt[1] };
  });
}
