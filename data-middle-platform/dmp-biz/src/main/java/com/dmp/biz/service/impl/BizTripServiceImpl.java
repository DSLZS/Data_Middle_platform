package com.dmp.biz.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dmp.biz.domain.entity.BizTrip;
import com.dmp.biz.domain.vo.HeatPointVO;
import com.dmp.biz.domain.vo.TaxiOdFlylineVO;
import com.dmp.biz.domain.vo.TripPointVO;
import com.dmp.biz.domain.vo.TripSummaryVO;
import com.dmp.biz.mapper.BizDwdTaxiTripMapper;
import com.dmp.biz.mapper.BizTripMapper;
import com.dmp.biz.service.BizTripService;
import com.dmp.biz.utils.DouglasPeuckerUtil;
import com.dmp.biz.utils.GeoUtil;
import com.dmp.common.exception.GlobalException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BizTripServiceImpl extends ServiceImpl<BizTripMapper, BizTrip> implements BizTripService {

    private final BizDwdTaxiTripMapper bizDwdTaxiTripMapper;

    @Override
    public List<TripSummaryVO> getTripSummary(String devId) {
        if (StrUtil.isEmpty(devId)) {
            throw new GlobalException("查询行程失败，devId 为空");
        }

        List<BizTrip> trips = this.lambdaQuery()
                .select(BizTrip::getId, BizTrip::getDevid, BizTrip::getTime)
                .eq(BizTrip::getDevid, devId)
                .orderByDesc(BizTrip::getCreatedAt)
                .list();

        if (CollUtil.isEmpty(trips)) {
            return Collections.emptyList();
        }

        List<TripSummaryVO> summary = new ArrayList<>();

        for (BizTrip trip : trips) {
            List<Long> tmsList = trip.getTimeList();

            if (tmsList != null && !tmsList.isEmpty()) {
                TripSummaryVO vo = new TripSummaryVO();
                vo.setTripId(trip.getId());
                vo.setDevId(trip.getDevid());

                Long startTs = tmsList.get(0);
                vo.setStartTime(LocalDateTime.ofEpochSecond(startTs, 0, ZoneOffset.of("+8")));

                Long endTs = tmsList.get(tmsList.size() - 1);
                vo.setEndTime(LocalDateTime.ofEpochSecond(endTs, 0, ZoneOffset.of("+8")));

                summary.add(vo);
            }
        }

        return summary;
    }

    public List<TripPointVO> getTrajectory(Long tripId) {
        if (tripId == null) {
            throw new GlobalException("查询轨迹失败，行程 id 为空");
        }

        BizTrip trip = this.lambdaQuery()
                .select(BizTrip::getLon, BizTrip::getLat, BizTrip::getTime)
                .eq(BizTrip::getId, tripId)
                .one();

        if (trip == null || StrUtil.isEmpty(trip.getLon())) {
            return Collections.emptyList();
        }

        List<Double> lons = trip.getLonList();
        List<Double> lats = trip.getLatList();
        List<Long> tms = trip.getTimeList();

        if (CollUtil.isEmpty(lons) || CollUtil.isEmpty(lats)) {
            return Collections.emptyList();
        }

        int size = lons.size();
        List<TripPointVO> historyList = new ArrayList<>(size);
        ZoneOffset zoneOffset = ZoneOffset.of("+8");

        for (int i = 0; i < size; i++) {
            Double lon = lons.get(i);
            Double lat = lats.get(i);

            if (lon == null || lat == null) {
                continue; // 跳过当前循环，不加入集合
            }

            if (tms == null || i >= tms.size() || tms.get(i) == null || tms.get(i) <= 0) {
                continue; // 丢弃这个没有时间的“幽灵点位”
            }

            TripPointVO vo = new TripPointVO();
            double[] gcj02 = GeoUtil.wgs84ToGcj02(lon, lat);

            vo.setLongitude(gcj02[0]);
            vo.setLatitude(gcj02[1]);
            vo.setTs(LocalDateTime.ofEpochSecond(tms.get(i), 0, zoneOffset));

            historyList.add(vo);
        }

        if (historyList.size() < 2) {
            return historyList;
        }

        return DouglasPeuckerUtil.simplify(historyList, 1);
    }

    @Override
    public List<TaxiOdFlylineVO> getCommuteCorridors(String startTime, String endTime) {

        // 1. 定义时间格式化工具
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        // 2. 将字符串转为 LocalDateTime
        LocalDateTime start = LocalDateTime.parse(startTime, formatter);
        LocalDateTime end = LocalDateTime.parse(endTime, formatter);

        // 3. 执行偏移：开始时间 -2小时，结束时间 +2小时
        LocalDateTime adjustedStart = start.minusHours(2);
        LocalDateTime adjustedEnd = end.plusHours(2);

        // 4. 转回字符串传给 Mapper (确保格式与数据库 datetime 一致)
        String start1 = adjustedStart.format(formatter);
        String end1 = adjustedEnd.format(formatter);
        return bizDwdTaxiTripMapper.getCommuteCorridors(
                start1,
                end1
        );
    }

    @Override
    public List<HeatPointVO> getNightEconomyHeatmap(String startTime, String endTime) {
        startTime = "2015-01-03 13:00:00";
        endTime = "2015-01-04 00:00:00";
        return bizDwdTaxiTripMapper.getNightEconomyHeatmap(startTime, endTime);
    }
}