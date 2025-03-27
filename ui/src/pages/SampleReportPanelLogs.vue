<script setup lang="ts">
import { PlBtnGroup, PlLogView } from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import type { ScFvResult } from '../results';

const props = defineProps<{
  sampleData: ScFvResult;
}>();

const chainOptions = [
  { value: 'heavy', label: 'Heavy chain' },
  { value: 'light', label: 'Light chain' },
];
const selectedChain = ref('heavy');
const logHandle = computed(() => selectedChain.value === 'heavy'
  ? props.sampleData.heavy.logHandle
  : props.sampleData.light.logHandle);
</script>

<template>
  <PlBtnGroup v-model="selectedChain" :options="chainOptions" />
  <PlLogView :log-handle="logHandle" />
</template>

<style lang="css">
/** Remove this fix when using ui-vue > v1.8.25 */
.pl-log-view {
    max-height: calc(100% - var(--contour-offset));
    max-width: calc(100% - var(--contour-offset));
}
</style>
