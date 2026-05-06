-- ────────────────────────────────────────────────────────────
-- dws_road_traffic — 道路拥堵总览宽表
-- 血缘: dwm_road_hourly_speed
-- 粒度: 一天一个时段, 城市级拥堵指标
-- 分析场景: 早晚高峰拥堵分析
-- ────────────────────────────────────────────────────────────
INSERT INTO dws_road_traffic (
    stat_date, stat_hour, total_roads, avg_congestion,
    max_congestion, min_congestion, congested_roads, smooth_roads, avg_speed_kmh
)
SELECT
    stat_date, stat_hour,
    COUNT(DISTINCT road_id),
    AVG(CASE WHEN congestion_level > 0 THEN congestion_level END),
    MAX(CASE WHEN congestion_level > 0 THEN congestion_level END),
    MIN(CASE WHEN congestion_level > 0 THEN congestion_level END),
    COUNT(DISTINCT CASE WHEN congestion_level < 0.5 AND congestion_level > 0 THEN road_id END),
    COUNT(DISTINCT CASE WHEN congestion_level > 0.8 THEN road_id END),
    AVG(CASE WHEN avg_speed_kmh > 0 AND avg_speed_kmh < 200 THEN avg_speed_kmh END)
FROM dwm_road_hourly_speed
GROUP BY stat_date, stat_hour
    ON DUPLICATE KEY UPDATE
        total_roads      = VALUES(total_roads),
        avg_congestion   = VALUES(avg_congestion),
        max_congestion   = VALUES(max_congestion),
        min_congestion   = VALUES(min_congestion),
        congested_roads  = VALUES(congested_roads),
        smooth_roads     = VALUES(smooth_roads),
        avg_speed_kmh    = VALUES(avg_speed_kmh),
        etl_date         = CURDATE();
