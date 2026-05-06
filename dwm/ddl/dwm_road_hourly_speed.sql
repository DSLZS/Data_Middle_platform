-- dwm_road_hourly_speed — 路段时段速度统计
-- 血缘: dwd_taxi_road_segment (已含 maxspeed_forward 维度退化)
-- 粒度: 一个路段一天一个时段
-- 聚合指标: 通过次数、平均速度、P50/P85 分位速度、拥堵指数
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dwm_road_hourly_speed;
CREATE TABLE dwm_road_hourly_speed (
    road_id          BIGINT,
    stat_date        DATE,
    stat_hour        INT,
    pass_count       INT,
    avg_speed_kmh    DOUBLE,
    p50_speed_kmh    DOUBLE,
    p85_speed_kmh    DOUBLE,
    congestion_level DOUBLE,
    etl_date         DATE DEFAULT (CURRENT_DATE),
    PRIMARY KEY (road_id, stat_date, stat_hour)
);