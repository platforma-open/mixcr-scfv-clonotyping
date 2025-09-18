<script setup lang="ts">
import { PlBtnGroup, PlLogView } from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import type { ScFvResult } from '../results';

const props = defineProps<{
  sampleData: ScFvResult;
}>();

const stepOptions = [
  { value: 'parse', label: 'Parse' },
  { value: 'refine', label: 'Refine' },
  { value: 'consensus', label: 'Consensus' },
  { value: 'export', label: 'Export' },
];
const selectedStep = ref<'parse' | 'refine' | 'consensus' | 'export'>('parse');
const logHandle = computed(() => props.sampleData.mitool?.[selectedStep.value]);
</script>

<template>
  <PlBtnGroup v-model="selectedStep" :options="stepOptions" />
  <PlLogView :log-handle="logHandle" />
</template>
