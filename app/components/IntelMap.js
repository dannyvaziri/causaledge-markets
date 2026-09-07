'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

function colorExpression() {
  return ['match', ['get', 'type'],
    'geopolitical', '#ff5d73',
    'hazard', '#ffb84d',
    'seismic', '#b388ff',
    'news', '#4dd8ff',
    '#8fa4bb'];
}

export default function IntelMap({ events = [], selectedEvent, onSelect, onRegion }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const selectedRef = useRef(null);
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: el.current,
      center: [0, 20],
      zoom: 1.35,
      minZoom: 1,
      maxZoom: 12,
      attributionControl: false,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#eef5f0' } },
          { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.72, 'raster-saturation': -0.15, 'raster-contrast': -0.05, 'raster-brightness-max': 0.92 } },
        ],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      map.addSource('intel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 44, clusterMaxZoom: 6 });
      map.addLayer({ id: 'clusters', type: 'circle', source: 'intel', filter: ['has', 'point_count'], paint: {
        'circle-color': '#173044', 'circle-stroke-color': '#4dd8ff', 'circle-stroke-width': 1.2,
        'circle-radius': ['step', ['get', 'point_count'], 16, 12, 20, 40, 25, 100, 31],
        'circle-opacity': 0.9,
      }});
      map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'intel', filter: ['has', 'point_count'], layout: {
        'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11,
      }, paint: { 'text-color': '#dff8ff' } });
      map.addLayer({ id: 'intel-points', type: 'circle', source: 'intel', filter: ['!', ['has', 'point_count']], paint: {
        'circle-color': colorExpression(),
        'circle-radius': ['interpolate', ['linear'], ['get', 'severity'], 1, 4, 3, 6, 5, 10],
        'circle-stroke-color': '#dff8ff', 'circle-stroke-width': 0.7, 'circle-opacity': 0.88,
      }});
      map.addLayer({ id: 'intel-halo', type: 'circle', source: 'intel', filter: ['all', ['!', ['has', 'point_count']], ['>=', ['get', 'severity'], 4]], paint: {
        'circle-color': 'transparent', 'circle-stroke-color': colorExpression(), 'circle-stroke-width': 1.2,
        'circle-radius': 14, 'circle-opacity': 0.7,
      }});
      const initial = eventsRef.current.filter((e) => Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lon))).map((e) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [Number(e.lon), Number(e.lat)] }, properties: { id: e.id, type: e.type, title: e.title, severity: Number(e.severity || 1) } }));
      map.getSource('intel')?.setData({ type: 'FeatureCollection', features: initial });
    });
    map.on('click', 'intel-points', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const id = feature.properties?.id;
      if (id) onSelect?.(id);
    });
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const feature = features?.[0];
      if (!feature) return;
      const source = map.getSource('intel');
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({ center: feature.geometry.coordinates, zoom });
    });
    map.on('contextmenu', (e) => onRegion?.({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
    map.on('mouseenter', 'intel-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'intel-points', () => { map.getCanvas().style.cursor = ''; });
    const reset = () => map.flyTo({ center: [0, 20], zoom: 1.35, essential: true });
    window.addEventListener('causaledge-reset-map', reset);
    mapRef.current = map;
    return () => { window.removeEventListener('causaledge-reset-map', reset); map.remove(); mapRef.current = null; };
  }, [onRegion, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource('intel');
    if (!source) return;
    const features = events.filter((e) => Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lon))).map((e) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [Number(e.lon), Number(e.lat)] },
      properties: { id: e.id, type: e.type, title: e.title, severity: Number(e.severity || 1) },
    }));
    source.setData({ type: 'FeatureCollection', features });
  }, [events]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedEvent || !Number.isFinite(Number(selectedEvent.lat)) || !Number.isFinite(Number(selectedEvent.lon))) return;
    const key = selectedEvent.id;
    if (selectedRef.current === key) return;
    selectedRef.current = key;
    map.flyTo({ center: [Number(selectedEvent.lon), Number(selectedEvent.lat)], zoom: Math.max(map.getZoom(), 4), essential: true });
  }, [selectedEvent]);

  return <div ref={el} className="intelMap" aria-label="CausalEdge Markets global intelligence map" />;
}
