<template>
  <ErrorBoundary>
    <router-view />
  </ErrorBoundary>
</template>

<script setup lang="ts">
// 根组件
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
</script>
