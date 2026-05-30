-- ==================================================================================
-- dwd_taxi_gps_point — 出租车GPS轨迹点明细表（基于道路长度+frac计算速度）
-- ==================================================================================
-- 血缘: trips → 展开数组 → 行级GPS轨迹点
-- 粒度: 一次行程的一个GPS点一行（不含最后一个点，因为需要计算到下一段的速度）
--
-- 核心计算逻辑：
--   速度计算基于道路长度 + frac 比例，而非经纬度距离
--
-- 速度计算公式：
--   同一路段内：距离 = abs(next_frac - curr_frac) * 道路长度
--   跨路段时：距离 = (1 - curr_frac) * 当前道路长度 + next_frac * 下一道路长度
--   速度(km/h) = 距离(米) / 1000 / (时间差(秒) / 3600)
-- ==================================================================================

INSERT INTO dwd_taxi_gps_point (
    trip_id,
    devid,
    trip_date,
    seq,
    gps_time,
    lon,
    lat,
    road_id,
    road_frac,
    arrive_time,
    next_gps_time,
    next_lon,
    next_lat,
    point_dist_m,
    point_dur_s,
    point_speed_kmh
)
SELECT
    -- 基础标识字段
    tr.trip_id,
    t.devid,
    tr.trip_date,
    s.n AS seq,

    -- 当前点信息
    FROM_UNIXTIME(CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))) AS gps_time,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.lon, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,8)) AS lon,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.lat, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,8)) AS lat,

    -- 当前点所在道路信息
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) AS road_id,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,6)) AS road_frac,
    FROM_UNIXTIME(CAST(JSON_UNQUOTE(JSON_EXTRACT(t.`time`, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))) AS arrive_time,

    -- 下一个点信息（用于计算速度）
    FROM_UNIXTIME(CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n, ']'))) AS DECIMAL(20,0))) AS next_gps_time,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.lon, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,8)) AS next_lon,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.lat, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,8)) AS next_lat,

    -- 时间差（秒）
    (CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n, ']'))) AS DECIMAL(20,0)) -
     CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))) AS point_dur_s,

    -- 行驶距离（米）
    CASE
        -- 同一路段内
        WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) =
             CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED) THEN
            ROUND(ABS(
                              CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,6)) -
                              CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,6))
                      ) * rc.length_m, 2)

        -- 跨路段：当前路段剩余 + 下一路段已走
        ELSE
            ROUND(
                            (1 - CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,6))) * rc_curr.length_m
                        + CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,6)) * rc_next.length_m
                , 2)
        END AS point_dist_m,

    -- 速度（km/h）= 距离(米)/1000 / (时间差(秒)/3600)
    ROUND(
            CASE
                -- 同一路段内
                WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) =
                     CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED) THEN
                            ABS(
                                        CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,6)) -
                                        CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,6))
                                ) * rc.length_m / 1000.0 /
                            NULLIF((
                                           CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n, ']'))) AS DECIMAL(20,0)) -
                                           CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))
                                       ) / 3600.0, 0)

                -- 跨路段
                ELSE
                        ((1 - CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,6))) * rc_curr.length_m
                            + CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,6)) * rc_next.length_m)
                        / 1000.0 /
                        NULLIF((
                                       CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n, ']'))) AS DECIMAL(20,0)) -
                                       CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))
                                   ) / 3600.0, 0)
                END, 2
        ) AS point_speed_kmh

FROM trips t
-- 关联行程主表获取trip_id
         INNER JOIN dwd_taxi_trip tr
                    ON t.devid = tr.devid AND t.file_name = tr.file_name
-- 使用已有的 seq 序列表
         INNER JOIN seq s ON s.n <= JSON_LENGTH(t.tms) - 1
-- 同一路段关联（当前点和下一个点在同一路段时使用）
         LEFT JOIN dim_road_segment rc
                   ON rc.road_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED)
                       AND CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) =
                           CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED)
-- 跨路段：当前路段
         LEFT JOIN dim_road_segment rc_curr
                   ON rc_curr.road_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED)
                       AND CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) !=
        CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED)
-- 跨路段：下一路段
LEFT JOIN dim_road_segment rc_next
ON rc_next.road_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED)
    AND CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) !=
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED)

WHERE t.devid IS NOT NULL
  AND t.tms IS NOT NULL
  AND TRIM(t.tms) != ''
  AND TRIM(t.tms) != '[]'
  AND JSON_LENGTH(t.tms) > 1
-- 过滤无效的道路ID
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) > 0
-- 确保关联到道路长度
  AND (
    (CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) =
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED) AND rc.length_m IS NOT NULL)
   OR
    (CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) !=
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED)
  AND rc_curr.length_m IS NOT NULL AND rc_next.length_m IS NOT NULL)
    )
-- 过滤异常时间差（0秒或过大，正常范围1-300秒）
  AND (CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n, ']'))) AS DECIMAL(20,0)) -
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))) BETWEEN 1 AND 300
-- 过滤异常速度（只保留0-120 km/h）
  AND ROUND(
    CASE
    WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n - 1, ']'))) AS UNSIGNED) =
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.roads, CONCAT('$[', s.n, ']'))) AS UNSIGNED) THEN
    ABS(
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,6)) -
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,6))
    ) * rc.length_m / 1000.0 /
    NULLIF((
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n, ']'))) AS DECIMAL(20,0)) -
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))
    ) / 3600.0, 0)
    ELSE
    ((1 - CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(10,6))) * rc_curr.length_m
    + CAST(JSON_UNQUOTE(JSON_EXTRACT(t.frac, CONCAT('$[', s.n, ']'))) AS DECIMAL(10,6)) * rc_next.length_m)
    / 1000.0 /
    NULLIF((
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n, ']'))) AS DECIMAL(20,0)) -
    CAST(JSON_UNQUOTE(JSON_EXTRACT(t.tms, CONCAT('$[', s.n - 1, ']'))) AS DECIMAL(20,0))
    ) / 3600.0, 0)
    END, 2
    ) BETWEEN 0 AND 120;

-- ==================================================================================
-- 补充说明
-- ==================================================================================
-- 1. 使用 JSON_UNQUOTE 去除 JSON 字符串的外层引号
-- 2. 直接使用已有的 seq 序列表（1-10000）
-- 3. 时间差过滤条件：1-300秒，排除异常数据
-- 4. 速度过滤：0-120 km/h，排除异常速度
-- 5. 道路长度必须存在，否则跳过该记录
-- 6. 速度单位：km/h，保留2位小数
-- ==================================================================================