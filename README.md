# MiXCR scFv Alignment

Clonotype single-chain variable fragment libraries. This Platforma block uses MiXCR to process scFv sequencing data, separating each construct into its VH chain, VL chain, and synthetic linker, then assembling and quantifying unique scFv clonotypes — the first analysis step for phage and yeast display antibody discovery.

Open-source analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

## What it does

A scFv is one polypeptide containing two variable domains joined by an engineered linker. That makes it awkward for standard clonotyping: aligning the whole construct against germline references confuses the two domains, and the linker belongs to neither.

This block handles the construct as a construct. It identifies the three functional elements — the variable heavy chain, the variable light chain, and the linker peptide between them — and clonotypes each domain on its own terms, so a clonotype is a specific VH/VL pairing rather than an approximate whole-read match.

Because scFv library designs vary so widely, the block is correspondingly configurable. You supply the **linker nucleotide sequence** and, where present, a **hinge region sequence**, and set the **construct building order** so the block knows how your VH, linker, and VL are arranged. Each chain gets its own **assembling feature**, so heavy and light can be clonotyped at different granularities, and its own **tag pattern** for UMI and barcode extraction. Error correction strength is configurable, as are custom reference libraries for engineered scaffolds the germline references do not cover, and CPU and memory for both the MiXCR and the scFv assembly stages.

Outputs include the full scFv sequence alongside the separated heavy and light chain sequences, so downstream analysis can work at whichever level the question needs. A QC report table and per-sample reports show alignment and assembly quality across the library.

## Inputs & outputs

* **Input:** raw sequencing data from [Samples & Data](https://github.com/platforma-open/samples-and-data), plus your construct description — linker sequence, optional hinge sequence, and construct building order.
* **Output:** a quantified scFv clonotype dataset with the full construct sequence and separated VH and VL sequences and abundances, consumable by downstream Platforma blocks; a QC report table; per-sample reports and logs.

## Specifications

| | |
|---|---|
| Block title in app | MiXCR scFv Alignment |
| Engine | [MiXCR](https://mixcr.com/) |
| Construct handling | Separates VH chain, VL chain, and synthetic linker; configurable construct building order |
| Construct parameters | Linker nucleotide sequence, hinge region nucleotide sequence |
| Per-chain settings | Independent assembling feature and tag pattern for heavy and light |
| UMI / barcodes | Per-chain MiXCR tag patterns |
| Reference library | Built-in germline references or a custom library |
| Compute | Independent CPU and memory settings for the MiXCR and scFv assembly stages |
| Outputs | Full scFv sequence, heavy and light chain sequences, abundances, QC report table |

## Use cases

* **Phage display libraries:** clonotype scFv libraries from panning campaigns, with the VH/VL pairing preserved.
* **Yeast display:** process scFv libraries from surface-display selections.
* **Library diversity assessment:** quantify how many distinct VH/VL pairings a library actually contains.
* **Selection tracking:** feed clonotypes into [Enrichment Analysis](https://github.com/platforma-open/clonotype-enrichment) to see which scFvs enriched across rounds.
* **Paired-chain downstream analysis:** carry the VH/VL pairing into clustering, embedding, developability, and lead selection.
* **Construct QC:** confirm that reads match the intended construct layout before drawing conclusions about the library.

## FAQ

### Why does scFv data need a dedicated block?

Because an scFv is two variable domains and a synthetic linker in a single read. Standard clonotyping treats a read as one receptor chain, which conflates the domains and cannot account for the linker. This block resolves the three elements first, then clonotypes each domain properly.

### What do I need to know about my construct?

The linker nucleotide sequence, the hinge region sequence if your design has one, and the order in which VH, linker, and VL appear. Those three facts let the block parse the construct correctly; getting them wrong is the usual cause of poor alignment rates.

### Can heavy and light chains be clonotyped differently?

Yes. Each chain has its own assembling feature, so you can clonotype one at full variable region and the other at CDR3 if that is what your amplicon supports.

### How are UMIs handled?

Through per-chain MiXCR tag patterns, so a design that places barcodes differently for each chain is supported. Abundances are then counted per unique molecule rather than per read.

### What comes out — the whole construct or the chains?

Both. The full scFv sequence is reported alongside the separated heavy and light chain sequences, so downstream analysis can operate on the construct, on either chain, or on the pairing.


## Citation

MiXCR is developed by MiLaboratories Inc. If you use this block in your research, please cite:

> Bolotin, D. A., Poslavsky, S., Mitrophanov, I., Shugay, M., Mamedov, I. Z., Putintseva, E. V., & Chudakov, D. M. (2015). MiXCR: software for comprehensive adaptive immunity profiling. *Nature Methods* **12**(5), 380–381. [https://doi.org/10.1038/nmeth.3364](https://doi.org/10.1038/nmeth.3364)

## Documentation

Step-by-step guide: [Annotating scFv Libraries](https://docs.platforma.bio/guides/antibody-discovery/scFv-clonotyping/)

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory), built on [MiXCR](https://mixcr.com/). Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open) and the docs for antibody discovery at [docs.platforma.bio/biology-guides/antibody-discovery](https://docs.platforma.bio/biology-guides/antibody-discovery/).
