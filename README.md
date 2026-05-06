# Data_Middle_platform
## 一、分层规范
| 层 | 职责 | 原则 |
|----|------|------|
| **DIM** | 静态维度表 | 不随业务变化, 一次加载或少量更新 |
| **DWD** | 明细数据层 | 维度退化 + 轻度取数 + 关联, **不做聚合**, 一行 = 一个业务事件 |
| **DWM** | 中间聚合层 | 轻度聚合, 按主题 GROUP BY, 一个表 = 一个分析主题 |
| **DWS** | 汇总宽表层 | 多维汇总, 面向分析场景, 一个表 = 一个报表 |

## 二、各层表清单
### 原始表
#### 1. bfmap_ways — 道路路段表（路网拓扑核心）
| 字段 | 类型 | 说明 |
|------|------|------|
| gid | bigint PK | 全局唯一标识 |
| osm_id | bigint | OSM 原始 ID |
| class_id | integer | 道路分类 ID |
| source | bigint | 起点节点 ID（关联 nodes 表） |
| target | bigint | 终点节点 ID（关联 nodes 表） |
| length | double precision | 路段长度 |
| reverse | double precision | 正反向权重 |
| maxspeed_forward | integer | 正向限速 |
| maxspeed_backward | integer | 反向限速 |
| priority | double precision | 路由优先级 |
| geom | geometry(LineString,4326) | 路段几何线 |

用途：哈尔滨城市路网拓扑数据，描述道路路段及其连接关系，是路径规划和地图匹配的基础路网。
#### 2. nodes — 地图节点表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 节点 ID |
| version | integer | 版本号 |
| user_id | bigint | 用户 ID |
| tstamp | timestamp | 时间戳 |
| changeset_id | bigint | 变更集 ID |
| tags | hstore | 节点标签（键值对） |
| geom | geometry(Point,4326) | 节点经纬度坐标 |

用途：存储路网中的节点（交叉口、转折点等），是 bfmap_ways 的 source/target 关联基础。
#### 3. trips — 出租车轨迹表（业务数据核心）
| 字段 | 类型 | 说明 |
|------|------|------|
| file_name | text | 原始 jld 文件名（如 trips_150103.jld2） |
| lon | Real[] | GPS 经度数组（按时间顺序） |
| lat | Real[] | GPS 纬度数组 |
| tms | Real[] | GPS 时间戳数组（Unix 时间） |
| devid | text | 出租车 ID |
| roads | integer[] | 匹配到的道路 ID 数组（bfmap_ways.gid） |
| time | integer[] | 匹配后各道路点的时间戳 |
| frac | Real[] | 在路段上的距离比例 |
| route | integer[] | 完整路径的道路 ID 序列 |
| route_heading | text[] | 行驶方向（forward/backward） |
| route_geom | text[] | 路段几何线字符串 |

用途：出租车 GPS 轨迹数据，已经过**地图匹配（Map Matching）**处理，将原始 GPS 点匹配到路网上。每条记录是一条完整的出租车行程。
#### 4. ways — OSM 道路原始表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 道路 ID |
| version | integer | 版本号 |
| user_id | bigint | 用户 ID |
| tstamp | timestamp | 时间戳 |
| changeset_id | bigint | 变更集 ID |
| tags | hstore | 道路属性标签 |
| nodes | bigint[] | 节点数组 |

用途：OSM 原始道路数据，存储完整的道路几何（由多个节点组成）。
#### 5. way_nodes — 道路-节点关联表
| 字段 | 类型 | 说明 |
|------|------|------|
| way_id | bigint | 道路 ID |
| node_id | bigint | 节点 ID |
| sequence_id | integer | 节点在道路中的顺序 |

用途：道路与节点的多对多关系映射。
#### 6. 其他辅助表
users — OSM 用户信息  
relations — OSM 关系数据  
relation_members — 关系成员  
schema_info — 数据库版本信息  
temp_ways — 临时道路表

nodes ←→ bfmap_ways：路段的起点/终点由节点构成
bfmap_ways → trips：轨迹数据通过 roads/route 字段关联到路段
nodes → way_nodes → ways：OSM 原始道路的节点序列

---

### DIM 层 (静态维度表)

| 表名 | 粒度 | 来源 | 行数 | 说明 |
|------|------|------|------|------|
| `dim_date` | 一天一行 | 生成序列 | 365 | 日期维度 (2015 全年) |
| `dim_road_segment` | 一个路段一行 | `bfmap_ways` 映射 | 2,049 | 道路路段维度 (class_name 退化, 起终点经纬度) |
| `dim_taxi` | 一辆车一行 | `dwd_taxi_trip` 提取 | ~数千辆 | 出租车维度 (首次/末次出现日期) |

> DIM 层是**静态维度**, 不随每日业务数据变化。`dim_taxi` 从 DWD 提取出租车标签, `dim_road_segment` 从 `bfmap_ways` 映射 (含 class_name 退化 + 起终点经纬度提取)。

### DWD 层 (明细数据层)

| 表名 | 粒度 | 来源 | 行数估算 | 说明 |
|------|------|------|----------|------|
| `dwd_taxi_trip` | 一次行程一行 | `trips` 解析 | ~35 万行 | 行程主表 (数组 → 标量, 维度退化) |
| `dwd_taxi_gps_point` | 一个 GPS 点一行 | `trips.lon/lat/tms` 展开 | ~千万级 | GPS 点明细 (数组展开为行级, 计算距离/速度) |
| `dwd_taxi_road_segment` | 一个路段经过一行 | `trips.roads/frac/time` 展开 | ~千万级 | 路段经过明细 (数组展开 + 关联 dim_road_segment 做维度退化) |

> DWD 层**不做聚合**。所有表都是一行 = 一个业务事件:
> - `dwd_taxi_trip`: 一行 = 一次行程
> - `dwd_taxi_gps_point`: 一行 = 一个 GPS 采样点
> - `dwd_taxi_road_segment`: 一行 = 一次行程经过一个路段
>
> 维度退化: `dwd_taxi_road_segment` 冗余了 `class_id`, `class_name`, `length_m`, `maxspeed_forward`, `source_node`, `target_node` 等维度属性, 避免后续聚合时再 JOIN。

---

### DWM 层 (中间聚合层)

| 表名 | 粒度 | 来源 | 说明 |
|------|------|------|------|
| `dwm_taxi_daily_stats` | 一辆车一天 | `dwd_taxi_trip` + `dwd_taxi_gps_point` + `dwd_taxi_road_segment` | 出租车日统计 (里程、时长、速度、高峰时段) |
| `dwm_road_segment_daily` | 一个路段一天 | `dwd_taxi_road_segment` (已含维度退化) | 路段日统计 (通过次数、速度、拥堵指数) |
| `dwm_od_flow_daily` | 一个 OD 对一天 | `dwd_taxi_trip` + `dwd_taxi_road_segment` (首尾路段) | OD 流量矩阵 |
| `dwm_road_hourly_speed` | 一个路段一天一个时段 | `dwd_taxi_road_segment` (已含维度退化) | 路段时段速度 (含 P50/P85 分位) |

---

### DWS 层 (汇总宽表层)

| 表名 | 粒度 | 来源 | 分析场景 |
|------|------|------|----------|
| `dws_taxi_overview` | 一天一行 | `dwm_taxi_daily_stats` | 城市出租车运营总览 (日报) |
| `dws_road_traffic` | 一天一个时段 | `dwm_road_hourly_speed` | 道路拥堵总览 (早晚高峰分析) |
| `dws_city_traffic_monthly` | 一月一行 | `dwm_taxi_daily_stats` + `dwm_od_flow_daily` | 城市交通月报 (月度趋势) |
| `dws_road_class_analysis` | 一天一个道路等级 | `dwd_taxi_road_segment` (直接从 DWD 取) | 不同等级道路通行效率对比 |
| `dws_hotspot_analysis` | 一天一个路段 | `dwm_road_segment_daily` + `dim_road_segment` | 热点区域分析 (拥堵热点/流量热点) |

---

## 表之间的血缘关系
```
┌─────────────────────────────────────────────────────────────────┐
│                      ODS 层 (原始表)                             │
│  trips (~35万行)  │  bfmap_ways (2049行)  │  nodes / users ...  │
└────────┬──────────┬───────────────────┬────────────────────────┘
         │          │                   │
         ▼          ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DIM 层 (静态维度)                            │
│                                                                 │
│  generate_series(2015全年) ──→ dim_date                         │
│  bfmap_ways ──映射(class_name退化)──→ dim_road_segment           │
│  dwd_taxi_trip ──提取标签──→ dim_taxi                            │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DWD 层 (明细层 — 不做聚合)                      │
│                                                                 │
│  trips ──解析数组──→ dwd_taxi_trip (行程主表)                    │
│            ├─ 展开 lon/lat/tms ──→ dwd_taxi_gps_point            │
│            ├─ 展开 roads/frac/time ──→ dwd_taxi_road_segment     │
│            │         └─ 关联 dim_road_segment (维度退化)           │
│            └─ 关联 dim_road_segment (子查询计算总距离)             │
│                                                                 │
│  维度退化字段 (dwd_taxi_road_segment):                           │
│    road_class_id, road_class_name, road_length_m,                │
│    maxspeed_forward, source_node, target_node                     │
└────────┬──────────┬──────────┬─────────────────────────────────┘
         │          │          │
         ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DWM 层 (轻度聚合 — 按主题)                       │
│                                                                 │
│  dwd_taxi_trip + gps_point + road_segment                      │
│       ── GROUP BY devid, trip_date ──→ dwm_taxi_daily_stats    │
│                                                                 │
│  dwd_taxi_road_segment (已含维度退化)                            │
│       ── GROUP BY road_id, trip_date ──→ dwm_road_segment_daily│
│                                                                 │
│  dwd_taxi_trip + road_segment (首段 seq=1, 尾段 seq=MAX)        │
│       ── GROUP BY origin, dest, trip_date ──→ dwm_od_flow_daily│
│                                                                 │
│  dwd_taxi_road_segment (已含维度退化)                            │
│       ── GROUP BY road_id, trip_date, hour ──→ dwm_road_hourly │
│                                                  _speed         │
└────────┬──────────┬──────────┬─────────────────────────────────┘
         │          │          │
         ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DWS 层 (宽表 — 面向分析)                        │
│                                                                 │
│  dwm_taxi_daily_stats                                          │
│       ── GROUP BY stat_date ──→ dws_taxi_overview              │
│                                                                 │
│  dwm_road_hourly_speed                                         │
│       ── GROUP BY stat_date, stat_hour ──→ dws_road_traffic    │
│                                                                 │
│  dwm_taxi_daily_stats + dwm_od_flow_daily                      │
│       ── GROUP BY YYYY-MM ──→ dws_city_traffic_monthly         │
│                                                                 │
│  dwd_taxi_road_segment (直接从 DWD 取, 不经过 DWM)              │
│       ── GROUP BY trip_date, class_id ──→ dws_road_class_      │
│                                              analysis           │
│                                                                 │
│  dwm_road_segment_daily + dim_road_segment                     │
│       ── 每路段判断 ──→ dws_hotspot_analysis                   │
└─────────────────────────────────────────────────────────────────┘

```
## 三、ODS → DWD 取数逻辑详解

### 3.1 trips 表字段格式

原始 `trips` 表的数组字段存储为 **文本字符串**, 不是 PostgreSQL 原生数组, 需要解析:

| 字段 | 原始格式 | 解析方式 |
|------|----------|----------|
| `lon / lat` | `"[126.606, 126.605, ...]"` | 去 `[]` → 按 `,` 分割 → 转 DOUBLE |
| `tms` | `"[1.420243229e9, ...]"` | 同上, 科学计数法直接转 DOUBLE → FROM_UNIXTIME |
| `roads` | `"[4525, 688, 688, ...]"` | 同上 → 转 BIGINT |
| `time` | `"[1420214429, 1420214459, ...]"` | 同上 → FROM_UNIXTIME |
| `frac` | `"Real[1, 0.082013, ...]"` | 去 `Real[` 前缀和 `]` 后缀 → 同上 |
| `route_heading` | `"["forward", "backward", ...]"` | 去 `[]` → 分割 → 去每个元素的 `"` |
| `route_geom` | `"LINESTRING (...)"` | 保持原文本, 不解析 |

### 3.2 三个解析函数

| 函数 | 作用 |
|------|------|
| `arr_get(txt, pos)` | 取文本数组第 pos 个元素 (1-based) |
| `arr_len(txt)` | 返回文本数组元素个数 |
| `haversine_distance(lat1, lon1, lat2, lon2)` | 两点间球面距离 (米) |

### 3.3 各 DWD 表的取数逻辑

**dwd_taxi_trip (行程主表)**
- 从 `trips` 逐行读取
- 解析各数组字段, 取首尾元素得到起点/终点
- 通过 `roads[i]` 关联 `dim_road_segment.length_m × frac` 计算总距离 (子查询, 非聚合)
- `file_name` 提取日期: `trips_150103.jld2` → `2015-01-03`
- 生成自增 `trip_id` 作为主键
- **不做聚合**, 一行 = trips 一行

**dwd_taxi_gps_point (GPS 点明细)**
- 从 `trips` 逐行读取, 用 `_seq` 展开 (1 ~ GPS 点数)
- 每个 GPS 点计算: 到下一点的距离 (Haversine)、时间间隔、瞬时速度
- 关联 `dwd_taxi_trip` 获取 `trip_id`
- **不做聚合**, 一行 = 一个 GPS 采样点

**dwd_taxi_road_segment (路段经过明细)**
- 从 `trips` 逐行读取, 用 `_seq` 展开 (1 ~ 路段数)
- 每个路段关联 `dim_road_segment` 获取 class_id、length、限速、节点
- 计算: 实际行驶距离 = `frac × length`, 路段速度 = 距离/时间
- 关联 `dwd_taxi_trip` 获取 `trip_id`
- **不做聚合**, 一行 = 一次行程经过一个路段
- **维度退化**: 冗余 class_id, class_name, road_length_m, maxspeed_forward, source_node, target_node

---

## 四、DWD → DWM 取数逻辑

**dwm_taxi_daily_stats (出租车日统计)**
- 源: `dwd_taxi_trip` (主) LEFT JOIN `dwd_taxi_gps_point` + `dwd_taxi_road_segment`
- 聚合: `GROUP BY devid, trip_date`
- 指标: 行程次数、总里程、总时长、平均/最大/最小速度、GPS 点数、经过路段数、唯一路段数、高峰时段

**dwm_road_segment_daily (路段日统计)**
- 源: `dwd_taxi_road_segment` (已含维度退化字段, 无需再 JOIN dim)
- 聚合: `GROUP BY road_id, trip_date`
- 指标: 通过次数、不同出租车数、平均/最小/最大速度、平均通过时间、总距离、拥堵指数 (实际速度/限速)、最拥堵时段

**dwm_od_flow_daily (OD 流量)**
- 源: `dwd_taxi_trip` JOIN `dwd_taxi_road_segment` (首段 seq=1) JOIN `dwd_taxi_road_segment` (尾段 seq=MAX)
- 聚合: `GROUP BY origin_road_id, dest_road_id, trip_date`
- 指标: 流量、不同出租车数、平均时长、平均距离

**dwm_road_hourly_speed (路段时段速度)**
- 源: `dwd_taxi_road_segment` (已含维度退化字段)
- 聚合: `GROUP BY road_id, trip_date, HOUR(arrive_time)`
- 指标: 通过次数、平均速度、P50/P85 分位速度、拥堵指数

---

## 五、DWM → DWS 取数逻辑

**dws_taxi_overview (运营总览)**
- 源: `dwm_taxi_daily_stats`
- 聚合: `GROUP BY stat_date`
- 从 DWM 的米/秒 → 转换为 km/h
- 场景: 日报运营总览
  **dws_road_traffic (道路拥堵)**
- 源: `dwm_road_hourly_speed`
- 聚合: `GROUP BY stat_date, stat_hour`
- 统计拥堵/畅通路段数
- 场景: 早晚高峰拥堵分析

**dws_city_traffic_monthly (城市月报)**
- 源: `dwm_taxi_daily_stats` + `dwm_od_flow_daily` (子查询取热门 OD)
- 聚合: `GROUP BY DATE_FORMAT(stat_date, '%Y-%m')`
- 场景: 月度趋势分析

**dws_road_class_analysis (道路等级分析)**
- 源: `dwd_taxi_road_segment` (直接从 DWD 取, 不经过 DWM)
- 聚合: `GROUP BY trip_date, road_class_id`
- 场景: 不同等级道路通行效率对比

**dws_hotspot_analysis (热点分析)**
- 源: `dwm_road_segment_daily` + `dim_road_segment`
- 逻辑: 每路段判断是否热点 (通过次数 > 历史日均 2 倍 → 流量热点; 拥堵指数 < 0.5 → 拥堵热点)
- 场景: 拥堵热点识别、流量热点发现

---

## 六、关键设计决策

1. **ODS 不建表** — 直接用 `trips` / `bfmap_ways` / `nodes`, 避免数据冗余
2. **DIM 层存放静态维度** — `dim_date` 预生成, `dim_road_segment` 从 `bfmap_ways` 映射, `dim_taxi` 从 DWD 提取标签
3. **DWD 层不做聚合** — 一行 = 一个业务事件, 只做数组展开、维度退化、字段计算
4. **维度退化在 DWD** — `dwd_taxi_road_segment` 冗余 `class_id`, `class_name`, `length_m`, `maxspeed_forward` 等, 避免 DWM/DWS 反复 JOIN
5. **DWM 层按主题聚合** — 每个表对应一个分析主题 (出租车日统计、路段日统计、OD 流量、时段速度)
6. **DWS 层面向分析** — 每个表对应一个报表场景, 直接供 BI 查询
7. **距离计算** — GPS 点用 Haversine 公式; 路段用 `frac × length`
8. **速度过滤** — 聚合时 `WHERE speed > 0 AND speed < 200` 排除异常值
9. **增量更新** — 所有 DWM/DWS 表用 `ON DUPLICATE KEY UPDATE` 支持重跑



