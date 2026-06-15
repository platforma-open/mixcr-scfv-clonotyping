---
"@platforma-open/milaboratories.mixcr-scfv-clonotyping.assemble-scfv": patch
"@platforma-open/milaboratories.mixcr-scfv-clonotyping": patch
"@platforma-open/milaboratories.mixcr-scfv-clonotyping.model": patch
---

Fix `unable to find column "umiCount"` export failure when UMIs are defined with a tag name other than exactly `UMI` (e.g. a split UMI named `UMI1`/`UMI2` across both reads). The assembly step hardcoded the `tagValueUMI` column, so MiXCR's per-capture tag columns (`tagValueUMI1`, `tagValueUMI2`, …) went undetected and `umiCount`/`umiFraction` were silently dropped from the output — while the workflow still advertised them to the exports. UMI tag columns are now detected by their `tagValueUMI*` prefix, and molecules are counted as unique tuples across all UMI captures (`pl.struct(...).n_unique()`) rather than unique values of a single column.