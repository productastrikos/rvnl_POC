// ─────────────────────────────────────────────────────────────────────────────
// HSL AI Driven Design Validator — local knowledge engine
//
// This module simulates an air-gapped, on-prem LLM + retrieval layer.
// All knowledge is statically encoded so the application functions fully
// offline within HSL's secure intranet (no cloud, no external API calls).
// Replace internals with a real on-prem inference endpoint when deployed.
// ─────────────────────────────────────────────────────────────────────────────

// Aligned to Astrikos.ai Technical Solution Document (AIPL_DES VAL v1.0)
export const PLATFORM = {
  name: 'AI Driven Design Validator',
  product: 'S!aP Kolaz',
  vendor: 'Astrikos.ai',
  docRef: 'AIPL_DES VAL · v1.0',
  certifications: ['ISO 9001', 'ISO/IEC 27001', 'ISO/IEC 20000-1', 'ISO 21823-1', 'DPIIT'],
  partners: ['AVEVA', 'Schneider Electric'],
};

// Per RFP / Tech Solution Doc — the listed Class societies are IRS, DNV, ABS, IACS
export const CLASS_SOCIETIES = ['IRS', 'DNV', 'ABS', 'IACS'];
export const STANDARDS_BODIES = ['IMO', 'IEC', 'Naval (NSQR)'];
// Domains per doc §Project Brief: Electrical, Mechanical, HVAC, Piping, Hull, Outfit
export const DOMAINS = ['Hull', 'Electrical', 'Mechanical', 'HVAC', 'Piping', 'Outfit'];

// ── Technical Architecture (7 layers) — verbatim from Tech Solution Doc ─────
export const TECH_ARCHITECTURE = [
  { id:'L1', name:'User Interface Layer',          icon:'🖥', stack:'React / Electron Web App / Desktop Client · REST API to Backend',                                                                                  health:'healthy' },
  { id:'L2', name:'Application & LLM Engine',      icon:'🧠', stack:'Fine-tuned LLM with Class/Naval domain embeddings · Python microservices · Conversational engine with memory support',                              health:'healthy' },
  { id:'L3', name:'Document Intelligence Layer',   icon:'📄', stack:'Advanced offline OCR pipeline (Tesseract / ABBYY) · Text & structure extraction · PDF/Image handling framework',                                    health:'healthy' },
  { id:'L4', name:'Business Logic Layer',          icon:'⚙', stack:'Rule parsing & reasoning engine · Specification generation module · Cross-standard validation logic',                                               health:'healthy' },
  { id:'L5', name:'Data Layer & Storage',          icon:'🗄', stack:'PostgreSQL / SQLite database · Secure document repository on on-prem NAS',                                                                          health:'healthy' },
  { id:'L6', name:'Admin & Security Layer',        icon:'🛡', stack:'Role-based access control (RBAC) · Logging & audit trail · Usage analytics dashboard',                                                              health:'healthy' },
  { id:'L7', name:'Deployment Environment',        icon:'🖧', stack:'On-prem Linux server · Air-gapped / internal network only · Defence cyber-security compliance',                                                     health:'healthy' },
];

// ── Functional Workflow (7 stages) — from Tech Solution Doc §Functional Arch ─
export const FUNCTIONAL_WORKFLOW = [
  { id:'F1', name:'User Interface',                description:'Natural-language query · document upload & conversion · specification generation interface' },
  { id:'F2', name:'Chatbot Engine + LLM Core',     description:'Fine-tuned on Class/Naval/IMO/IEC standards · conversational memory & context · multi-document comprehension' },
  { id:'F3', name:'Rule Interpretation Engine',    description:'Cross-standard reasoning (IRS, Naval, BuildSpec) · rule extraction & comparison · specification generator' },
  { id:'F4', name:'Document Intelligence Layer',   description:'OCR engine (offline) · scanned document parsing & structuring · comparison & difference identification' },
  { id:'F5', name:'Document Repository & KB',      description:'Structured storage of processed documents · version control & history' },
  { id:'F6', name:'Admin Dashboard & Audit Trail', description:'RBAC · usage monitoring & statistics · chat / query export · logs of user interactions' },
  { id:'F7', name:'On-Prem Intranet Deployment',   description:'Air-gapped operation · Defence cyber-security compliance · HSL internal network only' },
];

// ── Hardware bill (from Tech Solution Doc §Hardware Requirements) ──────────
export const HARDWARE_BILL = [
  { item:'Server CPU',          spec:'2 × 16-core AMD EPYC / Intel Xeon Gold',          qty:1, costINR: 9_00_000 },
  { item:'Server RAM',          spec:'512 GB DDR4 ECC',                                  qty:1, costINR: 5_50_000 },
  { item:'GPU Accelerator',     spec:'NVIDIA A100 (80 GB) or equivalent',                qty:1, costINR:28_00_000 },
  { item:'Primary Storage',     spec:'8 TB NVMe SSD (high IOPS)',                        qty:1, costINR: 2_25_000 },
  { item:'Backup Storage',      spec:'100 TB+ NAS · RAID 5 / HDD array',                 qty:1, costINR:12_00_000 },
  { item:'Chassis / PSU / Cool',spec:'Enterprise rack-mount',                            qty:1, costINR: 2_00_000 },
  { item:'OS / Platform',       spec:'Astrik.OS with S!aP Platform (Ubuntu LTS variant)', qty:1, costINR: 0       },
  { item:'Misc (Rack / Cables)',spec:'42U rack · redundant PSU · UPS share',             qty:1, costINR: 1_25_000 },
];

// ── Project deliverables (from Tech Solution Doc §Deliverables) ────────────
export const DELIVERABLES = [
  { name:'AI Driven Design Validator (Base Functionality)', timeline:'D + 10 weeks', payment:10, status:'in-progress' },
  { name:'Knowledge Base Upload & UI Customization',        timeline:'D + 14 weeks', payment:10, status:'pending'     },
  { name:'Full Feature Development (Phase II)',             timeline:'D + 18 weeks', payment:10, status:'pending'     },
  { name:'User & Admin Training',                            timeline:'D + 20 weeks', payment:10, status:'pending'     },
  { name:'Final Production Release (Go-Live)',               timeline:'D + 24 weeks', payment:45, status:'pending'     },
  { name:'Source Code & Full Documentation',                 timeline:'D + 24 weeks', payment: 5, status:'pending'     },
  { name:'One-Year Warranty Support Post Go-Live',           timeline:'Continuous',    payment:10, status:'pending'     },
];

// ── Compliance Matrix — verbatim from Tech Solution Doc §Compliance Matrix ─
export const COMPLIANCE_MATRIX = [
  { clause:'1',     requirement:'Objective as per RFP',                                                                          status:'Compliant', remarks:'Covered in Project Scope and Objectives section' },
  { clause:'2(a)',  requirement:'Interpret design inputs from Class/Naval/IMO/IEC/Academic Books/Manuals',                       status:'Compliant', remarks:'Implemented via LLM Core and Rule Interpretation' },
  { clause:'2(b)',  requirement:'Provide domain-specific design queries answers',                                                status:'Compliant', remarks:'Chatbot supports all requested domains' },
  { clause:'2(c)',  requirement:'Recommend corrective actions or highlight inconsistencies',                                     status:'Compliant', remarks:'Built-in knowledge base recommendations' },
  { clause:'2(d)',  requirement:'Extract contextual content from scanned PDFs (non-editable/non-searchable)',                    status:'Compliant', remarks:'Advanced OCR layer' },
  { clause:'2(e)',  requirement:'Conversion of scanned graphical PDF to Word, Excel or Open Document format',                    status:'Compliant', remarks:'Fully supported' },
  { clause:'2(f)',  requirement:'Identification of differences in Class and Naval requirements',                                 status:'Compliant', remarks:'Cross-document comparison engine' },
  { clause:'2(g)',  requirement:'Intelligent recommendations based on queries & classes of ship',                                status:'Compliant', remarks:'LLM core with domain-specific embeddings' },
  { clause:'2(h)',  requirement:'Correlation between Build Spec and rules & regulations',                                        status:'Compliant', remarks:'Implemented in Rule Interpretation layer' },
  { clause:'2(i)',  requirement:'Secure access control, Cyber security as per Govt norms',                                       status:'Compliant', remarks:'Role-based access, encryption, audit trail' },
  { clause:'2(j)',  requirement:'Simple calculations based on documents',                                                        status:'Compliant', remarks:'Calculation engine integrated' },
  { clause:'2(k)',  requirement:'Technical specification generation based on Build Spec and Rules',                              status:'Compliant', remarks:'Specification generator implemented' },
  { clause:'2(l)',  requirement:'Identification of repetitive and inconsistent statements in specifications',                    status:'Compliant', remarks:'Built-in validation pipeline' },
  { clause:'2(m)',  requirement:'Upload any number of documents without restriction',                                            status:'Compliant', remarks:'No restriction on document upload volume' },
  { clause:'2(n)',  requirement:'Extracting info from binding data documents in CSV/OpenDoc format',                             status:'Compliant', remarks:'Fully supported' },
  { clause:'2(o)',  requirement:'Document converter and difference finder',                                                      status:'Compliant', remarks:'Supported in Document Intelligence Layer' },
  { clause:'3(a-h)',requirement:'All listed Core Features (Natural Language, Multi-doc comprehension, etc.)',                    status:'Compliant', remarks:'All core features fully covered' },
  { clause:'4',     requirement:'Export to file formats',                                                                        status:'Compliant', remarks:'Word, Excel, CSV, OpenDoc formats supported' },
  { clause:'5',     requirement:'Deliverables and Stage Payments',                                                               status:'Compliant', remarks:'Delivery aligned to RFP deliverables and payment plan' },
  { clause:'6',     requirement:'Minimum Hardware compliance',                                                                   status:'Compliant', remarks:'Solution fully compatible with specified hardware' },
  { clause:'7',     requirement:'Post-deployment support / AMC',                                                                 status:'Compliant', remarks:'1 year warranty + 3 years AMC included' },
  { clause:'8',     requirement:'Startup qualification and MVP',                                                                 status:'Compliant', remarks:'Astrikos.ai is DPIIT certified and MVP ready' },
];

// ── Rule corpus (representative excerpts for offline interpretation) ─────────
export const RULE_CORPUS = [
  {
    id: 'IRS-P3-C6-S4',
    society: 'IRS',
    title: 'Watertight Subdivision — Bulkhead Spacing',
    domain: 'Hull',
    excerpt: 'Transverse watertight bulkheads shall be arranged so that the spacing between them does not exceed 30 frame spaces, with collision bulkhead positioned per Reg.12. Verification by survey at keel-laying.',
    threshold: { max_frame_spacing: 30, min_collision_bhd_offset_m: 0.05 },
    keywords: ['bulkhead', 'subdivision', 'watertight', 'frame', 'collision', 'hull'],
  },
  {
    id: 'IRS-P3-C6-S2',
    society: 'IRS',
    title: 'Shell Plating Thickness — Below Waterline',
    domain: 'Hull',
    excerpt: 'Shell plating below the deepest load waterline shall have minimum thickness as per Table 6.2.3. For ships > 90 m and ≤ 120 m LBP, minimum thickness is 13.0 mm (2024 amendment, previously 12.5 mm).',
    threshold: { min_thickness_mm: 13.0 },
    keywords: ['plate', 'plating', 'thickness', 'shell', 'hull', 'strake'],
  },
  {
    id: 'IEC-60092-352',
    society: 'IEC',
    title: 'Electrical Installations in Ships — Cable Selection & Installation',
    domain: 'Electrical',
    excerpt: 'Power cables shall be segregated from instrumentation cables by a minimum air gap of 100 mm where running in parallel for more than 3 m, unless armouring or screened tray with continuous earth bond is used.',
    threshold: { min_segregation_mm: 100, parallel_run_m: 3 },
    keywords: ['cable', 'segregation', 'electrical', 'tray', 'iec', 'power', 'instrumentation'],
  },
  {
    id: 'DNV-P4-C7-S2',
    society: 'DNV',
    title: 'HVAC Systems — Redundancy',
    domain: 'HVAC',
    excerpt: 'Ventilation and air-conditioning for machinery spaces shall be provided with N+1 redundancy where the loss of a single supply fan would reduce the ventilation capacity below 50% of the required rate.',
    threshold: { redundancy: 'N+1', min_capacity_after_failure_pct: 50 },
    keywords: ['hvac', 'ventilation', 'redundancy', 'fan', 'machinery', 'engine room'],
  },
  {
    id: 'IMO-MARPOL-A1-R14',
    society: 'IMO',
    title: 'MARPOL Annex I Reg.14 — Oil Filtering Equipment',
    domain: 'Piping',
    excerpt: 'Every ship of 400 GT and above shall be fitted with oil filtering equipment ensuring discharged oil content does not exceed 15 ppm. A 15 ppm bilge alarm and automatic stopping device (interlock) is mandatory.',
    threshold: { max_oil_ppm: 15, interlock_required: true },
    keywords: ['marpol', 'bilge', 'oil', 'oily water', 'separator', 'ows', 'piping'],
  },
  {
    id: 'ABS-P4-C2',
    society: 'ABS',
    title: 'Machinery — Main Propulsion Shaft Diameter',
    domain: 'Mechanical',
    excerpt: 'Minimum diameter d of intermediate propulsion shafts shall be calculated as d = F · k · ((P · (1+0.01·C))/(n·(1-Q⁴)))^(1/3), where F = material factor, k = type factor, P = power kW, n = rpm, Q = bore/diameter ratio.',
    threshold: null,
    keywords: ['shaft', 'propulsion', 'mechanical', 'diameter', 'abs', 'rpm', 'machinery'],
  },
  {
    id: 'IACS-UR-S6',
    society: 'IACS',
    title: 'Unified Requirement S6 — Use of Steel Grades',
    domain: 'Hull',
    excerpt: 'Material grades for hull structural members shall comply with IACS UR S6 mapping (Class A/B/D/E vs thickness and member category). Grade D/E mandatory in strength deck stringer plates at amidships.',
    threshold: { mandatory_grade_for_stringer: 'D or E' },
    keywords: ['steel', 'grade', 'material', 'iacs', 'hull', 's6'],
  },
  {
    id: 'IRS-NAVAL-V2',
    society: 'IRS (Naval)',
    title: 'Naval — Shock Qualification (NSQR Vol-II Grade A)',
    domain: 'Outfit',
    excerpt: 'Equipment classified shock-grade A shall withstand the Heavyweight Shock Test (MIL-S-901D Grade A equivalent) and be installed with vendor-supplied shock-isolation mounts retaining Class certification.',
    threshold: { grade: 'A', isolation_required: true },
    keywords: ['shock', 'naval', 'nsqr', 'grade a', 'mil-s-901d', 'qualification'],
  },
];

// ── Build Specs in scope (HSL internal reference set) ───────────────────────
export const BUILD_SPECS = [
  { id:'HSL-BS-21-411', rev:'B', title:'Structural Specification — Frigate Class A', domain:'Hull',       lastUpdated:'2026-04-12', pages:412, findings:7 },
  { id:'HSL-BS-21-510', rev:'A', title:'Main Switchboard & Power Distribution',      domain:'Electrical', lastUpdated:'2026-03-28', pages:188, findings:3 },
  { id:'HSL-BS-21-620', rev:'C', title:'HVAC — Engine Room & Accommodation',         domain:'HVAC',       lastUpdated:'2026-05-01', pages:142, findings:2 },
  { id:'HSL-BS-21-730', rev:'A', title:'Bilge, Ballast & Oily Water Systems',        domain:'Piping',     lastUpdated:'2026-05-09', pages:96,  findings:4 },
  { id:'HSL-BS-21-840', rev:'B', title:'Propulsion Shafting & Main Engine',          domain:'Mechanical', lastUpdated:'2026-04-30', pages:204, findings:1 },
  { id:'HSL-BS-21-905', rev:'A', title:'Outfit — Naval Combat Systems Mounts',       domain:'Outfit',     lastUpdated:'2026-05-15', pages:78,  findings:6 },
];

// ── Pre-indexed documents (manuals + class rule books) ──────────────────────
export const INDEXED_DOCS = [
  { id:'DOC-001', name:'IRS Rules and Regulations 2024 — Part 3 Hull',           type:'Class Rule',    pages:984, ocr:false, status:'indexed', confidence:99.7 },
  { id:'DOC-002', name:'DNV Rules for Classification — Part 4 Systems',          type:'Class Rule',    pages:744, ocr:false, status:'indexed', confidence:99.6 },
  { id:'DOC-003', name:'ABS Steel Vessels Rules — Part 4 Machinery',             type:'Class Rule',    pages:612, ocr:false, status:'indexed', confidence:99.4 },
  { id:'DOC-004', name:'IACS Unified Requirements 2024',                          type:'IACS',          pages:498, ocr:false, status:'indexed', confidence:99.8 },
  { id:'DOC-005', name:'IMO MARPOL Consolidated Edition',                         type:'IMO',           pages:528, ocr:false, status:'indexed', confidence:99.5 },
  { id:'DOC-006', name:'IMO SOLAS 2024 Consolidated',                             type:'IMO',           pages:642, ocr:false, status:'indexed', confidence:99.6 },
  { id:'DOC-007', name:'IEC 60092 Series — Electrical in Ships',                  type:'IEC',           pages:386, ocr:false, status:'indexed', confidence:99.5 },
  { id:'DOC-008', name:'IHQ Naval Staff Qualitative Requirements (NSQR) Vol-II',  type:'Naval',         pages:312, ocr:true,  status:'indexed', confidence:97.8 },
  { id:'DOC-009', name:'Build Specification HSL-BS-21-411 Rev.B',                 type:'Build Spec',    pages:412, ocr:false, status:'indexed', confidence:99.2 },
  { id:'DOC-010', name:'Wärtsilä W32 Main Engine Manual (scanned)',                type:'OEM Manual',    pages:284, ocr:true,  status:'indexed', confidence:96.4 },
  { id:'DOC-011', name:'ABB AC Switchboard Manual — Type ML-3000',                 type:'OEM Manual',    pages:142, ocr:true,  status:'indexed', confidence:98.1 },
  { id:'DOC-012', name:'Alfa Laval OWS Manual (scanned)',                          type:'OEM Manual',    pages:88,  ocr:true,  status:'indexed', confidence:95.9 },
];

// ── Build Spec ↔ Rule mapping for cross-reference reasoning ─────────────────
export const SPEC_RULE_MAP = {
  'HSL-BS-21-411': ['IRS-P3-C6-S4', 'IRS-P3-C6-S2', 'IACS-UR-S6'],
  'HSL-BS-21-510': ['IEC-60092-352'],
  'HSL-BS-21-620': ['DNV-P4-C7-S2'],
  'HSL-BS-21-730': ['IMO-MARPOL-A1-R14'],
  'HSL-BS-21-840': ['ABS-P4-C2'],
  'HSL-BS-21-905': ['IRS-NAVAL-V2'],
};

// ── Domain → applicable rule list quick lookup ──────────────────────────────
export const DOMAIN_RULES = DOMAINS.reduce((acc, d) => {
  acc[d] = RULE_CORPUS.filter(r => r.domain === d).map(r => r.id);
  return acc;
}, {});

// ── Tokenise a free-text query into keywords ───────────────────────────────
const STOPWORDS = new Set(['the','a','an','is','are','of','for','to','in','on','what','how','do','i','my','our','can','please','show','tell','give','me','about']);
function tokens(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 .-]+/g,' ').split(/\s+/).filter(w => w && !STOPWORDS.has(w));
}

// ── Retrieve top-k matching rules ──────────────────────────────────────────
export function retrieveRules(query, k = 4) {
  const t = tokens(query);
  if (t.length === 0) return [];
  const scored = RULE_CORPUS.map(rule => {
    const hay = [
      rule.id, rule.society, rule.title, rule.domain, rule.excerpt, ...(rule.keywords || []),
    ].join(' ').toLowerCase();
    const score = t.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    return { rule, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, k);
  return scored.map(x => x.rule);
}

// ── Simple engineering calculator (parsed natural language) ─────────────────
export function tryCalculate(query) {
  const q = (query || '').toLowerCase();

  // Shaft diameter (ABS Pt.4 Ch.2 simplified)
  const shaftMatch = q.match(/shaft.*(diameter|size).*?(\d+(?:\.\d+)?)\s*kw.*?(\d+(?:\.\d+)?)\s*rpm/);
  if (shaftMatch) {
    const P = parseFloat(shaftMatch[2]);
    const n = parseFloat(shaftMatch[3]);
    const F = 100, k = 1.0, C = 0, Q = 0;
    const d = F * k * Math.cbrt((P * (1 + 0.01 * C)) / (n * (1 - Math.pow(Q, 4))));
    return {
      type: 'shaft_diameter',
      title: 'Minimum Intermediate Shaft Diameter',
      formula: 'd = F · k · ((P · (1+0.01·C))/(n·(1-Q⁴)))^(1/3)',
      inputs: { P_kW: P, n_rpm: n, F: 100, k: 1.0, C: 0, Q: 0 },
      result: { value: d.toFixed(1), unit: 'mm' },
      reference: 'ABS Pt.4 Ch.2',
    };
  }

  // Plate thickness check (IRS Pt.3 Ch.6)
  const plateMatch = q.match(/plate.*thickness.*?(\d+(?:\.\d+)?)\s*(mm)?.*?(\d+(?:\.\d+)?)\s*(m|metre|meter|lbp)/);
  if (plateMatch) {
    const t = parseFloat(plateMatch[1]);
    const lbp = parseFloat(plateMatch[3]);
    const required = lbp > 90 && lbp <= 120 ? 13.0 : lbp <= 90 ? 12.0 : 14.0;
    return {
      type: 'plate_thickness',
      title: 'Shell Plate Minimum Thickness Check',
      formula: 'Table 6.2.3 lookup by LBP band',
      inputs: { actual_mm: t, lbp_m: lbp },
      result: { value: required.toFixed(1), unit: 'mm', verdict: t >= required ? 'PASS' : 'FAIL' },
      reference: 'IRS Pt.3 Ch.6 Sec.2 (2024 amendment)',
    };
  }

  // Bulkhead spacing (IRS Pt.3 Ch.6)
  const bhdMatch = q.match(/bulkhead.*spacing.*?(\d+)\s*(frame|fr)/);
  if (bhdMatch) {
    const spacing = parseInt(bhdMatch[1], 10);
    return {
      type: 'bulkhead_spacing',
      title: 'Bulkhead Spacing Compliance',
      formula: 'spacing ≤ 30 frame spaces',
      inputs: { spacing_frames: spacing },
      result: { value: 30, unit: 'frames max', verdict: spacing <= 30 ? 'PASS' : 'FAIL' },
      reference: 'IRS Pt.3 Ch.6 Sec.4',
    };
  }

  // Cable segregation (IEC 60092-352)
  const cableMatch = q.match(/cable.*(segregation|separation|gap).*?(\d+(?:\.\d+)?)\s*(mm|cm)/);
  if (cableMatch) {
    const valRaw = parseFloat(cableMatch[2]);
    const unit = cableMatch[3];
    const mm = unit === 'cm' ? valRaw * 10 : valRaw;
    return {
      type: 'cable_segregation',
      title: 'Power/Instrumentation Cable Segregation',
      formula: 'segregation ≥ 100 mm for parallel runs > 3 m',
      inputs: { actual_mm: mm },
      result: { value: 100, unit: 'mm min', verdict: mm >= 100 ? 'PASS' : 'FAIL' },
      reference: 'IEC 60092-352',
    };
  }

  // Bilge OWS PPM (MARPOL)
  const ppmMatch = q.match(/(bilge|oily water|ows).*?(\d+(?:\.\d+)?)\s*ppm/);
  if (ppmMatch) {
    const ppm = parseFloat(ppmMatch[2]);
    return {
      type: 'oil_ppm',
      title: 'Bilge Discharge — Oil Content',
      formula: 'oil ppm ≤ 15',
      inputs: { discharge_ppm: ppm },
      result: { value: 15, unit: 'ppm max', verdict: ppm <= 15 ? 'PASS' : 'FAIL' },
      reference: 'IMO MARPOL Annex I Reg.14',
    };
  }

  // Generic arithmetic fallback (e.g., "calculate 12*45 + 8")
  const arith = q.match(/(?:calculate|compute|=)\s*([0-9\s+\-*/().]+)/);
  if (arith) {
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${arith[1]})`)();
      if (typeof v === 'number' && Number.isFinite(v)) {
        return {
          type: 'arithmetic',
          title: 'Arithmetic',
          formula: arith[1].trim(),
          inputs: {},
          result: { value: v, unit: '' },
          reference: null,
        };
      }
    } catch (e) { /* ignore */ }
  }

  return null;
}

// ── Compare two documents and identify differences ─────────────────────────
export function compareDocs(docA, docB) {
  // Simulated diff for two known spec revisions
  return [
    { section:'§4.2 Bulkhead Spacing',            a:'30 frames', b:'28 frames',         severity:'info',     impact:'Tightening — stays within IRS limit' },
    { section:'§5.1 Shell Plate Thickness Fr112', a:'12.5 mm',    b:'13.0 mm',          severity:'critical', impact:'Now complies with IRS 2024 amendment' },
    { section:'§6.4 Weld Category Collision Bhd', a:'Cat B',       b:'Cat A',            severity:'high',     impact:'Higher inspection requirement' },
    { section:'§7.2 Material Grade Strake S2',    a:'Grade A',     b:'Grade D',          severity:'medium',   impact:'Aligned with IACS UR S6' },
    { section:'§9.5 Painting Schedule',           a:'Coat 200 µm', b:'Coat 250 µm',      severity:'info',     impact:'Improves corrosion margin' },
    { section:'§11.1 Cable Tray Segregation',     a:'80 mm',       b:'120 mm',           severity:'high',     impact:'Now complies with IEC 60092-352' },
  ];
}

// ── Conversational response generator (the offline LLM stand-in) ───────────
export function generateResponse(query) {
  const q = (query || '').trim();
  if (!q) return null;

  const lower = q.toLowerCase();

  // 1) Try calculation first
  const calc = tryCalculate(q);
  if (calc) {
    return {
      kind: 'calculation',
      summary: `${calc.title} — result ${calc.result.value} ${calc.result.unit}${calc.result.verdict ? ' · ' + calc.result.verdict : ''}.`,
      calculation: calc,
      citations: calc.reference ? [calc.reference] : [],
    };
  }

  // 2) Compare documents
  if (/(compare|difference|diff|between).*(spec|revision|rev|document|version)/i.test(q) ||
      /\b(rev\.?\s?[a-d]).*(rev\.?\s?[a-d])\b/i.test(q)) {
    const rows = compareDocs();
    return {
      kind: 'comparison',
      summary: `Found ${rows.length} material differences across the two documents.`,
      diff: rows,
      citations: ['IRS Pt.3 Ch.6 (2024 amendment)', 'IEC 60092-352', 'IACS UR S6'],
    };
  }

  // 3) Generate a spec
  if (/(generate|create|draft|produce).*(spec|specification)/i.test(q)) {
    const domain = DOMAINS.find(d => lower.includes(d.toLowerCase())) || 'Hull';
    return {
      kind: 'spec',
      summary: `Drafted a ${domain}-domain technical specification compliant with applicable Class/IMO/IEC rules.`,
      spec: {
        title: `${domain} System — Auto-generated Technical Specification`,
        revision: 'Rev.A (draft)',
        sections: [
          { heading: 'Scope', body: `This specification covers the design, construction, testing and installation of the ${domain.toLowerCase()} system for HSL hull HSL-2026-001.` },
          { heading: 'Applicable Rules', body: DOMAIN_RULES[domain]?.join(', ') || 'IRS, IMO, IEC' },
          { heading: 'Design Basis', body: 'All design parameters comply with IRS Rules 2024, MARPOL Annex I/IV, SOLAS Ch.II-1, and applicable IEC 60092 series.' },
          { heading: 'Material', body: 'Per IACS UR S6 — Grade D or E for primary strength members at amidships.' },
          { heading: 'Inspection & Testing', body: 'Hydrostatic, NDT (UT/RT), and 100% visual inspection of all welds. Survey witness per IRS surveyor scope.' },
          { heading: 'Documentation', body: 'As-built drawings, mill certificates, weld procedure qualifications (WPQ), and operating manuals to be submitted prior to delivery.' },
        ],
      },
      citations: DOMAIN_RULES[domain] || [],
    };
  }

  // 4) Rule lookup / cross-reference
  const rules = retrieveRules(q, 3);
  if (rules.length > 0) {
    const top = rules[0];
    return {
      kind: 'rule',
      summary: `${top.society} ${top.id} — ${top.title}. ${top.excerpt.slice(0, 180)}${top.excerpt.length > 180 ? '…' : ''}`,
      rules,
      citations: rules.map(r => `${r.society} ${r.id}`),
    };
  }

  // 5) Fallback
  return {
    kind: 'general',
    summary: `I can interpret Class/IMO/IEC rules, validate build specifications, generate engineering specs, run quick calculations and analyse scanned documents. Try asking, for example: "What is the IRS bulkhead spacing rule?", "Compare HSL-BS-21-411 Rev.B with Rev.C", or "Generate an HVAC specification".`,
    rules: [],
    citations: [],
  };
}

// ── Suggested starter prompts shown in the UI ──────────────────────────────
export const SUGGESTIONS = [
  { icon: '⚓', text: 'What is the bulkhead spacing rule under IRS Pt.3 Ch.6?' },
  { icon: '⚡', text: 'Validate cable segregation 80 mm against IEC 60092-352' },
  { icon: '📐', text: 'Calculate shaft diameter for 8500 kW at 750 rpm' },
  { icon: '📑', text: 'Compare HSL-BS-21-411 Rev.B with Rev.C' },
  { icon: '🛠', text: 'Generate an HVAC technical specification' },
  { icon: '🌊', text: 'Show MARPOL Annex I Reg.14 requirements for OWS' },
  { icon: '🛡', text: 'List naval shock-grade equipment requirements' },
  { icon: '📏', text: 'Check plate thickness 12.5 mm for 105 m LBP vessel' },
];
