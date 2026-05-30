package com.dmp.biz.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dmp.biz.domain.entity.BizTrip;
import com.dmp.biz.domain.vo.HeatPointVO;
import com.dmp.biz.domain.vo.TaxiOdFlylineVO;
import com.dmp.biz.domain.vo.TripPointVO;
import com.dmp.biz.domain.vo.TripSummaryVO;

import java.util.List;

public interface BizTripService extends IService<BizTrip> {

    public List<TripPointVO> getTrajectory(Long tripId);

    public List<TripSummaryVO> getTripSummary(String devId);

    List<TaxiOdFlylineVO> getCommuteCorridors(String startTime, String endTime, Integer weightLevel);

    public List<HeatPointVO> getNightEconomyHeatmap(String startTime, String endTime);
}
