import { inflateRawSync } from 'node:zlib';

/**
 * Word (.docx) and Excel (.xlsx) are ZIP archives of XML parts, so their text can be
 * read with node:zlib alone — no parser dependency in the supply chain.
 * Legacy .xls/.doc, PDF and images are not OOXML and stay unread.
 */

const centralDirectorySignature = 0x02014b50;
const endOfCentralDirectorySignature = 0x06054b50;
const localHeaderSignature = 0x04034b50;

const maxOOXMLChars = 20000;
const maxRowsPerSheet = 200;

type ZipEntry = { name: string; method: number; size: number; offset: number };

function entries(buffer: Buffer): ZipEntry[] {
  let end = -1;
  const floor = Math.max(0, buffer.length - 66_000);
  for (let cursor = buffer.length - 22; cursor >= floor; cursor -= 1) {
    if (buffer.readUInt32LE(cursor) === endOfCentralDirectorySignature) { end = cursor; break; }
  }
  if (end < 0) return [];

  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const list: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== centralDirectorySignature) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const size = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    // 0xFFFFFFFF means the real size lives in a zip64 extra field we do not follow.
    if (size === 0xffffffff || offset === 0xffffffff) continue;
    list.push({ name, method, size, offset });
  }
  return list;
}

function bytesOf(buffer: Buffer, entry: ZipEntry): Buffer | undefined {
  if (entry.offset + 30 > buffer.length || buffer.readUInt32LE(entry.offset) !== localHeaderSignature) return undefined;
  const from = entry.offset + 30 + buffer.readUInt16LE(entry.offset + 26) + buffer.readUInt16LE(entry.offset + 28);
  const slice = buffer.subarray(from, from + entry.size);
  if (entry.method === 0) return slice;
  if (entry.method !== 8) return undefined;
  try {
    return inflateRawSync(slice);
  } catch {
    return undefined;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tagText(fragment: string): string {
  return decodeEntities((fragment.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((node) => node.replace(/<[^>]*>/g, '')).join(''));
}

function sharedStrings(part: Buffer | undefined): string[] {
  if (!part) return [];
  return (part.toString('utf8').match(/<si>[\s\S]*?<\/si>/g) ?? []).map(tagText);
}

function sheetOrder(buffer: Buffer, list: ZipEntry[]): { name: string; path: string }[] {
  const workbook = list.find((entry) => entry.name === 'xl/workbook.xml');
  const part = workbook ? bytesOf(buffer, workbook) : undefined;
  if (!part) return [];
  const relationships = new Map<string, string>();
  const rels = list.find((entry) => entry.name === 'xl/_rels/workbook.xml.rels');
  const relPart = rels ? bytesOf(buffer, rels) : undefined;
  if (relPart) {
    for (const node of relPart.toString('utf8').match(/<Relationship\b[^>]*\/?>/g) ?? []) {
      const id = /Id="([^"]+)"/.exec(node)?.[1];
      // Targets are relative to xl/, written either way round by the producing app.
      const target = /Target="([^"]+)"/.exec(node)?.[1]?.replace(/^\/?xl\//, '');
      if (id && target) relationships.set(id, `xl/${target}`);
    }
  }
  return (part.toString('utf8').match(/<sheet\b[^>]*\/?>/g) ?? [])
    .map((node) => ({
      name: decodeEntities(/name="([^"]*)"/.exec(node)?.[1] ?? ''),
      path: relationships.get(/r:id="([^"]+)"/.exec(node)?.[1] ?? '') ?? '',
    }))
    .filter((sheet) => sheet.name && sheet.path);
}

function workbookText(buffer: Buffer, list: ZipEntry[]): string {
  const stringsEntry = list.find((entry) => entry.name === 'xl/sharedStrings.xml');
  const strings = sharedStrings(stringsEntry ? bytesOf(buffer, stringsEntry) : undefined);
  const sheetEntries = list.filter((entry) => /^xl\/worksheets\/[\w\-. ]+\.xml$/.test(entry.name));
  const byPath = new Map(sheetEntries.map((entry) => [entry.name, entry]));
  const order = sheetOrder(buffer, list);
  const ordered = order.length
    ? order.flatMap((sheet) => {
      const entry = byPath.get(sheet.path);
      return entry ? [{ name: sheet.name, entry }] : [];
    })
    : sheetEntries.map((entry) => ({ name: entry.name.split('/').pop() ?? 'sheet', entry }));

  const parts: string[] = [];
  let spent = 0;
  for (const sheet of ordered) {
    const part = bytesOf(buffer, sheet.entry);
    if (!part) continue;
    const rows: string[] = [];
    for (const row of (part.toString('utf8').match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []).slice(0, maxRowsPerSheet)) {
      const cells: string[] = [];
      for (const cell of row.match(/<c\b[\s\S]*?(?:\/>|<\/c>)/g) ?? []) {
        const type = /\bt="([^"]+)"/.exec(cell)?.[1];
        const value = /<v>([\s\S]*?)<\/v>/.exec(cell)?.[1];
        const inline = /<is>[\s\S]*?<\/is>/.exec(cell)?.[0];
        if (type === 's' && value !== undefined) cells.push(strings[Number(value)] ?? '');
        else if (inline) cells.push(tagText(inline));
        else if (value !== undefined && type !== 'e') cells.push(decodeEntities(value));
        else cells.push('');
      }
      if (cells.some((cell) => cell !== '')) rows.push(cells.join('\t'));
    }
    if (!rows.length) continue;
    const body = rows.join('\n').slice(0, Math.max(maxOOXMLChars - spent, 0));
    spent += body.length;
    parts.push(`Sheet "${sheet.name}" (tab-separated)\n${body}`);
    if (spent >= maxOOXMLChars) break;
  }
  return parts.join('\n\n');
}

function documentText(buffer: Buffer, list: ZipEntry[]): string {
  const entry = list.find((item) => item.name === 'word/document.xml');
  const part = entry ? bytesOf(buffer, entry) : undefined;
  if (!part) return '';
  return (part.toString('utf8').match(/<w:p\b[\s\S]*?(?:\/>|<\/w:p>)/g) ?? [])
    .map((node) => decodeEntities((node.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
      .map((piece) => (piece === '<w:tab/>' ? '\t' : piece === '<w:br/>' ? '\n' : piece.replace(/<[^>]*>/g, '')))
      .join('')))
    .filter((line) => line.trim())
    .join('\n')
    .slice(0, maxOOXMLChars);
}

/** Returns extracted text, or undefined when the file is not readable OOXML. */
export function readOfficeText(buffer: Buffer, extension: string): { text: string; truncated: boolean } | undefined {
  const list = entries(buffer);
  if (!list.length) return undefined;
  let text = '';
  if (extension === '.xlsx') text = workbookText(buffer, list);
  else if (extension === '.docx') text = documentText(buffer, list);
  else return undefined;
  text = text.trim();
  if (!text) return undefined;
  return { text: text.slice(0, maxOOXMLChars), truncated: text.length > maxOOXMLChars };
}
