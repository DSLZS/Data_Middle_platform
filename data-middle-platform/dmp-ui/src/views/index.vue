<template>
  <div class="home-iframe">
    <iframe
      class="home-iframe__frame"
      src="https://traffic-panel-v2.1819840437.workers.dev/"
      title="Traffic Panel"
      frameborder="0"
    ></iframe>
  </div>
</template>

<script setup name="Index" lang="ts"></script>

<style scoped lang="scss">
.home-iframe {
  height: calc(100vh - var(--ba-main-space) * 2);
  margin: var(--ba-main-space);
  overflow: hidden;
}

.home-iframe__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
