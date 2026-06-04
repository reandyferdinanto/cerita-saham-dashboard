"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/ui/AuthProvider";

// ============================================================================
// ICONS
// ============================================================================
const IconHome = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const IconChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const IconChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const IconSearch = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconWatchlist = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconTools = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.082 3.331a1 1 0 00.95.69h3.502c.969 0 1.371 1.24.588 1.81l-2.833 2.058a1 1 0 00-.364 1.118l1.082 3.332c.3.921-.755 1.688-1.538 1.118l-2.833-2.058a1 1 0 00-1.176 0l-2.833 2.058c-.783.57-1.838-.197-1.539-1.118l1.083-3.332a1 1 0 00-.364-1.118L2.93 8.758c-.783-.57-.38-1.81.588-1.81H7.02a1 1 0 00.951-.69l1.078-3.331z" />
  </svg>
);

const IconGuide = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IconChart = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

const IconClock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconShield = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconWarning = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IconCheck = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const IconUser = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const IconLightbulb = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const IconPlay = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconBookOpen = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IconTarget = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ============================================================================
// COMPONENTS
// ============================================================================

function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = (current / total) * 100;
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(226,232,240,0.08)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${percentage}%`,
          background: "linear-gradient(90deg, #fb923c 0%, #f97316 100%)",
        }}
      />
    </div>
  );
}

function SectionNav({ sections, activeSection }: { sections: string[]; activeSection: string }) {
  return (
    <nav
      className="sticky top-20 z-50 mb-6 -mx-4 px-4 py-3"
      style={{
        background: "linear-gradient(180deg, rgba(6,20,14,0.98) 0%, rgba(6,20,14,0.95) 80%, rgba(6,20,14,0) 100%)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
      aria-label="Navigasi panduan"
    >
      <div
        className="glass-card !p-3 overflow-x-auto scrollbar-hide"
        style={{
          background: "rgba(6,78,59,0.25)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex gap-2 min-w-max">
          {sections.map((section) => {
            const isActive = activeSection === section;
            return (
              <a
                key={section}
                href={`#${section.toLowerCase().replace(/\s+/g, "-")}`}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-silver-400 hover:text-silver-200 hover:bg-white/5"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {section}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-card !p-0 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}
          >
            {icon}
          </div>
          <h3 className="text-base font-bold text-silver-200">{title}</h3>
        </div>
        <IconChevronDown
          className={`w-5 h-5 text-silver-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  href,
  badge,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link href={href} className="block group">
      <div
        className="glass-card !p-5 h-full transition-all group-hover:scale-[1.02]"
        style={{
          background: "linear-gradient(135deg, rgba(6,78,59,0.18) 0%, rgba(6,20,14,0.82) 100%)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
            style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)" }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-silver-100">{title}</h3>
              {badge && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7" }}
                >
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-silver-400 leading-relaxed">{description}</p>
          </div>
          <IconChevronRight className="w-4 h-4 text-silver-500 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-1" />
        </div>
      </div>
    </Link>
  );
}

function StepCard({ num, title, desc, icon }: { num: number; title: string; desc: string; icon: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.05) 100%)",
          color: "#fb923c",
          border: "1px solid rgba(249,115,22,0.3)",
        }}
      >
        {num}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-orange-400">{icon}</span>
          <h4 className="text-sm font-bold text-silver-200">{title}</h4>
        </div>
        <p className="text-xs text-silver-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <IconCheck className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
      <p className="text-xs text-silver-400 leading-relaxed">{children}</p>
    </div>
  );
}

function InfoBox({ type = "info", children }: { type?: "info" | "warning" | "success"; children: ReactNode }) {
  const styles = {
    info: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", icon: <IconLightbulb className="w-5 h-5 text-blue-400" /> },
    warning: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", icon: <IconWarning className="w-5 h-5 text-red-400" /> },
    success: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)", icon: <IconCheck className="w-5 h-5 text-green-400" /> },
  };

  const style = styles[type];

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
      role="note"
    >
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <div className="text-xs text-silver-300 leading-relaxed">{children}</div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function GuidancePage() {
  const { user } = useAuth();
  const isMember = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const sections = ["Mulai", "Filosofi", "Fitur", "Workflow", "Tips"];
  const [activeSection, setActiveSection] = useState("Mulai");

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <Link
          href="/"
          className="text-silver-500 hover:text-orange-400 transition-colors flex items-center gap-1"
        >
          <IconHome className="w-3.5 h-3.5" />
          <span className="sr-only sm:not-sr-only">Dashboard</span>
        </Link>
        <IconChevronRight className="w-3 h-3 text-silver-600" />
        <span className="text-silver-300 font-semibold">Panduan Member</span>
      </nav>

      {/* Hero Section */}
      <header
        className="relative rounded-2xl overflow-hidden p-6 sm:p-10"
        style={{
          background:
            "linear-gradient(135deg, rgba(6,78,59,0.5) 0%, rgba(6,20,14,0.82) 60%, rgba(120,53,15,0.28) 100%)",
          border: "1px solid rgba(249,115,22,0.15)",
        }}
      >
        <div
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #fb923c 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }}
        />

        <div className="relative z-10 max-w-4xl">
          <span
            className="inline-flex text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{
              background: "rgba(249,115,22,0.15)",
              color: "#fb923c",
              border: "1px solid rgba(249,115,22,0.25)",
            }}
          >
            Panduan Lengkap Member
          </span>

          <h1 className="text-3xl sm:text-4xl font-bold text-silver-100 leading-tight mb-4">
            Panduan Membaca Anomali Pasar yang Belum Ramai
          </h1>
          <p className="text-sm sm:text-base text-silver-400 leading-relaxed max-w-3xl mb-6">
            Pelajari cara menggunakan anomalisaham untuk menemukan peluang trading sebelum pasar menyadarinya.
            Dari login hingga analisis mendalam, panduan ini membantu Anda memaksimalkan setiap fitur.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Untuk Pemula", sub: "Langkah demi langkah", icon: <IconUser className="w-4 h-4" /> },
              { label: "Praktis", sub: "Fokus pada penggunaan nyata", icon: <IconPlay className="w-4 h-4" /> },
              { label: "Lengkap", sub: "Semua fitur dijelaskan", icon: <IconBookOpen className="w-4 h-4" /> },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "rgba(6,20,14,0.46)", border: "1px solid rgba(226,232,240,0.06)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-orange-400"
                  style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)" }}
                >
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
      </header>

      {/* Section Navigation */}
      <SectionNav sections={sections} activeSection={activeSection} />

      {/* Quick Actions */}
      <section id="mulai" className="scroll-mt-24">
        <h2 className="text-xl font-bold text-silver-100 mb-4 flex items-center gap-2">
          <IconPlay className="w-5 h-5 text-orange-400" />
          Mulai Cepat
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <QuickActionCard
            icon={<IconSearch className="w-6 h-6 text-orange-400" />}
            title="Cari Saham"
            description="Analisis saham IDX dengan chart, fundamental, dan sinyal teknikal"
            href={isMember ? "/search" : "/login"}
            badge={isMember ? undefined : "Login"}
          />
          <QuickActionCard
            icon={<IconWatchlist className="w-6 h-6 text-orange-400" />}
            title="Watchlist"
            description="Pantau saham pilihan dengan TP, SL, dan catatan bandarmology"
            href={isMember ? "/watchlist" : "/login"}
            badge={isMember ? undefined : "Login"}
          />
          <QuickActionCard
            icon={<IconTools className="w-6 h-6 text-orange-400" />}
            title="Investor Tools"
            description="AI Brief, Risk Calculator, dan kalkulator aksi korporasi"
            href={isMember ? "/investor-tools" : "/login"}
            badge={isMember ? undefined : "Login"}
          />
          <QuickActionCard
            icon={<IconClock className="w-6 h-6 text-orange-400" />}
            title="Simulasi Trading"
            description="Belajar money management dengan simulasi interaktif"
            href="/simulation"
          />
        </div>

        {!isMember && (
          <InfoBox type="info">
            <strong>Belum jadi member?</strong> Daftar sekarang untuk mengakses semua fitur analisis dan tools
            profesional. <Link href="/register" className="text-orange-400 hover:underline font-semibold">Daftar di sini →</Link>
          </InfoBox>
        )}
      </section>

      {/* Philosophy Section */}
      <section id="filosofi" className="scroll-mt-24">
        <h2 className="text-xl font-bold text-silver-100 mb-4 flex items-center gap-2">
          <IconLightbulb className="w-5 h-5 text-orange-400" />
          Filosofi anomalisaham
        </h2>
        <GlassCard hover={false} className="!p-6">
          <div className="space-y-5">
            <p className="text-sm text-silver-300 leading-relaxed">
              anomalisaham dibangun dari gagasan bahwa peluang sering muncul saat pergerakan harga terlihat{" "}
              <span className="text-orange-400 font-semibold">
                tidak menarik di permukaan, tetapi janggal di balik volume dan struktur harga
              </span>
              . Yang dicari bukan saham yang sudah jelas dan telanjur ramai, melainkan fase ketika support
              terlihat dijaga, range sideways tetap rapi, tekanan jual tidak terlalu dalam, tetapi jejak
              akumulasi justru mulai muncul.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <IconChart className="w-5 h-5 text-orange-400" />
                  <h3 className="text-sm font-bold text-silver-200">Anomali dari Ketidaksinkronan</h3>
                </div>
                <div className="space-y-2">
                  <Bullet>Harga terlihat sepi, tetapi support tetap dipelihara dan volume tidak lepas</Bullet>
                  <Bullet>Ketidaksinkronan antara chart membosankan dan jejak akumulasi adalah anomali</Bullet>
                </div>
              </div>

              <div className="p-4 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <IconTarget className="w-5 h-5 text-green-400" />
                  <h3 className="text-sm font-bold text-silver-200">Jejak Smart Money</h3>
                </div>
                <div className="space-y-2">
                  <Bullet>Sideways bukan selalu lemah—kadang area parkir sebelum markup</Bullet>
                  <Bullet>Fokus pada support lock, sideways senyap, reclaim awal, markup dini</Bullet>
                </div>
              </div>

              <div className="p-4 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <IconShield className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-silver-200">Disiplin Tetap Utama</h3>
                </div>
                <div className="space-y-2">
                  <Bullet>Sinyal menarik bukan alasan masuk serampangan</Bullet>
                  <Bullet>Support, invalidasi, dan risk/reward harus dihitung dulu</Bullet>
                </div>
              </div>

              <div className="p-4 rounded-xl" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <IconUser className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-silver-200">Belajar Sebelum Ramai</h3>
                </div>
                <div className="space-y-2">
                  <Bullet>Watchlist dan AI brief untuk menyaring saham dengan alasan gerak</Bullet>
                  <Bullet>Pemula belajar membaca fase, area, dan jejak operator dulu</Bullet>
                </div>
              </div>
            </div>

            <InfoBox type="success">
              <strong>Intinya:</strong> anomalisaham membantu Anda membaca pasar dengan urutan yang lebih sehat—
              lihat konteks besar dulu, cari anomali struktur dan akumulasi, tentukan skenario, lalu ambil
              keputusan dengan sadar risiko.
            </InfoBox>
          </div>
        </GlassCard>
      </section>

      {/* Features Section */}
      <section id="fitur" className="scroll-mt-24">
        <h2 className="text-xl font-bold text-silver-100 mb-4 flex items-center gap-2">
          <IconTools className="w-5 h-5 text-orange-400" />
          Fitur Utama
        </h2>
        <div className="space-y-4">
          <CollapsibleSection
            title="Dashboard - Ringkasan Pasar"
            icon={<IconHome className="w-5 h-5 text-orange-400" />}
            defaultOpen={true}
          >
            <Bullet>IHSG chart dengan berbagai timeframe dan statistik harga lengkap</Bullet>
            <Bullet>Global Markets: S&P 500, Nasdaq, VIX, Nikkei, Hang Seng, KOSPI</Bullet>
            <Bullet>Artikel pilihan dan berita pasar terkini untuk sentimen harian</Bullet>
            <Bullet>Kandidat saham populer sebagai ide riset awal</Bullet>
          </CollapsibleSection>

          <CollapsibleSection
            title="Cari Saham - Pusat Riset IDX"
            icon={<IconSearch className="w-5 h-5 text-orange-400" />}
          >
            <Bullet>Pencarian cepat dengan kode ticker atau nama perusahaan</Bullet>
            <Bullet>Chart candlestick dan line dengan timeframe intraday hingga swing</Bullet>
            <Bullet>Technical signals: RSI, MACD, moving average, support/resistance</Bullet>
            <Bullet>Data fundamental: valuasi, profitabilitas, kepemilikan, rekomendasi analis</Bullet>
            <Bullet>Berita emiten yang difilter sesuai ticker</Bullet>
          </CollapsibleSection>

          <CollapsibleSection
            title="Watchlist - Monitoring Saham Pilihan"
            icon={<IconWatchlist className="w-5 h-5 text-orange-400" />}
          >
            <Bullet>Daftar saham yang dipantau sistem/admin dengan TP dan SL</Bullet>
            <Bullet>Catatan bandarmology untuk setiap saham</Bullet>
            <Bullet>Sorting berdasarkan nama, perubahan persen, atau harga</Bullet>
            <Bullet>Monitoring real-time untuk saham dalam radar</Bullet>
          </CollapsibleSection>

          <CollapsibleSection
            title="Investor Tools - Alat Bantu Keputusan"
            icon={<IconTools className="w-5 h-5 text-orange-400" />}
          >
            <Bullet><strong>AI Stock Brief:</strong> Ringkasan cepat saham berdasarkan teknikal, berita, dan setup</Bullet>
            <Bullet><strong>Risk Calculator:</strong> Hitung posisi, profit/loss potensial, dan risk/reward ratio</Bullet>
            <Bullet><strong>Right Issue Calculator:</strong> Dampak HMETD terhadap jumlah saham dan average price</Bullet>
            <Bullet><strong>Stock Split Calculator:</strong> Jumlah saham dan harga teoritis setelah split</Bullet>
          </CollapsibleSection>

          <CollapsibleSection
            title="Simulasi Trading - Belajar Money Management"
            icon={<IconClock className="w-5 h-5 text-orange-400" />}
          >
            <Bullet>Simulasi interaktif untuk average down, average up, pyramiding</Bullet>
            <Bullet>Pemahaman cut loss dan dampak manajemen modal</Bullet>
            <Bullet>Cocok untuk pemula yang belajar membagi modal dan memahami risiko</Bullet>
          </CollapsibleSection>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="scroll-mt-24">
        <h2 className="text-xl font-bold text-silver-100 mb-4 flex items-center gap-2">
          <IconTarget className="w-5 h-5 text-orange-400" />
          Workflow Harian yang Disarankan
        </h2>
        <GlassCard hover={false} className="!p-6">
          <div className="space-y-6">
            <StepCard
              num={1}
              title="Lihat Konteks Pasar Dulu"
              desc="Mulai dari Dashboard. Cek IHSG, sentimen global, berita pasar. Jangan langsung fokus ke satu saham."
              icon={<IconHome className="w-4 h-4" />}
            />
            <StepCard
              num={2}
              title="Pilih Saham untuk Diamati"
              desc="Masuk ke Cari Saham, riset ticker yang menarik. Periksa harga, chart, fundamental, technical signal, dan berita."
              icon={<IconSearch className="w-4 h-4" />}
            />
            <StepCard
              num={3}
              title="Cari Anomali yang Masuk Akal"
              desc="Perhatikan support yang dijaga, range tenang, volume turun tidak agresif, atau tanda akumulasi tersembunyi."
              icon={<IconChart className="w-4 h-4" />}
            />
            <StepCard
              num={4}
              title="Tentukan Skenario Risiko"
              desc="Gunakan Risk Calculator untuk mengetahui batas rugi, target, dan rasio risk/reward sebelum entry."
              icon={<IconShield className="w-4 h-4" />}
            />
            <StepCard
              num={5}
              title="Monitor Saham di Radar"
              desc="Gunakan Watchlist untuk memantau saham pilihan. Perhatikan pergerakan menuju TP, SL, atau level kritis."
              icon={<IconWatchlist className="w-4 h-4" />}
            />
          </div>
        </GlassCard>
      </section>

      {/* Tips Section */}
      <section id="tips" className="scroll-mt-24">
        <h2 className="text-xl font-bold text-silver-100 mb-4 flex items-center gap-2">
          <IconLightbulb className="w-5 h-5 text-orange-400" />
          Tips & Kesalahan Umum
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-green-400 flex items-center gap-2">
              <IconCheck className="w-4 h-4" />
              Yang Harus Dilakukan
            </h3>
            <div className="space-y-3">
              <InfoBox type="success">
                <strong>Lihat konteks lengkap:</strong> Jangan hanya fokus satu indikator. Gabungkan berita, support/resistance, volume, dan sentimen pasar.
              </InfoBox>
              <InfoBox type="success">
                <strong>Selalu ada skenario risiko:</strong> Tahu area cut loss dan target profit sebelum entry. Gunakan Risk Calculator jika perlu.
              </InfoBox>
              <InfoBox type="success">
                <strong>Gunakan timeframe yang tepat:</strong> 1D untuk pemula, 1h-4h untuk swing pendek, 5m-15m untuk intraday.
              </InfoBox>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <IconWarning className="w-4 h-4" />
              Kesalahan yang Harus Dihindari
            </h3>
            <div className="space-y-3">
              <InfoBox type="warning">
                <strong>Terlalu fokus satu sinyal:</strong> Label BUY/SELL hanya rangkuman mesin. Tetap perlu konfirmasi dari berbagai sumber.
              </InfoBox>
              <InfoBox type="warning">
                <strong>Masuk tanpa skenario:</strong> Ini penyebab utama akun cepat rusak. Selalu tahu di mana cut loss dan target.
              </InfoBox>
              <InfoBox type="warning">
                <strong>Watchlist = sinyal instan:</strong> Watchlist adalah alat monitoring, bukan jaminan harus beli sekarang.
              </InfoBox>
            </div>
          </div>
        </div>

        {/* Timeframe Guide */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-silver-200 mb-3">Panduan Timeframe untuk Pemula</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs glass-card !p-4">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(226,232,240,0.08)" }}>
                  <th className="text-left pb-2 pr-4 text-[10px] uppercase tracking-wider text-silver-500">Timeframe</th>
                  <th className="text-left pb-2 pr-4 text-[10px] uppercase tracking-wider text-silver-500">Cocok Untuk</th>
                  <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-silver-500">Penjelasan</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { tf: "5m - 15m", use: "Trader intraday", desc: "Pergerakan cepat dalam hari yang sama. Lebih sensitif terhadap noise." },
                  { tf: "1h - 4h", use: "Swing pendek", desc: "Setup beberapa hari sampai beberapa minggu." },
                  { tf: "1D", use: "Swing umum", desc: "Paling aman untuk pemula karena lebih jelas membaca trend utama." },
                  { tf: "1W", use: "Positional", desc: "Trend besar dan level penting jangka menengah." },
                  { tf: "1M", use: "Big picture", desc: "Area support/resistance besar dan siklus panjang." },
                ].map((row) => (
                  <tr key={row.tf} style={{ borderBottom: "1px solid rgba(226,232,240,0.04)" }}>
                    <td className="py-2 pr-4 text-silver-200 font-semibold">{row.tf}</td>
                    <td className="py-2 pr-4 text-silver-300">{row.use}</td>
                    <td className="py-2 text-silver-400 leading-relaxed">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="glass-card !p-5">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <IconWarning className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Disclaimer</p>
            <p className="text-xs text-silver-400 leading-relaxed">
              anomalisaham adalah alat bantu analisis dan pembelajaran. Semua data, ringkasan, chart, sinyal
              teknikal, berita, watchlist, dan catatan bandarmology di aplikasi ini{" "}
              <strong className="text-silver-300">bukan rekomendasi beli atau jual</strong>. Gunakan aplikasi
              ini untuk membantu proses berpikir, lalu tetap lakukan riset mandiri sebelum mengambil keputusan
              investasi atau trading.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all glass-button"
        >
          <IconHome className="w-4 h-4" />
          Kembali ke Dashboard
        </Link>
        <Link
          href={isMember ? "/search" : "/login"}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "rgba(16,185,129,0.12)",
            color: "#6ee7b7",
            border: "1px solid rgba(16,185,129,0.2)",
          }}
        >
          <IconSearch className="w-4 h-4" />
          {isMember ? "Mulai Cari Saham" : "Login untuk Akses Member"}
        </Link>
        <Link
          href={isAdmin ? "/admin" : "/simulation"}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "rgba(59,130,246,0.12)",
            color: "#60a5fa",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          {isAdmin ? <IconTools className="w-4 h-4" /> : <IconPlay className="w-4 h-4" />}
          {isAdmin ? "Buka Admin Panel" : "Belajar via Simulasi"}
        </Link>
      </div>
    </div>
  );
}

// Made with Bob
