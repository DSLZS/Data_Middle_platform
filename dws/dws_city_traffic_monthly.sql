-- ────────────────────────────────────────────────────────────
-- dws_city_traffic_monthly — 城市交通月报宽表
-- 血缘: dwm_taxi_daily_stats + dwm_od_flow_daily
-- 粒度: 一月一行, 城市级月度指标
-- 分析场景: 月度趋势分析、环比对比
-- ────────────────────────────────────────────────────────────
INSERT INTO dws_city_traffic_monthly (
    stat_month, active_taxis, total_trips, total_distance_km,
    avg_daily_trips, avg_daily_distance_km, avg_trip_distance_km,
    avg_trip_duration_min, city_avg_speed_kmh, top_origin_road, top_dest_road
)
SELECT
    DATE_FORMAT(stat_date, '%Y-%m'),
    COUNT(DISTINCT devid),
    SUM(trip_count),
    SUM(total_distance_m) / 1000.0,
    SUM(trip_count) / COUNT(DISTINCT stat_date),
    SUM(total_distance_m) / NULLIF(COUNT(DISTINCT stat_date), 0) / 1000.0,
    SUM(total_distance_m) / NULLIF(SUM(trip_count), 0) / 1000.0,
    SUM(total_duration_s) / NULLIF(SUM(trip_count), 0) / 60.0,
    AVG(CASE WHEN avg_speed_kmh > 0 THEN avg_speed_kmh END),
    (SELECT origin_road_id FROM dwm_od_flow_daily od
     WHERE DATE_FORMAT(od.stat_date, '%Y-%m') = DATE_FORMAT(ds.stat_date, '%Y-%m')
     GROUP BY origin_road_id ORDER BY SUM(flow_count) DESC LIMIT 1),
    (SELECT dest_road_id FROM dwm_od_flow_daily od
     WHERE DATE_FORMAT(od.stat_date, '%Y-%m') = DATE_FORMAT(ds.stat_date, '%Y-%m')
     GROUP BY dest_road_id ORDER BY SUM(flow_count) DESC LIMIT 1)
FROM dwm_taxi_daily_stats ds
GROUP BY DATE_FORMAT(stat_date, '%Y-%m')
ON DUPLICATE KEY UPDATE
    active_taxis           = VALUES(active_taxis),
    total_trips            = VALUES(total_trips),
    total_distance_km      = VALUES(total_distance_km),
    avg_daily_trips        = VALUES(avg_daily_trips),
    avg_daily_distance_km  = VALUES(avg_daily_distance_km),
    avg_trip_distance_km   = VALUES(avg_trip_distance_km),
    avg_trip_duration_min  = VALUES(avg_trip_duration_min),
    city_avg_speed_kmh     = VALUES(city_avg_speed_kmh),
    top_origin_road        = VALUES(top_origin_road),
    top_dest_road          = VALUES(top_dest_road),
    etl_date               = CURDATE();
