"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

import type { MapLayers, Trip } from "@/lib/traffic/types";

type TrafficMapProps = {
  layers: MapLayers;
  selectedTripId?: string;
  onSelectTrip: (trip: Trip) => void;
};

export function TrafficMap({
  layers,
  selectedTripId,
  onSelectTrip,
}: TrafficMapProps) {
  const center: [number, number] = [
    (layers.bounds.minLat + layers.bounds.maxLat) / 2,
    (layers.bounds.minLon + layers.bounds.maxLon) / 2,
  ];
  const bounds: LatLngBoundsExpression = [
    [layers.bounds.minLat, layers.bounds.minLon],
    [layers.bounds.maxLat, layers.bounds.maxLon],
  ];

  return (
    <MapContainer
      center={center}
      zoom={11}
      minZoom={10}
      maxZoom={15}
      scrollWheelZoom
      className="h-[360px] w-full overflow-hidden rounded-sm md:h-[420px]"
    >
      <TileLayer
        attribution='© <a href="https://ditu.amap.com/">高德地图</a>'
        subdomains={["1", "2", "3", "4"]}
        url="https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
      />
      <FitBounds bounds={bounds} />
      {layers.heatPoints.map((point, index) => (
        <CircleMarker
          key={`${point.lat}-${point.lon}-${index}`}
          center={[point.lat, point.lon]}
          radius={Math.max(12, point.intensity * 34)}
          pathOptions={{
            stroke: false,
            fillColor: "#4ee6ff",
            fillOpacity: Math.min(0.34, point.intensity * 0.24),
          }}
        />
      ))}
      {layers.zones.map((zone) => (
        <CircleMarker
          key={zone.id}
          center={[zone.lat, zone.lon]}
          radius={zone.level === "高流量" ? 9 : zone.level === "中流量" ? 7 : 5}
          pathOptions={{
            color: zone.level === "高流量" ? "#ffd21f" : zone.level === "中流量" ? "#17e9ff" : "#6df0a6",
            weight: 2,
            fillColor: zone.level === "高流量" ? "#ffd21f" : zone.level === "中流量" ? "#17e9ff" : "#6df0a6",
            fillOpacity: 0.68,
          }}
        >
          <LeafletTooltip direction="top" opacity={0.95}>
            {zone.name} · {zone.flow}
          </LeafletTooltip>
        </CircleMarker>
      ))}
      {layers.trajectories.map((trip) => {
        const selected = trip.tripId === selectedTripId;
        return (
          <Polyline
            key={trip.tripId}
            positions={trip.path.map((point) => [point.lat, point.lon])}
            eventHandlers={{
              click: () => onSelectTrip(trip),
            }}
            pathOptions={{
              color: selected ? "#ff72c8" : trip.speedLevel === "缓行" ? "#ffd21f" : "#20dff5",
              opacity: selected ? 0.96 : 0.58,
              weight: selected ? 5 : 3,
            }}
          >
            <LeafletTooltip sticky>
              {trip.devid} · {trip.speedLevel} · {trip.distanceKm}km
            </LeafletTooltip>
          </Polyline>
        );
      })}
    </MapContainer>
  );
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24], animate: true });
  }, [bounds, map]);

  return null;
}
