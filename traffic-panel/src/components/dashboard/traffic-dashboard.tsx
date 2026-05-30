"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AreaChart as AreaIcon,
  BarChart3,
  CarTaxiFront,
  Crosshair,
  Database,
  Flame,
  Gauge,
  GitBranch,
  Layers3,
  Loader2,
  LocateFixed,
  MapPinned,
  Navigation,
  Radar,
  RefreshCw,
  Route,
  Satellite,
  Sparkles,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fallbackCongestedRoads,
  fallbackHotspots,
  fallbackMapLayers,
  fallbackOverview,
  fallbackRoadClasses,
  fallbackTimeline,
  fallbackTrips,
} from "@/lib/traffic/fallback-data";
import type {
  CongestedRoad,
  Hotspot,
  MapLayers,
  Overview,
  RoadClassStat,
  TimelinePoint,
  Trip,
} from "@/lib/traffic/types";

const DynamicTrafficMap = dynamic(
  () => import("./traffic-map").then((mod) => mod.TrafficMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-sm border border-cyan-400/20 bg-[#061426] text-cyan-200/70 md:h-[420px]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        地图加载中
      </div>
    ),
  },
);

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  source?: "database" | "fallback" | "cache";
};

type DashboardState = {
  overview: Overview;
  timeline: TimelinePoint[];
  hotspots: Hotspot[];
  congestedRoads: CongestedRoad[];
  trips: Trip[];
  mapLayers: MapLayers;
  roadClasses: RoadClassStat[];
  source: string;
};

const initialState: DashboardState = {
  overview: fallbackOverview,
  timeline: fallbackTimeline,
  hotspots: fallbackHotspots,
  congestedRoads: fallbackCongestedRoads,
  trips: fallbackTrips,
  mapLayers: fallbackMapLayers,
  roadClasses: fallbackRoadClasses,
  source: "fallback",
};

const ringColors = ["#24e6f5", "#ffd21f", "#ff72c8"];
const congestionColors = ["#ff626f", "#ffd21f", "#6df0a6"];

export function TrafficDashboard() {
  const [state, setState] = useState<DashboardState>(initialState);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot>(fallbackHotspots[0]);
  const [selectedTrip, setSelectedTrip] = useState<Trip>(fallbackTrips[0]);
  const [now, setNow] = useState(new Date("2026-05-30T00:00:00+08:00"));
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [
        overview,
        timeline,
        hotspots,
        congestedRoads,
        trips,
        mapLayers,
        roadClasses,
      ] = await Promise.all([
        fetchApi<Overview>("/api/overview"),
        fetchApi<TimelinePoint[]>("/api/timeline?limit=48"),
        fetchApi<Hotspot[]>("/api/hotspots"),
        fetchApi<CongestedRoad[]>("/api/congested-roads"),
        fetchApi<Trip[]>("/api/trips?limit=16"),
        fetchApi<MapLayers>("/api/map-layers"),
        fetchApi<RoadClassStat[]>("/api/road-classes"),
      ]);

      const nextState = {
        overview: overview.data,
        timeline: timeline.data,
        hotspots: hotspots.data,
        congestedRoads: congestedRoads.data,
        trips: trips.data,
        mapLayers: mapLayers.data,
        roadClasses: roadClasses.data,
        source: overview.source ?? "database",
      };
      setState(nextState);
      setSelectedHotspot((current) =>
        nextState.hotspots.find((hotspot) => hotspot.id === current.id) ??
        nextState.hotspots[0] ??
        current,
      );
      setSelectedTrip((current) =>
        nextState.trips.find((trip) => trip.tripId === current.tripId) ??
        nextState.trips[0] ??
        current,
      );
    } catch {
      setState(initialState);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      setMounted(true);
      setNow(new Date());
    }, 80);
    const initialRefresh = window.setTimeout(() => {
      void refresh();
    }, 0);
    const refreshTimer = window.setInterval(refresh, 60_000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(mountTimer);
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);

  const statusData = useMemo(() => {
    const fast = state.trips.filter((trip) => trip.avgSpeedKmh >= 35).length;
    const slow = state.trips.filter((trip) => trip.avgSpeedKmh < 18).length;
    const mid = Math.max(0, state.trips.length - fast - slow);
    return [
      { name: "快速", value: fast },
      { name: "中速", value: mid },
      { name: "慢速", value: slow },
    ];
  }, [state.trips]);

  const congestionData = useMemo(() => {
    const high = state.congestedRoads.filter((road) => road.level === "高").length;
    const mid = state.congestedRoads.filter((road) => road.level === "中").length;
    const low = state.congestedRoads.filter((road) => road.level === "低").length;
    return [
      { name: "高拥堵", value: high },
      { name: "中拥堵", value: mid },
      { name: "低拥堵", value: low },
    ];
  }, [state.congestedRoads]);

  const roadBarData = useMemo(
    () =>
      state.congestedRoads.slice(0, 5).map((road) => ({
        name: `R${road.roadId}`,
        频次: road.count,
        超速: Math.max(1, Math.round(road.count * 0.62)),
        绕行: Math.max(1, Math.round(road.count * 0.42)),
      })),
    [state.congestedRoads],
  );

  const orderTrend = useMemo(
    () =>
      state.trips.map((trip, index) => ({
        name: `T${index + 1}`,
        value: Math.max(4, Math.round(trip.pointCount + trip.distanceKm * 3)),
      })),
    [state.trips],
  );

  const serviceBars = useMemo(
    () =>
      state.hotspots.slice(0, 5).map((hotspot) => ({
        name: hotspot.name,
        value: hotspot.intensity,
      })),
    [state.hotspots],
  );

  const metricCards = [
    {
      label: "活跃车辆数",
      value: state.overview.activeVehicles,
      unit: "辆",
      icon: CarTaxiFront,
    },
    {
      label: "总采样轨迹",
      value: state.overview.totalTrips,
      unit: "条",
      icon: GitBranch,
    },
    {
      label: "估算总里程",
      value: state.overview.totalMileageKm,
      unit: "km",
      icon: Route,
    },
    {
      label: "平均车速",
      value: state.overview.avgSpeedKmh,
      unit: "km/h",
      icon: Gauge,
    },
    {
      label: "路网健康度",
      value: state.overview.roadHealthScore,
      unit: "/100",
      icon: Activity,
    },
    {
      label: "热点区块",
      value: state.hotspots.length,
      unit: "个",
      icon: MapPinned,
    },
    {
      label: "拥堵路段",
      value: state.congestedRoads.length,
      unit: "条",
      icon: Flame,
    },
    {
      label: "复盘样本",
      value: state.trips.length,
      unit: "条",
      icon: Navigation,
    },
  ];

  return (
    <main className="dashboard-bg scanlines min-h-screen overflow-x-hidden px-3 py-4 text-cyan-50 sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1820px] flex-col gap-4">
        <header className="relative flex min-h-16 items-center justify-center">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-400/20" />
          <h1 className="relative rounded-md border border-cyan-400/45 bg-cyan-400/10 px-5 py-3 text-center text-xl font-bold tracking-[0.18em] text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.28)] sm:text-2xl">
            哈尔滨网约车交通流量数据总览
          </h1>
          <div className="absolute right-0 top-0 hidden rounded-sm border border-cyan-400/45 bg-cyan-500/10 px-4 py-2 text-right font-code text-xs text-cyan-100 md:block">
            <div>{mounted ? formatDate(now) : "----/--/--"}</div>
            <div className="text-base font-bold text-cyan-50">
              {mounted ? formatTime(now) : "--:--:--"}
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1fr_2fr_1fr]">
          <Panel title="状态占比" icon={Activity}>
            <DonutChart
              data={statusData}
              colors={ringColors}
              centerLabel="复盘样本"
              centerValue={state.trips.length}
              mounted={mounted}
            />
            <LegendList data={statusData} colors={ringColors} suffix="条" />
          </Panel>

          <Panel
            title="核心指标"
            icon={Zap}
            action={
              mounted
                ? `更新 ${formatTime(new Date(state.overview.updatedAt || now))}`
                : "更新 --:--:--"
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((metric) => (
                <MetricTile key={metric.label} {...metric} />
              ))}
            </div>
          </Panel>

          <Panel title="系统占比" icon={Database}>
            <DonutChart
              data={congestionData}
              colors={congestionColors}
              centerLabel="拥堵路段"
              centerValue={state.congestedRoads.length}
              mounted={mounted}
            />
            <LegendList data={congestionData} colors={congestionColors} suffix="条" />
          </Panel>
        </section>

        <Panel title="趋势图" icon={TrendingUp} action={`最近 ${state.timeline.length} 个小时点`}>
          <div className="h-[280px]">
            {mounted ? (
              <MeasuredChart>
                {(width, height) => (
                <AreaChart width={width} height={height} data={state.timeline} margin={{ top: 16, right: 18, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trafficTrend" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.48} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(125, 211, 252, 0.08)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "#7dbbd0", fontSize: 12 }} interval={getTimelineTickInterval(state.timeline.length, width)} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="activeVehicles" name="覆盖路段" stroke="#22e6f5" strokeWidth={3} fill="url(#trafficTrend)" dot={{ r: 4, fill: "#22e6f5" }} />
                </AreaChart>
                )}
              </MeasuredChart>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
        </Panel>

        <Panel title="服务数据" icon={BarChart3} action="TOP 5">
          <div className="h-[190px]">
            {mounted ? (
              <MeasuredChart>
                {(width, height) => (
                <BarChart width={width} height={height} data={serviceBars} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={84} tick={{ fill: "#86c7d8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTip />} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                    {serviceBars.map((_, index) => (
                      <Cell key={index} fill={["#22d3ee", "#5dd3ff", "#70a5ff", "#8b7dff", "#a77cff"][index] ?? "#22d3ee"} />
                    ))}
                  </Bar>
                </BarChart>
                )}
              </MeasuredChart>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
        </Panel>

        <Panel title="区域车流与轨迹地图" icon={MapPinned}>
          <DynamicTrafficMap
            layers={state.mapLayers}
            selectedTripId={selectedTrip?.tripId}
            onSelectTrip={setSelectedTrip}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-200/55">
            <div className="flex gap-4">
              <TrafficLegend color="#ffd21f" label="高流量" />
              <TrafficLegend color="#17e9ff" label="中流量" />
              <TrafficLegend color="#6df0a6" label="低流量" />
            </div>
            <span>点击轨迹切换关注</span>
          </div>
        </Panel>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="服务统计" icon={Layers3} action="路段频次">
            <div className="h-[280px]">
              {mounted ? (
                <MeasuredChart>
                  {(width, height) => (
                  <BarChart width={width} height={height} data={roadBarData} margin={{ top: 18, right: 18, left: -18, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(125, 211, 252, 0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#7dbbd0", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTip />} />
                    <Bar dataKey="频次" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="超速" fill="#ffd21f" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="绕行" fill="#ff72c8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                  )}
                </MeasuredChart>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
            <div className="flex gap-4 text-xs text-cyan-100/70">
              <TrafficLegend color="#22d3ee" label="频次" />
              <TrafficLegend color="#ffd21f" label="超速" />
              <TrafficLegend color="#ff72c8" label="绕行" />
            </div>
          </Panel>

          <Panel title="订单趋势" icon={AreaIcon} action={`${state.trips.length} 条`}>
            <div className="h-[280px]">
              {mounted ? (
                <MeasuredChart>
                  {(width, height) => (
                  <AreaChart width={width} height={height} data={orderTrend} margin={{ top: 18, right: 18, left: -18, bottom: 8 }}>
                    <defs>
                      <linearGradient id="orderTrend" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#b36cff" stopOpacity={0.52} />
                        <stop offset="100%" stopColor="#b36cff" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(125, 211, 252, 0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#7dbbd0", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="value" stroke="#c77dff" strokeWidth={3} fill="url(#orderTrend)" dot={{ r: 4, fill: "#c77dff" }} />
                  </AreaChart>
                  )}
                </MeasuredChart>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel title="热点分析" icon={Navigation}>
            <Tabs defaultValue="hotspots">
              <TabsList className="mb-4 border border-cyan-400/25 bg-cyan-500/10">
                <TabsTrigger value="hotspots">热点 Top5</TabsTrigger>
                <TabsTrigger value="roads">拥堵路段</TabsTrigger>
              </TabsList>
              <TabsContent value="hotspots">
                <HotspotTable
                  hotspots={state.hotspots}
                  selectedId={selectedHotspot?.id}
                  onSelect={setSelectedHotspot}
                />
                <FocusLine>
                  关注：{selectedHotspot?.name}，强度 {selectedHotspot?.intensity}
                </FocusLine>
              </TabsContent>
              <TabsContent value="roads">
                <RoadTable roads={state.congestedRoads} />
                <FocusLine>拥堵识别：按拥堵指数、通过频次、平均速度综合排序</FocusLine>
              </TabsContent>
            </Tabs>
          </Panel>

          <Panel title="数量变化" icon={Sparkles} action="策略建议">
            <div className="space-y-3">
              <Advice icon={Radar} title="潮汐模式回放">
                增加 24 小时自动回放动画，展示高峰波动与热区漂移。
              </Advice>
              <Advice icon={Crosshair} title="异常事件雷达">
                按急刹车、长时低速、异常绕行自动打点，形成事件热层。
              </Advice>
              <Advice icon={LocateFixed} title="一键策略模拟">
                模拟公交增开与信号配时优化后，对拥堵指数预估对比。
              </Advice>
            </div>
          </Panel>
        </section>

        <Panel title="轨迹复盘" icon={Satellite} action={`共 ${state.trips.length} 条`}>
          <ScrollArea className="w-full">
            <div className="grid min-w-[980px] gap-3 pb-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {state.trips.map((trip) => (
                <button
                  key={trip.tripId}
                  type="button"
                  onClick={() => setSelectedTrip(trip)}
                  className={`metric-tile h-[136px] rounded-sm p-3 text-left transition hover:border-cyan-300/60 ${
                    selectedTrip?.tripId === trip.tripId ? "border-cyan-300/75 bg-cyan-500/10" : ""
                  }`}
                >
                  <h3 className="truncate text-sm font-bold text-cyan-50">设备 {trip.devid}</h3>
                  <div className="mt-3 space-y-1 font-code text-[11px] text-cyan-200/55">
                    <div>{trip.startTime}</div>
                    <div>{trip.endTime}</div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <span className="font-code text-base font-bold text-cyan-50">{trip.distanceKm}</span>
                    <Badge className={speedBadgeClass(trip.speedLevel)}>{trip.speedLevel}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <FocusLine>
            当前关注：{selectedTrip?.devid}，里程 {selectedTrip?.distanceKm} km
          </FocusLine>
        </Panel>

        <footer className="flex flex-wrap items-center justify-between gap-3 pb-3 text-xs text-cyan-200/45">
          <div className="flex items-center gap-2">
            <Database className="size-3.5" />
            数据源：{state.source}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="border-cyan-400/45 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-400/20"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            刷新数据
          </Button>
        </footer>
      </div>
    </main>
  );
}

async function fetchApi<T>(url: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<ApiEnvelope<T>>;
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-frame rounded-sm p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold tracking-[0.16em] text-cyan-300">
          <Icon className="size-4" />
          <span>{title}</span>
        </div>
        {action ? (
          <Badge variant="outline" className="border-cyan-400/35 bg-cyan-500/10 font-code text-cyan-200/70">
            {action}
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit: string;
  icon: LucideIcon;
}) {
  return (
    <div className="metric-tile min-h-[104px] rounded-sm p-4">
      <div className="flex items-center gap-2 text-xs text-cyan-200/55">
        <Icon className="size-3.5 text-cyan-400" />
        {label}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-code text-3xl font-bold leading-none text-cyan-50 drop-shadow-[0_0_10px_rgba(103,232,249,0.45)]">
          {value}
        </span>
        <span className="pb-1 text-xs text-cyan-200/55">{unit}</span>
      </div>
    </div>
  );
}

function DonutChart({
  data,
  colors,
  centerValue,
  centerLabel,
  mounted,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  centerValue: number;
  centerLabel: string;
  mounted: boolean;
}) {
  return (
    <div className="relative mx-auto h-[180px] w-[180px]">
      {mounted ? (
        <MeasuredChart>
          {(width, height) => (
          <PieChart width={width} height={height}>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={56}
              outerRadius={78}
              paddingAngle={2}
              stroke="transparent"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={colors[index] ?? "#22d3ee"} />
              ))}
            </Pie>
          </PieChart>
          )}
        </MeasuredChart>
      ) : (
        <div className="absolute inset-4 rounded-full border-[18px] border-cyan-400/25" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full text-center">
        <span className="font-code text-2xl font-bold text-cyan-50">{centerValue}</span>
        <span className="mt-1 text-[11px] text-cyan-200/55">{centerLabel}</span>
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="h-full w-full rounded-sm border border-cyan-400/10 bg-cyan-500/[0.03]" />
  );
}

function getTimelineTickInterval(pointCount: number, chartWidth: number) {
  const maxTicks = Math.max(8, Math.floor(chartWidth / 56));
  return Math.max(0, Math.ceil(pointCount / maxTicks) - 1);
}

function MeasuredChart({
  children,
}: {
  children: (width: number, height: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      });
    };

    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {size.width > 1 && size.height > 1 ? (
        children(size.width, size.height)
      ) : (
        <ChartPlaceholder />
      )}
    </div>
  );
}

function LegendList({
  data,
  colors,
  suffix,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  suffix: string;
}) {
  return (
    <div className="mt-2 space-y-2">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center justify-between text-xs text-cyan-100/75">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: colors[index] }} />
            {item.name}
          </span>
          <span className="font-code">{item.value} {suffix}</span>
        </div>
      ))}
    </div>
  );
}

function TrafficLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-cyan-400/35 bg-[#061426]/95 px-3 py-2 text-xs text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
      {label ? <div className="mb-1 font-code text-cyan-200/70">{label}</div> : null}
      {payload.map((item) => (
        <div key={String(item.name ?? item.dataKey)} className="flex items-center justify-between gap-5">
          <span>{item.name ?? item.dataKey}</span>
          <span className="font-code" style={{ color: item.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function HotspotTable({
  hotspots,
  selectedId,
  onSelect,
}: {
  hotspots: Hotspot[];
  selectedId?: string;
  onSelect: (hotspot: Hotspot) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead className="text-left text-cyan-200/55">
          <tr>
            <th className="py-3 font-semibold">热点</th>
            <th className="py-3 font-semibold">坐标</th>
            <th className="py-3 font-semibold">强度</th>
            <th className="py-3 text-right font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          {hotspots.slice(0, 5).map((hotspot) => (
            <tr
              key={hotspot.id}
              className={`border-t border-cyan-400/15 ${hotspot.id === selectedId ? "bg-cyan-500/10" : ""}`}
            >
              <td className="py-3 font-semibold text-cyan-50">{hotspot.name}</td>
              <td className="font-code text-cyan-200/65">{hotspot.lat.toFixed(3)}, {hotspot.lon.toFixed(3)}</td>
              <td className="font-code font-bold text-cyan-50">{hotspot.intensity}</td>
              <td className="py-2 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelect(hotspot)}
                  className="h-8 border-cyan-400/45 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-400/20"
                >
                  查看
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoadTable({ roads }: { roads: CongestedRoad[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {roads.slice(0, 10).map((road) => (
        <div key={road.roadId} className="metric-tile flex items-center justify-between rounded-sm p-3">
          <div>
            <div className="font-code font-bold text-cyan-50">R{road.roadId}</div>
            <div className="mt-1 text-xs text-cyan-200/55">均速 {road.avgSpeedKmh ?? 0} km/h</div>
          </div>
          <Badge className={road.level === "高" ? "bg-red-500/20 text-red-200" : road.level === "中" ? "bg-yellow-400/20 text-yellow-200" : "bg-emerald-400/20 text-emerald-100"}>
            {road.level}拥堵 · {road.count}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function Advice({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="metric-tile rounded-sm p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-cyan-50">
        <Icon className="size-4 text-cyan-300" />
        {title}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-cyan-200/60">{children}</p>
    </div>
  );
}

function FocusLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-sm border border-cyan-400/20 bg-[#061426]/80 px-3 py-2 text-xs text-cyan-200/65">
      {children}
    </div>
  );
}

function speedBadgeClass(level: Trip["speedLevel"]) {
  if (level === "缓行") return "bg-yellow-400/20 text-yellow-200";
  if (level === "平稳") return "bg-cyan-400/15 text-cyan-100";
  return "bg-emerald-400/20 text-emerald-100";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
