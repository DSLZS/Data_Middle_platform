-- dwm_od_flow_daily — OD 流量统计
-- 血缘: dwd_taxi_trip + dwd_taxi_road_segment (首段 + 尾段)
-- 粒度: 一个 OD 对一天
-- 聚合指标: 流量、不同出租车数、平均时长、平均距离
-- ────────────────────────────────────────────────────────────
INSERT INTO dwm_od_flow_daily (
    origin_road_id, dest_road_id, stat_date, flow_count, unique_taxis, avg_duration_s, avg_distance_m
)
SELECT
    first_seg.road_id, last_seg.road_id, tr.trip_date,
    COUNT(*), COUNT(DISTINCT tr.devid), AVG(tr.trip_duration_s), AVG(tr.route_distance_m)
FROM dwd_taxi_trip tr
         JOIN dwd_taxi_road_segment first_seg
              ON first_seg.trip_id = tr.trip_id AND first_seg.seq = 1
         JOIN dwd_taxi_road_segment last_seg
              ON last_seg.trip_id = tr.trip_id
                  AND last_seg.seq = (SELECT MAX(seq) FROM dwd_taxi_road_segment WHERE trip_id = tr.trip_id)
GROUP BY first_seg.road_id, last_seg.road_id, tr.trip_date
    ON DUPLICATE KEY UPDATE
         flow_count     = VALUES(flow_count),
         unique_taxis   = VALUES(unique_taxis),
         avg_duration_s = VALUES(avg_duration_s),
         avg_distance_m = VALUES(avg_distance_m),
         etl_date       = CURDATE();
