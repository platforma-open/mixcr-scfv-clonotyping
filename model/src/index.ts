import type {
  InferHrefType,
  InferOutputsType,
  PlDataTableStateV2,
  PlRef,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  DataModelBuilder,
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
  defaultBlockLabel?: string;
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

  mixcrMem?: number;
  mixcrCpu?: number;
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
  tableState: PlDataTableStateV2;
  runMode: RunMode;
};

type LegacyUiState = {
  tableState: PlDataTableStateV2;
};

const dataModel = new DataModelBuilder({ kind })
  .from<BlockData>("v1")
  .upgradeLegacy<BlockArgs, LegacyUiState>(({ args, uiState }) => ({
    ...args,
    tableState: uiState.tableState,
    runMode: (args.limitInput ?? 0) > 0 ? "dry" : "full",
  }))
  // A block created from a template starts on the params its kind accepted; one
  // created by hand gets the same defaults this function used to hand out
  // unconditionally. The fields the contract leaves out are either machine-local
  // (the two processes' memory and CPU), view state (`tableState`), or derived
  // by the UI from what is here (`defaultBlockLabel`).
  .init(({ params }) => ({
    defaultBlockLabel: "Select Dataset",
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
    mixcrMem: 32,
    mixcrCpu: 8,
    assembleScfvMem: 64,
    assembleScfvCpu: 4,
    cloneClusteringMode: params?.cloneClusteringMode ?? "relaxed",
    stopCodonTypes: params?.stopCodonTypes,
    stopCodonReplacements: params?.stopCodonReplacements,
    tableState: createPlDataTableStateV2(),
    runMode: params?.runMode ?? "full",
    limitInput: params?.limitInput,
  }));

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

    // The workflow builds a custom library only out of the derived V/J FASTA
    // strings and falls back to the built-in germline when there are none, so a
    // non-builtin mode with nothing derived would run as `builtin` without
    // saying so. One chain alone is a legitimate setup — neither is not.
    const derived = (fasta: string | undefined) => fasta !== undefined && fasta !== "";
    const heavyReference = derived(data.heavyVGenes) && derived(data.heavyJGenes);
    const lightReference = derived(data.lightVGenes) && derived(data.lightJGenes);
    if (mode !== "builtin" && !heavyReference && !lightReference)
      throw new Error("A custom V/J reference is required");

    // `lightImputeSequence` is what makes the workflow impute; `imputeLight` on
    // its own only stops the light tag pattern from being required, which would
    // leave the light chain neither extracted nor imputed. Only the two custom
    // modes are checked: the checkbox is theirs, and a `builtin` block carrying
    // a stale `true` from a mode it has left offers no way to clear it.
    if (mode !== "builtin" && data.imputeLight === true && !derived(data.lightImputeSequence))
      throw new Error("A light chain reference is required to impute the light chain");

    return {
      defaultBlockLabel: data.defaultBlockLabel,
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

  .output("logsIGHeavy", (ctx) => {
    return parseResourceMap(
      ctx.outputs?.resolve("logsIGHeavy"),
      (acc) => acc.getLogHandle(),
      false,
    );
  })

  .output("logsIGLight", (ctx) => {
    return parseResourceMap(
      ctx.outputs?.resolve("logsIGLight"),
      (acc) => acc.getLogHandle(),
      false,
    );
  })

  .output("progressIGHeavy", (ctx) => {
    return parseResourceMap(
      ctx.outputs?.resolve("logsIGHeavy"),
      (acc) => acc.getProgressLog(ProgressPrefix),
      false,
    );
  })

  .output("progressIGLight", (ctx) => {
    return parseResourceMap(
      ctx.outputs?.resolve("logsIGLight"),
      (acc) => acc.getProgressLog(ProgressPrefix),
      false,
    );
  })

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

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel || "")

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
