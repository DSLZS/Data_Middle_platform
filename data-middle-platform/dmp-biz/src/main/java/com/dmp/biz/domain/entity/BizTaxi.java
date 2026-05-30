package com.dmp.biz.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;

/**
 * 出租车维度表
 */
@Data
@TableName("dim_taxi")
public class BizTaxi implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 出租车ID
     */
    @TableId(type = IdType.INPUT)
    private String taxiId;

    /**
     * 首次出现日期
     */
    private LocalDate firstSeen;

    /**
     * 最后出现日期
     */
    private LocalDate lastSeen;
}