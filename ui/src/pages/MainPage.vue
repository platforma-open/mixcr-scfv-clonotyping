<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';

import { plRefsEqual } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import {
  AgGridTheme,
  PlAgChartStackedBarCell,
  PlAgOverlayLoading,
  PlAgOverlayNoRows,
  PlAgTextAndButtonCell,
  PlBlockPage,
  PlBtnGhost,
  PlMaskIcon24,
  PlSlideModal,
  autoSizeRowNumberColumn,
  createAgGridColDef,
  makeRowNumberColDef,
} from '@platforma-sdk/ui-vue';
import type { ColDef, GridApi, GridOptions, GridReadyEvent } from 'ag-grid-enterprise';
import { ClientSideRowModelModule, ModuleRegistry } from 'ag-grid-enterprise';
import { computed, reactive, shallowRef, watch, watchEffect } from 'vue';
import { getAlignmentChartSettings } from '../charts/alignmentChartSettings';
// import { ScFvResult } from '../results';
import { useApp } from '../app';
import { parseProgressString } from '../parseProgress';
import { resultMap, type ScFvResult } from '../results';
import SampleReportPanel from './SampleReportPanel.vue';
import SettingsPanel from './SettingsPanel.vue';
import { ExportRawBtn } from '../ExportRawBtn';
// import SampleReportPanel from './SampleReportPanel.vue';
// import SettingsPanel from './SettingsPanel.vue';

const app = useApp();

// updating defaultBlockLabel
watchEffect(() => {
  const parts: string[] = [];
  // Add dataset name if available
  if (app.model.args.input) {
    const inputOption = app.model.outputs.inputOptions?.find((p) => app.model.args.input && plRefsEqual(p.ref, app.model.args.input));
    if (inputOption?.label) {
      parts.push(inputOption.label);
    }
  }
  app.model.args.defaultBlockLabel = parts.filter(Boolean).join(' - ') || 'Select Dataset';
});

const rows = computed(() =>
  resultMap.value ? [...resultMap.value.values()] : undefined,
);

const loadingOverlayParams = computed(() => {
  if (app.model.outputs.started) {
    return { variant: 'running' as const, runningText: 'Loading Sample List' };
  }
  return { variant: 'not-ready' as const };
});

const data = reactive<{
  settingsOpen: boolean;
  sampleReportOpen: boolean;
  selectedSample: string | undefined;
}>({
  settingsOpen: app.model.outputs.started === false,
  sampleReportOpen: false,
  selectedSample: undefined,
});

ModuleRegistry.registerModules([ClientSideRowModelModule]);

watch(
  () => app.model.outputs.started,
  (newVal, oldVal) => {
    if (oldVal === false && newVal === true) {
      data.settingsOpen = false;
      gridApi.value?.showLoadingOverlay();
    }
    if (oldVal === true && newVal === false) data.settingsOpen = true;
  },
);

const gridApi = shallowRef<GridApi>();
const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
  autoSizeRowNumberColumn(params.api);
};

const defaultColumnDef: ColDef = {
  suppressHeaderMenuButton: true,
  lockPinned: true,
  sortable: false,
};

const hideLightProgress = computed(() => Boolean(app.model.args.lightImputeSequence));

const columnDefs = computed<ColDef<ScFvResult>[]>(() => {
  const cols: ColDef<ScFvResult>[] = [
    makeRowNumberColDef(),
    createAgGridColDef<ScFvResult, string>({
      colId: 'label',
      field: 'label',
      headerName: 'Sample',
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
      pinned: 'left',
      lockPinned: true,
      sortable: true,
      cellRenderer: PlAgTextAndButtonCell,
      cellRendererParams: {
        invokeRowsOnDoubleClick: true,
      },
    }),
    createAgGridColDef<ScFvResult, string>({
      colId: 'progressIGHeavy',
      field: 'heavy.progress',
      headerName: 'Progress (Heavy)',
      headerComponentParams: { type: 'Progress' } satisfies PlAgHeaderComponentParams,
      progress(cellData, cd) {
        const parsed = parseProgressString(cellData);

        const p = cd?.data?.heavy.progress;
        if (p === 'Not started' || p === 'Queued') {
          return {
            status: 'not_started',
            text: parsed.stage,
          };
        }

        return {
          status: parsed.stage === 'Done' ? 'done' : 'running',
          percent: parsed.percentage,
          text: parsed.stage,
          suffix: parsed.etaLabel ?? '',
        };
      },
    }),

    createAgGridColDef<ScFvResult, string>({
      colId: 'alignmentStats',
      headerName: 'Alignments (Heavy)',
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
      flex: 1,
      cellStyle: {
        '--ag-cell-horizontal-padding': '12px',
      },
      cellRendererSelector: (cellData) => {
        const value = getAlignmentChartSettings(cellData.data?.heavy.alignReport);
        return {
          component: PlAgChartStackedBarCell,
          params: { value },
        };
      },
    }),

    // Light alignments column is added conditionally below
  ];

  if (!hideLightProgress.value) {
    cols.splice(3, 0, createAgGridColDef<ScFvResult, string>({
      colId: 'progressIGLight',
      field: 'light.progress',
      headerName: 'Progress (Light)',
      headerComponentParams: { type: 'Progress' } satisfies PlAgHeaderComponentParams,
      progress(cellData, cd) {
        const parsed = parseProgressString(cellData);
        const p = cd?.data?.light.progress;
        if (p === 'Not started' || p === 'Queued') {
          return {
            status: 'not_started',
            text: parsed.stage,
          };
        }
        return {
          status: parsed.stage === 'Done' ? 'done' : 'running',
          percent: parsed.percentage,
          text: parsed.stage,
          suffix: parsed.etaLabel ?? '',
        };
      },
    }));
    // Also show Light alignments when not imputing
    cols.push(createAgGridColDef<ScFvResult, string>({
      colId: 'alignmentStats',
      headerName: 'Alignments (Light)',
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
      flex: 1,
      cellStyle: {
        '--ag-cell-horizontal-padding': '12px',
      },
      cellRendererSelector: (cellData) => {
        const value = getAlignmentChartSettings(cellData.data?.light.alignReport);
        return {
          component: PlAgChartStackedBarCell,
          params: { value },
        };
      },
    }));
  }

  return cols;
});

const gridOptions: GridOptions<ScFvResult> = {
  getRowId: (row) => row.data.sampleId,
  onRowDoubleClicked: (e) => {
    data.selectedSample = e.data?.sampleId;
    data.sampleReportOpen = data.selectedSample !== undefined;
  },
  components: {
    PlAgTextAndButtonCell,
  },
};
</script>

<template>
  <PlBlockPage
    title="MiXCR scFv Alignment"
  >
    <template #append>
      <ExportRawBtn />
      <PlBtnGhost @click.stop="() => (data.settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <div :style="{ flex: 1 }">
      <AgGridVue
        :theme="AgGridTheme"
        :style="{ height: '100%' }"
        :rowData="rows"
        :defaultColDef="defaultColumnDef"
        :columnDefs="columnDefs"
        :grid-options="gridOptions"
        :loadingOverlayComponentParams="loadingOverlayParams"
        :loadingOverlayComponent="PlAgOverlayLoading"
        :noRowsOverlayComponent="PlAgOverlayNoRows"
        @grid-ready="onGridReady"
      />
    </div>
  </PlBlockPage>
  <PlSlideModal
    v-model="data.settingsOpen"
    :shadow="true"
    :close-on-outside-click="true"
    width="40%"
  >
    <template #title>Settings</template>
    <SettingsPanel />
  </PlSlideModal>
  <PlSlideModal
    v-model="data.sampleReportOpen"
    :close-on-outside-click="true"
    width="80%"
  >
    <template #title>
      Results for
      {{
        (data.selectedSample ? app.model.outputs.sampleLabels?.[data.selectedSample] : undefined) ??
          '...'
      }}
    </template>
    <SampleReportPanel v-model="data.selectedSample" />
  </PlSlideModal>
</template>
