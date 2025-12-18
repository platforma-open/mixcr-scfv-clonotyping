import { model } from '@platforma-open/milaboratories.mixcr-scfv-clonotyping.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import QcReportTablePage from './pages/QcReportTablePage.vue';

export const sdkPlugin = defineApp(model, (app) => {
  return {
    progress: () => {
      return app.model.outputs.isRunning;
    },
    showErrorsNotification: true,
    routes: {
      '/': () => MainPage,
      '/qc-report-table': () => QcReportTablePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
