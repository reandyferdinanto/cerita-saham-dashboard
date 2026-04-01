"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { useAuth } from "@/components/ui/AuthProvider";

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

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
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

function HighlightTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 py-4 mb-4"
      style={{
        background: "linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(120,53,15,0.18) 45%, rgba(6,20,14,0.82) 100%)",
        border: "1px solid rgba(249,115,22,0.28)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
      }}
    >
      <div
        className="absolute -top-10 -right-6 w-28 h-28 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #fb923c 0%, transparent 70%)" }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.18)", border: "1px solid rgba(249,115,22,0.28)", color: "#fb923c" }}
        >
          {icon}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-orange-300/80 font-bold">Nilai Utama</p>
          <h2 className="text-lg sm:text-xl font-extrabold text-silver-100">{children}</h2>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <GlassCard hover={false} className="!p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-silver-200">{title}</h3>
          {subtitle ? <p className="text-[11px] text-silver-500 mt-1">{subtitle}</p> : null}
        </div>
      </div>
      <div className="space-y-2 text-xs leading-relaxed text-silver-400">{children}</div>
    </GlassCard>
  );
}

function StepRow({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }}>
        {num}
      </div>
      <div>
        <p className="text-sm font-semibold text-silver-200">{title}</p>
        <p className="text-xs text-silver-500 mt-1 leading-relaxed">{desc}</p>
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

export default function GuidancePage() {
  const { user } = useAuth();
  const isMember = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center gap-1.5 text-sm">
        <Link href="/" className="text-silver-500 hover:text-orange-400 transition-colors flex items-center gap-1">
          <IconHome className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <IconChevronRight className="w-3 h-3 text-silver-600" />
        <span className="text-silver-300">Panduan</span>
      </div>

      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-8" style={{ background: "linear-gradient(135deg, rgba(6,78,59,0.5) 0%, rgba(6,20,14,0.82) 60%, rgba(120,53,15,0.28) 100%)", border: "1px solid rgba(249,115,22,0.15)" }}>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #fb923c 0%, transparent 70%)" }} />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }} />

        <div className="relative z-10 max-w-4xl">
          <span className="inline-flex text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.25)" }}>
            Panduan Pengguna Cerita Saham
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold text-silver-100 leading-tight">Panduan Lengkap untuk Pengguna Baru</h1>
          <p className="text-sm sm:text-base text-silver-400 leading-relaxed mt-3 max-w-3xl">
            Halaman ini menjelaskan cara memakai Cerita Saham dari awal, mulai dari login dan membership,
            membaca dashboard, mencari saham, memahami watchlist, memakai investor tools, sampai membaca
            sinyal teknikal dan catatan bandarmology dengan cara yang sederhana.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            {[
              { label: "Untuk pemula", sub: "Jelaskan fungsi menu satu per satu", icon: <IconUser className="w-4 h-4 text-orange-400" /> },
              { label: "Sesuai aplikasi", sub: "Panduan ini mengikuti fitur yang benar-benar ada", icon: <IconGuide className="w-4 h-4 text-orange-400" /> },
              { label: "Fokus praktik", sub: "Bukan teori saja, tapi alur pemakaian harian", icon: <IconChart className="w-4 h-4 text-orange-400" /> },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(6,20,14,0.46)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)" }}>
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

      <div>
        <HighlightTitle icon={<IconGuide className="w-5 h-5" />}>Filosofi Cerita Saham</HighlightTitle>
        <GlassCard hover={false} className="!p-5 sm:!p-6">
          <div className="space-y-4">
            <p className="text-sm text-silver-300 leading-relaxed">
              Cerita Saham dibangun dengan gagasan bahwa membaca saham bukan hanya melihat angka, tetapi
              memahami <span className="text-orange-400 font-semibold">cerita di balik pergerakan harga</span>.
              Harga bergerak karena ada kombinasi sentimen, kondisi pasar, perilaku pelaku pasar, berita,
              ekspektasi, dan reaksi terhadap level teknikal. Karena itu aplikasi ini tidak dirancang untuk
              memberi sinyal instan semata, tetapi untuk membantu Anda menyusun konteks sebelum mengambil keputusan.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeatureCard icon={<IconChart className="w-5 h-5 text-orange-400" />} title="Harga adalah cerita, bukan angka tunggal">
                <Bullet>Pergerakan harga dilihat bersama chart, support, resistance, dan perubahan momentum.</Bullet>
                <Bullet>Tujuannya agar user tidak terpaku pada satu candle atau satu warna merah-hijau saja.</Bullet>
              </FeatureCard>

              <FeatureCard icon={<IconSearch className="w-5 h-5 text-orange-400" />} title="Analisis harus punya konteks">
                <Bullet>Satu saham tidak dibaca sendirian. Kondisi IHSG, sentimen global, dan berita emiten ikut memengaruhi pembacaan.</Bullet>
                <Bullet>Karena itu dashboard, berita, technical signal, dan detail saham saling melengkapi.</Bullet>
              </FeatureCard>

              <FeatureCard icon={<IconShield className="w-5 h-5 text-orange-400" />} title="Risiko datang sebelum profit">
                <Bullet>Filosofi aplikasi ini menempatkan manajemen risiko sebagai langkah awal, bukan tambahan belakangan.</Bullet>
                <Bullet>Sebelum memikirkan target profit, user didorong menentukan area salah, batas rugi, dan ukuran posisi.</Bullet>
              </FeatureCard>

              <FeatureCard icon={<IconUser className="w-5 h-5 text-orange-400" />} title="Belajar berpikir, bukan sekadar ikut sinyal">
                <Bullet>Watchlist, AI brief, dan technical signal adalah alat bantu membaca situasi, bukan pengganti keputusan pribadi.</Bullet>
                <Bullet>Pemula diharapkan pelan-pelan membangun proses analisis sendiri dengan bantuan fitur yang ada.</Bullet>
              </FeatureCard>
            </div>

            <p className="text-xs text-silver-500 leading-relaxed">
              Intinya, Cerita Saham ingin membantu Anda lebih disiplin membaca pasar: lihat gambaran besar dulu,
              pahami cerita sahamnya, tentukan skenario, lalu ambil keputusan dengan sadar risiko.
            </p>
          </div>
        </GlassCard>
      </div>

      <div>
        <SectionTitle icon={<IconShield className="w-4 h-4" />}>Akses dan Hak Fitur</SectionTitle>
        <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
          <FeatureCard icon={<IconHome className="w-5 h-5 text-orange-400" />} title="Tanpa Login" subtitle="Bisa dibuka semua pengunjung">
            <Bullet>Dashboard utama untuk melihat IHSG, indeks global, berita pasar, dan artikel publik.</Bullet>
            <Bullet>Halaman login, register, dan artikel publik juga bisa diakses tanpa akun.</Bullet>
            <Bullet>Menu seperti Cari Saham, Watchlist, Tools, dan Panduan akan meminta login/member aktif.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconUser className="w-5 h-5 text-green-400" />} title="Member Aktif" subtitle="Akses fitur analisis utama">
            <Bullet>Setelah login dan membership aktif, Anda bisa membuka Cari Saham, Watchlist, Panduan, dan Stock Detail.</Bullet>
            <Bullet>Investor Tools juga tersedia untuk member, tergantung pengaturan yang diaktifkan admin.</Bullet>
            <Bullet>Jika membership belum aktif, expired, ditolak, atau suspended, Anda akan diarahkan ke halaman pending/status.</Bullet>
          </FeatureCard>

          {isAdmin ? (
            <FeatureCard icon={<IconTools className="w-5 h-5 text-orange-400" />} title="Admin" subtitle="Untuk pengelolaan konten aplikasi">
              <Bullet>Admin dapat menambah saham ke watchlist, mengatur TP/SL, dan menulis catatan bandarmology.</Bullet>
              <Bullet>Admin juga bisa membuat artikel, mengembangkan draft dengan AI, dan mengelola member.</Bullet>
              <Bullet>Superadmin memiliki akses paling tinggi untuk manajemen user dan peran.</Bullet>
            </FeatureCard>
          ) : null}
        </div>
      </div>

      <div>
        <SectionTitle icon={<IconClock className="w-4 h-4" />}>Langkah Awal untuk Pengguna Baru</SectionTitle>
        <GlassCard hover={false} className="!p-5 sm:!p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <StepRow num={1} title="Buka dashboard dulu" desc="Mulailah dari halaman utama untuk melihat kondisi pasar secara umum: IHSG, indeks global, berita, dan artikel terbaru." />
              <StepRow num={2} title="Daftar akun jika ingin akses fitur member" desc="Gunakan halaman register, pilih durasi membership, lalu ikuti instruksi pembayaran. Setelah itu status Anda akan menunggu verifikasi." />
              <StepRow num={3} title="Cek status membership" desc="Jika akun belum aktif, halaman pending akan menunjukkan apakah status Anda pending, expired, rejected, atau suspended." />
              <StepRow num={4} title="Masuk ke akun" desc="Login memakai email dan nomor telepon yang didaftarkan. Jika membership aktif, Anda akan bisa membuka halaman analisis member." />
            </div>
            <div className="space-y-4">
              <StepRow num={5} title="Pakai Cari Saham untuk riset" desc="Cari saham berdasarkan kode atau nama emiten. Dari sini Anda bisa membaca chart, fundamental, berita emiten, dan sinyal teknikal." />
              <StepRow num={6} title="Gunakan Watchlist untuk monitoring" desc="Watchlist dipakai untuk memantau saham yang sudah dipilih, lengkap dengan TP, SL, dan catatan bandarmology." />
              <StepRow num={7} title="Gunakan Investor Tools untuk simulasi keputusan" desc="AI Brief, Risk Calculator, Right Issue Calculator, dan Stock Split Calculator membantu Anda memahami skenario sebelum mengambil keputusan." />
              <StepRow num={8} title="Baca Panduan dan Simulasi" desc="Halaman Panduan menjelaskan cara memakai fitur. Halaman Simulasi membantu memahami average down, average up, pyramiding, dan money management." />
            </div>
          </div>
        </GlassCard>
      </div>

      <div>
        <SectionTitle icon={<IconHome className="w-4 h-4" />}>Menu dan Fungsi Halaman</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard icon={<IconHome className="w-5 h-5 text-orange-400" />} title="Dashboard" subtitle="Ringkasan kondisi pasar">
            <Bullet>Menampilkan IHSG atau Jakarta Composite Index sebagai gambaran pasar Indonesia secara umum.</Bullet>
            <Bullet>Ada chart IHSG dengan beberapa timeframe, card statistik, dan informasi harga seperti open, high, low, dan volume.</Bullet>
            <Bullet>Bagian Global Markets membantu melihat konteks luar negeri seperti S&amp;P 500, Nasdaq, VIX, Nikkei, Hang Seng, dan KOSPI.</Bullet>
            <Bullet>Di bawahnya ada artikel pilihan dan berita pasar terkini untuk membantu memahami sentimen harian.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconSearch className="w-5 h-5 text-orange-400" />} title="Cari Saham" subtitle="Pusat riset saham IDX">
            <Bullet>Ketik kode saham seperti <code>BBCA</code> atau nama perusahaan, lalu pilih hasil yang muncul.</Bullet>
            <Bullet>Setelah saham dipilih, Anda akan melihat harga live, chart, fundamental, berita terkait, dan technical signal.</Bullet>
            <Bullet>Timeframe tersedia dari intraday sampai swing agar cocok untuk trader harian maupun swing trader.</Bullet>
            <Bullet>Halaman ini juga menampilkan saham populer/top gainer yang bisa dijadikan ide riset awal.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconWatchlist className="w-5 h-5 text-orange-400" />} title="Watchlist" subtitle="Halaman pemantauan saham pilihan">
            <Bullet>Watchlist berisi daftar saham yang sedang dipantau oleh sistem/admin, bukan tempat semua user menambah saham sendiri.</Bullet>
            <Bullet>Setiap kartu bisa memuat harga, perubahan, TP, SL, dan catatan bandarmology.</Bullet>
            <Bullet>Anda bisa mengurutkan daftar berdasarkan nama, perubahan persen, atau harga untuk memudahkan monitoring.</Bullet>
            <Bullet>Jika watchlist kosong, biasanya artinya admin belum menambahkan saham ke daftar pantauan.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconChart className="w-5 h-5 text-orange-400" />} title="Halaman Detail Saham" subtitle="Fokus pada satu ticker">
            <Bullet>Halaman ini membuka chart candlestick yang lebih fokus pada satu saham, lengkap dengan overlay TP dan SL jika saham itu ada di watchlist.</Bullet>
            <Bullet>Anda juga bisa membaca nama emiten, statistik harga, market cap, dan catatan bandarmology jika tersedia.</Bullet>
            <Bullet>Cocok dipakai saat Anda sudah tahu ticker yang ingin diperhatikan secara lebih dalam.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconTools className="w-5 h-5 text-orange-400" />} title="Investor Tools" subtitle="Alat bantu keputusan">
            <Bullet><code>AI Stock Brief</code> membuat ringkasan cepat mengenai saham tertentu berdasarkan harga, konteks teknikal, dan berita.</Bullet>
            <Bullet><code>Risk Calculator</code> menghitung nilai posisi, profit potensial, loss maksimal, serta rasio risk/reward berdasarkan lots, entry, TP, dan SL.</Bullet>
            <Bullet><code>Right Issue Calculator</code> membantu menghitung dampak HMETD terhadap jumlah saham dan average price baru.</Bullet>
            <Bullet><code>Stock Split Calculator</code> membantu melihat jumlah saham baru dan harga teoritis setelah stock split.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconGuide className="w-5 h-5 text-orange-400" />} title="Panduan" subtitle="Tempat belajar cara pakai aplikasi">
            <Bullet>Halaman ini menjelaskan fungsi fitur, alur penggunaan, istilah yang dipakai aplikasi, dan cara membaca hasil analisis.</Bullet>
            <Bullet>Sangat disarankan dibaca dulu oleh user baru agar tidak salah mengartikan informasi yang muncul di halaman lain.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconClock className="w-5 h-5 text-orange-400" />} title="Simulasi Trading" subtitle="Belajar money management">
            <Bullet>Halaman ini bersifat edukatif dan interaktif, bukan data pasar sungguhan.</Bullet>
            <Bullet>Fokusnya adalah membantu memahami average down, average up, pyramiding, cut loss, dan dampak manajemen modal.</Bullet>
            <Bullet>Sangat bermanfaat untuk pemula yang masih belajar cara membagi modal dan memahami risiko.</Bullet>
          </FeatureCard>
        </div>
      </div>

      <div>
        <SectionTitle icon={<IconSearch className="w-4 h-4" />}>Cara Membaca Halaman Cari Saham</SectionTitle>
        <GlassCard hover={false} className="!p-5 sm:!p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-orange-400">1. Hasil pencarian</h3>
              <Bullet>Ketik kode saham atau nama perusahaan. Sistem akan mengarahkan ke saham IDX dan otomatis mengenali format <code>.JK</code>.</Bullet>
              <Bullet>Pilih saham yang sesuai, lalu panel detail akan terbuka di halaman yang sama.</Bullet>

              <h3 className="text-sm font-bold text-orange-400 pt-2">2. Harga dan perubahan</h3>
              <Bullet>Harga besar di bagian atas menunjukkan harga terakhir.</Bullet>
              <Bullet>Angka hijau atau merah menunjukkan perubahan harga dan persentase dibanding penutupan sebelumnya.</Bullet>

              <h3 className="text-sm font-bold text-orange-400 pt-2">3. Chart</h3>
              <Bullet>Chart candlestick cocok untuk membaca open, high, low, close.</Bullet>
              <Bullet>Chart line cocok untuk melihat bentuk tren dengan lebih sederhana.</Bullet>
              <Bullet>Pilih timeframe sesuai gaya analisis Anda, misalnya <code>5m</code> untuk intraday dan <code>1Y</code> untuk gambaran trend lebih besar.</Bullet>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-orange-400">4. Technical Signal</h3>
              <Bullet>Panel ini merangkum beberapa indikator seperti RSI, MACD, moving average, dan support/resistance.</Bullet>
              <Bullet>Hasil seperti <code>BUY</code>, <code>SELL</code>, atau <code>WAIT</code> adalah rangkuman mesin analisis, bukan sinyal wajib diikuti mentah-mentah.</Bullet>

              <h3 className="text-sm font-bold text-orange-400 pt-2">5. Fundamental</h3>
              <Bullet>Bagian fundamental membantu memahami valuasi, profitabilitas, profil perusahaan, kepemilikan, dan rekomendasi analis jika data tersedia.</Bullet>
              <Bullet>Untuk sebagian saham IDX, data fundamental bisa lebih minim daripada saham US. Itu normal karena sumber data eksternal tidak selalu lengkap.</Bullet>

              <h3 className="text-sm font-bold text-orange-400 pt-2">6. Berita emiten</h3>
              <Bullet>Berita yang muncul difilter agar lebih dekat dengan ticker yang sedang dilihat.</Bullet>
              <Bullet>Gunakan berita untuk memahami sentimen, lalu cocokan lagi dengan chart dan level teknikal.</Bullet>
            </div>
          </div>
        </GlassCard>
      </div>

      <div>
        <SectionTitle icon={<IconTools className="w-4 h-4" />}>Cara Memakai Investor Tools</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard icon={<IconTools className="w-5 h-5 text-orange-400" />} title="AI Stock Brief" subtitle="Untuk ringkasan cepat sebelum riset lebih dalam">
            <Bullet>Masukkan ticker seperti <code>BBCA</code>, lalu sistem akan membuat brief singkat.</Bullet>
            <Bullet>Gunakan hasil brief sebagai titik awal, bukan keputusan akhir.</Bullet>
            <Bullet>Setelah membaca brief, tetap lanjut cek chart, support/resistance, dan berita di halaman Cari Saham.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconShield className="w-5 h-5 text-orange-400" />} title="Risk Calculator" subtitle="Untuk mengukur skenario sebelum entry">
            <Bullet>Isi ticker jika Anda ingin sistem membantu membandingkan target TP/SL dengan support/resistance terdekat.</Bullet>
            <Bullet>Isi lots, harga entry, target price, dan stop loss.</Bullet>
            <Bullet>Hasil utamanya adalah nilai posisi, potensi profit, potensi loss, reward per share, dan rasio risk/reward.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconChart className="w-5 h-5 text-orange-400" />} title="Right Issue Calculator" subtitle="Untuk aksi korporasi penambahan modal">
            <Bullet>Gunakan ketika emiten menerbitkan saham baru melalui rights issue.</Bullet>
            <Bullet>Masukkan jumlah saham lama, average price lama, rasio rights issue, dan harga tebus rights.</Bullet>
            <Bullet>Hasilnya membantu Anda melihat average price baru dan total cost setelah menebus hak.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconClock className="w-5 h-5 text-orange-400" />} title="Stock Split Calculator" subtitle="Untuk memahami efek pemecahan saham">
            <Bullet>Masukkan jumlah saham sebelum split, harga sebelum split, dan rasio split.</Bullet>
            <Bullet>Hasil menunjukkan jumlah saham setelah split dan harga teoritis baru.</Bullet>
            <Bullet>Nilai portofolio secara teori tidak berubah, yang berubah adalah pembagian unit saham dan harga per lembar.</Bullet>
          </FeatureCard>
        </div>
      </div>

      <div>
        <SectionTitle icon={<IconGuide className="w-4 h-4" />}>Workflow Harian yang Disarankan</SectionTitle>
        <GlassCard hover={false} className="!p-5 sm:!p-6">
          <div className="space-y-4">
            <StepRow num={1} title="Lihat pasar dulu, jangan langsung entry" desc="Mulai dari Dashboard. Lihat apakah IHSG sedang menguat, melemah, atau sideway. Cek juga berita pasar dan sentimen global." />
            <StepRow num={2} title="Pilih saham yang ingin diamati" desc="Masuk ke Cari Saham, cari ticker yang Anda minati, lalu periksa harga, chart, fundamental, technical signal, dan berita emitennya." />
            <StepRow num={3} title="Tentukan skenario sebelum transaksi" desc="Gunakan Investor Tools, terutama Risk Calculator, untuk mengetahui batas rugi, target, dan rasio risk/reward." />
            <StepRow num={4} title="Pantau saham yang sudah masuk radar" desc="Gunakan Watchlist untuk memonitor saham yang sudah dipilih. Perhatikan apakah harga mendekati TP, SL, support, atau resistance." />
            <StepRow num={5} title="Evaluasi, jangan hanya menghafal sinyal" desc="Cocokkan sinyal teknikal dengan volume, sentimen berita, dan konteks pasar secara umum. Tujuannya adalah membentuk proses berpikir, bukan bergantung ke satu indikator." />
          </div>
        </GlassCard>
      </div>

      <div>
        <SectionTitle icon={<IconChart className="w-4 h-4" />}>Panduan Timeframe untuk Pemula</SectionTitle>
        <GlassCard hover={false} className="!p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(226,232,240,0.08)" }}>
                  {["Timeframe", "Cocok Untuk", "Penjelasan Sederhana"].map((h) => (
                    <th key={h} className="text-left pb-2 pr-4 text-[10px] uppercase tracking-wider" style={{ color: "#475569" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { tf: "5m - 15m", use: "Trader intraday", desc: "Untuk membaca pergerakan cepat dalam hari yang sama. Lebih sensitif terhadap noise." },
                  { tf: "1h - 4h", use: "Swing pendek", desc: "Bagus untuk melihat setup beberapa hari sampai beberapa minggu." },
                  { tf: "1D", use: "Swing umum", desc: "Biasanya timeframe paling aman untuk pemula karena lebih jelas membaca trend utama." },
                  { tf: "1W", use: "Positional", desc: "Dipakai untuk melihat trend besar dan level penting jangka menengah." },
                  { tf: "1M", use: "Big picture", desc: "Dipakai untuk memahami area support/resistance besar dan siklus yang lebih panjang." },
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
        </GlassCard>
      </div>

      <div>
        <SectionTitle icon={<IconWarning className="w-4 h-4" />}>Kesalahan Umum Pemula</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard icon={<IconWarning className="w-5 h-5 text-red-400" />} title="Terlalu fokus ke satu indikator" subtitle="Padahal aplikasi menyediakan konteks yang lebih lengkap">
            <Bullet>Jangan hanya lihat satu label <code>BUY</code> atau <code>SELL</code>. Lihat juga berita, support/resistance, volume, dan konteks pasar.</Bullet>
            <Bullet>Semakin banyak konfirmasi yang saling mendukung, semakin baik kualitas analisis Anda.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconWarning className="w-5 h-5 text-red-400" />} title="Masuk tanpa skenario risiko" subtitle="Ini yang paling sering membuat akun cepat rusak">
            <Bullet>Selalu tahu di mana area cut loss dan target profit sebelum entry.</Bullet>
            <Bullet>Jika belum tahu, gunakan Risk Calculator dulu sebelum mengambil keputusan.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconWarning className="w-5 h-5 text-red-400" />} title="Menganggap watchlist sebagai sinyal instan" subtitle="Padahal watchlist adalah alat monitoring">
            <Bullet>Watchlist membantu memantau saham yang sedang diamati, bukan jaminan bahwa saham itu harus dibeli sekarang.</Bullet>
            <Bullet>Gunakan watchlist sebagai radar, lalu tetap lakukan pengecekan ulang di halaman Cari Saham atau Detail Saham.</Bullet>
          </FeatureCard>

          <FeatureCard icon={<IconWarning className="w-5 h-5 text-red-400" />} title="Tidak sabar membaca konteks pasar" subtitle="Sering langsung fokus ke satu saham">
            <Bullet>Biasakan cek IHSG dan sentimen berita dulu. Kadang saham bagus tetap tertahan jika pasar sedang buruk secara umum.</Bullet>
            <Bullet>Dashboard membantu Anda melihat gambaran besar sebelum masuk ke analisis per saham.</Bullet>
          </FeatureCard>
        </div>
      </div>

      <GlassCard hover={false} className="!p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <IconWarning className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Disclaimer</p>
            <p className="text-xs text-silver-400 leading-relaxed">
              Cerita Saham adalah alat bantu analisis dan pembelajaran. Semua data, ringkasan, chart, sinyal teknikal,
              berita, watchlist, dan catatan bandarmology di aplikasi ini <strong className="text-silver-300">bukan
              rekomendasi beli atau jual</strong>. Gunakan aplikasi ini untuk membantu proses berpikir, lalu tetap
              lakukan riset mandiri sebelum mengambil keputusan investasi atau trading.
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }}>
          <IconHome className="w-4 h-4" />
          Kembali ke Dashboard
        </Link>
        <Link href={isMember ? "/search" : "/login"} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
          <IconSearch className="w-4 h-4" />
          {isMember ? "Mulai Cari Saham" : "Login untuk Akses Member"}
        </Link>
        <Link href={isAdmin ? "/admin" : "/simulation"} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
          {isAdmin ? <IconTools className="w-4 h-4" /> : <IconClock className="w-4 h-4" />}
          {isAdmin ? "Buka Admin Panel" : "Belajar via Simulasi"}
        </Link>
      </div>
    </div>
  );
}




