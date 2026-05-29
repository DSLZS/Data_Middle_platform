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
    t.stat_month,
    t.active_taxis,
    t.total_trips,
    t.total_distance_km,
    t.avg_daily_trips,
    t.avg_daily_distance_km,
    t.avg_trip_distance_km,
    t.avg_trip_duration_min,
    t.city_avg_speed_kmh,
    COALESCE(origin.top_road, 0) AS top_origin_road,
    COALESCE(dest.top_road, 0) AS top_dest_road
FROM (
         SELECT
             DATE_FORMAT(stat_date, '%Y-%m') AS stat_month,
             COUNT(DISTINCT devid) AS active_taxis,
             SUM(trip_count) AS total_trips,
             SUM(total_distance_m) / 1000.0 AS total_distance_km,
             SUM(trip_count) / COUNT(DISTINCT stat_date) AS avg_daily_trips,
             SUM(total_distance_m) / NULLIF(COUNT(DISTINCT stat_date), 0) / 1000.0 AS avg_daily_distance_km,
             SUM(total_distance_m) / NULLIF(SUM(trip_count), 0) / 1000.0 AS avg_trip_distance_km,
             SUM(total_duration_s) / NULLIF(SUM(trip_count), 0) / 60.0 AS avg_trip_duration_min,
             AVG(CASE WHEN avg_speed_kmh > 0 THEN avg_speed_kmh END) AS city_avg_speed_kmh
         FROM dwm_taxi_daily_stats ds
         GROUP BY DATE_FORMAT(stat_date, '%Y-%m')
     ) t
         LEFT JOIN (
    SELECT
        DATE_FORMAT(stat_date, '%Y-%m') AS stat_month,
        origin_road_id AS top_road,
        SUM(flow_count) AS total_flow,
        ROW_NUMBER() OVER (PARTITION BY DATE_FORMAT(stat_date, '%Y-%m') ORDER BY SUM(flow_count) DESC) AS rn
    FROM dwm_od_flow_daily
    GROUP BY DATE_FORMAT(stat_date, '%Y-%m'), origin_road_id
) origin ON t.stat_month = origin.stat_month AND origin.rn = 1
         LEFT JOIN (
    SELECT
        DATE_FORMAT(stat_date, '%Y-%m') AS stat_month,
        dest_road_id AS top_road,
        SUM(flow_count) AS total_flow,
        ROW_NUMBER() OVER (PARTITION BY DATE_FORMAT(stat_date, '%Y-%m') ORDER BY SUM(flow_count) DESC) AS rn
    FROM dwm_od_flow_daily
    GROUP BY DATE_FORMAT(stat_date, '%Y-%m'), dest_road_id
) dest ON t.stat_month = dest.stat_month AND dest.rn = 1
    ON DUPLICATE KEY UPDATE
         active_taxis = VALUES(active_taxis),
         total_trips = VALUES(total_trips),
         total_distance_km = VALUES(total_distance_km),
         avg_daily_trips = VALUES(avg_daily_trips),
         avg_daily_distance_km = VALUES(avg_daily_distance_km),
         avg_trip_distance_km = VALUES(avg_trip_distance_km),
         avg_trip_duration_min = VALUES(avg_trip_duration_min),
         city_avg_speed_kmh = VALUES(city_avg_speed_kmh),
         top_origin_road = VALUES(top_origin_road),
         top_dest_road = VALUES(top_dest_road),
         etl_date = CURDATE();