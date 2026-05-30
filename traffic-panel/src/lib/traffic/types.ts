export type ApiResult<T> = {
  success: boolean;
  data: T;
  source?: "database" | "fallback" | "cache";
  error?: string;
};

export type Overview = {
  activeVehicles: number;
  totalTrips: number;
  totalMileageKm: number;
  avgSpeedKmh: number;
  roadHealthScore: number;
  peakHour: number;
  updatedAt: string;
};

export type TimelinePoint = {
  hour: string;
  activeVehicles: number;
  avgSpeed: number;
  congestion: number;
};

export type Hotspot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  intensity: number;
  roadId?: number;
  passCount?: number;
  uniqueTaxis?: number;
  type?: string;
};

export type CongestedRoad = {
  roadId: number;
  count: number;
  level: "高" | "中" | "低";
  avgSpeedKmh?: number;
};

export type TripPoint = {
  lat: number;
  lon: number;
  ts?: number;
};

export type Trip = {
  tripId: string;
  devid: string;
  pointCount: number;
  distanceKm: number;
  avgSpeedKmh: number;
  speedLevel: "畅通" | "平稳" | "缓行";
  startTime: string;
  endTime: string;
  path: TripPoint[];
};

export type MapZone = {
  id: string;
  lat: number;
  lon: number;
  flow: number;
  activeVehicles: number;
  name: string;
  level: "高流量" | "中流量" | "低流量";
};

export type HeatPoint = {
  lat: number;
  lon: number;
  intensity: number;
};

export type MapLayers = {
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  zones: MapZone[];
  heatPoints: HeatPoint[];
  trajectories: Trip[];
};

export type RoadClassStat = {
  classId: number;
  className: string;
  roadCount: number;
  totalPass: number;
  avgSpeedKmh: number;
  congestionLevel: number;
  avgLengthM: number;
};
