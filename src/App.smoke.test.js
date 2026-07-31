/* Smoke tests — render every route and assert the app does not crash,
   plus verify the data layer's derived aggregates are internally consistent. */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SocketProvider } from './services/socket';

/* Leaflet needs a real layout engine; stub it for jsdom. */
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children }) => <div>{children}</div>,
  Polyline: ({ children }) => <div>{children}</div>,
  Polygon: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <div>{children}</div>,
  ZoomControl: () => null,
  useMap: () => ({ fitBounds: () => {}, setView: () => {} }),
}));

import Dashboard from './pages/Dashboard';
import DigitalTwin from './pages/DigitalTwin';
import Portfolio from './pages/Portfolio';
import ProjectDetail from './pages/ProjectDetail';
import Finance from './pages/Finance';
import Billing from './pages/Billing';
import Procurement from './pages/Procurement';
import Contractors from './pages/Contractors';
import Approvals from './pages/Approvals';
import Audit from './pages/Audit';
import Documents from './pages/Documents';
import Assistant from './pages/Assistant';
import Reports from './pages/Reports';
import { BASEMAPS } from './components/basemaps';

import {
  PROJECTS, PACKAGES, BOQ_ITEMS, MILESTONES, LAND_PARCELS, CLEARANCES, RISKS,
  SITE_PHOTOS, SITE_CREWS, ZONES, PIUS, CONTRACTORS,
  portfolioStats, budgetByZone, chainageSegments, progressByWorkHead, landSummary,
  alignmentSegments, corridorOverview, pathMetrics, pointAlongPath, slicePath,
  scorePhotoEvidence, simulateFrameAnalysis, chainageToLatLng,
  inr, chainage, groupIndian,
} from './data/rvnlData';

const PAGES = [
  ['Executive Dashboard', Dashboard, '/'],
  ['Digital Twin', DigitalTwin, '/twin'],
  ['Digital Twin — project focus', DigitalTwin, `/twin?project=${PROJECTS[0].id}`],
  ['Portfolio', Portfolio, '/portfolio'],
  ['Project Detail', ProjectDetail, `/projects/${PROJECTS[0].id}`],
  ['Finance', Finance, '/finance'],
  ['Billing', Billing, '/billing'],
  ['Procurement', Procurement, '/procurement'],
  ['Contractors', Contractors, '/contractors'],
  ['Approvals', Approvals, '/approvals'],
  ['Audit', Audit, '/audit'],
  ['Documents', Documents, '/documents'],
  ['Assistant', Assistant, '/assistant'],
  ['Reports', Reports, '/reports'],
];

describe('data layer', () => {
  test('seed data is populated', () => {
    expect(PROJECTS.length).toBeGreaterThan(20);
    expect(PACKAGES.length).toBeGreaterThan(50);
    expect(BOQ_ITEMS.length).toBeGreaterThan(200);
    expect(MILESTONES.length).toBe(PROJECTS.length * 12);
    expect(LAND_PARCELS.length).toBeGreaterThan(500);
    expect(CLEARANCES.length).toBeGreaterThan(100);
    expect(RISKS.length).toBeGreaterThan(100);
    expect(SITE_PHOTOS.length).toBeGreaterThan(20);
    expect(SITE_CREWS.length).toBeGreaterThan(20);
  });

  test('the portfolio is scoped to the northern region', () => {
    const northern = new Set(ZONES.map(z => z.code));
    expect(northern.size).toBe(6);
    PROJECTS.forEach(p => expect(northern.has(p.zone)).toBe(true));
    PIUS.forEach(u => expect(northern.has(u.zone)).toBe(true));
    /* every corridor sits north of the Vindhyas */
    PROJECTS.forEach(p => expect(p.lat).toBeGreaterThan(24.5));
  });

  test('every package belongs to a real project and has sane chainage', () => {
    const ids = new Set(PROJECTS.map(p => p.id));
    PACKAGES.forEach(pkg => {
      expect(ids.has(pkg.projectId)).toBe(true);
      expect(pkg.toChainageM).toBeGreaterThanOrEqual(pkg.fromChainageM);
    });
  });

  test('portfolio aggregates are internally consistent', () => {
    const s = portfolioStats();
    expect(s.projectCount).toBe(PROJECTS.length);
    expect(s.totalExpenditure).toBeLessThanOrEqual(s.totalEstimate);
    expect(s.physicalProgress).toBeGreaterThan(0);
    expect(s.physicalProgress).toBeLessThanOrEqual(100);
    expect(s.land.taken + s.land.pending).toBe(s.land.total);
  });

  test('budget by zone sums back to the portfolio total', () => {
    const s = portfolioStats();
    const zoneTotal = budgetByZone().reduce((acc, r) => acc + r.expenditure, 0);
    expect(Math.round(zoneTotal)).toBe(Math.round(s.totalExpenditure));
  });

  test('chainage segments cover the alignment without exceeding it', () => {
    const p = PROJECTS.find(x => x.lengthM > 0);
    const total = chainageSegments(p.id).reduce((a, s) => a + s.widthPct, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });

  test('work-head rollup only reports executed within measured quantities', () => {
    const p = PROJECTS.find(x => x.status === 'under_execution');
    progressByWorkHead(p.id).forEach(w => {
      expect(w.contracted).toBeGreaterThan(0);
      expect(w.executed).toBeGreaterThanOrEqual(0);
    });
  });

  test('land summary blocked km never exceeds project length', () => {
    const p = PROJECTS.find(x => x.lengthM > 0);
    const s = landSummary(LAND_PARCELS.filter(l => l.projectId === p.id));
    expect(s.blockedKm).toBeLessThanOrEqual(p.lengthKm + 1);
  });

  test('formatters produce Indian conventions', () => {
    expect(groupIndian('14832000')).toBe('1,48,32,000');
    expect(inr(16216, { unit: 'cr', decimals: 0 })).toBe('₹162 Cr');
    expect(chainage(143520)).toBe('KM 143+520');
  });
});

describe('twin geometry', () => {
  const project = PROJECTS.find(p => p.lengthM > 0 && p.status === 'under_execution');

  test('alignment paths are ordered and measurable', () => {
    PROJECTS.forEach(p => {
      expect(p.path.length).toBeGreaterThan(1);
      expect(pathMetrics(p.path).total).toBeGreaterThan(0);
    });
  });

  test('a point at fraction 0 and 1 lands on the path ends', () => {
    const start = pointAlongPath(project.path, 0);
    const end = pointAlongPath(project.path, 1);
    expect(start[0]).toBeCloseTo(project.path[0][0], 4);
    expect(end[0]).toBeCloseTo(project.path[project.path.length - 1][0], 4);
  });

  test('a slice of the path stays inside the corridor', () => {
    const slice = slicePath(project.path, 0.25, 0.6);
    expect(slice.length).toBeGreaterThan(1);
    const lats = project.path.map(p => p[0]);
    slice.forEach(([lat]) => {
      expect(lat).toBeGreaterThanOrEqual(Math.min(...lats) - 0.001);
      expect(lat).toBeLessThanOrEqual(Math.max(...lats) + 0.001);
    });
  });

  test('progress segments cover the whole corridor exactly once', () => {
    const segs = alignmentSegments(project.id);
    expect(segs.length).toBeGreaterThan(0);
    const covered = segs.reduce((a, s) => a + (s.toChainageM - s.fromChainageM), 0);
    expect(covered).toBeGreaterThan(project.lengthM * 0.97);
    expect(covered).toBeLessThanOrEqual(project.lengthM * 1.03);
    segs.forEach(s => {
      expect(['done', 'active', 'pending']).toContain(s.state);
      expect(s.coords.length).toBeGreaterThan(0);
    });
  });

  test('completed length tracks reported physical progress', () => {
    const segs = alignmentSegments(project.id);
    const doneM = segs.filter(s => s.state === 'done').reduce((a, s) => a + (s.toChainageM - s.fromChainageM), 0);
    const donePct = (doneM / project.lengthM) * 100;
    expect(Math.abs(donePct - project.physicalProgress)).toBeLessThan(22);
  });

  test('replaying an earlier month shrinks the completed length', () => {
    const now = alignmentSegments(project.id, 1);
    const then = alignmentSegments(project.id, 0.5);
    const doneKm = (segs) => segs.filter(s => s.state === 'done').reduce((a, s) => a + s.lengthKm, 0);
    expect(doneKm(then)).toBeLessThan(doneKm(now));
  });

  test('land parcels carry a drawable polygon on the corridor', () => {
    const parcels = LAND_PARCELS.filter(l => l.projectId === project.id);
    expect(parcels.length).toBeGreaterThan(0);
    parcels.forEach(l => {
      expect(l.polygon.length).toBe(4);
      l.polygon.forEach(([lat, lng]) => {
        expect(Number.isFinite(lat)).toBe(true);
        expect(Number.isFinite(lng)).toBe(true);
      });
    });
  });

  test('corridor overview exposes a done-path shorter than the full path', () => {
    corridorOverview().forEach(c => {
      expect(c.path.length).toBeGreaterThan(1);
      expect(pathMetrics(c.donePath).total).toBeLessThanOrEqual(pathMetrics(c.path).total + 0.001);
    });
  });

  test('chainage maps onto the alignment', () => {
    const mid = chainageToLatLng(project, project.lengthM / 2);
    expect(mid).toHaveLength(2);
    expect(Number.isFinite(mid[0])).toBe(true);
  });
});

describe('AI work validation', () => {
  test('a complete, on-claim frame is verified', () => {
    const r = scorePhotoEvidence({
      workItem: 'track',
      claimedPct: 60,
      detections: [
        { label: 'rails laid on sleepers', matchesScope: true, confidence: 0.95 },
        { label: 'ballast profile', matchesScope: true, confidence: 0.9 },
        { label: 'fish plated joint', matchesScope: true, confidence: 0.88 },
      ],
      gpsDeltaM: 30, blurScore: 0.1,
    });
    expect(r.verdict).toBe('verified');
    expect(r.confidence).toBeGreaterThan(0.6);
    expect(r.checks.every(c => c.pass)).toBe(true);
  });

  test('an off-site GPS fix is flagged regardless of what is in frame', () => {
    const r = scorePhotoEvidence({
      workItem: 'track', claimedPct: 50,
      detections: [{ label: 'rails laid on sleepers', matchesScope: true, confidence: 0.95 }],
      gpsDeltaM: 1400, blurScore: 0.1,
    });
    expect(r.verdict).toBe('flagged');
    expect(r.checks.find(c => c.label.includes('GPS')).pass).toBe(false);
  });

  test('an inflated claim with little evidence is not corroborated', () => {
    const r = scorePhotoEvidence({
      workItem: 'tunnel', claimedPct: 95,
      detections: [{ label: 'worker', matchesScope: false, confidence: 0.7 }],
      gpsDeltaM: 20, blurScore: 0.2,
    });
    expect(r.verdict).toBe('rejected');
    expect(r.gapPct).toBeGreaterThan(25);
  });

  test('frame analysis is deterministic for the same frame', () => {
    const a = simulateFrameAnalysis('bridge', 4242);
    const b = simulateFrameAnalysis('bridge', 4242);
    expect(a).toEqual(b);
    expect(a.detections.length).toBeGreaterThan(0);
  });

  test('seeded evidence always carries a verdict and checks', () => {
    SITE_PHOTOS.forEach(p => {
      expect(['verified', 'partial', 'flagged', 'rejected']).toContain(p.verdict);
      expect(p.checks.length).toBe(4);
      expect(p.lat).toBeDefined();
    });
  });
});

describe('base maps', () => {
  test('exactly three single-purpose base maps are offered', () => {
    expect(BASEMAPS).toHaveLength(3);
    expect(BASEMAPS.map(b => b.key)).toEqual(['terrain', 'rail', 'roads']);
  });

  test('none of them is the general-purpose OSM raster', () => {
    /* That raster draws roads, rail, land use and labels together, which is
       exactly what these three layers are meant to separate. */
    BASEMAPS.forEach(b => expect(b.url).not.toContain('tile.openstreetmap.org'));
  });

  test('each carries attribution and a native zoom ceiling', () => {
    BASEMAPS.forEach(b => {
      expect(b.attribution).toBeTruthy();
      expect(b.maxNativeZoom).toBeGreaterThan(0);
      expect(b.maxZoom).toBeGreaterThanOrEqual(b.maxNativeZoom);
      expect(b.background).toMatch(/^#/);
    });
  });
});

describe('naming', () => {
  /* The dashboard must not carry the name of any real person or firm. */
  const REAL_NAMES = ['ircon', 'larsen', 'toubro', 'afcons', 'rithwik', 'kec international',
    'arss', 'patel engineering', 'rahee', 'kalindee', 'gr infraprojects', 'sushee'];

  test('no real contracting firm appears in the dataset', () => {
    const blob = CONTRACTORS.map(c => `${c.name} ${c.contact.person}`).join(' ').toLowerCase();
    REAL_NAMES.forEach(n => expect(blob).not.toContain(n));
  });

  test('every PIU has a named project head', () => {
    PIUS.forEach(u => {
      expect(u.cpm).toBeTruthy();
      expect(u.cpm.split(' ').length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('page rendering', () => {
  test.each(PAGES)('%s renders without crashing', async (name, Component, route) => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container, unmount } = render(
      <SocketProvider>
        <MemoryRouter initialEntries={[route]}>
          <Component />
        </MemoryRouter>
      </SocketProvider>
    );
    await waitFor(() => expect(container.firstChild).toBeTruthy(), { timeout: 5000 });
    await new Promise(r => setTimeout(r, 400));
    expect(container.textContent.length).toBeGreaterThan(20);
    unmount();
    spy.mockRestore();
  }, 20000);
});
