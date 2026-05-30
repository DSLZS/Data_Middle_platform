-- ==================================================================================
-- 1. rpt_taxi_daily_report - 出租车日报表
-- 用途: 每日运营情况监控
-- ==================================================================================
-- DROP TABLE IF EXISTS rpt_taxi_daily_report;
CREATE TABLE rpt_taxi_daily_report (
       report_date          DATE PRIMARY KEY COMMENT '报表日期',
       active_taxis         INT COMMENT '运营出租车数',
       total_trips          INT COMMENT '总订单数',
       total_distance_km    DOUBLE COMMENT '总行驶里程(公里)',
       total_duration_h     DOUBLE COMMENT '总运营时长(小时)',
       avg_trip_distance_km DOUBLE COMMENT '平均行程距离(公里)',
       avg_trip_duration_min DOUBLE COMMENT '平均行程时长(分钟)',
       avg_speed_kmh        DOUBLE COMMENT '平均速度(km/h)',
       peak_hour            INT COMMENT '高峰小时',
       peak_hour_trips      INT COMMENT '高峰小时订单数',
       day_of_week          INT COMMENT '星期几(1-7)',
       is_weekend           TINYINT(1) COMMENT '是否周末',
       etl_date             DATE DEFAULT (CURRENT_DATE) COMMENT 'ETL日期'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='出租车日报表';