package com.dmp.biz.utils;

import java.math.BigDecimal;

/**
 * 坐标转换工具类
 */
public final class GeoUtil {

    /**
     * 长半轴
     */
    private static final double A = 6378245.0;

    /**
     * 偏心率平方
     */
    private static final double EE = 0.00669342162296594323;

    /**
     * 圆周率
     */
    private static final double PI = Math.PI;

    private GeoUtil() {
    }

    /**
     * 判断坐标是否在中国范围外。
     *
     * @param lng 经度
     * @param lat 纬度
     * @return true-中国范围外，false-中国范围内
     */
    public static boolean outOfChina(double lng, double lat) {
        return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
    }

    /**
     * 判断坐标是否在中国范围外。
     *
     * @param lng 经度
     * @param lat 纬度
     * @return true-中国范围外，false-中国范围内
     */
    public static boolean outOfChina(BigDecimal lng, BigDecimal lat) {
        if (lng == null || lat == null) {
            return true;
        }
        return outOfChina(lng.doubleValue(), lat.doubleValue());
    }

    /**
     * WGS84 转 GCJ-02。
     *
     * @param lng WGS84 经度
     * @param lat WGS84 纬度
     * @return 转换后的 GCJ-02 坐标，数组下标 0 为经度，下标 1 为纬度
     */
    public static double[] wgs84ToGcj02(double lng, double lat) {
        if (outOfChina(lng, lat)) {
            return new double[]{lng, lat};
        }

        double dLat = transformLat(lng - 105.0, lat - 35.0);
        double dLng = transformLng(lng - 105.0, lat - 35.0);

        double radLat = lat / 180.0 * PI;
        double magic = Math.sin(radLat);
        magic = 1 - EE * magic * magic;
        double sqrtMagic = Math.sqrt(magic);

        dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
        dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

        double mgLat = lat + dLat;
        double mgLng = lng + dLng;
        return new double[]{mgLng, mgLat};
    }

    /**
     * WGS84 转 GCJ-02。
     *
     * @param lng WGS84 经度
     * @param lat WGS84 纬度
     * @return 转换后的 GCJ-02 坐标，数组下标 0 为经度，下标 1 为纬度
     */
    public static BigDecimal[] wgs84ToGcj02(BigDecimal lng, BigDecimal lat) {
        if (lng == null || lat == null) {
            return new BigDecimal[]{lng, lat};
        }

        double[] result = wgs84ToGcj02(lng.doubleValue(), lat.doubleValue());
        return new BigDecimal[]{
                BigDecimal.valueOf(result[0]),
                BigDecimal.valueOf(result[1])
        };
    }

    /**
     * 纬度转换辅助方法。
     *
     * @param lng 经度偏移量
     * @param lat 纬度偏移量
     * @return 纬度偏移值
     */
    private static double transformLat(double lng, double lat) {
        double ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat
                + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320.0 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    /**
     * 经度转换辅助方法。
     *
     * @param lng 经度偏移量
     * @param lat 纬度偏移量
     * @return 经度偏移值
     */
    private static double transformLng(double lng, double lat) {
        double ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng
                + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
        ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
        return ret;
    }
}