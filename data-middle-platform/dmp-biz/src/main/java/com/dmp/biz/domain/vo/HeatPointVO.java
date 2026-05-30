package com.dmp.biz.domain.vo;

import lombok.Data;
import java.io.Serializable;

@Data
public class HeatPointVO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Double lon;
    private Double lat;
    
    /**
     * 该位置的活跃密度（强度）
     */
    private Long intensity;
}