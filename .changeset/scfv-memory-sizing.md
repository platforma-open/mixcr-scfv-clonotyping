---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.workflow': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.model': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.ui': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.assemble-scfv': patch
---

Size memory from the input and reuse results across projects

- MiXCR runs as one job per step, each with its own log section and memory sized from its input, with no upper limit.
- Memory and CPU settings start unset; MiXCR memory now sets a minimum, and a new "Per-step memory" section sets one per step.
- Results are reused across projects with different sample names. The first update re-runs each sample once.
- MiXCR updated to 4.7.0-415.
- Small bug fixes and improvements.
