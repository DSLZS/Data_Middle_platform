package com.dmp.biz.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("dwd_taxi_trip")
public class BizDwdTaxiTrip {
    @TableId(type = IdType.AUTO)
    private Long tripId;
    
    private String devid;
    private LocalDate tripDate;
    
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    
    private Double startLon;
    private Double startLat;
    private Double endLon;
    private Double endLat;
    
    // 基础统计指标
    private Integer gpsPointsCount;
    private Integer tripDurationS;
    private Double routeDistanceM;
}