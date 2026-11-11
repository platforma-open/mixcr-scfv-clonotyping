import type {
  InferHrefType,
  InferOutputsType,
  PColumnResourceMapData,
  PlDataTableStateV2,
  PlRef,
  TreeNodeAccessor,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  DataModelBuilder,
  RT_RESOURCE_MAP,
  createPlDataTableV2,
  createPlDataTableStateV2,
  isPColumnSpec,
  parseResourceMap,
} from "@platforma-sdk/model";
import type {
  CloneClusteringMode,
  CustomRefMode,
  RunMode,
  ScFvOrder,
  StopCodonReplacements,
  StopCodonType,
} from "@platforma-open/milaboratories.mixcr-scfv-clonotyping.kind";
import { kind } from "@platforma-open/milaboratories.mixcr-scfv-clonotyping.kind";
import { ProgressPrefix } from "./progress";

export * from "./progress";
export * from "./reports";

// The vocabulary lives in the kind: its init-params contract names these types
// and a kind cannot import from the model. Re-exported so the UI keeps a single
// import for both the block's own types and them.
export type * from "@platforma-open/milaboratories.mixcr-scfv-clonotyping.kind";

export type BlockArgs = {
  customBlockLabel?: string;
  title?: "MiXCR scFv Alignment";
  input?: PlRef;
  species?: string;
  linker?: string;
  hinge?: string;
  order: ScFvOrder;
  heavyTagPattern?: string;
  heavyAssemblingFeature?: string;
  lightTagPattern?: string;
  lightAssemblingFeature?: string;
  limitInput?: number;

  customRefMode: CustomRefMode;

  scFvSequence?: string;
  heavyChainSequence?: string;
  lightChainSequence?: string;
  lightImputeSequence?: string;

  // If true in scFv mode, use the reference to impute light chain and ignore light chain read extraction options
  imputeLight?: boolean;

  // Custom reference sequences (optional)
  // Derived FASTA strings for repseqio
  heavyVGenes?: string;
  heavyJGenes?: string;
  lightVGenes?: string;
  lightJGenes?: string;

  // GiB. The least memory each chain's MiXCR analyze gets; unset leaves it to the input size.
  mixcrMem?: number;
  mixcrCpu?: number;
  // GiB. The least memory scFv assembly and annotation get; unset leaves it to the input size.
  assembleScfvMem?: number;
  assembleScfvCpu?: number;
  cloneClusteringMode?: CloneClusteringMode; // default: 'relaxed'
  stopCodonTypes?: StopCodonType[];
  stopCodonReplacements?: StopCodonReplacements;
};

export type UiState = {
  tableState: PlDataTableStateV2;
};

export type BlockData = BlockArgs & {
  /** Label of the chosen input dataset, shown in the subtitle; the UI keeps it in sync. */
  subtitleLabel?: string;
  tableState: PlDataTableStateV2;
  runMode: RunMode;
};

type BlockDataV1 = Omit<BlockData, "subtitleLabel"> & { defaultBlockLabel?: string };

type LegacyBlockArgs = BlockArgs & { defaultBlockLabel?: string };

type LegacyUiState = {
  tableState: PlDataTableStateV2;
};

const dataModel = new DataModelBuilder({ kind })
  .from<BlockDataV1>("v1")
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ args, uiState }) => ({
    ...args,
    tableState: uiState.tableState,
    runMode: (args.limitInput ?? 0) > 0 ? "dry" : "full",
  }))
  // "Select Dataset" was the placeholder shown before any input was picked, not a dataset label.
  .migrate<BlockData>("v2", ({ defaultBlockLabel, ...rest }) => ({
    ...rest,
    subtitleLabel: defaultBlockLabel === "Select Dataset" ? "" : defaultBlockLabel,
  }))
  // The memory settings are floors under a size-based request. 32 and 64 GiB are the old
  // defaults; a block holding them gets no floor.
  .migrate<BlockData>("v3", (data) => ({
    ...data,
    mixcrMem: data.mixcrMem === 32 ? undefined : data.mixcrMem,
    assembleScfvMem: data.assembleScfvMem === 64 ? undefined : data.assembleScfvMem,
  }))
  // A block created from a template starts on the params its kind accepted; one
  // created by hand gets the same defaults this function used to hand out
  // unconditionally. The fields the contract leaves out are either machine-local
  // (the two processes' memory and CPU), view state (`tableState`), or derived
  // from the input picked in the UI (`subtitleLabel`).
  .init(({ params }) => ({
    customBlockLabel: params?.customBlockLabel ?? "",
    input: params?.input,
    species: params?.species,
    linker: params?.linker,
    hinge: params?.hinge ?? "",
    order: params?.order ?? "hl",
    heavyTagPattern: params?.heavyTagPattern,
    heavyAssemblingFeature: params?.heavyAssemblingFeature ?? "FR1:FR4",
    lightTagPattern: params?.lightTagPattern,
    lightAssemblingFeature: params?.lightAssemblingFeature ?? "FR1:FR4",
    customRefMode: params?.customRefMode ?? "builtin",
    scFvSequence: params?.scFvSequence,
    heavyChainSequence: params?.heavyChainSequence,
    lightChainSequence: params?.lightChainSequence,
    lightImputeSequence: params?.lightImputeSequence,
    imputeLight: params?.imputeLight ?? false,
    heavyVGenes: params?.heavyVGenes,
    heavyJGenes: params?.heavyJGenes,
    lightVGenes: params?.lightVGenes,
    lightJGenes: params?.lightJGenes,
    mixcrCpu: 8,
    assembleScfvCpu: 4,
    cloneClusteringMode: params?.cloneClusteringMode ?? "relaxed",
    stopCodonTypes: params?.stopCodonTypes,
    stopCodonReplacements: params?.stopCodonReplacements,
    tableState: createPlDataTableStateV2(),
    runMode: params?.runMode ?? "full",
    limitInput: params?.limitInput,
  }));

type LogKey = PColumnResourceMapData<unknown>["data"][number]["key"];

/**
 * The input field `field` of `map`, or undefined while it is unset or when it carries an error.
 * A step that failed, or the steps that never ran after it, must not hide the logs of the others.
 */
function resolveUnlessErrored(map: TreeNodeAccessor, field: string): TreeNodeAccessor | undefined {
  try {
    return map.resolve({ field, assertFieldType: "Input" });
  } catch {
    return undefined;
  }
}

/**
 * Reads a chain's per-sample log column. A sample's value is one log stream, or a map of streams
 * keyed by MiXCR step for a run split into one command per step: the planner's stream, with the
 * planned steps' map nested beside it, and the steps after align nested again when the run waits
 * for the align report. Nested maps are flattened here.
 * Entries are keyed [sampleId] or [sampleId, step].
 */
function parseSampleLogs<T>(
  acc: TreeNodeAccessor | undefined,
  parse: (acc: TreeNodeAccessor) => T | undefined,
): PColumnResourceMapData<NonNullable<T>> | undefined {
  if (acc === undefined) return undefined;
  const data: { key: LogKey; value: NonNullable<T> }[] = [];
  // Adds the streams of a step map under `prefix`; returns whether every step is in.
  const addSteps = (steps: TreeNodeAccessor, prefix: LogKey): boolean => {
    let complete = steps.getInputsLocked();
    for (const stepKey of steps.listInputFields()) {
      const step = resolveUnlessErrored(steps, stepKey);
      if (step === undefined) {
        complete = false;
      } else if (step.resourceType.name === RT_RESOURCE_MAP) {
        complete = addSteps(step, prefix) && complete;
      } else {
        const value = parse(step);
        if (value === undefined || value === null) complete = false;
        else data.push({ key: [...prefix, ...(JSON.parse(stepKey) as LogKey)], value });
      }
    }
    return complete;
  };
  let isComplete = acc.getInputsLocked();
  for (const sampleKey of acc.listInputFields()) {
    const sample = resolveUnlessErrored(acc, sampleKey);
    if (sample === undefined) {
      isComplete = false;
      continue;
    }
    const key = JSON.parse(sampleKey) as LogKey;
    if (sample.resourceType.name === RT_RESOURCE_MAP) {
      isComplete = addSteps(sample, key) && isComplete;
    } else {
      const value = parse(sample);
      if (value === undefined || value === null) isComplete = false;
      else data.push({ key, value });
    }
  }
  return { isComplete, data };
}

export const platforma = BlockModelV3.create({ dataModel, kind })

  .args((data) => {
    const mode = data.customRefMode ?? "builtin";
    const speciesOk = mode === "builtin" ? data.species !== undefined : true;
    const skipLightTagPattern =
      ((mode === "scFv" || mode === "separate") && data.imputeLight === true) ||
      // also skip if a light impute sequence is already present (avoids transient race)
      ((mode === "scFv" || mode === "separate") &&
        typeof data.lightImputeSequence === "string" &&
        data.lightImputeSequence.length > 0);

    if (!data.input) throw new Error("Input dataset is required");
    if (!speciesOk) throw new Error("Species is required");
    if (!data.linker) throw new Error("Linker is required");
    if (data.hinge === undefined) throw new Error("Hinge is required");
    if (!data.heavyTagPattern) throw new Error("Heavy tag pattern is required");
    if (!skipLightTagPattern && !data.lightTagPattern)
      throw new Error("Light tag pattern is required");
    if (data.runMode === "dry" && data.limitInput == null)
      throw new Error("Read limit is required for Preview mode");

    return {
      customBlockLabel: data.customBlockLabel,
      title: data.title,
      input: data.input,
      species: data.species,
      linker: data.linker,
      hinge: data.hinge,
      order: data.order,
      heavyTagPattern: data.heavyTagPattern,
      heavyAssemblingFeature: data.heavyAssemblingFeature,
      lightTagPattern: data.lightTagPattern,
      lightAssemblingFeature: data.lightAssemblingFeature,
      limitInput: data.runMode === "dry" ? data.limitInput : undefined,
      customRefMode: data.customRefMode,
      scFvSequence: data.scFvSequence,
      heavyChainSequence: data.heavyChainSequence,
      lightChainSequence: data.lightChainSequence,
      lightImputeSequence: data.lightImputeSequence,
      imputeLight: data.imputeLight,
      heavyVGenes: data.heavyVGenes,
      heavyJGenes: data.heavyJGenes,
      lightVGenes: data.lightVGenes,
      lightJGenes: data.lightJGenes,
      mixcrMem: data.mixcrMem,
      mixcrCpu: data.mixcrCpu,
      assembleScfvMem: data.assembleScfvMem,
      assembleScfvCpu: data.assembleScfvCpu,
      cloneClusteringMode: data.cloneClusteringMode,
      stopCodonTypes: data.stopCodonTypes,
      stopCodonReplacements: data.stopCodonReplacements,
    };
  })

  // Inverse of the kind's init-params contract.
  .templateParams((data) => ({
    customBlockLabel: data.customBlockLabel,
    input: data.input,
    species: data.species,
    customRefMode: data.customRefMode,
    scFvSequence: data.scFvSequence,
    heavyChainSequence: data.heavyChainSequence,
    lightChainSequence: data.lightChainSequence,
    imputeLight: data.imputeLight,
    lightImputeSequence: data.lightImputeSequence,
    heavyVGenes: data.heavyVGenes,
    heavyJGenes: data.heavyJGenes,
    lightVGenes: data.lightVGenes,
    lightJGenes: data.lightJGenes,
    linker: data.linker,
    hinge: data.hinge,
    order: data.order,
    heavyTagPattern: data.heavyTagPattern,
    heavyAssemblingFeature: data.heavyAssemblingFeature,
    lightTagPattern: data.lightTagPattern,
    lightAssemblingFeature: data.lightAssemblingFeature,
    cloneClusteringMode: data.cloneClusteringMode,
    stopCodonTypes: data.stopCodonTypes,
    stopCodonReplacements: data.stopCodonReplacements,
    runMode: data.runMode,
    limitInput: data.limitInput,
  }))

  .retentiveOutput("inputOptions", (ctx) => {
    return ctx.resultPool.getOptions((v) => {
      if (!isPColumnSpec(v)) return false;
      const domain = v.domain;
      return (
        v.name === "pl7.app/sequencing/data" &&
        (v.valueType as string) === "File" &&
        domain !== undefined &&
        (domain["pl7.app/fileExtension"] === "fasta" ||
          domain["pl7.app/fileExtension"] === "fasta.gz" ||
          domain["pl7.app/fileExtension"] === "fastq" ||
          domain["pl7.app/fileExtension"] === "fastq.gz") &&
        v.axesSpec.some((a) => a.name === "pl7.app/sampleId")
      );
    });
  })

  .retentiveOutput("hasMultiplexedFastq", (ctx) => {
    return (
      ctx.resultPool.getOptions((v) => {
        if (!isPColumnSpec(v)) return false;
        const domain = v.domain;
        return (
          v.name === "pl7.app/sequencing/data" &&
          (v.valueType as string) === "File" &&
          domain !== undefined &&
          (domain["pl7.app/fileExtension"] === "fasta" ||
            domain["pl7.app/fileExtension"] === "fasta.gz" ||
            domain["pl7.app/fileExtension"] === "fastq" ||
            domain["pl7.app/fileExtension"] === "fastq.gz") &&
          v.axesSpec.some((a) => a.name === "pl7.app/sampleGroupId")
        );
      }).length > 0
    );
  })

  .output("sampleLabels", (ctx): Record<string, string> | undefined => {
    const inputRef = ctx.data.input;
    if (inputRef === undefined) return undefined;

    const spec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (spec === undefined) return undefined;

    return ctx.resultPool.findLabelsForColumnAxis(spec, 0);
  })

  .output("rawTsvs", (ctx) => {
    if (ctx.outputs === undefined) return undefined;
    const pCols = ctx.outputs?.resolve("clonotypeTables")?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return pCols
      .map((pCol) => {
        return {
          ...pCol,
          id: (JSON.parse(pCol.id) as { name: string }).name,
          data: parseResourceMap(pCol.data, (acc) => acc.getRemoteFileHandle(), false),
        };
      })
      .filter((pCol) => pCol.data.isComplete)
      .map((pCol) => {
        return {
          ...pCol,
          data: pCol.data.data,
        };
      });
  })

  // Keys are [sampleId] for the single log of a result from before the split, and
  // [sampleId, step] for a split run.
  .output("logsIGHeavy", (ctx) =>
    parseSampleLogs(ctx.outputs?.resolve("logsIGHeavy"), (acc) => acc.getLogHandle()),
  )

  .output("logsIGLight", (ctx) =>
    parseSampleLogs(ctx.outputs?.resolve("logsIGLight"), (acc) => acc.getLogHandle()),
  )

  .output("progressIGHeavy", (ctx) =>
    parseSampleLogs(ctx.outputs?.resolve("logsIGHeavy"), (acc) =>
      acc.getProgressLog(ProgressPrefix),
    ),
  )

  .output("progressIGLight", (ctx) =>
    parseSampleLogs(ctx.outputs?.resolve("logsIGLight"), (acc) =>
      acc.getProgressLog(ProgressPrefix),
    ),
  )

  .output("started", (ctx) => ctx.outputs !== undefined)

  .output("qcIGHeavy", (ctx) => {
    const acc = ctx.outputs?.resolve("qcIGHeavy");
    if (!acc || !acc.getInputsLocked()) return undefined;
    return parseResourceMap(acc, (acc) => acc.getFileHandle(), true);
  })

  .output("qcIGLight", (ctx) => {
    const acc = ctx.outputs?.resolve("qcIGLight");
    if (!acc || !acc.getInputsLocked()) return undefined;
    return parseResourceMap(acc, (acc) => acc.getFileHandle(), true);
  })

  .output("reportsIGHeavy", (ctx) =>
    parseResourceMap(ctx.outputs?.resolve("reportsIGHeavy"), (acc) => acc.getFileHandle(), false),
  )

  .output("reportsIGLight", (ctx) =>
    parseResourceMap(ctx.outputs?.resolve("reportsIGLight"), (acc) => acc.getFileHandle(), false),
  )

  .output("isRunning", (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .outputWithStatus("pt", (ctx) => {
    const pCols = ctx.outputs
      ?.resolve({ field: "qcReportTable", assertFieldType: "Input", allowPermanentAbsence: true })
      ?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return createPlDataTableV2(ctx, pCols, ctx.data.tableState);
  })

  .sections((_) => [
    { type: "link", href: "/", label: "Main" },
    { type: "link", href: "/qc-report-table", label: "QC Report Table" },
  ])

  .title(() => "MiXCR scFv Alignment")

  .subtitle(
    (ctx) =>
      ctx.data.customBlockLabel ||
      ctx.data.subtitleLabel ||
      (ctx.data.input ? "" : "Select Dataset"),
  )

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
