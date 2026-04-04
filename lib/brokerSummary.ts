import { connectDB } from "@/lib/db";
import BrokerSummaryRow from "@/lib/models/BrokerSummaryRow";
import BrokerSummaryRun from "@/lib/models/BrokerSummaryRun";
import { inferTradeDateFromFilename, readXlsxWorksheetRows } from "@/lib/xlsxWorkbook";

export type BrokerSummaryParsedRow = {
  brokerCode: string;
  brokerName?: string;
  symbol?: string | null;
  buyFreq?: number;
  buyVolume?: number;
  buyValue?: number;
  sellFreq?: number;
  sellVolume?: number;
  sellValue?: number;
  netVolume?: number;
  netValue?: number;
};

function normalizeHeader(key: string) {
  return key.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

function normalizeDelimitedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = value.replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!cleaned) return undefined;
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

export function parseBrokerSummaryText(rawText: string): BrokerSummaryParsedRow[] {
  const text = normalizeDelimitedText(rawText);
  if (!text) return [];

  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";
  const headers = parseDelimitedLine(firstLine, delimiter).map((header) => normalizeHeader(header));

  return lines
    .slice(1)
    .map((line) => {
      const values = parseDelimitedLine(line, delimiter);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as Record<string, string>;
      const brokerCode = (pickValue(row, ["broker code", "brokercode", "broker", "code"]) || "").toUpperCase().trim();
      if (!brokerCode) return null;

      const symbolRaw = pickValue(row, ["symbol", "ticker", "stock", "stockcode"]);
      const normalizedSymbol = symbolRaw ? symbolRaw.toUpperCase().replace(/\.JK$/i, "").trim() : undefined;

      return {
        brokerCode,
        brokerName: (pickValue(row, ["broker name", "brokername", "name"]) || "").trim() || undefined,
        symbol: normalizedSymbol || undefined,
        buyFreq: parseNumber(pickValue(row, ["buy freq", "buyfreq"])),
        buyVolume: parseNumber(pickValue(row, ["buy volume", "buyvolume"])),
        buyValue: parseNumber(pickValue(row, ["buy value", "buyvalue"])),
        sellFreq: parseNumber(pickValue(row, ["sell freq", "sellfreq"])),
        sellVolume: parseNumber(pickValue(row, ["sell volume", "sellvolume"])),
        sellValue: parseNumber(pickValue(row, ["sell value", "sellvalue"])),
        netVolume: parseNumber(pickValue(row, ["net volume", "netvolume"])),
        netValue: parseNumber(pickValue(row, ["net value", "netvalue"])),
      } satisfies BrokerSummaryParsedRow;
    })
    .filter((row): row is BrokerSummaryParsedRow => Boolean(row));
}

export async function parseBrokerSummaryWorkbook(fileBuffer: ArrayBuffer | Buffer) {
  const { rows } = await readXlsxWorksheetRows({
    fileBuffer,
    preferredSheetName: "broker",
  });

  if (rows.length < 2) return [] as BrokerSummaryParsedRow[];

  const normalizedRows = rows
    .map((row) => row.map((cell) => cell.replace(/\u00A0/g, " ").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  const headerIndex = normalizedRows.findIndex((row) =>
    row.some((cell) => {
      const normalized = normalizeHeader(cell);
      return normalized === "brokercode" || normalized === "broker";
    })
  );

  if (headerIndex < 0) {
    throw new Error("Header broker summary tidak ditemukan di file XLSX");
  }

  const delimitedText = normalizedRows
    .slice(headerIndex)
    .map((row) => row.map((cell) => cell.replace(/\t/g, " ").trim()).join("\t"))
    .join("\n");

  return parseBrokerSummaryText(delimitedText);
}

export function resolveBrokerSummaryTradeDate(tradeDate: string | null | undefined, fileName?: string | null) {
  if (tradeDate?.trim()) return tradeDate.trim();
  if (fileName) return inferTradeDateFromFilename(fileName) || null;
  return null;
}

export async function ingestBrokerSummaryRows(args: {
  tradeDate: string;
  rows: BrokerSummaryParsedRow[];
  source: string;
  mode: "manual" | "remote" | "cron";
}) {
  await connectDB();
  const targetDate = new Date(`${args.tradeDate}T00:00:00.000Z`);

  const run = await BrokerSummaryRun.create({
    source: args.source,
    mode: args.mode,
    targetDate,
    status: "running",
    startedAt: new Date(),
  });

  try {
    if (args.rows.length === 0) {
      throw new Error("Tidak ada row valid untuk di-ingest");
    }

    await BrokerSummaryRow.bulkWrite(
      args.rows.map((row) => ({
        updateOne: {
          filter: {
            tradeDate: targetDate,
            brokerCode: row.brokerCode,
            symbol: row.symbol || null,
          },
          update: {
            $set: {
              tradeDate: targetDate,
              brokerCode: row.brokerCode,
              brokerName: row.brokerName || null,
              symbol: row.symbol || null,
              buyFreq: row.buyFreq ?? null,
              buyVolume: row.buyVolume ?? null,
              buyValue: row.buyValue ?? null,
              sellFreq: row.sellFreq ?? null,
              sellVolume: row.sellVolume ?? null,
              sellValue: row.sellValue ?? null,
              netVolume: row.netVolume ?? null,
              netValue: row.netValue ?? null,
              source: args.source,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    await BrokerSummaryRun.findByIdAndUpdate(run._id, {
      status: "success",
      rowCount: args.rows.length,
      finishedAt: new Date(),
    });

    return { rowCount: args.rows.length, runId: String(run._id) };
  } catch (error) {
    await BrokerSummaryRun.findByIdAndUpdate(run._id, {
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
      finishedAt: new Date(),
    });
    throw error;
  }
}

export async function fetchRemoteBrokerSummaryCsv() {
  const sourceUrl = process.env.BROKER_SUMMARY_SOURCE_URL;
  if (!sourceUrl) {
    throw new Error("BROKER_SUMMARY_SOURCE_URL belum dikonfigurasi");
  }

  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv,text/plain,*/*" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Gagal mengambil source broker summary (${res.status})`);
  }

  return {
    sourceUrl,
    text: await res.text(),
  };
}

export async function getBrokerSummaryStatus() {
  await connectDB();
  const [rowCount, latestRun] = await Promise.all([
    BrokerSummaryRow.countDocuments({}),
    BrokerSummaryRun.findOne({}).sort({ startedAt: -1 }).lean(),
  ]);

  return {
    rowCount,
    latestRun: latestRun
      ? {
          source: latestRun.source,
          mode: latestRun.mode,
          status: latestRun.status,
          rowCount: latestRun.rowCount,
          targetDate: latestRun.targetDate,
          startedAt: latestRun.startedAt,
          finishedAt: latestRun.finishedAt,
          message: latestRun.message || null,
        }
      : null,
    sourceUrl: process.env.BROKER_SUMMARY_SOURCE_URL || null,
  };
}
