-- dim_date — 日期维度表
-- 说明: 预生成 2015 全年日期, 不随业务变化
-- DROP TABLE IF EXISTS dim_date;
CREATE TABLE dim_date (
    dt          DATE PRIMARY KEY,
    year        INT,
    month       INT,
    day         INT,
    week        INT,
    quarter     INT,
    day_of_week INT,        -- 1=周一, 7=周日
    is_weekend  TINYINT(1),
    dt_str      VARCHAR(10)
);
