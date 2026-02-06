import type { InferOutputsType, PlDataTableStateV2, PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTableV2,
  createPlDataTableStateV2,
  isPColumnSpec,
  parseResourceMap,
} from '@platforma-sdk/model';

export type CloneClusteringMode = 'relaxed' | 'default' | 'off';
export type StopCodonType = 'amber' | 'ochre' | 'opal';

export type StopCodonReplacements = {
  amber?: string;
  ochre?: string;
  opal?: string;
};

export type BlockArgs = {
  defaultBlockLabel?: string;
  customBlockLabel?: string;
  title?: 'MiXCR scFv Alignment';
  input?: PlRef;
  species?: string;
  linker?: string;
  hinge?: string;
  order: 'hl' | 'lh';
  heavyTagPattern?: string;
  heavyAssemblingFeature?: string;
  lightTagPattern?: string;
  lightAssemblingFeature?: string;
  limitInput?: number;

  customRefMode: 'builtin' | 'scFv' | 'separate';

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

export const ProgressPrefix = '[==PROGRESS==]';

export const ProgressPattern
  = /(?<stage>[^:]*):(?: *(?<progress>[0-9.]+)%)?(?: *ETA: *(?<eta>.+))?/;

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    defaultBlockLabel: 'Select Dataset',
    customBlockLabel: '',
    heavyAssemblingFeature: 'FR1:FR4',
    lightAssemblingFeature: 'FR1:FR4',
    order: 'hl',
    hinge: '',
    customRefMode: 'builtin',
    imputeLight: false,
    mixcrMem: 32,
    mixcrCpu: 8,
    assembleScfvMem: 64,
    assembleScfvCpu: 4,
    cloneClusteringMode: 'relaxed',
  })
  .withUiState<UiState>({
    tableState: createPlDataTableStateV2(),
  })

  .argsValid((ctx) => {
    const mode = ctx.args.customRefMode ?? 'builtin';
    const speciesOk = mode === 'builtin' ? ctx.args.species !== undefined : true;
    const skipLightTagPattern = (
      (mode === 'scFv' || mode === 'separate') && (ctx.args.imputeLight === true)
    ) || (
      // also skip if a light impute sequence is already present (avoids transient race)
      (mode === 'scFv' || mode === 'separate') && typeof ctx.args.lightImputeSequence === 'string' && ctx.args.lightImputeSequence.length > 0
    );
    return (
      ctx.args.input !== undefined
      && speciesOk
      && ctx.args.linker !== undefined
      && ctx.args.hinge !== undefined
      && ctx.args.heavyTagPattern !== undefined
      && (skipLightTagPattern ? true : ctx.args.lightTagPattern !== undefined)
    );
  })

  .retentiveOutput('inputOptions', (ctx) => {
    return ctx.resultPool.getOptions((v) => {
      if (!isPColumnSpec(v)) return false;
      const domain = v.domain;
      return (
        v.name === 'pl7.app/sequencing/data'
        && (v.valueType as string) === 'File'
        && domain !== undefined
        && (domain['pl7.app/fileExtension'] === 'fasta'
          || domain['pl7.app/fileExtension'] === 'fasta.gz'
          || domain['pl7.app/fileExtension'] === 'fastq'
          || domain['pl7.app/fileExtension'] === 'fastq.gz')
      );
    });
  })

  .output('sampleLabels', (ctx): Record<string, string> | undefined => {
    const inputRef = ctx.args.input;
    if (inputRef === undefined) return undefined;

    const spec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (spec === undefined) return undefined;

    return ctx.resultPool.findLabelsForColumnAxis(spec, 0);
  })

  .output('rawTsvs', (ctx) => {
    if (ctx.outputs === undefined)
      return undefined;
    const pCols = ctx.outputs?.resolve('clonotypeTables')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return pCols.map((pCol) => {
      return {
        ...pCol,
        id: (JSON.parse(pCol.id) as { name: string }).name,
        data: parseResourceMap(pCol.data, (acc) => acc.getRemoteFileHandle(), false),
      };
    }).filter((pCol) => pCol.data.isComplete).map((pCol) => {
      return {
        ...pCol,
        data: pCol.data.data,
      };
    });
  })

  .output('logsIGHeavy', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve('logsIGHeavy'), (acc) => acc.getLogHandle(), false);
  })

  .output('logsIGLight', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve('logsIGLight'), (acc) => acc.getLogHandle(), false);
  })

  .output('progressIGHeavy', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve('logsIGHeavy'), (acc) => acc.getProgressLog(ProgressPrefix), false);
  })

  .output('progressIGLight', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve('logsIGLight'), (acc) => acc.getProgressLog(ProgressPrefix), false);
  })

  .output('qcIGHeavy', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve('qcIGHeavy'), (acc) => acc.getFileHandle(), true),
  )

  .output('qcIGLight', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve('qcIGLight'), (acc) => acc.getFileHandle(), true),
  )

  .output('reportsIGHeavy', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve('reportsIGHeavy'), (acc) => acc.getFileHandle(), false),
  )

  .output('reportsIGLight', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve('reportsIGLight'), (acc) => acc.getFileHandle(), false),
  )

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .outputWithStatus('pt', (ctx) => {
    const pCols = ctx.outputs?.resolve({ field: 'qcReportTable', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return createPlDataTableV2(ctx, pCols, ctx.uiState.tableState);
  })

  .sections((_) => [
    { type: 'link', href: '/', label: 'Main' },
    { type: 'link', href: '/qc-report-table', label: 'QC Report Table' },
  ])

  .title(() => 'MiXCR scFv Alignment')

  .subtitle((ctx) => ctx.args.customBlockLabel || ctx.args.defaultBlockLabel || '')

  .done(2);

export type BlockOutputs = InferOutputsType<typeof model>;
