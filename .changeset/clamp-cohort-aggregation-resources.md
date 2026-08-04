---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.workflow': patch
---

Clonotype aggregation requests at most 62 CPU and 256 GiB.

The request scaled by one CPU and one GiB per sample with no upper bound, so a cohort
past 62 samples asked for more CPU than the largest available node has. Such a job waits
for capacity that cannot exist rather than failing, while still holding its queue quota.
Cohorts of 62 samples or fewer request exactly what they did before.
