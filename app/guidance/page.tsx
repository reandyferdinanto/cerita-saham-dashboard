"use client";

import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";

// ── Reusable SVG icon components ──────────────────────────────────────────────

const IconHome = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconSearch = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IconBarChart = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconCandlestick = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);
const IconCog = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconTrendUp = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const IconTrendDown = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);
const IconTarget = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconActivity = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconLayers = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);
const IconNote = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconBuilding = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const IconGlobe = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
  </svg>
);
const IconBook = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const IconLightning = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const IconEye = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const IconClock = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconWarning = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);
const IconCheck = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconChevronRight = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ── Sub-components ─────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
}

function FeatureCard({ icon, title, badge, badgeColor = "#fb923c", children }: FeatureCardProps) {
  return (
    <GlassCard hover={false} className="!p-5">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-silver-200">{title}</h3>
            {badge && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}30` }}>
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-xs text-silver-400 leading-relaxed space-y-2">{children}</div>
    </GlassCard>
  );
}

function StepBadge({ num, label }: { num: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{ background: "rgba(249,115,22,0.2)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }}>
        {num}
      </div>
      <span className="text-sm text-silver-300">{label}</span>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1" style={{ background: "rgba(249,115,22,0.15)" }} />
      <div className="flex items-center gap-2 flex-shrink-0">
        <span style={{ color: "#fb923c" }}>{icon}</span>
        <h2 className="text-base font-bold text-orange-400 whitespace-nowrap">{children}</h2>
      </div>
      <div className="h-px flex-1" style={{ background: "rgba(249,115,22,0.15)" }} />
    </div>
  );
}

// Tips section icon map — single color per theme
const TIPS_SECTIONS = [
  {
    icon: <IconTrendUp className="w-4 h-4" style={{ color: "#10b981" }} />,
    title: "Akumulasi",
    color: "#10b981",
    tips: [
      "Volume tinggi tapi harga tidak naik signifikan",
      "Candlestick ekor panjang di bawah (doji/hammer)",
      "Harga konsolidasi di zona support berulang kali",
      "MACD mulai naik dari bawah nol (momentum positif)",
    ],
  },
  {
    icon: <IconTrendDown className="w-4 h-4" style={{ color: "#ef4444" }} />,
    title: "Distribusi",
    color: "#ef4444",
    tips: [
      "Volume sangat besar tapi harga tidak naik lagi",
      "Candlestick shooting star / doji di resistance",
      "MACD membentuk divergence bearish",
      "Harga gagal menembus high sebelumnya (lower high)",
    ],
  },
  {
    icon: <IconTarget className="w-4 h-4" style={{ color: "#fb923c" }} />,
    title: "Entry & Exit",
    color: "#fb923c",
    tips: [
      "Entry dekat support + volume mulai naik = setup ideal",
      "Pasang SL di bawah support yang valid",
      "TP di resistance berikutnya (R1 / R2)",
      "Risk:Reward minimal 1:2 sebelum masuk posisi",
    ],
  },
  {
    icon: <IconActivity className="w-4 h-4" style={{ color: "#3b82f6" }} />,
    title: "Membaca MACD",
    color: "#3b82f6",
    tips: [
      "Histogram hijau naik = momentum bullish menguat",
      "MACD cross signal dari bawah = sinyal beli",
      "Divergence bullish: harga turun, MACD naik",
      "MACD di atas nol = trend utama masih bullish",
    ],
  },
  {
    icon: <IconLayers className="w-4 h-4" style={{ color: "#a855f7" }} />,
    title: "Support & Resistance",
    color: "#a855f7",
    tips: [
      "Zona S/R dihitung otomatis dari pivot high/low + ATR",
      "S1/S2 = area support terdekat di bawah harga",
      "R1/R2 = area resistance terdekat di atas harga",
      "Semakin sering diuji, semakin kuat levelnya",
    ],
  },
  {
    icon: <IconNote className="w-4 h-4" style={{ color: "#f59e0b" }} />,
    title: "Catatan Bandarmology",
    color: "#f59e0b",
    tips: [
      "Catat kapan pertama kali bandar mulai akumulasi",
      "Tandai level kunci yang dipertahankan berulang kali",
      "Tulis katalog peristiwa: earnings, aksi korporasi, dll",
      "Review catatan sebelum setiap keputusan trading",
    ],
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GuidancePage() {
  return (
    <div className="space-y-8 pb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <Link href="/" className="text-silver-500 hover:text-orange-400 transition-colors flex items-center gap-1">
          <IconHome className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <IconChevronRight className="w-3 h-3 text-silver-600" />
        <span className="text-silver-300">Panduan</span>
      </div>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(6,78,59,0.5) 0%, rgba(6,20,14,0.8) 60%, rgba(120,53,15,0.3) 100%)",
          border: "1px solid rgba(249,115,22,0.15)",
        }}>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #fb923c 0%, transparent 70%)" }} />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.25)" }}>
              Panduan Pengguna
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-silver-100 mb-3 leading-tight">
            Setiap Saham Punya{" "}
            <span style={{ color: "#fb923c" }}>Ceritanya Sendiri</span>
          </h1>

          <p className="text-sm sm:text-base text-silver-400 leading-relaxed max-w-2xl mb-5">
            <strong className="text-silver-300">Cerita Saham</strong> lahir dari filosofi sederhana: setiap emiten di
            Bursa Efek Indonesia memiliki karakter unik yang dibentuk oleh pergerakan{" "}
            <span className="text-orange-400 font-semibold">smart money</span> — bandar, institusi, dan pemain besar
            yang menggerakkan harga. Dengan memahami pola pergerakan tersebut, kamu bisa masuk & keluar di waktu yang tepat.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <IconBook className="w-4 h-4" style={{ color: "#fb923c" }} />, label: "Baca cerita saham", sub: "Pola & karakter tiap emiten" },
              { icon: <IconEye className="w-4 h-4" style={{ color: "#fb923c" }} />,  label: "Track Smart Money",  sub: "Pantau akumulasi & distribusi" },
              { icon: <IconLightning className="w-4 h-4" style={{ color: "#fb923c" }} />, label: "Ambil keputusan", sub: "Entry, TP, SL yang terukur" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(6,20,14,0.5)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)" }}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-silver-200">{item.label}</p>
                  <p className="text-[10px] text-silver-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Konsep Cerita Saham ────────────────────────────────── */}
      <div>
        <SectionTitle icon={<IconCandlestick className="w-4 h-4" />}>Konsep Inti: Cerita Saham</SectionTitle>
        <GlassCard hover={false} className="!p-5 sm:!p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-orange-400 mb-2">Mengapa setiap saham punya cerita?</h3>
              <p className="text-xs text-silver-400 leading-relaxed">
                Harga saham bukan sekadar angka — ia adalah jejak aktivitas para pelaku pasar. Setiap emiten
                memiliki <span className="text-silver-200 font-semibold">bandar (smart money)</span> yang berbeda,
                dengan gaya akumulasi & distribusi yang bisa dipelajari dari waktu ke waktu.
              </p>
              <p className="text-xs text-silver-400 leading-relaxed">
                Saham A mungkin selalu membentuk pola akumulasi di support tertentu sebelum breakout.
                Saham B mungkin punya siklus naik menjelang laporan keuangan. Pola inilah yang disebut{" "}
                <span className="text-orange-400 font-semibold">"cerita"</span> — dan dengan tracking yang konsisten,
                kamu bisa membacanya.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-orange-400 mb-2">Apa itu Smart Money?</h3>
              <div className="space-y-2">
                {[
                  { icon: <IconBuilding className="w-4 h-4" style={{ color: "#10b981" }} />, label: "Institusi & Fund Manager", desc: "Dana kelolaan besar yang menggerakkan volume signifikan" },
                  { icon: <IconEye className="w-4 h-4" style={{ color: "#fb923c" }} />,      label: "Bandar / Market Maker",   desc: "Pemain dominan yang menentukan arah harga jangka pendek–menengah" },
                  { icon: <IconGlobe className="w-4 h-4" style={{ color: "#3b82f6" }} />,    label: "Asing (Foreign Flow)",    desc: "Aliran modal asing yang sering menjadi konfirmasi tren" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5 p-2.5 rounded-lg"
                    style={{ background: "rgba(6,78,59,0.2)", border: "1px solid rgba(16,185,129,0.08)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "rgba(6,78,59,0.4)" }}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-silver-200">{item.label}</p>
                      <p className="text-[10px] text-silver-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 p-4 rounded-xl"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
            <p className="text-xs text-silver-300 italic leading-relaxed text-center">
              "Tugas trader bukanlah menebak arah pasar — melainkan{" "}
              <span className="text-orange-400 font-semibold">membaca cerita</span> yang ditinggalkan smart money
              melalui pergerakan harga dan volume, lalu mengikuti arahnya."
            </p>
          </div>
        </GlassCard>
      </div>

      {/* ─── Fitur-fitur ─────────────────────────────────────────── */}
      <div>
        <SectionTitle icon={<IconBarChart className="w-4 h-4" />}>Fitur-Fitur Dashboard</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <FeatureCard badge="Halaman Utama" title="Dashboard — Monitoring Pasar"
            icon={<IconHome className="w-5 h-5" style={{ color: "#fb923c" }} />}>
            <p>Tampilan overview kondisi pasar saat ini. Cocok sebagai titik awal sebelum trading.</p>
            <ul className="space-y-1.5 mt-2">
              {[
                "IHSG / Composite — harga, perubahan %, high & low harian",
                "Chart IHSG interaktif — 7 timeframe (1D hingga 5Y)",
                "Market summary: Open, Prev Close, Volume, Range",
                "Quick nav ke Watchlist & Admin Panel",
                "Berita pasar terkini dari Detik Finance & Detik Bursa (auto-refresh 5 menit)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <IconCheck className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </FeatureCard>

          <FeatureCard badge="Cari Saham" title="Stock Search — Eksplorasi Saham"
            icon={<IconSearch className="w-5 h-5" style={{ color: "#fb923c" }} />}>
            <p>Cari semua emiten IDX secara real-time. Cocok untuk riset & screening saham baru.</p>
            <ul className="space-y-1.5 mt-2">
              {[
                "Pencarian live dengan debounce 400ms — ketik langsung muncul",
                "Auto-append .JK untuk ticker Indonesia",
                "Quote detail: harga, change, Open/High/Low/Close, volume, market cap",
                "Grafik Candlestick & Line — bisa diswitch",
                "7 timeframe: 5m, 15m, 1h, 4h, 1Y, 1W, 1M",
                "Berita terkait saham + analisis sentimen otomatis",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <IconCheck className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </FeatureCard>

          <FeatureCard badge="Watchlist" title="Stock Watchlist — Pantau Portfolio"
            icon={<IconBarChart className="w-5 h-5" style={{ color: "#fb923c" }} />}>
            <p>Daftar saham yang sedang kamu pantau, lengkap dengan parameter trading dan catatan.</p>
            <ul className="space-y-1.5 mt-2">
              {[
                "Kartu saham dengan harga live & perubahan %",
                "Badge TP (Take Profit) & jarak % ke TP dari harga sekarang",
                "Badge SL (Stop Loss) & jarak % ke SL dari harga sekarang",
                "Preview catatan Notes / Bandarmology",
                "Volume real-time",
                "Sort by: Nama, Perubahan %, Harga",
                "Auto-refresh setiap 60 detik",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <IconCheck className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </FeatureCard>

          <FeatureCard badge="Detail Saham" title="Stock Detail — Analisis Mendalam"
            icon={<IconCandlestick className="w-5 h-5" style={{ color: "#fb923c" }} />}>
            <p>Halaman penuh untuk satu saham — tempat membaca "cerita" terlengkap.</p>
            <ul className="space-y-1.5 mt-2">
              {[
                "Header: nama, harga live, change % dengan badge warna",
                "Stats: Open, High, Low, Prev Close, Volume",
                "Chart Candlestick interaktif dengan semua indikator",
                "Garis TP & SL langsung terpasang di chart",
                "Notes / catatan bandarmology khusus saham ini",
                "Market Capitalization dalam Triliun Rupiah",
                "Auto-refresh quote & chart tiap 60 detik",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <IconCheck className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </FeatureCard>

          <FeatureCard badge="Admin Panel" title="Admin Panel — Manajemen Data"
            icon={<IconCog className="w-5 h-5" style={{ color: "#fb923c" }} />}>
            <p>Pusat pengelolaan saham — tambah, edit, hapus entri watchlist beserta parameternya.</p>
            <ul className="space-y-1.5 mt-2">
              {[
                "Form tambah saham: cari ticker, set TP & SL, tulis catatan",
                "Edit inline: ubah TP, SL, dan catatan tanpa reload",
                "Hapus saham dengan konfirmasi dua langkah (anti-misclick)",
                "Tabel daftar semua saham yang ditrack",
                "Catatan Bandarmology tersimpan per saham",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <IconCheck className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </FeatureCard>

          <FeatureCard badge="Teknikal" title="Indikator Chart — Analisis Teknikal"
            icon={<IconActivity className="w-5 h-5" style={{ color: "#fb923c" }} />}>
            <p>Semua indikator dapat di-toggle on/off. Bersih, tidak mengganggu pembacaan chart.</p>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "MA5",  color: "#f59e0b", desc: "Moving Average 5 — sinyal sangat pendek" },
                { label: "MA20", color: "#3b82f6", desc: "Moving Average 20 — tren mingguan" },
                { label: "MA50", color: "#a855f7", desc: "Moving Average 50 — tren bulanan" },
                { label: "MA200",color: "#ec4899", desc: "Moving Average 200 — tren panjang / golden/death cross" },
                { label: "MACD", color: "#10b981", desc: "MACD (12,26,9) + Signal + Histogram — momentum & divergence" },
                { label: "S/R",  color: "#94a3b8", desc: "Support & Resistance otomatis berbasis pivot high/low + ATR zone" },
              ].map((ind) => (
                <div key={ind.label} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: `${ind.color}18`, color: ind.color, border: `1px solid ${ind.color}30` }}>
                    {ind.label}
                  </span>
                  <span className="text-[11px] text-silver-400">{ind.desc}</span>
                </div>
              ))}
            </div>
          </FeatureCard>
        </div>
      </div>

      {/* ─── Cara Pakai ──────────────────────────────────────────── */}
      <div>
        <SectionTitle icon={<IconLightning className="w-4 h-4" />}>Cara Menggunakan Cerita Saham</SectionTitle>
        <GlassCard hover={false} className="!p-5 sm:!p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <IconClock className="w-3.5 h-3.5 text-orange-400" />
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Workflow Harian</p>
              </div>
              {[
                "Buka Dashboard — cek kondisi IHSG & berita pasar",
                "Lihat Watchlist — saham mana yang mendekati TP atau SL?",
                "Klik kartu saham — baca chart & catatan bandarmology",
                "Analisis indikator: MA, MACD, dan zona S/R",
                "Update catatan di Admin Panel jika ada perkembangan baru",
              ].map((step, i) => (
                <StepBadge key={step} num={i + 1} label={step} />
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <IconSearch className="w-3.5 h-3.5 text-orange-400" />
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Workflow Riset Saham Baru</p>
              </div>
              {[
                "Buka Cari Saham — ketik nama/ticker emiten",
                "Analisis chart dengan timeframe dari 5m hingga 1M",
                "Perhatikan volume — apakah ada akumulasi smart money?",
                "Tentukan level TP (target profit) dan SL (batas rugi)",
                "Tambahkan ke Watchlist via Admin Panel + tulis catatan",
              ].map((step, i) => (
                <StepBadge key={step} num={i + 1} label={step} />
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ─── Tips Membaca Cerita Saham ───────────────────────────── */}
      <div>
        <SectionTitle icon={<IconBook className="w-4 h-4" />}>Tips Membaca Cerita Saham</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TIPS_SECTIONS.map((section) => (
            <GlassCard key={section.title} hover={false} className="!p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${section.color}12`, border: `1px solid ${section.color}25` }}>
                  {section.icon}
                </div>
                <h3 className="text-sm font-bold" style={{ color: section.color }}>{section.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {section.tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-1.5 text-[11px] text-silver-400">
                    <IconChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: section.color }} />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* ─── Timeframe Guide ─────────────────────────────────────── */}
      <div>
        <SectionTitle icon={<IconClock className="w-4 h-4" />}>Panduan Timeframe</SectionTitle>
        <GlassCard hover={false} className="!p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(226,232,240,0.08)" }}>
                  {["Timeframe", "Interval", "Cocok Untuk", "Gaya Trading"].map((h) => (
                    <th key={h} className="text-left pb-2 pr-4 text-[10px] uppercase tracking-wider" style={{ color: "#475569" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { tf: "5m",  interval: "5 menit",  use: "Scalping intraday",         style: "Day Trade" },
                  { tf: "15m", interval: "15 menit", use: "Konfirmasi entry intraday",  style: "Day Trade" },
                  { tf: "1h",  interval: "1 jam",    use: "Tren harian",                style: "Swing awal" },
                  { tf: "4h",  interval: "4 jam",    use: "Setup swing jangka pendek",  style: "Swing" },
                  { tf: "1D",  interval: "Harian",   use: "Analisis utama swing trade", style: "Swing/Positional" },
                  { tf: "1W",  interval: "Mingguan", use: "Tren besar & siklus",        style: "Positional" },
                  { tf: "1M",  interval: "Bulanan",  use: "Big picture & level kunci",  style: "Investasi" },
                ].map((row) => (
                  <tr key={row.tf} style={{ borderBottom: "1px solid rgba(226,232,240,0.04)" }}>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)" }}>
                        {row.tf}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-silver-400">{row.interval}</td>
                    <td className="py-2 pr-4 text-silver-300">{row.use}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded text-[10px]"
                        style={{ background: "rgba(16,185,129,0.08)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.12)" }}>
                        {row.style}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* ─── Disclaimer ──────────────────────────────────────────── */}
      <GlassCard hover={false} className="!p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <IconWarning className="w-5 h-5" style={{ color: "#ef4444" }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <IconWarning className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Disclaimer</p>
            </div>
            <p className="text-xs text-silver-400 leading-relaxed">
              Cerita Saham adalah alat bantu analisis pribadi. Semua informasi, analisis, dan catatan di dalam
              dashboard ini <strong className="text-silver-300">bukan merupakan rekomendasi beli/jual saham</strong>.
              Setiap keputusan investasi sepenuhnya menjadi tanggung jawab masing-masing pengguna.
              Data harga bersumber dari Yahoo Finance dengan kemungkinan delay. Selalu lakukan riset mandiri (DYOR)
              sebelum mengambil keputusan trading.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }}>
          <IconHome className="w-4 h-4" />
          Mulai dari Dashboard
        </Link>
        <Link href="/search"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
          <IconSearch className="w-4 h-4" />
          Cari Saham Sekarang
        </Link>
      </div>
    </div>
  );
}
