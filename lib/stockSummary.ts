import { connectDB } from "@/lib/db";
import StockSummaryRow from "@/lib/models/StockSummaryRow";
import { inferTradeDateFromFilename, readXlsxWorksheetRows } from "@/lib/xlsxWorkbook";

export type StockSummaryParsedRow = {
  stockCode: string;
  companyName?: string;
  remarks?: string;
  previous?: number;
  openPrice?: number;
  firstTrade?: number;
  high?: number;
  low?: number;
  close?: number;
  change?: number;
  volume?: number;
  value?: number;
  frequency?: number;
  indexIndividual?: number;
  offer?: number;
  offerVolume?: number;
  bid?: number;
  bidVolume?: number;
  listedShares?: number;
  tradeableShares?: number;
  weightForIndex?: number;
  foreignSell?: number;
  foreignBuy?: number;
  nonRegularVolume?: number;
  nonRegularValue?: number;
  nonRegularFrequency?: number;
};

function normalizeHeader(key: string) {
  return key.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

const STOCK_CODE_HEADER_ALIASES = [
  "stockcode",
  "code",
  "ticker",
  "symbol",
  "kode",
  "kodesaham",
  "kodeefek",
  "kodeemiten",
];

const COMPANY_NAME_HEADER_ALIASES = [
  "companyname",
  "name",
  "nama",
  "namaperusahaan",
  "namaemiten",
  "emiten",
];

const PREVIOUS_HEADER_ALIASES = ["previous", "prev", "sebelumnya", "hargasebelumnya"];
const OPEN_PRICE_HEADER_ALIASES = ["openprice", "open", "pembukaan", "hargapembukaan", "hargaopen"];
const FIRST_TRADE_HEADER_ALIASES = ["firsttrade", "first", "tradingprice", "hargapertama", "transaksipertama"];
const HIGH_HEADER_ALIASES = ["high", "highest", "tertinggi", "hargatertinggi"];
const LOW_HEADER_ALIASES = ["low", "lowest", "terendah", "hargaterendah"];
const CLOSE_HEADER_ALIASES = ["close", "last", "lastprice", "penutupan", "hargapenutupan", "hargaakhir"];
const CHANGE_HEADER_ALIASES = ["change", "chg", "perubahan", "selisih"];
const VOLUME_HEADER_ALIASES = ["volume", "vol", "volumetransaksi"];
const VALUE_HEADER_ALIASES = ["value", "turnover", "nilai", "nilaitransaksi"];
const FREQUENCY_HEADER_ALIASES = ["frequency", "freq", "frekuensi"];
const INDEX_INDIVIDUAL_HEADER_ALIASES = ["indexindividual", "individualindex", "indeksindividual"];
const OFFER_HEADER_ALIASES = ["offer", "penawaran"];
const OFFER_VOLUME_HEADER_ALIASES = ["offervolume", "voloffer", "volumepenawaran"];
const BID_HEADER_ALIASES = ["bid", "permintaan"];
const BID_VOLUME_HEADER_ALIASES = ["bidvolume", "volbid", "volumepermintaan"];
const LISTED_SHARES_HEADER_ALIASES = ["listedshares", "sahamtercatat"];
const TRADEABLE_SHARES_HEADER_ALIASES = [
  "tradebleshares",
  "tradeableshares",
  "tradebleshare",
  "tradeableshare",
  "sahamdapatdiperdagangkan",
  "sahamdiperdagangkan",
];
const WEIGHT_FOR_INDEX_HEADER_ALIASES = ["weightforindex", "indexweight", "bobotindeks", "bobotindex"];
const FOREIGN_SELL_HEADER_ALIASES = ["foreignsell", "sellforeign", "asingjual", "jualasing"];
const FOREIGN_BUY_HEADER_ALIASES = ["foreignbuy", "buyforeign", "asingbeli", "beliasing"];
const NON_REGULAR_VOLUME_HEADER_ALIASES = ["nonregularvolume", "volumepasarnegosiasi"];
const NON_REGULAR_VALUE_HEADER_ALIASES = ["nonregularvalue", "nilaipasarnegosiasi"];
const NON_REGULAR_FREQUENCY_HEADER_ALIASES = ["nonregularfrequency", "frekuensipasarnegosiasi"];
const REMARKS_HEADER_ALIASES = ["remarks", "remark", "catatan", "keterangan"];

const HEADER_SIGNAL_ALIASES = [
  STOCK_CODE_HEADER_ALIASES,
  COMPANY_NAME_HEADER_ALIASES,
  OPEN_PRICE_HEADER_ALIASES,
  HIGH_HEADER_ALIASES,
  LOW_HEADER_ALIASES,
  CLOSE_HEADER_ALIASES,
  VOLUME_HEADER_ALIASES,
  VALUE_HEADER_ALIASES,
  FOREIGN_SELL_HEADER_ALIASES,
  FOREIGN_BUY_HEADER_ALIASES,
];

function hasHeaderAlias(normalizedCell: string, aliases: string[]) {
  return aliases.some((alias) => normalizeHeader(alias) === normalizedCell);
}

function parseDelimitedLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  out.push(current.trim());
  return out;
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.replace(/\s+/g, "").trim();
  if (!trimmed || trimmed === "--") return undefined;

  let cleaned = trimmed;
  const idThousandsPattern = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/;
  const enThousandsPattern = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;

  if (idThousandsPattern.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else if (enThousandsPattern.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }

  cleaned = cleaned.replace(/%/g, "");
  if (!cleaned || cleaned === "--") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value !== undefined) return value;
  }
  return undefined;
}

export function parseStockSummaryText(rawText: string) {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return [] as StockSummaryParsedRow[];

  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [] as StockSummaryParsedRow[];

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";
  const headers = parseDelimitedLine(firstLine, delimiter).map((header) => normalizeHeader(header));

  return lines
    .slice(1)
    .map((line) => {
      const values = parseDelimitedLine(line, delimiter);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as Record<string, string>;
      const stockCode = (pickValue(row, STOCK_CODE_HEADER_ALIASES) || "").toUpperCase().trim();
      if (!stockCode) return null;

      return {
        stockCode,
        companyName: (pickValue(row, COMPANY_NAME_HEADER_ALIASES) || "").trim() || undefined,
        remarks: (pickValue(row, REMARKS_HEADER_ALIASES) || "").trim() || undefined,
        previous: parseNumber(pickValue(row, PREVIOUS_HEADER_ALIASES)),
        openPrice: parseNumber(pickValue(row, OPEN_PRICE_HEADER_ALIASES)),
        firstTrade: parseNumber(pickValue(row, FIRST_TRADE_HEADER_ALIASES)),
        high: parseNumber(pickValue(row, HIGH_HEADER_ALIASES)),
        low: parseNumber(pickValue(row, LOW_HEADER_ALIASES)),
        close: parseNumber(pickValue(row, CLOSE_HEADER_ALIASES)),
        change: parseNumber(pickValue(row, CHANGE_HEADER_ALIASES)),
        volume: parseNumber(pickValue(row, VOLUME_HEADER_ALIASES)),
        value: parseNumber(pickValue(row, VALUE_HEADER_ALIASES)),
        frequency: parseNumber(pickValue(row, FREQUENCY_HEADER_ALIASES)),
        indexIndividual: parseNumber(pickValue(row, INDEX_INDIVIDUAL_HEADER_ALIASES)),
        offer: parseNumber(pickValue(row, OFFER_HEADER_ALIASES)),
        offerVolume: parseNumber(pickValue(row, OFFER_VOLUME_HEADER_ALIASES)),
        bid: parseNumber(pickValue(row, BID_HEADER_ALIASES)),
        bidVolume: parseNumber(pickValue(row, BID_VOLUME_HEADER_ALIASES)),
        listedShares: parseNumber(pickValue(row, LISTED_SHARES_HEADER_ALIASES)),
        tradeableShares: parseNumber(pickValue(row, TRADEABLE_SHARES_HEADER_ALIASES)),
        weightForIndex: parseNumber(pickValue(row, WEIGHT_FOR_INDEX_HEADER_ALIASES)),
        foreignSell: parseNumber(pickValue(row, FOREIGN_SELL_HEADER_ALIASES)),
        foreignBuy: parseNumber(pickValue(row, FOREIGN_BUY_HEADER_ALIASES)),
        nonRegularVolume: parseNumber(pickValue(row, NON_REGULAR_VOLUME_HEADER_ALIASES)),
        nonRegularValue: parseNumber(pickValue(row, NON_REGULAR_VALUE_HEADER_ALIASES)),
        nonRegularFrequency: parseNumber(pickValue(row, NON_REGULAR_FREQUENCY_HEADER_ALIASES)),
      } satisfies StockSummaryParsedRow;
    })
    .filter((row): row is StockSummaryParsedRow => Boolean(row));
}

export async function parseStockSummaryWorkbook(fileBuffer: ArrayBuffer | Buffer) {
  const { rows } = await readXlsxWorksheetRows({
    fileBuffer,
    preferredSheetName: "sheet1",
  });

  if (rows.length < 2) return [] as StockSummaryParsedRow[];

  const normalizedRows = rows
    .map((row) => row.map((cell) => cell.replace(/\u00A0/g, " ").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  const headerIndex = normalizedRows.findIndex((row) => {
    const normalizedCells = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
    if (normalizedCells.some((cell) => hasHeaderAlias(cell, STOCK_CODE_HEADER_ALIASES))) {
      return true;
    }

    const matchedSignals = HEADER_SIGNAL_ALIASES.filter((aliases) =>
      normalizedCells.some((cell) => hasHeaderAlias(cell, aliases))
    ).length;

    return matchedSignals >= 4;
  });

  if (headerIndex < 0) {
    throw new Error(
      "Header stock summary tidak dikenali di file XLSX. Pastikan file memakai kolom utama seperti Stock Code/Kode Saham, Company Name/Nama Perusahaan, Open/Harga Pembukaan, High, Low, Close/Harga Penutupan, Volume, dan Value/Nilai."
    );
  }

  const delimitedText = normalizedRows
    .slice(headerIndex)
    .map((row) => row.map((cell) => cell.replace(/\t/g, " ").trim()).join("\t"))
    .join("\n");

  return parseStockSummaryText(delimitedText);
}

export function resolveStockSummaryTradeDate(tradeDate: string | null | undefined, fileName?: string | null) {
  if (fileName) {
    const inferredDate = inferTradeDateFromFilename(fileName);
    if (inferredDate) return inferredDate;
  }
  if (tradeDate?.trim()) return tradeDate.trim();
  return null;
}

export async function ingestStockSummaryRows(args: {
  tradeDate: string;
  rows: StockSummaryParsedRow[];
  source: string;
}) {
  await connectDB();
  const tradeDate = new Date(`${args.tradeDate}T00:00:00.000Z`);

  if (args.rows.length === 0) {
    throw new Error("Tidak ada row stock summary valid untuk di-import");
  }

  await StockSummaryRow.bulkWrite(
    args.rows.map((row) => ({
      updateOne: {
        filter: { tradeDate, stockCode: row.stockCode },
        update: {
          $set: {
            tradeDate,
            stockCode: row.stockCode,
            companyName: row.companyName || null,
            remarks: row.remarks || null,
            previous: row.previous ?? null,
            openPrice: row.openPrice ?? null,
            firstTrade: row.firstTrade ?? null,
            high: row.high ?? null,
            low: row.low ?? null,
            close: row.close ?? null,
            change: row.change ?? null,
            volume: row.volume ?? null,
            value: row.value ?? null,
            frequency: row.frequency ?? null,
            indexIndividual: row.indexIndividual ?? null,
            offer: row.offer ?? null,
            offerVolume: row.offerVolume ?? null,
            bid: row.bid ?? null,
            bidVolume: row.bidVolume ?? null,
            listedShares: row.listedShares ?? null,
            tradeableShares: row.tradeableShares ?? null,
            weightForIndex: row.weightForIndex ?? null,
            foreignSell: row.foreignSell ?? null,
            foreignBuy: row.foreignBuy ?? null,
            nonRegularVolume: row.nonRegularVolume ?? null,
            nonRegularValue: row.nonRegularValue ?? null,
            nonRegularFrequency: row.nonRegularFrequency ?? null,
            source: args.source,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return { rowCount: args.rows.length };
}
