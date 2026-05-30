import type { TripPoint } from "./types";

const VALID_LAT = [40, 50] as const;
const VALID_LON = [120, 132] as const;

export function isHarbinPoint(point: TripPoint) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= VALID_LAT[0] &&
    point.lat <= VALID_LAT[1] &&
    point.lon >= VALID_LON[0] &&
    point.lon <= VALID_LON[1]
  );
}

export function normalizeLatLon(latCandidate: unknown, lonCandidate: unknown) {
  const a = Number(latCandidate);
  const b = Number(lonCandidate);
  const direct = { lat: a, lon: b };
  const swapped = { lat: b, lon: a };

  if (isHarbinPoint(direct)) return direct;
  if (isHarbinPoint(swapped)) return swapped;
  return null;
}

export function parseLineStrings(routeGeom?: string | null): TripPoint[] {
  if (!routeGeom) return [];
  const points: TripPoint[] = [];
  const matcher = /LINESTRING\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(routeGeom))) {
    for (const pair of match[1].split(",")) {
      const [lonRaw, latRaw] = pair.trim().split(/\s+/);
      const point = normalizeLatLon(latRaw, lonRaw);
      if (!point) continue;
      const prev = points.at(-1);
      if (!prev || prev.lat !== point.lat || prev.lon !== point.lon) {
        points.push(point);
      }
    }
  }

  return points.slice(0, 120);
}

export function distanceKm(points: TripPoint[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversine(points[index - 1], points[index]);
  }
  return total;
}

function haversine(a: TripPoint, b: TripPoint) {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function boundsFor(points: TripPoint[]) {
  if (!points.length) {
    return {
      minLat: 45.644169,
      maxLat: 45.722193,
      minLon: 126.605932,
      maxLon: 126.711343,
    };
  }

  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}
