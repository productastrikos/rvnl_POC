import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../services/socket';
import AlertPanel from './AlertPanel';
import AdvisoryPanel from './AdvisoryPanel';
import { PROJECTS, PACKAGES, CONTRACTORS, ROLES, ZONES } from '../data/rvnlData';

/* ─── Navigation — grouped by how RVNL is organised, not by module ──────── */
const NAV_SECTIONS = [
  {
    label: 'Command',
    items: [
      { path: '/',          label: 'Executive Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
      { path: '/twin',      label: 'Digital Twin',        icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
      { path: '/portfolio', label: 'Project Portfolio',   icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { path: '/finance',     label: 'Budget & Expenditure', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { path: '/billing',     label: 'Contractor Billing',   icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
      { path: '/procurement', label: 'Procurement',          icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
      { path: '/contractors', label: 'Contractors',          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { path: '/approvals',  label: 'Approvals Inbox',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', badge: 'approvals' },
      { path: '/audit',      label: 'Audit Trail',      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { path: '/documents', label: 'Document Vault',   icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2zM9 13h6M9 17h6M9 9h1' },
      { path: '/assistant', label: 'Project Assistant', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
      { path: '/reports',   label: 'Reports & Exports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
];

export const PAGE_TITLES = {
  '/': 'Executive Dashboard', '/twin': 'Digital Twin', '/portfolio': 'Project Portfolio',
  '/finance': 'Budget & Expenditure', '/billing': 'Contractor Billing',
  '/procurement': 'Procurement & Tenders', '/contractors': 'Contractors',
  '/approvals': 'Approvals Inbox', '/audit': 'Audit Trail', '/documents': 'Document Vault',
  '/assistant': 'Project Assistant', '/reports': 'Reports & Exports',
};

/* ─── Static part of the search index; entities are merged in at runtime ──
   Everything that used to be a page of its own — land, clearances, safety,
   risks, milestones, plant, field reporting — is now a layer on the twin, so
   those search terms all resolve there. */
const NAV_INDEX = [
  { label: 'Executive Dashboard', path: '/',            breadcrumb: ['Command'],     keywords: 'portfolio kpi overview home budget risk bottleneck s-curve' },
  { label: 'Digital Twin',        path: '/twin',        breadcrumb: ['Command'],     keywords: 'twin gis map alignment chainage corridor track progress geography structures tunnel bridge' },
  { label: 'Land Acquisition — twin layer', path: '/twin?layer=land', breadcrumb: ['Command', 'Digital Twin'], keywords: 'land parcel village khasra survey 20a 20e 20f possession compensation blocked acquisition' },
  { label: 'Site Reporting & AI validation', path: '/twin?layer=photos', breadcrumb: ['Command', 'Digital Twin'], keywords: 'site worker photo evidence upload ai validation inspector crew field dsr offline' },
  { label: 'Safety & Risks — twin layer',    path: '/twin?layer=incidents', breadcrumb: ['Command', 'Digital Twin'], keywords: 'safety incident ltifr near miss fatality risk register mitigation exposure' },
  { label: 'Clearances — twin layer',        path: '/twin?layer=clearances', breadcrumb: ['Command', 'Digital Twin'], keywords: 'clearance forest environment ec nbwl gad crs parivesh statutory condition' },
  { label: 'Milestones & Plant — twin layer',path: '/twin?layer=milestones', breadcrumb: ['Command', 'Digital Twin'], keywords: 'milestone schedule slippage critical path plant machinery manpower deployment' },
  { label: 'Project Portfolio',   path: '/portfolio',   breadcrumb: ['Command'],     keywords: 'projects list grid all schemes corridors' },
  { label: 'Budget & Expenditure',path: '/finance',     breadcrumb: ['Commercial'],  keywords: 'finance budget expenditure sanction estimate variance cash flow burn' },
  { label: 'Contractor Billing',  path: '/billing',     breadcrumb: ['Commercial'],  keywords: 'ra bill billing deduction pvc security deposit tds cess pfms payment' },
  { label: 'Procurement',         path: '/procurement', breadcrumb: ['Commercial'],  keywords: 'tender nit ireps gem bid loa award evaluation l1 procurement' },
  { label: 'Contractors',         path: '/contractors', breadcrumb: ['Commercial'],  keywords: 'contractor vendor performance index cpi blacklist agency' },
  { label: 'Approvals Inbox',     path: '/approvals',   breadcrumb: ['Governance'],  keywords: 'approval dop delegation pending sanction variation eot' },
  { label: 'Audit Trail',         path: '/audit',       breadcrumb: ['Governance'],  keywords: 'audit log cag cvc vigilance hash chain trail immutable' },
  { label: 'Document Vault',      path: '/documents',   breadcrumb: ['Knowledge'],   keywords: 'document dpr gad drawing contract test certificate revision' },
  { label: 'Project Assistant',   path: '/assistant',   breadcrumb: ['Knowledge'],   keywords: 'ai assistant chat question rag cited answer' },
  { label: 'Reports & Exports',   path: '/reports',     breadcrumb: ['Knowledge'],   keywords: 'report mpr board pack ministry export csv' },
];

function SvgIcon({ d, size = 'w-4 h-4', strokeWidth = 1.6 }) {
  return (
    <svg className={`${size} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={d} />
    </svg>
  );
}

const ENTITY_ICON = {
  page:       'M4 6h16M4 12h16M4 18h16',
  project:    'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2',
  package:    'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  contractor: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0z',
};

export default function Layout({ children, theme = 'dark', onThemeToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const data = useData();
  const { alerts, advisories, user, role, setRole, online, setOnline, pendingApprovals, syncQueue } = data;

  const [showAlerts, setShowAlerts] = useState(false);
  const [showAdvisory, setShowAdvisory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [time, setTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const profileRef = useRef(null);
  const rolesRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  /* Ctrl/Cmd+K focuses search */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const close = (ref, setter) => (e) => { if (ref.current && !ref.current.contains(e.target)) setter(false); };
    const h1 = close(searchRef, (v) => { setShowSearch(v); setSearchQuery(''); });
    const h2 = close(profileRef, setShowProfile);
    const h3 = close(rolesRef, setShowRoles);
    document.addEventListener('mousedown', h1);
    document.addEventListener('mousedown', h2);
    document.addEventListener('mousedown', h3);
    return () => {
      document.removeEventListener('mousedown', h1);
      document.removeEventListener('mousedown', h2);
      document.removeEventListener('mousedown', h3);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Deep search across pages and live entities */
  const searchIndex = useMemo(() => [
    ...NAV_INDEX.map(i => ({ ...i, kind: 'page' })),
    ...PROJECTS.map(p => ({
      kind: 'project', label: p.name, path: `/projects/${p.id}`,
      breadcrumb: ['Portfolio', p.zone, p.piuName],
      keywords: `${p.code} ${p.typeLabel} ${p.zone} ${p.piuName} ${p.cpm} project`,
    })),
    ...PACKAGES.slice(0, 160).map(k => ({
      kind: 'package', label: `${k.code} — ${k.scope}`, path: `/projects/${k.projectId}?package=${k.id}`,
      breadcrumb: ['Portfolio', k.projectName, k.name],
      keywords: `${k.code} ${k.contractorName || ''} package ${k.scope}`,
    })),
    ...CONTRACTORS.map(c => ({
      kind: 'contractor', label: c.name, path: `/contractors?q=${encodeURIComponent(c.name)}`,
      breadcrumb: ['Commercial', 'Contractors'],
      keywords: `${c.pan} ${c.regClass} contractor agency vendor`,
    })),
  ], []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    /* KM 143+500 or "km 143" jumps to the map */
    const kmMatch = q.match(/^km\s*(\d+)/);
    const words = q.split(/\s+/).filter(Boolean);
    const scored = searchIndex.map(item => {
      const hay = [item.label, ...(item.breadcrumb || []), item.keywords || ''].join(' ').toLowerCase();
      return { item, score: words.filter(w => hay.includes(w)).length };
    }).filter(s => s.score > 0);
    scored.sort((a, b) => {
      const al = a.item.label.toLowerCase().includes(q) ? 1 : 0;
      const bl = b.item.label.toLowerCase().includes(q) ? 1 : 0;
      if (bl !== al) return bl - al;
      return b.score - a.score;
    });
    const out = scored.slice(0, 10).map(s => s.item);
    if (kmMatch) out.unshift({ kind: 'page', label: `Locate KM ${kmMatch[1]} on the digital twin`, path: `/twin?chainage=${kmMatch[1] * 1000}`, breadcrumb: ['Command', 'Digital Twin'] });
    return out;
  }, [searchQuery, searchIndex]);

  const unacked = alerts?.filter(a => !a.acknowledged)?.length || 0;
  const critical = alerts?.filter(a => a.type === 'critical' && !a.acknowledged)?.length || 0;
  const pageTitle = PAGE_TITLES[location.pathname]
    || (location.pathname.startsWith('/projects/') ? 'Project Dashboard' : 'Dashboard');

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className={`theme-${theme} h-screen w-screen flex overflow-hidden bg-app-darker`}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-200 bg-app-dark border-r border-app-border"
        style={{ width: sidebarOpen ? 'var(--app-sidebar-w, 244px)' : '60px' }}
      >
        <div className="flex items-center gap-3 px-4 cursor-pointer shrink-0 border-b border-app-border"
          style={{ height: 'var(--app-header-h, 62px)' }} onClick={() => navigate('/')}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#0ea5e9 0%,#6366f1 60%,#8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(99,102,241,0.35)',
          }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.9}
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M7 3L4 21M17 3l3 18" /><path d="M5.5 8h13M4.9 13h14.2M4.3 18h15.4" />
            </svg>
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="text-[13px] font-extrabold leading-tight tracking-tight" style={{ color: 'var(--app-text)' }}>RVNL Nirman Setu</div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--app-text-faint)' }}>Project Command Centre</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {sidebarOpen ? <p className="nav-section-label">{section.label}</p> : <div className="h-3" />}
              {section.items.map(item => (
                <div key={item.path} className="px-2">
                  <button
                    onClick={() => navigate(item.path)}
                    className={`nav-item w-full ${isActive(item.path) ? 'active' : ''}`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <SvgIcon d={item.icon} />
                    {sidebarOpen && <span className="truncate flex-1">{item.label}</span>}
                    {sidebarOpen && item.badge === 'approvals' && pendingApprovals > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                        background: 'var(--app-warning-bg)', color: 'var(--app-warning)',
                        border: '1px solid var(--app-warning-border)',
                      }}>{pendingApprovals}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-app-border">
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-app-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)' }}>{user?.fullName}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--app-text-faint)' }}>{user?.designation}</div>
              </div>
            </div>
          )}
          <div className="px-2 pb-3" />
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        <header className="shrink-0 flex items-center gap-2.5 px-4 border-b border-app-border"
          style={{ height: 'var(--app-header-h, 62px)', background: 'var(--app-chrome-bg)' }}>

          <button onClick={() => setSidebarOpen(o => !o)} className="icon-btn" title="Toggle sidebar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden md:flex flex-col ml-1">
            <span className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--app-text)', letterSpacing: '0.10em' }}>RVNL NIRMAN SETU</span>
            <span className="text-[9px]" style={{ color: 'var(--app-text-faint)' }}>{pageTitle} · Rail Vikas Nigam Limited</span>
          </div>

          <div className="header-search flex-1 max-w-xs ml-2" ref={searchRef} style={{ position: 'relative' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef} type="text" value={searchQuery} aria-label="Search"
              placeholder="Projects, packages, KM 143+500… (Ctrl+K)"
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); e.target.blur(); }
                if (e.key === 'Enter' && searchResults.length) {
                  navigate(searchResults[0].path); setShowSearch(false); setSearchQuery(''); e.target.blur();
                }
              }}
            />
            {showSearch && searchQuery.trim() && (
              <div className="search-dropdown">
                {!searchResults.length ? (
                  <div className="search-dropdown-empty">No results for “{searchQuery}”</div>
                ) : searchResults.map((item, idx) => (
                  <button key={idx} className="search-dropdown-item"
                    onMouseDown={e => { e.preventDefault(); navigate(item.path); setShowSearch(false); setSearchQuery(''); }}>
                    <div className="sdi-icon"><SvgIcon d={ENTITY_ICON[item.kind] || ENTITY_ICON.page} size="w-3.5 h-3.5" /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="sdi-label truncate">{item.label}</div>
                      <div className="sdi-desc truncate">{(item.breadcrumb || []).join(' › ')}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Connectivity simulator — drives the offline-first behaviour */}
          <button
            onClick={() => setOnline(!online)}
            className="icon-btn hidden sm:inline-flex"
            title={online ? 'Simulate going offline' : 'Reconnect and flush the sync queue'}
            style={{
              width: 'auto', padding: '0 10px', gap: 6,
              color: online ? 'var(--app-success)' : 'var(--app-warning)',
              borderColor: online ? 'var(--app-success-border)' : 'var(--app-warning-border)',
              background: online ? 'var(--app-success-bg)' : 'var(--app-warning-bg)',
            }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }}
              className={online ? '' : 'animate-pulse'} />
            <span className="text-[10.5px] font-bold tracking-wide">
              {online ? 'ONLINE' : `OFFLINE${syncQueue?.length ? ` · ${syncQueue.length}` : ''}`}
            </span>
          </button>

          <div className="hidden lg:block font-mono text-xs px-2 py-1 rounded-md"
            style={{ background: 'var(--app-surface-soft)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border)', letterSpacing: '0.04em' }}>
            {time.toLocaleTimeString('en-IN', { hour12: false })}
          </div>

          {/* Role switcher — shows how RBAC changes the view */}
          <div className="relative" ref={rolesRef}>
            <button onClick={() => setShowRoles(s => !s)} className={`icon-btn ${showRoles ? 'active' : ''}`}
              title="Switch role" style={{ width: 'auto', padding: '0 10px', gap: 6 }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-[10.5px] font-bold hidden xl:inline">{ROLES[role]?.short}</span>
            </button>
            {showRoles && (
              <div className="profile-menu" role="menu" style={{ minWidth: 260 }}>
                <div className="profile-menu-header">
                  <div className="min-w-0">
                    <div className="name">Switch role</div>
                    <div className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>Scope and permissions change with the role</div>
                  </div>
                </div>
                <div className="profile-menu-section">
                  {Object.entries(ROLES).map(([key, r]) => (
                    <button key={key} className="profile-menu-item" role="menuitem"
                      onClick={() => { setRole(key); setShowRoles(false); navigate(r.home); }}
                      style={role === key ? { background: 'var(--app-accent-bg)', color: 'var(--app-text)' } : undefined}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: role === key ? 'var(--app-success)' : 'var(--app-text-faint)',
                      }} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{r.short}</span>
                        <span className="block text-[9.5px] truncate" style={{ color: 'var(--app-text-faint)' }}>{r.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={onThemeToggle} className="icon-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="-1 -1 26 26">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1012 21a8.962 8.962 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <button onClick={() => { setShowAdvisory(!showAdvisory); setShowAlerts(false); }}
            className={`app-advisory-btn ${showAdvisory ? 'active' : ''}`} title="AI Advisory" aria-label="AI Advisory">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="hidden sm:inline">AI Advisory</span>
          </button>

          <button onClick={() => { setShowAlerts(!showAlerts); setShowAdvisory(false); }}
            className={`icon-btn ${showAlerts ? 'active' : ''}`} title="Alerts" aria-label="Alerts">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unacked > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[9px] flex items-center justify-center font-bold px-0.5 ${critical > 0 ? 'animate-pulse' : ''}`}
                style={{ background: critical > 0 ? 'var(--app-danger)' : 'var(--app-warning)', color: 'var(--app-on-color)' }}>
                {unacked}
              </span>
            )}
          </button>

          <div className="relative" ref={profileRef}>
            <button type="button" className="profile-trigger" onClick={() => setShowProfile(s => !s)}
              aria-haspopup="menu" aria-expanded={showProfile} title={user?.fullName || 'Account'}>
              {user?.fullName?.charAt(0) || 'U'}
            </button>
            {showProfile && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-header">
                  <div className="avatar">{user?.fullName?.charAt(0) || 'U'}</div>
                  <div className="min-w-0">
                    <div className="name truncate">{user?.fullName}</div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--app-text-faint)' }}>{user?.designation}</div>
                    <div className="status">Online</div>
                  </div>
                </div>
                <div className="profile-menu-section">
                  <button className="profile-menu-item" onClick={() => { setShowProfile(false); navigate('/approvals'); }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    My approvals {pendingApprovals > 0 && `(${pendingApprovals})`}
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowProfile(false); setShowAlerts(true); setShowAdvisory(false); }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    Notifications
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowProfile(false); onThemeToggle && onThemeToggle(); }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Appearance
                  </button>
                </div>
                <div className="profile-menu-section">
                  <button className="profile-menu-item danger"
                    onClick={() => { if (window.confirm('Reset all locally recorded actions (DSRs, approvals, bill actions)?')) { data.resetDemoState(); setShowProfile(false); } }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Reset session data
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <main className={`h-full ${location.pathname === '/twin' ? 'overflow-hidden' : 'overflow-auto p-4'}`}>
            {children}
          </main>
        </div>
      </div>

      {showAlerts && (
        <div className="w-80 overflow-hidden animate-slide-up border-l border-app-border bg-app-darker"
          style={{ position: 'fixed', top: 'var(--app-header-h, 62px)', right: 0, bottom: 0, zIndex: 200 }}>
          <AlertPanel alerts={alerts} onClose={() => setShowAlerts(false)} />
        </div>
      )}

      {showAdvisory && (
        <div className="app-advisory-panel w-96 overflow-hidden animate-slide-up border-2 border-app-border"
          style={{ position: 'fixed', top: 'var(--app-header-h, 62px)', right: 0, bottom: 0, zIndex: 200 }}>
          <AdvisoryPanel advisories={advisories} onClose={() => setShowAdvisory(false)} />
        </div>
      )}
    </div>
  );
}

export { ZONES };
