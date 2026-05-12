-- dwm_od_flow_daily — OD 流量统计
-- 血缘: dwd_taxi_trip + dwd_taxi_road_segment (首段 + 尾段)
-- 粒度: 一个 OD 对一天
-- 聚合指标: 流量、不同出租车数、平均时长、平均距离
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dwm_od_flow_daily;
CREATE TABLE dwm_od_flow_daily (
    origin_road_id BIGINT,
    dest_road_id   BIGINT,
    stat_date      DATE,
    flow_count     INT,
    unique_taxis   INT,
    avg_duration_s DOUBLE,
    avg_distance_m DOUBLE,
    etl_date       DATE DEFAULT (CURRENT_DATE),
    PRIMARY KEY (origin_road_id, dest_road_id, stat_date)
);