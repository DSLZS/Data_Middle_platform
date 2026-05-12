-- dwm_taxi_daily_stats — 出租车日统计
-- 血缘: dwd_taxi_trip + dwd_taxi_gps_point + dwd_taxi_road_segment
-- 粒度: 一辆车一天
-- 聚合指标: 行程次数、总里程、总时长、速度统计、GPS 点数、路段数、高峰时段
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dwm_taxi_daily_stats;
CREATE TABLE dwm_taxi_daily_stats (
    devid              VARCHAR(50),
    stat_date          DATE,
    trip_count         INT,
    total_distance_m   DOUBLE,
    total_duration_s   INT,
    avg_speed_kmh      DOUBLE,
    max_speed_kmh      DOUBLE,
    min_speed_kmh      DOUBLE,
    gps_point_count    INT,
    road_segment_count INT,
    unique_roads       INT,
    peak_hour          INT,
    etl_date           DATE DEFAULT (CURRENT_DATE),
    PRIMARY KEY (devid, stat_date)
);
