-- ────────────────────────────────────────────────────────────
-- dwd_taxi_gps_point — GPS 点明细表
-- 血缘: trips → 展开 lon/lat/tms → 行级 GPS 点
-- 粒度: 一个 GPS 采样点一行
-- 不做聚合, 只做数组展开 + 衍生字段计算
-- 维度退化: 关联 dim_road_segment 获取 class_name
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dwd_taxi_gps_point;
CREATE TABLE dwd_taxi_gps_point (
    trip_id       BIGINT,
    devid         VARCHAR(50),
    trip_date     DATE,
    seq           INT,
    gps_time      DATETIME,
    lon           DOUBLE,
    lat           DOUBLE,
    road_id       BIGINT,
    road_frac     DOUBLE,
    arrive_time   DATETIME,
    next_gps_time DATETIME,
    next_lon      DOUBLE,
    next_lat      DOUBLE,
    point_dist_m  DOUBLE,
    point_dur_s   INT,
    point_speed   DOUBLE,
    etl_date      DATE DEFAULT (CURRENT_DATE),
    PRIMARY KEY (trip_id, seq)
);
