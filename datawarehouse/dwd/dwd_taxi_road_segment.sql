-- ────────────────────────────────────────────────────────────
-- dwd_taxi_road_segment — 路段经过明细表
-- 血缘: trips → 展开 roads/frac/time → 行级路段
--       关联 dim_road_segment 做维度退化
-- 粒度: 一次行程经过一个路段一行
-- 不做聚合, 只做:
--   - 数组展开为行级路段
--   - 维度退化: class_id, class_name, length, maxspeed, source/target 节点
--   - 标签展开: travel_dist_m, segment_speed
-- ────────────────────────────────────────────────────────────
INSERT INTO dwd_taxi_road_segment (
    trip_id, devid, trip_date, seq, road_id, road_class_id, road_class_name,
    heading, arrive_time, frac, road_length_m, travel_dist_m,
    next_arrive_time, segment_dur_s, segment_speed, source_node, target_node, maxspeed_forward
)
SELECT
    tr.trip_id, t.devid, tr.trip_date, s.n,
    arr_get(t.roads, s.n) + 0,
    rc.class_id, rc.class_name,
    CASE WHEN s.n <= arr_len(t.route_heading)
             THEN TRIM(REPLACE(REPLACE(
                                       SUBSTRING_INDEX(SUBSTRING_INDEX(
                                                               TRIM(BOTH '[]' FROM TRIM(REPLACE(t.route_heading, '"', ''))), ',', s.n), ',', -1),
                                       '"', ''), '"', '')) END,
    CASE WHEN s.n <= arr_len(t.`time`) THEN FROM_UNIXTIME(arr_get(t.`time`, s.n) + 0) END,
    CASE WHEN s.n <= arr_len(t.frac) THEN arr_get(t.frac, s.n) + 0 END,
    rc.length_m,
    CASE WHEN s.n <= arr_len(t.frac) THEN (arr_get(t.frac, s.n) + 0) * rc.length_m END,
    CASE WHEN s.n < arr_len(t.`time`) THEN FROM_UNIXTIME(arr_get(t.`time`, s.n + 1) + 0) END,
    CASE WHEN s.n < arr_len(t.`time`) THEN
             TIMESTAMPDIFF(SECOND,
                     FROM_UNIXTIME(arr_get(t.`time`, s.n) + 0),
                     FROM_UNIXTIME(arr_get(t.`time`, s.n + 1) + 0))
        END,
    CASE WHEN s.n < arr_len(t.`time`) AND s.n <= arr_len(t.frac) AND rc.length_m > 0 THEN
                 ((arr_get(t.frac, s.n) + 0) * rc.length_m / 1000.0)
                 / NULLIF(TIMESTAMPDIFF(SECOND,
                                  FROM_UNIXTIME(arr_get(t.`time`, s.n) + 0),
                                  FROM_UNIXTIME(arr_get(t.`time`, s.n + 1) + 0)) / 3600.0, 0)
        END,
    rc.source_node_id, rc.target_node_id, rc.maxspeed_forward
FROM trips t
         JOIN dwd_taxi_trip tr ON t.devid = tr.devid AND t.file_name = tr.file_name
         JOIN _seq s ON s.n <= arr_len(t.roads)
         LEFT JOIN dim_road_segment rc ON rc.road_id = (arr_get(t.roads, s.n) + 0)
WHERE t.devid IS NOT NULL
  AND t.tms IS NOT NULL
  AND TRIM(t.tms) != ''
  AND TRIM(t.tms) != '[]';
