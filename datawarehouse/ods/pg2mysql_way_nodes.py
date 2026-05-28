#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PostgreSQL to MySQL Migration Script - way_nodes table
!! IMPORTANT !! Install dependencies:
pip install psycopg2-binary pymysql

Run: python migrate_way_nodes.py
"""

import sys
import psycopg2
import pymysql
import logging
from datetime import datetime

# ==================== 配置信息 - 请修改以下内容 ====================

# PostgreSQL 源数据库配置
PG_CONFIG = {
    'host': 'localhost',  # PostgreSQL 主机地址
    'port': 5432,  # PostgreSQL 端口
    'database': 'harbin',  # PostgreSQL 数据库名
    'user': 'postgres',  # PostgreSQL 用户名
    'password': 'postgres'  # PostgreSQL 密码
}

# MySQL 目标数据库配置
MYSQL_CONFIG = {
    'host': '43.138.221.56',  # MySQL 主机地址（远程服务器）
    'port': 3310,  # MySQL 端口
    'database': 'data-middle-platform',  # MySQL 数据库名
    'user': 'root',  # MySQL 用户名
    'password': '4BhCa5DoeB7FTyat'  # MySQL 密码
}

# 批量插入大小（每批次插入的记录数）
BATCH_SIZE = 10000

# 日志配置
LOG_LEVEL = logging.INFO

# ==================== 配置信息结束 ====================

# 配置日志
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migrate_way_nodes.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# MySQL 建表语句（如果表不存在则创建）
# 根据 PostgreSQL 表结构分析：
# way_nodes 表包含 way_id, node_id, sequence_id 三个字段
# 用于存储道路与节点的关联关系，以及节点在道路中的顺序
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `way_nodes` (
  `way_id` bigint NOT NULL COMMENT '道路ID，关联ways表的id',
  `node_id` bigint NOT NULL COMMENT '节点ID，关联nodes表的id',
  `sequence_id` int NOT NULL COMMENT '节点在道路中的顺序位置',
  PRIMARY KEY (`way_id`, `sequence_id`),
  KEY `idx_node_id` (`node_id`),
  KEY `idx_way_id` (`way_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='道路与节点一对一关系'
"""

# 插入数据的 SQL 语句
INSERT_SQL = """
INSERT INTO `way_nodes` 
(`way_id`, `node_id`, `sequence_id`) 
VALUES (%s, %s, %s)
ON DUPLICATE KEY UPDATE
`node_id` = VALUES(`node_id`)
"""


def create_mysql_table(mysql_conn):
    """在 MySQL 中创建表（如果不存在）"""
    logger.info("检查并创建 MySQL 表...")
    try:
        with mysql_conn.cursor() as cursor:
            cursor.execute(CREATE_TABLE_SQL)
        mysql_conn.commit()
        logger.info("MySQL 表创建成功（或已存在）")
    except Exception as e:
        logger.error(f"创建 MySQL 表失败: {e}")
        raise


def migrate_way_nodes():
    """迁移 way_nodes 表数据"""

    pg_conn = None
    mysql_conn = None
    pg_cursor = None
    mysql_cursor = None

    try:
        # 连接 PostgreSQL
        logger.info("正在连接 PostgreSQL...")
        pg_conn = psycopg2.connect(**PG_CONFIG)
        pg_conn.set_client_encoding('UTF8')
        pg_cursor = pg_conn.cursor()
        logger.info("PostgreSQL 连接成功")

        # 连接 MySQL
        logger.info("正在连接 MySQL...")
        mysql_conn = pymysql.connect(**MYSQL_CONFIG)
        mysql_cursor = mysql_conn.cursor()
        logger.info("MySQL 连接成功")

        # 创建 MySQL 表
        create_mysql_table(mysql_conn)
        
        # 可选：清空表以避免重复数据
        # logger.info("清空 MySQL way_nodes 表...")
        # mysql_cursor.execute("TRUNCATE TABLE way_nodes")
        # mysql_conn.commit()

        # 查询 PostgreSQL 中的数据
        # way_nodes 表结构简单，直接查询所有字段
        # 注意：原 PostgreSQL 表可能有统计信息设置（n_distinct），但不影响数据查询
        query = """
            SELECT 
                way_id, 
                node_id, 
                sequence_id
            FROM way_nodes
            ORDER BY way_id, sequence_id
        """

        logger.info("开始从 PostgreSQL 读取数据...")
        pg_cursor.execute(query)

        total_count = 0
        batch_data = []
        
        # 可选：获取总记录数用于进度显示
        pg_cursor.execute("SELECT COUNT(*) FROM way_nodes")
        total_records = pg_cursor.fetchone()[0]
        logger.info(f"PostgreSQL way_nodes 表共有 {total_records} 条记录")
        
        # 重新执行查询
        pg_cursor.execute(query)

        # 逐行读取并批量插入
        for row in pg_cursor:
            way_id_val, node_id_val, sequence_id_val = row
            
            # 数据类型验证
            if way_id_val is None or node_id_val is None or sequence_id_val is None:
                logger.warning(f"发现空值: way_id={way_id_val}, node_id={node_id_val}, sequence_id={sequence_id_val}")
                continue
            
            # 添加到批次数据
            batch_data.append((
                way_id_val,
                node_id_val,
                sequence_id_val
            ))
            
            # 达到批次大小时批量插入
            if len(batch_data) >= BATCH_SIZE:
                mysql_cursor.executemany(INSERT_SQL, batch_data)
                mysql_conn.commit()
                total_count += len(batch_data)
                progress = (total_count / total_records) * 100 if total_records > 0 else 0
                logger.info(f"已迁移 {total_count} 条记录 ({progress:.1f}%)...")
                batch_data = []
        
        # 插入剩余数据
        if batch_data:
            mysql_cursor.executemany(INSERT_SQL, batch_data)
            mysql_conn.commit()
            total_count += len(batch_data)

        logger.info(f"迁移完成！共迁移 {total_count} 条记录")

    except Exception as e:
        logger.error(f"迁移过程中发生错误: {e}")
        if mysql_conn:
            mysql_conn.rollback()
        raise

    finally:
        # 关闭连接
        if pg_cursor:
            pg_cursor.close()
        if pg_conn:
            pg_conn.close()
        if mysql_cursor:
            mysql_cursor.close()
        if mysql_conn:
            mysql_conn.close()
        logger.info("数据库连接已关闭")


def count_pg_records():
    """统计 PostgreSQL 中的记录数"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM way_nodes")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"PostgreSQL way_nodes 表共有 {count} 条记录")
        return count
    except Exception as e:
        logger.error(f"统计 PostgreSQL 记录数失败: {e}")
        return None


def count_mysql_records():
    """统计 MySQL 中的记录数"""
    try:
        conn = pymysql.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM way_nodes")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"MySQL way_nodes 表共有 {count} 条记录")
        return count
    except Exception as e:
        logger.error(f"统计 MySQL 记录数失败: {e}")
        return None


def sample_data_check():
    """检查 PostgreSQL 中的数据样例，帮助调试"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        cursor = conn.cursor()
        
        # 查看样例数据
        cursor.execute("""
            SELECT way_id, node_id, sequence_id
            FROM way_nodes 
            LIMIT 10
        """)
        
        logger.info("PostgreSQL way_nodes 表样例数据:")
        logger.info("way_id | node_id | sequence_id")
        logger.info("-" * 40)
        for row in cursor.fetchall():
            logger.info(f"{row[0]} | {row[1]} | {row[2]}")
        
        cursor.close()
        conn.close()
        
        # 统计信息
        conn2 = psycopg2.connect(**PG_CONFIG)
        cursor2 = conn2.cursor()
        
        # 查看每个 way 的平均节点数
        cursor2.execute("""
            SELECT AVG(node_count) 
            FROM (
                SELECT way_id, COUNT(*) as node_count 
                FROM way_nodes 
                GROUP BY way_id
            ) AS counts
        """)
        avg_nodes = cursor2.fetchone()[0]
        logger.info(f"平均每个道路包含 {avg_nodes:.2f} 个节点")
        
        # 查看节点数最多的道路
        cursor2.execute("""
            SELECT way_id, COUNT(*) as node_count 
            FROM way_nodes 
            GROUP BY way_id 
            ORDER BY node_count DESC 
            LIMIT 5
        """)
        logger.info("节点数最多的5个道路:")
        for row in cursor2.fetchall():
            logger.info(f"  way_id={row[0]}, 节点数={row[1]}")
        
        cursor2.close()
        conn2.close()
        
    except Exception as e:
        logger.error(f"检查样例数据失败: {e}")


def check_data_integrity():
    """检查数据完整性，验证外键关联"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        cursor = conn.cursor()
        
        # 检查孤儿记录（way_id 不存在于 ways 表）
        cursor.execute("""
            SELECT COUNT(*) 
            FROM way_nodes wn
            LEFT JOIN ways w ON wn.way_id = w.id
            WHERE w.id IS NULL
        """)
        orphan_ways = cursor.fetchone()[0]
        if orphan_ways > 0:
            logger.warning(f"发现 {orphan_ways} 条孤儿记录（way_id 不在 ways 表中）")
        else:
            logger.info("✓ 所有 way_id 都存在于 ways 表中")
        
        # 检查孤儿记录（node_id 不存在于 nodes 表）
        cursor.execute("""
            SELECT COUNT(*) 
            FROM way_nodes wn
            LEFT JOIN nodes n ON wn.node_id = n.id
            WHERE n.id IS NULL
        """)
        orphan_nodes = cursor.fetchone()[0]
        if orphan_nodes > 0:
            logger.warning(f"发现 {orphan_nodes} 条孤儿记录（node_id 不在 nodes 表中）")
        else:
            logger.info("✓ 所有 node_id 都存在于 nodes 表中")
        
        # 检查 sequence_id 是否连续（每个 way 的 sequence_id 应该是 1,2,3,...）
        cursor.execute("""
            SELECT way_id, sequence_id
            FROM way_nodes wn1
            WHERE NOT EXISTS (
                SELECT 1 
                FROM way_nodes wn2 
                WHERE wn2.way_id = wn1.way_id 
                AND wn2.sequence_id = wn1.sequence_id - 1
            )
            AND wn1.sequence_id > 1
            LIMIT 10
        """)
        missing_sequences = cursor.fetchall()
        if missing_sequences:
            logger.warning(f"发现 sequence_id 不连续的道路（样例前10条）:")
            for row in missing_sequences[:5]:
                logger.warning(f"  way_id={row[0]}, sequence_id={row[1]} 缺失前序")
        else:
            logger.info("✓ 所有道路的 sequence_id 都是连续的")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"检查数据完整性失败: {e}")


def analyze_table_statistics():
    """分析表统计信息，帮助优化迁移策略"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        cursor = conn.cursor()
        
        # 获取表统计信息
        cursor.execute("""
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT way_id) as unique_ways,
                COUNT(DISTINCT node_id) as unique_nodes,
                MIN(sequence_id) as min_seq,
                MAX(sequence_id) as max_seq
            FROM way_nodes
        """)
        stats = cursor.fetchone()
        
        logger.info("=" * 50)
        logger.info("way_nodes 表统计信息:")
        logger.info(f"  总记录数: {stats[0]:,}")
        logger.info(f"  唯一道路数: {stats[1]:,}")
        logger.info(f"  唯一节点数: {stats[2]:,}")
        logger.info(f"  sequence_id 范围: {stats[3]} - {stats[4]}")
        
        # 估算迁移数据量
        # 每条记录大约 24 字节 (3个bigint)
        estimated_size = stats[0] * 24 / 1024 / 1024
        logger.info(f"  预估数据量: {estimated_size:.2f} MB")
        logger.info("=" * 50)
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"分析表统计信息失败: {e}")


if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("开始迁移 way_nodes 表数据")
    logger.info("=" * 50)
    
    # 分析表统计信息
    analyze_table_statistics()
    
    # 检查数据完整性
    check_data_integrity()
    
    # 显示样例数据
    sample_data_check()

    # 显示源数据库记录数
    pg_count = count_pg_records()

    if pg_count is not None and pg_count > 0:
        logger.info(f"准备迁移 {pg_count:,} 条记录")
        
        # 估算迁移时间
        # 假设每秒处理 5000 条记录
        estimated_seconds = pg_count / 5000
        logger.info(f"预估迁移时间: {estimated_seconds:.1f} 秒 ({estimated_seconds/60:.1f} 分钟)")

    # 执行迁移
    migrate_way_nodes()

    # 验证迁移结果
    mysql_count = count_mysql_records()

    if pg_count is not None and mysql_count is not None:
        if pg_count == mysql_count:
            logger.info("✓ 数据迁移验证成功，记录数一致")
        else:
            logger.warning(f"⚠ 记录数不一致: PG={pg_count:,}, MySQL={mysql_count:,}")
            diff = abs(pg_count - mysql_count)
            logger.warning(f"  差异: {diff:,} 条记录")
            
            # 如果差异较大，建议检查
            if diff > 1000:
                logger.warning("  建议检查日志文件中的错误信息")

    logger.info("=" * 50)
    logger.info("way_nodes 表迁移完成")
    logger.info("=" * 50)