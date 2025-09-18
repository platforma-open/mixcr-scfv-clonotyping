import type { InferOutputsType, PlRef } from '@platforma-sdk/model';
import { BlockModel, isPColumnSpec, parseResourceMap } from '@platforma-sdk/model';

export type BlockArgs = {
  input?: PlRef;
  species?: string;
  linker?: string;
  hinge?: string;
  order: string;
  heavyTagPattern?: string;
  heavyAssemblingFeature?: string;
  lightTagPattern?: string;
  lightAssemblingFeature?: string;
  limitInput?: number;
  imputeHeavy: boolean;
  heavyImputeSequence?: string;
  imputeLight: boolean;
  lightImputeSequence?: string;
  // UMI handling
  hasUMI?: boolean;
  umiPattern?: string;
  // Custom reference sequences (optional)
  // Derived FASTA strings for repseqio
  heavyVGenes?: string;
  heavyJGenes?: string;
  lightVGenes?: string;
  lightJGenes?: string;
  // Optional inputs for deriving heavy/light sequences from full scFv or per-chain DNA
  customRefMode?: 'builtin' | 'scFv' | 'separate';
  scFvSequence?: string;
  scFvLinker?: string;
  scFvOrder?: 'hl' | 'lh';
  scFvHinge?: string;
  heavyChainSequence?: string;
  lightChainSequence?: string;
};

export type UiState = {
  title?: string;
};

export const ProgressPrefix = '[==PROGRESS==]';
export const MitoolProgressPrefix = '[==MITOOL_PROGRESS==]';

export const ProgressPattern
  = /(?<stage>[^:]*):(?: *(?<progress>[0-9.]+)%)?(?: *ETA: *(?<eta>.+))?/;

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    heavyAssemblingFeature: 'CDR3:CDR3',
    lightAssemblingFeature: 'CDR3:CDR3',
    order: 'hl',
    imputeHeavy: true,
    imputeLight: true,
    customRefMode: 'builtin',
    hasUMI: false,
  })
  .withUiState<UiState>({
    title: 'MiXCR ScFv',
  })

  .argsValid((ctx) => {
    const mode = ctx.args.customRefMode ?? 'builtin';
    const speciesOk = mode === 'builtin' ? ctx.args.species !== undefined : true;
    return (
      ctx.args.input !== undefined
      && speciesOk
      && ctx.args.linker !== undefined
      && ctx.args.hinge !== undefined
      && ctx.args.heavyTagPattern !== undefined
      && ctx.args.lightTagPattern !== undefined
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

  // Mitool progress (when UMI is enabled)
  .output('mitoolProgress', (ctx) => {
    // Prefer parse/refine/consensus/export streams; fallback to heavy logs
    const src = ctx.outputs?.resolve('logsMitoolParse')
      ?? ctx.outputs?.resolve('logsMitoolRefine')
      ?? ctx.outputs?.resolve('logsMitoolConsensus')
      ?? ctx.outputs?.resolve('logsMitoolExport')
      ?? ctx.outputs?.resolve('logsIGHeavy');
    return parseResourceMap(src, (acc) => acc.getProgressLog(MitoolProgressPrefix), false);
  })

  // Per-step mitool progress
  .output('mitoolParseProgress', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolParse', allowPermanentAbsence: true }), (acc) => acc.getProgressLog(MitoolProgressPrefix), false);
  })
  .output('mitoolRefineProgress', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolRefine', allowPermanentAbsence: true }), (acc) => acc.getProgressLog(MitoolProgressPrefix), false);
  })
  .output('mitoolConsensusProgress', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolConsensus', allowPermanentAbsence: true }), (acc) => acc.getProgressLog(MitoolProgressPrefix), false);
  })
  .output('mitoolExportProgress', (ctx) => {
    return parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolExport', allowPermanentAbsence: true }), (acc) => acc.getProgressLog(MitoolProgressPrefix), false);
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

  // MiTool logs (per-step)
  .output('logsMitoolParse', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolParse', assertFieldType: 'Input', allowPermanentAbsence: true }), (acc) => acc.getLogHandle(), false),
  )
  .output('logsMitoolRefine', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolRefine', assertFieldType: 'Input', allowPermanentAbsence: true }), (acc) => acc.getLogHandle(), false),
  )
  .output('logsMitoolConsensus', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolConsensus', assertFieldType: 'Input', allowPermanentAbsence: true }), (acc) => acc.getLogHandle(), false),
  )
  .output('logsMitoolExport', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve({ field: 'logsMitoolExport', assertFieldType: 'Input', allowPermanentAbsence: true }), (acc) => acc.getLogHandle(), false),
  )

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .sections((_) => [{ type: 'link', href: '/', label: 'Main' }])

  .title((ctx) => ctx.uiState.title ?? 'MiXCR ScFv')

  .done(2);

export type BlockOutputs = InferOutputsType<typeof model>;
