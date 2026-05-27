-- 血缘: trips → 解析数组 → 维度退化
-- 粒度: 一次行程一行
-- 不做聚合, 只做:
--   - 数组文本 → 标量字段
--   - 维度退化: 关联 dim_road_segment 获取 class_name
--   - 标签展开: 从 file_name 提取 trip_date
-- ────────────────────────────────────────────────────────────
INSERT INTO dwd_taxi_trip (
    devid, trip_date, file_name, start_time, end_time,
    start_lon, start_lat, end_lon, end_lat,
    gps_points_count, road_segments_count,
    route_distance_m, trip_duration_s, avg_speed_kmh, max_speed_kmh, route_geom
)
SELECT
    t.devid,
    STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(t.file_name, '_', -1), '.', 1), '%y%m%d'),
    t.file_name,
    FROM_UNIXTIME(arr_get(t.tms, 1) + 0),
    FROM_UNIXTIME(arr_get(t.tms, arr_len(t.tms)) + 0),
    arr_get(t.lon, 1) + 0, arr_get(t.lat, 1) + 0,
    arr_get(t.lon, arr_len(t.lon)) + 0, arr_get(t.lat, arr_len(t.lat)) + 0,
    arr_len(t.tms),
    arr_len(t.roads),
    -- 维度退化: 关联 dim_road_segment, 用 frac × length 计算总距离 (子查询, 非聚合)
    (SELECT SUM(rc.length_m * (arr_get(t.frac, s.n) + 0))
     FROM seq s
              JOIN dim_road_segment rc ON rc.road_id = (arr_get(t.roads, s.n) + 0)
     WHERE s.n <= arr_len(t.roads)),
    TIMESTAMPDIFF(SECOND,
            FROM_UNIXTIME(arr_get(t.tms, 1) + 0),
            FROM_UNIXTIME(arr_get(t.tms, arr_len(t.tms)) + 0)),
    NULL, NULL,
    t.route_geom
FROM trips t
WHERE t.devid IS NOT NULL
  AND t.tms IS NOT NULL
  AND TRIM(t.tms) != ''
  AND TRIM(t.tms) != '[]';

-- ────────────────────────────────────────────────────────────
-- 回写行程主表 — 从路段明细补全字段 (非聚合, 是字段回写)
-- 说明: dwd_taxi_trip 的 route_distance_m 等字段在 INSERT 时用子查询计算,
--       这里用路段明细的 SUM/AVG 做精确回写 (替代子查询, 性能更好)
--       注意: 这是字段补全, 不是 DWD 层的聚合逻辑
-- ────────────────────────────────────────────────────────────
UPDATE dwd_taxi_trip tr
    JOIN (
    SELECT trip_id,
    SUM(travel_dist_m) AS total_distance,
    AVG(CASE WHEN segment_speed > 0 AND segment_speed < 200 THEN segment_speed END) AS avg_speed,
    MAX(CASE WHEN segment_speed > 0 AND segment_speed < 200 THEN segment_speed END) AS max_speed
    FROM dwd_taxi_road_segment
    GROUP BY trip_id
    ) rs ON tr.trip_id = rs.trip_id
    SET tr.route_distance_m = rs.total_distance,
        tr.avg_speed_kmh    = rs.avg_speed,
        tr.max_speed_kmh    = rs.max_speed;
