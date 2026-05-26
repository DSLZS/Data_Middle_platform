<script setup lang="ts">
import { BEFORE_RESIZE_LAYOUT } from '@/store/constant/cacheKey.ts'
import useConfig from '@/store/modules/layout.ts'
import Local from '@/utils/hsj/useStorage'

// const title = import.meta.env.VITE_APP_TITLE
const config = useConfig()

const setNavTabsWidth = () => {
  const navTabs: HTMLDivElement = document.querySelector('.nav-tabs')!
  if (!navTabs) {
    return
  }
  const navBar: HTMLDivElement = document.querySelector('.nav-bar')!
  const navMenus: HTMLDivElement = document.querySelector('.nav-menus')!
  const minWidth = navBar?.offsetWidth - (navMenus.offsetWidth + 20)
  navTabs.style.width = minWidth.toString() + 'px'
}
const closeShade = function (closeCallBack?: () => void) {
  const shadeEl = document.querySelector('.ba-layout-shade')
  shadeEl && shadeEl.remove()
  closeCallBack && closeCallBack()
}

const onMenuCollapse = () => {
  if (config.layout.shrink && !config.layout.menuCollapse) {
    closeShade()
  }

  config.setLayout('menuCollapse', !config.layout.menuCollapse)

  Local.set(BEFORE_RESIZE_LAYOUT, {
    layoutMode: config.layout.layoutMode,
    menuCollapse: config.layout.menuCollapse,
  })

  // 等待侧边栏动画结束后重新计算导航栏宽度
  setTimeout(() => {
    setNavTabsWidth()
  }, 350)
}
</script>

<template>
  <div class="layout-logo">
    <img
      v-if="!config.layout.menuCollapse"
      class="logo-img"
      src="@/assets/icons/svg/vite.svg"
      alt="logo"
    />
    <div v-if="!config.layout.menuCollapse" class="website-name">
      <div class="title-main">哈尔滨市交通运行</div>
      <div class="title-sub">态势感知与治理决策中心</div>
    </div>
    <svg-icon
      @click="onMenuCollapse"
      v-if="config.layout.layoutMode != 'Streamline'"
      :color="config.getColorVal('menuActiveColor')"
      :iconClass="config.layout.menuCollapse ? 'indent' : 'dedent'"
      size="18"
      class="fold"
      :class="config.layout.menuCollapse ? 'unfold' : ''"
    />
  </div>
</template>

<style scoped lang="scss">
.layout-logo {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between; /* 确保图标靠右对齐 */
  box-sizing: border-box;
  padding: 10px;
  background: v-bind(
    'config.layout.layoutMode != "Streamline" ?  config.getColorVal("menuTopBarBackground"):"transparent"'
  );
}
.logo-img {
  width: 28px;
  flex-shrink: 0; /* 防止 logo 被压缩 */
}

.website-name {
  flex: 1;
  width: 0; /* 核心修复：防止内部长文本撑爆父容器，挤压右侧图标 */
  display: flex;
  flex-direction: column; /* 垂直排列主副标题 */
  justify-content: center;
  padding-left: 8px;
  padding-right: 4px;
  cursor: default;
}

.title-main {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  /* 调整为更沉稳、纯粹的科技蓝渐变 */
  background: linear-gradient(90deg, #1890ff 0%, #2f54eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent !important;
  /* 移除过于张扬的常驻发光，让文字更清晰 */
  transition: all 0.3s ease;
}

.title-sub {
  font-size: 12px; /* 稍微放大字号，缩小与主标题的体量差 */
  font-weight: 600;
  /* 抛弃中性灰，改用与主标题同色系的“灰蓝色”，保持视觉连贯 */
  color: #6f95d1;
  line-height: 1.2;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.5px;
}

/* 悬浮时，主标题稍微提亮，副标题也做轻微的颜色呼应 */
.layout-logo:hover .title-main {
  background: linear-gradient(90deg, #36a3f7 0%, #1890ff 100%);
  -webkit-background-clip: text;
  filter: drop-shadow(0 2px 4px rgba(24, 144, 255, 0.3));
}

.layout-logo:hover .title-sub {
  color: #4a78d0; /* 悬浮时副标题颜色稍微加深，增加互动感 */
}

.fold {
  flex-shrink: 0; /* 核心修复：防止折叠图标被挤压变形 */
  cursor: pointer;
}
.unfold {
  margin: 0 auto;
}
</style>
