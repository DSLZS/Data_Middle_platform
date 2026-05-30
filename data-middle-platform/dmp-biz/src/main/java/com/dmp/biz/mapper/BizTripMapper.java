package com.dmp.biz.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dmp.biz.domain.entity.BizTrip;
import com.dmp.biz.domain.vo.TaxiOdFlylineVO;
import io.lettuce.core.dynamic.annotation.Param;

import java.util.List;

public interface BizTripMapper extends BaseMapper<BizTrip> {
    /**
     * 聚合查询出租车 OD 飞线数据
     * GeoHash 长度为 5 时，网格大小约为 4.9km x 4.9km；长度为 6 时，约为 1.2km x 0.6km
     */
    List<TaxiOdFlylineVO> getTaxiOdAggregatedLines(
            @Param("startTime") String startTime,
            @Param("endTime") String endTime,
            @Param("limit") int limit
    );
}
