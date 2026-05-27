INSERT INTO dwd_taxi_gps_point (
    trip_id, devid, trip_date, seq, gps_time, lon, lat,
    road_id, road_frac, arrive_time,
    next_gps_time, next_lon, next_lat,
    point_dist_m, point_dur_s, point_speed
)
SELECT
    tr.trip_id, t.devid, tr.trip_date, s.n,
    FROM_UNIXTIME(arr_get(t.tms, s.n) + 0),
    arr_get(t.lon, s.n) + 0, arr_get(t.lat, s.n) + 0,
    CASE WHEN s.n <= arr_len(t.roads) THEN arr_get(t.roads, s.n) + 0 END,
    CASE WHEN s.n <= arr_len(t.frac) THEN arr_get(t.frac, s.n) + 0 END,
    CASE WHEN s.n <= arr_len(t.`time`) THEN FROM_UNIXTIME(arr_get(t.`time`, s.n) + 0) END,
    CASE WHEN s.n < arr_len(t.tms) THEN FROM_UNIXTIME(arr_get(t.tms, s.n + 1) + 0) END,
    CASE WHEN s.n < arr_len(t.lon) THEN arr_get(t.lon, s.n + 1) + 0 END,
    CASE WHEN s.n < arr_len(t.lat) THEN arr_get(t.lat, s.n + 1) + 0 END,
    CASE WHEN s.n < arr_len(t.tms) THEN
             haversine_distance(
                         arr_get(t.lat, s.n) + 0, arr_get(t.lon, s.n) + 0,
                         arr_get(t.lat, s.n + 1) + 0, arr_get(t.lon, s.n + 1) + 0)
        END,
    CASE WHEN s.n < arr_len(t.tms) THEN
             TIMESTAMPDIFF(SECOND,
                     FROM_UNIXTIME(arr_get(t.tms, s.n) + 0),
                     FROM_UNIXTIME(arr_get(t.tms, s.n + 1) + 0))
        END,
    CASE WHEN s.n < arr_len(t.tms) THEN
             (haversine_distance(
                          arr_get(t.lat, s.n) + 0, arr_get(t.lon, s.n) + 0,
                          arr_get(t.lat, s.n + 1) + 0, arr_get(t.lon, s.n + 1) + 0) / 1000.0)
                 / NULLIF(TIMESTAMPDIFF(SECOND,
                                  FROM_UNIXTIME(arr_get(t.tms, s.n) + 0),
                                  FROM_UNIXTIME(arr_get(t.tms, s.n + 1) + 0)) / 3600.0, 0)
        END
FROM trips t
         JOIN dwd_taxi_trip tr ON t.devid = tr.devid AND t.file_name = tr.file_name
         JOIN seq s ON s.n <= arr_len(t.tms)
WHERE t.devid IS NOT NULL
  AND t.tms IS NOT NULL
  AND TRIM(t.tms) != ''
  AND TRIM(t.tms) != '[]';
