<script setup lang="ts">
import { PlAccordion, PlAccordionSection, PlBtnGroup, PlLogView } from "@platforma-sdk/ui-vue";
import { computed, reactive, ref } from "vue";
import type { ScFvResult } from "../results";

const props = defineProps<{
  sampleData: ScFvResult;
}>();

const chainOptions = [
  { value: "heavy", label: "Heavy chain" },
  { value: "light", label: "Light chain" },
];
const selectedChain = ref("heavy");
const logs = computed(() =>
  selectedChain.value === "heavy" ? props.sampleData.heavy.logs : props.sampleData.light.logs,
);

// Every step's section opens by default; the user collapses the ones read.
const collapsed = reactive<Record<string, boolean>>({});
</script>

<template>
  <PlBtnGroup v-model="selectedChain" :options="chainOptions" />
  <!-- One section per MiXCR step, in run order. A chain with one log, or none yet, shows the
       single view. A section honours its model-value only inside a PlAccordion with `multiple`. -->
  <PlAccordion v-if="logs.length > 1" :key="selectedChain" multiple>
    <PlAccordionSection
      v-for="log in logs"
      :key="log.key"
      :label="log.label"
      :model-value="!collapsed[selectedChain + log.key]"
      @update:model-value="collapsed[selectedChain + log.key] = !$event"
    >
      <PlLogView :log-handle="log.handle" />
    </PlAccordionSection>
  </PlAccordion>
  <PlLogView v-else :log-handle="logs[0]?.handle" />
</template>

<style lang="css">
/** Remove this fix when using ui-vue > v1.8.25 */
.pl-log-view {
  max-height: calc(100% - var(--contour-offset));
  max-width: calc(100% - var(--contour-offset));
}
</style>
