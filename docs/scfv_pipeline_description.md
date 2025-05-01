# scFv Reconstruction Pipeline Description

This document outlines the steps involved in reconstructing single-chain variable fragments (scFv) from raw FASTQ files using the `mixcr-scFv` workflow.

## Pairing Mechanism Overview

The core idea of this pipeline is to process heavy (IGH) and light (IGK/IGL) chain sequences separately using MiXCR and then pair them based on shared original read identifiers. This requires saving the original read information during the analysis step and exporting it alongside the clone information. A final script then uses this mapping to combine the associated heavy and light chain sequences into an scFv construct.

## Workflow Steps

1.  **Analyze Chains Separately:**
    *   The `mixcr analyze generic-amplicon` command is executed twice on the *same* input FASTQ files: once targeting the IGH locus, and once targeting the IGK/IGL loci.
    *   Each run uses chain-specific `--tag-pattern` arguments to identify relevant part of read(s) and `--assemble-clonotypes-by` arguments to define the assembling feature region for each chain.
    *   Crucially, the analysis *must* include the `-Malign.parameters.saveOriginalReads=true` option to preserve the original read identifiers for later pairing.
    *   Each run generates separate intermediate alignment/clonotype data (`.clna`) and reports for the heavy and light chains.

2.  **Export Data for Pairing and Construction:**
    *   For *both* the heavy and light chain analysis results (`.clna` files):
        *   `mixcr exportAlignments` is used *solely* to create a mapping between clone IDs and the original read identifiers. This is achieved by exporting only `-cloneId` and `-descrR1` (the read identifier). This step creates `hc.alignments.tsv` and `lc.alignments.tsv`.
        *   `mixcr exportClones` is used to export the necessary clonotype details (sequences, gene usage, etc.) required for the final scFv construction. This creates `hc.clones.tsv` and `lc.clones.tsv`.

3.  **Assemble scFv:**
    *   A Python script (e.g., `assemble-scfv.py`) takes the four exported TSV files (`hc.clones.tsv`, `lc.clones.tsv`, `hc.alignments.tsv`, `lc.alignments.tsv`) as input.
    *   Using the `*.alignments.tsv` files, it maps `cloneId`s to `descrR1` read identifiers to identify which heavy chain clone corresponds to which light chain clone (as they share common `descrR1` values if derived from the same original molecule).
    *   It retrieves the full sequence information for the paired clones from the `*.clones.tsv` files.
    *   It constructs the final scFv sequence by concatenating the variable heavy chain, a linker, the variable light chain, and an optional hinge sequence, according to specified parameters (like linker sequence, order, and imputation settings).
    *   The output is a final TSV file (`result.tsv`) containing the paired clonotype information and the constructed scFv sequences (both nucleotide and amino acid).

## Example Command-Line Execution

Below are example commands to reproduce the pipeline steps.

### Example Parameters

These parameters are used in the commands below:

*   **Heavy Chain Tag Pattern:** `^(R1:*)ggaggcgg*\^*`
    *   Identifies reads potentially containing heavy chain sequences based on flanking patterns. `(R1:*)` captures the read identifier from R1.
*   **Heavy Chain Assembling Feature:** `cdr3-fr4`
    *   Defines the region used for clonotype assembly (CDR3 + FR4). MiXCR format: `{cdr3Begin:fr4End}`.
*   **Light Chain Tag Pattern:** `^*gcggaagt(R1:*)\^*gactcggatc(R2:*)`
    *   Identifies reads potentially containing light chain sequences. `(R1:*)` and `(R2:*)` capture read identifiers.
*   **Light Chain Assembling Feature:** `fr1-fr4`
    *   Defines the region used for clonotype assembly (FR1 through FR4). MiXCR format: `{fr1Begin:fr4End}`.
*   **Linker Sequence (nt):** `TGGAGGCGGCGGTTCAGGCGGAGGTGGCTCTGGCGGTGGCGGAAGT`
*   **Hinge Sequence (nt):** `GATCCGAGTCTAAGTACGGCCCTCCGTGTCCT`
*   **Imputation:**
    *   `imputeHeavy: false` (Do not create scFv if heavy chain is missing)
    *   `imputeLight: true` (If light chain is missing, use the provided `lightImputeSequence`)
*   **Heavy Impute Sequence (nt):** `GAGGTGCAGCTGTTGGAGTCTGGGGGAGGCTTGGTACAGCCTGGGGGGTCCCTGAGACTCTCCTGTGCAGCCTCTGGATTCACCTTTAGCAGCTATGCCATGAGCTGGGTCCGCCAGGCTCCAGGGAAGGGGCTGGAGTGGGTCTCAGCTATTAGTGGTAGTGGTGGTAGCACATACTACGCAGACTCCGTGAAGGGCCGGTTCACCATCTCCAGAGACAATTCCAAGAACACGCTGTATCTGCAAATGAACAGCCTGAGAGCCGAGGACACGGCCGTATATTAC` (Used only if `imputeHeavy` were `true`)
*   **Light Impute Sequence (nt):** (A corresponding sequence would be needed here if `imputeLight` is `true`)
*   **scFv Order:** `hl` (Specifies the order of concatenation)

### Commands

Replace placeholders like `<species>`, `<input_R1.fastq.gz>`, `<input_R2.fastq.gz>`, and `<light_impute_sequence_nt>` with your actual values.

**1. Analyze Heavy Chain (IGH):**

```bash
mixcr analyze generic-amplicon \
    --species <species> \
    --rna \
    --rigid-left-alignment-boundary \
    --rigid-right-alignment-boundary J \
    --tag-pattern '^(R1:*)ggaggcgg*\^*' \
    --assemble-clonotypes-by "{CDR3Begin:FR4End}" \
    -Malign.tagUnstranded=true \
    -Malign.parameters.saveOriginalReads=true \
    -Massemble.clnaOutput=true \
    <input_R1.fastq.gz> \
    <input_R2.fastq.gz> \
    result_heavy
```

**2. Analyze Light Chain (IGK/IGL):**

```bash
mixcr analyze generic-amplicon \
    --species <species> \
    --rna \
    --rigid-left-alignment-boundary \
    --rigid-right-alignment-boundary J \
    --tag-pattern '^*gcggaagt(R1:*)\^*gactcggatc(R2:*)' \
    --assemble-clonotypes-by "VDJRegion" \
    -Malign.tagUnstranded=true \
    -Malign.parameters.saveOriginalReads=true \
    -Massemble.clnaOutput=true \
    <input_R1.fastq.gz> \
    <input_R2.fastq.gz> \
    result_light
```

**3. Export Data (Heavy Chain):**

```bash
# Export Alignment Map (CloneID <-> ReadID)
mixcr exportAlignments \
    -cloneId \
    -descrR1 \
    --drop-default-fields \
    result_heavy.clna \
    hc.alignments.tsv

# Export Clone Details
mixcr exportClones \
    --export-productive-clones-only \
    --dont-split-files \
    --drop-default-fields \
    -cloneId \
    -readCount \
    -targetSequences \
    -nFeature {CDR3Begin:FR4End} \
    -nFeature CDR3 \
    -allNFeatures \
    -aaFeature {CDR3Begin:FR4End} \
    -vGene \
    -jGene \
    -aaFeature CDR3 \
    result_heavy.clna \
    hc.clones.tsv
```

**4. Export Data (Light Chain):**

```bash
# Export Alignment Map (CloneID <-> ReadID)
mixcr exportAlignments \
    -cloneId \
    -descrR1 \
    --drop-default-fields \
    result_light.clna \
    lc.alignments.tsv

# Export Clone Details
mixcr exportClones \
    --export-productive-clones-only \
    --dont-split-files \
    --drop-default-fields \
    -targetSequences \
    -allNFeatures \
    -cloneId \
    -readCount \
    -nFeature VDJRegion \
    -aaFeature VDJRegion \
    -nFeature CDR3 \
    -vGene \
    -jGene \
    -aaFeature CDR3 \
    result_light.clna \
    lc.clones.tsv
```

**5. Assemble scFv (Python Script):**

```bash
python assemble-scfv.py \   
    --imputeHeavy false \
    --imputeLight true \
    --heavyImputeSequence 'GAGGTGCAGCTGTTGGAGTCTGGGGGAGGCTTGGTACAGCCTGGGGGGTCCCTGAGACTCTCCTGTGCAGCCTCTGGATTCACCTTTAGCAGCTATGCCATGAGCTGGGTCCGCCAGGCTCCAGGGAAGGGGCTGGAGTGGGTCTCAGCTATTAGTGGTAGTGGTGGTAGCACATACTACGCAGACTCCGTGAAGGGCCGGTTCACCATCTCCAGAGACAATTCCAAGAACACGCTGTATCTGCAAATGAACAGCCTGAGAGCCGAGGACACGGCCGTATATTAC' \
    --linker 'TGGAGGCGGCGGTTCAGGCGGAGGTGGCTCTGGCGGTGGCGGAAGT' \
    --hinge 'GATCCGAGTCTAAGTACGGCCCTCCGTGTCCT' \
    --order hl
``` 
