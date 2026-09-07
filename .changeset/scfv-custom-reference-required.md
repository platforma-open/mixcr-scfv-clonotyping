---
"@platforma-open/milaboratories.mixcr-scfv-clonotyping": patch
"@platforma-open/milaboratories.mixcr-scfv-clonotyping.model": patch
---

Refuse to run a custom-reference mode with no reference

The workflow builds a custom library only out of the derived per-chain V/J FASTA
strings, and falls back to the built-in germline when there are none — so a
`scFv` or `separate` block whose sequences were never derived ran as `builtin`
without saying so. It now reports that a custom V/J reference is required.

For the same reason, requesting light-chain imputation without a light-chain
reference is refused: only the derived impute sequence makes the workflow
impute, while the request on its own stopped the light tag pattern from being
required, leaving the light chain neither extracted nor imputed.
