#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PostgreSQL to MySQL Migration Script - bfmap_ways table
!! IMPORTANT !! Install dependencies:
pip install psycopg2-binary pymysql

Run: python migrate_bfmap_ways.py
"""

import sys
import psycopg2
import pymysql
import logging
import json
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
BATCH_SIZE = 20000

# 日志配置
LOG_LEVEL = logging.INFO

# ==================== 配置信息结束 ====================

# 配置日志
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migrate_bfmap_ways.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# MySQL 建表语句（如果表不存在则创建）
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `bfmap_ways` (
  `gid` bigint NOT NULL AUTO_INCREMENT COMMENT '全局唯一标识符 (主键)',
  `osm_id` bigint NOT NULL COMMENT 'OpenStreetMap 原始道路ID',
  `class_id` int NOT NULL COMMENT '道路分类ID',
  `source` bigint NOT NULL COMMENT 'nodes表中节点ID，开始节点',
  `target` bigint NOT NULL COMMENT 'nodes表中节点ID，结束节点',
  `length` double NOT NULL COMMENT '两节点长度距离',
  `reverse` double NOT NULL COMMENT '正反向标识',
  `maxspeed_forward` int DEFAULT NULL COMMENT '正向限速',
  `maxspeed_backward` int DEFAULT NULL COMMENT '反向限速',
  `priority` double NOT NULL COMMENT '路由优先级',
  `geom` linestring NOT NULL COMMENT '道路的几何线形 (LineString)，存储经纬度序列',
  PRIMARY KEY (`gid`),
  KEY `idx_osm_id` (`osm_id`),
  KEY `idx_source` (`source`),
  KEY `idx_target` (`target`),
  KEY `idx_class_id` (`class_id`),
  SPATIAL INDEX `idx_geom` (`geom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='道路两节点之间的道路信息，主要看距离'
"""

# 插入数据的 SQL 语句
# 注意：gid 是自增字段，不需要插入，让 MySQL 自动生成
INSERT_SQL = """
INSERT INTO `bfmap_ways` 
(`osm_id`, `class_id`, `source`, `target`, `length`, `reverse`, 
 `maxspeed_forward`, `maxspeed_backward`, `priority`, `geom`) 
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326))
"""

# 更新语句（当需要更新已存在的记录时使用，以 osm_id + source + target 作为唯一标识）
UPDATE_SQL = """
INSERT INTO `bfmap_ways` 
(`osm_id`, `class_id`, `source`, `target`, `length`, `reverse`, 
 `maxspeed_forward`, `maxspeed_backward`, `priority`, `geom`) 
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326))
ON DUPLICATE KEY UPDATE
`class_id` = VALUES(`class_id`),
`length` = VALUES(`length`),
`reverse` = VALUES(`reverse`),
`maxspeed_forward` = VALUES(`maxspeed_forward`),
`maxspeed_backward` = VALUES(`maxspeed_backward`),
`priority` = VALUES(`priority`),
`geom` = VALUES(`geom`)
"""


# 注意：由于 bfmap_ways 表没有唯一约束来防止重复，
# 这里使用不带 ON DUPLICATE KEY UPDATE 的版本
# 如果担心重复数据，可以先清空表或添加唯一索引


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


def convert_linestring_to_wkt(linestring_hex):
    """
    将 PostgreSQL 的 LineString geometry 类型转换为 WKT 字符串
    同时处理坐标顺序：PostgreSQL 存储 POINT(经度 纬度)，MySQL 期望 POINT(纬度 经度)
    对于 LineString，需要交换每个点的坐标顺序
    """
    if linestring_hex is None:
        return None

    try:
        # 如果已经是 WKT 字符串，直接使用
        if isinstance(linestring_hex, str) and linestring_hex.startswith('LINESTRING'):
            # 解析 WKT 字符串并交换坐标
            # 格式: LINESTRING(x1 y1, x2 y2, x3 y3, ...)
            import re

            # 提取坐标对
            coords_match = re.search(r'LINESTRING\((.*)\)', linestring_hex)
            if coords_match:
                coords_str = coords_match.group(1)
                # 分割每个坐标对
                coord_pairs = coords_str.split(',')
                swapped_pairs = []

                for pair in coord_pairs:
                    pair = pair.strip()
                    parts = pair.split()
                    if len(parts) >= 2:
                        x, y = parts[0], parts[1]  # x=经度, y=纬度
                        # 交换顺序，MySQL 期望 POINT(纬度 经度)
                        swapped_pairs.append(f"{y} {x}")
                    else:
                        swapped_pairs.append(pair)

                return f"LINESTRING({', '.join(swapped_pairs)})"

        # 如果是十六进制格式或其他格式，返回 None 并记录警告
        logger.warning(f"无法处理的 LineString 格式: {linestring_hex[:100] if linestring_hex else 'None'}")
        return None

    except Exception as e:
        logger.warning(f"转换 LineString 数据失败: {e}")
        return None


def convert_geom_from_pg(pg_cursor, geom_value):
    """
    从 PostgreSQL 游标直接获取转换后的几何数据
    使用 ST_AsText 和坐标交换
    """
    if geom_value is None:
        return None

    try:
        # 如果 geom_value 已经是 WKT 字符串，直接处理
        if isinstance(geom_value, str) and geom_value.startswith('LINESTRING'):
            return convert_linestring_to_wkt(geom_value)

        # 否则，通过查询获取 WKT 并交换坐标
        # 注意：这里假设 geom_value 是 geometry 对象
        # 实际使用时，应该在主查询中直接使用 ST_AsText 和坐标交换
        return None

    except Exception as e:
        logger.warning(f"转换几何数据失败: {e}")
        return None


def migrate_bfmap_ways():
    """迁移 bfmap_ways 表数据"""

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
        # logger.info("清空 MySQL bfmap_ways 表...")
        # mysql_cursor.execute("TRUNCATE TABLE bfmap_ways")
        # mysql_conn.commit()

        # 查询 PostgreSQL 中的数据
        # 对于几何字段，需要转换坐标顺序
        # PostgreSQL 存储 LINESTRING(经度 纬度, 经度 纬度, ...)
        # MySQL 期望 LINESTRING(纬度 经度, 纬度 经度, ...)
        # 使用 ST_AsText 和字符串处理来交换坐标
        query = """
            SELECT 
                osm_id, 
                class_id, 
                source, 
                target, 
                length, 
                reverse, 
                maxspeed_forward, 
                maxspeed_backward, 
                priority,
                -- 将 LINESTRING 中的坐标从 (lon lat) 交换为 (lat lon)
                'LINESTRING(' || 
                string_agg(
                    ST_Y(point) || ' ' || ST_X(point), 
                    ', ' 
                    ORDER BY point_order
                ) || ')' as geom_wkt
            FROM (
                SELECT 
                    osm_id, class_id, source, target, length, reverse,
                    maxspeed_forward, maxspeed_backward, priority,
                    -- 展开 LINESTRING 为点序列
                    (ST_DumpPoints(geom)).path[1] as point_order,
                    (ST_DumpPoints(geom)).geom as point
                FROM bfmap_ways
            ) AS points
            GROUP BY 
                osm_id, class_id, source, target, length, reverse,
                maxspeed_forward, maxspeed_backward, priority
        """

        # 更高效的查询方式：直接使用 ST_AsText 然后进行字符串替换
        # 注意：这个方法假设 LINESTRING 中的坐标对都是空格分隔
        query_simple = """
            SELECT 
                osm_id, 
                class_id, 
                source, 
                target, 
                length, 
                reverse, 
                maxspeed_forward, 
                maxspeed_backward, 
                priority,
                -- 替换坐标顺序的正则表达式需要 PostgreSQL 9.4+
                -- 使用递归 CTE 或其他方法太复杂，采用字符串处理
                regexp_replace(
                    regexp_replace(
                        ST_AsText(geom),
                        '(-?\\d+\\.?\\d*)\\s+(-?\\d+\\.?\\d*)',
                        '\\2 \\1',
                        'g'
                    ),
                    '^LINESTRING\\((.*)\\)$',
                    'LINESTRING(\\1)'
                ) as geom_wkt
            FROM bfmap_ways
        """

        # 使用简化的查询方式（如果 PostgreSQL 版本支持正则替换）
        logger.info("开始从 PostgreSQL 读取数据...")

        # 测试查询，确保能够正确执行
        test_query = "SELECT ST_AsText(geom) FROM bfmap_ways LIMIT 1"
        pg_cursor.execute(test_query)
        sample_geom = pg_cursor.fetchone()
        logger.info(f"样例几何数据: {sample_geom[0][:200] if sample_geom and sample_geom[0] else 'NULL'}...")

        # 查询 PostgreSQL 中的数据 - 获取原始WKT，然后在Python端高效转换
        # 使用服务器端游标进行流式查询，避免一次性加载所有数据到内存
        logger.info("创建服务器端游标进行流式查询...")
        pg_cursor = pg_conn.cursor(name='bfmap_ways_cursor')
        
        query = """
            SELECT 
                osm_id, 
                class_id, 
                source, 
                target, 
                length, 
                reverse, 
                maxspeed_forward, 
                maxspeed_backward, 
                priority,
                ST_AsText(geom) as geom_wkt
            FROM bfmap_ways
        """

        logger.info("执行查询...")
        pg_cursor.execute(query)
        logger.info("查询执行完成，开始读取数据...")

        total_count = 0
        batch_data = []
        error_count = 0

        # 逐行读取并批量插入 - 在Python端高效转换坐标
        row_count = 0
        for row in pg_cursor:
            row_count += 1
            
            # 每1000条记录输出一次进度，让用户知道脚本还在运行
            if row_count % 1000 == 0:
                logger.info(f"正在处理第 {row_count} 条记录...")
            
            (osm_id_val, class_id_val, source_val, target_val,
             length_val, reverse_val, maxspeed_forward_val,
             maxspeed_backward_val, priority_val, geom_wkt) = row

            # 快速交换坐标顺序
            if geom_wkt and geom_wkt.startswith('LINESTRING'):
                # 高效方法：使用字符串分割和重组
                coords_part = geom_wkt[11:-1]
                coord_pairs = coords_part.split(',')
                swapped_pairs = []
                for pair in coord_pairs:
                    pair = pair.strip()
                    if ' ' in pair:
                        lon, lat = pair.split(' ', 1)
                        swapped_pairs.append(f"{lat} {lon}")
                swapped_geom = f"LINESTRING({', '.join(swapped_pairs)})"
                
                batch_data.append((
                    osm_id_val,
                    class_id_val,
                    source_val,
                    target_val,
                    length_val,
                    reverse_val,
                    maxspeed_forward_val,
                    maxspeed_backward_val,
                    priority_val,
                    swapped_geom
                ))
            else:
                error_count += 1
                if error_count <= 10:
                    logger.warning(f"OSM ID {osm_id_val} 的几何数据格式不正确: {geom_wkt[:100] if geom_wkt else 'NULL'}")
                continue

            # 达到批次大小时批量插入
            if len(batch_data) >= BATCH_SIZE:
                mysql_cursor.executemany(INSERT_SQL, batch_data)
                mysql_conn.commit()
                total_count += len(batch_data)
                logger.info(f"已迁移 {total_count} 条记录...")
                batch_data = []

        # 插入剩余数据
        if batch_data:
            mysql_cursor.executemany(INSERT_SQL, batch_data)
            mysql_conn.commit()
            total_count += len(batch_data)

        if error_count > 0:
            logger.warning(f"共有 {error_count} 条记录的几何数据转换失败，已跳过")

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
    """统计 PostgreSQL 中的记录数（可选，用于检查）"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM bfmap_ways")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"PostgreSQL bfmap_ways 表共有 {count} 条记录")
        return count
    except Exception as e:
        logger.error(f"统计 PostgreSQL 记录数失败: {e}")
        return None


def count_mysql_records():
    """统计 MySQL 中的记录数（可选，用于验证）"""
    try:
        conn = pymysql.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM bfmap_ways")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"MySQL bfmap_ways 表共有 {count} 条记录")
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
            SELECT osm_id, class_id, source, target, length, ST_AsText(geom) 
            FROM bfmap_ways 
            LIMIT 5
        """)

        logger.info("PostgreSQL bfmap_ways 表样例数据:")
        for row in cursor.fetchall():
            logger.info(f"  OSM ID: {row[0]}, Class: {row[1]}, Source: {row[2]}, Target: {row[3]}, Length: {row[4]}")
            geom_preview = row[5][:100] if row[5] else 'NULL'
            logger.info(f"    geom: {geom_preview}...")

        cursor.close()
        conn.close()

        # 验证坐标顺序
        logger.info("验证坐标顺序...")
        conn2 = psycopg2.connect(**PG_CONFIG)
        cursor2 = conn2.cursor()
        cursor2.execute("""
            SELECT ST_X(ST_StartPoint(geom)), ST_Y(ST_StartPoint(geom)), 
                   ST_X(ST_EndPoint(geom)), ST_Y(ST_EndPoint(geom))
            FROM bfmap_ways 
            WHERE geom IS NOT NULL 
            LIMIT 1
        """)
        sample = cursor2.fetchone()
        if sample:
            logger.info(f"起点坐标 (经度, 纬度): ({sample[0]}, {sample[1]})")
            logger.info(f"终点坐标 (经度, 纬度): ({sample[2]}, {sample[3]})")
            logger.info("注意: MySQL 需要 (纬度, 经度) 顺序，脚本会自动交换")

        cursor2.close()
        conn2.close()

    except Exception as e:
        logger.error(f"检查样例数据失败: {e}")


def check_mysql_spatial_support():
    """检查 MySQL 是否支持空间索引"""
    try:
        conn = pymysql.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()

        # 检查 MySQL 版本
        cursor.execute("SELECT VERSION()")
        version = cursor.fetchone()[0]
        logger.info(f"MySQL 版本: {version}")

        # 检查 InnoDB 是否支持空间索引（MySQL 5.7.5+）
        cursor.execute("SHOW VARIABLES LIKE 'innodb_version'")
        innodb_version = cursor.fetchone()
        if innodb_version:
            logger.info(f"InnoDB 版本: {innodb_version[1]}")

        cursor.close()
        conn.close()

    except Exception as e:
        logger.error(f"检查 MySQL 空间支持失败: {e}")


if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("开始迁移 bfmap_ways 表数据")
    logger.info("=" * 50)

    # 检查 MySQL 空间支持
    check_mysql_spatial_support()

    # 显示样例数据
    sample_data_check()

    # 显示源数据库记录数
    pg_count = count_pg_records()

    if pg_count is not None:
        logger.info(f"准备迁移 {pg_count} 条记录")
        logger.info("注意: 坐标顺序会自动从 (经度 纬度) 转换为 (纬度 经度)")

    # 执行迁移
    migrate_bfmap_ways()

    # 验证迁移结果
    mysql_count = count_mysql_records()

    if pg_count is not None and mysql_count is not None:
        if pg_count == mysql_count:
            logger.info("✓ 数据迁移验证成功，记录数一致")
        else:
            logger.warning(f"⚠ 记录数不一致: PG={pg_count}, MySQL={mysql_count}")
            logger.warning("可能原因: 部分记录的几何数据转换失败被跳过")

    logger.info("=" * 50)
    logger.info("bfmap_ways 表迁移完成")
    logger.info("=" * 50)