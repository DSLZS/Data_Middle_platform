package com.dmp.biz.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dmp.biz.domain.entity.BizTaxi;
import com.dmp.biz.mapper.BizTaxiMapper;
import com.dmp.biz.service.BizTaxiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BizTaxiServiceImpl extends ServiceImpl<BizTaxiMapper, BizTaxi> implements BizTaxiService {

    @Override
    public List<BizTaxi> getTaxiList() {
        return this.list();
    }
}
