import { platforma } from "@platforma-open/milaboratories.mixcr-scfv-clonotyping.model";
import { plRefsEqual } from "@platforma-sdk/model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import MainPage from "./pages/MainPage.vue";
import QcReportTablePage from "./pages/QcReportTablePage.vue";
import { computed, watch } from "vue";

export const sdkPlugin = defineAppV3(platforma, (app) => {
  // The input dataset's label. "" when no dataset is picked; undefined while the picked dataset
  // is not among the options yet.
  const subtitleLabel = computed<string | undefined>(() => {
    const input = app.model.data.input;
    if (!input) return "";
    return app.model.outputs.inputOptions?.find((p) => plRefsEqual(p.ref, input))?.label;
  });
  watch(
    subtitleLabel,
    (label) => {
      if (label !== undefined && label !== app.model.data.subtitleLabel)
        app.model.data.subtitleLabel = label;
    },
    { immediate: true },
  );

  return {
    showErrorsNotification: true,
    routes: {
      "/": () => MainPage,
      "/qc-report-table": () => QcReportTablePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;

// Make sure labels are initialized
const unwatch = watch(sdkPlugin, ({ loaded }) => {
  if (!loaded) return;
  const app = useApp();
  app.model.data.customBlockLabel ??= "";
  unwatch();
});
