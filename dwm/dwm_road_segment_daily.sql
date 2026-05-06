-- dwm_taxi_daily_stats — 出租车日统计
-- 血缘: dwd_taxi_trip + dwd_taxi_gps_point + dwd_taxi_road_segment
-- 粒度: 一辆车一天
-- 聚合指标: 行程次数、总里程、总时长、速度统计、GPS 点数、路段数、高峰时段
-- ────────────────────────────────────────────────────────────
INSERT INTO dwm_road_segment_daily (
    road_id, stat_date, pass_count, unique_taxis,
    avg_speed_kmh, min_speed_kmh, max_speed_kmh, avg_duration_s,
    total_distance_m, congestion_level, peak_hour
)
SELECT
    rs.road_id, rs.trip_date,
    COUNT(*),
    COUNT(DISTINCT rs.devid),
    AVG(CASE WHEN rs.segment_speed > 0 AND rs.segment_speed < 200 THEN rs.segment_speed END),
    MIN(CASE WHEN rs.segment_speed > 0 THEN rs.segment_speed END),
    MAX(CASE WHEN rs.segment_speed > 0 AND rs.segment_speed < 200 THEN rs.segment_speed END),
    AVG(CASE WHEN rs.segment_dur_s > 0 THEN rs.segment_dur_s END),
    SUM(rs.travel_dist_m),
    -- 拥堵指数 = 实际平均速度 / 限速 (maxspeed_forward 已在 DWD 维度退化)
    AVG(CASE WHEN rs.segment_speed > 0 AND rs.segment_speed < 200 THEN rs.segment_speed END)
        / NULLIF(AVG(rs.maxspeed_forward), 0),
    (SELECT HOUR(arrive_time) FROM dwd_taxi_road_segment rs2
WHERE rs2.road_id = rs.road_id AND rs2.trip_date = rs.trip_date AND rs2.segment_speed > 0
GROUP BY HOUR(arrive_time) ORDER BY AVG(rs2.segment_speed) ASC LIMIT 1)
FROM dwd_taxi_road_segment rs
GROUP BY rs.road_id, rs.trip_date
ON DUPLICATE KEY UPDATE
    pass_count       = VALUES(pass_count),
    unique_taxis     = VALUES(unique_taxis),
    avg_speed_kmh    = VALUES(avg_speed_kmh),
    min_speed_kmh    = VALUES(min_speed_kmh),
    max_speed_kmh    = VALUES(max_speed_kmh),
    avg_duration_s   = VALUES(avg_duration_s),
    total_distance_m = VALUES(total_distance_m),
    total_distance_m = VALUES(total_distance_m),
    congestion_level = VALUES(congestion_level),
    peak_hour        = VALUES(peak_hour),
    etl_date         = CURDATE();
