<template>
  <div v-if="error" class="error-boundary">
    <a-result status="error" title="页面出现错误" :sub-title="errorMessage">
      <template #extra>
        <a-button type="primary" @click="reset">重试</a-button>
        <a-button @click="reload">刷新页面</a-button>
      </template>
    </a-result>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)
const errorMessage = ref('')

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  errorMessage.value = error.value.message
  // 记录错误并阻止其继续向上冒泡，避免整个应用白屏崩溃
  console.error('[ErrorBoundary]', err)
  return false
})

function reset() {
  error.value = null
  errorMessage.value = ''
}

function reload() {
  window.location.reload()
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
</style>
