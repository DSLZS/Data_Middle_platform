<script setup name="OdFlylineAnalysis">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import AMapLoader from '@amap/amap-jsapi-loader'
import { getOdFlylines } from '@/api/biz/biz' // 确保路径正确

const mapRef = ref(null)
let map = null
let loca = null
let pulseLineLayer = null
let baseLineLayer = null

const loading = ref(false)
const targetDate = ref('2015-01-03')
const peakType = ref('evening')
const weightLevel = ref(2)

// 日期限制
const disabledDate = (time) => {
  const start = new Date('2014-12-31').getTime()
  const end = new Date('2015-01-05').getTime()
  const currentTime = time.getTime()
  return currentTime < start || currentTime > end
}

// 获取并渲染数据
const fetchDataAndRender = async () => {
  loading.value = true

  // 匹配早晚高峰时段：后端按 startTime 查询，格式需补齐
  const timeRanges = {
    morning: ['07:00:00', '09:00:00'],
    evening: ['17:00:00', '19:00:00'],
  }

  const [start, end] = timeRanges[peakType.value]
  const startTime = `${targetDate.value} ${start}`
  const endTime = `${targetDate.value} ${end}`

  try {
    const res = await getOdFlylines(startTime, endTime, weightLevel.value)

    const data = res.data || []

    if (data.length === 0) {
      ElMessage.info(`${targetDate.value} 该时段暂无符合条件的通勤数据`)
      clearLayers()
      return
    }

    renderLocaFlylines(data)
    ElMessage.success(`成功加载 ${data.length} 条通勤走廊`)
  } catch (error) {
    console.error(error)
    ElMessage.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

// Loca 渲染引擎
const renderLocaFlylines = (rawData) => {
  if (!loca) return
  clearLayers()

  const geoData = {
    type: 'FeatureCollection',
    features: rawData.map((item) => ({
      type: 'Feature',
      properties: { weight: Number(item.weight) },
      geometry: {
        type: 'LineString',
        coordinates: [
          [item.startLon, item.startLat],
          [item.endLon, item.endLat],
        ],
      },
    })),
  }

  const geoSource = new window.Loca.GeoJSONSource({ data: geoData })

  // 基础底线
  baseLineLayer = new window.Loca.LineLayer({ loca, zIndex: 10 })
  baseLineLayer.setSource(geoSource)
  baseLineLayer.setStyle({ color: '#1c3983', lineWidth: 1, dashArray: [10, 5] })

  // 动态脉冲线
  pulseLineLayer = new window.Loca.PulseLineLayer({ loca, zIndex: 11 })
  pulseLineLayer.setSource(geoSource)
  pulseLineLayer.setStyle({
    lineWidth: (_, feature) => {
      const w = feature.properties.weight
      return w === 3 ? 6 : w === 2 ? 4 : 2
    },
    color: (_, feature) => {
      const w = feature.properties.weight
      if (w === 3) return '#ff4d4f'
      if (w === 2) return '#faad14'
      return '#1e90ff'
    },
    headColor: 'rgba(255, 255, 255, 1)',
    trailColor: 'rgba(0, 255, 255, 0)',
    interval: 1.5,
    duration: 2000,
  })

  // 自动适配视角
  map.setFitView()
  loca.animate.start()
}

const clearLayers = () => {
  if (baseLineLayer) loca.remove(baseLineLayer)
  if (pulseLineLayer) loca.remove(pulseLineLayer)
}

onMounted(async () => {
  window._AMapSecurityConfig = {
    securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JSCODE,
  }
  const AMap = await AMapLoader.load({
    key: import.meta.env.VITE_AMAP_KEY,
    version: '2.0',
    Loca: { version: '2.0.0' },
  })

  map = new AMap.Map(mapRef.value, {
    zoom: 12,
    center: [126.63, 45.75],
    viewMode: '3D',
    pitch: 45,
    mapStyle: 'amap://styles/darkblue',
  })
  loca = new window.Loca.Container({ map })
  fetchDataAndRender()
})

onUnmounted(() => {
  clearLayers()
  loca?.destroy()
  map?.destroy()
})
</script>

<template>
  <div class="od-layout">
    <div class="header-panel">
      <span class="panel-title">职住通勤高频走廊分析</span>
      <div class="filter-group">
        <el-date-picker
          v-model="targetDate"
          type="date"
          value-format="YYYY-MM-DD"
          :disabled-date="disabledDate"
          style="width: 160px"
        />
        <el-select v-model="peakType" style="width: 100px; margin: 0 10px">
          <el-option label="早高峰" value="morning" />
          <el-option label="晚高峰" value="evening" />
        </el-select>

        <el-select
          v-model="weightLevel"
          style="width: 110px; margin-right: 15px"
        >
          <el-option label="高频" :value="3" />
          <el-option label="中频" :value="2" />
          <el-option label="低频" :value="1" />
        </el-select>

        <el-button type="primary" :loading="loading" @click="fetchDataAndRender"
          >执行分析</el-button
        >
      </div>
    </div>
    <div ref="mapRef" class="map-container"></div>
  </div>
</template>

<style scoped lang="scss">
.od-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.header-panel {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0c152a;
  color: #fff;
  z-index: 10; /* 确保悬浮在地图上方 */
}
.map-container {
  flex: 1;
  width: 100%;
}
</style>
