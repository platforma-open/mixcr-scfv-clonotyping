---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.assemble-scfv': patch
---

Remove stale `pl-pkg prepublish` script left over from the structurer migration. The script survived migration because the structurer only deletes `prepublishOnly`, not the legacy `prepublish` name; with `@platforma-sdk/package-builder` no longer a dependency, `pl-pkg` was not found at publish time. Software build + push now happen in `block-tools software build`, so no prepublish step is needed.
