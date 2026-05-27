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