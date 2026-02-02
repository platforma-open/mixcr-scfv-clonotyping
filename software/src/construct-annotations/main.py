import argparse
from typing import Dict, Iterable, List, Optional, Tuple

import polars as pl

BASE36_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def base36_encode(n: int) -> str:
    if n == 0:
        return "0"
    if n < 0:
        raise ValueError("base36_encode expects non-negative integers")
    out = ""
    while n > 0:
        n, r = divmod(n, 36)
        out = BASE36_DIGITS[r] + out
    return out


def base36_decode(s: str) -> Optional[int]:
    if s is None:
        return None
    s = s.strip().upper()
    if s == "":
        return None
    try:
        return int(s, 36)
    except ValueError:
        return None


def parse_segments(value: Optional[str]) -> List[Tuple[str, int, int]]:
    if not value:
        return []
    segments: List[Tuple[str, int, int]] = []
    for part in value.split("|"):
        part = part.strip()
        if not part:
            continue
        if ":" not in part or "+" not in part:
            continue
        code, rest = part.split(":", 1)
        start_s, length_s = rest.split("+", 1)
        start = base36_decode(start_s)
        length = base36_decode(length_s)
        if start is None or length is None:
            continue
        segments.append((code, start, length))
    return segments


def encode_segments(segments: Iterable[Tuple[str, int, int]]) -> str:
    seen = set()
    output: List[Tuple[int, str]] = []
    for code, start, length in segments:
        if length <= 0:
            continue
        key = (code, start, length)
        if key in seen:
            continue
        seen.add(key)
        output.append(
            (start, f"{code}:{base36_encode(start)}+{base36_encode(length)}")
        )
    output.sort(key=lambda x: x[0])
    return "|".join(item for _, item in output)


def translate(seq: str) -> str:
    if seq is None:
        return ""
    genetic_code = {
        "ATA": "I",
        "ATC": "I",
        "ATT": "I",
        "ATG": "M",
        "ACA": "T",
        "ACC": "T",
        "ACG": "T",
        "ACT": "T",
        "AAC": "N",
        "AAT": "N",
        "AAA": "K",
        "AAG": "K",
        "AGC": "S",
        "AGT": "S",
        "AGA": "R",
        "AGG": "R",
        "CTA": "L",
        "CTC": "L",
        "CTG": "L",
        "CTT": "L",
        "CCA": "P",
        "CCC": "P",
        "CCG": "P",
        "CCT": "P",
        "CAC": "H",
        "CAT": "H",
        "CAA": "Q",
        "CAG": "Q",
        "CGA": "R",
        "CGC": "R",
        "CGG": "R",
        "CGT": "R",
        "GTA": "V",
        "GTC": "V",
        "GTG": "V",
        "GTT": "V",
        "GCA": "A",
        "GCC": "A",
        "GCG": "A",
        "GCT": "A",
        "GAC": "D",
        "GAT": "D",
        "GAA": "E",
        "GAG": "E",
        "GGA": "G",
        "GGC": "G",
        "GGG": "G",
        "GGT": "G",
        "TCA": "S",
        "TCC": "S",
        "TCG": "S",
        "TCT": "S",
        "TTC": "F",
        "TTT": "F",
        "TTA": "L",
        "TTG": "L",
        "TAC": "Y",
        "TAT": "Y",
        "TAA": "*",
        "TAG": "*",
        "TGC": "C",
        "TGT": "C",
        "TGA": "*",
        "TGG": "W",
    }
    seq = seq.upper()
    protein = ""
    for i in range(0, len(seq), 3):
        codon = seq[i : i + 3]
        if len(codon) < 3:
            continue
        protein += genetic_code.get(codon, "X")
    if len(seq) % 3 != 0:
        protein += "_"
    return protein


def pick_col(columns: List[str], candidates: List[str]) -> Optional[str]:
    for name in candidates:
        if name in columns:
            return name
    return None


def normalize_seq(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip()


def main() -> None:
    p = argparse.ArgumentParser(
        description="Build scFv construct annotation columns from heavy/light annotations"
    )
    p.add_argument("--input_tsv", required=True, help="Input TSV path")
    p.add_argument("--output_tsv", required=True, help="Output TSV path")
    p.add_argument("--order", required=True, choices=["hl", "lh"])
    p.add_argument("--linker", required=True, help="Linker nt sequence")
    p.add_argument("--hinge", required=True, help="Hinge nt sequence")
    args = p.parse_args()

    df = pl.read_csv(args.input_tsv, separator="\t", infer_schema_length=0)
    columns = df.columns

    heavy_nt_col = pick_col(
        columns, ["nSeqVDJRegion-IGHeavy", "nSeqImputedVDJRegion-IGHeavy"]
    )
    light_nt_col = pick_col(
        columns, ["nSeqVDJRegion-IGLight", "nSeqImputedVDJRegion-IGLight"]
    )
    heavy_aa_col = pick_col(
        columns, ["aaSeqVDJRegion-IGHeavy", "aaSeqImputedVDJRegion-IGHeavy"]
    )
    light_aa_col = pick_col(
        columns, ["aaSeqVDJRegion-IGLight", "aaSeqImputedVDJRegion-IGLight"]
    )

    if heavy_nt_col is None:
        raise ValueError("Missing heavy VDJ nt sequence column")
    if light_nt_col is None:
        raise ValueError("Missing light VDJ nt sequence column")

    ann_cols = {
        ("n", "CDRs", "IGHeavy"): "nAnnotationOfCDRsForVDJRegion-IGHeavy",
        ("n", "Segments", "IGHeavy"): "nAnnotationOfSegmentsForVDJRegion-IGHeavy",
        ("aa", "CDRs", "IGHeavy"): "aaAnnotationOfCDRsForVDJRegion-IGHeavy",
        ("aa", "Segments", "IGHeavy"): "aaAnnotationOfSegmentsForVDJRegion-IGHeavy",
        ("n", "CDRs", "IGLight"): "nAnnotationOfCDRsForVDJRegion-IGLight",
        ("n", "Segments", "IGLight"): "nAnnotationOfSegmentsForVDJRegion-IGLight",
        ("aa", "CDRs", "IGLight"): "aaAnnotationOfCDRsForVDJRegion-IGLight",
        ("aa", "Segments", "IGLight"): "aaAnnotationOfSegmentsForVDJRegion-IGLight",
    }

    out_cols: Dict[str, List[str]] = {
        "nAnnotationOfCDRsForConstruct": [],
        "nAnnotationOfSegmentsForConstruct": [],
        "aaAnnotationOfCDRsForConstruct": [],
        "aaAnnotationOfSegmentsForConstruct": [],
    }

    linker_nt = normalize_seq(args.linker)
    hinge_nt = normalize_seq(args.hinge)
    linker_aa = translate(linker_nt)
    _ = hinge_nt  # hinge does not affect offsets (no annotations)

    for row in df.iter_rows(named=True):
        heavy_nt = normalize_seq(row.get(heavy_nt_col))
        light_nt = normalize_seq(row.get(light_nt_col))
        heavy_aa = normalize_seq(row.get(heavy_aa_col)) if heavy_aa_col else ""
        light_aa = normalize_seq(row.get(light_aa_col)) if light_aa_col else ""
        if heavy_aa == "":
            heavy_aa = translate(heavy_nt)
        if light_aa == "":
            light_aa = translate(light_nt)

        if args.order == "hl":
            nt_offsets = {"IGHeavy": 0, "IGLight": len(heavy_nt) + len(linker_nt)}
            aa_offsets = {"IGHeavy": 0, "IGLight": len(heavy_aa) + len(linker_aa)}
        else:
            nt_offsets = {"IGLight": 0, "IGHeavy": len(light_nt) + len(linker_nt)}
            aa_offsets = {"IGLight": 0, "IGHeavy": len(light_aa) + len(linker_aa)}

        for alphabet in ("n", "aa"):
            for ann_type in ("CDRs", "Segments"):
                segs: List[Tuple[str, int, int]] = []
                for chain in ("IGHeavy", "IGLight"):
                    col_name = ann_cols.get((alphabet, ann_type, chain))
                    if not col_name or col_name not in columns:
                        continue
                    offset = nt_offsets[chain] if alphabet == "n" else aa_offsets[chain]
                    for code, start, length in parse_segments(row.get(col_name)):
                        segs.append((code, start + offset, length))
                out_name = f"{alphabet}AnnotationOf{ann_type}ForConstruct"
                out_cols[out_name].append(encode_segments(segs))

    for name, values in out_cols.items():
        df = df.with_columns(pl.Series(name, values))

    df.write_csv(args.output_tsv, separator="\t")


if __name__ == "__main__":
    main()
