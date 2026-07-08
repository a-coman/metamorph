import { readFile, writeFile } from 'node:fs/promises';

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '';
  }
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

export async function writeCsv(
  filePath: string,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  await writeFile(filePath, toCsv(rows), 'utf8');
}

export async function readCsv(filePath: string): Promise<Array<Record<string, string>>> {
  const raw = await readFile(filePath, 'utf8');
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}
