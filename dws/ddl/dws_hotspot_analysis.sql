-- ────────────────────────────────────────────────────────────
-- dws_hotspot_analysis — 热点区域分析宽表
-- 血缘: dwm_road_segment_daily + dim_road_segment
-- 粒度: 一天一个路段, 含热点判断标签
-- 分析场景: 拥堵热点识别、流量热点发现
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS dws_hotspot_analysis;
CREATE TABLE dws_hotspot_analysis (
    stat_date        DATE,
    road_id          BIGINT,
    road_class_name  VARCHAR(20),
    pass_count       INT,
    unique_taxis     INT,
    avg_speed_kmh    DOUBLE,
    congestion_level DOUBLE,
    is_hotspot       TINYINT(1),
    hotspot_type     VARCHAR(20),
    etl_date         DATE DEFAULT (CURRENT_DATE),
    PRIMARY KEY (stat_date, road_id)
);
