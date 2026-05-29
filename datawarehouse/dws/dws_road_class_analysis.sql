-- ────────────────────────────────────────────────────────────
-- dws_road_class_analysis — 道路等级分析宽表
-- 血缘: dwd_taxi_road_segment (已含 class_id/class_name 维度退化)
-- 粒度: 一天一个道路等级
-- 分析场景: 不同等级道路的通行效率对比
-- ────────────────────────────────────────────────────────────
INSERT INTO dws_road_class_analysis (
    stat_date, class_id, class_name, road_count, total_pass,
    avg_speed_kmh, congestion_level, avg_length_m
)
SELECT
    rs.trip_date,
    rs.road_class_id,
    rs.road_class_name,
    COUNT(DISTINCT rs.road_id),
    COUNT(*),
    AVG(CASE WHEN rs.segment_speed > 0 AND rs.segment_speed < 200 THEN rs.segment_speed END),
    AVG(CASE WHEN rs.segment_speed > 0 AND rs.segment_speed < 200 THEN rs.segment_speed END)
        / NULLIF(AVG(rs.maxspeed_forward), 0),
    AVG(rs.road_length_m)
FROM dwd_taxi_road_segment rs
WHERE rs.road_class_id IS NOT NULL
  AND rs.road_class_name IS NOT NULL
GROUP BY rs.trip_date, rs.road_class_id, rs.road_class_name
    ON DUPLICATE KEY UPDATE
     road_count = VALUES(road_count),
     total_pass = VALUES(total_pass),
     avg_speed_kmh = VALUES(avg_speed_kmh),
     congestion_level = VALUES(congestion_level),
     avg_length_m = VALUES(avg_length_m),
     etl_date = CURDATE();