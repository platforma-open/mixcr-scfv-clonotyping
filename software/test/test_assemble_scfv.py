"""Tests for assemble-scfv/main.py.

Run from the block root:
    uv run --python 3.12 --with-requirements software/src/assemble-scfv/requirements.txt \
        --with pytest pytest software/test
"""

import csv
import subprocess
import sys
from pathlib import Path

import pytest

MAIN = Path(__file__).resolve().parents[1] / "src" / "assemble-scfv" / "main.py"

LINKER = "GGTGGA"
HINGE = "GCC"
LIGHT_NT = "GACATCCAG"  # D I Q
LIGHT_AA = "DIQ"
# Synonymous codons for L; the variant index picks the last heavy codon.
L_CODONS = ["CTT", "CTC", "CTA", "CTG", "TTA", "TTG"]
# Residues with a single codon each, used to make each construct unique.
BODY = {"M": "ATG", "W": "TGG", "K": "AAA", "F": "TTT"}


def heavy(construct, variant):
    """Heavy VDJ nt/aa for construct index `construct`, synonymous variant `variant`."""
    aa, nt, n = "", "", construct
    for _ in range(4):
        res = "MWKF"[n % 4]
        aa, nt, n = aa + res, nt + BODY[res], n // 4
    return nt + L_CODONS[variant], aa + "L"


def write_tsv(path, header, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def make_fixture(dir_, clones, umi=False):
    """clones: list of (construct, variant, reads, umis). One heavy clone per entry,
    one shared light clone. Heavy clones are written in the given order."""
    clone_hdr = ["cloneId", "readCount", "targetSequences", "bestVGene", "bestJGene",
                 "nSeqVDJRegion", "aaSeqVDJRegion"]
    hc_rows, hc_aln, lc_aln = [], [], []
    read = 0
    for cid, (construct, variant, reads, umis) in enumerate(clones):
        nt, aa = heavy(construct, variant)
        hc_rows.append([cid, reads, nt, "IGHV1", "IGHJ1", nt, aa])
        for r in range(reads):
            row = [f"r{read}", cid]
            if umi:
                row.append(f"U{cid}_{r % umis}")
            hc_aln.append(row)
            lc_aln.append([f"r{read}", 0])
            read += 1
    aln_hdr = ["descrR1", "cloneId"] + (["tagValueUMI"] if umi else [])
    write_tsv(dir_ / "hc.clones.tsv", clone_hdr, hc_rows)
    write_tsv(dir_ / "hc.alignments.tsv", aln_hdr, hc_aln)
    write_tsv(dir_ / "lc.clones.tsv", clone_hdr,
              [[0, read, LIGHT_NT, "IGKV1", "IGKJ1", LIGHT_NT, LIGHT_AA]])
    write_tsv(dir_ / "lc.alignments.tsv", ["descrR1", "cloneId"], lc_aln)


def run(dir_):
    out = dir_ / "result.tsv"
    out.unlink(missing_ok=True)
    subprocess.run(
        [sys.executable, str(MAIN), "--linker", LINKER, "--hinge", HINGE, "--order", "hl"],
        cwd=dir_, check=True,
    )
    return out.read_bytes()


def read_result(dir_):
    with open(dir_ / "result.tsv") as f:
        return {r["construct-aa"]: r for r in csv.DictReader(f, delimiter="\t")}


def construct_nt(construct, variant):
    return heavy(construct, variant)[0] + LINKER + LIGHT_NT + HINGE


def construct_aa(construct):
    return heavy(construct, 0)[1] + "GG" + LIGHT_AA + "A"  # linker GGTGGA, hinge GCC


def test_output_is_byte_identical_across_runs(tmp_path):
    # 60 constructs x 3 synonymous variants with equal reads: the pick rests on tie-breaks only.
    make_fixture(tmp_path, [(c, v, 3, 1) for v in range(3) for c in range(60)])
    first = run(tmp_path)
    for _ in range(4):
        assert run(tmp_path) == first


@pytest.mark.parametrize("umi", [False, True])
def test_most_read_variant_wins_and_ties_take_smallest_nt(tmp_path, umi):
    make_fixture(tmp_path, [
        (0, 0, 2, 1), (0, 1, 7, 1), (0, 2, 4, 1),  # construct 0: variant 1 has most reads
        (1, 5, 5, 1), (1, 0, 5, 1),                # construct 1: tie, CTT < TTG
    ], umi=umi)
    run(tmp_path)
    res = read_result(tmp_path)
    assert len(res) == 2

    r0 = res[construct_aa(0)]
    assert r0["construct-nt"] == construct_nt(0, 1)
    assert r0["nSeqVDJRegion-IGHeavy"] == heavy(0, 1)[0]
    assert r0["readCount"] == "13"

    r1 = res[construct_aa(1)]
    assert r1["construct-nt"] == construct_nt(1, 0)
    assert r1["readCount"] == "10"


def test_umi_count_leads_over_read_count(tmp_path):
    # variant 0: 10 reads on 2 UMIs; variant 1: 4 reads on 4 UMIs.
    make_fixture(tmp_path, [(0, 0, 10, 2), (0, 1, 4, 4)], umi=True)
    run(tmp_path)
    (row,) = read_result(tmp_path).values()
    assert row["construct-nt"] == construct_nt(0, 1)
    assert row["readCount"] == "14"
    assert row["umiCount"] == "6"
