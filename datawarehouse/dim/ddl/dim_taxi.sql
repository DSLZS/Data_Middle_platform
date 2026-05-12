-- ────────────────────────────────────────────────────────────
-- dim_taxi — 出租车维度表
-- 血缘: dwd_taxi_trip → 按 devid 提取静态标签
-- 说明: 出租车静态属性 (首次/末次出现), 不随每日数据变化
--       每日统计指标放在 DWM, 不放在维表
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS dim_taxi;
CREATE TABLE dim_taxi (
      taxi_id     VARCHAR(50) PRIMARY KEY,
      first_seen  DATE,
      last_seen   DATE
);
