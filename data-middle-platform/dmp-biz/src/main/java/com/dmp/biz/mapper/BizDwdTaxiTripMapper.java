package com.dmp.biz.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dmp.biz.domain.entity.BizDwdTaxiTrip;
import com.dmp.biz.domain.vo.HeatPointVO;
import com.dmp.biz.domain.vo.TaxiOdFlylineVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface BizDwdTaxiTripMapper extends BaseMapper<BizDwdTaxiTrip> {

    // OD 飞线数据聚合
    List<TaxiOdFlylineVO> getCommuteCorridors(
            @Param("start") String start,
            @Param("end") String end,
            @Param("weightLevel") Integer weightLevel
    );
    // 夜间热力点位聚合
    List<HeatPointVO> getNightEconomyHeatmap(@Param("start") String start, @Param("end") String end);
}
