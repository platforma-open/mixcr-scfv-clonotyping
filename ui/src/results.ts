import {
  AlignReport,
  AssembleReport,
} from '@platforma-open/milaboratories.mixcr-clonotyping-2.model';
import { ProgressPrefix } from '@platforma-open/milaboratories.mixcr-scfv-clonotyping.model';
import { isLiveLog, type AnyLogHandle } from '@platforma-sdk/model';
import { ReactiveFileContent } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from './app';

export type ScFvResult = {
  label: string;
  sampleId: string;
  heavy: MiXCRResult;
  light: MiXCRResult;
};

export type MiXCRResult = {
  progress: string;
  logHandle?: AnyLogHandle;
  alignReport?: AlignReport;
  assembleReport?: AssembleReport;
};

const reactiveFileContent = ReactiveFileContent.useGlobal();

/** Relatively rarely changing part of the results */
export const resultMap = computed(() => {
  const app = useApp();

  const sampleLabels = app.model.outputs.sampleLabels;
  if (sampleLabels === undefined) return undefined;

  const resultMap = new Map<string, ScFvResult>();

  for (const sampleId in sampleLabels) {
    const label = sampleLabels[sampleId];
    const result: ScFvResult = {
      sampleId: sampleId,
      label: label,
      heavy: {
        progress: app.model.outputs.isRunning ? 'Queued' : 'Not started',
      },
      light: {
        progress: app.model.outputs.isRunning ? 'Queued' : 'Not started',
      },
    };
    resultMap.set(sampleId, result);
  }

  // logs & reports
  for (const c of ['h', 'k']) {
    let logs;
    let reports;
    let progress;
    if (c == 'h') {
      logs = app.model.outputs.logsIGHeavy;
      reports = app.model.outputs.reportsIGHeavy;
      progress = app.model.outputs.progressIGHeavy;
    } else {
      logs = app.model.outputs.logsIGLight;
      reports = app.model.outputs.reportsIGLight;
      progress = app.model.outputs.progressIGLight;
    }

    if (logs) {
      for (const logData of logs.data) {
        const sampleId = logData.key[0] as string;
        const r = resultMap.get(sampleId);
        if (!r) continue;

        if (c == 'h') r.heavy.logHandle = logData.value;
        else r.light.logHandle = logData.value;
      }
    }

    if (reports)
      for (const report of reports.data) {
        const sampleId = report.key[0] as string;
        const reportId = report.key[1] as string;
        if (report.key[2] !== 'json' || report.value === undefined) continue;
        const r = resultMap.get(sampleId);
        if (r) {
          let chainResult;
          if (c == 'h')
            chainResult = r.heavy;
          else
            chainResult = r.light;

          switch (reportId) {
            case 'align':
              // globally cached
              chainResult.alignReport = reactiveFileContent.getContentJson(
                report.value.handle,
                AlignReport,
              )?.value;
              break;
            case 'assemble':
              // globally cached
              chainResult.assembleReport = reactiveFileContent.getContentJson(
                report.value.handle,
                AssembleReport,
              )?.value;
              break;
          }
        }
      }

    if (progress) {
      for (const progressData of progress.data) {
        const sampleId = progressData.key[0] as string;
        const r = resultMap.get(sampleId);
        if (!r) continue;

        const logHandle = c == 'h' ? r.heavy.logHandle : r.light.logHandle;

        const done = logHandle && !isLiveLog(logHandle);
        const p = done ? 'Done' : progressData.value?.replace(ProgressPrefix, '') ?? 'Not started';

        if (c == 'h') r.heavy.progress = p;
        else r.light.progress = p;
      }
    }
  }

  return resultMap;
});
