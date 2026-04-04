import zlib from "node:zlib";

type WorksheetCell = {
  columnIndex: number;
  value: string;
};

function toBuffer(fileBuffer: ArrayBuffer | Buffer) {
  return Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/gi, "\n")
    .replace(/&#10;/g, "\n")
    .replace(/&#x9;/gi, "\t")
    .replace(/&#9;/g, "\t");
}

function stripXmlTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ""));
}

function getColumnIndex(cellRef: string) {
  const letters = cellRef.replace(/[0-9]/g, "").toUpperCase();
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(index - 1, 0);
}

function extractSharedStrings(xml: string) {
  const strings: string[] = [];
  const itemRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;

  for (const match of xml.matchAll(itemRegex)) {
    const itemXml = match[1] || "";
    const textMatches = [...itemXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)];
    const value = textMatches.length > 0
      ? textMatches.map((textMatch) => decodeXml(textMatch[1] || "")).join("")
      : stripXmlTags(itemXml);
    strings.push(value.trim());
  }

  return strings;
}

function extractSheetRelationships(xml: string) {
  const rels = new Map<string, string>();
  const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g;

  for (const match of xml.matchAll(relRegex)) {
    const id = match[1];
    const target = match[2];
    if (!id || !target) continue;
    const normalizedTarget = target.replace(/^\/+/, "");
    rels.set(id, normalizedTarget.startsWith("xl/") ? normalizedTarget : `xl/${normalizedTarget}`);
  }

  return rels;
}

function extractWorkbookSheets(xml: string) {
  const sheets: Array<{ name: string; relationId: string }> = [];
  const sheetRegex = /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g;

  for (const match of xml.matchAll(sheetRegex)) {
    const name = decodeXml(match[1] || "");
    const relationId = match[2] || "";
    if (!name || !relationId) continue;
    sheets.push({ name, relationId });
  }

  return sheets;
}

function extractWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;

  for (const rowMatch of xml.matchAll(rowRegex)) {
    const rowXml = rowMatch[1] || "";
    const cells: WorksheetCell[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;

    for (const cellMatch of rowXml.matchAll(cellRegex)) {
      const attrs = cellMatch[1] || cellMatch[3] || "";
      const content = cellMatch[2] || "";
      const refMatch = attrs.match(/\br="([A-Z]+[0-9]+)"/i);
      if (!refMatch) continue;

      const typeMatch = attrs.match(/\bt="([^"]+)"/i);
      const cellType = typeMatch?.[1] || "";
      const columnIndex = getColumnIndex(refMatch[1]);

      let value = "";
      if (cellType === "s") {
        const sharedIndexMatch = content.match(/<v>([\s\S]*?)<\/v>/);
        const sharedIndex = Number(sharedIndexMatch?.[1] || "");
        value = Number.isFinite(sharedIndex) ? sharedStrings[sharedIndex] || "" : "";
      } else if (cellType === "inlineStr") {
        const inlineMatches = [...content.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)];
        value = inlineMatches.length > 0
          ? inlineMatches.map((match) => decodeXml(match[1] || "")).join("")
          : stripXmlTags(content);
      } else {
        const rawValueMatch = content.match(/<v>([\s\S]*?)<\/v>/);
        value = rawValueMatch ? decodeXml(rawValueMatch[1] || "") : stripXmlTags(content);
      }

      cells.push({ columnIndex, value: value.trim() });
    }

    if (cells.length === 0) continue;

    const maxColumn = Math.max(...cells.map((cell) => cell.columnIndex));
    const row: string[] = Array.from({ length: maxColumn + 1 }, () => "");
    for (const cell of cells) {
      row[cell.columnIndex] = cell.value;
    }

    while (row.length > 0 && row[row.length - 1] === "") {
      row.pop();
    }

    rows.push(row);
  }

  return rows;
}

function readZipEntries(fileBuffer: ArrayBuffer | Buffer) {
  const buffer = toBuffer(fileBuffer);
  const eocdSignature = 0x06054b50;
  const centralDirSignature = 0x02014b50;
  const localFileSignature = 0x04034b50;

  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 0xffff - 22); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error("File XLSX tidak valid: end of central directory tidak ditemukan");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralDirSignature) {
      throw new Error("File XLSX tidak valid: central directory rusak");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== localFileSignature) {
      throw new Error(`File XLSX tidak valid: local header ${fileName} rusak`);
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    let fileData: Buffer;
    if (compressionMethod === 0) {
      fileData = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      fileData = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Compression method ${compressionMethod} belum didukung untuk ${fileName}`);
    }

    entries.set(fileName.replace(/^\/+/, ""), fileData);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return {
    file(name: string) {
      const content = entries.get(name);
      if (!content) return null;
      return {
        async: async (type: "string") => {
          if (type !== "string") {
            throw new Error("Hanya pembacaan string yang didukung");
          }
          return content.toString("utf8");
        },
      };
    },
  };
}

export async function readXlsxWorksheetRows(args: {
  fileBuffer: ArrayBuffer | Buffer;
  preferredSheetName?: string;
}) {
  const zip = readZipEntries(args.fileBuffer);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");

  if (!workbookXml || !workbookRelsXml) {
    throw new Error("File XLSX tidak valid atau workbook tidak ditemukan");
  }

  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const sharedStrings = sharedStringsXml ? extractSharedStrings(sharedStringsXml) : [];
  const sheets = extractWorkbookSheets(workbookXml);
  const relationships = extractSheetRelationships(workbookRelsXml);

  if (sheets.length === 0) {
    throw new Error("Worksheet XLSX tidak ditemukan");
  }

  const normalizedPreferred = args.preferredSheetName?.trim().toLowerCase();
  const selectedSheet = normalizedPreferred
    ? sheets.find((sheet) => sheet.name.trim().toLowerCase() === normalizedPreferred)
      || sheets.find((sheet) => sheet.name.trim().toLowerCase().includes(normalizedPreferred))
      || sheets[0]
    : sheets[0];

  const sheetPath = relationships.get(selectedSheet.relationId);
  if (!sheetPath) {
    throw new Error(`Worksheet ${selectedSheet.name} tidak memiliki relasi file`);
  }

  const worksheetXml = await zip.file(sheetPath)?.async("string");
  if (!worksheetXml) {
    throw new Error(`Worksheet ${selectedSheet.name} tidak bisa dibaca`);
  }

  return {
    sheetName: selectedSheet.name,
    rows: extractWorksheetRows(worksheetXml, sharedStrings),
  };
}

export function inferTradeDateFromFilename(fileName: string) {
  const compactMatch = fileName.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  const dashedMatch = fileName.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (dashedMatch) {
    return `${dashedMatch[1]}-${dashedMatch[2]}-${dashedMatch[3]}`;
  }

  return null;
}
