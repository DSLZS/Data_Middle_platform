-- 数字辅助表 (用于展开文本数组)
DROP TABLE IF EXISTS _seq;
CREATE TABLE _seq (n INT PRIMARY KEY);
INSERT INTO _seq (n)
WITH RECURSIVE seq AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 2000)
SELECT n FROM seq;

-- Haversine 距离函数 (两点间距离, 米)
DROP FUNCTION IF EXISTS haversine_distance;
DELIMITER //
CREATE FUNCTION haversine_distance(lat1 DOUBLE, lon1 DOUBLE, lat2 DOUBLE, lon2 DOUBLE)
    RETURNS DOUBLE DETERMINISTIC
BEGIN
    DECLARE R DOUBLE DEFAULT 6371000;
    DECLARE dlat DOUBLE, dlon DOUBLE, a DOUBLE, c DOUBLE;
    SET dlat = RADIANS(lat2 - lat1);
    SET dlon = RADIANS(lon2 - lon1);
    SET a = SIN(dlat/2) * SIN(dlat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlon/2) * SIN(dlon/2);
    SET c = 2 * ATAN2(SQRT(a), SQRT(1-a));
RETURN R * c;
END //
DELIMITER ;

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