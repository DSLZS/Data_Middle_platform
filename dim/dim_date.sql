-- dim_date — 日期维度表
-- 说明: 预生成 2015 全年日期, 不随业务变化
-- 取数
INSERT INTO dim_date (dt, year, month, day, week, quarter, day_of_week, is_weekend, dt_str)
SELECT d, YEAR(d), MONTH(d), DAY(d), WEEK(d, 3), QUARTER(d),
    DAYOFWEEK(d),
    CASE WHEN DAYOFWEEK(d) IN (1, 7) THEN 1 ELSE 0 END,
    DATE_FORMAT(d, '%Y-%m-%d')
FROM (WITH RECURSIVE cal AS (
    SELECT DATE('2015-01-01') AS d
    UNION ALL
    SELECT d + INTERVAL 1 DAY FROM cal WHERE d < DATE('2015-12-31')
) SELECT d FROM cal) t;

