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
  if (cleanSequence.length < 9) return { isValid: false, error: 'Sequence is too short (minimum 9 nucleotides required)' };

  const translatedSequence = translateDNAToProtein(cleanSequence);
  if (translatedSequence.length === 0) return { isValid: false, error: 'Translation resulted in empty protein sequence (possibly due to early stop codon)' };
  if (translatedSequence.includes('X')) warnings.push('Translation contains unknown amino acids (X) due to invalid codons');

  const validationRegex = /C[ACDEFGHIKLMNPQRSTVWY]{4,50}[FWYLI][ACDEFGHIKLMNPQRSTVWY]{0,5}G[ACDEFGHIKLMNPQRSTVWY]G/;
  const searchStartPosition = 80;
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


