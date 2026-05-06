-- dim_road_segment — 道路路段维度表
-- 血缘: bfmap_ways → dim_road_segment
-- 说明: 静态路网数据, 不随业务变化
--       class_id → class_name 退化, 提取起终点经纬度
-- ────────────────────────────────────────────────────────────

INSERT INTO dim_road_segment (
    road_id, osm_id, class_id, class_name, source_node_id, target_node_id,
    length_m, reverse, maxspeed_forward, maxspeed_backward, priority,
    start_lon, start_lat, end_lon, end_lat
)
SELECT
    w.gid, w.osm_id, w.class_id,
    CASE w.class_id
        WHEN 104 THEN '主干路' WHEN 106 THEN '次干路' WHEN 108 THEN '支路'
        WHEN 110 THEN '快速路' WHEN 112 THEN '高速' WHEN 114 THEN '其他'
        WHEN 117 THEN '小路' ELSE '未知'
        END,
    w.source, w.target, w.length, w.reverse,
    w.maxspeed_forward, w.maxspeed_backward, w.priority,
    ST_X(ST_StartPoint(w.geom)), ST_Y(ST_StartPoint(w.geom)),
    ST_X(ST_EndPoint(w.geom)), ST_Y(ST_EndPoint(w.geom))
FROM bfmap_ways w;
