import polars as pl
import argparse
import hashlib
import base64

parser = argparse.ArgumentParser(
    description="Assembles scFv from MiXCR alignments"
)
parser.add_argument("--linker", help="linker nt sequence")
parser.add_argument("--hinge", help="hinge nt sequence")
parser.add_argument(
    "--order",
    help="construct building order: hl for 'heavy-linker-light-hinge' or lh for 'light-linker-heavy-hinge'")
parser.add_argument(
    "--light-impute",
    dest="light_impute",
    help="optional light chain VDJ sequence to use when light is missing"
)
parser.add_argument(
    "--no-light",
    action="store_true",
    help="do not expect light chain mixcr inputs; use --light-impute"
)
args = parser.parse_args()


linker = args.linker
hinge = args.hinge


prefix = ""  # "test_data/"
hc_clones_file = prefix + "hc.clones.tsv"
lc_clones_file = prefix + "lc.clones.tsv"

hc_alignments_file = prefix + "hc.alignments.tsv"
lc_alignments_file = prefix + "lc.alignments.tsv"

schema_overrides = {
    "nLengthCDR3": pl.String,
    "aaLengthCDR3": pl.String
}

hc_mixcr_clones = pl.read_csv(
    hc_clones_file, separator="\t", infer_schema_length=0)
hc_mixcr_clones = hc_mixcr_clones.with_columns(
    pl.col("cloneId").cast(pl.Int64))
# Remove "InFrame" from all column names in hc_mixcr_clones DataFrame
hc_mixcr_clones = hc_mixcr_clones.rename(
    {col: col.replace("InFrame", "") for col in hc_mixcr_clones.columns})

if not args.no_light:
    lc_mixcr_clones = pl.read_csv(
        lc_clones_file, separator="\t", infer_schema_length=0)
    lc_mixcr_clones = lc_mixcr_clones.with_columns(
        pl.col("cloneId").cast(pl.Int64))
    # Remove "InFrame" from all column names in lc_mixcr_clones DataFrame
    lc_mixcr_clones = lc_mixcr_clones.rename(
        {col: col.replace("InFrame", "") for col in lc_mixcr_clones.columns})


cols_to_drop = ['readCount', 'readFraction',
                'uniqueMoleculeCount', 'uniqueMoleculeFraction']
hc_mixcr_clones = hc_mixcr_clones.drop(
    [col for col in cols_to_drop if col in hc_mixcr_clones.columns])
if not args.no_light:
    lc_mixcr_clones = lc_mixcr_clones.drop(
        [col for col in cols_to_drop if col in lc_mixcr_clones.columns])

hc_mixcr_alignments = pl.read_csv(
    hc_alignments_file, separator="\t", infer_schema_length=0)
hc_mixcr_alignments = hc_mixcr_alignments.with_columns(
    pl.col("cloneId").cast(pl.Int64))
if not args.no_light:
    lc_mixcr_alignments = pl.read_csv(
        lc_alignments_file, separator="\t", infer_schema_length=0)
    lc_mixcr_alignments = lc_mixcr_alignments.with_columns(
        pl.col("cloneId").cast(pl.Int64))

hc_mixcr_alignments = hc_mixcr_alignments.filter(pl.col('cloneId') != -1)
if not args.no_light:
    lc_mixcr_alignments = lc_mixcr_alignments.filter(pl.col('cloneId') != -1)


hc_cols = {
    col: f"{col}-IGHeavy" for col in hc_mixcr_alignments.columns if col != "descrR1"}
if not args.no_light:
    lc_cols = {
        col: f"{col}-IGLight" for col in lc_mixcr_alignments.columns if col != "descrR1"}
else:
    lc_cols = {}
if not args.no_light:
    hl = hc_mixcr_alignments.rename(hc_cols).join(
        lc_mixcr_alignments.rename(lc_cols),
        on="descrR1",
        how="inner"
    )
else:
    # fabricate a single synthetic light cloneId to cross with heavy cloneId and preserve heavy aggregation
    hl = hc_mixcr_alignments.rename(hc_cols).with_columns(
        **{"cloneId-IGLight": pl.lit(0)}
    )

if 'tagValueUMI-IGHeavy' in hl.columns:
    hl = hl.group_by(['cloneId-IGHeavy', 'cloneId-IGLight']).agg(
        readCount=pl.col('descrR1').count(),
        umiCount=pl.col('tagValueUMI-IGHeavy').n_unique()
    )
    hl = hl.with_columns(
        (pl.col('umiCount') / pl.col('umiCount').sum()).alias('umiFraction'))
else:
    hl = hl.group_by([
        'cloneId-IGHeavy',
        'cloneId-IGLight'
    ]).agg(readCount=pl.count())

hl = hl.with_columns(
    (pl.col('readCount') / pl.col('readCount').sum()).alias('readFraction'))

# heavy
hc_mixcr_clones = hc_mixcr_clones.rename(
    {col: f"{col}-IGHeavy" for col in hc_mixcr_clones.columns})
result = hl.join(hc_mixcr_clones,
                 on='cloneId-IGHeavy',
                 how='left')

if not args.no_light:
    # light
    lc_mixcr_clones = lc_mixcr_clones.rename(
        {col: f"{col}-IGLight" for col in lc_mixcr_clones.columns})
    result = result.join(lc_mixcr_clones,
                        on='cloneId-IGLight',
                        how='left')

if not args.no_light:
    result = result.with_columns(
        clonotypeKey=pl.format("{}-{}-{}-{}-{}-{}",
                               "targetSequences-IGHeavy", "targetSequences-IGLight",
                               "bestVGene-IGHeavy", "bestVGene-IGLight",
                               "bestJGene-IGHeavy", "bestJGene-IGLight")
    )
else:
    # no light info; construct key using only heavy-side fields and a sentinel light part
    result = result.with_columns(
        clonotypeKey=pl.format("{}-{}-{}",
                               "targetSequences-IGHeavy",
                               "bestVGene-IGHeavy",
                               "bestJGene-IGHeavy")
    )

result = result.filter(pl.col('clonotypeKey').is_not_null())


if "bestCGene-IGHeavy" in result.columns and "bestCGene-IGLight" in result.columns:
    result = result.with_columns(
        clonotypeKey=pl.col("clonotypeKey") + "-" +
        result["bestCGene-IGHeavy"] + "-" + result["bestCGene-IGLight"]
    )

# Hash the clonotypeKey after potentially adding C-genes
result = result.with_columns(
    clonotypeKey=pl.col('clonotypeKey').map_elements(
        lambda x: base64.b32encode(bytes.fromhex(
            hashlib.sha256(x.encode()).hexdigest()[:24])).decode('utf-8'),
        return_dtype=pl.String
    )
)

result = result.with_columns(
    clonotypeLabel="C-" + pl.col("clonotypeKey").str.slice(0, 6))

heavyVdj = None
lightVdj = None

if "nSeqVDJRegion-IGHeavy" in result.columns:
    heavyVdj = "nSeqVDJRegion-IGHeavy"
elif "nSeqImputedVDJRegion-IGHeavy" in result.columns:
    heavyVdj = "nSeqImputedVDJRegion-IGHeavy"
else:
    raise ValueError("VDJ region - heavy not found")

if "nSeqVDJRegion-IGLight" in result.columns:
    lightVdj = "nSeqVDJRegion-IGLight"
elif "nSeqImputedVDJRegion-IGLight" in result.columns:
    lightVdj = "nSeqImputedVDJRegion-IGLight"
elif args.light_impute is not None:
    # Create a synthetic light VDJ column from provided impute sequence
    result = result.with_columns(
        **{"nSeqImputedVDJRegion-IGLight": pl.lit(args.light_impute)}
    )
    lightVdj = "nSeqImputedVDJRegion-IGLight"
else:
    raise ValueError("VDJ region - light not found and no --light-impute provided")


# Filter out rows where VDJ regions are empty/null or contain region_not_covered
result = result.filter(
    (pl.col(heavyVdj).is_not_null()) &
    (pl.col(heavyVdj).str.len_chars() > 0) &
    (~pl.col(heavyVdj).str.contains('region_not_covered')) &
    (pl.col(lightVdj).is_not_null()) &
    (pl.col(lightVdj).str.len_chars() > 0) &
    (~pl.col(lightVdj).str.contains('region_not_covered'))
)

# Create construct-nt column
if args.order == "hl":
    result = result.with_columns(
        (pl.col(heavyVdj) + linker + pl.col(lightVdj) + hinge).alias("construct-nt"))
elif args.order == "lh":
    result = result.with_columns(
        (pl.col(lightVdj) + linker + pl.col(heavyVdj) + hinge).alias("construct-nt"))
else:
    raise ValueError("Invalid order: " + args.order)

# Translate nucleotide sequence to amino acid sequence


def translate(seq):
    if seq is None:
        return None

    # Standard genetic code
    genetic_code = {
        'ATA': 'I', 'ATC': 'I', 'ATT': 'I', 'ATG': 'M',
        'ACA': 'T', 'ACC': 'T', 'ACG': 'T', 'ACT': 'T',
        'AAC': 'N', 'AAT': 'N', 'AAA': 'K', 'AAG': 'K',
        'AGC': 'S', 'AGT': 'S', 'AGA': 'R', 'AGG': 'R',
        'CTA': 'L', 'CTC': 'L', 'CTG': 'L', 'CTT': 'L',
        'CCA': 'P', 'CCC': 'P', 'CCG': 'P', 'CCT': 'P',
        'CAC': 'H', 'CAT': 'H', 'CAA': 'Q', 'CAG': 'Q',
        'CGA': 'R', 'CGC': 'R', 'CGG': 'R', 'CGT': 'R',
        'GTA': 'V', 'GTC': 'V', 'GTG': 'V', 'GTT': 'V',
        'GCA': 'A', 'GCC': 'A', 'GCG': 'A', 'GCT': 'A',
        'GAC': 'D', 'GAT': 'D', 'GAA': 'E', 'GAG': 'E',
        'GGA': 'G', 'GGC': 'G', 'GGG': 'G', 'GGT': 'G',
        'TCA': 'S', 'TCC': 'S', 'TCG': 'S', 'TCT': 'S',
        'TTC': 'F', 'TTT': 'F', 'TTA': 'L', 'TTG': 'L',
        'TAC': 'Y', 'TAT': 'Y', 'TAA': '*', 'TAG': '*',
        'TGC': 'C', 'TGT': 'C', 'TGA': '*', 'TGG': 'W',
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
result = result.with_columns(pl.col("construct-nt").map_elements(
    translate, return_dtype=pl.String).alias("construct-aa"))

# Add isProductive column - false if construct-aa contains stop codon(*) or incomplete codon(_)
result = result.with_columns(
    isProductive=~pl.col("construct-aa").str.contains(r"[*_]", strict=False))

# Group by 'construct-aa' and aggregate
# Sum readCount and readFraction, take first value for all other columns
agg_expressions = [
    pl.sum('readCount'),
    pl.sum('readFraction')
]
if 'umiCount' in result.columns:
    agg_expressions.append(pl.sum('umiCount'))
    agg_expressions.append(pl.sum('umiFraction'))


# Create a list of expressions for all other columns to take the first value
other_cols = [col for col in result.columns if col not in [
    'construct-aa', 'readCount', 'readFraction', 'umiCount', 'umiFraction']]
agg_expressions.extend([pl.first(col) for col in other_cols])

# Perform the groupby operation
result = result.group_by('construct-aa').agg(agg_expressions)

result = result.sort("construct-nt")


# result["isProductive"] = result["isProductive"].astype(str).str.lower()
result.write_csv("result.tsv", separator="\t")
