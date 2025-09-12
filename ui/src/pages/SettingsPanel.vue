<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlAccordionSection, PlAlert, PlBtnGroup, PlDropdown, PlDropdownRef, PlSectionSeparator, PlTextArea, PlTextField } from '@platforma-sdk/ui-vue';
import { useApp } from '../app';
import { computed, ref, watch } from 'vue';
import { validateLibrarySequence } from '../utils/sequenceValidator';
import { parseFasta } from '../utils/fastaValidator';

const app = useApp();
const scFvHinge = computed<string | undefined>({
  get: () => (app.model.args.scFvHinge),
  set: (v) => { app.model.args.scFvHinge = v; },
});

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
  return ref1.blockId === ref2.blockId && ref2.name === ref1.name;
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

const customRefMode = computed<'scFv' | 'separate'>({
  get: () => ((app.model.args as Record<string, unknown>).customRefMode as 'scFv' | 'separate' | undefined) ?? 'scFv',
  set: (v: 'scFv' | 'separate') => {
    (app.model.args as Record<string, unknown>).customRefMode = v;
  },
});

// Reset reference input fields when switching modes
watch(
  () => customRefMode.value,
  () => {
    const args = app.model.args as Record<string, unknown>;
    args.heavyChainSequence = undefined;
    args.lightChainSequence = undefined;
    args.scFvSequence = undefined;
    args.scFvLinker = undefined;
    args.scFvHinge = undefined;
    args.scFvOrder = 'hl';
    args.heavyVGenes = undefined;
    args.heavyJGenes = undefined;
    args.lightVGenes = undefined;
    args.lightJGenes = undefined;
  },
  { immediate: false },
);

// Reset reference inputs when the accordion is closed
const referenceAccordionOpen = ref(true);
watch(
  () => referenceAccordionOpen.value,
  (isOpen) => {
    if (isOpen) return;
    const args = app.model.args as Record<string, unknown>;
    args.heavyChainSequence = undefined;
    args.lightChainSequence = undefined;
    args.scFvSequence = undefined;
    args.scFvLinker = undefined;
    args.scFvHinge = undefined;
    args.scFvOrder = 'hl';
    args.heavyVGenes = undefined;
    args.heavyJGenes = undefined;
    args.lightVGenes = undefined;
    args.lightJGenes = undefined;
  },
  { immediate: false },
);

// Helpers to expose current DNA sequences per chain for validation display
const currentHeavyDNA = computed<string | undefined>(() => {
  if (customRefMode.value === 'separate') return app.model.args.heavyChainSequence?.trim();
  const raw = (app.model.args.scFvSequence ?? '').trim();
  const linker = ((app.model.args.scFvLinker ?? '').toUpperCase().replace(/\s/g, ''));
  const order = app.model.args.scFvOrder ?? 'hl';
  if (!raw || !linker) return undefined;
  const records = raw.startsWith('>') ? parseFasta(raw) : [{ header: 'scFv', seq: raw }];
  if (records.length === 0) return undefined;
  const seq = records[0].seq.toUpperCase().replace(/\s/g, '');
  const parts = seq.split(linker);
  if (parts.length !== 2) return undefined;
  return order === 'hl' ? parts[0] : parts[1];
});

const currentLightDNA = computed<string | undefined>(() => {
  if (customRefMode.value === 'separate') return app.model.args.lightChainSequence?.trim();
  const raw = (app.model.args.scFvSequence ?? '').trim();
  const linker = ((app.model.args.scFvLinker ?? '').toUpperCase().replace(/\s/g, ''));
  const order = app.model.args.scFvOrder ?? 'hl';
  if (!raw || !linker) return undefined;
  const records = raw.startsWith('>') ? parseFasta(raw) : [{ header: 'scFv', seq: raw }];
  if (records.length === 0) return undefined;
  const seq = records[0].seq.toUpperCase().replace(/\s/g, '');
  const parts = seq.split(linker);
  if (parts.length !== 2) return undefined;
  return order === 'hl' ? parts[1] : parts[0];
});

const heavyValidation = computed(() => {
  if (customRefMode.value === 'separate') {
    const raw = (app.model.args.heavyChainSequence ?? '').trim();
    if (!raw) return undefined;
    if (raw.startsWith('>')) {
      const recs = parseFasta(raw);
      if (recs.length === 0) return { isValid: false, error: 'No FASTA records found' };
      const errors: string[] = [];
      for (const r of recs) {
        const res = validateLibrarySequence(r.seq);
        if (!res.isValid) errors.push(`${r.header}: ${res.error ?? 'invalid sequence'}`);
      }
      return errors.length ? { isValid: false, error: errors.join('\n') } : { isValid: true };
    }
    return validateLibrarySequence(raw);
  }
  const s = currentHeavyDNA.value;
  if (!s) return undefined;
  return validateLibrarySequence(s);
});

const lightValidation = computed(() => {
  if (customRefMode.value === 'separate') {
    const raw = (app.model.args.lightChainSequence ?? '').trim();
    if (!raw) return undefined;
    if (raw.startsWith('>')) {
      const recs = parseFasta(raw);
      if (recs.length === 0) return { isValid: false, error: 'No FASTA records found' };
      const errors: string[] = [];
      for (const r of recs) {
        const res = validateLibrarySequence(r.seq);
        if (!res.isValid) errors.push(`${r.header}: ${res.error ?? 'invalid sequence'}`);
      }
      return errors.length ? { isValid: false, error: errors.join('\n') } : { isValid: true };
    }
    return validateLibrarySequence(raw);
  }
  const s = currentLightDNA.value;
  if (!s) return undefined;
  return validateLibrarySequence(s);
});

// Derive per-chain V/J FASTA strings into args for workflow
watch(
  () => ({
    mode: customRefMode.value,
    heavy: app.model.args.heavyChainSequence,
    light: app.model.args.lightChainSequence,
    scfv: app.model.args.scFvSequence,
    linker: app.model.args.scFvLinker,
    order: app.model.args.scFvOrder,
  }),
  () => {
    const setVJ = (chain: 'heavy' | 'light', v?: string, j?: string) => {
      const args = app.model.args as Record<string, unknown>;
      if (chain === 'heavy') {
        args.heavyVGenes = v;
        args.heavyJGenes = j;
      } else {
        args.lightVGenes = v;
        args.lightJGenes = j;
      }
    };

    // reset by default
    setVJ('heavy', undefined, undefined);
    setVJ('light', undefined, undefined);

    const mode = customRefMode.value;

    if (mode === 'separate') {
      const hv = app.model.args.heavyChainSequence?.trim();
      const lv = app.model.args.lightChainSequence?.trim();
      if (hv) {
        const hvRecs = hv.startsWith('>') ? parseFasta(hv) : [{ header: 'Heavy', seq: hv }];
        const hvVParts: string[] = [];
        const hvJParts: string[] = [];
        for (const r of hvRecs) {
          const res = validateLibrarySequence(r.seq);
          if (res.isValid && res.vGene && res.jGene) {
            const base = r.header.replace(/\s+/g, '_');
            hvVParts.push(res.vGene.replace(/^>Vgene/m, `>${base}_V_Heavy`));
            hvJParts.push(res.jGene.replace(/^>JGene/m, `>${base}_J_Heavy`));
          }
        }
        setVJ('heavy', hvVParts.length ? hvVParts.join('\n') : undefined, hvJParts.length ? hvJParts.join('\n') : undefined);
      }
      if (lv) {
        const lvRecs = lv.startsWith('>') ? parseFasta(lv) : [{ header: 'Light', seq: lv }];
        const lvVParts: string[] = [];
        const lvJParts: string[] = [];
        for (const r of lvRecs) {
          const res = validateLibrarySequence(r.seq);
          if (res.isValid && res.vGene && res.jGene) {
            const base = r.header.replace(/\s+/g, '_');
            lvVParts.push(res.vGene.replace(/^>Vgene/m, `>${base}_V_Light`));
            lvJParts.push(res.jGene.replace(/^>JGene/m, `>${base}_J_Light`));
          }
        }
        setVJ('light', lvVParts.length ? lvVParts.join('\n') : undefined, lvJParts.length ? lvJParts.join('\n') : undefined);
      }
      return;
    }

    // scFv mode: allow multi-record FASTA in scFvSequence
    const scfvRaw = (app.model.args.scFvSequence ?? '').trim();
    const hingeRaw = ((app.model.args as Record<string, unknown>).scFvHinge as string | undefined ?? '').toUpperCase().replace(/\s/g, '');
    const linker = (app.model.args.scFvLinker ?? '').toUpperCase().replace(/\s/g, '');
    const order = app.model.args.scFvOrder ?? 'hl';
    if (!scfvRaw || !linker) return;

    const records = scfvRaw.startsWith('>') ? parseFasta(scfvRaw) : [{ header: 'scFv', seq: scfvRaw }];
    if (records.length === 0) return;

    const heavyVParts: string[] = [];
    const heavyJParts: string[] = [];
    const lightVParts: string[] = [];
    const lightJParts: string[] = [];

    for (const r of records) {
      let seq = r.seq.toUpperCase().replace(/\s/g, '');
      if (hingeRaw) {
        const idx = seq.indexOf(hingeRaw);
        if (idx >= 0) {
          seq = seq.slice(0, idx) + seq.slice(idx + hingeRaw.length);
        }
      }
      const parts = seq.split(linker);
      if (parts.length !== 2) continue;
      const heavySeq = order === 'hl' ? parts[0] : parts[1];
      const lightSeq = order === 'hl' ? parts[1] : parts[0];

      const resH = validateLibrarySequence(heavySeq);
      if (resH.isValid && resH.vGene && resH.jGene) {
        const base = r.header.replace(/\s+/g, '_');
        heavyVParts.push(resH.vGene.replace(/^>Vgene/m, `>${base}_V_Heavy`));
        heavyJParts.push(resH.jGene.replace(/^>JGene/m, `>${base}_J_Heavy`));
      }

      const resL = validateLibrarySequence(lightSeq);
      if (resL.isValid && resL.vGene && resL.jGene) {
        const base = r.header.replace(/\s+/g, '_');
        lightVParts.push(resL.vGene.replace(/^>Vgene/m, `>${base}_V_Light`));
        lightJParts.push(resL.jGene.replace(/^>JGene/m, `>${base}_J_Light`));
      }
    }

    const hv = heavyVParts.length ? heavyVParts.join('\n') : undefined;
    const hj = heavyJParts.length ? heavyJParts.join('\n') : undefined;
    const lv = lightVParts.length ? lightVParts.join('\n') : undefined;
    const lj = lightJParts.length ? lightJParts.join('\n') : undefined;

    setVJ('heavy', hv, hj);
    setVJ('light', lv, lj);
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <PlAccordionSection v-model="referenceAccordionOpen" label="Reference building">
    <PlBtnGroup
      v-model="customRefMode"
      :options="[
        { label: 'Full scFv DNA', value: 'scFv' },
        { label: 'Separate chains', value: 'separate' },
      ]"
      label="Custom reference input mode"
    />

    <template v-if="customRefMode === 'separate'">
      <PlAlert
        v-if="heavyValidation && !heavyValidation.isValid"
        type="error"
        :title="'Heavy chain DNA validation failed'"
      >
        {{ heavyValidation.error }}
      </PlAlert>
      <PlTextArea
        v-model="app.model.args.heavyChainSequence"
        :rows="4"
        label="Heavy chain sequence"
        placeholder=">name
ATCGATCGATCG..."
      />
      <PlAlert
        v-if="lightValidation && !lightValidation.isValid"
        type="error"
        :title="'Light chain DNA validation failed'"
      >
        {{ lightValidation.error }}
      </PlAlert>
      <PlTextArea
        v-model="app.model.args.lightChainSequence"
        :rows="4"
        label="Light chain sequence"
        placeholder=">name
ATCGATCGATCG..."
      />
    </template>

    <template v-else>
      <PlAlert
        v-if="(heavyValidation && !heavyValidation.isValid) || (lightValidation && !lightValidation.isValid)"
        type="warn"
        :title="'scFv DNA issues detected'"
      >
        <div v-if="heavyValidation && !heavyValidation.isValid">Heavy chain: {{ heavyValidation.error }}</div>
        <div v-if="lightValidation && !lightValidation.isValid">Light chain: {{ lightValidation.error }}</div>
      </PlAlert>
      <PlTextArea
        v-model="app.model.args.scFvSequence"
        :rows="4"
        label="Full scFv sequence"
        placeholder=">name
heavy-seq + linker + light-seq (or reverse)"
      />
      <PlTextField
        v-model="app.model.args.scFvLinker"
        label="Linker sequence"
        :clearable="() => undefined"
      />
      <PlTextField
        v-model="scFvHinge"
        label="Hinge sequence (optional, will be removed before split)"
        :clearable="() => undefined"
      />
      <PlDropdown
        v-model="app.model.args.scFvOrder"
        :options="[
          { label: 'Heavy-Linker-Light', value: 'hl' },
          { label: 'Light-Linker-Heavy', value: 'lh' },
        ]"
        label="scFv order"
      />
    </template>
  </PlAccordionSection>
  <PlSectionSeparator>Analysis settings</PlSectionSeparator>
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
    <PlBtnGroup
      v-model="customRefMode"
      :options="[
        { label: 'Full scFv DNA', value: 'scFv' },
        { label: 'Separate chains', value: 'separate' },
      ]"
      label="Custom reference input mode"
    />

    <template v-if="customRefMode === 'separate'">
      <PlAlert
        v-if="heavyValidation && !heavyValidation.isValid"
        type="error"
        :title="'Heavy chain DNA validation failed'"
      >
        {{ heavyValidation.error }}
      </PlAlert>
      <PlTextArea
        v-model="app.model.args.heavyChainSequence"
        :rows="4"
        label="Heavy chain DNA (optional)"
      />
      <PlAlert
        v-if="lightValidation && !lightValidation.isValid"
        type="error"
        :title="'Light chain DNA validation failed'"
      >
        {{ lightValidation.error }}
      </PlAlert>
      <PlTextArea
        v-model="app.model.args.lightChainSequence"
        :rows="4"
        label="Light chain DNA (optional)"
      />
    </template>

    <template v-else-if="customRefMode === 'scFv'">
      <PlAlert
        v-if="(heavyValidation && !heavyValidation.isValid) || (lightValidation && !lightValidation.isValid)"
        type="warn"
        :title="'scFv DNA issues detected'"
      >
        <div v-if="heavyValidation && !heavyValidation.isValid">Heavy chain: {{ heavyValidation.error }}</div>
        <div v-if="lightValidation && !lightValidation.isValid">Light chain: {{ lightValidation.error }}</div>
      </PlAlert>
      <PlTextArea
        v-model="app.model.args.scFvSequence"
        :rows="4"
        label="Full scFv DNA (optional)"
        placeholder="heavy-DNA + linker + light-DNA (or reverse)"
      />
      <PlTextField
        v-model="app.model.args.scFvLinker"
        label="Linker DNA"
        :clearable="() => undefined"
      />
      <PlDropdown
        v-model="app.model.args.scFvOrder"
        :options="[
          { label: 'Heavy-Linker-Light', value: 'hl' },
          { label: 'Light-Linker-Heavy', value: 'lh' },
        ]"
        label="scFv order"
      />
    </template>

    <!-- no standalone FASTA mode -->

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
