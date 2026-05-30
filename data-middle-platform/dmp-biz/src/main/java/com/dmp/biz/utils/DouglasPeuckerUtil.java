package com.dmp.biz.utils;

import com.dmp.biz.domain.vo.TripPointVO;

import java.util.ArrayList;
import java.util.List;

public class DouglasPeuckerUtil {

    /**
     * 对轨迹进行抽稀 (2D 版本)
     * @param points 原始轨迹点集
     * @param tolerance 容差阈值（单位：米。建议设置为 1.0 ~ 5.0，值越大抽稀越狠）
     * @return 抽稀后的轨迹点集
     */
    public static List<TripPointVO> simplify(List<TripPointVO> points, double tolerance) {
        if (points == null || points.size() <= 2) {
            return points;
        }

        List<TripPointVO> result = new ArrayList<>();
        // 递归压缩
        compressLine(points, result, tolerance, 0, points.size() - 1);
        // 添加最后一个终点 (递归中没有包含)
        result.add(points.get(points.size() - 1));

        return result;
    }

    private static void compressLine(List<TripPointVO> points, List<TripPointVO> result, double tolerance, int start, int end) {
        if (start >= end) {
            return;
        }

        // 把起点加进去
        if (result.isEmpty() || result.get(result.size() - 1) != points.get(start)) {
            result.add(points.get(start));
        }

        if (start + 1 == end) {
            return;
        }

        double maxDistance = 0.0;
        int maxIndex = start;

        // 找到距离 start 和 end 连线最远的那个点
        for (int i = start + 1; i < end; i++) {
            double distance = getPointToLineDistance(
                    points.get(start),
                    points.get(end),
                    points.get(i)
            );
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        // 如果最大距离大于容差阈值，保留该点，并递归处理左右两段
        if (maxDistance > tolerance) {
            compressLine(points, result, tolerance, start, maxIndex);
            compressLine(points, result, tolerance, maxIndex, end);
        }
    }

    /**
     * 计算 2D 空间中点到直线的距离 (基于经度、纬度进行近似平面投影)
     */
    private static double getPointToLineDistance(TripPointVO start, TripPointVO end, TripPointVO point) {
        // 防止空指针异常，确保经纬度不为空
        if (start.getLatitude() == null || start.getLongitude() == null ||
                end.getLatitude() == null || end.getLongitude() == null ||
                point.getLatitude() == null || point.getLongitude() == null) {
            return 0.0;
        }

        // 提取基准纬度的 cos 值（投影变形补偿）
        double cosLat = Math.cos(Math.toRadians(start.getLatitude()));

        // 将经纬度统一转换为米 (m) 作为 2D 直角坐标系 (x, y)
        // 1纬度约等于 111000 米，经度受所在纬度影响需要乘 cosLat
        double x1 = start.getLongitude() * 111000 * cosLat;
        double y1 = start.getLatitude() * 111000;

        double x2 = end.getLongitude() * 111000 * cosLat;
        double y2 = end.getLatitude() * 111000;

        double x0 = point.getLongitude() * 111000 * cosLat;
        double y0 = point.getLatitude() * 111000;

        // 构造向量 v = 起点指向终点 (P1 -> P2)
        double vx = x2 - x1;
        double vy = y2 - y1;

        // 构造向量 w = 起点指向当前点 (P1 -> P0)
        double wx = x0 - x1;
        double wy = y0 - y1;

        // 计算向量 v 的模长平方 |v|^2
        double vLengthSq = vx * vx + vy * vy;
        if (vLengthSq == 0.0) {
            // 起点和终点坐标完全重合，则直线退化为点，直接返回 P0 到 P1 的两点间平面距离
            return Math.sqrt(wx * wx + wy * wy);
        }

        // 2D 平面下的向量叉乘绝对值 c = |wx * vy - wy * vx| (以 w 和 v 为邻边的平行四边形的面积)
        double crossProductArea = Math.abs(wx * vy - wy * vx);

        // 点到直线距离 d = 面积 / 底边长 = 面积 / |v|
        return crossProductArea / Math.sqrt(vLengthSq);
    }
}