# @platforma-open/milaboratories.mixcr-scfv-clonotyping.kind

## 1.1.0

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
