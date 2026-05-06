-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX idx_dwd_trip_devid_date ON dwd_taxi_trip(devid, trip_date);
CREATE INDEX idx_dwd_gps_devid_date ON dwd_taxi_gps_point(devid, trip_date);
CREATE INDEX idx_dwd_gps_road ON dwd_taxi_gps_point(road_id);
CREATE INDEX idx_dwd_road_devid_date ON dwd_taxi_road_segment(devid, trip_date);
CREATE INDEX idx_dwd_road_road_id ON dwd_taxi_road_segment(road_id);
CREATE INDEX idx_dwm_taxi_date ON dwm_taxi_daily_stats(stat_date);
CREATE INDEX idx_dwm_road_date ON dwm_road_segment_daily(stat_date);
CREATE INDEX idx_dwm_od_date ON dwm_od_flow_daily(stat_date);
CREATE INDEX idx_dwm_hourly_date ON dwm_road_hourly_speed(stat_date);
CREATE INDEX idx_dws_traffic_hour ON dws_road_traffic(stat_date, stat_hour);
CREATE INDEX idx_dws_class_date ON dws_road_class_analysis(stat_date);
CREATE INDEX idx_dws_hotspot_date ON dws_hotspot_analysis(stat_date);
