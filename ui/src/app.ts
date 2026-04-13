import { platforma } from '@platforma-open/milaboratories.mixcr-scfv-clonotyping.model';
import { defineAppV3 } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import QcReportTablePage from './pages/QcReportTablePage.vue';
import { watch } from 'vue';

export const sdkPlugin = defineAppV3(platforma, () => {
  return {
    showErrorsNotification: true,
    routes: {
      '/': () => MainPage,
      '/qc-report-table': () => QcReportTablePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;

// Make sure labels are initialized
const unwatch = watch(sdkPlugin, ({ loaded }) => {
  if (!loaded) return;
  const app = useApp();
  app.model.data.customBlockLabel ??= '';
  app.model.data.defaultBlockLabel ??= 'Select Dataset';
  unwatch();
});
