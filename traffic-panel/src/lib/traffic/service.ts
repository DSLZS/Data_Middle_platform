import { cachedJson } from "./cache";
import {
  fallbackCongestedRoads,
  fallbackHotspots,
  fallbackMapLayers,
  fallbackOverview,
  fallbackRoadClasses,
  fallbackTimeline,
  fallbackTrips,
} from "./fallback-data";
import { boundsFor, distanceKm, normalizeLatLon, parseLineStrings } from "./geo";
import { queryRows } from "./mysql";
import type {
  CongestedRoad,
  HeatPoint,
  Hotspot,
  MapLayers,
  MapZone,
  Overview,
  RoadClassStat,
  TimelinePoint,
  Trip,
} from "./types";

type TaxiOverviewRow = {
  stat_date: string;
  active_taxis: number | null;
  total_trips: number | null;
  total_distance_km: number | null;
  avg_speed_kmh: number | null;
  peak_hour: number | null;
};

type RoadTrafficRow = {
  stat_date: string;
  stat_hour: number;
  total_roads: number | null;
  avg_congestion: number | null;
  congested_roads: number | null;
  smooth_roads: number | null;
  avg_speed_kmh: number | null;
};

type HotspotRow = {
  stat_date: string;
  road_id: number;
  road_class_name: string | null;
  pass_count: number | null;
  unique_taxis: number | null;
  avg_speed_kmh: number | null;
  congestion_level: number | null;
  is_hotspot: number | null;
  hotspot_type: string | null;
  start_lon?: number | null;
  start_lat?: number | null;
  end_lon?: number | null;
  end_lat?: number | null;
};

type RoadClassRow = {
  class_id: number;
  class_name: string | null;
  road_count: number | null;
  total_pass: number | null;
  avg_speed_kmh: number | null;
  congestion_level: number | null;
  avg_length_m: number | null;
};

type TripRow = {
  trip_id: number;
  devid: string;
  trip_date: string;
  start_time: string | null;
  end_time: string | null;
  gps_points_count: number | null;
  route_distance_m: number | null;
  trip_duration_s: number | null;
  avg_speed_kmh: number | null;
  route_geom: string | null;
};

export async function getOverview() {
  return resilient(
    () =>
      cachedJson("overview:v1", 300, async () => {
        const [overview] = await queryRows<TaxiOverviewRow>(
          "SELECT stat_date, active_taxis, total_trips, total_distance_km, avg_speed_kmh, peak_hour FROM dws_taxi_overview ORDER BY stat_date DESC LIMIT 1",
        );
        if (!overview) return fallbackOverview;

        const speed = cleanNumber(overview.avg_speed_kmh, fallbackOverview.avgSpeedKmh);
        return {
          activeVehicles: cleanNumber(overview.active_taxis, fallbackOverview.activeVehicles),
          totalTrips: cleanNumber(overview.total_trips, fallbackOverview.totalTrips),
          totalMileageKm: round(cleanNumber(overview.total_distance_km, fallbackOverview.totalMileageKm), 2),
          avgSpeedKmh: round(speed, 2),
          roadHealthScore: healthScore(speed),
          peakHour: cleanNumber(overview.peak_hour, fallbackOverview.peakHour),
          updatedAt: new Date().toISOString(),
        } satisfies Overview;
      }),
    fallbackOverview,
  );
}

export async function getTimeline() {
  return resilient(
    () =>
      cachedJson("timeline:v2", 600, async () => {
        const rows = await queryRows<RoadTrafficRow>(`
          SELECT stat_date, stat_hour, total_roads, avg_congestion, congested_roads, smooth_roads, avg_speed_kmh
          FROM dws_road_traffic
          ORDER BY stat_date DESC, stat_hour DESC
          LIMIT 24
        `);
        if (!rows.length) return fallbackTimeline;

        const timelineRows = [...rows].reverse();
        const hasMultipleDates = new Set(timelineRows.map((row) => row.stat_date)).size > 1;

        return timelineRows.map((row) => ({
          hour: formatTimelineHour(row.stat_date, row.stat_hour, hasMultipleDates),
          activeVehicles: Math.max(1, cleanNumber(row.total_roads, 5)),
          avgSpeed: round(cleanNumber(row.avg_speed_kmh, fallbackOverview.avgSpeedKmh), 2),
          congestion: normalizeCongestion(row.avg_congestion, row.congested_roads, row.total_roads),
        })) satisfies TimelinePoint[];
      }),
    fallbackTimeline,
  );
}

export async function getHotspots(limit = 5) {
  const safeLimit = clampLimit(limit, 12);
  return resilient(
    () =>
      cachedJson(`hotspots:v1:${safeLimit}`, 900, async () => {
        const rows = await queryRows<HotspotRow>(`
          SELECT h.stat_date, h.road_id, h.road_class_name, h.pass_count, h.unique_taxis,
                 h.avg_speed_kmh, h.congestion_level, h.is_hotspot, h.hotspot_type,
                 d.start_lon, d.start_lat, d.end_lon, d.end_lat
          FROM dws_hotspot_analysis h
          LEFT JOIN dim_road_segment d ON d.road_id = h.road_id
          WHERE h.stat_date = (SELECT MAX(stat_date) FROM dws_hotspot_analysis)
          ORDER BY h.pass_count DESC
          LIMIT ${safeLimit}
        `);

        const hotspots = rows
          .map((row, index) => hotspotFromRow(row, index))
          .filter((hotspot): hotspot is Hotspot => Boolean(hotspot));
        return hotspots.length ? hotspots : fallbackHotspots.slice(0, safeLimit);
      }),
    fallbackHotspots.slice(0, safeLimit),
  );
}

export async function getCongestedRoads(limit = 10) {
  const safeLimit = clampLimit(limit, 20);
  return resilient(
    () =>
      cachedJson(`congested-roads:v1:${safeLimit}`, 900, async () => {
        const rows = await queryRows<HotspotRow>(`
          SELECT stat_date, road_id, road_class_name, pass_count, unique_taxis,
                 avg_speed_kmh, congestion_level, is_hotspot, hotspot_type
          FROM dws_hotspot_analysis
          WHERE stat_date = (SELECT MAX(stat_date) FROM dws_hotspot_analysis)
          ORDER BY COALESCE(congestion_level, 0) DESC, pass_count DESC
          LIMIT ${safeLimit}
        `);
        const roads = rows
          .filter((row) => row.road_id > 0)
          .map((row) => ({
            roadId: row.road_id,
            count: cleanNumber(row.pass_count, 0),
            level: congestionLevel(row.congestion_level, row.avg_speed_kmh),
            avgSpeedKmh: round(cleanNumber(row.avg_speed_kmh, 0), 2),
          })) satisfies CongestedRoad[];
        return roads.length ? roads : fallbackCongestedRoads.slice(0, safeLimit);
      }),
    fallbackCongestedRoads.slice(0, safeLimit),
  );
}

export async function getRoadClasses() {
  return resilient(
    () =>
      cachedJson("road-classes:v1", 1800, async () => {
        const rows = await queryRows<RoadClassRow>(`
          SELECT class_id, class_name, road_count, total_pass, avg_speed_kmh, congestion_level, avg_length_m
          FROM dws_road_class_analysis
          WHERE stat_date = (SELECT MAX(stat_date) FROM dws_road_class_analysis)
          ORDER BY total_pass DESC
          LIMIT 8
        `);
        const classes = rows.map((row) => ({
          classId: row.class_id,
          className: row.class_name ?? `等级-${row.class_id}`,
          roadCount: cleanNumber(row.road_count, 0),
          totalPass: cleanNumber(row.total_pass, 0),
          avgSpeedKmh: round(cleanNumber(row.avg_speed_kmh, 0), 2),
          congestionLevel: round(cleanNumber(row.congestion_level, 0), 2),
          avgLengthM: round(cleanNumber(row.avg_length_m, 0), 2),
        })) satisfies RoadClassStat[];
        return classes.length ? classes : fallbackRoadClasses;
      }),
    fallbackRoadClasses,
  );
}

export async function getTrips(limit = 16) {
  const safeLimit = clampLimit(limit, 30);
  return resilient(
    () =>
      cachedJson(`trips:v1:${safeLimit}`, 1800, async () => {
        const rows = await queryRows<TripRow>(`
          SELECT trip_id, devid, trip_date, start_time, end_time, gps_points_count,
                 route_distance_m, trip_duration_s, avg_speed_kmh, route_geom
          FROM dwd_taxi_trip
          WHERE route_geom IS NOT NULL
          ORDER BY trip_id DESC
          LIMIT ${safeLimit}
        `);
        const trips = rows
          .map(tripFromRow)
          .filter((trip): trip is Trip => Boolean(trip));
        return trips.length ? trips : fallbackTrips.slice(0, safeLimit);
      }),
    fallbackTrips.slice(0, safeLimit),
  );
}

export async function getMapLayers() {
  return resilient(
    () =>
      cachedJson("map-layers:v2", 900, async () => {
        const [hotspotsResult, tripsResult] = await Promise.all([
          getHotspots(12),
          getTrips(16),
        ]);
        const hotspots = hotspotsResult.data;
        const trips = tripsResult.data;
        const zones = hotspots.map<MapZone>((hotspot, index) => ({
          id: `zone-${index + 1}`,
          lat: hotspot.lat,
          lon: hotspot.lon,
          flow: cleanNumber(hotspot.passCount, hotspot.intensity * 5),
          activeVehicles: cleanNumber(hotspot.uniqueTaxis, Math.max(3, Math.round(hotspot.intensity / 1.4))),
          name: hotspot.name,
          level: index === 0 ? "高流量" : index < 5 ? "中流量" : "低流量",
        }));
        const heatPoints = hotspots.map<HeatPoint>((hotspot, index) => ({
          lat: hotspot.lat,
          lon: hotspot.lon,
          intensity: round(index === 0 ? 1 : Math.max(0.12, hotspot.intensity / 10), 3),
        }));
        const allPoints = [
          ...hotspots.map((hotspot) => ({ lat: hotspot.lat, lon: hotspot.lon })),
          ...trips.flatMap((trip) => trip.path),
        ];

        return {
          bounds: boundsFor(allPoints),
          zones: zones.length ? zones : fallbackMapLayers.zones,
          heatPoints: heatPoints.length ? heatPoints : fallbackMapLayers.heatPoints,
          trajectories: trips.length ? trips : fallbackMapLayers.trajectories,
        } satisfies MapLayers;
      }),
    fallbackMapLayers,
  );
}

function hotspotFromRow(row: HotspotRow, index: number): Hotspot | null {
  const start = normalizeLatLon(row.start_lat, row.start_lon);
  const end = normalizeLatLon(row.end_lat, row.end_lon);
  if (!start && !end) return null;
  const lat = start && end ? (start.lat + end.lat) / 2 : (start ?? end)!.lat;
  const lon = start && end ? (start.lon + end.lon) / 2 : (start ?? end)!.lon;
  const intensity = Math.max(1, Math.round(Math.log10(cleanNumber(row.pass_count, 1))));

  return {
    id: `${lat.toFixed(3)},${lon.toFixed(3)}-${row.road_id || index}`,
    name: row.hotspot_type || `热点-${row.road_id || index + 1}`,
    lat: round(lat, 6),
    lon: round(lon, 6),
    intensity,
    roadId: row.road_id,
    passCount: cleanNumber(row.pass_count, 0),
    uniqueTaxis: cleanNumber(row.unique_taxis, 0),
    type: row.road_class_name ?? undefined,
  } satisfies Hotspot;
}

function tripFromRow(row: TripRow): Trip | null {
  const path = parseLineStrings(row.route_geom);
  if (path.length < 2) return null;

  const computedDistance = distanceKm(path);
  const distance = cleanNumber(row.route_distance_m, computedDistance * 1000) / 1000;
  const rawSpeed = cleanNumber(
    row.avg_speed_kmh,
    row.trip_duration_s ? (distance / row.trip_duration_s) * 3600 : 0,
  );
  const speed =
    rawSpeed > 120 || rawSpeed <= 0
      ? estimateTripSpeed(distance, path.length, row.trip_id)
      : rawSpeed;

  return {
    tripId: String(row.trip_id),
    devid: row.devid,
    pointCount: cleanNumber(row.gps_points_count, path.length),
    distanceKm: round(distance || computedDistance, 2),
    avgSpeedKmh: round(speed, 2),
    speedLevel: speedLevel(speed),
    startTime: formatTripTime(row.trip_date, row.start_time),
    endTime: formatTripTime(row.trip_date, row.end_time),
    path,
  } satisfies Trip;
}

async function resilient<T>(
  action: () => Promise<{ data: T; source: "cache" | "database" | "fallback" }>,
  fallback: T,
) {
  try {
    return await action();
  } catch (error) {
    console.warn(
      "[traffic-panel] API fallback:",
      error instanceof Error ? error.message : String(error),
    );
    return { data: fallback, source: "fallback" as const };
  }
}

function cleanNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric !== 0 ? numeric : fallback;
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function healthScore(speed: number) {
  if (!speed) return fallbackOverview.roadHealthScore;
  return Math.max(45, Math.min(96, Math.round(58 + speed * 1.45)));
}

function normalizeCongestion(
  avgCongestion?: number | null,
  congestedRoads?: number | null,
  totalRoads?: number | null,
) {
  const raw = Number(avgCongestion);
  if (Number.isFinite(raw) && raw > 0) return round(Math.min(1, raw), 3);
  const congested = Number(congestedRoads);
  const total = Number(totalRoads);
  if (Number.isFinite(congested) && Number.isFinite(total) && total > 0) {
    return round(congested / total, 3);
  }
  return 0.38;
}

function congestionLevel(
  congestion?: number | null,
  avgSpeed?: number | null,
): CongestedRoad["level"] {
  const normalized = Number(congestion);
  const speed = Number(avgSpeed);
  if ((Number.isFinite(normalized) && normalized >= 0.65) || (Number.isFinite(speed) && speed < 24)) return "高";
  if ((Number.isFinite(normalized) && normalized >= 0.35) || (Number.isFinite(speed) && speed < 38)) return "中";
  return "低";
}

function speedLevel(speed: number): Trip["speedLevel"] {
  if (speed < 18) return "缓行";
  if (speed < 35) return "平稳";
  return "畅通";
}

function estimateTripSpeed(distance: number, pointCount: number, seed: number) {
  const variability = (seed % 11) * 2.6;
  const densityPenalty = Math.min(18, pointCount / 18);
  return Math.max(8, Math.min(58, 18 + distance * 2.4 + variability - densityPenalty));
}

function clampLimit(limit: number, max: number) {
  return Math.max(1, Math.min(max, Number.isFinite(limit) ? Math.floor(limit) : max));
}

function formatTripTime(tripDate: string, time?: string | null) {
  if (!time) return tripDate;
  const timePart = time.includes(" ") ? time.split(" ").at(-1) : time;
  return `${tripDate.replaceAll("-", "/")} ${timePart}`;
}

function formatTimelineHour(statDate: string, hour: number, includeDate: boolean) {
  const hourLabel = `${String(hour).padStart(2, "0")}:00`;
  if (!includeDate) return hourLabel;

  const parts = String(statDate).split(/[-/]/);
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2]} ${hourLabel}`;
  }
  return `${statDate} ${hourLabel}`;
}
