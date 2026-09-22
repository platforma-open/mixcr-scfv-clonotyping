---
'@platforma-open/milaboratories.mixcr-scfv-clonotyping': patch
'@platforma-open/milaboratories.mixcr-scfv-clonotyping.workflow': patch
---

Move to the latest SDK

`block-tools` 2.14.6 to 2.16.0 and `tengo-builder` 4.0.25 to 4.1.0, which the CI
`require-latest` preflight checks and blocks the merge queue on; `model` 1.83.17,
`ui-vue` 1.83.21, `package-builder` 3.16.0 and `test` 1.83.24 come with the same
`structure refresh`.

`tengo-builder` 4.1.0 adds `pl-tengo imports`, which the refresh wires into the workflow
`check` script. It removed 21 unused imports across six templates. It also removed
`qc-report-columns`, which was in use: the checker recognises an import only where its
alias appears with a dot, and the lib exported a bare function called as
`qcReportColumns(...)`. The lib now exports a map and the call is
`qcReportColumns.getQcReportColumns(...)`, matching `mixcr-exports.lib.tengo`.
