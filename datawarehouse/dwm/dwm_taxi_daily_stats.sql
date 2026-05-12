-- dwm_taxi_daily_stats — 出租车日统计
-- 血缘: dwd_taxi_trip + dwd_taxi_gps_point + dwd_taxi_road_segment
-- 粒度: 一辆车一天
-- 聚合指标: 行程次数、总里程、总时长、速度统计、GPS 点数、路段数、高峰时段
-- ────────────────────────────────────────────────────────────
INSERT INTO dwm_taxi_daily_stats (
    devid, stat_date, trip_count, total_distance_m, total_duration_s,
    avg_speed_kmh, max_speed_kmh, min_speed_kmh, gps_point_count,
    road_segment_count, unique_roads, peak_hour
)
SELECT
    tr.devid, tr.trip_date,
    COUNT(DISTINCT tr.trip_id),
    SUM(tr.route_distance_m),
    SUM(tr.trip_duration_s),
    AVG(CASE WHEN tr.avg_speed_kmh > 0 AND tr.avg_speed_kmh < 200 THEN tr.avg_speed_kmh END),
    MAX(CASE WHEN tr.max_speed_kmh > 0 AND tr.max_speed_kmh < 200 THEN tr.max_speed_kmh END),
    MIN(CASE WHEN tr.avg_speed_kmh > 0 AND tr.avg_speed_kmh < 200 THEN tr.avg_speed_kmh END),
    COUNT(DISTINCT CONCAT(tr.trip_id, '_', gp.seq)),
    COUNT(DISTINCT CONCAT(tr.trip_id, '_', rs.seq)),
    COUNT(DISTINCT rs.road_id),
    (SELECT HOUR(gps_time) FROM dwd_taxi_gps_point gp2
WHERE gp2.devid = tr.devid AND gp2.trip_date = tr.trip_date
GROUP BY HOUR(gps_time) ORDER BY COUNT(*) DESC LIMIT 1)
FROM dwd_taxi_trip tr
    LEFT JOIN dwd_taxi_gps_point gp ON gp.trip_id = tr.trip_id AND gp.devid = tr.devid
    LEFT JOIN dwd_taxi_road_segment rs ON rs.trip_id = tr.trip_id AND rs.devid = tr.devid
GROUP BY tr.devid, tr.trip_date
ON DUPLICATE KEY UPDATE
    trip_count         = VALUES(trip_count),
    total_distance_m   = VALUES(total_distance_m),
    total_duration_s   = VALUES(total_duration_s),
    avg_speed_kmh      = VALUES(avg_speed_kmh),
    max_speed_kmh      = VALUES(max_speed_kmh),
    min_speed_kmh      = VALUES(min_speed_kmh),
    gps_point_count    = VALUES(gps_point_count),
    road_segment_count = VALUES(road_segment_count),
    unique_roads       = VALUES(unique_roads),
    peak_hour          = VALUES(peak_hour),
    etl_date           = CURDATE();
