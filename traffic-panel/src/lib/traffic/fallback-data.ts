import type {
  CongestedRoad,
  Hotspot,
  MapLayers,
  Overview,
  RoadClassStat,
  TimelinePoint,
  Trip,
} from "./types";

export const fallbackOverview: Overview = {
  activeVehicles: 120,
  totalTrips: 120,
  totalMileageKm: 117.92,
  avgSpeedKmh: 20.69,
  roadHealthScore: 88,
  peakHour: 8,
  updatedAt: "2026-05-30T00:00:00.000Z",
};

export const fallbackTimeline: TimelinePoint[] = Array.from(
  { length: 24 },
  (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    activeVehicles:
      hour < 4 ? 6 : hour < 20 ? 5 : hour < 22 ? 4 : 4,
    avgSpeed: [
      18.76, 53.09, 28.29, 46.85, 33.05, 44.56, 24.54, 26.47,
      26.75, 28.4, 20.21, 48.36, 18.81, 48.84, 38.47, 50.63,
      32.33, 46.13, 19.59, 32.14, 24.66, 36.72, 15.2, 37.28,
    ][hour],
    congestion: hour >= 7 && hour <= 9 ? 0.66 : hour >= 17 && hour <= 19 ? 0.7 : 0.38,
  }),
);

export const fallbackHotspots: Hotspot[] = [
  { id: "45.650,126.621-15", name: "热点-16", lat: 45.65, lon: 126.621, intensity: 9 },
  { id: "45.650,126.619-13", name: "热点-14", lat: 45.65, lon: 126.619, intensity: 5 },
  { id: "45.671,126.624-55", name: "热点-56", lat: 45.671, lon: 126.624, intensity: 5 },
  { id: "45.650,126.636-138", name: "热点-139", lat: 45.65, lon: 126.636, intensity: 5 },
  { id: "45.674,126.642-196", name: "热点-197", lat: 45.674, lon: 126.642, intensity: 5 },
];

export const fallbackCongestedRoads: CongestedRoad[] = [
  { roadId: 500111, count: 15, level: "高", avgSpeedKmh: 16 },
  { roadId: 500110, count: 12, level: "高", avgSpeedKmh: 18 },
  { roadId: 500109, count: 11, level: "高", avgSpeedKmh: 21 },
  { roadId: 500104, count: 9, level: "高", avgSpeedKmh: 23 },
  { roadId: 500112, count: 9, level: "高", avgSpeedKmh: 24 },
  { roadId: 500131, count: 9, level: "高", avgSpeedKmh: 22 },
  { roadId: 500194, count: 9, level: "高", avgSpeedKmh: 19 },
  { roadId: 500105, count: 9, level: "高", avgSpeedKmh: 17 },
];

export const fallbackTrips: Trip[] = [
  {
    tripId: "pending-0-100-120",
    devid: "SIM-100120",
    pointCount: 5,
    distanceKm: 1.12,
    avgSpeedKmh: 12.76,
    speedLevel: "缓行",
    startTime: "2015/1/3 03:31:54",
    endTime: "2015/1/3 03:37:10",
    path: [
      { lat: 45.71091, lon: 126.68712, ts: 12714 },
      { lat: 45.710885, lon: 126.687844, ts: 12797 },
      { lat: 45.708962, lon: 126.691455, ts: 12848 },
      { lat: 45.708544, lon: 126.692702, ts: 12789 },
      { lat: 45.710224, lon: 126.700045, ts: 13030 },
    ],
  },
  {
    tripId: "pending-0-99-119",
    devid: "SIM-100119",
    pointCount: 8,
    distanceKm: 1.16,
    avgSpeedKmh: 54.23,
    speedLevel: "畅通",
    startTime: "2015/1/3 02:14:48",
    endTime: "2015/1/3 02:16:05",
    path: [
      { lat: 45.674486, lon: 126.642312, ts: 8088 },
      { lat: 45.674751, lon: 126.642528, ts: 8100 },
      { lat: 45.67388, lon: 126.642469, ts: 8128 },
      { lat: 45.674201, lon: 126.641595, ts: 8154 },
      { lat: 45.675625, lon: 126.642132, ts: 8152 },
      { lat: 45.673691, lon: 126.644991, ts: 8198 },
      { lat: 45.67362, lon: 126.642712, ts: 8154 },
      { lat: 45.67537, lon: 126.639733, ts: 8165 },
    ],
  },
  {
    tripId: "pending-0-98-118",
    devid: "SIM-100118",
    pointCount: 5,
    distanceKm: 0.94,
    avgSpeedKmh: 44.53,
    speedLevel: "畅通",
    startTime: "2015/1/3 01:15:50",
    endTime: "2015/1/3 01:17:06",
    path: [
      { lat: 45.705978, lon: 126.677747, ts: 4550 },
      { lat: 45.70504, lon: 126.678266, ts: 4569 },
      { lat: 45.70429, lon: 126.679984, ts: 4582 },
      { lat: 45.705454, lon: 126.684008, ts: 4583 },
      { lat: 45.703038, lon: 126.686475, ts: 4626 },
    ],
  },
  {
    tripId: "pending-0-97-117",
    devid: "SIM-100117",
    pointCount: 8,
    distanceKm: 1.21,
    avgSpeedKmh: 22.22,
    speedLevel: "平稳",
    startTime: "2015/1/3 00:27:57",
    endTime: "2015/1/3 00:31:13",
    path: [
      { lat: 45.660075, lon: 126.619199, ts: 1677 },
      { lat: 45.659984, lon: 126.619758, ts: 1745 },
      { lat: 45.660189, lon: 126.620213, ts: 1825 },
      { lat: 45.6607, lon: 126.618941, ts: 1941 },
      { lat: 45.658709, lon: 126.620353, ts: 1865 },
      { lat: 45.659699, lon: 126.618163, ts: 1872 },
      { lat: 45.657631, lon: 126.617081, ts: 2151 },
      { lat: 45.660432, lon: 126.616905, ts: 1873 },
    ],
  },
];

export const fallbackRoadClasses: RoadClassStat[] = [
  {
    classId: 106,
    className: "次干路",
    roadCount: 7,
    totalPass: 457193,
    avgSpeedKmh: 105.95,
    congestionLevel: 0.38,
    avgLengthM: 143.22,
  },
  {
    classId: 114,
    className: "其他",
    roadCount: 12,
    totalPass: 280650,
    avgSpeedKmh: 63.2,
    congestionLevel: 0.48,
    avgLengthM: 223.33,
  },
  {
    classId: 104,
    className: "主干路",
    roadCount: 8,
    totalPass: 328120,
    avgSpeedKmh: 78.4,
    congestionLevel: 0.42,
    avgLengthM: 318.8,
  },
];

export const fallbackMapLayers: MapLayers = {
  bounds: {
    minLat: 45.644169,
    maxLat: 45.722193,
    minLon: 126.605932,
    maxLon: 126.711343,
  },
  zones: fallbackHotspots.map((hotspot, index) => ({
    id: `zone-${index + 1}`,
    lat: hotspot.lat,
    lon: hotspot.lon,
    flow: Math.max(8, hotspot.intensity * 5 + index),
    activeVehicles: Math.max(3, Math.round(hotspot.intensity / 1.6)),
    name: hotspot.name,
    level: index === 0 ? "高流量" : index < 4 ? "中流量" : "低流量",
  })),
  heatPoints: fallbackHotspots.map((hotspot, index) => ({
    lat: hotspot.lat,
    lon: hotspot.lon,
    intensity: index === 0 ? 1 : 0.35 + hotspot.intensity / 16,
  })),
  trajectories: fallbackTrips,
};
