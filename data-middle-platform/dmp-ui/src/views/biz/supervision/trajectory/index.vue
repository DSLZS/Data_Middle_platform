<script setup name="HistoryTrack">
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import AMapLoader from '@amap/amap-jsapi-loader'
import dayjs from 'dayjs'
import { getTaxiList, getTripSummary, getTrajectory } from '@/api/biz/biz'

const mapRef = ref(null)
let map = null
let marker = null
let fullPolyline = null
let passedPolyline = null

const loading = ref(false)
const dataReady = ref(false)
const selectedPath = ref([])

const viewMode = ref('follow')
const isPlaying = ref(false)
const playbackProgress = ref(0)
const speed = ref(1)

const historyData = reactive({
  speed: '0.0',
  lng: '-',
  lat: '-',
  gpsTime: '-',
})

let trajectoryData = []
let totalDurationMs = 0
let startTimeMs = 0
let currentVirtualTimeMs = 0
let animationFrameId = null
let lastRenderTime = 0

watch(viewMode, (newVal) => {
  if (!dataReady.value || !map) return
  if (newVal === 'global') {
    map.setFitView([fullPolyline])
  } else if (newVal === 'follow') {
    map.setZoomAndCenter(17, marker.getPosition())
  }
})

const cascaderProps = {
  lazy: true,
  async lazyLoad(node, resolve) {
    const { level, value } = node
    if (level === 0) {
      try {
        const res = await getTaxiList()
        const nodes = (res.data || []).map((item) => ({
          value: item.taxiId,
          label: item.taxiId,
          leaf: false,
        }))
        resolve(nodes)
      } catch (e) {
        resolve([])
      }
    } else if (level === 1) {
      try {
        const res = await getTripSummary(value)
        const nodes = (res.data || []).map((item) => ({
          value: item.tripId,
          label: `${item.startTime.substring(5, 16)} 至 ${item.endTime.substring(11, 16)}`,
          leaf: true,
        }))
        resolve(nodes)
      } catch (e) {
        resolve([])
      }
    }
  },
}

const handleCascaderChange = (val) => {
  if (val && val.length === 2) {
    pullHistoryData(val[1])
  } else {
    resetPlaybackState()
  }
}

const resetPlaybackState = () => {
  pausePlayback()
  dataReady.value = false
  fullPolyline?.setPath([])
  passedPolyline?.setPath([])
  marker?.hide()
}

const pullHistoryData = async (tripId) => {
  resetPlaybackState()
  loading.value = true

  try {
    const res = await getTrajectory(tripId)
    const rawData = res.data || []

    trajectoryData = rawData
      .map((item) => ({
        ...item,
        longitude: Number(item.longitude),
        latitude: Number(item.latitude),
        speed: Number(item.speed || 0),
        tsValue: item.ts ? dayjs(item.ts).valueOf() : 0,
      }))
      .filter(
        (item) =>
          !isNaN(item.longitude) &&
          item.longitude > 0 &&
          !isNaN(item.latitude) &&
          item.latitude > 0 &&
          item.tsValue > 0
      )
      .sort((a, b) => a.tsValue - b.tsValue)

    if (trajectoryData.length < 2) {
      return ElMessage.warning('该行程清洗后的有效点位不足，无法回放')
    }

    dataReady.value = true
    ElMessage.success('轨迹加载成功')
    preparePlayback()
  } catch (error) {
    ElMessage.error('获取历史轨迹失败')
  } finally {
    loading.value = false
  }
}

const preparePlayback = () => {
  startTimeMs = trajectoryData[0].tsValue
  const endTimeMs = trajectoryData[trajectoryData.length - 1].tsValue
  totalDurationMs = endTimeMs - startTimeMs

  currentVirtualTimeMs = 0
  playbackProgress.value = 0

  const path = trajectoryData.map((item) => [item.longitude, item.latitude])
  fullPolyline.setPath(path)
  passedPolyline.setPath([])

  if (viewMode.value === 'global') {
    map.setFitView([fullPolyline])
  } else {
    map.setZoom(17)
  }

  updateView(0)
  marker.show()
}

const startPlayback = () => {
  if (currentVirtualTimeMs >= totalDurationMs) currentVirtualTimeMs = 0
  isPlaying.value = true
  lastRenderTime = performance.now()
  renderFrame(lastRenderTime)
}

const pausePlayback = () => {
  isPlaying.value = false
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
}

const togglePlayback = () => {
  if (!dataReady.value) return ElMessage.warning('请先加载轨迹数据')
  isPlaying.value ? pausePlayback() : startPlayback()
}

const renderFrame = (timestamp) => {
  if (!isPlaying.value) return
  const deltaMs = timestamp - lastRenderTime
  lastRenderTime = timestamp
  currentVirtualTimeMs += deltaMs * speed.value

  if (currentVirtualTimeMs >= totalDurationMs) {
    currentVirtualTimeMs = totalDurationMs
    updateView(currentVirtualTimeMs)
    pausePlayback()
    return
  }
  updateView(currentVirtualTimeMs)
  animationFrameId = requestAnimationFrame(renderFrame)
}

const updateView = (vTimeMs) => {
  playbackProgress.value = (vTimeMs / totalDurationMs) * 100
  const targetTimeMs = startTimeMs + vTimeMs

  let p1Index = Math.max(0, trajectoryData.length - 2)

  for (let i = 0; i < trajectoryData.length - 1; i++) {
    if (trajectoryData[i + 1].tsValue >= targetTimeMs) {
      p1Index = i
      break
    }
  }

  const p1 = trajectoryData[p1Index]
  const p2 = trajectoryData[p1Index + 1]
  if (!p1 || !p2) return

  const t1 = p1.tsValue
  const t2 = p2.tsValue
  let ratio = t2 === t1 ? 0 : (targetTimeMs - t1) / (t2 - t1)
  ratio = Math.max(0, Math.min(1, ratio || 0))

  const lng = p1.longitude + (p2.longitude - p1.longitude) * ratio
  const lat = p1.latitude + (p2.latitude - p1.latitude) * ratio
  const curSpeed = p1.speed + (p2.speed - p1.speed) * ratio

  const pos = [lng, lat]
  marker.setPosition(pos)

  if (viewMode.value === 'follow') {
    map.setCenter(pos)
  }

  passedPolyline.setPath([
    ...trajectoryData
      .slice(0, p1Index + 1)
      .map((i) => [i.longitude, i.latitude]),
    pos,
  ])

  historyData.lng = lng.toFixed(6)
  historyData.lat = lat.toFixed(6)
  historyData.speed = curSpeed.toFixed(1)
  historyData.gpsTime = dayjs(targetTimeMs).format('YYYY-MM-DD HH:mm:ss')
}

const onSliderInput = (val) => {
  if (!dataReady.value) return
  currentVirtualTimeMs = (val / 100) * totalDurationMs
  updateView(currentVirtualTimeMs)
}

onMounted(async () => {
  try {
    window._AMapSecurityConfig = {
      securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JSCODE,
    }

    const AMap = await AMapLoader.load({
      key: import.meta.env.VITE_AMAP_KEY,
      version: '2.0',
    })

    await nextTick()

    map = new AMap.Map(mapRef.value, {
      zoom: 15,
      viewMode: '3D',
    })

    fullPolyline = new AMap.Polyline({
      map,
      strokeColor: '#A3B1C6',
      strokeWeight: 5,
      strokeOpacity: 0.5,
    })

    passedPolyline = new AMap.Polyline({
      map,
      strokeColor: '#2563eb',
      strokeWeight: 5,
      zIndex: 50,
    })

    marker = new AMap.Marker({
      map,
      // 外部 div 带有动画类名，内部 div 是实体圆点
      content: `
    <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 100%; height: 100%; background: rgba(64, 159, 255, 0.6); border-radius: 50%; animation: markerPulse 2s infinite ease-out;"></div>
      <div style="position: absolute; width: 16px; height: 16px; background-color: #409EFF; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 2;"></div>
    </div>
  `,
      // 💡 总容器宽度是 20px，所以偏移量设为 -10
      offset: new AMap.Pixel(-10, -10),
    })
    marker.hide()
  } catch (e) {
    console.error(e)
  }
})

onUnmounted(() => {
  pausePlayback()
  map?.destroy()
})
</script>

<template>
  <div class="default-main page history-layout">
    <el-row :gutter="15" class="full-height">
      <el-col :span="18" class="full-height relative-col">
        <div ref="mapRef" class="map-container" v-loading="loading"></div>

        <div class="mini-data-overlay">
          <div class="data-item">
            <span class="label">时间：</span>
            <span class="value">{{ historyData.gpsTime }}</span>
          </div>
          <div class="data-item">
            <span class="label">经纬度：</span>
            <span class="value"
              >{{ historyData.lng }}, {{ historyData.lat }}</span
            >
          </div>
          <div class="data-item">
            <span class="label">当前车速：</span>
            <span class="value speed-val">{{ historyData.speed }} km/h</span>
          </div>
        </div>
      </el-col>

      <el-col :span="6" class="full-height right-panel">
        <el-card shadow="never" class="control-card">
          <template #header>
            <span class="card-title">选择行程</span>
          </template>
          <el-cascader
            v-model="selectedPath"
            :props="cascaderProps"
            placeholder="请选择 出租车 / 行程时段"
            style="width: 100%"
            @change="handleCascaderChange"
          />
        </el-card>

        <el-card shadow="never" class="control-card mt-15">
          <template #header>
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              "
            >
              <span class="card-title">回放控制</span>
              <el-radio-group v-model="viewMode" size="small">
                <el-radio-button value="follow">跟随</el-radio-button>
                <el-radio-button value="global">全域</el-radio-button>
              </el-radio-group>
            </div>
          </template>

          <div style="padding: 0 10px">
            <el-slider
              v-model="playbackProgress"
              :disabled="!dataReady"
              @input="onSliderInput"
              :format-tooltip="(val) => val.toFixed(1) + '%'"
            />
          </div>
          <div
            style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-top: 5px;
            "
          >
            <el-select
              v-model="speed"
              style="width: 90px"
              :disabled="!dataReady"
            >
              <el-option label="1x" :value="1" />
              <el-option label="2x" :value="2" />
              <el-option label="4x" :value="4" />
              <el-option label="8x" :value="8" />
            </el-select>
            <el-button
              :type="isPlaying ? 'warning' : 'success'"
              style="flex: 1"
              :disabled="!dataReady"
              @click="togglePlayback"
            >
              {{ isPlaying ? '暂停回放' : '开始回放' }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.history-layout {
  height: calc(100vh - 120px);
  min-height: 600px;

  .full-height {
    height: 100%;
  }

  .relative-col {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .map-container {
    flex: 1;
    width: 100%;
    border-radius: var(--el-border-radius-base);
    border: 1px solid var(--el-border-color-light);
    box-shadow: var(--el-box-shadow-light);
    overflow: hidden;
    background-color: var(--el-fill-color-light);
  }

  .mini-data-overlay {
    position: absolute;
    top: 20px;
    left: 20px;
    background-color: rgba(255, 255, 255, 0.85);
    @supports (backdrop-filter: blur(10px)) {
      backdrop-filter: saturate(180%) blur(10px);
      background-color: rgba(255, 255, 255, 0.7);
    }
    padding: 16px 20px;
    border-radius: var(--el-border-radius-base);
    border: 1px solid var(--el-border-color-lighter);
    box-shadow: var(--el-box-shadow);
    z-index: 1000;
    min-width: 220px;

    .data-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-size: 13px;

      &:last-child {
        margin-bottom: 0;
      }

      .label {
        color: var(--el-text-color-secondary);
        margin-right: 15px;
      }

      .value {
        color: var(--el-text-color-primary);
        font-family: var(--el-font-family);
        font-weight: 600;
      }

      .speed-val {
        color: var(--el-color-primary);
        font-size: 15px;
        font-weight: 700;
      }
    }
  }

  .right-panel {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding-right: 4px;

    .mt-15 {
      margin-top: 15px;
    }

    .control-card {
      border: 1px solid var(--el-border-color-light);
      border-radius: var(--el-border-radius-base);

      :deep(.el-card__header) {
        padding: 12px 15px;
        background-color: var(--el-fill-color-light);
        border-bottom: 1px solid var(--el-border-color-light);

        .card-title {
          font-weight: 600;
          color: var(--el-text-color-primary);
          font-size: 14px;
          display: flex;
          align-items: center;

          &::before {
            content: '';
            display: inline-block;
            width: 3px;
            height: 14px;
            background-color: var(--el-color-primary);
            margin-right: 8px;
            border-radius: 2px;
          }
        }
      }

      :deep(.el-card__body) {
        padding: 15px;
      }
    }
  }

  .right-panel::-webkit-scrollbar {
    width: 6px;
  }
  .right-panel::-webkit-scrollbar-thumb {
    background: var(--el-border-color-darker);
    border-radius: 3px;
  }
  .right-panel::-webkit-scrollbar-track {
    background: transparent;
  }
}

@keyframes markerPulse {
  0% {
    transform: scale(0.6);
    opacity: 1;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
</style>
