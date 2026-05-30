package com.dmp.web.controller.biz;

import com.dmp.biz.service.BizTaxiService;
import com.dmp.biz.service.BizTripService;
import com.dmp.common.core.domain.AjaxResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/biz")
@RequiredArgsConstructor
public class BizController {

    private final BizTripService bizTripService;
    private final BizTaxiService bizTaxiService;

    @GetMapping("/taxi/list")
    public AjaxResult getTaxiList() {
        return AjaxResult.success(bizTaxiService.getTaxiList());
    }

    @GetMapping("/taxi/summary")
    public AjaxResult getTripSummary(String devId) {
        return AjaxResult.success(bizTripService.getTripSummary(devId));
    }

    @GetMapping("/trip/trajectory")
    public AjaxResult getTrajectory(Long tripId) {
        return AjaxResult.success(bizTripService.getTrajectory(tripId));
    }

    @GetMapping("/decision/od")
    public AjaxResult getOdFlylines(
            @RequestParam("startTime") String startTime,
            @RequestParam("endTime") String endTime,
            @RequestParam(value = "weightLevel", required = false, defaultValue = "2") Integer weightLevel) {
        return AjaxResult.success(bizTripService.getCommuteCorridors(startTime, endTime, weightLevel));
    }

    @GetMapping("/decision/night")
    public AjaxResult getNight(@RequestParam String startTime, @RequestParam String endTime) {
        return AjaxResult.success(bizTripService.getNightEconomyHeatmap(startTime, endTime));
    }
}
