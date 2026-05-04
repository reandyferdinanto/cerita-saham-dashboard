type MarketIllustrationInput = {
  title: string;
  dateLabel: string;
  marketStatus: "up" | "down";
  ihsgLevel: string;
  changePercent: string;
  gainers: string[];
  losers: string[];
  variant?: number;
};

type CandleShape = [number, number, number, string];
type ArtworkVariant = "candles" | "terminal" | "sector" | "flow" | "brief";

export const MARKET_ILLUSTRATION_PRESETS = [
  { variant: 0, name: "Candlestick Desk", tone: "Chart besar dengan candle dan garis tren" },
  { variant: 1, name: "Terminal Tape", tone: "Panel terminal, tape, dan volume bar" },
  { variant: 2, name: "Sector Mosaic", tone: "Peta sektor berbentuk blok warna" },
  { variant: 3, name: "Flow Network", tone: "Jalur arus dana dan node market" },
  { variant: 4, name: "Editorial Brief", tone: "Layout kartu editorial dan mini chart" },
] as const;

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trimText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

const MARKET_ILLUSTRATION_VARIANTS = [
  {
    bgA: "#071711",
    bgB: "#103529",
    bgC: "#25160e",
    label: "CANDLESTICK DESK",
    artwork: "candles" as ArtworkVariant,
  },
  {
    bgA: "#120f1f",
    bgB: "#251a3d",
    bgC: "#302012",
    label: "TERMINAL TAPE",
    artwork: "terminal" as ArtworkVariant,
  },
  {
    bgA: "#08151a",
    bgB: "#123139",
    bgC: "#221d12",
    label: "SECTOR MOSAIC",
    artwork: "sector" as ArtworkVariant,
  },
  {
    bgA: "#07101d",
    bgB: "#152d45",
    bgC: "#21162e",
    label: "FLOW NETWORK",
    artwork: "flow" as ArtworkVariant,
  },
  {
    bgA: "#16110d",
    bgB: "#2f2416",
    bgC: "#10251f",
    label: "EDITORIAL BRIEF",
    artwork: "brief" as ArtworkVariant,
  },
];

function renderCandles(candles: CandleShape[]) {
  return candles
    .map(([x, y, h, color]) => {
      const wickTop = Number(y) - 36;
      const wickBottom = Number(y) + Number(h) + 36;
      return `<line x1="${x}" y1="${wickTop}" x2="${x}" y2="${wickBottom}" stroke="${color}" stroke-opacity="0.78" stroke-width="4" stroke-linecap="round"/><rect x="${Number(x) - 13}" y="${y}" width="26" height="${h}" rx="8" fill="${color}" fill-opacity="0.92"/>`;
    })
    .join("");
}

function renderArtwork(
  artwork: ArtworkVariant,
  options: {
    accent: string;
    accentSoft: string;
    secondary: string;
    path: string;
    candles: CandleShape[];
  }
) {
  const { accent, accentSoft, secondary, path, candles } = options;

  if (artwork === "terminal") {
    return `<g filter="url(#shadow)">
      <rect x="70" y="76" width="710" height="508" rx="28" fill="#0b1020" fill-opacity="0.54" stroke="#d7e7df" stroke-opacity="0.12"/>
      <rect x="104" y="112" width="642" height="58" rx="18" fill="#ffffff" fill-opacity="0.06"/>
      <circle cx="132" cy="141" r="7" fill="#ef5b5b"/><circle cx="156" cy="141" r="7" fill="#f2a44f"/><circle cx="180" cy="141" r="7" fill="#11b981"/>
      <text x="216" y="149" fill="#d7e7df" fill-opacity="0.72" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="800">MARKET TERMINAL</text>
      <g opacity="0.92">
        <rect x="104" y="202" width="276" height="244" rx="20" fill="#11b981" fill-opacity="0.1" stroke="#11b981" stroke-opacity="0.22"/>
        <rect x="410" y="202" width="336" height="244" rx="20" fill="#ef5b5b" fill-opacity="0.08" stroke="#ef5b5b" stroke-opacity="0.2"/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="132" y="${232 + i * 36}" width="${150 + i * 18}" height="14" rx="7" fill="#11b981" fill-opacity="${0.42 - i * 0.04}"/><rect x="438" y="${232 + i * 36}" width="${226 - i * 24}" height="14" rx="7" fill="#ef5b5b" fill-opacity="${0.36 - i * 0.03}"/>`).join("")}
      </g>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${116 + i * 72}" y="${536 - ((i % 3) + 2) * 28}" width="34" height="${((i % 3) + 2) * 28}" rx="10" fill="${i % 2 ? secondary : accent}" fill-opacity="0.58"/>`).join("")}
    </g>`;
  }

  if (artwork === "sector") {
    return `<g filter="url(#shadow)">
      <rect x="70" y="76" width="710" height="508" rx="28" fill="#06151a" fill-opacity="0.5" stroke="#d7e7df" stroke-opacity="0.12"/>
      <rect x="104" y="112" width="226" height="178" rx="26" fill="#11b981" fill-opacity="0.34"/>
      <rect x="348" y="112" width="176" height="118" rx="24" fill="#f2a44f" fill-opacity="0.28"/>
      <rect x="542" y="112" width="204" height="118" rx="24" fill="#ef5b5b" fill-opacity="0.22"/>
      <rect x="348" y="248" width="398" height="150" rx="28" fill="#d7e7df" fill-opacity="0.11"/>
      <rect x="104" y="308" width="152" height="244" rx="28" fill="#ef5b5b" fill-opacity="0.2"/>
      <rect x="276" y="416" width="212" height="136" rx="28" fill="#11b981" fill-opacity="0.22"/>
      <rect x="508" y="416" width="238" height="136" rx="28" fill="#f2a44f" fill-opacity="0.18"/>
      <text x="128" y="154" fill="#f4f7f1" font-size="24" font-family="Segoe UI, Arial, sans-serif" font-weight="900">ENERGY</text>
      <text x="372" y="154" fill="#f4f7f1" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="900">TECH</text>
      <text x="566" y="154" fill="#f4f7f1" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="900">TRADE</text>
      <text x="372" y="298" fill="#f4f7f1" font-size="24" font-family="Segoe UI, Arial, sans-serif" font-weight="900">SECTOR ROTATION</text>
      <circle cx="654" cy="488" r="48" fill="${accent}" fill-opacity="0.18" stroke="${accentSoft}" stroke-opacity="0.6" stroke-width="4"/>
    </g>`;
  }

  if (artwork === "flow") {
    return `<g filter="url(#shadow)">
      <rect x="70" y="76" width="710" height="508" rx="28" fill="#07101d" fill-opacity="0.5" stroke="#d7e7df" stroke-opacity="0.12"/>
      <path d="M138 430 C238 244 350 408 452 252 C548 106 638 220 718 132" fill="none" stroke="#d7e7df" stroke-opacity="0.1" stroke-width="28" stroke-linecap="round"/>
      <path d="M138 430 C238 244 350 408 452 252 C548 106 638 220 718 132" fill="none" stroke="${accent}" stroke-opacity="0.72" stroke-width="7" stroke-linecap="round"/>
      <path d="M160 184 C270 318 344 164 458 314 C558 446 630 342 724 488" fill="none" stroke="${secondary}" stroke-opacity="0.46" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 18"/>
      ${[[138,430],[238,290],[350,360],[452,252],[548,158],[638,214],[718,132]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 4 ? 34 : 24}" fill="${i % 2 ? secondary : accent}" fill-opacity="0.24" stroke="#d7e7df" stroke-opacity="0.3" stroke-width="2"/>`).join("")}
      <rect x="128" y="506" width="244" height="34" rx="17" fill="#d7e7df" fill-opacity="0.08"/>
      <rect x="404" y="506" width="304" height="34" rx="17" fill="#d7e7df" fill-opacity="0.08"/>
    </g>`;
  }

  if (artwork === "brief") {
    return `<g filter="url(#shadow)">
      <rect x="70" y="76" width="710" height="508" rx="28" fill="#17120e" fill-opacity="0.54" stroke="#d7e7df" stroke-opacity="0.12"/>
      <rect x="112" y="120" width="300" height="390" rx="26" fill="#f4f7f1" fill-opacity="0.1"/>
      <rect x="446" y="120" width="290" height="122" rx="24" fill="#11b981" fill-opacity="0.16"/>
      <rect x="446" y="268" width="290" height="110" rx="24" fill="#f2a44f" fill-opacity="0.14"/>
      <rect x="446" y="404" width="290" height="106" rx="24" fill="#ef5b5b" fill-opacity="0.12"/>
      <text x="142" y="172" fill="#f4f7f1" font-size="34" font-family="Georgia, 'Times New Roman', serif" font-weight="800">Market</text>
      <text x="142" y="214" fill="#f4f7f1" font-size="34" font-family="Georgia, 'Times New Roman', serif" font-weight="800">Brief</text>
      ${[0, 1, 2, 3, 4].map((i) => `<rect x="146" y="${262 + i * 38}" width="${190 + (i % 2) * 54}" height="12" rx="6" fill="#d7e7df" fill-opacity="${0.32 - i * 0.035}"/>`).join("")}
      <path d="M480 206 L526 174 L574 188 L624 150 L690 170" fill="none" stroke="${accentSoft}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="622" cy="460" r="42" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="14"/>
    </g>`;
  }

  return `<g filter="url(#shadow)">
    <rect x="70" y="78" width="710" height="508" rx="28" fill="#071711" fill-opacity="0.42" stroke="#d7e7df" stroke-opacity="0.12"/>
    <path d="${path}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
    <path d="${path}" fill="none" stroke="${accentSoft}" stroke-opacity="0.26" stroke-width="18" stroke-linecap="round"/>
    ${renderCandles(candles)}
  </g>`;
}

export function createMarketArticleIllustration(input: MarketIllustrationInput) {
  const isUp = input.marketStatus === "up";
  const selectedVariant = MARKET_ILLUSTRATION_VARIANTS[
    input.variant == null
      ? Math.floor(Math.random() * MARKET_ILLUSTRATION_VARIANTS.length)
      : Math.abs(input.variant) % MARKET_ILLUSTRATION_VARIANTS.length
  ];
  const accent = isUp ? "#11b981" : "#ef5b5b";
  const accentSoft = isUp ? "#84d7b0" : "#f3a1a1";
  const secondary = isUp ? "#f2a44f" : "#a6d7c2";
  const path = isUp
    ? "M96 420 C190 336 220 380 302 284 C366 208 414 246 500 164 C570 98 646 128 724 78"
    : "M96 122 C174 188 222 156 304 238 C382 316 438 276 520 352 C596 420 656 388 724 462";
  const candles: CandleShape[] = isUp
    ? [
        [138, 290, 76, "#11b981"],
        [206, 248, 104, "#11b981"],
        [274, 300, 70, "#ef5b5b"],
        [342, 214, 132, "#11b981"],
        [410, 188, 92, "#11b981"],
        [478, 236, 84, "#ef5b5b"],
        [546, 152, 148, "#11b981"],
      ]
    : [
        [138, 162, 92, "#11b981"],
        [206, 216, 114, "#ef5b5b"],
        [274, 190, 76, "#11b981"],
        [342, 270, 126, "#ef5b5b"],
        [410, 316, 98, "#ef5b5b"],
        [478, 286, 82, "#11b981"],
        [546, 360, 136, "#ef5b5b"],
      ];

  const safeTitle = escapeSvgText(trimText(input.title, 60));
  const safeDate = escapeSvgText(input.dateLabel);
  const sentiment = input.marketStatus === "up" ? "SENTIMEN POSITIF" : "SENTIMEN DEFENSIF";
  const gainers = input.gainers.slice(0, 3).map((ticker) => escapeSvgText(ticker)).join("  ");
  const losers = input.losers.slice(0, 3).map((ticker) => escapeSvgText(ticker)).join("  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${selectedVariant.bgA}"/>
      <stop offset="0.54" stop-color="${selectedVariant.bgB}"/>
      <stop offset="1" stop-color="${selectedVariant.bgC}"/>
    </linearGradient>
    <radialGradient id="pulse" cx="72%" cy="18%" r="56%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.34"/>
      <stop offset="0.52" stop-color="${accent}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#d7e7df" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#pulse)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  <path d="M74 566 L1126 566" stroke="#d7e7df" stroke-opacity="0.12"/>
  <path d="M74 424 L1126 424" stroke="#d7e7df" stroke-opacity="0.08"/>
  <path d="M74 282 L1126 282" stroke="#d7e7df" stroke-opacity="0.08"/>
  <path d="M74 140 L1126 140" stroke="#d7e7df" stroke-opacity="0.08"/>
  ${renderArtwork(selectedVariant.artwork, { accent, accentSoft, secondary, path, candles })}
  <g>
    <text x="830" y="116" fill="#d7e7df" font-size="18" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="3">${selectedVariant.label}</text>
    <text x="830" y="177" fill="#f4f7f1" font-size="46" font-family="Georgia, 'Times New Roman', serif" font-weight="700">Market</text>
    <text x="830" y="226" fill="#f4f7f1" font-size="46" font-family="Georgia, 'Times New Roman', serif" font-weight="700">Journal</text>
    <rect x="830" y="266" width="286" height="62" rx="18" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.28"/>
    <text x="854" y="305" fill="${accentSoft}" font-size="18" font-family="Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="2">${sentiment}</text>
    <rect x="830" y="358" width="286" height="72" rx="18" fill="#d7e7df" fill-opacity="0.08" stroke="#d7e7df" stroke-opacity="0.12"/>
    <text x="854" y="387" fill="#a6b8af" font-size="14" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="2">WATCHLIST</text>
    <text x="854" y="414" fill="${accentSoft}" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${gainers || "-"}</text>
    <rect x="830" y="452" width="286" height="72" rx="18" fill="#d7e7df" fill-opacity="0.08" stroke="#d7e7df" stroke-opacity="0.12"/>
    <text x="854" y="481" fill="#a6b8af" font-size="14" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="2">RISK RADAR</text>
    <text x="854" y="508" fill="${secondary}" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${losers || "-"}</text>
  </g>
  <g>
    <text x="82" y="628" fill="#a6b8af" font-size="19" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${safeDate}</text>
    <text x="272" y="628" fill="#f4f7f1" font-size="25" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${safeTitle}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
