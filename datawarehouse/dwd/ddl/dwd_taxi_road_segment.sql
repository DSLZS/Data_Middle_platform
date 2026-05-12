-- ────────────────────────────────────────────────────────────
-- dwd_taxi_road_segment — 路段经过明细表
-- 血缘: trips → 展开 roads/frac/time → 行级路段
--       关联 dim_road_segment 做维度退化
-- 粒度: 一次行程经过一个路段一行
-- 不做聚合, 只做:
--   - 数组展开为行级路段
--   - 维度退化: class_id, class_name, length, maxspeed, source/target 节点
--   - 标签展开: travel_dist_m, segment_speed
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dwd_taxi_road_segment;
CREATE TABLE dwd_taxi_road_segment (
       trip_id          BIGINT,
       devid            VARCHAR(50),
       trip_date        DATE,
       seq              INT,
       road_id          BIGINT,
       road_class_id    INT,
       road_class_name  VARCHAR(20),
       heading          VARCHAR(20),
       arrive_time      DATETIME,
       frac             DOUBLE,
       road_length_m    DOUBLE,
       travel_dist_m    DOUBLE,
       next_arrive_time DATETIME,
       segment_dur_s    INT,
       segment_speed    DOUBLE,
       source_node      BIGINT,
       target_node      BIGINT,
       maxspeed_forward INT,
       etl_date         DATE DEFAULT (CURRENT_DATE),
       PRIMARY KEY (trip_id, seq)
);
