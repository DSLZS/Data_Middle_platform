# 交通运行态势看板

`traffic-panel` 是一个基于 Next.js 的哈尔滨网约车交通流量数据看板。页面通过 7 个 API 聚合 MySQL 数仓结果，优先读取缓存，接口异常或数据缺失时自动降级到本地兜底数据，保证演示环境可用。

## 启动方式

```bash
npm install
npm run dev
```

打开 `http://localhost:3000` 查看看板。

## 数据取值总链路

1. 前端页面 `src/components/dashboard/traffic-dashboard.tsx` 每 60 秒并发请求 `/api/overview`、`/api/timeline`、`/api/hotspots`、`/api/congested-roads`、`/api/trips`、`/api/map-layers`、`/api/road-classes`。
2. API 路由调用 `src/lib/traffic/service.ts` 中的 `getOverview`、`getTimeline` 等服务函数。
3. 服务层通过 `src/lib/traffic/mysql.ts` 查询 MySQL。连接优先使用 Cloudflare Hyperdrive，其次使用 `MYSQL_URL`、`MYSQL_USERNAME`、`MYSQL_PASSWORD` 或小写同名环境变量。
4. 查询结果进入 `cachedJson`。Cloudflare 环境下优先写入 D1 表 `api_cache`，本地环境使用进程内存缓存。
5. MySQL 未配置、查询失败、结果为空或字段无法解析时，返回 `src/lib/traffic/fallback-data.ts` 中的兜底数据。

## API 与缓存

| API | 服务函数 | 缓存 Key | TTL | 主要用途 |
| --- | --- | --- | --- | --- |
| `/api/overview` | `getOverview()` | `overview:v1` | 300 秒 | 核心指标卡片 |
| `/api/timeline` | `getTimeline()` | `timeline:v2` | 600 秒 | 24 小时趋势图 |
| `/api/hotspots?limit=5` | `getHotspots(limit)` | `hotspots:v1:{limit}` | 900 秒 | 热点 Top5、服务数据 |
| `/api/congested-roads?limit=10` | `getCongestedRoads(limit)` | `congested-roads:v1:{limit}` | 900 秒 | 拥堵路段、拥堵占比、服务统计 |
| `/api/trips?limit=16` | `getTrips(limit)` | `trips:v1:{limit}` | 1800 秒 | 轨迹复盘、订单趋势、速度占比 |
| `/api/map-layers` | `getMapLayers()` | `map-layers:v2` | 900 秒 | 地图热力点、区域点、轨迹线 |
| `/api/road-classes` | `getRoadClasses()` | `road-classes:v1` | 1800 秒 | 道路等级分析数据 |

## 看板数据取值方式

| 页面模块 / 字段 | 前端状态字段 | API | 数仓来源 | 取值与计算方式 | 兜底来源 |
| --- | --- | --- | --- | --- | --- |
| 活跃车辆数 | `overview.activeVehicles` | `/api/overview` | `dws_taxi_overview.active_taxis` | 取最新 `stat_date` 记录；空值或 0 时用兜底值 | `fallbackOverview.activeVehicles` |
| 总采样轨迹 | `overview.totalTrips` | `/api/overview` | `dws_taxi_overview.total_trips` | 取最新 `stat_date` 记录；空值或 0 时用兜底值 | `fallbackOverview.totalTrips` |
| 估算总里程 | `overview.totalMileageKm` | `/api/overview` | `dws_taxi_overview.total_distance_km` | 取最新 `stat_date` 记录，保留 2 位小数 | `fallbackOverview.totalMileageKm` |
| 平均车速 | `overview.avgSpeedKmh` | `/api/overview` | `dws_taxi_overview.avg_speed_kmh` | 取最新 `stat_date` 记录，保留 2 位小数 | `fallbackOverview.avgSpeedKmh` |
| 路网健康度 | `overview.roadHealthScore` | `/api/overview` | 派生自平均车速 | `58 + avgSpeedKmh * 1.45`，结果限制在 45 到 96 | `fallbackOverview.roadHealthScore` |
| 早晚高峰小时 | `overview.peakHour` | `/api/overview` | `dws_taxi_overview.peak_hour` | 取最新 `stat_date` 记录 | `fallbackOverview.peakHour` |
| 数据更新时间 | `overview.updatedAt` | `/api/overview` | 服务端当前时间 | 接口生成时写入 `new Date().toISOString()` | `fallbackOverview.updatedAt` |
| 24 小时趋势横轴 | `timeline[].hour` | `/api/timeline` | `dws_road_traffic.stat_date`、`stat_hour` | 按 `stat_date DESC, stat_hour DESC` 取 24 条后反转；同批跨日期时显示 `MM/DD HH:00` | `fallbackTimeline[].hour` |
| 趋势覆盖路段 | `timeline[].activeVehicles` | `/api/timeline` | `dws_road_traffic.total_roads` | 用总路段数表示趋势图中的覆盖路段，最小值为 1 | `fallbackTimeline[].activeVehicles` |
| 趋势平均速度 | `timeline[].avgSpeed` | `/api/timeline` | `dws_road_traffic.avg_speed_kmh` | 保留 2 位小数 | `fallbackTimeline[].avgSpeed` |
| 趋势拥堵度 | `timeline[].congestion` | `/api/timeline` | `avg_congestion`、`congested_roads`、`total_roads` | 优先使用 `avg_congestion` 并限制到 1；缺失时用 `congested_roads / total_roads`；仍缺失为 0.38 | `fallbackTimeline[].congestion` |
| 热点名称 | `hotspots[].name` | `/api/hotspots` | `dws_hotspot_analysis.hotspot_type`、`road_id` | 优先使用热点类型；缺失时生成 `热点-{road_id}` | `fallbackHotspots[].name` |
| 热点坐标 | `hotspots[].lat/lon` | `/api/hotspots` | `dim_road_segment.start_lon/start_lat/end_lon/end_lat` | 关联道路维表；起终点都存在时取中点；只存在一个点时取该点；会自动校正经纬度顺序 | `fallbackHotspots[].lat/lon` |
| 热点强度 | `hotspots[].intensity` | `/api/hotspots` | `dws_hotspot_analysis.pass_count` | `max(1, round(log10(pass_count)))` | `fallbackHotspots[].intensity` |
| 热点通过次数 | `hotspots[].passCount` | `/api/hotspots` | `dws_hotspot_analysis.pass_count` | 用于地图区域流量、服务数据排序 | `fallbackHotspots[].passCount` |
| 热点唯一车辆数 | `hotspots[].uniqueTaxis` | `/api/hotspots` | `dws_hotspot_analysis.unique_taxis` | 用于地图区域活跃车辆数 | `fallbackHotspots[].uniqueTaxis` |
| 拥堵路段编号 | `congestedRoads[].roadId` | `/api/congested-roads` | `dws_hotspot_analysis.road_id` | 取最新 `stat_date`，按拥堵等级和通过次数排序 | `fallbackCongestedRoads[].roadId` |
| 拥堵频次 | `congestedRoads[].count` | `/api/congested-roads` | `dws_hotspot_analysis.pass_count` | 前端服务统计直接使用；“超速”“绕行”为展示派生值 | `fallbackCongestedRoads[].count` |
| 拥堵等级 | `congestedRoads[].level` | `/api/congested-roads` | `congestion_level`、`avg_speed_kmh` | `congestion_level >= 0.65` 或速度 `<24` 为高；`>=0.35` 或速度 `<38` 为中；其他为低 | `fallbackCongestedRoads[].level` |
| 道路等级 | `roadClasses[]` | `/api/road-classes` | `dws_road_class_analysis` | 取最新 `stat_date`，按 `total_pass DESC` 取前 8 条 | `fallbackRoadClasses` |
| 轨迹编号与设备 | `trips[].tripId/devid` | `/api/trips` | `dwd_taxi_trip.trip_id/devid` | 按 `trip_id DESC` 取带 `route_geom` 的记录 | `fallbackTrips` |
| 轨迹点 | `trips[].path` | `/api/trips` | `dwd_taxi_trip.route_geom` | 解析 `LINESTRING(lon lat, ...)`；过滤非哈尔滨范围点；去除相邻重复点；最多保留 120 个点 | `fallbackTrips[].path` |
| 轨迹里程 | `trips[].distanceKm` | `/api/trips` | `route_distance_m` 或 `route_geom` | 优先 `route_distance_m / 1000`；缺失时用 Haversine 根据轨迹点计算 | `fallbackTrips[].distanceKm` |
| 轨迹均速 | `trips[].avgSpeedKmh` | `/api/trips` | `avg_speed_kmh` 或里程/时长 | 优先数仓均速；缺失时用 `distance / trip_duration_s * 3600`；速度异常时用估算函数修正到合理范围 | `fallbackTrips[].avgSpeedKmh` |
| 速度等级 | `trips[].speedLevel` | `/api/trips` | 派生自轨迹均速 | `<18` 为缓行，`18-35` 为平稳，`>=35` 为畅通 | `fallbackTrips[].speedLevel` |
| 起止时间 | `trips[].startTime/endTime` | `/api/trips` | `trip_date`、`start_time`、`end_time` | 格式化为 `YYYY/MM/DD HH:mm:ss`，缺失时间时只显示日期 | `fallbackTrips[].startTime/endTime` |
| 地图区域点 | `mapLayers.zones` | `/api/map-layers` | 热点接口派生 | `flow` 取 `passCount`，缺失时取 `intensity * 5`；`activeVehicles` 取 `uniqueTaxis`，缺失时按强度估算 | `fallbackMapLayers.zones` |
| 地图热力点 | `mapLayers.heatPoints` | `/api/map-layers` | 热点接口派生 | 第一热点强度为 1，其余为 `max(0.12, intensity / 10)` | `fallbackMapLayers.heatPoints` |
| 地图边界 | `mapLayers.bounds` | `/api/map-layers` | 热点坐标 + 轨迹点派生 | 取所有点的最小/最大经纬度；无点时使用哈尔滨默认边界 | `fallbackMapLayers.bounds` |
| 地图轨迹线 | `mapLayers.trajectories` | `/api/map-layers` | 轨迹接口派生 | 直接复用 `/api/trips?limit=16` 的轨迹集合 | `fallbackMapLayers.trajectories` |
| 状态占比 | `statusData` | 前端派生 | `trips[].avgSpeedKmh` | 快速 `>=35`、慢速 `<18`、中速为其余数量 | 由兜底轨迹派生 |
| 系统占比 | `congestionData` | 前端派生 | `congestedRoads[].level` | 统计高、中、低拥堵路段数量 | 由兜底拥堵路段派生 |
| 服务统计 | `roadBarData` | 前端派生 | `congestedRoads[].count` | 频次为 `count`；超速为 `count * 0.62`；绕行为 `count * 0.42`，最小为 1 | 由兜底拥堵路段派生 |
| 订单趋势 | `orderTrend` | 前端派生 | `trips[].pointCount`、`distanceKm` | `max(4, round(pointCount + distanceKm * 3))` | 由兜底轨迹派生 |
| 服务数据 Top5 | `serviceBars` | 前端派生 | `hotspots[].intensity` | 取前 5 个热点强度 | 由兜底热点派生 |

## 主要数仓表

| 表名 | 作用 | 被哪些接口使用 |
| --- | --- | --- |
| `dws_taxi_overview` | 出租车总体统计，承载核心指标 | `/api/overview` |
| `dws_road_traffic` | 按日期、小时统计路网运行状态 | `/api/timeline` |
| `dws_hotspot_analysis` | 热点与拥堵路段分析 | `/api/hotspots`、`/api/congested-roads`、`/api/map-layers` |
| `dim_road_segment` | 道路起终点坐标维表 | `/api/hotspots`、`/api/map-layers` |
| `dws_road_class_analysis` | 道路等级聚合统计 | `/api/road-classes` |
| `dwd_taxi_trip` | 单车行程明细和轨迹线 | `/api/trips`、`/api/map-layers` |

## 降级与演示数据

- 所有 API 返回结构为 `{ success: true, data, source }`，`source` 可能是 `database`、`cache` 或 `fallback`。
- 服务函数外层使用 `resilient` 包装，遇到 MySQL 未配置、SQL 执行失败、D1 不可用等情况时返回兜底数据。
- 兜底数据集中在 `src/lib/traffic/fallback-data.ts`，包含核心指标、24 小时趋势、热点、拥堵路段、道路等级、轨迹和地图图层。
- D1 缓存表结构位于 `schema/d1-cache.sql`，可通过 `npm run d1:init` 初始化。
- 可运行 `npm run d1:seed` 将当前 API 结果固化为远端 D1 缓存，脚本默认从 `http://127.0.0.1:3000` 拉取，也可通过 `PANEL_BASE_URL` 指定地址。

## 相关文件

- `src/components/dashboard/traffic-dashboard.tsx`：前端看板布局、API 请求、前端派生指标。
- `src/components/dashboard/traffic-map.tsx`：地图底图、热力点、区域点、轨迹线渲染。
- `src/app/api/*/route.ts`：API 路由入口。
- `src/lib/traffic/service.ts`：数仓查询、字段映射、派生公式、降级逻辑。
- `src/lib/traffic/geo.ts`：经纬度校正、LINESTRING 解析、Haversine 里程计算、地图边界计算。
- `src/lib/traffic/cache.ts`：D1 / 内存缓存。
- `src/lib/traffic/mysql.ts`：MySQL / Hyperdrive 连接。
