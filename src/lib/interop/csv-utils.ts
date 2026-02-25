export function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function csvRow(fields: (string | number | null)[]): string {
  return fields
    .map((field) => {
      if (field == null) return '';
      if (typeof field === 'number') return field.toString();
      return csvEscape(field);
    })
    .join(',');
}

export type CsvDelimiter = ',' | ';';

/**
 * Detect CSV delimiter from first line. Use semicolon when it appears as often
 * or more than comma (e.g. European Excel). Otherwise use comma.
 */
export function detectCsvDelimiter(firstLine: string): CsvDelimiter {
  let commaCount = 0;
  let semicolonCount = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i += 1) {
    const char = firstLine[i];
    if (inQuotes) {
      if (char === '"' && (i + 1 >= firstLine.length || firstLine[i + 1] !== '"')) {
        inQuotes = false;
      } else if (char === '"' && firstLine[i + 1] === '"') {
        i += 1;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      commaCount += 1;
    } else if (char === ';') {
      semicolonCount += 1;
    }
  }

  return semicolonCount >= commaCount ? ';' : ',';
}

/** Parse a single CSV line, handling quoted fields. Supports comma or semicolon delimiter. */
export function parseCsvLine(line: string, delimiter: CsvDelimiter = ','): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}
