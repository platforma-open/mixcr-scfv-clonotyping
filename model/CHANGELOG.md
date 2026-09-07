# @platforma-open/milaboratories.mixcr-scfv-clonotyping.model

## 2.8.0

### Minor Changes

- 5922209: Add the block kind and wire it into the model

  The block now declares a kind: an identity plus an init-params contract naming
  the run recipe — dataset, reference setup, both chains' tag patterns and
  assembling features, clustering and stop-codon options, and whether the run is a
  preview or a full one. `init` seeds a new block from those params and
  `templateParams` projects them back out, so a project template can pin a scFv
  library design and leave only the dataset to pick.

  Machine-local resources (both processes' memory and CPU), the QC table's view
  state and the derived block label stay out of the contract. The vocabulary types
  (`ScFvOrder`, `CustomRefMode`, `RunMode`, `CloneClusteringMode`, `StopCodonType`,
  `StopCodonReplacements`) moved to the kind and are re-exported from the model.

  Args are unchanged, so upgraded projects do not re-run.

  SDK bumped: model 1.80.10 → 1.83.0, ui-vue 1.80.10 → 1.83.3, block-tools 2.12.9
  → 2.14.6, workflow-tengo 6.8.2 → 6.8.3, test 1.80.11 → 1.83.6; CI moved to node
  22.x.

### Patch Changes

- Updated dependencies [5922209]
  - @platforma-open/milaboratories.mixcr-scfv-clonotyping.kind@1.1.0

## 2.7.3

### Patch Changes

- 1125c5d: Structurer template migration and SDK update

## 2.7.2

### Patch Changes

- dfa8850: Fix `unable to find column "umiCount"` export failure when UMIs are defined with a tag name other than exactly `UMI` (e.g. a split UMI named `UMI1`/`UMI2` across both reads). The assembly step hardcoded the `tagValueUMI` column, so MiXCR's per-capture tag columns (`tagValueUMI1`, `tagValueUMI2`, …) went undetected and `umiCount`/`umiFraction` were silently dropped from the output — while the workflow still advertised them to the exports. UMI tag columns are now detected by their `tagValueUMI*` prefix, and molecules are counted as unique tuples across all UMI captures (`pl.struct(...).n_unique()`) rather than unique values of a single column.

## 2.7.1

### Patch Changes

- 270390d: Input dropdown now requires a `pl7.app/sampleId` axis on the dataset — multiplexed (pre-demux) datasets, which carry a `pl7.app/sampleGroupId` axis instead, no longer appear as valid inputs.

  When the dropdown would be empty, the settings panel now shows an inline hint:

  - multiplexed FASTQ detected → suggest adding a `FASTQ Demultiplexing` block;
  - no FASTQ at all → suggest adding/running a `Samples & Data` block.

## 2.7.0

### Minor Changes

- 98e6acc: Migrate to BlockModelV3 with `DataModelBuilder` and add Preview / Dry run mode (100,000 reads per sample) so users can verify settings before launching a full analysis.

## 2.6.2

### Patch Changes

- dc1cf84: Upgrade SDK to 1.61.1 — fix styles import removed in new SDK, switch limitInput field to PlNumberField

## 2.6.1

### Patch Changes

- 97ed624: Upgrade MiXCR to 4.7.0-300-develop, add MI_LICENSE_DEBUG env, use --use-local-temp, show loading spinner while sample list loads

## 2.6.0

### Minor Changes

- 0390f35: stop codon replacement, dependencies updates

## 2.5.0

### Minor Changes

- 332dd30: Support custom block title and running status

## 2.4.0

### Minor Changes

- befdaec: Qc report table added and dependencies updates

## 2.3.0

### Minor Changes

- c50b273: mixcr assemble options addded

## 2.2.1

### Patch Changes

- b21113d: dependencies updates including MiXCR
- 0656c01: depnendencies updating including MiXCR

## 2.2.0

### Minor Changes

- 96faad3: added raw tables export button

## 2.1.1

### Patch Changes

- 3f0b597: technical release
- 8021367: technical release
- 81048a1: technical release
- cdccac7: technical release
- 85b1596: technical release

## 2.1.0

### Minor Changes

- c5df56e: support absence of light chain in data in case of using custom reference

## 2.0.1

### Patch Changes

- 1c55433: [sdk/ui] Broken error propagation: block errors are not showing anymore

## 2.0.0

### Major Changes

- 1314fd0: Support of custom reference + fix for frame

## 1.4.0

### Minor Changes

- aaa2967: update dependencies
- a5fccbc: reference building from user defined sequences support

## 1.3.1

### Patch Changes

- b1a09b6: minor fixes

## 1.3.0

### Minor Changes

- 17391c1: Ability to override imputed seq

## 1.2.2

### Patch Changes

- 8a502ce: update dependencies

## 1.2.1

### Patch Changes

- 0a83f6a: update SDK

## 1.2.0

### Minor Changes

- 2eb837e: Added label for clonotype key

## 1.1.1

### Patch Changes

- 328f7a4: Add more columns and settings

## 1.1.0

### Minor Changes

- 8038d90: Fixes
