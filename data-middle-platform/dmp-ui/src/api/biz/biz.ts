import { request } from '@/utils/hsj/service/index'

export function getTaxiList() {
  return request({ url: '/biz/taxi/list', method: 'get' })
}

export function getTripSummary(devId: string) {
  return request({ url: '/biz/taxi/summary', method: 'get', params: { devId } })
}

export function getTrajectory(tripId: number | string) {
  return request({
    url: '/biz/trip/trajectory',
    method: 'get',
    params: { tripId },
  })
}

/**
 * 获取职住通勤飞线数据
 */
export function getOdFlylines(startTime: string, endTime: string) {
  return request({
    url: '/biz/decision/od',
    method: 'get',
    params: { startTime, endTime },
  })
}

/**
 * 获取夜间经济热力图数据
 */
export function getNightHeatmap(startTime: string, endTime: string) {
  return request({
    url: '/biz/decision/night',
    method: 'get',
    params: { startTime, endTime },
  })
}
