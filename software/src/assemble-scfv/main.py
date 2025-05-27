#!/usr/bin/env python3
import pandas as pd
import argparse
import hashlib
import base64
import string # For base36 conversion
import sys


# Conversion functions for base36
def b36_to_int(b36_str):
    """Converts a base 36 string to an integer. Case-insensitive for a-z."""
    if not b36_str:
        return 0
    return int(str(b36_str), 36) # int(..., 36) handles lower and upper case a-z


def int_to_b36(num):
    """Converts an integer to an UPPERCASE base 36 string (0-9, A-Z)."""
    if not isinstance(num, int) or num < 0:
        return '0'
    if num == 0:
        return '0'

    alphanum = string.digits + string.ascii_uppercase # Ensures UPPERCASE letters
    res = ''
    while num > 0:
        num, rem = divmod(num, 36)
        res = alphanum[rem] + res
    return res


def parse_annotation_string(annotation_str):
    """
    Parses 'label:start[+length]|...' into a list of dicts.
    Labels are preserved as is from input.
    Length is optional; if missing, it's treated as 0.
    """
    if pd.isna(annotation_str) or not str(annotation_str).strip():
        return []
    annotations = []
    parts = str(annotation_str).split('|')
    for part in parts:
        if not part.strip(): continue
        try:
            # Split the part into coordinate and optional length
            # e.g., "LABEL:START+LENGTH" or "LABEL:START"
            if '+' in part:
                label_coord_part, length_str = part.split('+', 1)
            else:
                label_coord_part = part
                length_str = "" # Indicates length 0, b36_to_int("") will return 0

            # Split the coordinate part into label and start
            # Use rsplit with maxsplit=1 in case label contains ':' (though unusual for this format)
            # However, sticking to split(':',1) if labels are not expected to have colons.
            # If typical format is strictly label:start, then split(':',1) is fine.
            if ':' not in label_coord_part:
                raise ValueError("Missing ':' separator between label and start coordinate.")
            
            label, start_b36 = label_coord_part.split(':', 1) # Split on the first colon

            annotations.append({
                "label": label, # Label stored as is from input
                "start": b36_to_int(start_b36),
                "length": b36_to_int(length_str) # b36_to_int handles empty string as 0
            })
        except ValueError as e:
            print(f"Warning: Could not parse annotation part '{part}' in string '{annotation_str}'. Error: {e}. Skipping.", file=sys.stdout)
            continue
    return annotations


def format_annotation_string(parsed_annotations):
    """Formats a list of parsed annotations back into 'LABEL:START+LENGTH|...' UPPERCASE string."""
    if not parsed_annotations:
        return pd.NA
    # Uppercase the label and use the uppercase base36 conversion from int_to_b36
    return "|".join([f"{str(ann['label']).upper()}:{int_to_b36(ann['start'])}+{int_to_b36(ann['length'])}" for ann in parsed_annotations])


def shift_annotations(annotation_str, shift_amount):
    """Shifts the start coordinates in an annotation string, outputs in UPPERCASE."""
    if pd.isna(annotation_str) or not str(annotation_str).strip():
        return pd.NA

    # Parse first. If parsing fails (e.g. invalid format), parsed will be empty.
    parsed = parse_annotation_string(annotation_str)
    if not parsed:
        return pd.NA # Return NA if input is invalid or unparsable

    if shift_amount != 0: # Only shift if there's a non-zero amount
        for ann in parsed:
            ann['start'] += shift_amount
            if ann['start'] < 0: # Handle potential negative coordinates after shift
                print(f"Warning: Annotation '{ann['label']}' resulted in negative start coordinate ({ann['start']}) after shift. Setting to 0.", file=sys.stdout)
                ann['start'] = 0

    # Always reformat to ensure consistent (UPPERCASE) output
    return format_annotation_string(parsed)


# Parse arguments
def parse_arguments():
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Assembles scFv from MiXCR alignments and processes annotations."
    )
    parser.add_argument("--linker", help="linker nt sequence", required=True)
    parser.add_argument("--hinge", help="hinge nt sequence", required=True)
    parser.add_argument("--imputeHeavy", help="impute heavy VDJ region (true/false)", default='false', choices=['true', 'false'])
    parser.add_argument("--heavyImputeSequence",
                        help="heavy VDJ region sequence to impute (e.g., FR1-CDR1-FR2-CDR2-FR3 if only CDR3 and FR4 are from data)")
    parser.add_argument("--imputeLight", help="impute light VDJ region (true/false)", default='false', choices=['true', 'false'])
    parser.add_argument("--lightImputeSequence",
                        help="light VDJ region sequence to impute (e.g., FR1-CDR1-FR2-CDR2-FR3 if only CDR3 and FR4 are from data)")
    parser.add_argument(
        "--order",
        help="construct building order: hl for 'heavy-linker-light-hinge' or lh for 'light-linker-heavy-hinge'",
        required=True,
        choices=['hl', 'lh']
    )
    parser.add_argument("--hc_clones_file", help="Path to heavy chain clones.tsv file", default="hc.clones.tsv")
    parser.add_argument("--lc_clones_file", help="Path to light chain clones.tsv file", default="lc.clones.tsv")
    parser.add_argument("--hc_alignments_file", help="Path to heavy chain alignments.tsv file", default="hc.alignments.tsv")
    parser.add_argument("--lc_alignments_file", help="Path to light chain alignments.tsv file", default="lc.alignments.tsv")
    parser.add_argument("--output_file", help="Path to output tsv file", default="result.tsv")
    return parser.parse_args()


def load_and_preprocess_data(clones_file, alignments_file, chain_type_suffix):
    """Loads MiXCR clones and alignments, preprocesses them."""
    try:
        mixcr_clones = pd.read_csv(clones_file, sep="\t")
        mixcr_clones = mixcr_clones.drop(
            ['readCount', 'readFraction'], axis=1, errors='ignore')
        mixcr_clones = mixcr_clones.add_suffix(chain_type_suffix)
    except FileNotFoundError:
        print(f"Warning: Clones file not found at {clones_file}. Proceeding without it.", file=sys.stdout)
        mixcr_clones = pd.DataFrame()

    try:
        mixcr_alignments = pd.read_csv(alignments_file, sep="\t")
        mixcr_alignments = mixcr_alignments[mixcr_alignments['cloneId'] != -1]
    except FileNotFoundError:
        print(f"Error: Alignments file not found at {alignments_file}. Cannot proceed without alignments.", file=sys.stdout)
        return pd.DataFrame(), pd.DataFrame()

    return mixcr_clones, mixcr_alignments


def merge_alignments(hc_alignments, lc_alignments):
    """Merges heavy and light chain alignments and calculates read counts/fractions."""
    if hc_alignments.empty or lc_alignments.empty:
        return pd.DataFrame()

    hl = pd.merge(
        hc_alignments,
        lc_alignments,
        on="descrR1",
        how="inner",
        suffixes=('-IGHeavy', '-IGLight')
    )
    if hl.empty:
        return pd.DataFrame()

    hl = hl.groupby([
        'cloneId-IGHeavy',
        'cloneId-IGLight'
    ], dropna=False).size().reset_index(name='readCount')
    if hl['readCount'].sum() == 0:
        hl['readFraction'] = 0.0
    else:
        hl['readFraction'] = hl['readCount'] / hl['readCount'].sum()
    return hl


def merge_with_clones(merged_alignments, hc_mixcr_clones, lc_mixcr_clones):
    """Merges the alignment data with clone data."""
    if merged_alignments.empty:
        return pd.DataFrame()

    result = merged_alignments
    if not hc_mixcr_clones.empty and 'cloneId-IGHeavy' in hc_mixcr_clones.columns:
        result = pd.merge(result, hc_mixcr_clones,
                          on='cloneId-IGHeavy',
                          how='left')
    if not lc_mixcr_clones.empty and 'cloneId-IGLight' in lc_mixcr_clones.columns:
        result = pd.merge(result, lc_mixcr_clones,
                          on='cloneId-IGLight',
                          how='left')
    return result


def generate_clonotype_keys(df):
    """Generates clonotypeKey and clonotypeLabel."""
    if df.empty:
        return df

    base_key_cols = {
        "tsH": "targetSequences-IGHeavy", "tsL": "targetSequences-IGLight",
        "vH": "bestVGene-IGHeavy", "vL": "bestVGene-IGLight",
        "jH": "bestJGene-IGHeavy", "jL": "bestJGene-IGLight"
    }
    c_gene_cols = {"cH": "bestCGene-IGHeavy", "cL": "bestCGene-IGLight"}

    for col in list(base_key_cols.values()) + list(c_gene_cols.values()):
        if col not in df.columns:
            df[col] = pd.NA

    df["clonotypeKey"] = (
        df[base_key_cols["tsH"]].fillna("NA_STR").astype(str) + "-" +
        df[base_key_cols["tsL"]].fillna("NA_STR").astype(str) + "-" +
        df[base_key_cols["vH"]].fillna("NA_STR").astype(str) + "-" +
        df[base_key_cols["vL"]].fillna("NA_STR").astype(str) + "-" +
        df[base_key_cols["jH"]].fillna("NA_STR").astype(str) + "-" +
        df[base_key_cols["jL"]].fillna("NA_STR").astype(str)
    )

    c_genes_present_mask = df[c_gene_cols["cH"]].notna() & df[c_gene_cols["cL"]].notna()
    df.loc[c_genes_present_mask, "clonotypeKey"] = (
        df.loc[c_genes_present_mask, "clonotypeKey"] + "-" +
        df.loc[c_genes_present_mask, c_gene_cols["cH"]].astype(str) + "-" +
        df.loc[c_genes_present_mask, c_gene_cols["cL"]].astype(str)
    )

    df.loc[df["clonotypeKey"].str.contains("NA_STR", na=False), "clonotypeKey"] = pd.NA
    df = df[df['clonotypeKey'].notna()]

    if 'clonotypeKey' in df and not df['clonotypeKey'].empty:
        df['clonotypeKey'] = df['clonotypeKey'].apply(
            lambda x: base64.b32encode(bytes.fromhex(hashlib.sha256(str(x).encode()).hexdigest()[:24])).decode('utf-8') if pd.notna(x) else pd.NA
        )
        df["clonotypeLabel"] = "C-" + df["clonotypeKey"].str[:6].fillna("------")
    else:
        df["clonotypeKey"] = pd.NA
        df["clonotypeLabel"] = pd.NA
    return df


def determine_vdj_columns(df, impute_heavy_arg, impute_light_arg):
    """Determines the VDJ region columns to use based on arguments and availability."""
    heavy_vdj_col, light_vdj_col = None, None

    nSeqVDJ_H = "nSeqVDJRegion-IGHeavy"
    nSeqImputedVDJ_H = "nSeqImputedVDJRegion-IGHeavy"
    nSeqVDJ_L = "nSeqVDJRegion-IGLight"
    nSeqImputedVDJ_L = "nSeqImputedVDJRegion-IGLight"

    if nSeqVDJ_H in df.columns:
        heavy_vdj_col = nSeqVDJ_H
    elif impute_heavy_arg == 'true' and nSeqImputedVDJ_H in df.columns:
        heavy_vdj_col = nSeqImputedVDJ_H
    elif impute_heavy_arg == 'false':
        heavy_vdj_col = nSeqVDJ_H
        if heavy_vdj_col not in df.columns: df[heavy_vdj_col] = pd.NA
    elif nSeqImputedVDJ_H in df.columns:
        heavy_vdj_col = nSeqImputedVDJ_H
    else:
        df[nSeqVDJ_H] = pd.NA
        heavy_vdj_col = nSeqVDJ_H

    if nSeqVDJ_L in df.columns:
        light_vdj_col = nSeqVDJ_L
    elif impute_light_arg == 'true' and nSeqImputedVDJ_L in df.columns:
        light_vdj_col = nSeqImputedVDJ_L
    elif impute_light_arg == 'false':
        light_vdj_col = nSeqVDJ_L
        if light_vdj_col not in df.columns: df[light_vdj_col] = pd.NA
    elif nSeqImputedVDJ_L in df.columns:
        light_vdj_col = nSeqImputedVDJ_L
    else:
        df[nSeqVDJ_L] = pd.NA
        light_vdj_col = nSeqVDJ_L

    return heavy_vdj_col, light_vdj_col


def impute_vdj_sequences(df, args, heavy_vdj_col_name, light_vdj_col_name):
    """
    If args.imputeHeavy/Light is 'false', this function constructs the VDJ sequence
    for the respective chain using args.heavy/lightImputeSequence and CDR3+FR4.
    The result is stored in the column specified by heavy/light_vdj_col_name.
    If args.imputeHeavy/Light is 'true', this function does nothing, assuming
    the VDJ sequence is already present in nSeqImputedVDJRegion-IGHeavy/Light (selected by determine_vdj_columns).
    """
    if df.empty: return df

    if args.imputeHeavy == 'false' and args.heavyImputeSequence is not None:
        required_heavy_parts = ["nSeqCDR3-IGHeavy", "nSeqFR4-IGHeavy"]
        if not all(col in df.columns for col in required_heavy_parts):
            for col in required_heavy_parts:
                if col not in df.columns: df[col] = pd.NA

        if heavy_vdj_col_name not in df.columns: df[heavy_vdj_col_name] = pd.NA

        valid_rows_mask = df["nSeqCDR3-IGHeavy"].notna() & df["nSeqFR4-IGHeavy"].notna()
        df.loc[valid_rows_mask, heavy_vdj_col_name] = str(args.heavyImputeSequence) + \
                                                   df.loc[valid_rows_mask, "nSeqCDR3-IGHeavy"].astype(str) + \
                                                   df.loc[valid_rows_mask, "nSeqFR4-IGHeavy"].astype(str)
        df.loc[~valid_rows_mask, heavy_vdj_col_name] = pd.NA

    if args.imputeLight == 'false' and args.lightImputeSequence is not None:
        required_light_parts = ["nSeqCDR3-IGLight", "nSeqFR4-IGLight"]
        if not all(col in df.columns for col in required_light_parts):
            for col in required_light_parts:
                if col not in df.columns: df[col] = pd.NA

        if light_vdj_col_name not in df.columns: df[light_vdj_col_name] = pd.NA

        valid_rows_mask = df["nSeqCDR3-IGLight"].notna() & df["nSeqFR4-IGLight"].notna()
        df.loc[valid_rows_mask, light_vdj_col_name] = str(args.lightImputeSequence) + \
                                                    df.loc[valid_rows_mask, "nSeqCDR3-IGLight"].astype(str) + \
                                                    df.loc[valid_rows_mask, "nSeqFR4-IGLight"].astype(str)
        df.loc[~valid_rows_mask, light_vdj_col_name] = pd.NA
    return df


def filter_valid_vdj(df, heavy_vdj_col, light_vdj_col):
    """Filters out rows where VDJ regions are empty/null AFTER imputation/selection."""
    if df.empty: return df
    if heavy_vdj_col not in df.columns:
        return pd.DataFrame()
    if light_vdj_col not in df.columns:
        return pd.DataFrame()

    df = df[
        (df[heavy_vdj_col].notna()) & (df[heavy_vdj_col].astype(str).str.strip().str.len() > 0) &
        (df[light_vdj_col].notna()) & (df[light_vdj_col].astype(str).str.strip().str.len() > 0)
    ].copy()
    return df


def create_construct_nt(df, order, linker, hinge, heavy_vdj_col, light_vdj_col):
    """Creates the 'construct-nt' column based on the specified order."""
    if df.empty: return df

    heavy_vdj_series = df[heavy_vdj_col].fillna('').astype(str)
    light_vdj_series = df[light_vdj_col].fillna('').astype(str)
    linker_str = linker if linker is not None else ''
    hinge_str = hinge if hinge is not None else ''

    if order == "hl":
        df["construct-nt"] = heavy_vdj_series + linker_str + light_vdj_series + hinge_str
    elif order == "lh":
        df["construct-nt"] = light_vdj_series + linker_str + heavy_vdj_series + hinge_str
    else:
        raise ValueError(f"Invalid order: {order}. Choose 'hl' or 'lh'.")

    min_meaningful_len = len(linker_str) + len(hinge_str) + 1
    df.loc[df["construct-nt"].str.len() < min_meaningful_len, "construct-nt"] = pd.NA
    df.loc[df["construct-nt"] == (linker_str + hinge_str), "construct-nt"] = pd.NA

    return df


def translate_sequence(seq_series_element):
    """Translates a single nucleotide sequence to an amino acid sequence."""
    if pd.isna(seq_series_element) or str(seq_series_element).strip() == "":
        return pd.NA

    seq = str(seq_series_element)
    genetic_code = {
        'ATA': 'I', 'ATC': 'I', 'ATT': 'I', 'ATG': 'M', 'ACA': 'T', 'ACC': 'T', 'ACG': 'T', 'ACT': 'T',
        'AAC': 'N', 'AAT': 'N', 'AAA': 'K', 'AAG': 'K', 'AGC': 'S', 'AGT': 'S', 'AGA': 'R', 'AGG': 'R',
        'CTA': 'L', 'CTC': 'L', 'CTG': 'L', 'CTT': 'L', 'CCA': 'P', 'CCC': 'P', 'CCG': 'P', 'CCT': 'P',
        'CAC': 'H', 'CAT': 'H', 'CAA': 'Q', 'CAG': 'Q', 'CGA': 'R', 'CGC': 'R', 'CGG': 'R', 'CGT': 'R',
        'GTA': 'V', 'GTC': 'V', 'GTG': 'V', 'GTT': 'V', 'GCA': 'A', 'GCC': 'A', 'GCG': 'A', 'GCT': 'A',
        'GAC': 'D', 'GAT': 'D', 'GAA': 'E', 'GAG': 'E', 'GGA': 'G', 'GGC': 'G', 'GGG': 'G', 'GGT': 'G',
        'TCA': 'S', 'TCC': 'S', 'TCG': 'S', 'TCT': 'S', 'TTC': 'F', 'TTT': 'F', 'TTA': 'L', 'TTG': 'L',
        'TAC': 'Y', 'TAT': 'Y', 'TAA': '*', 'TAG': '*', 'TGC': 'C', 'TGT': 'C', 'TGA': '*', 'TGG': 'W',
    }
    protein = []
    for i in range(0, len(seq) - (len(seq) % 3), 3):
        codon = seq[i:i+3].upper()
        protein.append(genetic_code.get(codon, 'X'))

    result_protein = "".join(protein)
    if len(seq) % 3 != 0:
        result_protein += '_'
    return result_protein if result_protein else pd.NA


def add_aa_sequence_and_productivity(df):
    """Adds 'construct-aa' and 'isProductive' columns."""
    if df.empty or "construct-nt" not in df.columns:
        df["construct-aa"] = pd.NA
        df["isProductive"] = False
        return df

    df["construct-aa"] = df["construct-nt"].apply(translate_sequence)
    df["isProductive"] = ~(df["construct-aa"].astype(str).str.contains("[*_]", regex=True, na=True)) & df["construct-aa"].notna()
    return df


def process_construct_annotations(df, order, linker_nt_seq, heavy_vdj_col, light_vdj_col):
    """
    Processes and combines heavy and light chain annotations for the construct.
    Searches for annotation columns that START WITH the base_col_name.
    Outputs annotations in UPPERCASE.
    """

    if df.empty:
        for prefix_name in ["nAnnotationOfCDRs", "nAnnotationOfSegments", "aaAnnotationOfCDRs", "aaAnnotationOfSegments"]:
            df[f"construct-{prefix_name}"] = pd.NA
        return df

    linker_aa_seq = translate_sequence(linker_nt_seq)
    len_linker_nt = len(linker_nt_seq or "")
    len_linker_aa = len(linker_aa_seq or "")

    annotation_prefixes = [
        "nAnnotationOfCDRs", "nAnnotationOfSegments",
        "aaAnnotationOfCDRs", "aaAnnotationOfSegments"
    ]

    df_columns_list = df.columns.tolist()

    for base_prefix_name in annotation_prefixes:
        construct_col_name = f"construct-{base_prefix_name}"
        df[construct_col_name] = pd.NA

        actual_col_heavy_annot, actual_col_light_annot = None, None
        for col_in_df in df_columns_list:
            if col_in_df.startswith(base_prefix_name) and col_in_df.endswith("-IGHeavy"):
                actual_col_heavy_annot = col_in_df
            if col_in_df.startswith(base_prefix_name) and col_in_df.endswith("-IGLight"):
                actual_col_light_annot = col_in_df

        has_heavy_annot_col = actual_col_heavy_annot is not None
        has_light_annot_col = actual_col_light_annot is not None

        is_aa_annotation = base_prefix_name.startswith("aa")

        processed_annotations_for_current_type = []
        for index, row in df.iterrows():

            annot_heavy_val = row[actual_col_heavy_annot] if has_heavy_annot_col and actual_col_heavy_annot in row else pd.NA
            annot_light_val = row[actual_col_light_annot] if has_light_annot_col and actual_col_light_annot in row else pd.NA

            current_heavy_seq_nt = row.get(heavy_vdj_col, "")
            current_light_seq_nt = row.get(light_vdj_col, "")

            len_h_vdj_comp, len_l_vdj_comp, current_linker_len_shift = 0,0,0
            if is_aa_annotation:
                heavy_aa = translate_sequence(current_heavy_seq_nt); len_h_vdj_comp = len(heavy_aa or "")
                light_aa = translate_sequence(current_light_seq_nt); len_l_vdj_comp = len(light_aa or "")
                current_linker_len_shift = len_linker_aa
            else:
                len_h_vdj_comp = len(current_heavy_seq_nt or ""); len_l_vdj_comp = len(current_light_seq_nt or "")
                current_linker_len_shift = len_linker_nt

            seq1_annot, seq2_annot, shift_val = pd.NA, pd.NA, 0
            if order == "hl":
                seq1_annot, seq2_annot = annot_heavy_val, annot_light_val
                shift_val = len_h_vdj_comp + current_linker_len_shift
            elif order == "lh":
                seq1_annot, seq2_annot = annot_light_val, annot_heavy_val
                shift_val = len_l_vdj_comp + current_linker_len_shift

            final_parts = []
            if pd.notna(seq1_annot) and str(seq1_annot).strip():
                formatted_s1 = shift_annotations(str(seq1_annot), 0)
                if pd.notna(formatted_s1) and str(formatted_s1).strip(): final_parts.append(formatted_s1)

            if pd.notna(seq2_annot) and str(seq2_annot).strip():
                shifted_s2 = shift_annotations(str(seq2_annot), shift_val)
                if pd.notna(shifted_s2) and str(shifted_s2).strip(): final_parts.append(shifted_s2)
            final_str = "|".join(final_parts) if final_parts else pd.NA
            processed_annotations_for_current_type.append(final_str)

        df[construct_col_name] = processed_annotations_for_current_type
    return df


def aggregate_results(df):
    """Groups by 'construct-aa' and aggregates other columns."""
    if df.empty: return df
    if 'construct-aa' not in df.columns: df['construct-aa'] = pd.NA

    df['construct-aa'] = df['construct-aa'].astype(str).replace('nan', pd.NA)

    agg_dict = {}
    for col in ['readCount', 'readFraction']:
        if col in df.columns: agg_dict[col] = 'sum'

    for col in df.columns:
        if col not in agg_dict and col != 'construct-aa':
            agg_dict[col] = 'first'

    if not agg_dict:
        return df.drop_duplicates(subset=['construct-aa']).reset_index(drop=True) if 'construct-aa' in df.columns else df

    aggregated_df = df.groupby('construct-aa', dropna=False).agg(agg_dict).reset_index()

    if 'isProductive' in aggregated_df.columns:
        aggregated_df["isProductive"] = aggregated_df["isProductive"].astype(str).str.lower()
    return aggregated_df


def main():
    """Main function to orchestrate the scFv assembly script."""
    args = parse_arguments()

    linker_nt, hinge = args.linker, args.hinge

    hc_clones, hc_alignments = load_and_preprocess_data(args.hc_clones_file, args.hc_alignments_file, '-IGHeavy')
    lc_clones, lc_alignments = load_and_preprocess_data(args.lc_clones_file, args.lc_alignments_file, '-IGLight')

    if hc_alignments.empty and lc_alignments.empty:
        pd.DataFrame().to_csv(args.output_file, sep="\t", index=False)
        return

    merged_hl = merge_alignments(hc_alignments, lc_alignments)
    if merged_hl.empty:
        pd.DataFrame().to_csv(args.output_file, sep="\t", index=False)
        return

    result_df = merge_with_clones(merged_hl, hc_clones, lc_clones)
    if result_df.empty:
        pd.DataFrame().to_csv(args.output_file, sep="\t", index=False)
        return

    result_df = generate_clonotype_keys(result_df)
    if result_df.empty:
        pd.DataFrame().to_csv(args.output_file, sep="\t", index=False)
        return

    try:
        heavy_vdj_col, light_vdj_col = determine_vdj_columns(result_df, args.imputeHeavy, args.imputeLight)
    except ValueError as e:
        pd.DataFrame().to_csv(args.output_file, sep="\t", index=False)
        return

    if args.heavyImputeSequence is not None or args.lightImputeSequence is not None:
        result_df = impute_vdj_sequences(result_df, args, heavy_vdj_col, light_vdj_col)

    result_df = filter_valid_vdj(result_df, heavy_vdj_col, light_vdj_col)
    if result_df.empty:
        pd.DataFrame().to_csv(args.output_file, sep="\t", index=False)
        return

    result_df = create_construct_nt(result_df, args.order, linker_nt, hinge, heavy_vdj_col, light_vdj_col)

    result_df = add_aa_sequence_and_productivity(result_df)

    result_df = process_construct_annotations(result_df, args.order, linker_nt, heavy_vdj_col, light_vdj_col)

    final_result_df = aggregate_results(result_df)

    if final_result_df.empty:
        (result_df if not result_df.empty else pd.DataFrame()).to_csv(args.output_file, sep="\t", index=False)
    else:
        final_result_df.to_csv(args.output_file, sep="\t", index=False)

if __name__ == "__main__":
    main()