# Overview

Analyzes single-chain variable fragment (scFv) sequencing data to identify and quantify unique scFv clonotypes from antibody discovery libraries. This block is a crucial first step for antibody engineering studies, allowing to explore the diversity and composition of scFv libraries used in phage display, yeast display, and other antibody discovery platforms.

The block takes raw sequencing reads from scFv libraries and uses the MiXCR tool to perform scFv clonotyping, which involves alignment, error correction, assembling the receptor gene sequences and grouping them into clonotypes. The process identifies and separates the three key functional elements of each scFv molecule: the variable heavy (VH) chain, the variable light (VL) chain, and the synthetic linker peptide sequence connecting them. Due to the wide variety of scFv library designs, the block is highly configurable with parameters for linker sequences, UMI handling, and custom reference libraries.

The outputs dataset can then be used in downstream blocks for deeper analysis, such as diversity assessment, tracking clonotypes in the Clonotype Browser block, or building antibody lead lists for functional characterization.

MiXCR is developed by MiLaboratories Inc. For more information, please see the [MiXCR website](https://mixcr.com/) and cite the following publication if you use this block in your research:

> Bolotin, D., Poslavsky, S., Mitrophanov, I. et al. MiXCR: software for comprehensive adaptive immunity profiling. _Nat Methods_ **12**, 380–381 (2015). [https://doi.org/10.1038/nmeth.3364](https://doi.org/10.1038/nmeth.3364)
