-- ────────────────────────────────────────────────────────────
-- dws_road_class_analysis — 道路等级分析宽表
-- 血缘: dwd_taxi_road_segment (已含 class_id/class_name 维度退化)
-- 粒度: 一天一个道路等级
-- 分析场景: 不同等级道路的通行效率对比
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS dws_road_class_analysis;
CREATE TABLE dws_road_class_analysis (
     stat_date        DATE,
     class_id         INT,
     class_name       VARCHAR(20),
     road_count       INT,
     total_pass       INT,
     avg_speed_kmh    DOUBLE,
     congestion_level DOUBLE,
     avg_length_m     DOUBLE,
     etl_date         DATE DEFAULT (CURRENT_DATE),
     PRIMARY KEY (stat_date, class_id)
);
