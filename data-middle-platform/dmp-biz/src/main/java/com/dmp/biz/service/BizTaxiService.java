package com.dmp.biz.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dmp.biz.domain.entity.BizTaxi;
import com.dmp.biz.domain.entity.BizTrip;

import java.util.List;

public interface BizTaxiService extends IService<BizTaxi> {
    List<BizTaxi> getTaxiList();
}
