-- =====================================================
-- 表名: seq (数字序列表)
-- 用途: 用于展开数组，支持 ETL 过程中的数组遍历操作
-- 说明: 这是一个技术辅助表，存储 1 到 N 的连续整数
-- =====================================================

-- 设置最大递归深度为 10000（仅对当前会话有效）
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