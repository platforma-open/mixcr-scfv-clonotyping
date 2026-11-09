---
"@platforma-open/milaboratories.mixcr-scfv-clonotyping.model": patch
"@platforma-open/milaboratories.mixcr-scfv-clonotyping.ui": patch
---

Compute the block subtitle without opening the block

The input dataset name is now written to the subtitle when the user picks the input,
instead of by the main page every time it renders, so opening the block no longer changes
its arguments. The trace label is unchanged ("MiXCR - scFv"). Existing blocks show as
stale once after the update because the arguments change shape.
