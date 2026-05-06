-- dwm_road_hourly_speed — 路段时段速度统计
-- 血缘: dwd_taxi_road_segment (已含 maxspeed_forward 维度退化)
-- 粒度: 一个路段一天一个时段
-- 聚合指标: 通过次数、平均速度、P50/P85 分位速度、拥堵指数
-- ────────────────────────────────────────────────────────────
-- 基础聚合: 平均速度 + 拥堵指数
INSERT INTO dwm_road_hourly_speed (
    road_id, stat_date, stat_hour, pass_count,
    avg_speed_kmh, p50_speed_kmh, p85_speed_kmh, congestion_level
)
SELECT
    road_id, stat_date, stat_hour, pass_count,
    avg_speed_kmh, NULL, NULL,
    congestion_level
FROM (
         SELECT
             rs.road_id,
             rs.trip_date AS stat_date,
             HOUR(rs.arrive_time) AS stat_hour,
             COUNT(*) AS pass_count,
             AVG(CASE WHEN rs.segment_speed > 0 AND rs.segment_speed < 200 THEN rs.segment_speed END) AS avg_speed_kmh,
             AVG(CASE WHEN rs.segment_speed > 0 AND rs.segment_speed < 200 THEN rs.segment_speed END)
             / NULLIF(AVG(rs.maxspeed_forward), 0) AS congestion_level
         FROM dwd_taxi_road_segment rs
         WHERE rs.arrive_time IS NOT NULL
         GROUP BY rs.road_id, rs.trip_date, HOUR(rs.arrive_time)
     ) agg
    ON DUPLICATE KEY UPDATE
         pass_count       = VALUES(pass_count),
         avg_speed_kmh    = VALUES(avg_speed_kmh),
         congestion_level = VALUES(congestion_level),
         etl_date         = CURDATE();

-- P50/P85 分位速度 (用窗口函数计算后 UPDATE)
UPDATE dwm_road_hourly_speed dst
    JOIN (
    SELECT road_id, stat_date, stat_hour,
    MAX(CASE WHEN pct <= 0.50 THEN segment_speed END) AS p50,
    MAX(CASE WHEN pct <= 0.85 THEN segment_speed END) AS p85
    FROM (
    SELECT road_id, trip_date AS stat_date, HOUR(arrive_time) AS stat_hour,
    segment_speed,
    PERCENT_RANK() OVER (
    PARTITION BY road_id, trip_date, HOUR(arrive_time)
    ORDER BY segment_speed
    ) AS pct
    FROM dwd_taxi_road_segment
    WHERE arrive_time IS NOT NULL
    AND segment_speed > 0
    AND segment_speed < 200
    ) ranked
    GROUP BY road_id, stat_date, stat_hour
    ) p ON dst.road_id = p.road_id
    AND dst.stat_date = p.stat_date
    AND dst.stat_hour = p.stat_hour
    SET dst.p50_speed_kmh = p.p50,
        dst.p85_speed_kmh = p.p85;
