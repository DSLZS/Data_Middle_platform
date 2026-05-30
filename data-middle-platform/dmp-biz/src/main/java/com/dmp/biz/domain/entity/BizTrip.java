package com.dmp.biz.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/**
 * 出租车GPS轨迹原始数据表
 */
@Data
@Slf4j
// 1. 去掉 autoResultMap = true，完全放弃底层的自动反序列化
@TableName(value = "trips")
public class BizTrip {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String fileName;

    private String devid;

    // 2. 所有原本会报错的 JSON 数组，统统改用 String 接收
    private String lon;
    private String lat;
    private String time;
    private String tms;
    private String roads;
    private String frac;
    private String route;
    private String routeHeading;
    private String routeGeom;

    private LocalDateTime createdAt;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * 获取解析后的经度数组
     */
    public List<Double> getLonList() {
        return parseDoubleList(this.lon);
    }

    /**
     * 获取解析后的纬度数组
     */
    public List<Double> getLatList() {
        return parseDoubleList(this.lat);
    }

    /**
     * 获取解析后的时间戳/时间数组
     */
    public List<Long> getTimeList() {
        if (this.time == null || this.time.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            // 第一层脱壳：将 "\"[123, 456]\"" 转为 "[123, 456]"
            String unquoted = MAPPER.readValue(this.time, String.class);
            // 第二层解析：转为 List<Long>
            return MAPPER.readValue(unquoted, new TypeReference<List<Long>>() {});
        } catch (JsonProcessingException e) {
            log.error("解析 time 数组失败, 原始数据: {}", this.time, e);
            return Collections.emptyList();
        }
    }

    /**
     * 内部通用的 Double 数组双层解析方法
     */
    private List<Double> parseDoubleList(String rawJson) {
        if (rawJson == null || rawJson.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            // 第一层脱壳：去除字符串外壳
            String unquoted = MAPPER.readValue(rawJson, String.class);
            // 第二层解析：转换为真实集合
            return MAPPER.readValue(unquoted, new TypeReference<List<Double>>() {});
        } catch (JsonProcessingException e) {
            log.error("解析 Double 数组失败, 原始数据: {}", rawJson, e);
            return Collections.emptyList();
        }
    }
}