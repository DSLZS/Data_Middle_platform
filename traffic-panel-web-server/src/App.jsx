import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Activity,
  Car,
  Flame,
  Gauge,
  Milestone,
  Radar,
  Route,
  Sparkles,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Navigation2,
  Map,
  PieChart,
  Cpu,
  Clock,
  Layers,
  AlertCircle
} from "lucide-react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet.heat";

// ─── Utils ───────────────────────────────────────────────────────────────────
function fmt(val, d = 0) {
  if (typeof val !== "number" || Number.isNaN(val)) return "--";
  return val.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function polarPt(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, r, a0, a1) {
  if (Math.abs(a1 - a0) >= 359.9) {
    const mid = polarPt(cx, cy, r, a0 + 180);
    const s = polarPt(cx, cy, r, a0);
    return `M ${s[0].toFixed(2)} ${s[1].toFixed(2)} A ${r} ${r} 0 1 1 ${mid[0].toFixed(2)} ${mid[1].toFixed(2)} A ${r} ${r} 0 1 1 ${s[0].toFixed(2)} ${s[1].toFixed(2)}`;
  }
  const s = polarPt(cx, cy, r, a0);
  const e = polarPt(cx, cy, r, a1);
  const lg = (a1 - a0) % 360 > 180 ? 1 : 0;
  return `M ${s[0].toFixed(2)} ${s[1].toFixed(2)} A ${r} ${r} 0 ${lg} 1 ${e[0].toFixed(2)} ${e[1].toFixed(2)}`;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const PANEL_CLS =
  "relative overflow-hidden rounded border border-cyan-400/20 bg-[#06142e]/80 " +
  "shadow-[inset_0_0_40px_rgba(34,211,238,0.04),0_0_20px_rgba(6,182,212,0.12)] " +
  "backdrop-blur-sm";

const CORNER_TL =
  "pointer-events-none absolute -left-px -top-px h-7 w-7 border-l-2 border-t-2 border-cyan-400/70 rounded-tl";
const CORNER_TR =
  "pointer-events-none absolute -right-px -top-px h-7 w-7 border-r-2 border-t-2 border-cyan-400/40 rounded-tr";

function Panel({ children, className = "", p = "p-4" }) {
  return (
    <div className={`${PANEL_CLS} ${p} ${className}`}>
      <div className={CORNER_TL} />
      <div className={CORNER_TR} />
      {children}
    </div>
  );
}

function PanelHeader({ icon: Icon, title, badge }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-cyan-400" />}
        <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-300">
          {title}
        </span>
      </div>
      {badge != null && (
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/8 px-2.5 py-0.5 text-[10px] text-cyan-200/60">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function ClockDisplay() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return (
    <div className="text-right font-mono leading-snug">
      <p className="text-[11px] text-cyan-300/80">
        {now.toLocaleDateString("zh-CN")} {days[now.getDay()]}
      </p>
      <p className="text-sm font-semibold tracking-widest text-cyan-50">
        {now.toLocaleTimeString("zh-CN")}
      </p>
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 130, sw = 16, label, sub }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - sw / 2 - 3;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let start = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(56,189,248,0.07)" strokeWidth={sw} />
      {segments.map((seg, i) => {
        if (!seg.value) return null;
        const sweep = (seg.value / total) * 360;
        const d = arcPath(cx, cy, r, start, start + sweep - 0.8);
        start += sweep;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={seg.color}
            strokeWidth={sw}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${seg.color}aa)` }}
          />
        );
      })}
      <text x={cx} y={cy - 7} textAnchor="middle" fill="#e0f2fe" fontSize="16" fontWeight="700" fontFamily="monospace">
        {label}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(125,211,252,0.6)" fontSize="9">
        {sub}
      </text>
    </svg>
  );
}

// ─── MiniLineChart ────────────────────────────────────────────────────────────
function MiniLineChart({ data, color = "#22d3ee", h = 140 }) {
  const pts = useMemo(() => {
    if (!data?.length) return [];
    const W = 760;
    const maxY = Math.max(...data.map((d) => d.activeVehicles), 1);
    const step = W / ((data.length - 1) || 1);
    return data.map((d, i) => ({
      x: i * step,
      y: h - (d.activeVehicles / maxY) * h,
      label: d.hour,
      v: d.activeVehicles
    }));
  }, [data, h]);

  if (!pts.length) {
    return (
      <div className="flex items-center justify-center text-xs text-cyan-200/30" style={{ height: h }}>
        暂无数据
      </div>
    );
  }

  const polyPts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fillId = `fill${color.replace("#", "")}`;
  const skip = Math.max(1, Math.floor(pts.length / 10));

  return (
    <svg className="block w-full" viewBox={`0 0 760 ${h + 22}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
        <filter id={`glow${color.replace("#", "")}`}>
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" y1={h * f} x2="760" y2={h * f} stroke={`${color}15`} strokeWidth="1" />
      ))}
      <polyline fill={`url(#${fillId})`} stroke="none" points={`0,${h} ${polyPts} 760,${h}`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={polyPts}
        filter={`url(#glow${color.replace("#", "")})`}
      />
      {pts.filter((_, i) => i % skip === 0).map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r="3" fill={color} fillOpacity="0.9">
          <title>{`${p.label}: ${p.v}`}</title>
        </circle>
      ))}
      {pts.filter((_, i) => i % skip === 0).map((p) => (
        <text
          key={`l${p.label}`}
          x={p.x}
          y={h + 16}
          textAnchor="middle"
          fill="rgba(147,197,253,0.45)"
          fontSize="10"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ─── HBarChart ────────────────────────────────────────────────────────────────
const HBAR_COLORS = ["#22d3ee", "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#34d399"];

function HBarChart({ data }) {
  const mx = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="w-[72px] shrink-0 truncate text-right text-[10px] leading-tight text-cyan-200/55">
            {item.label}
          </span>
          <div className="relative h-[18px] flex-1 overflow-hidden rounded-[2px] bg-[#030b1d]">
            <div
              className="h-full rounded-[2px] transition-[width] duration-700"
              style={{
                width: `${(item.value / mx) * 100}%`,
                background: `linear-gradient(to right, ${HBAR_COLORS[i % HBAR_COLORS.length]}55, ${HBAR_COLORS[i % HBAR_COLORS.length]})`,
                boxShadow: `0 0 8px ${HBAR_COLORS[i % HBAR_COLORS.length]}55`
              }}
            />
          </div>
          <span className="w-9 shrink-0 text-right font-mono text-[11px] text-cyan-300">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── VBarChart (grouped) ──────────────────────────────────────────────────────
const VBAR_COLORS = ["#22d3ee", "#facc15", "#f472b6"];

function VBarChart({ groups }) {
  if (!groups?.length) return null;
  const allVals = groups.flatMap((g) => g.values);
  const mx = Math.max(...allVals, 1);
  const BW = 9;
  const GAP = 3;
  const GGAP = 10;
  const H = 110;
  const nSeries = Math.max(...groups.map((g) => g.values.length));
  const groupW = nSeries * (BW + GAP) - GAP;
  const totalW = groups.length * (groupW + GGAP) - GGAP;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${H + 20}`}
      className="block h-32 w-full"
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        {VBAR_COLORS.map((c, i) => (
          <linearGradient key={i} id={`vg${i}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={`${c}44`} />
          </linearGradient>
        ))}
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1="0"
          y1={H * (1 - f)}
          x2={totalW}
          y2={H * (1 - f)}
          stroke="rgba(56,189,248,0.08)"
          strokeWidth="1"
        />
      ))}
      {groups.map((g, gi) => {
        const gx = gi * (groupW + GGAP);
        return (
          <g key={g.label}>
            {g.values.map((val, vi) => {
              const bh = (val / mx) * H;
              return (
                <rect
                  key={vi}
                  x={gx + vi * (BW + GAP)}
                  y={H - bh}
                  width={BW}
                  height={bh}
                  fill={`url(#vg${vi % VBAR_COLORS.length})`}
                  rx="1"
                  style={{ filter: `drop-shadow(0 0 3px ${VBAR_COLORS[vi % VBAR_COLORS.length]}60)` }}
                />
              );
            })}
            <text
              x={gx + groupW / 2}
              y={H + 14}
              textAnchor="middle"
              fill="rgba(147,197,253,0.45)"
              fontSize="8"
            >
              {g.label?.length > 7 ? `${g.label.slice(0, 7)}…` : g.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── TrafficMap ───────────────────────────────────────────────────────────────
function MapAutoFit({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(
      [
        [bounds.minLat, bounds.minLon],
        [bounds.maxLat, bounds.maxLon]
      ],
      { padding: [16, 16] }
    );
  }, [map, bounds]);

  return null;
}

function LeafletHeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points?.length) return undefined;

    const heatData = points.map((p) => [p.lat, p.lon, Math.max(0.08, Math.min(1, p.intensity || 0))]);
    const layer = L.heatLayer(heatData, {
      radius: 28,
      blur: 20,
      minOpacity: 0.2,
      maxZoom: 16,
      gradient: {
        0.25: "#38bdf8",
        0.45: "#22d3ee",
        0.65: "#facc15",
        0.85: "#f97316",
        1: "#fb7185"
      }
    });

    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}

function TrafficMap({ mapData, selectedTripId, onSelectTrip }) {
  const { bounds, zones, trajectories, heatPoints } = mapData || {};
  const [amapTileFailed, setAmapTileFailed] = useState(false);

  if (!bounds || !zones || !trajectories || !heatPoints) {
    return (
      <div className="grid h-52 place-items-center rounded border border-dashed border-cyan-400/20 text-xs text-cyan-200/30">
        地图数据暂不可用
      </div>
    );
  }

  const zoneColors = { 高流量: "#facc15", 中流量: "#22d3ee", 低流量: "#60a5fa" };

  return (
    <div>
      <div className="overflow-hidden rounded border border-cyan-400/15">
        <MapContainer
          className="h-[260px] w-full"
          center={[(bounds.minLat + bounds.maxLat) / 2, (bounds.minLon + bounds.maxLon) / 2]}
          zoom={12}
          scrollWheelZoom
        >
          <MapAutoFit bounds={bounds} />
          <TileLayer
            attribution={
              amapTileFailed
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                : '&copy; <a href="https://ditu.amap.com/">高德地图</a>'
            }
            subdomains={["1", "2", "3", "4"]}
            url={
              amapTileFailed
                ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                : "https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
            }
            eventHandlers={{
              tileerror: () => {
                setAmapTileFailed(true);
              }
            }}
          />
          <LeafletHeatLayer points={heatPoints} />

          {trajectories.map((traj) => {
            const active = traj.tripId === selectedTripId;
            return (
              <Polyline
                key={traj.tripId}
                positions={traj.path.map((p) => [p.lat, p.lon])}
                pathOptions={{
                  color: active ? "#facc15" : "#67e8f9",
                  opacity: active ? 0.95 : 0.45,
                  weight: active ? 4 : 2
                }}
                eventHandlers={{
                  click: () => onSelectTrip(traj.tripId)
                }}
              >
                <Tooltip sticky>{`设备 ${traj.devid} / ${traj.speedLevel}`}</Tooltip>
              </Polyline>
            );
          })}

          {zones.map((zone) => {
            const color = zoneColors[zone.level] || "#34d399";
            return (
              <CircleMarker
                key={zone.id}
                center={[zone.lat, zone.lon]}
                radius={Math.max(5, Math.min(14, 4 + zone.flow * 1.5))}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.55,
                  weight: 1
                }}
              >
                <Tooltip direction="top">
                  {`${zone.name}｜车流 ${zone.flow}｜车辆 ${zone.activeVehicles}`}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div className="mt-2 flex gap-4 text-[10px] text-cyan-200/55">
        {[
          ["bg-yellow-400", "高流量"],
          ["bg-cyan-400", "中流量"],
          ["bg-blue-400", "低流量"]
        ].map(([cls, lbl]) => (
          <span key={lbl} className="inline-flex items-center gap-1.5">
            <i className={`h-1.5 w-1.5 rounded-full ${cls}`} />
            {lbl}
          </span>
        ))}
        {amapTileFailed && (
          <span className="text-amber-300/80">高德瓦片不可用，已回退基础底图</span>
        )}
        <span className="ml-auto text-cyan-200/40">点击轨迹切换关注</span>
      </div>
    </div>
  );
}

// ─── KPI Metrics Config ───────────────────────────────────────────────────────
const KPI_METRICS = [
  { key: "activeVehicles", label: "活跃车辆数", unit: "辆", icon: Car },
  { key: "totalTrips", label: "总轨迹数", unit: "条", icon: Route },
  { key: "totalMileageKm", label: "估算总里程", unit: "km", icon: Milestone },
  { key: "avgSpeedKmh", label: "平均车速", unit: "km/h", icon: Gauge },
  { key: "roadHealthScore", label: "路网健康度", unit: "/100", icon: Activity }
];

const LEVEL_CLS = {
  高: "bg-yellow-400/15 text-yellow-200 border-yellow-400/35",
  中: "bg-sky-400/15 text-sky-200 border-sky-400/35",
  低: "bg-blue-400/15 text-blue-200 border-blue-400/35"
};

const speedColor = (level) => {
  if (level?.includes("缓") || level?.includes("慢")) return "text-yellow-300";
  if (level?.includes("平稳") || level?.includes("中")) return "text-sky-300";
  return "text-cyan-300";
};

const creativeIdeas = [
  {
    id: "idea-1",
    title: "潮汐模式回放",
    desc: "增加 24 小时自动回放动画，展示高峰波动与热区漂移。",
    icon: Radar
  },
  {
    id: "idea-2",
    title: "异常事件雷达",
    desc: "按急刹车、长时低速、异常绕行自动打点，形成事件热层。",
    icon: Flame
  },
  {
    id: "idea-3",
    title: "一键策略模拟",
    desc: "模拟公交增开与信号配时优化后，对拥堵指数预估对比。",
    icon: Sparkles
  }
];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [roads, setRoads] = useState([]);
  const [trips, setTrips] = useState([]);
  const [mapLayers, setMapLayers] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [activeView, setActiveView] = useState("hotspots");
  const [selectedHotspotId, setSelectedHotspotId] = useState("");
  const [selectedRoadId, setSelectedRoadId] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const loadingRef = useRef(false);

  async function loadDashboard({ silent = false } = {}) {
    if (loadingRef.current) return;
    try {
      loadingRef.current = true;
      setError("");
      if (!silent) setLoading(true);
      const [oR, tR, hR, rR, trR, mR] = await Promise.all([
        fetch("/api/overview"),
        fetch("/api/timeline"),
        fetch("/api/hotspots"),
        fetch("/api/congested-roads"),
        fetch("/api/trips?limit=8"),
        fetch("/api/map-layers")
      ]);
      const [oD, tD, hD, rD, trD, mD] = await Promise.all([
        oR.json(),
        tR.json(),
        hR.json(),
        rR.json(),
        trR.json(),
        mR.json()
      ]);
      setOverview(oD.data);
      setTimeline(tD.data);
      setHotspots(hD.data);
      setRoads(rD.data);
      setTrips(trD.data);
      setMapLayers(mD.data);
      setSelectedHotspotId((prev) =>
        hD.data.some((item) => item.id === prev) ? prev : hD.data[0]?.id ?? ""
      );
      setSelectedRoadId((prev) =>
        rD.data.some((item) => String(item.roadId) === prev) ? prev : String(rD.data[0]?.roadId ?? "")
      );
      setSelectedTripId((prev) =>
        trD.data.some((item) => item.tripId === prev) ? prev : trD.data[0]?.tripId ?? ""
      );
      setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
    } catch (e) {
      setError(`数据加载失败：${e.message}`);
    } finally {
      loadingRef.current = false;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(() => {
      loadDashboard({ silent: true });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const selectedHotspot = hotspots.find((h) => h.id === selectedHotspotId);
  const selectedRoad = roads.find((r) => String(r.roadId) === selectedRoadId);
  const selectedTrip = trips.find((t) => t.tripId === selectedTripId);
  const totalTrips = typeof overview?.totalTrips === "number" ? overview.totalTrips : trips.length;

  // Derived donut data: speed level distribution from trips
  const speedDonut = useMemo(() => {
    const counts = { 快速: 0, 中速: 0, 慢速: 0 };
    trips.forEach((t) => {
      const speed = Number(t.avgSpeedKmh || 0);
      if (speed > 26 || t.speedLevel?.includes("畅通") || t.speedLevel?.includes("快")) {
        counts["快速"] += 1;
      } else if (speed > 18 || t.speedLevel?.includes("平稳") || t.speedLevel?.includes("中")) {
        counts["中速"] += 1;
      } else {
        counts["慢速"] += 1;
      }
    });
    return [
      { label: "快速", value: counts["快速"], color: "#22d3ee" },
      { label: "中速", value: counts["中速"], color: "#facc15" },
      { label: "慢速", value: counts["慢速"], color: "#f472b6" }
    ];
  }, [trips]);

  // Derived donut data: road congestion level distribution
  const congDonut = useMemo(() => {
    const counts = { 高: 0, 中: 0, 低: 0 };
    roads.forEach((r) => {
      if (r.level in counts) counts[r.level]++;
      else counts["低"]++;
    });
    return [
      { label: "高", value: counts["高"], color: "#f87171" },
      { label: "中", value: counts["中"], color: "#facc15" },
      { label: "低", value: counts["低"], color: "#34d399" }
    ];
  }, [roads]);

  // H-bar chart data from hotspot intensity
  const hbarData = useMemo(
    () =>
      [...hotspots]
        .sort((a, b) => b.intensity - a.intensity)
        .slice(0, 6)
        .map((h) => ({ label: h.name, value: h.intensity })),
    [hotspots]
  );

  // V-bar chart data from road frequency by level
  const vbarGroups = useMemo(() => {
    return roads.slice(0, 5).map((r) => ({
      label: `R${r.roadId}`,
      values: [r.count, Math.max(0, r.count - 2), Math.floor(r.count * 0.6)]
    }));
  }, [roads]);

  // Trip line data (distance over trip index)
  const tripLineData = useMemo(
    () =>
      trips.map((t, i) => ({
        hour: `T${i + 1}`,
        activeVehicles: Math.round(t.distanceKm * 10)
      })),
    [trips]
  );

  return (
    <main className="mx-auto w-full max-w-[1700px] px-3 pb-10 pt-4 sm:px-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="mb-4">
        <div className="flex items-center gap-3">
          <div className="hidden h-px flex-1 bg-linear-to-r from-transparent via-cyan-400/40 to-transparent sm:block" />
          <div className="relative min-w-0 rounded-full border border-cyan-400/40 bg-linear-to-r from-sky-500/15 via-blue-600/25 to-sky-500/15 px-6 py-3 text-center shadow-[0_0_24px_rgba(34,211,238,0.3)]">
            <h1 className="whitespace-nowrap text-lg font-bold tracking-[0.3em] text-cyan-50 sm:text-2xl">
              哈尔滨网约车交通流量数据总览
            </h1>
          </div>
          <div className="hidden h-px flex-1 bg-linear-to-r from-transparent via-cyan-400/40 to-transparent sm:block" />
          <div className="ml-1 flex shrink-0 items-center gap-2.5">
            <Panel p="px-3 py-2" className="min-w-fit">
              <ClockDisplay />
            </Panel>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Row A: Donut | KPI | Donut ──────────────────────────────────────── */}
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr_1fr]">
        {/* Status donut */}
        <Panel>
          <PanelHeader icon={PieChart} title="状态占比" />
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              segments={speedDonut}
              size={130}
              sw={16}
              label={trips.length || "--"}
              sub="采样轨迹"
            />
            <div className="w-full space-y-1.5">
              {speedDonut.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
                    <span className="text-cyan-200/70">{s.label}</span>
                  </span>
                  <span className="font-mono text-cyan-100">{s.value} 条</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* KPI metrics */}
        <Panel>
          <PanelHeader icon={Activity} title="核心指标" badge={loading ? "更新中..." : `更新 ${lastUpdated}`} />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            {KPI_METRICS.map((m) => {
              const IconComp = m.icon;
              const val = fmt(
                overview?.[m.key],
                m.key.includes("Km") || m.key.includes("Speed") ? 2 : 0
              );
              return (
                <div
                  key={m.key}
                  className="rounded border border-cyan-400/15 bg-[#030e22]/60 px-3 py-2.5"
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] text-cyan-200/60">
                    <IconComp className="h-3 w-3 text-cyan-400" />
                    {m.label}
                  </div>
                  <strong
                    className={`block font-mono text-xl font-bold tracking-wide text-cyan-50 sm:text-2xl ${loading ? "opacity-30" : ""}`}
                    style={{ textShadow: "0 0 12px rgba(34,211,238,0.5)" }}
                  >
                    {loading ? "--" : val}
                  </strong>
                  <small className="mt-0.5 block text-[10px] text-cyan-200/45">{m.unit}</small>
                </div>
              );
            })}
          </div>

          {/* Second row info tiles */}
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            <div className="rounded border border-cyan-400/15 bg-[#030e22]/60 px-3 py-2">
              <div className="text-[10px] text-cyan-200/50">热点区块</div>
              <div className="font-mono text-lg font-bold text-cyan-50" style={{ textShadow: "0 0 10px rgba(34,211,238,0.5)" }}>
                {hotspots.length || "--"}
              </div>
              <div className="text-[10px] text-cyan-200/40">个</div>
            </div>
            <div className="rounded border border-cyan-400/15 bg-[#030e22]/60 px-3 py-2">
              <div className="text-[10px] text-cyan-200/50">拥堵路段</div>
              <div className="font-mono text-lg font-bold text-cyan-50" style={{ textShadow: "0 0 10px rgba(34,211,238,0.5)" }}>
                {roads.length || "--"}
              </div>
              <div className="text-[10px] text-cyan-200/40">条</div>
            </div>
            <div className="rounded border border-cyan-400/15 bg-[#030e22]/60 px-3 py-2">
              <div className="text-[10px] text-cyan-200/50">采样轨迹</div>
              <div className="font-mono text-lg font-bold text-cyan-50" style={{ textShadow: "0 0 10px rgba(34,211,238,0.5)" }}>
                {trips.length || "--"}
              </div>
              <div className="text-[10px] text-cyan-200/40">条</div>
            </div>
          </div>
        </Panel>

        {/* System donut */}
        <Panel>
          <PanelHeader icon={Cpu} title="系统占比" />
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              segments={congDonut}
              size={130}
              sw={16}
              label={roads.length || "--"}
              sub="拥堵路段"
            />
            <div className="w-full space-y-1.5">
              {congDonut.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
                    <span className="text-cyan-200/70">{s.label}拥堵</span>
                  </span>
                  <span className="font-mono text-cyan-100">{s.value} 条</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Row B: Trend chart (full width) ────────────────────────────────── */}
      <Panel className="mb-3">
        <PanelHeader icon={TrendingUp} title="趋势图" badge="按小时活跃车辆" />
        <MiniLineChart data={timeline} color="#22d3ee" h={140} />
      </Panel>

      {/* ── Row C: Service data | Map | Service stats ───────────────────────── */}
      <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_2fr_1fr]">
        {/* 服务数据 */}
        <Panel>
          <PanelHeader icon={BarChart3} title="服务数据" badge={`TOP ${hbarData.length}`} />
          {hbarData.length ? (
            <HBarChart data={hbarData} />
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-cyan-200/30">暂无数据</div>
          )}
        </Panel>

        {/* Traffic Map */}
        <Panel>
          <PanelHeader icon={Map} title="区域车流与轨迹地图" />
          <TrafficMap
            mapData={mapLayers}
            selectedTripId={selectedTripId}
            onSelectTrip={setSelectedTripId}
          />
        </Panel>

        {/* 服务统计 */}
        <Panel>
          <PanelHeader icon={Layers} title="服务统计" badge="路段频次" />
          {vbarGroups.length ? (
            <>
              <VBarChart groups={vbarGroups} />
              <div className="mt-2 flex gap-3 text-[10px] text-cyan-200/50">
                {["频次", "超速", "绕行"].map((lbl, i) => (
                  <span key={lbl} className="inline-flex items-center gap-1">
                    <i
                      className="h-1.5 w-3 rounded-[1px]"
                      style={{ background: VBAR_COLORS[i], boxShadow: `0 0 4px ${VBAR_COLORS[i]}` }}
                    />
                    {lbl}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-cyan-200/30">暂无数据</div>
          )}
        </Panel>
      </div>

      {/* ── Row D: Orders + Trips + Count change ──────────────────────────────── */}
      <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* 订单趋势 1 */}
        <Panel>
          <PanelHeader icon={TrendingUp} title="订单趋势" badge={`总 ${fmt(totalTrips)} 条`} />
          <MiniLineChart data={tripLineData} color="#c084fc" h={110} />
        </Panel>

        {/* 订单趋势 2 / Tabbed data */}
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Navigation2 className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-300">
                {activeView === "hotspots" ? "热点分析" : "拥堵路段"}
              </span>
            </div>
            <div className="flex gap-1.5" role="tablist">
              {[
                { id: "hotspots", label: "热点 Top5" },
                { id: "roads", label: "拥堵路段" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeView === tab.id}
                  className={`min-h-7 rounded border px-2.5 text-[10px] transition-all cursor-pointer ${
                    activeView === tab.id
                      ? "border-cyan-400/60 bg-cyan-500/18 text-cyan-100"
                      : "border-cyan-400/25 bg-transparent text-cyan-200/55 hover:border-cyan-400/45"
                  }`}
                  onClick={() => setActiveView(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeView === "hotspots" ? (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {["热点", "坐标", "强度", ""].map((h) => (
                      <th key={h} className="py-1.5 text-left text-[10px] font-medium text-cyan-200/50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-t border-cyan-400/12 text-cyan-50 transition-colors ${
                        selectedHotspotId === item.id ? "bg-cyan-500/10" : "hover:bg-cyan-500/5"
                      }`}
                    >
                      <td className="py-1.5">{item.name}</td>
                      <td className="py-1.5 font-mono text-[10px] text-cyan-200/60">
                        {item.lat.toFixed(3)}, {item.lon.toFixed(3)}
                      </td>
                      <td className="py-1.5">{item.intensity}</td>
                      <td className="py-1.5">
                        <button
                          type="button"
                          className="min-h-6 rounded border border-cyan-400/40 bg-cyan-500/10 px-2 text-[10px] text-cyan-100 transition-colors hover:bg-cyan-500/20 cursor-pointer"
                          onClick={() => setSelectedHotspotId(item.id)}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {["路段 ID", "频次", "等级", ""].map((h) => (
                      <th key={h} className="py-1.5 text-left text-[10px] font-medium text-cyan-200/50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roads.map((item) => (
                    <tr
                      key={item.roadId}
                      className={`border-t border-cyan-400/12 text-cyan-50 transition-colors ${
                        selectedRoadId === String(item.roadId) ? "bg-cyan-500/10" : "hover:bg-cyan-500/5"
                      }`}
                    >
                      <td className="py-1.5">{item.roadId}</td>
                      <td className="py-1.5">{item.count}</td>
                      <td className="py-1.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${LEVEL_CLS[item.level] || LEVEL_CLS["低"]}`}
                        >
                          {item.level}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <button
                          type="button"
                          className="min-h-6 rounded border border-cyan-400/40 bg-cyan-500/10 px-2 text-[10px] text-cyan-100 transition-colors hover:bg-cyan-500/20 cursor-pointer"
                          onClick={() => setSelectedRoadId(String(item.roadId))}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-2 rounded border border-cyan-400/20 bg-[#030e22]/60 px-2.5 py-1.5 text-[10px] text-cyan-200/60">
            {activeView === "hotspots"
              ? `关注：${selectedHotspot?.name || "--"}，强度 ${selectedHotspot?.intensity ?? "--"}`
              : `关注：路段 ${selectedRoad?.roadId ?? "--"}，等级 ${selectedRoad?.level ?? "--"}`}
          </p>
        </Panel>

        {/* 数量变化 / 策略建议 */}
        <Panel>
          <PanelHeader icon={Sparkles} title="数量变化" badge="策略建议" />
          <div className="space-y-2">
            {creativeIdeas.map((idea) => {
              const IdeaIcon = idea.icon;
              return (
                <div
                  key={idea.id}
                  className="rounded border border-cyan-400/15 bg-[#030e22]/60 p-2.5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <IdeaIcon className="h-3 w-3 text-cyan-400" />
                    <h3 className="text-[11px] font-semibold text-cyan-50">{idea.title}</h3>
                  </div>
                  <p className="text-[10px] leading-relaxed text-cyan-200/55">{idea.desc}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── Row E: Trip Cards ─────────────────────────────────────────────────── */}
      <Panel className="mb-3">
        <PanelHeader icon={Route} title="轨迹复盘" badge={`采样 ${trips.length} / 总 ${fmt(totalTrips)} 条`} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {trips.map((trip) => (
            <article
              key={trip.tripId}
              className={`rounded border p-2.5 transition-all cursor-pointer ${
                selectedTripId === trip.tripId
                  ? "border-cyan-400/55 bg-cyan-500/12"
                  : "border-cyan-400/15 bg-[#030e22]/60 hover:border-cyan-400/40"
              }`}
              onClick={() => setSelectedTripId(trip.tripId)}
            >
              <h3 className="mb-1.5 text-[11px] font-semibold text-cyan-50">设备 {trip.devid}</h3>
              <p className="text-[10px] text-cyan-200/55">{trip.startTime}</p>
              <p className="text-[10px] text-cyan-200/55">{trip.endTime}</p>
              <p className="mt-1 font-mono text-[11px] text-cyan-100">{fmt(trip.distanceKm, 2)} km</p>
              <p className={`text-[10px] ${speedColor(trip.speedLevel)}`}>{trip.speedLevel}</p>
            </article>
          ))}
        </div>
        <p className="mt-2 rounded border border-cyan-400/20 bg-[#030e22]/60 px-3 py-1.5 text-[10px] text-cyan-200/60">
          当前关注：{selectedTrip?.devid ?? "--"}，里程 {fmt(selectedTrip?.distanceKm, 2)} km
        </p>
      </Panel>

      {/* ── Footer actions ───────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex min-h-8 items-center gap-2 rounded border border-cyan-400/45 bg-cyan-500/12 px-4 text-[11px] text-cyan-50 transition-all hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "刷新中..." : "刷新数据"}
        </button>
      </div>
    </main>
  );
}
