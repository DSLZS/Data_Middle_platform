-- ────────────────────────────────────────────────────────────
-- dws_taxi_overview — 出租车运营总览宽表
-- 血缘: dwm_taxi_daily_stats
-- 粒度: 一天一行, 城市级运营指标
-- 分析场景: 日报/周报/月报的运营总览
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dws_taxi_overview;
CREATE TABLE dws_taxi_overview (
    stat_date             DATE PRIMARY KEY,
    active_taxis          INT,
    total_trips           INT,
    total_distance_km     DOUBLE,
    total_duration_h      DOUBLE,
    avg_trip_distance_km  DOUBLE,
    avg_trip_duration_min DOUBLE,
    avg_speed_kmh         DOUBLE,
    peak_hour_trips       INT,
    peak_hour             INT,
    etl_date              DATE DEFAULT (CURRENT_DATE)
);
