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
        progress: 'Queued',
      },
      light: {
        progress: 'Queued',
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

    let done = false;
    if (logs) {
      for (const logData of logs.data) {
        const sampleId = logData.key[0] as string;
        const r = resultMap.get(sampleId);
        if (!r) continue;

        done = !isLiveLog(logData.value);

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
          console.log(report);
          console.log(report.key);
          console.log(report.value);
          console.log(ReactiveFileContent.getContentBytes(report.value.handle!).value);

          let chainResult;
          if (c == 'h')
            chainResult = r.heavy;
          else
            chainResult = r.light;

          switch (reportId) {
            case 'align':
              // globally cached
              chainResult.alignReport = ReactiveFileContent.getContentJson(
                report.value.handle,
                AlignReport,
              )?.value;
              break;
            case 'assemble':
              // globally cached
              chainResult.assembleReport = ReactiveFileContent.getContentJson(
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

        const p = done ? 'Done' : progressData.value?.replace(ProgressPrefix, '') ?? 'Not started';

        if (c == 'h') r.heavy.progress = p;
        else r.light.progress = p;
      }
    }
  }

  console.log(resultMap);

  return resultMap;
});

// /** Results augmented with execution progress */
// export const MiXCRResultsFull = computed<MiXCRResult[] | undefined>(() => {
//   const app = useApp();

//   const progress = app.model.outputs.progress;
//   if (progress === undefined) return undefined;

//   const doneRaw = app.model.outputs.done;
//   if (doneRaw === undefined) return undefined;
//   const done = new Set(doneRaw);

//   const rawMap = MiXCRResultsMap.value;
//   if (rawMap === undefined) return undefined;

//   // shellow cloning the map and it's values
//   const resultMap = new Map([...rawMap].map((v) => [v[0], { ...v[1] }]));

//   // adding progress information
//   for (const p of progress.data) {
//     const sampleId = p.key[0] as string;
//     if (resultMap.get(sampleId))
//       if (p?.value)
//         resultMap.get(sampleId)!.progress = done.has(sampleId)
//           ? 'Done'
//           : p.value?.replace(ProgressPrefix, '') ?? 'Not started';
//   }

//   return [...resultMap.values()];
// });
