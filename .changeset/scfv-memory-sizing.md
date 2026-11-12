---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.workflow': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.model': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.ui': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.assemble-scfv': patch
---

Size memory from the input instead of fixed amounts, and deduplicate across projects

- MiXCR runs as one job per step (align, refineTagsAndSort with UMIs, assemble, qc) for each chain, planned by `mixcr analyze --dry-run-json` with the same arguments. Each step requests its own CPU and memory, and its log shows as its own section on the Logs tab.
- Without UMIs, `assemble` requests memory from align's clone estimate; with UMIs, or when the align report carries no estimate, from the size of the alignments.
- The other MiXCR steps, the clone and alignment exports, scFv assembly and annotation request memory from the size of the files they read, with no upper limit. The MiXCR and scFv memory settings set a minimum for every step; the MiXCR CPU setting replaces the CPU of every step.
- MiXCR is updated to 4.7.0-415.
- PTabler and table-import steps use the SDK's size-based defaults.
- Every command carries a `scfv: ` name, shown in errors and backend job names.
- Results are reused across projects with different sample names: the clonotype aggregation runs on anonymized samples, and template identities are pinned.
- Updating from an earlier version runs MiXCR, the exports and the scFv assembly once more for every sample: the per-step jobs, their names and the templates are new, so no finished job matches them. The templates carry fixed identities (`hash_override`) from this version on, as the templates of MiXCR Clonotyping and MiXCR Amplicon Alignment do, so a later update that leaves a sample's inputs unchanged reuses its finished results instead of running them again.
- The SDK is updated to workflow-tengo 6.22.2 and model/ui-vue 1.88.16, and the scFv assembly runs on runenv-python-3 1.16.1 (Python 3.12.10).
