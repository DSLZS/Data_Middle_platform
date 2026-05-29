-- =====================================================
-- 表名: seq (数字序列表)
-- 用途: 用于展开数组，支持 ETL 过程中的数组遍历操作
-- 说明: 这是一个技术辅助表，存储 1 到 N 的连续整数
-- =====================================================

-- DROP TABLE IF EXISTS `seq`;
CREATE TABLE `seq` (
                       `n` INT NOT NULL COMMENT '序号，从1开始',
                       PRIMARY KEY (`n`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='数字序列表，用于数组展开等辅助操作';

SET SESSION cte_max_recursion_depth = 10000;

-- 然后执行插入
INSERT INTO `seq` (`n`)
WITH RECURSIVE numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 10000
)
SELECT n FROM numbers;

-- 验证结果
-- SELECT COUNT(*) FROM seq;

-- Haversine 距离函数 (两点间距离, 米)
DELIMITER //

DROP FUNCTION IF EXISTS haversine_distance//

CREATE FUNCTION haversine_distance(lat1 DOUBLE, lon1 DOUBLE, lat2 DOUBLE, lon2 DOUBLE)
    RETURNS DOUBLE DETERMINISTIC
BEGIN
    DECLARE R DOUBLE DEFAULT 6371000;
    DECLARE dlat DOUBLE;
    DECLARE dlon DOUBLE;
    DECLARE a DOUBLE;
    DECLARE c DOUBLE;

    SET dlat = RADIANS(lat2 - lat1);
    SET dlon = RADIANS(lon2 - lon1);
    SET a = SIN(dlat/2) * SIN(dlat/2)
            + COS(RADIANS(lat1)) * COS(RADIANS(lat2))
            * SIN(dlon/2) * SIN(dlon/2);
    SET c = 2 * ATAN2(SQRT(a), SQRT(1-a));

RETURN R * c;
END//

DELIMITER ;

-- 测试函数
-- SELECT haversine_distance(45.75743, 126.62629, 45.76486, 126.616035) AS distance_m;

-- 解析文本数组: 取第 pos 个元素 (1-based)
DROP FUNCTION IF EXISTS arr_get;
DELIMITER //
CREATE FUNCTION arr_get(txt TEXT, pos INT) RETURNS TEXT DETERMINISTIC
BEGIN
    DECLARE cleaned TEXT;
    SET cleaned = TRIM(BOTH '[]' FROM TRIM(txt));
RETURN TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(cleaned, ',', pos), ',', -1));
END //
DELIMITER ;

-- 解析文本数组: 元素个数
DROP FUNCTION IF EXISTS arr_len;
DELIMITER //
CREATE FUNCTION arr_len(txt TEXT) RETURNS INT DETERMINISTIC
BEGIN
    DECLARE cleaned TEXT;
    IF txt IS NULL OR TRIM(txt) = '' OR TRIM(txt) = '[]' THEN RETURN 0; END IF;
    SET cleaned = TRIM(BOTH '[]' FROM TRIM(txt));
RETURN LENGTH(cleaned) - LENGTH(REPLACE(cleaned, ',', '')) + 1;
END //
DELIMITER ;