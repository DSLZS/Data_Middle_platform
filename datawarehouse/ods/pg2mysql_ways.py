#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PostgreSQL to MySQL Migration Script - ways table
!! IMPORTANT !! Install dependencies:
pip install psycopg2-binary pymysql

Run: python migrate_ways.py
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
        logging.FileHandler('migrate_ways.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# MySQL 建表语句（如果表不存在则创建）
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `ways` (
  `id` bigint NOT NULL COMMENT '道路ID，主键',
  `version` int NOT NULL COMMENT '版本号',
  `user_id` int NOT NULL COMMENT '用户ID',
  `tstamp` datetime NOT NULL COMMENT '时间戳',
  `changeset_id` bigint NOT NULL COMMENT '变更集ID',
  `tags` json DEFAULT NULL COMMENT '属性标签，使用JSON存储键值对',
  `nodes` json DEFAULT NULL COMMENT '节点数组，存储组成该道路的节点ID序列',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='原始道路信息表'
"""

# 插入数据的 SQL 语句
INSERT_SQL = """
INSERT INTO `ways` 
(`id`, `version`, `user_id`, `tstamp`, `changeset_id`, `tags`, `nodes`) 
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
`version` = VALUES(`version`),
`user_id` = VALUES(`user_id`),
`tstamp` = VALUES(`tstamp`),
`changeset_id` = VALUES(`changeset_id`),
`tags` = VALUES(`tags`),
`nodes` = VALUES(`nodes`)
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


def convert_hstore_to_json(hstore_value):
    """
    将 PostgreSQL 的 hstore 类型转换为 JSON 字符串
    hstore 格式: '"key1"=>"value1", "key2"=>"value2"'
    转换为 JSON: {"key1": "value1", "key2": "value2"}
    """
    if hstore_value is None:
        return None

    # 处理空 hstore
    if hstore_value == '':
        return None

    # 解析 hstore 字符串
    # 格式: "key1"=>"value1", "key2"=>"value2"
    result = {}

    # 正则表达式匹配键值对
    # 匹配模式: "key"=>"value" 或 "key"=>NULL
    pattern = r'"([^"]+)"=>(?:"([^"]*)"|NULL)'

    import re
    for match in re.finditer(pattern, hstore_value):
        key = match.group(1)
        value = match.group(2) if match.group(2) is not None else None
        result[key] = value

    return json.dumps(result) if result else None


def convert_nodes_array(nodes_value):
    """
    将 PostgreSQL 的数组类型（bigint[]）转换为 JSON 数组
    PostgreSQL 数组格式: '{123,456,789}'
    转换为 JSON: [123, 456, 789]
    """
    if nodes_value is None:
        return None

    # 处理空数组
    if nodes_value == '{}' or nodes_value == {}:
        return json.dumps([])

    try:
        # 如果已经是列表，直接处理
        if isinstance(nodes_value, list):
            return json.dumps(nodes_value)

        # 如果是字符串格式的数组，如 '{123,456,789}'
        if isinstance(nodes_value, str):
            # 去掉花括号
            nodes_str = nodes_value.strip('{}')
            if not nodes_str:
                return json.dumps([])

            # 分割字符串并转换为整数列表
            nodes_list = [int(x.strip()) for x in nodes_str.split(',')]
            return json.dumps(nodes_list)

        # 如果是其他类型，尝试转换
        return json.dumps(nodes_value)

    except Exception as e:
        logger.warning(f"转换节点数组失败: {nodes_value}, 错误: {e}")
        return json.dumps([])


def migrate_ways():
    """迁移 ways 表数据"""

    pg_conn = None
    mysql_conn = None
    pg_cursor = None
    mysql_cursor = None

    try:
        # 连接 PostgreSQL
        logger.info("正在连接 PostgreSQL...")
        # 设置 client_encoding 为 UTF8，避免编码问题
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

        # 查询 PostgreSQL 中的数据 - 在SQL端完成所有转换
        query = """
            SELECT 
                id, 
                version, 
                user_id, 
                tstamp, 
                changeset_id,
                -- 在SQL端将hstore转为JSON
                hstore_to_json(tags)::text as tags_json,
                -- 在SQL端将数组转为JSON数组
                array_to_json(nodes)::text as nodes_json
            FROM ways
        """

        logger.info("开始从 PostgreSQL 读取数据...")
        pg_cursor.execute(query)

        total_count = 0
        batch_data = []

        # 逐行读取并批量插入 - 数据已在SQL端完成转换
        for row in pg_cursor:
            id_val, version_val, user_id_val, tstamp_val, changeset_id_val, tags_json, nodes_json = row

            # 处理时间戳
            if isinstance(tstamp_val, datetime):
                tstamp_str = tstamp_val.strftime('%Y-%m-%d %H:%M:%S')
            else:
                tstamp_str = tstamp_val

            # 直接添加数据（tags和nodes已在SQL端转换完成）
            batch_data.append((
                id_val,
                version_val,
                user_id_val,
                tstamp_str,
                changeset_id_val,
                tags_json,
                nodes_json
            ))

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
        cursor.execute("SELECT COUNT(*) FROM ways")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"PostgreSQL ways 表共有 {count} 条记录")
        return count
    except Exception as e:
        logger.error(f"统计 PostgreSQL 记录数失败: {e}")
        return None


def count_mysql_records():
    """统计 MySQL 中的记录数（可选，用于验证）"""
    try:
        conn = pymysql.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM ways")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"MySQL ways 表共有 {count} 条记录")
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
            SELECT id, tags, nodes 
            FROM ways 
            LIMIT 5
        """)

        logger.info("PostgreSQL ways 表样例数据:")
        for row in cursor.fetchall():
            logger.info(f"  ID: {row[0]}")
            logger.info(f"    tags: {row[1][:100] if row[1] else 'NULL'}...")
            logger.info(f"    nodes: {row[2][:100] if row[2] else 'NULL'}...")

        cursor.close()
        conn.close()

    except Exception as e:
        logger.error(f"检查样例数据失败: {e}")


if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("开始迁移 ways 表数据")
    logger.info("=" * 50)

    # 显示样例数据（可选）
    sample_data_check()

    # 显示源数据库记录数
    pg_count = count_pg_records()

    if pg_count is not None:
        logger.info(f"准备迁移 {pg_count} 条记录")

    # 执行迁移
    migrate_ways()

    # 验证迁移结果
    mysql_count = count_mysql_records()

    if pg_count is not None and mysql_count is not None:
        if pg_count == mysql_count:
            logger.info("✓ 数据迁移验证成功，记录数一致")
        else:
            logger.warning(f"⚠ 记录数不一致: PG={pg_count}, MySQL={mysql_count}")

    logger.info("=" * 50)
    logger.info("ways 表迁移完成")
    logger.info("=" * 50)