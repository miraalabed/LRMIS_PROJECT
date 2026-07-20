import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getParcelsGeoFeed, getPendingHeatmap } from '../api/analyticsApi';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { getErrorMessage } from '../utils/errors';

type GeoGeometry = {
  type?: string;
  coordinates?: unknown;
};

type GeoFeature = {
  type?: string;
  geometry?: GeoGeometry;
  properties?: Record<string, unknown>;
};

type FeatureCollection = {
  type?: string;
  features?: GeoFeature[];
};

type Bounds = {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
};

const mapWidth = 760;
const mapHeight = 430;
const statusOptions = ['', 'submitted', 'pre_checked', 'survey_required', 'surveyed', 'legal_review', 'approved', 'missing_documents', 'under_objection', 'on_hold', 'rejected', 'certificate_issued'];

export function MapPage() {
  const [zone, setZone] = useState('');
  const [status, setStatus] = useState('');
  const [parcelFeed, setParcelFeed] = useState<FeatureCollection>({});
  const [heatmapFeed, setHeatmapFeed] = useState<FeatureCollection>({});
  const [selectedFeature, setSelectedFeature] = useState<GeoFeature | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  async function loadMap(filters = { zone, status }) {
    setIsLoading(true);
    setError('');
    try {
      const [parcels, heatmap] = await Promise.all([
        getParcelsGeoFeed({
          ...(filters.zone ? { zone: filters.zone } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        }),
        getPendingHeatmap(),
      ]);
      setParcelFeed(parcels as FeatureCollection);
      setHeatmapFeed(heatmap as FeatureCollection);
      setSelectedFeature(null);
      setLastUpdated(new Date().toLocaleString());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadMap();
  }, []);

  const parcelFeatures = parcelFeed.features ?? [];
  const heatFeatures = heatmapFeed.features ?? [];
  const allMappableFeatures = useMemo(() => [...parcelFeatures, ...heatFeatures], [parcelFeatures, heatFeatures]);
  const bounds = useMemo(() => getBounds(allMappableFeatures), [allMappableFeatures]);
  const objectionCount = parcelFeatures.filter((feature) => String(feature.properties?.status ?? '') === 'under_objection').length;
  const zoneCount = useMemo(() => new Set(parcelFeatures.map((feature) => String(feature.properties?.zone_id ?? '')).filter(Boolean)).size, [parcelFeatures]);
  const selectedApplicationId = displayValue(selectedFeature?.properties?.application_id);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    loadMap({ zone, status });
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="details-header">
          <div>
            <p className="eyebrow">Spatial view</p>
            <h1 className="page-title">Land application map</h1>
            <p className="muted">Inspect parcel locations, pending demand, and workflow status across zones using the backend GeoJSON feeds.</p>
          </div>
          <div className="details-actions">
            <div className="session-panel">
              <strong>GeoJSON feed</strong>
              <small>{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for map data'}</small>
            </div>
            <button type="button" className="button-link" onClick={() => loadMap()} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh map'}
            </button>
          </div>
        </div>
        <ErrorMessage message={error} />
      </Card>

      <section className="card-grid analytics-metric-grid">
        <MapMetric label="Parcel features" value={parcelFeatures.length} />
        <MapMetric label="Pending heat points" value={heatFeatures.length} />
        <MapMetric label="Under objection" value={objectionCount} />
        <MapMetric label="Zones visible" value={zoneCount} />
      </section>

      <Card>
        <form className="map-toolbar" onSubmit={handleFilter}>
          <label className="field">
            Zone
            <input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Example: ZN-01" />
          </label>
          <label className="field">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option || 'all'} value={option}>{option ? formatLabel(option) : 'All statuses'}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="button-link" disabled={isLoading}>
            {isLoading ? 'Applying...' : 'Apply filters'}
          </button>
          <button
            type="button"
            className="text-link"
            disabled={isLoading}
            onClick={() => {
              setZone('');
              setStatus('');
              loadMap({ zone: '', status: '' });
            }}
          >
            Clear
          </button>
        </form>
      </Card>

      <section className="map-layout">
        <Card>
          <div className="details-section-header">
            <div>
              <p className="eyebrow">Map</p>
              <h2 style={{ margin: 0 }}>Parcels and demand points</h2>
            </div>
          </div>
          {isLoading && <LoadingSpinner label="Loading map data" />}
          {!isLoading && parcelFeatures.length === 0 && heatFeatures.length === 0 && (
            <div className="empty-state">
              <h3>No map data yet</h3>
              <p>Add applications with parcel geometry or coordinates, then this page will draw them here. If filters are active, clear them to see the full feed.</p>
              <div className="scope-actions">
                <Link className="button-link" to="/staff-dashboard">Open application queue</Link>
                <button
                  type="button"
                  className="button-link secondary-link"
                  onClick={() => {
                    setZone('');
                    setStatus('');
                    loadMap({ zone: '', status: '' });
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
          {!isLoading && (parcelFeatures.length > 0 || heatFeatures.length > 0) && (
            <>
              <div className="geo-map" role="img" aria-label="LRMIS parcel map">
                <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
                  <rect x="0" y="0" width={mapWidth} height={mapHeight} rx="8" fill="#F8FAFC" />
                  <MapGrid />
                  {parcelFeatures.map((feature, index) => (
                    <ParcelShape
                      key={`parcel-${index}`}
                      feature={feature}
                      bounds={bounds}
                      isSelected={selectedFeature === feature}
                      onSelect={() => setSelectedFeature(feature)}
                    />
                  ))}
                  {heatFeatures.map((feature, index) => (
                    <HeatPoint key={`heat-${index}`} feature={feature} bounds={bounds} />
                  ))}
                </svg>
              </div>
              <div className="map-legend">
                <span><i style={{ background: '#BFDBFE' }} /> Approved / normal</span>
                <span><i style={{ background: '#FDE68A' }} /> In review</span>
                <span><i style={{ background: '#FBCFE8' }} /> Under objection</span>
                <span><i style={{ background: '#F97316' }} /> Pending heat point</span>
              </div>
            </>
          )}
        </Card>

        <Card>
          <p className="eyebrow">Selection</p>
          <h2 style={{ marginTop: 0 }}>Parcel details</h2>
          {!selectedFeature && <p className="muted">Select a parcel on the map to inspect its metadata.</p>}
          {selectedFeature && (
            <div className="stack">
              <dl className="detail-grid">
                <Detail label="Application ID" value={selectedApplicationId} />
                <Detail label="Parcel code" value={displayValue(selectedFeature.properties?.parcel_code)} />
                <Detail label="Zone" value={displayValue(selectedFeature.properties?.zone_id)} />
                <Detail label="Status" value={<StatusBadge status={String(selectedFeature.properties?.status ?? 'submitted')} />} />
                <Detail label="Application type" value={formatLabel(selectedFeature.properties?.application_type)} />
              </dl>
              {selectedApplicationId !== 'Not provided' && (
                <Link className="button-link" to={`/staff/applications/${selectedApplicationId}`}>
                  Open staff application details
                </Link>
              )}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function MapMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="analytics-metric">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  );
}

function ParcelShape({
  feature,
  bounds,
  isSelected,
  onSelect,
}: {
  feature: GeoFeature;
  bounds: Bounds | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const coords = extractCoordinates(feature);
  if (!bounds || coords.length === 0) return null;
  const points = coords.map((coord) => project(coord, bounds)).map(([x, y]) => `${x},${y}`).join(' ');
  const color = statusColor(String(feature.properties?.status ?? 'submitted'));

  if (coords.length === 1) {
    const [x, y] = project(coords[0], bounds);
    return (
      <circle
        cx={x}
        cy={y}
        r={isSelected ? 9 : 7}
        fill={color.fill}
        stroke={isSelected ? '#0F172A' : color.stroke}
        strokeWidth={isSelected ? 3 : 2}
        onClick={onSelect}
      />
    );
  }

  return (
    <polygon
      points={points}
      fill={color.fill}
      stroke={isSelected ? '#0F172A' : color.stroke}
      strokeWidth={isSelected ? 3 : 2}
      opacity={0.92}
      onClick={onSelect}
    />
  );
}

function HeatPoint({ feature, bounds }: { feature: GeoFeature; bounds: Bounds | null }) {
  const coords = extractCoordinates(feature);
  if (!bounds || coords.length === 0) return null;
  const [x, y] = project(coords[0], bounds);
  const weight = Number(feature.properties?.weight ?? feature.properties?.count ?? 1);
  return <circle className="map-heat-point" cx={x} cy={y} r={Math.min(18, 6 + weight * 2)} />;
}

function MapGrid() {
  const lines = [];
  for (let x = 80; x < mapWidth; x += 80) {
    lines.push(<line key={`x-${x}`} x1={x} x2={x} y1="0" y2={mapHeight} />);
  }
  for (let y = 70; y < mapHeight; y += 70) {
    lines.push(<line key={`y-${y}`} x1="0" x2={mapWidth} y1={y} y2={y} />);
  }
  return <g className="map-grid">{lines}</g>;
}

function getBounds(features: GeoFeature[]): Bounds | null {
  const coords = features.flatMap(extractCoordinates);
  if (coords.length === 0) return null;
  const lngs = coords.map(([lng]) => lng);
  const lats = coords.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  return {
    minLng,
    maxLng: maxLng === minLng ? maxLng + 0.01 : maxLng,
    minLat,
    maxLat: maxLat === minLat ? maxLat + 0.01 : maxLat,
  };
}

function extractCoordinates(feature: GeoFeature): number[][] {
  const geometry = feature.geometry;
  if (!geometry?.coordinates) return [];

  if (geometry.type === 'Point') {
    return isLngLat(geometry.coordinates) ? [geometry.coordinates] : [];
  }

  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates;
    if (!Array.isArray(rings)) return [];
    return rings.flatMap((ring) => Array.isArray(ring) ? ring.filter(isLngLat) : []);
  }

  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates;
    if (!Array.isArray(polygons)) return [];
    return polygons.flatMap((polygon) => Array.isArray(polygon)
      ? polygon.flatMap((ring) => Array.isArray(ring) ? ring.filter(isLngLat) : [])
      : []);
  }

  return [];
}

function project([lng, lat]: number[], bounds: Bounds) {
  const padding = 36;
  const usableWidth = mapWidth - padding * 2;
  const usableHeight = mapHeight - padding * 2;
  const x = padding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * usableWidth;
  const y = padding + (1 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat))) * usableHeight;
  return [x, y];
}

function isLngLat(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function statusColor(status: string) {
  if (status === 'under_objection') return { fill: '#FBCFE8', stroke: '#BE185D' };
  if (['approved', 'certificate_issued', 'closed'].includes(status)) return { fill: '#BFDBFE', stroke: '#1D4ED8' };
  if (['rejected', 'on_hold', 'missing_documents'].includes(status)) return { fill: '#FECACA', stroke: '#B91C1C' };
  return { fill: '#FDE68A', stroke: '#B45309' };
}

function formatLabel(value?: unknown) {
  if (!value) return 'Not provided';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value: unknown) {
  return value === undefined || value === null || value === '' ? 'Not provided' : String(value);
}
