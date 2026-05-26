// Sector-based news fetcher for AI Stock Brief.
// When ticker-specific news is sparse, fall back to news that matches the
// company's sector/industry keywords.

import type { CachedNewsItem } from "@/lib/data/newsCache";

// Map Yahoo Finance sectors/industries to Indonesian + English keyword arrays.
// Keywords are matched against title + description as WHOLE WORDS (word-boundary regex),
// so "gas" only matches the word "gas" — not substrings like "tegas".
const SECTOR_KEYWORDS: Record<string, string[]> = {
  Healthcare: [
    "kesehatan", "rumah sakit", "klinik", "farmasi", "obat", "vaksin",
    "medis", "BPJS", "JKN", "puskesmas", "dokter", "kedokteran",
    "alat kesehatan", "stunting", "imunisasi", "epidemi", "pandemi",
    "kemenkes", "BPOM", "diagnosa", "diagnostik",
  ],
  "Financial Services": [
    "perbankan", "kredit", "pinjaman", "asuransi", "fintech",
    "OJK", "BI rate", "suku bunga", "rupiah", "tabungan", "deposito",
    "multifinance", "leasing", "paylater", "kartu kredit", "kartu debit",
  ],
  "Consumer Defensive": [
    "konsumsi", "beras", "gula", "minyak goreng", "pangan", "rokok",
    "tembakau", "FMCG", "Bulog", "PPN", "daya beli", "harga pangan",
    "swasembada", "kebutuhan pokok", "supermarket",
  ],
  "Consumer Cyclical": [
    "ritel", "retail", "otomotif", "mobil", "motor", "e-commerce",
    "marketplace", "fashion", "tekstil", "rumah", "wisata", "pariwisata",
    "hospitality", "kuliner", "restoran",
  ],
  Energy: [
    "minyak", "OPEC", "Brent", "WTI", "batu bara", "batubara", "coal",
    "Pertamina", "kilang", "BBM", "harga minyak", "LNG", "PGN", "ESDM",
    "tambang minyak", "subsidi BBM", "Pertalite", "Solar", "Pertamax",
    "energi terbarukan",
  ],
  "Basic Materials": [
    "tambang", "mining", "nikel", "tembaga", "smelter", "feronikel",
    "alumunium", "aluminium", "baja", "steel", "semen", "kimia",
    "kemenperin", "royalti", "DMO", "freeport", "amman", "INCO",
    "ANTM",
  ],
  Technology: [
    "teknologi", "startup", "fintech", "e-commerce", "data center",
    "artificial intelligence", "saas", "software", "cloud", "internet",
    "5G", "telco",
  ],
  "Communication Services": [
    "telekomunikasi", "telecom", "5G", "operator seluler", "Telkom",
    "Indosat", "smartfren", "data center", "broadband", "iklan",
    "advertising",
  ],
  Industrials: [
    "manufaktur", "manufacturing", "konstruksi", "construction",
    "infrastruktur", "infrastructure", "tol", "transportasi",
    "logistik", "logistics", "pelabuhan", "bandara", "kereta",
  ],
  Utilities: [
    "listrik", "PLN", "EBT", "renewable", "PLTU", "PLTS", "PLTA",
    "panas bumi", "geothermal", "tarif listrik", "subsidi listrik",
  ],
  "Real Estate": [
    "properti", "real estate", "apartemen", "perumahan", "developer",
    "land bank", "townhouse", "ruko", "REIT", "DIRE", "izin lokasi",
    "PBG", "IMB", "IPL",
  ],
};

// Generic Indonesian sector hints derived from `industry` if `sector` is missing.
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  Banks: ["perbankan", "kredit", "OJK", "BI rate"],
  Insurance: ["asuransi", "premi", "klaim", "OJK"],
  "Capital Markets": ["bursa", "BEI", "IPO", "rights issue", "stock split"],
  "Drug Manufacturers": ["obat", "farmasi", "BPOM", "vaksin", "klinis"],
  "Medical Devices": ["alat kesehatan", "alkes", "medis", "rumah sakit"],
  "Medical Care Facilities": ["rumah sakit", "klinik", "BPJS", "JKN"],
  Coal: ["batu bara", "batubara", "coal", "ESDM", "royalti"],
  "Oil & Gas E&P": ["minyak", "Pertamina", "OPEC", "kilang"],
  Steel: ["baja", "steel", "smelter"],
  "Auto Manufacturers": ["mobil", "otomotif", "Astra"],
  "Internet Retail": ["e-commerce", "marketplace", "Tokopedia", "Shopee"],
  "Telecom Services": ["telekomunikasi", "Telkom", "Indosat"],
  "Real Estate Services": ["properti", "developer"],
};

export function getSectorKeywords(sector: string | null, industry: string | null): string[] {
  const lowered = (sector || "").trim();
  const indu = (industry || "").trim();
  const keywords = new Set<string>();
  if (lowered && SECTOR_KEYWORDS[lowered]) {
    SECTOR_KEYWORDS[lowered].forEach((k) => keywords.add(k.toLowerCase()));
  }
  if (indu && INDUSTRY_KEYWORDS[indu]) {
    INDUSTRY_KEYWORDS[indu].forEach((k) => keywords.add(k.toLowerCase()));
  }
  return Array.from(keywords);
}

/**
 * Filter a list of general news items (e.g. from /api/news) by sector keywords.
 * Uses word-boundary regex to avoid false matches like "gas" inside "tegas".
 * Returns items where title or description contains at least one keyword as a whole word.
 */
export function filterNewsBySector<T extends { title: string; description?: string }>(
  items: T[],
  keywords: string[]
): T[] {
  if (keywords.length === 0) return [];
  // Build regex set: escape special chars, wrap with word boundaries.
  // Multi-word keywords (e.g. "rumah sakit", "harga minyak") still work because
  // \b matches at the boundary of the FIRST and LAST word.
  const regexes = keywords
    .map((kw) => kw.trim())
    .filter((kw) => kw.length >= 2)
    .map((kw) => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i");
    });

  return items.filter((item) => {
    const haystack = `${item.title || ""} ${item.description || ""}`;
    return regexes.some((re) => re.test(haystack));
  });
}

/**
 * Fetch general market news via the existing /api/news endpoint, filter by sector keywords.
 * Returns up to `limit` items (newest first).
 */
export async function fetchSectorNews(
  origin: string,
  sector: string | null,
  industry: string | null,
  limit = 8
): Promise<CachedNewsItem[]> {
  const keywords = getSectorKeywords(sector, industry);
  if (keywords.length === 0) return [];

  try {
    const res = await fetch(`${origin}/api/news`, { cache: "no-store" });
    if (!res.ok) return [];
    const items = (await res.json()) as Array<{
      title: string;
      link: string;
      source?: string;
      pubDate?: string;
      description?: string;
      image?: string;
    }>;

    const matched = filterNewsBySector(items, keywords).slice(0, limit);

    return matched.map((item) => ({
      title: item.title,
      link: item.link,
      source: item.source || "",
      pubDate: item.pubDate || new Date().toISOString(),
      description: item.description || "",
      sentiment: "neutral" as const,
      sentimentScore: 0,
      sentimentReason: `Relevan ke sektor ${sector || industry || "perusahaan"}`,
    }));
  } catch {
    return [];
  }
}
