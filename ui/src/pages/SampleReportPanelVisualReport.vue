<script setup lang="ts">
import AlignmentsChart from '../charts/AlignmentsChart.vue';
import type { ScFvResult } from '../results';

defineProps<{
  sampleData: ScFvResult;
}>();
</script>

<template>
  <AlignmentsChart :align-report="sampleData.heavy.alignReport" title="Heavy chain alignments" />
  <AlignmentsChart :align-report="sampleData.light.alignReport" title="Light chain alignments" />
</template>
