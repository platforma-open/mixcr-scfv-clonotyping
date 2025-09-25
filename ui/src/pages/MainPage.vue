<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';

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
import { computed, reactive, shallowRef } from 'vue';
import { getAlignmentChartSettings } from '../charts/alignmentChartSettings';
// import { ScFvResult } from '../results';
import { useApp } from '../app';
import { parseProgressString } from '../parseProgress';
import { resultMap, type ScFvResult } from '../results';
import SampleReportPanel from './SampleReportPanel.vue';
import SettingsPanel from './SettingsPanel.vue';
// import SampleReportPanel from './SampleReportPanel.vue';
// import SettingsPanel from './SettingsPanel.vue';

const app = useApp();

const rows = computed(() => [...(resultMap.value?.values() ?? [])]);
const data = reactive<{
  settingsOpen: boolean;
  sampleReportOpen: boolean;
  selectedSample: string | undefined;
}>({
  settingsOpen: false,
  sampleReportOpen: false,
  selectedSample: undefined,
});

ModuleRegistry.registerModules([ClientSideRowModelModule]);

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

const columnDefs: ColDef<ScFvResult>[] = [
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
  }),

  createAgGridColDef<ScFvResult, string>({
    colId: 'alignmentStatsH',
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

  createAgGridColDef<ScFvResult, string>({
    colId: 'alignmentStatsL',
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
  }),

];

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
  <PlBlockPage>
    <template #title>MiXCR scFv Clonotyping</template>
    <template #append>
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
        :loadingOverlayComponentParams="{ notReady: true }"
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
