import pandas as pd
import argparse

parser = argparse.ArgumentParser(
    description="Assembles scFv from MiXCR alignments"
)
parser.add_argument("--linker", help="linker nt sequence")
parser.add_argument("--hinge", help="hinge nt sequence")
args = parser.parse_args()


linker = args.linker
hinge = args.hinge


prefix = ""  # "test_data/"
hc_clones_file = prefix + "hc.clones.tsv"
lc_clones_file = prefix + "lc.clones.tsv"

hc_alignments_file = prefix + "hc.alignments.tsv"
lc_alignments_file = prefix + "lc.alignments.tsv"

hc_mixcr_clones = pd.read_csv(hc_clones_file, sep="\t")
lc_mixcr_clones = pd.read_csv(lc_clones_file, sep="\t")

hc_mixcr_clones = hc_mixcr_clones.drop(
    ['readCount', 'readFraction'], axis=1, errors='ignore')
lc_mixcr_clones = lc_mixcr_clones.drop(
    ['readCount', 'readFraction'], axis=1, errors='ignore')

hc_mixcr_alignments = pd.read_csv(hc_alignments_file, sep="\t")
lc_mixcr_alignments = pd.read_csv(lc_alignments_file, sep="\t")

hc_mixcr_alignments = hc_mixcr_alignments[hc_mixcr_alignments['cloneId'] != -1]
lc_mixcr_alignments = lc_mixcr_alignments[lc_mixcr_alignments['cloneId'] != -1]


hl = pd.merge(
    hc_mixcr_alignments,
    lc_mixcr_alignments,
    on="descrR1",
    how="inner",
    suffixes=('-IGHeavy', '-IGLight')
)

hl = hl.groupby([
    'cloneId-IGHeavy',
    'cloneId-IGLight'
]).size().reset_index(name='readCount')

hl['readFraction'] = hl['readCount'] / hl['readCount'].sum()

# heavy
result = pd.merge(hl, hc_mixcr_clones, left_on='cloneId-IGHeavy',
                  right_on='cloneId', how='left')
result = result.drop('cloneId', axis=1)
# light
result = pd.merge(result, lc_mixcr_clones, left_on='cloneId-IGLight',
                  right_on='cloneId', how='left', suffixes=('-IGHeavy', '-IGLight'))
result = result.drop('cloneId', axis=1)


result["clonotypeKey"] = result["targetSequences-IGHeavy"] + "-" + result["targetSequences-IGLight"] + "-" + \
    result["bestVGene-IGHeavy"] + "-" + result["bestVGene-IGLight"] + \
    result["bestJGene-IGHeavy"] + "-" + result["bestJGene-IGLight"]

if "bestCGene-IGHeavy" in result:
    result["clonotypeKey"] = result["clonotypeKey"] + "-" + \
        result["bestCGene-IGHeavy"] + "-" + result["bestCGene-IGLight"]


heavyVdj = "nSeqImputedVDJRegion-IGHeavy"
lightVdj = "nSeqImputedVDJRegion-IGLight"

if "nSeqImputedVDJRegion-IGHeavy" in result:
    heavyVdj = "nSeqImputedVDJRegion-IGHeavy"
elif "nSeqVDJRegion-IGHeavy" in result:
    heavyVdj = "nSeqVDJRegion-IGHeavy" 
else:
    raise ValueError("VDJ region - heavy not found")

if "nSeqImputedVDJRegion-IGLight" in result:
    lightVdj = "nSeqImputedVDJRegion-IGLight"
elif "nSeqVDJRegion-IGLight" in result:
    lightVdj = "nSeqVDJRegion-IGLight"
else:
    raise ValueError("VDJ region - light not found")


# Filter out rows where VDJ regions are empty/null
result = result[
    (result[heavyVdj].notna()) & 
    (result[heavyVdj].str.len() > 0) &
    (result[lightVdj].notna()) & 
    (result[lightVdj].str.len() > 0)
].copy()


# Create construct-nt column
result["construct-nt"] = result[heavyVdj] + linker + result[lightVdj] + hinge

# Translate nucleotide sequence to amino acid sequence
def translate(seq):
    if pd.isna(seq):
        return None
    
    # Standard genetic code
    genetic_code = {
        'ATA':'I', 'ATC':'I', 'ATT':'I', 'ATG':'M',
        'ACA':'T', 'ACC':'T', 'ACG':'T', 'ACT':'T',
        'AAC':'N', 'AAT':'N', 'AAA':'K', 'AAG':'K',
        'AGC':'S', 'AGT':'S', 'AGA':'R', 'AGG':'R',
        'CTA':'L', 'CTC':'L', 'CTG':'L', 'CTT':'L',
        'CCA':'P', 'CCC':'P', 'CCG':'P', 'CCT':'P',
        'CAC':'H', 'CAT':'H', 'CAA':'Q', 'CAG':'Q',
        'CGA':'R', 'CGC':'R', 'CGG':'R', 'CGT':'R',
        'GTA':'V', 'GTC':'V', 'GTG':'V', 'GTT':'V',
        'GCA':'A', 'GCC':'A', 'GCG':'A', 'GCT':'A',
        'GAC':'D', 'GAT':'D', 'GAA':'E', 'GAG':'E',
        'GGA':'G', 'GGC':'G', 'GGG':'G', 'GGT':'G',
        'TCA':'S', 'TCC':'S', 'TCG':'S', 'TCT':'S',
        'TTC':'F', 'TTT':'F', 'TTA':'L', 'TTG':'L',
        'TAC':'Y', 'TAT':'Y', 'TAA':'*', 'TAG':'*',
        'TGC':'C', 'TGT':'C', 'TGA':'*', 'TGG':'W',
    }
    
    protein = ""
    # Read in codons (3 nucleotides at a time)
    for i in range(0, len(seq), 3):
        codon = seq[i:i+3].upper()
        # Skip if incomplete codon
        if len(codon) < 3:
            continue
        # Translate codon to amino acid
        aa = genetic_code.get(codon, 'X')  # X for unknown codons
        protein += aa
    
    # Add underscore if sequence length is not divisible by 3
    if len(seq) % 3 != 0:
        protein += '_'
    
    return protein

# Add amino acid sequence column
result["construct-aa"] = result["construct-nt"].apply(translate)

result.to_csv("result.tsv", sep="\t", index=False)