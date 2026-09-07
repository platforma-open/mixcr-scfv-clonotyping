import type { PlRef } from "@milaboratories/pl-model-common";
import { isPlRef } from "@milaboratories/pl-model-common";
import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import { isPlainObject } from "es-toolkit";
import { name, version } from "../package.json" with { type: "json" };

/** Orientation of the two variable domains inside the construct. */
export type ScFvOrder = "hl" | "lh";

/** Where the alignment reference comes from. `builtin` = MiXCR's germline
 *  database for the chosen species; `scFv` = one pasted construct sequence the
 *  block splits by the linker; `separate` = the two variable domains pasted
 *  apart. */
export type CustomRefMode = "builtin" | "scFv" | "separate";

/** `dry` caps the input at `limitInput` reads for a quick look; `full` runs
 *  everything. */
export type RunMode = "dry" | "full";

/** Clonotype error correction. Trades assembly time against how aggressively
 *  near-identical clonotypes are merged. */
export type CloneClusteringMode = "relaxed" | "default" | "off";

/** The three stop codons a suppressor strain may read through. */
export type StopCodonType = "amber" | "ochre" | "opal";

/** The amino acid each selected stop codon is translated to, keyed by codon. */
export type StopCodonReplacements = {
  amber?: string;
  ochre?: string;
  opal?: string;
};

/**
 * This block's init-params contract — what a creator or a project template
 * supplies to seed a new instance. A subset of the model's `BlockData`.
 *
 * The subset is the run recipe: the dataset, the reference setup, the two
 * chains' tag patterns and assembling features, the clustering and stop-codon
 * options, and whether this is a preview or a full run. A lab that sequences the
 * same scFv library design run after run can pin all of that in a template.
 *
 * Three groups of `BlockData` fields are deliberately left out.
 *
 * - **Machine-local resources.** `mixcrMem`, `mixcrCpu`, `assembleScfvMem` and
 *   `assembleScfvCpu` size two processes against the machine that runs them, not
 *   against the library being analysed.
 * - **View state.** `tableState` holds the QC grid's sort and filters.
 * - **Derived labels.** `defaultBlockLabel` is recomputed from the selected
 *   dataset every time the main page renders, and `title` is a constant.
 *
 * The per-chain V/J FASTA strings (`heavy{V,J}Genes`, `light{V,J}Genes`) and
 * `lightImputeSequence` are derived from the pasted sequences, but they are
 * params all the same: the derivation runs in a settings-panel watcher, so a
 * block created from a template and started without that panel ever being
 * opened would otherwise align against no reference at all.
 *
 * Every field is optional, because a block may be created without a template at
 * all — the model's `init` keeps its own default for each.
 */
export type BlockParams = {
  customBlockLabel?: string;
  input?: PlRef;

  species?: string;
  customRefMode?: CustomRefMode;
  scFvSequence?: string;
  heavyChainSequence?: string;
  lightChainSequence?: string;
  imputeLight?: boolean;
  lightImputeSequence?: string;
  heavyVGenes?: string;
  heavyJGenes?: string;
  lightVGenes?: string;
  lightJGenes?: string;

  linker?: string;
  hinge?: string;
  order?: ScFvOrder;
  heavyTagPattern?: string;
  heavyAssemblingFeature?: string;
  lightTagPattern?: string;
  lightAssemblingFeature?: string;

  cloneClusteringMode?: CloneClusteringMode;
  stopCodonTypes?: StopCodonType[];
  stopCodonReplacements?: StopCodonReplacements;

  runMode?: RunMode;
  limitInput?: number;
};

/**
 * The same contract at runtime, for params that arrive from a template file
 * rather than from typed code.
 *
 * Each field the contract names is read and checked here; nothing else is. A key
 * this function never reads is dropped rather than refused, so a misspelled key
 * in a template file is not caught here — it surfaces later as a block that
 * started on its defaults.
 *
 * The checks stop at the shape of a value and say nothing about whether it makes
 * sense. A linker that is not a multiple of three, a construct sequence the
 * linker cannot split in two, `dry` without a read limit: each of those is a
 * state the settings panel can be left in, and each is refused where it is used
 * — by the panel's validators and the model's `args` lambda. A parser stricter
 * than the panel would make this block export a settings file its own kind then
 * refuses to apply.
 */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const {
    customBlockLabel,
    input,
    species,
    customRefMode,
    scFvSequence,
    heavyChainSequence,
    lightChainSequence,
    imputeLight,
    lightImputeSequence,
    heavyVGenes,
    heavyJGenes,
    lightVGenes,
    lightJGenes,
    linker,
    hinge,
    order,
    heavyTagPattern,
    heavyAssemblingFeature,
    lightTagPattern,
    lightAssemblingFeature,
    cloneClusteringMode,
    stopCodonTypes,
    stopCodonReplacements,
    runMode,
    limitInput,
  } = value;

  return {
    customBlockLabel: optionalString(customBlockLabel, "customBlockLabel"),
    input: optionalPlRef(input),

    species: optionalString(species, "species"),
    customRefMode: optionalEnum(customRefMode, CUSTOM_REF_MODES, "customRefMode"),
    scFvSequence: optionalString(scFvSequence, "scFvSequence"),
    heavyChainSequence: optionalString(heavyChainSequence, "heavyChainSequence"),
    lightChainSequence: optionalString(lightChainSequence, "lightChainSequence"),
    imputeLight: optionalBoolean(imputeLight, "imputeLight"),
    lightImputeSequence: optionalString(lightImputeSequence, "lightImputeSequence"),
    heavyVGenes: optionalString(heavyVGenes, "heavyVGenes"),
    heavyJGenes: optionalString(heavyJGenes, "heavyJGenes"),
    lightVGenes: optionalString(lightVGenes, "lightVGenes"),
    lightJGenes: optionalString(lightJGenes, "lightJGenes"),

    linker: optionalString(linker, "linker"),
    hinge: optionalString(hinge, "hinge"),
    order: optionalEnum(order, SCFV_ORDERS, "order"),
    heavyTagPattern: optionalString(heavyTagPattern, "heavyTagPattern"),
    heavyAssemblingFeature: optionalString(heavyAssemblingFeature, "heavyAssemblingFeature"),
    lightTagPattern: optionalString(lightTagPattern, "lightTagPattern"),
    lightAssemblingFeature: optionalString(lightAssemblingFeature, "lightAssemblingFeature"),

    cloneClusteringMode: optionalEnum(
      cloneClusteringMode,
      CLONE_CLUSTERING_MODES,
      "cloneClusteringMode",
    ),
    stopCodonTypes: optionalStopCodonTypes(stopCodonTypes),
    stopCodonReplacements: optionalStopCodonReplacements(stopCodonReplacements),

    runMode: optionalEnum(runMode, RUN_MODES, "runMode"),
    limitInput: optionalReadLimit(limitInput),
  };
}

// Identity (`name`/`version`) comes from this package's own `package.json`, so
// the on-wire `{name}@{version}` reference can never drift from what npm
// publishes; the bundler inlines the JSON import.
export const kind = defineBlockKind<BlockParams>({
  name,
  version,
  parseInitializationParams,
});

// Internals

const SCFV_ORDERS: readonly ScFvOrder[] = ["hl", "lh"];
const CUSTOM_REF_MODES: readonly CustomRefMode[] = ["builtin", "scFv", "separate"];
const RUN_MODES: readonly RunMode[] = ["dry", "full"];
const CLONE_CLUSTERING_MODES: readonly CloneClusteringMode[] = ["relaxed", "default", "off"];
const STOP_CODON_TYPES: readonly StopCodonType[] = ["amber", "ochre", "opal"];

/** Narrows a nested value the way `assertParamsObject` narrows the whole params
 *  object, but names the field it was reading — the message goes to whoever
 *  wrote the file, and "params must be an object" would point at the wrong line. */
function assertObjectAt(value: unknown, at: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) throw new Error(`'${at}' must be an object.`);
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`'${field}' must be a string.`);
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`'${field}' must be true or false.`);
  return value;
}

/** Reads per sample in a preview run. The panel's field admits whole numbers
 *  from 1 up, and the value reaches MiXCR verbatim as `--limit-input`: 0 would
 *  preview nothing, and a fraction or a negative count fails the command. Note
 *  that `typeof` alone would let `.nan` and `.inf` through, both of which YAML
 *  admits. */
function optionalReadLimit(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1)
    throw new Error("'limitInput' must be a whole number of reads, 1 or more.");
  return value;
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value))
    throw new Error(`'${field}' must be one of ${allowed.join(", ")}.`);
  return value as T;
}

/** A reference to a column another block published. Checked with the SDK's own
 *  guard, so the brand and the optional enrichment flag stay in step with it. */
function optionalPlRef(value: unknown): PlRef | undefined {
  if (value === undefined) return undefined;
  if (!isPlRef(value)) throw new Error("'input' must be a dataset reference.");
  return value;
}

function optionalStopCodonTypes(value: unknown): StopCodonType[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("'stopCodonTypes' must be a list.");
  return value.map((entry, index) => {
    const codon = optionalEnum(entry, STOP_CODON_TYPES, `stopCodonTypes[${index}]`);
    if (codon === undefined) throw new Error(`'stopCodonTypes[${index}]' is required.`);
    return codon;
  });
}

/** Every codon is optional here: the panel writes one key per selected codon,
 *  and a selection whose replacement has not been picked yet writes none. */
function optionalStopCodonReplacements(value: unknown): StopCodonReplacements | undefined {
  if (value === undefined) return undefined;
  assertObjectAt(value, "stopCodonReplacements");

  const { amber, ochre, opal } = value;
  return {
    amber: optionalString(amber, "stopCodonReplacements.amber"),
    ochre: optionalString(ochre, "stopCodonReplacements.ochre"),
    opal: optionalString(opal, "stopCodonReplacements.opal"),
  };
}
