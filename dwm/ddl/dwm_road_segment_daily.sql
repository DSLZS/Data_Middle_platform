-- dwm_road_segment_daily — 路段日统计
-- 血缘: dwd_taxi_road_segment (已含维度退化字段)
-- 粒度: 一个路段一天
-- 聚合指标: 通过次数、不同出租车数、速度统计、拥堵指数
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dwm_road_segment_daily;
CREATE TABLE dwm_road_segment_daily (
    road_id          BIGINT,
    stat_date        DATE,
    pass_count       INT,
    unique_taxis     INT,
    avg_speed_kmh    DOUBLE,
    min_speed_kmh    DOUBLE,
    max_speed_kmh    DOUBLE,
    avg_duration_s   DOUBLE,
    total_distance_m DOUBLE,
    congestion_level DOUBLE,
    peak_hour        INT,
    etl_date         DATE DEFAULT (CURRENT_DATE),
    PRIMARY KEY (road_id, stat_date)
);
