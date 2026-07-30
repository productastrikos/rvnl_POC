import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapContainer, TileLayer, Polyline, Polygon, CircleMarker, Popup,
  Tooltip as LTooltip, ZoomControl, useMap,
} from 'react-leaflet';
import L from 'leaflet';

import {
  Panel, Chip, Loading, Btn, Progress, MiniStat, Select, SearchBox, EmptyState, Tabs, Facts,
} from '../components/ui';
import ZoneFilterBar from '../components/ZoneFilterBar';
import { BASEMAPS, DEFAULT_BASEMAP, getBasemap } from '../components/basemaps';
import { getTwinScene, uploadSitePhoto, actOnSitePhoto } from '../services/api';
import { useData } from '../services/socket';
import {
  inr, pct, chainage, fmtDate, TODAY,
  SEGMENT_STATE, AI_VERDICT, WORK_ITEMS, simulateFrameAnalysis,
} from '../data/rvnlData';

/* Leaflet's bundled marker icons break under webpack — CircleMarkers only. */
delete L.Icon.Default.prototype._getIconUrl;

/* ─── Palette ────────────────────────────────────────────────────────────── */
const RAG = { normal: '#16a34a', warning: '#f59e0b', critical: '#dc2626' };

const LAND_COLOR = {
  possession_taken:  '#16a34a',
  compensation_paid: '#65a30d',
  sec20f_awarded:    '#f59e0b',
  sec20e_declared:   '#f97316',
  sec20a_notified:   '#ef4444',
  identified:        '#dc2626',
  disputed:          '#7f1d1d',
  court_stay:        '#581c87',
};
const LAND_BUCKET = (s) =>
  s === 'possession_taken' ? 'acquired'
  : ['disputed', 'court_stay'].includes(s) ? 'disputed'
  : ['sec20f_awarded', 'compensation_paid'].includes(s) ? 'in_progress'
  : 'not_acquired';

const STRUCT_COLOR = {
  tunnel: '#8b5cf6', major_bridge: '#3b7de8', minor_bridge: '#0d9488',
  rob: '#d97706', station: '#ec4899',
};
const VERDICT_COLOR = {
  verified: '#16a34a', partial: '#f59e0b', flagged: '#f97316', rejected: '#dc2626', pending: '#64748b',
};

/* ─── Layer catalogue — the twin's information switchboard ───────────────── */
const LAYER_GROUPS = [
  {
    label: 'Corridor',
    layers: [
      { key: 'progress',   name: 'Track progress',      hint: 'Laid / in hand / not started', swatch: SEGMENT_STATE.done.color },
      { key: 'land',       name: 'Land acquisition',    hint: 'Parcel bands along the corridor', swatch: '#16a34a' },
      { key: 'structures', name: 'Structures',          hint: 'Tunnels, bridges, ROBs, stations', swatch: STRUCT_COLOR.tunnel },
      { key: 'milestones', name: 'Milestones',          hint: 'Schedule events on the alignment', swatch: '#3b7de8' },
    ],
  },
  {
    label: 'Site',
    layers: [
      { key: 'crews',  name: 'Crews on site',      hint: 'Live gang positions and headcount', swatch: '#22d3ee' },
      { key: 'photos', name: 'Photo evidence (AI)', hint: 'Worker uploads validated by the model', swatch: VERDICT_COLOR.verified },
      { key: 'plant',  name: 'Plant & machinery',  hint: 'Deployment shortfalls', swatch: '#a3a3a3' },
    ],
  },
  {
    label: 'Governance',
    layers: [
      { key: 'incidents',  name: 'Safety incidents', hint: 'Open events at chainage', swatch: '#dc2626' },
      { key: 'risks',      name: 'Risks & blockers', hint: 'Open risks scoring 9+', swatch: '#f97316' },
      { key: 'clearances', name: 'Clearances',       hint: 'Statutory approvals pending', swatch: '#8b5cf6' },
    ],
  },
];
const ALL_LAYERS = LAYER_GROUPS.flatMap(g => g.layers.map(l => l.key));
const DEFAULT_LAYERS = ['progress', 'land', 'structures', 'crews', 'photos'];

const NORTH_CENTRE = [28.4, 78.2];

/* ─── Map helpers ────────────────────────────────────────────────────────── */
function MapFocus({ bounds, center, zoom }) {
  const map = useMap();
  const key = bounds ? JSON.stringify(bounds) : `${center}-${zoom}`;
  useEffect(() => {
    if (bounds && bounds.length > 1) {
      try { map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 }); } catch { /* empty bounds */ }
    } else if (center) {
      map.setView(center, zoom || 6);
    }
  }, [key]);                                        // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const monthLabel = (monthsBack) => {
  const d = new Date(TODAY);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

/* ═══════════════════════════════════════════════════════════════════════════
   DIGITAL TWIN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DigitalTwin() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { zone, setZone, lastUpdate, user, online } = useData();

  const projectId = sp.get('project') || null;
  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [showLayers, setShowLayers] = useState(true);
  const [q, setQ] = useState('');
  const [health, setHealth] = useState('all');
  const [tab, setTab] = useState('overview');
  const [monthsBack, setMonthsBack] = useState(0);
  const [basemapKey, setBasemapKey] = useState(DEFAULT_BASEMAP);
  const [tilesDown, setTilesDown] = useState(false);
  const tileStats = useRef({ ok: 0, err: 0 });
  const [selected, setSelected] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [flash, setFlash] = useState(null);

  const asOfFactor = 1 - monthsBack * 0.05;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getTwinScene({ zone, projectId, asOfFactor }).then(r => {
      if (alive) { setScene(r.data); setLoading(false); }
    });
    return () => { alive = false; };
  }, [zone, projectId, asOfFactor, lastUpdate]);

  /* A base map that never delivers a tile should say so rather than look empty. */
  useEffect(() => { tileStats.current = { ok: 0, err: 0 }; setTilesDown(false); }, [basemapKey]);

  const toggleLayer = (k) =>
    setLayers(ls => (ls.includes(k) ? ls.filter(x => x !== k) : [...ls, k]));
  const on = (k) => layers.includes(k);

  const openProject = (id) => {
    if (id) sp.set('project', id); else sp.delete('project');
    setSp(sp, { replace: true });
    setSelected(null);
    setTab('overview');
  };

  const corridors = useMemo(() => {
    if (!scene) return [];
    let rows = scene.corridors;
    if (health !== 'all') rows = rows.filter(c => c.health === health);
    if (q) {
      const n = q.toLowerCase();
      rows = rows.filter(c => `${c.name} ${c.code} ${c.zone} ${c.piuName}`.toLowerCase().includes(n));
    }
    return rows;
  }, [scene, health, q]);

  const basemap = getBasemap(basemapKey);
  const project = scene?.project;
  const focusBounds = useMemo(() => {
    if (project?.path?.length) return project.path;
    if (corridors.length) return corridors.flatMap(c => c.path);
    return null;
  }, [project, corridors]);

  if (loading && !scene) return <div className="p-4"><Loading label="Building digital twin…" /></div>;

  const photoFeed = (project ? scene.projectPhotos : scene.photos) || [];

  return (
    <div className="h-full flex flex-col lg:flex-row">

      {/* ══ MAP ══════════════════════════════════════════════════════════ */}
      <div className="relative flex-1 min-h-[420px]">
        <MapContainer center={NORTH_CENTRE} zoom={6} scrollWheelZoom
          zoomControl={false} attributionControl={false}
          style={{ height: '100%', width: '100%', background: basemap.background }}>
          {/* One base map at a time — keyed so switching swaps the tiles cleanly. */}
          <TileLayer
            key={basemap.key}
            url={basemap.url}
            subdomains={basemap.subdomains}
            maxNativeZoom={basemap.maxNativeZoom}
            maxZoom={basemap.maxZoom}
            eventHandlers={{
              tileload: () => { tileStats.current.ok += 1; if (tilesDown) setTilesDown(false); },
              tileerror: () => {
                tileStats.current.err += 1;
                if (tileStats.current.ok === 0 && tileStats.current.err >= 4) setTilesDown(true);
              },
            }}
          />
          <ZoomControl position="topright" />

          <MapFocus bounds={focusBounds} center={NORTH_CENTRE} zoom={6} />

          {/* ── Portfolio view: every corridor, progress shaded ───────── */}
          {!project && corridors.map(c => (
            <React.Fragment key={c.id}>
              <Polyline positions={c.path} pathOptions={{ color: '#dc2626', weight: 5, opacity: 0.55 }}
                eventHandlers={{ click: () => openProject(c.id) }}>
                <LTooltip sticky>
                  <strong>{c.name}</strong><br />
                  {c.typeLabel} · {c.lengthKm} km · {pct(c.physicalProgress)} complete
                </LTooltip>
              </Polyline>
              {c.donePath?.length > 1 && (
                <Polyline positions={c.donePath} pathOptions={{ color: SEGMENT_STATE.done.color, weight: 5, opacity: 0.95 }}
                  eventHandlers={{ click: () => openProject(c.id) }} />
              )}
              <CircleMarker center={[c.lat, c.lng]} radius={6}
                pathOptions={{ color: RAG[c.health], fillColor: RAG[c.health], fillOpacity: 0.9, weight: 2 }}
                eventHandlers={{ click: () => openProject(c.id) }}>
                <Popup>
                  <div style={{ minWidth: 190 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 11 }}>{c.typeLabel} · {c.lengthKm} km</div>
                    <div style={{ fontSize: 11 }}>Progress {pct(c.physicalProgress)}</div>
                    <button onClick={() => openProject(c.id)}
                      style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#3b7de8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Open in twin →
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          ))}

          {/* ── Project view: land bands sit under the track ──────────── */}
          {project && on('land') && scene.parcels.map(l => l.polygon?.length >= 3 && (
            <Polygon key={l.id} positions={l.polygon}
              pathOptions={{
                color: LAND_COLOR[l.status] || '#94a3b8',
                fillColor: LAND_COLOR[l.status] || '#94a3b8',
                fillOpacity: LAND_BUCKET(l.status) === 'acquired' ? 0.28 : 0.42,
                weight: 1,
              }}
              eventHandlers={{ click: () => setSelected({ kind: 'parcel', data: l }) }}>
              <LTooltip sticky>
                <strong>Parcel {l.parcelRef}</strong> · {l.village}<br />
                {l.statusLabel} · {l.areaHectare} ha · {l.landType}
              </LTooltip>
            </Polygon>
          ))}

          {/* ── Project view: the track itself, coloured by state ─────── */}
          {project && on('progress') && scene.segments.map(s => (
            <Polyline key={s.id} positions={s.coords}
              pathOptions={{
                color: s.color, weight: s.state === 'active' ? 8 : 6,
                opacity: 0.95, dashArray: s.blocked ? '10 7' : undefined,
                lineCap: 'butt',
              }}
              eventHandlers={{ click: () => setSelected({ kind: 'segment', data: s }) }}>
              <LTooltip sticky>
                <strong>{SEGMENT_STATE[s.state].label}</strong>{s.blocked ? ' · land blocked' : ''}<br />
                {s.packageName} · {chainage(s.fromChainageM)} → {chainage(s.toChainageM)}<br />
                {s.lengthKm} km{s.contractorName ? ` · ${s.contractorName}` : ''}
              </LTooltip>
            </Polyline>
          ))}

          {project && !on('progress') && (
            <Polyline positions={project.path} pathOptions={{ color: '#64748b', weight: 3, opacity: 0.7 }} />
          )}

          {/* ── Structures ───────────────────────────────────────────── */}
          {project && on('structures') && scene.projectStructures.map(s => (
            <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={s.type === 'tunnel' ? 7 : 5}
              pathOptions={{ color: STRUCT_COLOR[s.type] || '#94a3b8', fillColor: STRUCT_COLOR[s.type] || '#94a3b8', fillOpacity: 0.85, weight: 1.5 }}
              eventHandlers={{ click: () => setSelected({ kind: 'structure', data: s }) }}>
              <LTooltip>
                {s.typeLabel} {s.refCode} · {chainage(s.chainageM)} · {s.progressPct}%
              </LTooltip>
            </CircleMarker>
          ))}

          {/* ── Milestones ───────────────────────────────────────────── */}
          {project && on('milestones') && scene.milestones.map(m => (
            <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={5}
              pathOptions={{
                color: m.status === 'completed' ? '#16a34a' : m.status === 'overdue' ? '#dc2626' : '#3b7de8',
                fillColor: 'transparent', weight: 2.5,
              }}>
              <LTooltip>
                {m.code} · {m.name}<br />{m.status.replace('_', ' ')} · planned {fmtDate(m.plannedFinish)}
              </LTooltip>
            </CircleMarker>
          ))}

          {/* ── Crews ────────────────────────────────────────────────── */}
          {on('crews') && (project ? scene.projectCrews : scene.crews).map(c => (
            <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={c.status === 'on_site' ? 7 : 5}
              pathOptions={{
                color: '#22d3ee', fillColor: '#22d3ee',
                fillOpacity: c.status === 'on_site' ? 0.85 : 0.35, weight: 1.5,
              }}
              eventHandlers={{ click: () => setSelected({ kind: 'crew', data: c }) }}>
              <LTooltip>
                <strong>{c.name}</strong> · {c.roleLabel}<br />
                {c.activity} · {c.headcount} workers<br />
                last ping {c.lastPingMins} min ago
              </LTooltip>
            </CircleMarker>
          ))}

          {/* ── Photo evidence ───────────────────────────────────────── */}
          {on('photos') && photoFeed.filter(p => p.lat && p.lng).map(p => (
            <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={6}
              pathOptions={{
                color: VERDICT_COLOR[p.verdict] || '#64748b',
                fillColor: VERDICT_COLOR[p.verdict] || '#64748b',
                fillOpacity: 0.75, weight: 2,
              }}
              eventHandlers={{ click: () => { setSelected({ kind: 'photo', data: p }); setTab('site'); } }}>
              <LTooltip>
                <strong>{p.workItemLabel}</strong> · {AI_VERDICT[p.verdict]?.label}<br />
                {p.capturedBy} · {chainage(p.chainageM)}<br />
                model confidence {(p.confidence * 100).toFixed(0)}%
              </LTooltip>
            </CircleMarker>
          ))}

          {/* ── Plant ────────────────────────────────────────────────── */}
          {on('plant') && (project ? scene.plant.filter(x => x.projectId === project.id) : scene.plant).map(p => (
            <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={4}
              pathOptions={{ color: p.status === 'not_deployed' ? '#dc2626' : '#a3a3a3', fillColor: '#a3a3a3', fillOpacity: 0.6, weight: 1.5 }}>
              <LTooltip>{p.type} {p.code} · {p.deployed}/{p.committed} deployed · {p.utilisationPct}% utilised</LTooltip>
            </CircleMarker>
          ))}

          {/* ── Safety incidents ─────────────────────────────────────── */}
          {on('incidents') && (project ? scene.projectIncidents.filter(i => i.status === 'open') : scene.incidents).map(s => (
            <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={6}
              pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.5, weight: 2 }}
              eventHandlers={{ click: () => setSelected({ kind: 'incident', data: s }) }}>
              <LTooltip><strong>{s.typeLabel}</strong><br />{s.description}<br />{chainage(s.chainageM)}</LTooltip>
            </CircleMarker>
          ))}

          {/* ── Risks ────────────────────────────────────────────────── */}
          {on('risks') && (project ? scene.projectRisks : scene.risks).map(r => (
            <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={7}
              pathOptions={{ color: r.severity === 'critical' ? '#dc2626' : '#f97316', fillColor: 'transparent', weight: 2.5, dashArray: '4 3' }}
              eventHandlers={{ click: () => setSelected({ kind: 'risk', data: r }) }}>
              <LTooltip><strong>{r.categoryLabel}</strong><br />{r.title}<br />exposure {inr(r.exposureAmount, { unit: 'cr', decimals: 0 })}</LTooltip>
            </CircleMarker>
          ))}

          {/* ── Clearances ───────────────────────────────────────────── */}
          {on('clearances') && (project ? scene.projectClearances.filter(c => c.status !== 'granted') : scene.clearances).map(c => (
            <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={5}
              pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: c.breached ? 0.8 : 0.35, weight: 2 }}
              eventHandlers={{ click: () => setSelected({ kind: 'clearance', data: c }) }}>
              <LTooltip>
                <strong>{c.typeLabel}</strong><br />{c.authority}<br />
                {c.statusLabel}{c.daysPending != null ? ` · ${c.daysPending} d / SLA ${c.slaDays} d` : ''}
              </LTooltip>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* ── Base map — three single-purpose views ─────────────────── */}
        <div className="absolute z-[600] rounded-xl overflow-hidden"
          style={{ top: 84, right: 12, background: 'var(--app-panel)', border: '1px solid var(--app-panel-border)', boxShadow: 'var(--app-shadow-md)' }}>
          <div className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
            Base map
          </div>
          <div className="flex flex-col pb-1.5 px-1.5" style={{ width: 132 }}>
            {BASEMAPS.map(b => (
              <button key={b.key} onClick={() => setBasemapKey(b.key)} title={b.hint}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-left"
                style={{
                  background: basemapKey === b.key ? 'rgba(59,125,232,0.15)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: basemapKey === b.key ? 'var(--app-accent)' : 'var(--app-text-faint)',
                }} />
                <span className="text-[10.5px] font-semibold"
                  style={{ color: basemapKey === b.key ? 'var(--app-text)' : 'var(--app-text-faint)' }}>{b.label}</span>
              </button>
            ))}
          </div>
          {tilesDown && (
            <div className="px-2.5 pb-2 text-[9px] leading-snug" style={{ color: 'var(--app-warning)' }}>
              Tiles unavailable — the corridor overlay is still live.
            </div>
          )}
        </div>

        {/* ── Layer switchboard ─────────────────────────────────────── */}
        <div className="absolute top-3 left-3 z-[600]" style={{ width: showLayers ? 232 : 'auto' }}>
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--app-panel)', border: '1px solid var(--app-panel-border)', boxShadow: 'var(--app-shadow-md)' }}>
            <button onClick={() => setShowLayers(s => !s)}
              className="w-full flex items-center gap-2 px-3 py-2"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <svg className="w-3.5 h-3.5" style={{ color: 'var(--app-accent)' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
              </svg>
              <span className="text-[11px] font-bold flex-1 text-left" style={{ color: 'var(--app-text)' }}>Twin layers</span>
              <span className="text-[9.5px] font-semibold" style={{ color: 'var(--app-text-faint)' }}>{layers.length}/{ALL_LAYERS.length}</span>
            </button>

            {showLayers && (
              <div className="px-3 pb-3 max-h-[52vh] overflow-y-auto">
                {LAYER_GROUPS.map(g => (
                  <div key={g.label} className="mb-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--app-text-faint)' }}>{g.label}</div>
                    {g.layers.map(l => (
                      <button key={l.key} onClick={() => toggleLayer(l.key)} title={l.hint}
                        className="w-full flex items-center gap-2 py-1 text-left"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <span className="rounded-full transition-colors flex items-center px-0.5 shrink-0"
                          style={{ width: 26, height: 15, background: on(l.key) ? 'var(--app-accent)' : 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', transform: on(l.key) ? 'translateX(11px)' : 'translateX(0)', transition: 'transform .15s' }} />
                        </span>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: l.swatch, flexShrink: 0 }} />
                        <span className="text-[10.5px] font-semibold truncate"
                          style={{ color: on(l.key) ? 'var(--app-text)' : 'var(--app-text-faint)' }}>{l.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="flex gap-1.5 pt-1" style={{ borderTop: '1px solid var(--app-border)' }}>
                  <Btn onClick={() => setLayers(ALL_LAYERS)} style={{ padding: '3px 8px', fontSize: 10, flex: 1 }}>All</Btn>
                  <Btn onClick={() => setLayers([])} style={{ padding: '3px 8px', fontSize: 10, flex: 1 }}>None</Btn>
                  <Btn onClick={() => setLayers(DEFAULT_LAYERS)} style={{ padding: '3px 8px', fontSize: 10, flex: 1 }}>Reset</Btn>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Legend ────────────────────────────────────────────────── */}
        <div className="absolute bottom-3 left-3 z-[600] rounded-xl px-3 py-2.5"
          style={{ background: 'var(--app-panel)', border: '1px solid var(--app-panel-border)', boxShadow: 'var(--app-shadow-md)', maxWidth: 250 }}>
          {project && on('progress') && (
            <>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-text-faint)' }}>Track progress</div>
              <div className="flex flex-col gap-1 mb-2">
                {['done', 'active', 'pending', 'blocked'].map(k => (
                  <span key={k} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                    <span style={{ width: 16, height: 4, borderRadius: 2, background: SEGMENT_STATE[k].color }} />
                    {SEGMENT_STATE[k].label}
                  </span>
                ))}
              </div>
            </>
          )}
          {project && on('land') && (
            <>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-text-faint)' }}>Land</div>
              <div className="flex flex-col gap-1">
                {[['possession_taken', 'Acquired — in possession'], ['sec20f_awarded', 'Award passed / payment'], ['identified', 'Not acquired'], ['court_stay', 'Disputed / court stay']].map(([k, label]) => (
                  <span key={k} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: LAND_COLOR[k], opacity: 0.75 }} />{label}
                  </span>
                ))}
              </div>
            </>
          )}
          {!project && (
            <>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-text-faint)' }}>Northern corridors</div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  <span style={{ width: 16, height: 4, borderRadius: 2, background: SEGMENT_STATE.done.color }} />Completed length
                </span>
                <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  <span style={{ width: 16, height: 4, borderRadius: 2, background: '#dc2626', opacity: 0.6 }} />Balance length
                </span>
                <span className="text-[9.5px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>Click any corridor to open it</span>
              </div>
            </>
          )}
          <div className="text-[8.5px] mt-2 pt-1.5" style={{ borderTop: '1px solid rgba(128,128,128,0.16)', color: 'var(--app-text-faint)' }}>
            {basemap.label} base · {basemap.attribution}
          </div>
        </div>

        {/* ── Timeline scrubber ─────────────────────────────────────── */}
        {project && (
          <div className="absolute bottom-3 right-3 z-[600] rounded-xl px-3 py-2.5"
            style={{ background: 'var(--app-panel)', border: '1px solid var(--app-panel-border)', boxShadow: 'var(--app-shadow-md)', width: 268 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>Corridor as at</span>
              <span className="text-[10.5px] font-bold" style={{ color: monthsBack === 0 ? 'var(--app-success)' : 'var(--app-warning)' }}>
                {monthsBack === 0 ? 'Today' : monthLabel(monthsBack)}
              </span>
            </div>
            <input type="range" min={0} max={12} step={1} value={12 - monthsBack}
              onChange={e => setMonthsBack(12 - Number(e.target.value))}
              aria-label="Replay corridor progress"
              style={{ width: '100%', accentColor: 'var(--app-accent)' }} />
            <div className="flex items-center justify-between text-[9px]" style={{ color: 'var(--app-text-faint)' }}>
              <span>{monthLabel(12)}</span><span>replay build-out</span><span>today</span>
            </div>
          </div>
        )}

        {flash && (
          <div className="absolute top-3 left-1/2 z-[700] rounded-lg px-3 py-2 text-[11px] font-semibold animate-slide-up"
            style={{
              transform: 'translateX(-50%)',
              background: flash.tone === 'bad' ? 'var(--app-danger-bg)' : 'var(--app-success-bg)',
              color: flash.tone === 'bad' ? 'var(--app-danger)' : 'var(--app-success)',
              border: `1px solid ${flash.tone === 'bad' ? 'var(--app-danger-border)' : 'var(--app-success-border)'}`,
            }}>
            {flash.text}
          </div>
        )}
      </div>

      {/* ══ SIDE RAIL ════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[400px] shrink-0 overflow-y-auto p-3 space-y-3"
        style={{ borderLeft: '1px solid var(--app-panel-border)', background: 'var(--app-bg)' }}>

        {!project ? (
          <>
            <Panel title="Northern Corridor Twin"
              subtitle={`${corridors.length} live corridors · ${scene.stats.activeCount} under execution`}>
              <div className="space-y-2.5">
                <ZoneFilterBar value={zone} onChange={setZone} />
                <SearchBox value={q} onChange={setQ} placeholder="Search corridor…" width="100%" />
                <Select value={health} onChange={setHealth} label="Health" width={150}
                  options={[{ value: 'all', label: 'All' }, { value: 'critical', label: 'Critical' }, { value: 'warning', label: 'At risk' }, { value: 'normal', label: 'On track' }]} />
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <MiniStat label="Corridor km" value={Math.round(corridors.reduce((a, c) => a + c.lengthKm, 0)).toLocaleString('en-IN')} />
                  <MiniStat label="Land acquired" value={`${scene.stats.land.acquiredPct}%`} tone="var(--app-success)" />
                  <MiniStat label="Blocked" value={`${scene.stats.land.blockedKm} km`} tone="var(--app-danger)" />
                </div>
              </div>
            </Panel>

            <Panel title="Corridors" subtitle="Select one to open its twin">
              {corridors.length === 0 ? (
                <EmptyState title="No corridors match" hint="Widen the zone filter or clear the search." />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {corridors.map(c => (
                    <button key={c.id} onClick={() => openProject(c.id)}
                      className="rounded-lg p-2.5 text-left" style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold leading-snug" style={{ color: 'var(--app-text)' }}>{c.name}</span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: RAG[c.health], flexShrink: 0, marginTop: 3 }} />
                      </div>
                      <Progress value={c.physicalProgress} height={4} rag={c.health} />
                      <div className="flex items-center justify-between mt-1.5 text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
                        <span>{c.zone} · {c.typeLabel}</span>
                        <span>{c.lengthKm} km · {pct(c.physicalProgress)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </>
        ) : (
          <ProjectRail
            scene={scene} project={project} tab={tab} setTab={setTab}
            selected={selected} setSelected={setSelected}
            onBack={() => openProject(null)}
            onOpenDetail={() => navigate(`/projects/${project.id}`)}
            onUpload={() => setUploadOpen(true)}
            onReviewPhoto={async (id, status) => {
              await actOnSitePhoto(id, status, status === 'accepted' ? 'Evidence accepted by engineer' : 'Evidence returned to site');
              setFlash({ text: status === 'accepted' ? 'Evidence accepted' : 'Evidence returned to site', tone: status === 'accepted' ? 'good' : 'bad' });
              setTimeout(() => setFlash(null), 2600);
            }}
            monthsBack={monthsBack}
          />
        )}
      </div>

      {uploadOpen && (
        <SitePhotoUpload
          project={project} packages={scene.packages || []}
          user={user} online={online}
          onClose={() => setUploadOpen(false)}
          onDone={(rec) => {
            setFlash({
              text: `AI: ${AI_VERDICT[rec.verdict].label} · ${(rec.confidence * 100).toFixed(0)}% confidence`,
              tone: ['verified', 'partial'].includes(rec.verdict) ? 'good' : 'bad',
            });
            setTimeout(() => setFlash(null), 3600);
            setTab('site');
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECT RAIL
   ═══════════════════════════════════════════════════════════════════════════ */
function ProjectRail({ scene, project, tab, setTab, selected, setSelected, onBack, onOpenDetail, onUpload, onReviewPhoto, monthsBack }) {
  const bands = scene.progressBands || {};
  const land = scene.landSummary || {};
  const photos = scene.projectPhotos || [];
  const awaiting = photos.filter(p => p.reviewStatus === 'engineer_review' || p.reviewStatus === 'open').length;

  return (
    <>
      <Panel
        title={project.name}
        subtitle={`${project.code} · ${project.typeLabel} · ${project.lengthKm} km · ${project.terrain}`}
        actions={<Btn onClick={onBack} style={{ padding: '3px 8px', fontSize: 10 }}>← All</Btn>}>
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Chip tone={project.health} dot>{project.health === 'normal' ? 'ON TRACK' : project.health === 'warning' ? 'AT RISK' : 'CRITICAL'}</Chip>
            <Chip tone="info">{project.zone}</Chip>
            <Chip tone="accent">{project.piuName.replace('PIU ', '')}</Chip>
          </div>
          <Progress value={project.physicalProgress} planned={project.plannedPhysical} rag={project.health} height={8} showLabel />
          {monthsBack > 0 && (
            <div className="text-[10px] rounded-md px-2 py-1.5"
              style={{ background: 'var(--app-warning-bg)', color: 'var(--app-warning)', border: '1px solid var(--app-warning-border)' }}>
              Replaying the corridor as at {monthLabel(monthsBack)} — move the scrubber to “today” for live state.
            </div>
          )}
          <Tabs value={tab} onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Corridor' },
              { value: 'land', label: 'Land' },
              { value: 'site', label: 'Site', count: awaiting || undefined },
              { value: 'schedule', label: 'Schedule' },
              { value: 'issues', label: 'Issues' },
            ]} />
        </div>
      </Panel>

      {selected && <SelectionCard selection={selected} onClose={() => setSelected(null)} />}

      {tab === 'overview' && (
        <>
          <Panel title="Track laid vs balance" subtitle="Measured along the alignment">
            <div className="space-y-3">
              <StackBar
                parts={[
                  { label: 'Completed', value: bands.doneKm || 0, color: SEGMENT_STATE.done.color },
                  { label: 'In progress', value: bands.activeKm || 0, color: SEGMENT_STATE.active.color },
                  { label: 'Not started', value: bands.pendingKm || 0, color: SEGMENT_STATE.pending.color },
                ]}
                unit="km" />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Completed" value={`${bands.doneKm ?? 0} km`} tone="var(--app-success)" />
                <MiniStat label="Work front" value={`${bands.activeKm ?? 0} km`} tone="var(--app-warning)" />
                <MiniStat label="Not started" value={`${bands.pendingKm ?? 0} km`} tone="var(--app-danger)" />
                <MiniStat label="Blocked by land" value={`${bands.blockedKm ?? 0} km`} tone="var(--app-danger)"
                  sub={bands.blockedKm ? 'dashed on the map' : 'none'} />
              </div>
            </div>
          </Panel>

          <Panel title="Sections" subtitle={`${scene.segments.length} stretches · click to locate`}>
            <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
              {scene.segments.map(s => (
                <button key={s.id} onClick={() => setSelected({ kind: 'segment', data: s })}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left"
                  style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
                  <span style={{ width: 4, height: 22, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                      {SEGMENT_STATE[s.state].label} · {s.lengthKm} km
                    </span>
                    <span className="block text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>
                      {chainage(s.fromChainageM)} → {chainage(s.toChainageM)} · {s.packageName}
                    </span>
                  </span>
                  {s.blocked && <Chip tone="critical">LAND</Chip>}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Structures on the corridor" subtitle={`${scene.projectStructures.length} structures`}>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(
                scene.projectStructures.reduce((acc, s) => {
                  acc[s.typeLabel] = acc[s.typeLabel] || { n: 0, done: 0, color: STRUCT_COLOR[s.type] };
                  acc[s.typeLabel].n += 1;
                  acc[s.typeLabel].done += s.progressPct;
                  return acc;
                }, {})
              ).map(([label, v]) => (
                <div key={label} className="rounded-lg p-2" style={{ background: 'var(--app-surface-soft)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
                    <span className="text-[10px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{label}</span>
                  </div>
                  <div className="text-[15px] font-bold leading-none" style={{ color: 'var(--app-text)' }}>{v.n}</div>
                  <Progress value={v.done / v.n} height={3} rag={v.done / v.n > 70 ? 'normal' : v.done / v.n > 35 ? 'warning' : 'critical'} />
                </div>
              ))}
            </div>
          </Panel>

          <Btn variant="primary" onClick={onOpenDetail} style={{ width: '100%' }}>Open full project dashboard</Btn>
        </>
      )}

      {tab === 'land' && (
        <>
          <Panel title="Land acquisition" subtitle={`${land.total} parcels · ${land.areaTotal} ha on this alignment`}>
            <div className="space-y-3">
              <StackBar
                parts={[
                  { label: 'Acquired', value: scene.parcels.filter(p => LAND_BUCKET(p.status) === 'acquired').length, color: LAND_COLOR.possession_taken },
                  { label: 'In process', value: scene.parcels.filter(p => LAND_BUCKET(p.status) === 'in_progress').length, color: LAND_COLOR.sec20f_awarded },
                  { label: 'Not acquired', value: scene.parcels.filter(p => LAND_BUCKET(p.status) === 'not_acquired').length, color: LAND_COLOR.identified },
                  { label: 'Disputed', value: scene.parcels.filter(p => LAND_BUCKET(p.status) === 'disputed').length, color: LAND_COLOR.court_stay },
                ]}
                unit="parcels" />
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="In possession" value={`${land.acquiredPct}%`} tone="var(--app-success)" sub={`${land.taken} of ${land.total}`} />
                <MiniStat label="Alignment blocked" value={`${land.blockedKm} km`} tone="var(--app-danger)" />
                <MiniStat label="Disputed / stay" value={land.disputed} tone="var(--app-danger)" />
                <MiniStat label="Compensation" value={inr(land.compensationTotal, { unit: 'cr', decimals: 0 })} />
              </div>
            </div>
          </Panel>

          <Panel title="Parcels still to acquire" subtitle="Red bands on the twin — ordered by chainage">
            <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
              {scene.parcels.filter(p => p.status !== 'possession_taken').slice(0, 60).map(p => (
                <button key={p.id} onClick={() => setSelected({ kind: 'parcel', data: p })}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left"
                  style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: LAND_COLOR[p.status], flexShrink: 0 }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                      {p.village} · parcel {p.parcelRef}
                    </span>
                    <span className="block text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>
                      {chainage(p.fromChainageM)} · {p.areaHectare} ha · {p.landType}
                    </span>
                  </span>
                  <Chip tone={p.rag}>{p.statusLabel}</Chip>
                </button>
              ))}
              {scene.parcels.filter(p => p.status !== 'possession_taken').length === 0 && (
                <EmptyState title="Alignment fully in possession" hint="Every parcel on this corridor has been handed over." />
              )}
            </div>
          </Panel>
        </>
      )}

      {tab === 'site' && (
        <SitePanel scene={scene} photos={photos} onUpload={onUpload}
          onReviewPhoto={onReviewPhoto} setSelected={setSelected} />
      )}

      {tab === 'schedule' && (
        <Panel title="Milestones on the corridor" subtitle="Marked at their alignment position">
          <div className="flex flex-col gap-1 max-h-[520px] overflow-y-auto">
            {scene.milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: 'var(--app-surface-soft)' }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: m.status === 'completed' ? 'var(--app-success)' : m.status === 'overdue' ? 'var(--app-danger)' : 'var(--app-info)',
                }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[10.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{m.code} · {m.name}</span>
                  <span className="block text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
                    {chainage(m.chainageM)} · planned {fmtDate(m.plannedFinish)}
                  </span>
                </span>
                {m.slipDays > 0 && <span className="text-[10px] font-bold" style={{ color: 'var(--app-danger)' }}>+{m.slipDays}d</span>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'issues' && (
        <>
          <Panel title="Open risks" subtitle={`${scene.projectRisks.length} on this corridor`}>
            <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
              {scene.projectRisks.slice(0, 20).map(r => (
                <button key={r.id} onClick={() => setSelected({ kind: 'risk', data: r })}
                  className="rounded-md px-2 py-1.5 text-left" style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Chip tone={r.severity}>{r.categoryLabel}</Chip>
                    <span className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>{chainage(r.chainageM)}</span>
                  </div>
                  <div className="text-[10.5px]" style={{ color: 'var(--app-text)' }}>{r.title}</div>
                </button>
              ))}
              {!scene.projectRisks.length && <EmptyState title="No open risks" />}
            </div>
          </Panel>

          <Panel title="Clearances" subtitle="Statutory approvals against this corridor">
            <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
              {scene.projectClearances.map(c => (
                <button key={c.id} onClick={() => setSelected({ kind: 'clearance', data: c })}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left"
                  style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{c.typeLabel}</span>
                    <span className="block text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>{c.authority}</span>
                  </span>
                  <Chip tone={c.status === 'granted' ? 'normal' : c.breached ? 'critical' : 'warning'}>{c.statusLabel}</Chip>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Safety events" subtitle={`${scene.projectIncidents.filter(i => i.status === 'open').length} open`}>
            <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
              {scene.projectIncidents.slice(0, 15).map(s => (
                <div key={s.id} className="rounded-md px-2 py-1.5" style={{ background: 'var(--app-surface-soft)' }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Chip tone={s.severity}>{s.typeLabel}</Chip>
                    <span className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>{chainage(s.chainageM)}</span>
                  </div>
                  <div className="text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>{s.description}</div>
                </div>
              ))}
              {!scene.projectIncidents.length && <EmptyState title="No safety events recorded" />}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SITE PANEL — worker evidence + AI validation
   ═══════════════════════════════════════════════════════════════════════════ */
function SitePanel({ scene, photos, onUpload, onReviewPhoto, setSelected }) {
  const [filter, setFilter] = useState('all');
  const crews = scene.projectCrews || [];
  const shown = filter === 'all' ? photos : photos.filter(p => p.verdict === filter);

  const counts = {
    verified: photos.filter(p => p.verdict === 'verified').length,
    partial: photos.filter(p => p.verdict === 'partial').length,
    flagged: photos.filter(p => p.verdict === 'flagged').length,
    rejected: photos.filter(p => p.verdict === 'rejected').length,
  };

  return (
    <>
      <Panel title="Site reporting" subtitle="Anyone on site can post evidence against a work item"
        actions={<Btn variant="primary" onClick={onUpload} style={{ padding: '4px 10px', fontSize: 10.5 }}>Upload photo</Btn>}>
        <div className="space-y-2.5">
          <div className="grid grid-cols-4 gap-2">
            {[['verified', 'Verified'], ['partial', 'Partial'], ['flagged', 'Flagged'], ['rejected', 'Rejected']].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(f => (f === k ? 'all' : k))}
                className="rounded-lg py-1.5 px-1"
                style={{
                  background: filter === k ? 'var(--app-surface-raised)' : 'var(--app-surface-soft)',
                  border: `1px solid ${filter === k ? VERDICT_COLOR[k] : 'transparent'}`, cursor: 'pointer',
                }}>
                <div className="text-[15px] font-bold leading-none" style={{ color: VERDICT_COLOR[k] }}>{counts[k]}</div>
                <div className="text-[8.5px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{label}</div>
              </button>
            ))}
          </div>
          <div className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
            Frames are read by the work-validation model — it lists what it can see, compares that with the
            claimed progress and the GPS fix, and either corroborates the claim or sends it to the engineer.
          </div>
        </div>
      </Panel>

      <Panel title="Crews on site" subtitle={`${crews.length} gangs reporting`}>
        <div className="flex flex-col gap-1 max-h-[190px] overflow-y-auto">
          {crews.map(c => (
            <button key={c.id} onClick={() => setSelected({ kind: 'crew', data: c })}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left"
              style={{ background: 'var(--app-surface-soft)', border: 'none', cursor: 'pointer' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: c.status === 'on_site' ? 'var(--app-success)' : c.status === 'reported' ? 'var(--app-warning)' : 'var(--app-text-faint)',
              }} />
              <span className="flex-1 min-w-0">
                <span className="block text-[10.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{c.name} · {c.roleLabel}</span>
                <span className="block text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>{c.activity} · {chainage(c.chainageM)}</span>
              </span>
              <span className="text-[9.5px] shrink-0" style={{ color: 'var(--app-text-faint)' }}>{c.headcount}p</span>
            </button>
          ))}
          {!crews.length && <EmptyState title="No crews reporting" hint="Packages here are not yet in progress." />}
        </div>
      </Panel>

      <Panel title="Photo evidence" subtitle={`${shown.length} frames${filter !== 'all' ? ` · ${AI_VERDICT[filter].label}` : ''}`}>
        <div className="flex flex-col gap-2 max-h-[560px] overflow-y-auto">
          {shown.map(p => <PhotoCard key={p.id} photo={p} onReview={onReviewPhoto} onLocate={() => setSelected({ kind: 'photo', data: p })} />)}
          {!shown.length && <EmptyState title="No evidence yet" hint="Upload a site photo to run the work-validation model." />}
        </div>
      </Panel>
    </>
  );
}

/* Synthetic frame used where no real image exists — clearly labelled. */
function FramePlaceholder({ label, tint }) {
  return (
    <div style={{
      width: 78, height: 58, borderRadius: 6, flexShrink: 0, position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, ${tint}22 0%, ${tint}55 55%, ${tint}22 100%)`,
      border: '1px solid var(--app-border)',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 6px, transparent 6px 12px)' }} />
      <span style={{
        position: 'absolute', bottom: 3, left: 4, right: 4, fontSize: 7.5, fontWeight: 700,
        letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--app-text-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</span>
    </div>
  );
}

function PhotoCard({ photo, onReview, onLocate }) {
  const [open, setOpen] = useState(false);
  const v = AI_VERDICT[photo.verdict] || AI_VERDICT.pending;

  return (
    <div className="rounded-lg p-2.5" style={{ background: 'var(--app-surface-soft)' }}>
      <div className="flex gap-2.5">
        {photo.imageUrl
          ? <img src={photo.imageUrl} alt={photo.workItemLabel}
              style={{ width: 78, height: 58, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid var(--app-border)' }} />
          : <FramePlaceholder label={photo.workItemLabel} tint={VERDICT_COLOR[photo.verdict] || '#64748b'} />}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <Chip tone={v.rag}>{v.label}</Chip>
            {photo.isLocal && <Chip tone="info">NEW</Chip>}
          </div>
          <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{photo.workItemLabel}</div>
          <div className="text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>
            {photo.capturedBy} · {photo.capturedRole} · {chainage(photo.chainageM)}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="progress-track flex-1" style={{ height: 4 }}>
              <div className="progress-fill" style={{ width: `${photo.confidence * 100}%`, background: VERDICT_COLOR[photo.verdict] }} />
            </div>
            <span className="text-[9px] font-bold tabular-nums" style={{ color: 'var(--app-text-muted)' }}>
              {(photo.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => setOpen(o => !o)} className="text-[9.5px] font-bold"
          style={{ background: 'none', border: 'none', color: 'var(--app-accent)', cursor: 'pointer', padding: 0 }}>
          {open ? 'Hide model read' : 'Model read'}
        </button>
        <button onClick={onLocate} className="text-[9.5px] font-bold"
          style={{ background: 'none', border: 'none', color: 'var(--app-text-faint)', cursor: 'pointer', padding: 0 }}>
          Locate
        </button>
        <div className="flex-1" />
        {photo.reviewStatus !== 'auto_accepted' && photo.reviewStatus !== 'accepted' && (
          <>
            <Btn variant="success" onClick={() => onReview(photo.id, 'accepted')} style={{ padding: '2px 8px', fontSize: 9.5 }}>Accept</Btn>
            <Btn variant="danger" onClick={() => onReview(photo.id, 'rejected')} style={{ padding: '2px 8px', fontSize: 9.5 }}>Return</Btn>
          </>
        )}
        {(photo.reviewStatus === 'auto_accepted' || photo.reviewStatus === 'accepted') && (
          <span className="text-[9px] font-bold" style={{ color: 'var(--app-success)' }}>
            {photo.reviewStatus === 'auto_accepted' ? 'AUTO-ACCEPTED' : 'ACCEPTED'}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(128,128,128,0.16)' }}>
          <div>
            <div className="text-[8.5px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--app-text-faint)' }}>Detected in frame</div>
            <div className="flex flex-wrap gap-1">
              {photo.detections.map((d, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    background: d.matchesScope ? 'var(--app-success-bg)' : 'var(--app-surface)',
                    color: d.matchesScope ? 'var(--app-success)' : 'var(--app-text-faint)',
                    border: `1px solid ${d.matchesScope ? 'var(--app-success-border)' : 'var(--app-border)'}`,
                  }}>
                  {d.label} {(d.confidence * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {photo.checks.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800,
                  background: c.pass ? 'var(--app-success-bg)' : 'var(--app-danger-bg)',
                  color: c.pass ? 'var(--app-success)' : 'var(--app-danger)',
                }}>{c.pass ? '✓' : '!'}</span>
                <span className="min-w-0">
                  <span className="block text-[9.5px] font-semibold" style={{ color: 'var(--app-text)' }}>{c.label}</span>
                  <span className="block text-[9px]" style={{ color: 'var(--app-text-faint)' }}>{c.detail}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <MiniStat label="Claimed" value={photo.claimedPct == null ? '—' : `${photo.claimedPct}%`} />
            <MiniStat label="Model reads" value={`${photo.estimatedPct}%`} tone={VERDICT_COLOR[photo.verdict]} />
            <MiniStat label="Gap" value={photo.gapPct == null ? '—' : `${photo.gapPct > 0 ? '+' : ''}${photo.gapPct} pp`} />
          </div>
          {photo.note && <div className="text-[9.5px] italic" style={{ color: 'var(--app-text-muted)' }}>“{photo.note}”</div>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   UPLOAD MODAL — site worker flow
   ═══════════════════════════════════════════════════════════════════════════ */
function SitePhotoUpload({ project, packages, user, online, onClose, onDone }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [workItem, setWorkItem] = useState(WORK_ITEMS[0].code);
  const [packageId, setPackageId] = useState(packages[0]?.id || '');
  const [chainageKm, setChainageKm] = useState(() => ((packages[0]?.fromChainageM || 0) / 1000).toFixed(1));
  const [claimed, setClaimed] = useState(60);
  const [note, setNote] = useState('');
  const [stage, setStage] = useState('form');            // form → analysing → result
  const [result, setResult] = useState(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = (f) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const run = async () => {
    setStage('analysing');
    const seed = file ? (file.size % 9973) + file.name.length : Math.floor(Math.random() * 9973);
    const frame = simulateFrameAnalysis(workItem, seed);
    const res = await uploadSitePhoto({
      projectId: project.id,
      packageId,
      workItem,
      chainageM: Math.round(Number(chainageKm) * 1000),
      claimedPct: Number(claimed),
      capturedBy: user?.fullName,
      capturedRole: user?.designation?.includes('Engineer') ? 'Site Engineer' : 'Site Worker',
      fileName: file?.name,
      sizeKb: file ? Math.round(file.size / 1024) : 800,
      imageUrl: preview,
      note,
      ...frame,
    });
    setResult(res.data);
    setStage('result');
    onDone(res.data);
  };

  const v = result ? (AI_VERDICT[result.verdict] || AI_VERDICT.pending) : null;

  return (
    <>
      <div onClick={onClose} className="app-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div className="flex flex-col rounded-2xl"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(460px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 80px)', zIndex: 950,
          background: 'var(--app-panel)', border: '1px solid var(--app-panel-border)', boxShadow: 'var(--app-shadow-lg)',
        }}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(128,128,128,0.18)' }}>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-bold leading-tight" style={{ color: 'var(--app-text)' }}>Site photo evidence</h3>
            <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
              {project.name} · validated on upload{online ? '' : ' · queued, device offline'}
            </p>
          </div>
          <button onClick={onClose} className="icon-btn shrink-0" aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {stage === 'form' && (
            <div className="space-y-3">
              <button onClick={() => inputRef.current?.click()}
                className="w-full rounded-xl flex flex-col items-center justify-center gap-1.5"
                style={{
                  height: preview ? 168 : 110, border: '1.5px dashed var(--app-border)',
                  background: preview ? `center/cover no-repeat url(${preview})` : 'var(--app-surface-soft)',
                  cursor: 'pointer', overflow: 'hidden',
                }}>
                {!preview && (
                  <>
                    <svg className="w-6 h-6" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                      <path d="M3 9a2 2 0 012-2h1.6l1-2h6.8l1 2H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <circle cx="12" cy="13" r="3.4" />
                    </svg>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>Take or choose a site photo</span>
                    <span className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>JPG or PNG from the work front</span>
                  </>
                )}
              </button>
              <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => pickFile(e.target.files?.[0])} />
              {file && (
                <div className="text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </div>
              )}

              <Select value={workItem} onChange={setWorkItem} label="Work item" width="100%"
                options={WORK_ITEMS.map(w => ({ value: w.code, label: w.label }))} />

              {packages.length > 0 && (
                <Select value={packageId} onChange={setPackageId} label="Package" width="100%"
                  options={packages.map(p => ({ value: p.id, label: `${p.name} — ${p.scope.slice(0, 28)}` }))} />
              )}

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Chainage (km)</span>
                <input type="number" step="0.1" value={chainageKm} onChange={e => setChainageKm(e.target.value)}
                  className="app-control-btn w-full mt-1" style={{ padding: '6px 9px', fontSize: 12, color: 'var(--app-text)' }} />
              </label>

              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Progress claimed</span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--app-text)' }}>{claimed}%</span>
                </div>
                <input type="range" min={0} max={100} value={claimed} onChange={e => setClaimed(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--app-accent)' }} />
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Note (optional)</span>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="What was done at this location today"
                  className="app-control-btn w-full mt-1" style={{ padding: '6px 9px', fontSize: 12, color: 'var(--app-text)', resize: 'vertical', fontFamily: 'inherit' }} />
              </label>

              <div className="text-[9.5px] rounded-md px-2 py-1.5" style={{ background: 'var(--app-surface-soft)', color: 'var(--app-text-faint)' }}>
                The frame stays on the device until it passes validation. GPS, chainage and the claimed
                percentage are all cross-checked against what the model can see.
              </div>
            </div>
          )}

          {stage === 'analysing' && (
            <div className="py-8">
              <Loading label="Reading the frame — detecting work elements…" />
              <div className="mt-3 space-y-1.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                {['Decoding image and EXIF', 'Matching GPS fix to the work front', 'Detecting scope elements', 'Comparing against claimed progress'].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--app-accent)' }} />{s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === 'result' && result && (
            <div className="space-y-3">
              <div className="rounded-xl p-3 flex items-center gap-3"
                style={{
                  background: result.verdict === 'verified' ? 'var(--app-success-bg)' : result.verdict === 'rejected' ? 'var(--app-danger-bg)' : 'var(--app-warning-bg)',
                  border: `1px solid ${result.verdict === 'verified' ? 'var(--app-success-border)' : result.verdict === 'rejected' ? 'var(--app-danger-border)' : 'var(--app-warning-border)'}`,
                }}>
                {preview
                  ? <img src={preview} alt="uploaded frame" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                  : <FramePlaceholder label={result.workItemLabel} tint={VERDICT_COLOR[result.verdict]} />}
                <div className="min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: VERDICT_COLOR[result.verdict] }}>{v.label}</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
                    {(result.confidence * 100).toFixed(0)}% confidence · model reads {result.estimatedPct}% against {result.claimedPct}% claimed
                  </div>
                </div>
              </div>

              <Facts columns={2} items={[
                { label: 'Work item', value: result.workItemLabel },
                { label: 'Chainage', value: chainage(result.chainageM) },
                { label: 'Captured by', value: result.capturedBy },
                { label: 'Sync', value: result.syncStatus === 'queued' ? 'Queued — offline' : 'Synced' },
              ]} />

              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--app-text-faint)' }}>Detected in frame</div>
                <div className="flex flex-wrap gap-1">
                  {result.detections.map((d, i) => (
                    <span key={i} className="text-[9.5px] px-1.5 py-0.5 rounded"
                      style={{
                        background: d.matchesScope ? 'var(--app-success-bg)' : 'var(--app-surface)',
                        color: d.matchesScope ? 'var(--app-success)' : 'var(--app-text-faint)',
                        border: `1px solid ${d.matchesScope ? 'var(--app-success-border)' : 'var(--app-border)'}`,
                      }}>{d.label} {(d.confidence * 100).toFixed(0)}%</span>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                {result.checks.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800,
                      background: c.pass ? 'var(--app-success-bg)' : 'var(--app-danger-bg)',
                      color: c.pass ? 'var(--app-success)' : 'var(--app-danger)',
                    }}>{c.pass ? '✓' : '!'}</span>
                    <span className="min-w-0">
                      <span className="block text-[10.5px] font-semibold" style={{ color: 'var(--app-text)' }}>{c.label}</span>
                      <span className="block text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>{c.detail}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
                {result.verdict === 'verified'
                  ? 'Auto-accepted — the evidence is now on the twin at this chainage.'
                  : 'Sent to the section engineer for review; it is on the twin flagged for attention.'}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 shrink-0 flex items-center gap-2" style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
          {stage === 'form' && (
            <>
              <Btn onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="primary" onClick={run} disabled={!file} style={{ flex: 2 }}>
                {file ? 'Validate work with AI' : 'Choose a photo first'}
              </Btn>
            </>
          )}
          {stage === 'analysing' && <Btn disabled style={{ width: '100%' }}>Analysing…</Btn>}
          {stage === 'result' && (
            <>
              <Btn onClick={() => { setStage('form'); setResult(null); setFile(null); setPreview(null); }} style={{ flex: 1 }}>Upload another</Btn>
              <Btn variant="primary" onClick={onClose} style={{ flex: 1 }}>Done</Btn>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELECTION CARD — whatever was last clicked on the twin
   ═══════════════════════════════════════════════════════════════════════════ */
function SelectionCard({ selection, onClose }) {
  const { kind, data } = selection;

  const body = {
    segment: () => (
      <Facts columns={2} items={[
        { label: 'State', value: SEGMENT_STATE[data.state].label, tone: data.color },
        { label: 'Length', value: `${data.lengthKm} km` },
        { label: 'From', value: chainage(data.fromChainageM) },
        { label: 'To', value: chainage(data.toChainageM) },
        { label: 'Package', value: data.packageName },
        { label: 'Package progress', value: pct(data.packageProgress) },
        { label: 'Contractor', value: data.contractorName || 'Not awarded', full: true },
        data.blocked ? { label: 'Blocker', value: 'Land not in possession on this stretch', tone: 'var(--app-danger)', full: true } : null,
      ]} />
    ),
    parcel: () => (
      <Facts columns={2} items={[
        { label: 'Parcel', value: data.parcelRef },
        { label: 'Status', value: data.statusLabel, tone: LAND_COLOR[data.status] },
        { label: 'Village', value: data.village },
        { label: 'District', value: data.district },
        { label: 'Area', value: `${data.areaHectare} ha` },
        { label: 'Land type', value: data.landType },
        { label: 'Chainage', value: `${chainage(data.fromChainageM)} → ${chainage(data.toChainageM)}`, full: true },
        { label: 'Compensation', value: inr(data.compensationAmount) },
        { label: 'Possession', value: data.possessionDate ? fmtDate(data.possessionDate) : 'Not taken' },
        data.remarks ? { label: 'Remarks', value: data.remarks, full: true, tone: 'var(--app-danger)' } : null,
      ]} />
    ),
    structure: () => (
      <Facts columns={2} items={[
        { label: 'Structure', value: `${data.typeLabel} ${data.refCode}` },
        { label: 'Chainage', value: chainage(data.chainageM) },
        { label: 'Length', value: `${data.lengthM} m` },
        { label: 'Progress', value: pct(data.progressPct) },
      ]} />
    ),
    crew: () => (
      <Facts columns={2} items={[
        { label: 'Reported by', value: data.name },
        { label: 'Role', value: data.roleLabel },
        { label: 'Activity', value: data.activity, full: true },
        { label: 'Headcount', value: data.headcount },
        { label: 'Chainage', value: chainage(data.chainageM) },
        { label: 'Last ping', value: `${data.lastPingMins} min ago` },
        { label: 'Device', value: data.deviceId },
      ]} />
    ),
    photo: () => (
      <Facts columns={2} items={[
        { label: 'Work item', value: data.workItemLabel },
        { label: 'Verdict', value: AI_VERDICT[data.verdict].label, tone: VERDICT_COLOR[data.verdict] },
        { label: 'Captured by', value: data.capturedBy },
        { label: 'Chainage', value: chainage(data.chainageM) },
        { label: 'Claimed', value: data.claimedPct == null ? '—' : `${data.claimedPct}%` },
        { label: 'Model reads', value: `${data.estimatedPct}%` },
      ]} />
    ),
    incident: () => (
      <Facts columns={2} items={[
        { label: 'Type', value: data.typeLabel, tone: data.severity === 'critical' ? 'var(--app-danger)' : undefined },
        { label: 'Chainage', value: chainage(data.chainageM) },
        { label: 'Description', value: data.description, full: true },
        { label: 'Occurred', value: fmtDate(data.occurredOn) },
        { label: 'Status', value: data.status },
      ]} />
    ),
    risk: () => (
      <Facts columns={2} items={[
        { label: 'Category', value: data.categoryLabel },
        { label: 'Score', value: `${data.likelihood}×${data.impact}=${data.score}` },
        { label: 'Risk', value: data.title, full: true },
        { label: 'Exposure', value: inr(data.exposureAmount, { unit: 'cr', decimals: 0 }) },
        { label: 'Owner', value: data.owner },
        { label: 'Mitigation', value: data.mitigation, full: true },
      ]} />
    ),
    clearance: () => (
      <Facts columns={2} items={[
        { label: 'Clearance', value: data.typeLabel, full: true },
        { label: 'Authority', value: data.authority, full: true },
        { label: 'Status', value: data.statusLabel },
        { label: 'Pending', value: data.daysPending == null ? '—' : `${data.daysPending} d / SLA ${data.slaDays} d`, tone: data.breached ? 'var(--app-danger)' : undefined },
        { label: 'Portal ref', value: data.portalRef || '—', full: true },
      ]} />
    ),
  }[kind];

  const title = {
    segment: 'Track section', parcel: 'Land parcel', structure: 'Structure', crew: 'Site crew',
    photo: 'Photo evidence', incident: 'Safety event', risk: 'Risk', clearance: 'Clearance',
  }[kind] || 'Selection';

  return (
    <Panel title={title} subtitle="Selected on the twin"
      actions={<Btn onClick={onClose} style={{ padding: '3px 8px', fontSize: 10 }}>Clear</Btn>}>
      {body ? body() : null}
    </Panel>
  );
}

/* ─── Small stacked proportion bar ───────────────────────────────────────── */
function StackBar({ parts, unit }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div className="flex w-full rounded-md overflow-hidden" style={{ height: 12, background: 'var(--app-surface-soft)' }}>
        {parts.map((p, i) => (
          <span key={i} title={`${p.label}: ${p.value} ${unit}`}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color, display: 'block' }} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[9.5px]" style={{ color: 'var(--app-text-faint)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />
            {p.label} <strong style={{ color: 'var(--app-text-muted)' }}>{p.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export { LAND_COLOR, VERDICT_COLOR, monthLabel };
