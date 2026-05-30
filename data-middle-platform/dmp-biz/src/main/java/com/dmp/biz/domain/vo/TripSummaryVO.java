package com.dmp.biz.domain.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class TripSummaryVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 行程记录的数据库ID
     */
    private Long tripId;

    /**
     * 设备ID (新增)
     */
    private String devId;

    /**
     * 行程开始时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startTime;

    /**
     * 行程结束时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endTime;
}