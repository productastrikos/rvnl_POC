/* ═══════════════════════════════════════════════════════════════════════════
   Base maps for the digital twin — exactly three, each showing one thing.

   The default OpenStreetMap raster draws roads, rail, land use, buildings and
   labels all at once, which competes with the corridor overlays. These three
   are single-purpose instead:

     terrain  shaded relief only — no roads, no labels, no rail
     rail     the railway network only, on a plain canvas
     roads    the road network and place names, no relief, no rail emphasis

   `maxNativeZoom` lets Leaflet upscale the last real tile rather than going
   blank when a corridor is zoomed past the provider's deepest level.
   ═══════════════════════════════════════════════════════════════════════════ */

export const BASEMAPS = [
  {
    key: 'terrain',
    label: 'Terrain',
    hint: 'Relief and landform only — no roads, rail or labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Relief © Esri',
    maxNativeZoom: 13,
    maxZoom: 18,
    background: '#dfe4e6',
  },
  {
    key: 'rail',
    label: 'Rail network',
    hint: 'Railway lines only — nothing else is drawn',
    url: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: 'Rail © OpenRailwayMap · OpenStreetMap contributors',
    maxNativeZoom: 19,
    maxZoom: 19,
    /* The railway tiles are transparent, so the canvas underneath stays a
       light neutral — dark themes would swallow the black rail linework. */
    background: '#eceff2',
  },
  {
    key: 'roads',
    label: 'Roads',
    hint: 'Road network and place names — no relief',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    attribution: 'Roads © CARTO · OpenStreetMap contributors',
    maxNativeZoom: 19,
    maxZoom: 19,
    background: '#f2f4f6',
  },
];

export const DEFAULT_BASEMAP = 'roads';
export const getBasemap = (key) => BASEMAPS.find(b => b.key === key) || BASEMAPS[2];
