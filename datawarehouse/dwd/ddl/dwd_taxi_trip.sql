-- 血缘: trips → 解析数组 → 维度退化
-- 粒度: 一次行程一行
-- 不做聚合, 只做:
--   - 数组文本 → 标量字段
--   - 维度退化: 关联 dim_road_segment 获取 class_name
--   - 标签展开: 从 file_name 提取 trip_date
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dwd_taxi_trip;
CREATE TABLE dwd_taxi_trip (
    trip_id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    devid                VARCHAR(50) NOT NULL,
    trip_date            DATE NOT NULL,
    file_name            TEXT,
    start_time           DATETIME,
    end_time             DATETIME,
    start_lon            DOUBLE,
    start_lat            DOUBLE,
    end_lon              DOUBLE,
    end_lat              DOUBLE,
    gps_points_count     INT,
    road_segments_count  INT,
    route_distance_m     DOUBLE,
    trip_duration_s      INT,
    avg_speed_kmh        DOUBLE,
    max_speed_kmh        DOUBLE,
    route_geom           TEXT,
    etl_date             DATE DEFAULT (CURRENT_DATE)
);
