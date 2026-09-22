---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping': patch
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.workflow': patch
---

Size the cohort aggregate and the QC report import from input volume

The aggregate requested `max(numberOfSamples, 64) GiB` and `max(numberOfSamples, 32)` cores.
Sample count sets neither cost, so a cohort of 100 samples asked for 100 GiB and 100 cores,
and the CPU pin put every run on the 32-thread line. The request is now `cpu(8)` with memory
left to the SDK, which sizes a ptabler run from the blob size of its input TSVs at
`2 GiB + 6 per GiB`. Measured need for this plan is `0.7 + 1.6` per GiB of summed TSV at 32
threads — 24 GiB at 14.5 GiB in — so the default covers every measured point with roughly a
4x margin, and the 8-thread ceiling is the one the SDK slope was fitted against.

The `qcReportTable` import carried a flat 16 GiB for a job that peaks under 2 GiB. It now
takes the same default.

Requires workflow-tengo 6.11.0, which raised the default ptabler slope to 6 and added
`memFloor()`.
