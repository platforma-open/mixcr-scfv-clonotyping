<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlAccordionSection, PlAlert, PlBtnGroup, PlDropdown, PlDropdownRef, PlTextArea, PlTextField } from '@platforma-sdk/ui-vue';
import { computed, watch } from 'vue';
import { useApp } from '../app';
import { parseFasta } from '../utils/fastaValidator';
import { validateFullScFv, validateLibrarySequence, validateSeparateChain } from '../utils/sequenceValidator';

const app = useApp();
// no separate scFv hinge field; use general hinge in Analysis section

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
  { label: 'Heavy-linker-light', value: 'hl' },
  { label: 'Light-linker-heavy', value: 'lh' },
];

const imputeOptions: ListOption[] = [
  { label: 'From germline', value: true },
  { label: 'From fixed sequence', value: false },
];

const customRefMode = computed<'builtin' | 'scFv' | 'separate'>({
  get: () => app.model.args.customRefMode ?? 'builtin',
  set: (v: 'builtin' | 'scFv' | 'separate') => {
    app.model.args.customRefMode = v;
  },
});

// Reset reference input fields when switching modes
watch(
  () => customRefMode.value,
  () => {
    const args = app.model.args as Record<string, unknown>;
    args.heavyChainSequence = '';
    args.lightChainSequence = '';
    args.scFvSequence = '';
    // keep analysis 'order' as-is; no separate scFv order
    args.heavyVGenes = undefined;
    args.heavyJGenes = undefined;
    args.lightVGenes = undefined;
    args.lightJGenes = undefined;
  },
  { immediate: false },
);

const heavyValidation = computed(() => {
  if (customRefMode.value === 'separate') {
    const raw = (app.model.args.heavyChainSequence ?? '').trim();
    if (!raw) return undefined;
    return validateSeparateChain(raw);
  }
  if (customRefMode.value === 'builtin') return undefined;
  
  const scfvRaw = (app.model.args.scFvSequence ?? '').trim();
  if (!scfvRaw) return undefined;
  // FASTA format is checked in scFvValidation now
  const linker = (app.model.args.linker ?? '').toUpperCase().replace(/\s/g, '');
  const hingeRaw = (app.model.args.hinge ?? '').toUpperCase().replace(/\s/g, '');
  const order = app.model.args.order ?? 'hl';
  if (!linker) return { isValid: false, error: 'Linker sequence is required in scFv mode' };
  let seq = scfvRaw.toUpperCase().replace(/\s/g, '');
  if (hingeRaw) {
    const idx = seq.indexOf(hingeRaw);
    if (idx >= 0) seq = seq.slice(0, idx) + seq.slice(idx + hingeRaw.length);
  }
  const parts = seq.split(linker);
  if (parts.length !== 2) return { isValid: false, error: 'Cannot split scFv sequence by linker' };
  const heavySeq = order === 'hl' ? parts[0] : parts[1];
  return validateLibrarySequence(heavySeq);
});

const lightValidation = computed(() => {
  if (customRefMode.value === 'separate') {
    const raw = (app.model.args.lightChainSequence ?? '').trim();
    if (!raw) return undefined;
    return validateSeparateChain(raw);
  }
  if (customRefMode.value === 'builtin') return undefined;
  const scfvRaw = (app.model.args.scFvSequence ?? '').trim();
  if (!scfvRaw) return undefined;
  // FASTA format is checked in scFvValidation now
  const linker = (app.model.args.linker ?? '').toUpperCase().replace(/\s/g, '');
  const hingeRaw = (app.model.args.hinge ?? '').toUpperCase().replace(/\s/g, '');
  const order = app.model.args.order ?? 'hl';
  if (!linker) return { isValid: false, error: 'Linker sequence is required in scFv mode' };
  let seq = scfvRaw.toUpperCase().replace(/\s/g, '');
  if (hingeRaw) {
    const idx = seq.indexOf(hingeRaw);
    if (idx >= 0) seq = seq.slice(0, idx) + seq.slice(idx + hingeRaw.length);
  }
  const parts = seq.split(linker);
  if (parts.length !== 2) return { isValid: false, error: 'Cannot split scFv sequence by linker' };
  const lightSeq = order === 'hl' ? parts[1] : parts[0];
  return validateLibrarySequence(lightSeq);
});

// Full scFv-level validation (format/linker/split) for scFv mode
const scFvValidation = computed(() => {
  if (customRefMode.value !== 'scFv') return undefined;
  const scfvRaw = (app.model.args.scFvSequence ?? '').trim();
  if (!scfvRaw) return undefined;
  return validateFullScFv(scfvRaw, app.model.args.linker ?? '', app.model.args.hinge, (app.model.args.order as 'hl' | 'lh') ?? 'hl');
});

// Derive per-chain V/J FASTA strings into args for workflow
watch(
  () => ({
    mode: customRefMode.value,
    heavy: app.model.args.heavyChainSequence,
    light: app.model.args.lightChainSequence,
    scfv: app.model.args.scFvSequence,
    linker: app.model.args.linker,
    hinge: app.model.args.hinge,
    order: app.model.args.order,
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
    if (mode === 'builtin') {
      setVJ('heavy', undefined, undefined);
      setVJ('light', undefined, undefined);
      return;
    }
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
    const hingeRaw = (app.model.args.hinge ?? '').toUpperCase().replace(/\s/g, '');
    const linker = (app.model.args.linker ?? '').toUpperCase().replace(/\s/g, '');
    const order = app.model.args.order ?? 'hl';
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

      // Try both orders and pick the one that yields valid V/J for both chains; fall back to selected order
      const tryOrder = (ord: 'hl' | 'lh') => {
        const hs = ord === 'hl' ? parts[0] : parts[1];
        const ls = ord === 'hl' ? parts[1] : parts[0];
        const hRes = validateLibrarySequence(hs);
        const lRes = validateLibrarySequence(ls);
        const bothValid = Boolean(hRes.isValid && hRes.vGene && hRes.jGene && lRes.isValid && lRes.vGene && lRes.jGene);
        return { ord, hs, ls, hRes, lRes, bothValid };
      };

      const cand1 = tryOrder('hl');
      const cand2 = tryOrder('lh');
      const chosen = cand1.bothValid ? cand1 : (cand2.bothValid ? cand2 : (order === 'hl' ? cand1 : cand2));

      if (chosen.hRes.isValid && chosen.hRes.vGene && chosen.hRes.jGene) {
        const base = r.header.replace(/\s+/g, '_');
        heavyVParts.push(chosen.hRes.vGene.replace(/^>Vgene/m, `>${base}_V_Heavy`));
        heavyJParts.push(chosen.hRes.jGene.replace(/^>JGene/m, `>${base}_J_Heavy`));
      }

      if (chosen.lRes.isValid && chosen.lRes.vGene && chosen.lRes.jGene) {
        const base = r.header.replace(/\s+/g, '_');
        lightVParts.push(chosen.lRes.vGene.replace(/^>Vgene/m, `>${base}_V_Light`));
        lightJParts.push(chosen.lRes.jGene.replace(/^>JGene/m, `>${base}_J_Light`));
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
  <PlDropdownRef
    :options="app.model.outputs.inputOptions"
    :model-value="app.model.args.input"
    label="Select dataset"
    clearable required
    @update:model-value="setInput"
  >
    <template #tooltip>
      Select input sequencing dataset (FASTA/FASTQ).
    </template>
  </PlDropdownRef>

  <PlBtnGroup
    v-model="customRefMode"
    :options="[
      { label: 'Built-in reference', value: 'builtin' },
      { label: 'Full scFv sequence', value: 'scFv' },
      { label: 'Separate chains', value: 'separate' },
    ]"
    label="Reference type"
  >
    <template #tooltip>
      Select reference type. Built-in reference is the default reference from the MiXCR. Full scFv sequence is a custom reference built from the scFv sequence. Separate chains is a custom reference built from the heavy and light chain sequences.
    </template>
  </PlBtnGroup>

  <template v-if="customRefMode === 'separate'">
    <PlAlert
      v-if="(heavyValidation && !heavyValidation.isValid) || (lightValidation && !lightValidation.isValid)"
      type="error"
      :title="'Separate chains input issues detected'"
    >
      <div v-if="heavyValidation && !heavyValidation.isValid">Heavy chain: {{ heavyValidation.error }}</div>
      <div v-if="lightValidation && !lightValidation.isValid">Light chain: {{ lightValidation.error }}</div>
    </PlAlert>
    <PlTextArea
      v-model="app.model.args.heavyChainSequence"
      :rows="4"
      label="Heavy chain sequence"
      placeholder=">name
ATCGATCGATCG..."
    >
      <template #tooltip>
        Heavy chain sequence(s) in FASTA format. Should cover VDJRegion.
      </template>
    </PlTextArea>
    <PlTextArea
      v-model="app.model.args.lightChainSequence"
      :rows="4"
      label="Light chain sequence"
      placeholder=">name
ATCGATCGATCG..."
    >
      <template #tooltip>
        Light chain sequence(s) in FASTA format. Should cover VDJRegion.
      </template>
    </PlTextArea>
  </template>

  <template v-else-if="customRefMode === 'scFv'">
    <PlAlert
      v-if="scFvValidation && !scFvValidation.isValid"
      type="error"
      :title="'Full scFv input issues detected'"
    >
      {{ scFvValidation.error }}
    </PlAlert>
    <PlTextArea
      v-model="app.model.args.scFvSequence"
      :rows="4"
      label="Full scFv sequence"
      placeholder=">name
heavy-seq + linker + light-seq (or reverse)"
    >
      <template #tooltip>
        Full scFv sequence in FASTA format. Should contain heavy chain and light chain sequences, separated by linker.
      </template>
    </PlTextArea>
  </template>

  <PlDropdown
    v-if="customRefMode === 'builtin'"
    v-model="app.model.args.species"
    :options="speciesOptions"
    label="Select species"
    required
  />

  <PlDropdown
    v-model="app.model.args.order"
    :options="orderOptions"
    label="Construct building order"
  >
    <template #tooltip>
      Chain order
    </template>
  </PlDropdown>

  <PlTextArea
    v-model="app.model.args.linker"
    :rows="3"
    label="Linker nucleotide sequence"
    placeholder="GGTGGCGGTGGCTCTGGTGGCGGTGGCTCTGGTGGCGGTGGCTCT"
    required
  >
    <template #tooltip>
      Linker sequence between heavy and light.
    </template>
  </PlTextArea>

  <PlTextField
    v-model="app.model.args.heavyTagPattern"
    label="Heavy chain tag pattern"
    :clearable="() => undefined"
    placeholder="^(R1:*)ggtggcggtggctct*\*"
    required
  >
    <template #tooltip>
      Pattern for identifying heavy chain sequences.
    </template>
  </PlTextField>

  <PlDropdown
    v-model="app.model.args.heavyAssemblingFeature"
    :options="assemblingFeatureOptions"
    label="Heavy chain assembling feature"
  >
    <template #tooltip>
      Region used to assemble heavy clonotypes.
    </template>
  </PlDropdown>

  <PlTextField
    v-model="app.model.args.lightTagPattern"
    label="Light chain tag pattern"
    :clearable="() => undefined"
    placeholder="^*gcggaagt(R1:*)\^*gactcggatc(R2:*)"
  >
    <template #tooltip>
      Pattern for identifying light chain sequences.
    </template>
  </PlTextField>

  <PlDropdown
    v-model="app.model.args.lightAssemblingFeature"
    :options="assemblingFeatureOptions"
    label="Light chain assembling feature"
  >
    <template #tooltip>
      Region used to assemble light clonotypes.
    </template>
  </PlDropdown>

  <PlTextArea
    v-model="app.model.args.hinge"
    :rows="3"
    label="Hinge region nt sequence"
  >
    <template #tooltip>
      Hinge nucleotide sequence.
    </template>
  </PlTextArea>

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
    >
      <template #tooltip>
        Impute uncovered heavy regions from germline or fixed sequence.
      </template>
    </PlBtnGroup>
    <div v-if="!app.model.args.imputeHeavy && app.model.args.heavyAssemblingFeature !== 'CDR3:FR4'">
      ERROR: only CDR3:FR4 assembling feature is supported for imputing heavy regions from fixed sequence
    </div>
    <PlTextArea
      v-if="!app.model.args.imputeHeavy"
      v-model="app.model.args.heavyImputeSequence"
      label="Heavy nt sequence of V region (pre NGS)"
      required
    >
      <template #tooltip>
        Fixed heavy V-region nucleotides used when imputing.
      </template>
    </PlTextArea>

    <PlBtnGroup
      v-if="app.model.args.lightAssemblingFeature !== 'FR1:FR4'"
      v-model="app.model.args.imputeLight"
      :options="imputeOptions"
      label="Reconstruct uncovered heavy regions"
    >
      <template #tooltip>
        Impute uncovered light regions from germline or fixed sequence.
      </template>
    </PlBtnGroup>
    <div v-if="!app.model.args.imputeLight && app.model.args.lightAssemblingFeature !== 'CDR3:FR4'">
      ERROR: only CDR3:FR4 assembling feature is supported for imputing light regions from fixed sequence
    </div>
    <PlTextArea
      v-if="!app.model.args.imputeLight"
      v-model="app.model.args.lightImputeSequence"
      label="Light nt sequence of V region (pre NGS)"
      required
    >
      <template #tooltip>
        Fixed light V-region nucleotides used when imputing.
      </template>
    </PlTextArea>
  </PlAccordionSection>
</template>
