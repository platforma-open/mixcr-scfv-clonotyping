---
"@platforma-open/milaboratories.mixcr-scfv-clonotyping.model": patch
"@platforma-open/milaboratories.mixcr-scfv-clonotyping.ui": patch
---

Compute the block subtitle without opening the block

The input dataset name shown in the subtitle is now kept outside the block's arguments,
so opening the block no longer changes them. The trace label is unchanged ("MiXCR - scFv"). Existing blocks show as
stale once after the update because the arguments change shape.
