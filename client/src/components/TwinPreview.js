import React from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LTooltip } from 'react-leaflet';
import { getBasemap } from './basemaps';
import { pct } from '../data/rvnlData';

/* ─── Digital-twin preview ────────────────────────────────────────────────
   A read-mostly slice of the twin for the landing page: every northern
   corridor drawn with its completed length in green and its balance in red.
   Clicking a corridor hands off to the full twin. */

const RAG = { normal: '#16a34a', warning: '#f59e0b', critical: '#dc2626' };
const NORTH_CENTRE = [28.6, 78.0];

export default function TwinPreview({ corridors = [], height = 320, zoom = 5, onSelect, interactive = false, basemap = 'roads' }) {
  const base = getBasemap(basemap);
  return (
    <div className="rounded-xl overflow-hidden relative" style={{ height, border: '1px solid var(--app-panel-border)' }}>
      <MapContainer
        center={NORTH_CENTRE}
        zoom={zoom}
        style={{ height: '100%', width: '100%', background: base.background }}
        scrollWheelZoom={false}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        attributionControl={false}
      >
        <TileLayer key={base.key} url={base.url} subdomains={base.subdomains}
          maxNativeZoom={base.maxNativeZoom} maxZoom={base.maxZoom} />

        {corridors.map(c => (
          <React.Fragment key={c.id}>
            <Polyline positions={c.path}
              pathOptions={{ color: '#dc2626', weight: 4, opacity: 0.5 }}
              eventHandlers={onSelect ? { click: () => onSelect(c.id) } : undefined}>
              <LTooltip sticky>
                <strong>{c.name}</strong><br />
                {c.lengthKm} km · {pct(c.physicalProgress)} complete
              </LTooltip>
            </Polyline>
            {c.donePath?.length > 1 && (
              <Polyline positions={c.donePath}
                pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.95 }}
                eventHandlers={onSelect ? { click: () => onSelect(c.id) } : undefined} />
            )}
            <CircleMarker center={[c.lat, c.lng]} radius={4}
              pathOptions={{ color: RAG[c.health], fillColor: RAG[c.health], fillOpacity: 0.9, weight: 1.5 }}
              eventHandlers={onSelect ? { click: () => onSelect(c.id) } : undefined} />
          </React.Fragment>
        ))}
      </MapContainer>

      <div className="absolute bottom-2 left-2 z-[500] rounded-lg px-2 py-1.5 flex flex-col gap-1"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--app-panel-border)' }}>
        <span className="flex items-center gap-1.5 text-[9.5px]" style={{ color: 'var(--app-text-muted)' }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: '#16a34a' }} />Completed
        </span>
        <span className="flex items-center gap-1.5 text-[9.5px]" style={{ color: 'var(--app-text-muted)' }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: '#dc2626', opacity: 0.6 }} />Balance
        </span>
        <span className="text-[8px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{base.attribution}</span>
      </div>
    </div>
  );
}
