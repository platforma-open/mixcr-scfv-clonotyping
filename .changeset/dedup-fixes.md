---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.workflow': minor
'@platforma-open/milaboratories.mixcr-scfv-clonotyping': minor
---

Fix cross-project deduplication for aggregation and QC report

- Add `anonymize: true` to aggregation processColumn
- Anonymize QC report inputs and deanonymize output TSV
- Move CPU/memory allocation params to metaExtra in analyze processColumn
- Add `hash_override` to all 5 structural templates
