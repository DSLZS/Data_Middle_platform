-- dim_road_segment — 道路路段维度表
-- 血缘: bfmap_ways → dim_road_segment
-- 说明: 静态路网数据, 不随业务变化
--       class_id → class_name 退化, 提取起终点经纬度
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS dim_road_segment;
CREATE TABLE dim_road_segment (
      road_id            BIGINT PRIMARY KEY,
      osm_id             BIGINT,
      class_id           INT,
      class_name         VARCHAR(20),
      source_node_id     BIGINT,
      target_node_id     BIGINT,
      length_m           DOUBLE,
      reverse            DOUBLE,
      maxspeed_forward   INT,
      maxspeed_backward  INT,
      priority           DOUBLE,
      start_lon          DOUBLE,
      start_lat          DOUBLE,
      end_lon            DOUBLE,
      end_lat            DOUBLE
);
