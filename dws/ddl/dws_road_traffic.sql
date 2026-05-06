-- ────────────────────────────────────────────────────────────
-- dws_road_traffic — 道路拥堵总览宽表
-- 血缘: dwm_road_hourly_speed
-- 粒度: 一天一个时段, 城市级拥堵指标
-- 分析场景: 早晚高峰拥堵分析
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dws_road_traffic;
CREATE TABLE dws_road_traffic (
      stat_date        DATE,
      stat_hour        INT,
      total_roads      INT,
      avg_congestion   DOUBLE,
      max_congestion   DOUBLE,
      min_congestion   DOUBLE,
      congested_roads  INT,
      smooth_roads     INT,
      avg_speed_kmh    DOUBLE,
      etl_date         DATE DEFAULT (CURRENT_DATE),
      PRIMARY KEY (stat_date, stat_hour)
);
