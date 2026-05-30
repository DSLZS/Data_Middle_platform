<script setup name="NightHeatmapAnalysis">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import AMapLoader from '@amap/amap-jsapi-loader'
import { getNightHeatmap } from '@/api/biz/biz'

const mapRef = ref(null)
let map = null
let loca = null
let heatLayer = null

const loading = ref(false)
const targetDate = ref('2015-01-05')

// 获取数据逻辑
const fetchDataAndRender = async () => {
  loading.value = true
  // 夜间时段：21点到次日2点
  const startTime = `${targetDate.value} 21:00:00`
  const endTime = `${targetDate.value} 23:59:59` // 简化，也可后端处理跨日

  try {
    const res = await getNightHeatmap(startTime, endTime)
    const data = res.data || []

    if (data.length === 0) {
      ElMessage.info(`${targetDate.value} 深夜暂无出行记录`)
      clearLayers()
      return
    }

    renderHeatmap(data)
    ElMessage.success(`渲染了 ${data.length} 个活跃热点`)
  } catch (error) {
    ElMessage.error('加载热力数据失败')
  } finally {
    loading.value = false
  }
}

// 热力图渲染引擎
const renderHeatmap = (rawData) => {
  if (!loca) return
  clearLayers()

  // 转换为 Loca 可用的 GeoJSON 格式
  const geoData = {
    type: 'FeatureCollection',
    features: rawData.map((item) => ({
      type: 'Feature',
      properties: { count: Number(item.intensity) },
      geometry: { type: 'Point', coordinates: [item.lon, item.lat] },
    })),
  }

  heatLayer = new window.Loca.HeatMapLayer({ loca, zIndex: 10 })
  heatLayer.setSource(new window.Loca.GeoJSONSource({ data: geoData }))

  heatLayer.setStyle({
    radius: 35,
    unit: 'px',
    height: 50,
    // 从蓝到红的热力颜色梯度
    gradient: {
      0.1: '#2A85B8',
      0.5: '#16B0A9',
      0.9: '#FFD700',
      1.0: '#FF4500',
    },
    max: 100, // 根据数据权重大约值调整
    min: 0,
  })

  map.setFitView()
}

const clearLayers = () => {
  if (heatLayer) loca.remove(heatLayer)
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
  <div class="heatmap-layout">
    <div class="header-panel">
      <span class="panel-title">夜间经济活力热力图</span>
      <div class="filter-group">
        <el-date-picker
          v-model="targetDate"
          type="date"
          value-format="YYYY-MM-DD"
          style="width: 160px; margin-right: 10px"
        />
        <el-button type="primary" :loading="loading" @click="fetchDataAndRender"
          >执行分析</el-button
        >
      </div>
    </div>
    <div ref="mapRef" class="map-container"></div>
  </div>
</template>

<style scoped lang="scss">
.heatmap-layout {
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
}
.map-container {
  flex: 1;
  width: 100%;
}
</style>
