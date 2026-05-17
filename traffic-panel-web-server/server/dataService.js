import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mockPath = path.resolve(__dirname, "../mock/trips.mock.json");
const INITIAL_TRIPS = 20;
const PENDING_TRIPS = 100;
const WRITE_INTERVAL_MS = 2000;

let liveTrips = [];
let pendingTrips = [];
let insertTimer = null;
let idCounter = 0;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function tripDistanceKm(trip) {
  let total = 0;
  for (let i = 1; i < trip.lat.length; i += 1) {
    total += haversineDistance(
      trip.lat[i - 1],
      trip.lon[i - 1],
      trip.lat[i],
      trip.lon[i]
    );
  }
  return total;
}

function parseTrips() {
  const content = fs.readFileSync(mockPath, "utf8");
  return JSON.parse(content);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function jitterTrip(baseTrip, tag, sequence, mode = "normal", hourSlot = null) {
  const pointCount = Math.max(4, baseTrip.lat.length);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetHour = hourSlot == null ? Math.floor(rand(0, 24)) : hourSlot;
  const hourBaseSec = Math.floor(dayStart / 1000) + targetHour * 3600;
  const startSec = hourBaseSec + Math.floor(rand(0, 2700));
  const latJitter = rand(-0.015, 0.015);
  const lonJitter = rand(-0.018, 0.018);
  const generatedId = `${tag}-${Date.now()}-${sequence}-${idCounter += 1}`;
  const devid = `SIM-${String(100000 + idCounter).padStart(6, "0")}`;

  const lat = [];
  const lon = [];
  const tms = [];
  const tsStepRange = mode === "fast" ? [10, 26] : [20, 90];
  const moveRange = mode === "fast" ? [-0.0024, 0.0024] : [-0.0025, 0.0025];
  const moveRangeLon = mode === "fast" ? [-0.0032, 0.0032] : [-0.003, 0.003];
  for (let i = 0; i < pointCount; i += 1) {
    const srcIdx = Math.min(i, baseTrip.lat.length - 1);
    const moveFactor = i / Math.max(1, pointCount - 1);
    lat.push(Number((baseTrip.lat[srcIdx] + latJitter + moveFactor * rand(...moveRange)).toFixed(6)));
    lon.push(Number((baseTrip.lon[srcIdx] + lonJitter + moveFactor * rand(...moveRangeLon)).toFixed(6)));
    tms.push(startSec + i * Math.floor(rand(...tsStepRange)));
  }

  const roadBase =
    mode === "fast"
      ? [500101, 500108, 500126, 500188]
      : baseTrip.roads?.length
        ? baseTrip.roads
        : [320001, 320045, 320102];
  const roads = roadBase.map((road, idx) => Number(road) + (sequence % 11) + idx);

  return {
    ...baseTrip,
    _simId: generatedId,
    devid,
    lat,
    lon,
    tms,
    roads,
    route: roads,
    time: roads.map((_, idx) => tms[Math.min(tms.length - 1, idx + 1)]),
    frac: roads.map((_, idx) => Number(((idx + 1) / roads.length).toFixed(2))),
    route_heading: roads.map(() => (Math.random() > 0.5 ? 1 : -1)),
    route_geom: lon.map((item, idx) => [item, lat[idx]])
  };
}

function buildSyntheticTrips(seedTrips, count, tag) {
  return Array.from({ length: count }, (_, i) => {
    const base = seedTrips[i % seedTrips.length];
    const fastRatio = tag === "pending" ? 0.65 : 0.5;
    const mode = Math.random() < fastRatio ? "fast" : "normal";
    const hourSlot = i % 24;
    return jitterTrip(base, tag, i + 1, mode, hourSlot);
  });
}

function getCurrentTrips() {
  return liveTrips;
}

function getBoundsFromTrips(trips) {
  if (!trips.length) {
    return {
      minLat: 45.65,
      maxLat: 45.72,
      minLon: 126.58,
      maxLon: 126.72
    };
  }
  const allLats = trips.flatMap((trip) => trip.lat);
  const allLons = trips.flatMap((trip) => trip.lon);
  return {
    minLat: Math.min(...allLats),
    maxLat: Math.max(...allLats),
    minLon: Math.min(...allLons),
    maxLon: Math.max(...allLons)
  };
}

export function initSimulationData() {
  const seedTrips = parseTrips();
  if (!seedTrips.length) {
    liveTrips = [];
    pendingTrips = [];
    return;
  }
  liveTrips = buildSyntheticTrips(seedTrips, INITIAL_TRIPS, "init");
  pendingTrips = buildSyntheticTrips(seedTrips, PENDING_TRIPS, "pending");
}

export function startSimulationWriter() {
  if (insertTimer) return;
  insertTimer = setInterval(() => {
    const next = pendingTrips.shift();
    if (!next) {
      clearInterval(insertTimer);
      insertTimer = null;
      return;
    }
    liveTrips.push(next);
  }, WRITE_INTERVAL_MS);
}

export function getOverview() {
  const trips = getCurrentTrips();
  const activeVehicles = new Set(trips.map((item) => item.devid)).size;

  let totalDistance = 0;
  let totalDurationHour = 0;

  for (const trip of trips) {
    totalDistance += tripDistanceKm(trip);
    const start = trip.tms[0];
    const end = trip.tms[trip.tms.length - 1];
    if (start && end && end > start) {
      totalDurationHour += (end - start) / 3600;
    }
  }

  const avgSpeedKmh = totalDurationHour > 0 ? totalDistance / totalDurationHour : 0;
  const roadHealthScore = Math.max(0, Math.min(100, 100 - avgSpeedKmh * 1.8 + 25));

  return {
    activeVehicles,
    totalTrips: trips.length,
    totalMileageKm: Number(totalDistance.toFixed(2)),
    avgSpeedKmh: Number(avgSpeedKmh.toFixed(2)),
    roadHealthScore: Number(roadHealthScore.toFixed(0))
  };
}

export function getTimeline() {
  const trips = getCurrentTrips();
  const bucket = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    activeVehicles: 0,
    avgSpeed: 0
  }));

  const hourVehicles = Array.from({ length: 24 }, () => new Set());
  const hourSpeedAgg = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }));

  for (const trip of trips) {
    const dist = tripDistanceKm(trip);
    const start = trip.tms[0];
    const end = trip.tms[trip.tms.length - 1];
    const speed = start && end && end > start ? dist / ((end - start) / 3600) : 0;

    for (const ts of trip.tms) {
      const hour = new Date(ts * 1000).getHours();
      hourVehicles[hour].add(trip.devid);
      hourSpeedAgg[hour].sum += speed;
      hourSpeedAgg[hour].count += 1;
    }
  }

  return bucket.map((item, hour) => ({
    ...item,
    activeVehicles: hourVehicles[hour].size,
    avgSpeed: Number(
      (
        (hourSpeedAgg[hour].count > 0
          ? hourSpeedAgg[hour].sum / hourSpeedAgg[hour].count
          : 0) || 0
      ).toFixed(2)
    )
  }));
}

export function getHotspots(limit = 5) {
  const trips = getCurrentTrips();
  const map = new Map();

  for (const trip of trips) {
    trip.lat.forEach((lat, index) => {
      const lon = trip.lon[index];
      const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
  }

  return [...map.entries()]
    .map(([key, intensity], index) => {
      const [lat, lon] = key.split(",").map(Number);
      return {
        id: `${key}-${index}`,
        name: `热点-${index + 1}`,
        lat,
        lon,
        intensity
      };
    })
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, limit);
}

export function getCongestedRoads(limit = 10) {
  const trips = getCurrentTrips();
  const roadCounter = new Map();

  for (const trip of trips) {
    for (const road of trip.roads) {
      roadCounter.set(road, (roadCounter.get(road) || 0) + 1);
    }
  }

  return [...roadCounter.entries()]
    .map(([roadId, count]) => ({
      roadId,
      count,
      level: count > 8 ? "高" : count > 4 ? "中" : "低"
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getTrips(limit = 10) {
  const trips = getCurrentTrips();
  return trips.slice(-limit).reverse().map((trip, idx) => {
    const start = trip.tms[0];
    const end = trip.tms[trip.tms.length - 1];
    const distanceKm = Number(tripDistanceKm(trip).toFixed(2));
    const durationHour = start && end && end > start ? (end - start) / 3600 : 0;
    const avgSpeedKmh = durationHour > 0 ? Number((distanceKm / durationHour).toFixed(2)) : 0;
    return {
      tripId: trip._simId || `trip-${idx + 1}`,
      devid: trip.devid,
      pointCount: trip.lat.length,
      distanceKm,
      avgSpeedKmh,
      speedLevel: avgSpeedKmh > 26 ? "畅通" : avgSpeedKmh > 18 ? "平稳" : "缓行",
      startTime: new Date(start * 1000).toLocaleString("zh-CN"),
      endTime: new Date(end * 1000).toLocaleString("zh-CN"),
      path: trip.lat.map((lat, index) => ({
        lat,
        lon: trip.lon[index],
        ts: trip.tms[index]
      }))
    };
  });
}

export function getMapLayers() {
  const trips = getCurrentTrips();
  const bounds = getBoundsFromTrips(trips);
  const precision = 200;
  const bucketMap = new Map();

  for (const trip of trips) {
    trip.lat.forEach((lat, idx) => {
      const lon = trip.lon[idx];
      const key = `${Math.round(lat * precision) / precision},${Math.round(lon * precision) / precision}`;
      const bucket =
        bucketMap.get(key) || {
          id: key,
          lat: 0,
          lon: 0,
          flow: 0,
          vehicleSet: new Set()
        };
      bucket.lat += lat;
      bucket.lon += lon;
      bucket.flow += 1;
      bucket.vehicleSet.add(trip.devid);
      bucketMap.set(key, bucket);
    });
  }

  const rawBuckets = [...bucketMap.values()].map((bucket) => ({
    id: bucket.id,
    lat: bucket.lat / bucket.flow,
    lon: bucket.lon / bucket.flow,
    flow: bucket.flow,
    activeVehicles: bucket.vehicleSet.size
  }));

  const maxFlow = Math.max(...rawBuckets.map((item) => item.flow), 1);

  const zones = rawBuckets
    .sort((a, b) => b.flow - a.flow)
    .slice(0, 12)
    .map((zone, index) => {
      const ratio = zone.flow / maxFlow;
      return {
        ...zone,
        id: `zone-${index + 1}`,
        name: `热点-${index + 1}`,
        level: ratio >= 0.7 ? "高流量" : ratio >= 0.35 ? "中流量" : "低流量"
      };
    });

  const heatPoints = rawBuckets.map((item) => ({
    lat: item.lat,
    lon: item.lon,
    intensity: Number((item.flow / maxFlow).toFixed(3))
  }));

  const trajectories = getTrips(20).map((trip) => ({
    tripId: trip.tripId,
    devid: trip.devid,
    speedLevel: trip.speedLevel,
    avgSpeedKmh: trip.avgSpeedKmh,
    path: trip.path
  }));

  return {
    bounds,
    zones,
    heatPoints,
    trajectories
  };
}

export function getSimulationStats() {
  return {
    initialTrips: INITIAL_TRIPS,
    pendingTotal: PENDING_TRIPS,
    pendingLeft: pendingTrips.length,
    writtenCount: Math.max(0, liveTrips.length - INITIAL_TRIPS),
    totalCurrent: liveTrips.length,
    writeIntervalMs: WRITE_INTERVAL_MS
  };
}
