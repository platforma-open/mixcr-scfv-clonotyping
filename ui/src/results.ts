import {
  AlignReport,
  AssembleReport,
} from '@platforma-open/milaboratories.mixcr-clonotyping-2.model';
import { ProgressPrefix } from '@platforma-open/milaboratories.mixcr-scfv-clonotyping.model';
const MitoolProgressPrefix = '[==MITOOL_PROGRESS==]';
import { isLiveLog, type AnyLogHandle } from '@platforma-sdk/model';
import { ReactiveFileContent } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from './app';

export type ScFvResult = {
  label: string;
  sampleId: string;
  heavy: MiXCRResult;
  light: MiXCRResult;
  mitool?: {
    parse?: AnyLogHandle;
    refine?: AnyLogHandle;
    consensus?: AnyLogHandle;
    export?: AnyLogHandle;
  };
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
        progress: app.model.outputs.isRunning ? 'Queued' : 'Not started',
      },
      light: {
        progress: app.model.outputs.isRunning ? 'Queued' : 'Not started',
      },
    };
    resultMap.set(sampleId, result);
  }

  // Track which samples received MiXCR progress this tick to avoid overriding with mitool
  const mixcrSetHeavy = new Set<string>();
  const mixcrSetLight = new Set<string>();

  // logs & reports
  for (const c of ['h', 'k']) {
    let logs;
    let reports;
    let progress;
    type ProgressData = { data: { key: (string | number)[]; value?: string }[] };
    const _unusedMitoolProgress = (app.model.outputs as unknown as { mitoolProgress?: ProgressData }).mitoolProgress;
    const mitoolParse = (app.model.outputs as unknown as { mitoolParseProgress?: ProgressData }).mitoolParseProgress;
    const mitoolRefine = (app.model.outputs as unknown as { mitoolRefineProgress?: ProgressData }).mitoolRefineProgress;
    const mitoolConsensus = (app.model.outputs as unknown as { mitoolConsensusProgress?: ProgressData }).mitoolConsensusProgress;
    const mitoolExport = (app.model.outputs as unknown as { mitoolExportProgress?: ProgressData }).mitoolExportProgress;
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

        if (c == 'h') {
          r.heavy.progress = p;
          mixcrSetHeavy.add(sampleId);
        } else {
          r.light.progress = p;
          mixcrSetLight.add(sampleId);
        }
      }
    }

    // Show mitool preprocessing progress only when MiXCR hasn't emitted for that sample yet
    {
      const mitoolProgress = (app.model.outputs as unknown as { mitoolProgress?: ProgressData }).mitoolProgress;
      if (mitoolProgress) {
        for (const progressData of mitoolProgress.data) {
          const sampleId = progressData.key[0] as string;
          const r = resultMap.get(sampleId);
          if (!r) continue;
          const p = progressData.value?.replace(MitoolProgressPrefix, '') ?? 'Preprocessing';
          if (c == 'h') {
            const cur = r.heavy.progress;
            if (!mixcrSetHeavy.has(sampleId) && (cur === 'Not started' || cur === 'Queued' || cur?.startsWith('Waiting') || cur?.startsWith('Preprocessing'))) {
              r.heavy.progress = p;
            }
          } else {
            const cur = r.light.progress;
            if (!mixcrSetLight.has(sampleId) && (cur === 'Not started' || cur === 'Queued' || cur?.startsWith('Waiting') || cur?.startsWith('Preprocessing'))) {
              r.light.progress = p;
            }
          }
        }
      }
    }

    // Prefer step-specific mitool progress labels only before MiXCR progresses
    // Compute latest stage per sample in priority order: parse < refine < consensus < export
    const stepStreams = [mitoolParse, mitoolRefine, mitoolConsensus, mitoolExport].filter(Boolean) as ProgressData[];
    const latestBySample = new Map<string, string>();
    for (const stream of stepStreams) {
      for (const progressData of stream.data) {
        const sampleId = progressData.key[0] as string;
        const p = progressData.value?.replace(MitoolProgressPrefix, '') ?? 'Waiting for processing';
        latestBySample.set(sampleId, p);
      }
    }
    // Apply latest stage if MiXCR hasn't emitted for that sample/chain
    for (const [sampleId, p] of latestBySample) {
      const r = resultMap.get(sampleId);
      if (!r) continue;
      if (c == 'h') {
        if (!mixcrSetHeavy.has(sampleId)) {
          r.heavy.progress = p;
        }
      } else {
        if (!mixcrSetLight.has(sampleId)) {
          r.light.progress = p;
        }
      }
    }
  }

  // Collect mitool per-step logs if present
  type LogData = { data: { key: (string | number)[]; value?: AnyLogHandle }[] };
  const mitoolStreams: Array<[key: 'parse' | 'refine' | 'consensus' | 'export', stream?: LogData]> = [
    ['parse', (app.model.outputs as unknown as { logsMitoolParse?: LogData }).logsMitoolParse],
    ['refine', (app.model.outputs as unknown as { logsMitoolRefine?: LogData }).logsMitoolRefine],
    ['consensus', (app.model.outputs as unknown as { logsMitoolConsensus?: LogData }).logsMitoolConsensus],
    ['export', (app.model.outputs as unknown as { logsMitoolExport?: LogData }).logsMitoolExport],
  ];

  for (const [key, stream] of mitoolStreams) {
    if (!stream) continue;
    for (const rec of stream.data) {
      const sampleId = rec.key[0] as string;
      const r = resultMap.get(sampleId);
      if (!r || !rec.value) continue;
      if (!r.mitool) r.mitool = {};
      r.mitool[key] = rec.value as AnyLogHandle;
    }
  }

  return resultMap;
});
