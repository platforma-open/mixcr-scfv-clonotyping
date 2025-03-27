<script setup lang="ts">
import { PlLogView } from '@platforma-sdk/ui-vue';
import type { ScFvResult } from '../results';

defineProps<{
  sampleData: ScFvResult;
}>();
</script>

<template>
  <PlLogView :log-handle="sampleData.heavy.logHandle" />
</template>

<style lang="css">
/** Remove this fix when using ui-vue > v1.8.25 */
.pl-log-view {
    max-height: calc(100% - var(--contour-offset));
    max-width: calc(100% - var(--contour-offset));
}
</style>
