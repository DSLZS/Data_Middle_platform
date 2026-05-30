package com.dmp.biz.domain.vo;

import lombok.Data;
import java.io.Serializable;

@Data
public class TaxiOdFlylineVO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Double startLon;
    private Double startLat;
    private Double endLon;
    private Double endLat;

    /**
     * 该路径的行驶次数（权重）
     */
    private Long weight;
}