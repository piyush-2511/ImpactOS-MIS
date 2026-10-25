import writeXlsxFile from 'write-excel-file/node';

type Cell = string | number | boolean | Date | null | undefined;

/** One-sheet XLSX with a bold header row. Values keep their types (numbers stay numbers, dates stay dates). */
export async function toXlsx(headers: string[], rows: Cell[][], sheetName = 'Export'): Promise<Uint8Array> {
  const header = headers.map((h) => ({ value: h, fontWeight: 'bold' as const }));
  const body = rows.map((r) =>
    r.map((v) => (v === undefined ? null : Array.isArray(v) ? (v as unknown[]).join('; ') : v)),
  );
  const buffer = await writeXlsxFile([{ sheet: sheetName.slice(0, 31), data: [header, ...body] }]).toBuffer();
  return new Uint8Array(buffer);
}
