import type { InferOutputsType, PlRef } from '@platforma-sdk/model';
import { BlockModel, isPColumnSpec, parseResourceMap } from '@platforma-sdk/model';

export type BlockArgs = {
  input?: PlRef;
  species?: string;
  linker?: string;
  hinge?: string;
  heavyTagPattern?: string;
  heavyAssemblingFeature?: string;
  lightTagPattern?: string;
  lightAssemblingFeature?: string;
  limitInput?: number;
};

export type UiState = {
  title?: string;
};

export const ProgressPrefix = '[==PROGRESS==]';

export const ProgressPattern
  = /(?<stage>[^:]*):(?: *(?<progress>[0-9.]+)%)?(?: *ETA: *(?<eta>.+))?/;

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    heavyAssemblingFeature: 'CDR3:CDR3',
    lightAssemblingFeature: 'CDR3:CDR3',
  })
  .withUiState<UiState>({
    title: 'MiXCR ScFv',
  })

  .argsValid((ctx) =>
    ctx.args.species !== undefined
    && ctx.args.linker !== undefined
    && ctx.args.hinge !== undefined
    && ctx.args.heavyTagPattern !== undefined
    && ctx.args.lightTagPattern !== undefined,
  )

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

    const inputSpec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (inputSpec === undefined) return undefined;

    const labels = ctx.findLabels(inputSpec.axesSpec[0]);
    if (!labels) return undefined;

    return labels;
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

  .sections((_) => [{ type: 'link', href: '/', label: 'Main' }])

  .title((ctx) => ctx.uiState.title ?? 'MiXCR ScFv')

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
