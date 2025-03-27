import pandas as pd

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


result.to_csv("result.tsv", sep="\t", index=False)
