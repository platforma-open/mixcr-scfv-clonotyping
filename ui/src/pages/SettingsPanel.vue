<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlAccordionSection, PlBtnGroup, PlDropdown, PlDropdownRef, PlTextArea, PlTextField } from '@platforma-sdk/ui-vue';
import { useApp } from '../app';

const app = useApp();

const speciesOptions: ListOption[] = [
  { label: 'Homo sapiens', value: 'hsa' },
  { label: 'Mus musculus', value: 'mmu' },
  { label: 'Lama glama', value: 'lama' },
  { label: 'Alpaca', value: 'alpaca' },
  { label: 'Macaca fascicularis', value: 'mfas' },
  { label: 'Macaca mulatta', value: 'mmul' },
  { label: 'Rabbit', value: 'rabbit' },
  { label: 'Rat', value: 'rat' },
  { label: 'Sheep', value: 'sheep' },
  { label: 'Spalax', value: 'spalax' },
];

const assemblingFeatureOptions: ListOption[] = [
  { label: 'CDR3', value: 'CDR3:CDR3' },
  { label: 'FR1 – FR4', value: 'FR1:FR4' },
  { label: 'CDR1 – FR4', value: 'CDR1:FR4' },
  { label: 'FR2 – FR4', value: 'FR2:FR4' },
  { label: 'CDR2 – FR4', value: 'CDR2:FR4' },
  { label: 'FR3 – FR4', value: 'FR3:FR4' },
  { label: 'CDR3 – FR4', value: 'CDR3:FR4' },
  { label: 'FR1 – CDR3', value: 'FR1:CDR3' },
  { label: 'CDR1 – CDR3', value: 'CDR1:CDR3' },
  { label: 'FR2 – CDR3', value: 'FR2:CDR3' },
  { label: 'CDR2 – CDR3', value: 'CDR2:CDR3' },
  { label: 'FR3 – CDR3', value: 'FR3:CDR3' },
];

/* @deprecated Migrate to SDK method when will be published */
function plRefsEqual(ref1: PlRef, ref2: PlRef) {
  return ref1.blockId === ref2.blockId && ref1.name === ref2.name;
}

function setInput(inputRef?: PlRef) {
  app.model.args.input = inputRef;
  if (inputRef)
    app.model.ui.title = 'MiXCR scFv - ' + app.model.outputs.inputOptions?.find((o) => plRefsEqual(o.ref, inputRef))?.label;
  else
    app.model.ui.title = undefined;
}

function parseNumber(v: string): number {
  const parsed = Number(v);

  if (!Number.isFinite(parsed)) {
    throw Error('Not a number');
  }

  return parsed;
}

const orderOptions: ListOption[] = [
  { label: 'Heavy-linker-light-hinge', value: 'hl' },
  { label: 'Light-linker-heavy-hinge', value: 'lh' },
];

const imputeOptions: ListOption[] = [
  { label: 'From germline', value: true },
  { label: 'From fixed sequence', value: false },
];
</script>

<template>
  <PlDropdownRef
    :options="app.model.outputs.inputOptions"
    :model-value="app.model.args.input"
    label="Select dataset"
    clearable @update:model-value="setInput"
  />

  <PlDropdown
    v-model="app.model.args.species"
    :options="speciesOptions"
    label="Select species"
  />

  <PlTextField
    v-model="app.model.args.heavyTagPattern"
    label="Heavy chain tag pattern"
    :clearable="() => undefined"
  />

  <PlDropdown
    v-model="app.model.args.heavyAssemblingFeature"
    :options="assemblingFeatureOptions"
    label="Heavy chain assembling feature"
  />

  <PlTextField
    v-model="app.model.args.lightTagPattern"
    label="Light chain tag pattern"
    :clearable="() => undefined"
  />

  <PlDropdown
    v-model="app.model.args.lightAssemblingFeature"
    :options="assemblingFeatureOptions"
    label="Light chain assembling feature"
  />

  <PlTextArea
    v-model="app.model.args.linker"
    :rows="3"
    label="Linker nt sequence (including first nt of C gene)"
    required
  />

  <PlTextArea
    v-model="app.model.args.hinge"
    :rows="3"
    label="Hinge region nt sequence"
    required
  />

  <PlDropdown
    v-model="app.model.args.order"
    :options="orderOptions"
    label="Construct building order"
  />

  <PlAccordionSection label="Advanced Settings">
    <PlTextField
      v-model="app.model.args.limitInput" :parse="parseNumber" :clearable="() => undefined"
      label="Take only this number of reads into analysis"
    />

    <PlBtnGroup
      v-if="app.model.args.heavyAssemblingFeature !== 'FR1:FR4'"
      v-model="app.model.args.imputeHeavy"
      :options="imputeOptions"
      label="Reconstruct uncovered heavy regions"
    />
    <div v-if="!app.model.args.imputeHeavy && app.model.args.heavyAssemblingFeature !== 'CDR3:FR4'">
      ERROR: only CDR3:FR4 assembling feature is supported for imputing heavy regions from fixed sequence
    </div>
    <PlTextArea
      v-if="!app.model.args.imputeHeavy"
      v-model="app.model.args.heavyImputeSequence"
      label="Heavy nt sequence of V region (pre NGS)"
      required
    />

    <PlBtnGroup
      v-if="app.model.args.lightAssemblingFeature !== 'FR1:FR4'"
      v-model="app.model.args.imputeLight"
      :options="imputeOptions"
      label="Reconstruct uncovered heavy regions"
    />
    <div v-if="!app.model.args.imputeLight && app.model.args.lightAssemblingFeature !== 'CDR3:FR4'">
      ERROR: only CDR3:FR4 assembling feature is supported for imputing light regions from fixed sequence
    </div>
    <PlTextArea
      v-if="!app.model.args.imputeLight"
      v-model="app.model.args.lightImputeSequence"
      label="Light nt sequence of V region (pre NGS)"
      required
    />
  </PlAccordionSection>
</template>
