-- ==================================================================================
-- 1. rpt_taxi_daily_report - 出租车日报表
-- 用途: 每日运营情况监控
-- ==================================================================================
INSERT INTO rpt_taxi_daily_report (
    report_date, active_taxis, total_trips, total_distance_km, total_duration_h,
    avg_trip_distance_km, avg_trip_duration_min, avg_speed_kmh,
    peak_hour, peak_hour_trips, day_of_week, is_weekend
)
SELECT
    stat_date,
    active_taxis,
    total_trips,
    total_distance_km,
    total_duration_h,
    avg_trip_distance_km,
    avg_trip_duration_min,
    avg_speed_kmh,
    peak_hour,
    peak_hour_trips,
    DAYOFWEEK(stat_date) AS day_of_week,
    CASE WHEN DAYOFWEEK(stat_date) IN (1, 7) THEN 1 ELSE 0 END AS is_weekend
FROM dws_taxi_overview
    ON DUPLICATE KEY UPDATE
         active_taxis = VALUES(active_taxis),
         total_trips = VALUES(total_trips),
         total_distance_km = VALUES(total_distance_km),
         total_duration_h = VALUES(total_duration_h),
         avg_trip_distance_km = VALUES(avg_trip_distance_km),
         avg_trip_duration_min = VALUES(avg_trip_duration_min),
         avg_speed_kmh = VALUES(avg_speed_kmh),
         peak_hour = VALUES(peak_hour),
         peak_hour_trips = VALUES(peak_hour_trips),
         day_of_week = VALUES(day_of_week),
         is_weekend = VALUES(is_weekend),
         etl_date = CURDATE();