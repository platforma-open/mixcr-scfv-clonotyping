export type FastaValidationResult = {
  isValid: boolean;
  error?: string;
  errors?: string[];
  vGenes?: string;
  jGenes?: string;
};

export type FastaRecord = { header: string; seq: string };

export function parseFasta(input: string): FastaRecord[] {
  if (!input) return [];
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const records: FastaRecord[] = [];
  let currentHeader: string | null = null;
  let currentSeq: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('>')) {
      if (currentHeader !== null) {
        records.push({ header: currentHeader, seq: currentSeq.join('') });
        currentSeq = [];
      }
      const h = line.substring(1).trim();
      if (!h) continue;
      currentHeader = h;
    } else {
      if (currentHeader === null) continue;
      currentSeq.push(line.replace(/\s/g, ''));
    }
  }
  if (currentHeader !== null) {
    records.push({ header: currentHeader, seq: currentSeq.join('') });
  }
  return records;
}

export function validateFastaSequence(input: string): FastaValidationResult {
  if (!input || !input.trim()) return { isValid: false, error: 'FASTA sequence is required' };
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const records: { header: string; seq: string }[] = [];
  let currentHeader: string | null = null;
  let currentSeq: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('>')) {
      if (currentHeader !== null) {
        records.push({ header: currentHeader, seq: currentSeq.join('') });
        currentSeq = [];
      }
      const h = line.substring(1).trim();
      if (!h) return { isValid: false, error: 'Headers cannot be empty. Provide a name after ">".' };
      currentHeader = h;
    } else {
      if (currentHeader === null) return { isValid: false, error: 'Found sequence data before any FASTA header (line starting with ">")' };
      if (!/^[ACGTURYKMSWBDHVNacgturykmswbdhvn-]+$/.test(line)) {
        return { isValid: false, error: `Invalid characters in sequence line: ${line}` };
      }
      currentSeq.push(line.replace(/\s/g, ''));
    }
  }
  if (currentHeader !== null) {
    records.push({ header: currentHeader, seq: currentSeq.join('') });
  }
  if (records.length === 0) return { isValid: false, error: 'No FASTA records found' };

  // Build V/J FASTA sets using provided headers as name roots
  const vParts: string[] = [];
  const jParts: string[] = [];
  for (const r of records) {
    const cleanHeader = r.header.replace(/\s+/g, '_');
    const seq = r.seq.toUpperCase();
    if (!seq) continue;
    vParts.push(`>${cleanHeader}_V\n${seq}`);
    jParts.push(`>${cleanHeader}_J\n${seq}`);
  }
  if (vParts.length === 0) return { isValid: false, error: 'All FASTA records are empty' };
  return { isValid: true, vGenes: vParts.join('\n'), jGenes: jParts.join('\n') };
}
