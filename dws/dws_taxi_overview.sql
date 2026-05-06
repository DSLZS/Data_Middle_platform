-- ────────────────────────────────────────────────────────────
-- dws_taxi_overview — 出租车运营总览宽表
-- 血缘: dwm_taxi_daily_stats
-- 粒度: 一天一行, 城市级运营指标
-- 分析场景: 日报/周报/月报的运营总览
-- ────────────────────────────────────────────────────────────
INSERT INTO dws_taxi_overview (
    stat_date, active_taxis, total_trips, total_distance_km, total_duration_h,
    avg_trip_distance_km, avg_trip_duration_min, avg_speed_kmh,
    peak_hour_trips, peak_hour
)
SELECT
    stat_date,
    COUNT(DISTINCT devid),
    SUM(trip_count),
    SUM(total_distance_m) / 1000.0,
    SUM(total_duration_s) / 3600.0,
    SUM(total_distance_m) / NULLIF(SUM(trip_count), 0) / 1000.0,
    SUM(total_duration_s) / NULLIF(SUM(trip_count), 0) / 60.0,
    AVG(CASE WHEN avg_speed_kmh > 0 THEN avg_speed_kmh END),
    (SELECT SUM(trip_count) FROM dwm_taxi_daily_stats ds2
     WHERE ds2.stat_date = ds.stat_date
       AND ds2.peak_hour = (
         SELECT peak_hour FROM dwm_taxi_daily_stats ds3
         WHERE ds3.stat_date = ds.stat_date
         GROUP BY peak_hour ORDER BY SUM(trip_count) DESC LIMIT 1)),
    (SELECT peak_hour FROM dwm_taxi_daily_stats ds4
WHERE ds4.stat_date = ds.stat_date
GROUP BY peak_hour ORDER BY SUM(trip_count) DESC LIMIT 1)
FROM dwm_taxi_daily_stats ds
GROUP BY stat_date
ON DUPLICATE KEY UPDATE
    active_taxis          = VALUES(active_taxis),
    total_trips           = VALUES(total_trips),
    total_distance_km     = VALUES(total_distance_km),
    total_duration_h      = VALUES(total_duration_h),
    avg_trip_distance_km  = VALUES(avg_trip_distance_km),
    avg_trip_duration_min = VALUES(avg_trip_duration_min),
    avg_speed_kmh         = VALUES(avg_speed_kmh),
    peak_hour_trips       = VALUES(peak_hour_trips),
    peak_hour             = VALUES(peak_hour),
    etl_date              = CURDATE();
