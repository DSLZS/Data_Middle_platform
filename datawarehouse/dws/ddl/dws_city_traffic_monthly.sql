-- ────────────────────────────────────────────────────────────
-- dws_city_traffic_monthly — 城市交通月报宽表
-- 血缘: dwm_taxi_daily_stats + dwm_od_flow_daily
-- 粒度: 一月一行, 城市级月度指标
-- 分析场景: 月度趋势分析、环比对比
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS dws_city_traffic_monthly;
CREATE TABLE dws_city_traffic_monthly (
    stat_month             VARCHAR(7) PRIMARY KEY,
    active_taxis           INT,
    total_trips            INT,
    total_distance_km      DOUBLE,
    avg_daily_trips        DOUBLE,
    avg_daily_distance_km  DOUBLE,
    avg_trip_distance_km   DOUBLE,
    avg_trip_duration_min  DOUBLE,
    city_avg_speed_kmh     DOUBLE,
    top_origin_road        BIGINT,
    top_dest_road          BIGINT,
    etl_date               DATE DEFAULT (CURRENT_DATE)
);
