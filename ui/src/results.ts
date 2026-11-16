import {
  AlignReport,
  AssembleReport,
  ProgressPrefix,
} from "@platforma-open/milaboratories.mixcr-scfv-clonotyping.model";
import { isLiveLog, type AnyLogHandle } from "@platforma-sdk/model";
import { ReactiveFileContent } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "./app";

export type ScFvResult = {
  label: string;
  sampleId: string;
  heavy: MiXCRResult;
  light: MiXCRResult;
};

export type MiXCRResult = {
  progress: string;
  logs: StepLog[];
  alignReport?: AlignReport;
  assembleReport?: AssembleReport;
};

// MiXCR runs as one command per step. Step logs and progress arrive keyed by (sampleId, step).
// The workflow leads each step key with its zero-padded run position (`002:assemble`), so the
// keys sort in run order and the furthest step sorts last. A result from before the split has
// only the single log, keyed by (sampleId); both kinds arrive in the same list.

type Entries<T> = { key: unknown[]; value?: T }[];

/** One MiXCR step's log. `key` is the workflow's `002:assemble`; `label` keeps the run position
 * (`002 assemble`). `label` is undefined for the single log of a result from before the split. */
export type StepLog = { key: string; label?: string; handle: AnyLogHandle };

/** Each sample's step logs in run order, or its single log when it has no step logs. */
function logsPerSample(entries: Entries<AnyLogHandle> | undefined): Map<string, StepLog[]> {
  const out = new Map<string, StepLog[]>();
  const perStep = (entries ?? []).filter((e) => e.key.length === 2);
  const single = (entries ?? []).filter((e) => e.key.length === 1);
  perStep.sort((a, b) => String(a.key[1]).localeCompare(String(b.key[1])));
  for (const e of perStep) {
    if (e.value === undefined) continue;
    const sampleId = e.key[0] as string;
    const key = String(e.key[1]);
    const logs = out.get(sampleId) ?? [];
    logs.push({ key, label: key.replace(":", " "), handle: e.value });
    out.set(sampleId, logs);
  }
  for (const e of single) {
    const sampleId = e.key[0] as string;
    if (e.value !== undefined && !out.has(sampleId))
      out.set(sampleId, [{ key: "analyze", handle: e.value }]);
  }
  return out;
}

/** Each sample's progress line: the single log's, replaced by the furthest step's that has
 * printed one. A step with no progress line yet reports the empty string; `qc` never prints one. */
function progressPerSample(entries: Entries<string> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const furthest = new Map<string, string>();
  for (const e of entries ?? []) {
    if (e.value === undefined || e.value === "") continue;
    const sampleId = e.key[0] as string;
    if (e.key.length === 1) {
      if (!furthest.has(sampleId)) out.set(sampleId, e.value);
      continue;
    }
    const step = String(e.key[1]);
    const current = furthest.get(sampleId);
    if (current !== undefined && step < current) continue;
    furthest.set(sampleId, step);
    out.set(sampleId, e.value);
  }
  return out;
}

/** A chain is done once its last log has ended: the single log, or the log of `qc`, the last
 * step of every plan. */
function isDone(logs: StepLog[]): boolean {
  const last = logs[logs.length - 1];
  if (last === undefined) return false;
  if (last.label !== undefined && !last.key.endsWith(":qc")) return false;
  return !isLiveLog(last.handle);
}

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
        progress: app.model.outputs.isRunning ? "Queued" : "Not started",
        logs: [],
      },
      light: {
        progress: app.model.outputs.isRunning ? "Queued" : "Not started",
        logs: [],
      },
    };
    resultMap.set(sampleId, result);
  }

  // logs & reports
  for (const c of ["h", "k"]) {
    let logs;
    let reports;
    let progress;
    if (c == "h") {
      logs = app.model.outputs.logsIGHeavy;
      reports = app.model.outputs.reportsIGHeavy;
      progress = app.model.outputs.progressIGHeavy;
    } else {
      logs = app.model.outputs.logsIGLight;
      reports = app.model.outputs.reportsIGLight;
      progress = app.model.outputs.progressIGLight;
    }

    for (const [sampleId, stepLogs] of logsPerSample(logs?.data)) {
      const r = resultMap.get(sampleId);
      if (!r) continue;

      if (c == "h") r.heavy.logs = stepLogs;
      else r.light.logs = stepLogs;
    }

    if (reports)
      for (const report of reports.data) {
        const sampleId = report.key[0] as string;
        const reportId = report.key[1] as string;
        if (report.key[2] !== "json" || report.value === undefined) continue;
        const r = resultMap.get(sampleId);
        if (r) {
          let chainResult;
          if (c == "h") chainResult = r.heavy;
          else chainResult = r.light;

          switch (reportId) {
            case "align":
              // globally cached
              chainResult.alignReport = reactiveFileContent.getContentJson(
                report.value.handle,
                AlignReport as never,
              )?.value as AlignReport | undefined;
              break;
            case "assemble":
              // globally cached
              chainResult.assembleReport = reactiveFileContent.getContentJson(
                report.value.handle,
                AssembleReport as never,
              )?.value as AssembleReport | undefined;
              break;
          }
        }
      }

    const lines = progressPerSample(progress?.data);
    for (const [sampleId, r] of resultMap) {
      const chainResult = c == "h" ? r.heavy : r.light;
      const line = lines.get(sampleId);
      if (isDone(chainResult.logs)) chainResult.progress = "Done";
      else if (line !== undefined) chainResult.progress = line.replace(ProgressPrefix, "");
    }
  }

  return resultMap;
});
