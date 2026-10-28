---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.workflow': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.model': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.ui': minor
---

Size memory from the input instead of fixed amounts, and deduplicate across projects

- MiXCR analyze, the clone and alignment exports, scFv assembly and annotation request memory from the size of the files they read, with no upper limit. The MiXCR and scFv memory settings now set a minimum.
- PTabler and table-import steps use the SDK's size-based defaults.
- Every command carries a `scfv: ` name, shown in errors and backend job names.
- Results are reused across projects with different sample names: the clonotype aggregation and QC report run on anonymized samples, and template identities are pinned.
- The SDK is updated to workflow-tengo 6.16.0.
