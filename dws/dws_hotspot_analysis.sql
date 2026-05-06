-- ────────────────────────────────────────────────────────────
-- dws_hotspot_analysis — 热点区域分析宽表
-- 血缘: dwm_road_segment_daily + dim_road_segment
-- 粒度: 一天一个路段, 含热点判断标签
-- 分析场景: 拥堵热点识别、流量热点发现
-- ────────────────────────────────────────────────────────────
INSERT INTO dws_hotspot_analysis (
    stat_date, road_id, road_class_name, pass_count, unique_taxis,
    avg_speed_kmh, congestion_level, is_hotspot, hotspot_type
)
SELECT
    rd.stat_date, rd.road_id,
    (SELECT class_name FROM dim_road_segment WHERE road_id = rd.road_id),
    rd.pass_count, rd.unique_taxis, rd.avg_speed_kmh, rd.congestion_level,
    CASE WHEN rd.pass_count > COALESCE(
            (SELECT AVG(rd2.pass_count) * 2 FROM dwm_road_segment_daily rd2 WHERE rd2.road_id = rd.road_id),
            rd.pass_count * 1.5) THEN 1 ELSE 0 END,
    CASE
        WHEN rd.congestion_level < 0.5 THEN '拥堵热点'
        WHEN rd.pass_count > COALESCE(
                (SELECT AVG(rd3.pass_count) * 2 FROM dwm_road_segment_daily rd3 WHERE rd3.road_id = rd.road_id),
                rd.pass_count * 1.5) THEN '流量热点'
        ELSE NULL
        END
FROM dwm_road_segment_daily rd
    ON DUPLICATE KEY UPDATE
         pass_count       = VALUES(pass_count),
         unique_taxis     = VALUES(unique_taxis),
         avg_speed_kmh    = VALUES(avg_speed_kmh),
         congestion_level = VALUES(congestion_level),
         is_hotspot       = VALUES(is_hotspot),
         hotspot_type     = VALUES(hotspot_type),
         etl_date         = CURDATE();
