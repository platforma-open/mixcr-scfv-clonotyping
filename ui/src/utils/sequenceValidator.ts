export interface SequenceValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  translatedSequence?: string;
  vGene?: string;
  jGene?: string;
}

const codonTable: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

function translateDNAToProtein(dnaSequence: string): string {
  const cleanSequence = dnaSequence.toUpperCase().replace(/\s/g, '');
  let proteinSequence = '';
  for (let i = 0; i <= cleanSequence.length - 3; i += 3) {
    const codon = cleanSequence.substring(i, i + 3);
    const aminoAcid = codonTable[codon];
    if (aminoAcid) {
      if (aminoAcid === '*') break;
      proteinSequence += aminoAcid;
    } else {
      proteinSequence += 'X';
    }
  }
  return proteinSequence;
}

export function validateLibrarySequence(sequence: string): SequenceValidationResult {
  const warnings: string[] = [];
  if (!sequence.trim()) return { isValid: false, error: 'Sequence is empty' };

  const cleanSequence = sequence.toUpperCase().replace(/\s/g, '').replace(/[NRYWSKMBDHV]/g, 'A');
  const validDNACars = /^[ACGT]+$/;
  if (!validDNACars.test(cleanSequence)) {
    const invalidChars = cleanSequence.match(/[^ACGT]/g);
    return { isValid: false, error: `Invalid DNA characters found: ${invalidChars?.join(', ')}` };
  }
  if (cleanSequence.length % 3 !== 0) {
    warnings.push('Sequence length is not a multiple of 3 - translation may be incomplete');
  }

  const translatedSequence = translateDNAToProtein(cleanSequence);
  if (translatedSequence.length === 0) return { isValid: false, error: 'Translation resulted in empty protein sequence (possibly due to early stop codon)' };
  if (translatedSequence.includes('X')) warnings.push('Translation contains unknown amino acids (X) due to invalid codons');

  const validationRegex = /C[ACDEFGHIKLMNPQRSTVWY]{4,50}[FWYLI][ACDEFGHIKLMNPQRSTVWY]{0,5}G[ACDEFGHIKLMNPQRSTVWY]G/;
  const searchStartPosition = 40;
  const sequenceToSearch = translatedSequence.substring(searchStartPosition);
  const match = validationRegex.exec(sequenceToSearch);
  if (!match) {
    return {
      isValid: false,
      error: `Translated sequence does not contain required pattern after position ${searchStartPosition}. Expected pattern: C[...]. Got: ${translatedSequence}`,
      translatedSequence,
    };
  }

  const patternStartInFullSequence = searchStartPosition + match.index;
  const patternEndInFullSequence = patternStartInFullSequence + match[0].length;
  const firstCysteinePosition = patternStartInFullSequence;
  const vGeneEndNucleotides = (firstCysteinePosition + 3) * 3;
  const vGeneSequence = cleanSequence.substring(0, vGeneEndNucleotides);
  const vGene = `>Vgene\n${vGeneSequence}`;

  const patternEndNucleotides = patternEndInFullSequence * 3;
  const jGeneStartNucleotides = patternEndNucleotides - 21;
  const jGeneSequence = cleanSequence.substring(jGeneStartNucleotides);
  const jGene = `>JGene\n${jGeneSequence}`;

  return { isValid: true, translatedSequence, vGene, jGene, warnings: warnings.length > 0 ? warnings : undefined };
}

// Centralized simple validators used by UI
export type SimpleValidation = { isValid: boolean; error?: string };

import { parseFasta, validateFastaSequence } from './fastaValidator';

export function validateSeparateChain(raw: string): SimpleValidation {
  const s = (raw ?? '').trim();
  if (!s) return { isValid: true };
  if (!s.startsWith('>')) return { isValid: false, error: 'FASTA header is required. Start with ">" and a record name.' };
  const fv = validateFastaSequence(s);
  if (!fv.isValid) return { isValid: false, error: fv.error ?? (fv.errors ? fv.errors.join('\n') : 'Invalid FASTA') };
  const recs = parseFasta(s);
  if (recs.length === 0) return { isValid: false, error: 'No FASTA records found' };
  const errors: string[] = [];
  for (const r of recs) {
    const res = validateLibrarySequence(r.seq);
    if (!res.isValid) errors.push(`${r.header}: ${res.error ?? 'invalid sequence'}`);
  }
  return errors.length ? { isValid: false, error: errors.join('\n') } : { isValid: true };
}

export function validateFullScFv(scfvRaw: string, linker: string, hinge: string | undefined, _order: 'hl' | 'lh'): SimpleValidation {
  const s = (scfvRaw ?? '').trim();
  if (!s) return { isValid: true };
  if (!s.startsWith('>')) return { isValid: false, error: 'FASTA header is required. Start with ">" and a record name.' };
  const fv = validateFastaSequence(s);
  if (!fv.isValid) return { isValid: false, error: fv.error ?? (fv.errors ? fv.errors.join('\n') : 'Invalid FASTA') };
  const hingeRaw = (hinge ?? '').toUpperCase().replace(/\s/g, '');
  const recs = parseFasta(s);
  if (recs.length === 0) return { isValid: false, error: 'No FASTA records found' };
  for (const r of recs) {
    let seq = r.seq.toUpperCase().replace(/\s/g, '');
    if (hingeRaw) {
      const idx = seq.indexOf(hingeRaw);
      if (idx >= 0) seq = seq.slice(0, idx) + seq.slice(idx + hingeRaw.length);
    }
    // Optional: validate derived chains as well (commented out)
    // const heavySeq = order === 'hl' ? parts[0] : parts[1];
    // const lightSeq = order === 'hl' ? parts[1] : parts[0];
    // const hRes = validateLibrarySequence(heavySeq);
    // const lRes = validateLibrarySequence(lightSeq);
    // if (!hRes.isValid) return { isValid: false, error: `Heavy chain: ${hRes.error ?? 'invalid sequence'}` };
    // if (!lRes.isValid) return { isValid: false, error: `Light chain: ${lRes.error ?? 'invalid sequence'}` };
  }
  return { isValid: true };
}

// Plain nucleotide validators (no FASTA headers, only A/C/G/T). Empty values are treated as undefined (no error shown).
export function validateLinker(raw: string): SimpleValidation | undefined {
  const s = (raw ?? '').trim();
  if (!s) return undefined;
  if (/^>/m.test(s)) return { isValid: false, error: 'FASTA format is not allowed for linker' };
  const clean = s.toUpperCase().replace(/\s/g, '');
  if (!/^[ACGT]+$/.test(clean)) return { isValid: false, error: 'Linker must contain only A/C/G/T characters' };
  return { isValid: true };
}

export function validateHinge(raw: string): SimpleValidation | undefined {
  const s = (raw ?? '').trim();
  if (!s) return undefined; // optional field
  if (/^>/m.test(s)) return { isValid: false, error: 'FASTA format is not allowed for hinge' };
  const clean = s.toUpperCase().replace(/\s/g, '');
  if (!/^[ACGT]+$/.test(clean)) return { isValid: false, error: 'Hinge must contain only A/C/G/T characters' };
  return { isValid: true };
}
