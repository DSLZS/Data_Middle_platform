#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PostgreSQL to MySQL Migration Script - trips table
!! IMPORTANT !! Install dependencies:
pip install psycopg2-binary pymysql

Run: python migrate_trips.py
"""

import sys
import psycopg2
import pymysql
import logging
import json
import re
from datetime import datetime

# ==================== 配置信息 - 请修改以下内容 ====================

# PostgreSQL 源数据库配置
PG_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'harbin',
    'user': 'postgres',
    'password': 'postgres'
}

# MySQL 目标数据库配置
MYSQL_CONFIG = {
    'host': '43.138.221.56',
    'port': 3310,
    'database': 'data-middle-platform',
    'user': 'root',
    'password': '4BhCa5DoeB7FTyat'
}

# 批量插入大小
BATCH_SIZE = 5000  # 增大批次以减少网络往返

# 日志配置
LOG_LEVEL = logging.INFO

# ==================== 配置信息结束 ====================

# 配置日志
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migrate_trips.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# MySQL 建表语句
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `trips` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `file_name` varchar(255) DEFAULT NULL COMMENT '源文件名',
  `lon` json DEFAULT NULL COMMENT '经度数组',
  `lat` json DEFAULT NULL COMMENT '纬度数组',
  `tms` json DEFAULT NULL COMMENT '时间戳数组(Unix timestamp)',
  `devid` varchar(100) DEFAULT NULL COMMENT '设备ID',
  `roads` json DEFAULT NULL COMMENT '路段ID数组',
  `time` json DEFAULT NULL COMMENT '时间字符串数组',
  `frac` json DEFAULT NULL COMMENT '行驶比例数组',
  `route` json DEFAULT NULL COMMENT '路线ID数组',
  `route_heading` json DEFAULT NULL COMMENT '方向信息数组',
  `route_geom` longtext DEFAULT NULL COMMENT '路线几何(WKT格式)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_devid` (`devid`),
  KEY `idx_file_name` (`file_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='出租车GPS轨迹原始数据表'
"""

# 插入数据的 SQL 语句
INSERT_SQL = """
INSERT INTO `trips` 
(`file_name`, `lon`, `lat`, `tms`, `devid`, `roads`, `time`, `frac`, `route`, `route_heading`, `route_geom`) 
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""


def create_mysql_table(mysql_conn):
    """在 MySQL 中创建表（先删除旧表再重新创建）"""
    logger.info("删除旧表（如果存在）...")
    try:
        with mysql_conn.cursor() as cursor:
            # 方案A：先删除旧表，确保字段类型正确
            cursor.execute("DROP TABLE IF EXISTS trips")
            mysql_conn.commit()
            logger.info("旧表删除成功")
            
            # 创建新表
            logger.info("创建 MySQL 表...")
            cursor.execute(CREATE_TABLE_SQL)
        mysql_conn.commit()
        logger.info("MySQL 表创建成功")
    except Exception as e:
        logger.error(f"创建 MySQL 表失败: {e}")
        raise


def parse_pg_array_to_json(array_text):
    """
    将 PostgreSQL 的数组文本转换为 JSON 数组
    PostgreSQL 数组格式: '{1,2,3}' 或 '{a,b,c}'
    转换为 JSON: [1, 2, 3] 或 ["a", "b", "c"]
    """
    if array_text is None:
        return None

    # 处理空数组
    if array_text == '{}' or array_text == '':
        return json.dumps([])

    try:
        # 去掉花括号
        array_text = array_text.strip()
        if not array_text.startswith('{'):
            # 如果不是数组格式，可能是普通字符串
            return json.dumps(array_text)

        content = array_text[1:-1]  # 去掉 { 和 }

        if not content:
            return json.dumps([])

        # 分割数组元素
        # 注意：PG 数组可能包含引号，如 {"a","b"}
        # 简单处理：按逗号分割，去除引号
        elements = []
        for elem in content.split(','):
            elem = elem.strip()
            # 去除可能存在的引号
            if elem.startswith('"') and elem.endswith('"'):
                elem = elem[1:-1]
            # 尝试转换为数字
            try:
                # 如果是数字，转成数字类型
                if '.' in elem:
                    elements.append(float(elem))
                else:
                    elements.append(int(elem))
            except ValueError:
                # 不是数字，保持字符串
                elements.append(elem)

        return json.dumps(elements, ensure_ascii=False)

    except Exception as e:
        logger.warning(f"解析数组失败: {array_text[:100]}, 错误: {e}")
        return json.dumps([])


def parse_route_geom(geom_text):
    """
    处理 route_geom 字段
    PostgreSQL 可能存储为 WKT 格式或 EWKB 十六进制
    """
    if geom_text is None:
        return None

    try:
        # 如果已经是 WKT 格式，直接返回
        if isinstance(geom_text, str) and geom_text.startswith('LINESTRING'):
            # 需要转换坐标顺序吗？
            # 根据之前的经验，route_geom 可能也需要交换坐标
            # 这里假设已经正确，如果需要可以调用 convert_linestring_to_wkt
            return geom_text

        return geom_text

    except Exception as e:
        logger.warning(f"解析 route_geom 失败: {e}")
        return None


def migrate_trips():
    """迁移 trips 表数据"""

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

        # 可选：清空表
        # logger.info("清空 MySQL trips 表...")
        # mysql_cursor.execute("TRUNCATE TABLE trips")
        # mysql_conn.commit()

        # 使用服务器端游标进行流式查询
        logger.info("创建服务器端游标进行流式查询...")
        pg_cursor = pg_conn.cursor(name='trips_cursor')

        # 查询 PostgreSQL 中的数据 - trips表字段是text类型，存储数组字符串
        query = """
            SELECT 
                file_name,
                lon,
                lat,
                tms,
                devid,
                roads,
                "time",
                frac,
                route,
                route_heading,
                route_geom
            FROM trips
        """

        logger.info("开始从 PostgreSQL 读取数据...")
        pg_cursor.execute(query)

        total_count = 0
        batch_data = []
        error_count = 0
        row_count = 0

        # 预编译正则表达式，避免重复编译
        import re
        pg_array_pattern = re.compile(r'^\{(.*)\}$')
        number_pattern = re.compile(r'^-?\d+\.?\d*$')

        # 逐行读取并批量插入
        for row in pg_cursor:
            row_count += 1
            
            # 每5000条记录输出进度
            if row_count % 5000 == 0:
                logger.info(f"正在处理第 {row_count} 条记录...")

            (file_name_val, lon_val, lat_val, tms_val, devid_val,
             roads_val, time_val, frac_val, route_val, route_heading_val,
             route_geom_val) = row

            try:
                # 快速解析数组字符串 - 使用正则匹配
                def parse_array(arr_str):
                    if not arr_str:
                        return '[]'
                    match = pg_array_pattern.match(arr_str)
                    if not match:
                        # 不是数组格式，作为字符串处理
                        return json.dumps(str(arr_str))
                    content = match.group(1)
                    if not content:
                        return '[]'
                    
                    # 分割元素并转换类型
                    elements = []
                    for elem in content.split(','):
                        elem = elem.strip().strip('"')
                        if number_pattern.match(elem):
                            if '.' in elem:
                                elements.append(float(elem))
                            else:
                                elements.append(int(elem))
                        else:
                            elements.append(elem)
                    return json.dumps(elements)

                # 转换各个字段
                lon_json = parse_array(lon_val)
                lat_json = parse_array(lat_val)
                tms_json = parse_array(tms_val)
                roads_json = parse_array(roads_val)
                time_json = parse_array(time_val)
                frac_json = parse_array(frac_val)
                route_json = parse_array(route_val)
                route_heading_json = parse_array(route_heading_val)

                # route_geom 处理
                route_geom_text = route_geom_val if (route_geom_val and isinstance(route_geom_val, str)) else None

                # 添加到批次数据
                batch_data.append((
                    file_name_val,
                    lon_json,
                    lat_json,
                    tms_json,
                    devid_val,
                    roads_json,
                    time_json,
                    frac_json,
                    route_json,
                    route_heading_json,
                    route_geom_text
                ))

            except Exception as e:
                error_count += 1
                if error_count <= 10:
                    logger.warning(f"处理记录失败 (file_name: {file_name_val}): {e}")
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
            logger.warning(f"共有 {error_count} 条记录处理失败，已跳过")

        logger.info(f"迁移完成！共迁移 {total_count} 条记录")

    except Exception as e:
        logger.error(f"迁移过程中发生错误: {e}")
        if mysql_conn:
            mysql_conn.rollback()
        raise

    finally:
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
        cursor.execute("SELECT COUNT(*) FROM trips")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"PostgreSQL trips 表共有 {count} 条记录")
        return count
    except Exception as e:
        logger.error(f"统计 PostgreSQL 记录数失败: {e}")
        return None


def count_mysql_records():
    """统计 MySQL 中的记录数"""
    try:
        conn = pymysql.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM trips")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        logger.info(f"MySQL trips 表共有 {count} 条记录")
        return count
    except Exception as e:
        logger.error(f"统计 MySQL 记录数失败: {e}")
        return None


def sample_data_check():
    """检查 PostgreSQL 中的数据样例"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT file_name, devid, lon, roads, frac
            FROM trips 
            LIMIT 3
        """)

        logger.info("PostgreSQL trips 表样例数据:")
        for row in cursor.fetchall():
            logger.info(f"  file_name: {row[0]}, devid: {row[1]}")
            logger.info(f"    lon: {row[2][:100] if row[2] else 'NULL'}...")
            logger.info(f"    roads: {row[3][:100] if row[3] else 'NULL'}...")
            logger.info(f"    frac: {row[4][:100] if row[4] else 'NULL'}...")

        cursor.close()
        conn.close()

    except Exception as e:
        logger.error(f"检查样例数据失败: {e}")


if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("开始迁移 trips 表数据")
    logger.info("=" * 50)

    # 显示样例数据
    sample_data_check()

    # 显示源数据库记录数
    pg_count = count_pg_records()

    if pg_count is not None:
        logger.info(f"准备迁移 {pg_count} 条记录")

    # 执行迁移
    migrate_trips()

    # 验证迁移结果
    mysql_count = count_mysql_records()

    if pg_count is not None and mysql_count is not None:
        if pg_count == mysql_count:
            logger.info("✓ 数据迁移验证成功，记录数一致")
        else:
            logger.warning(f"⚠ 记录数不一致: PG={pg_count}, MySQL={mysql_count}")

    logger.info("=" * 50)
    logger.info("trips 表迁移完成")
    logger.info("=" * 50)