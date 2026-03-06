"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/AuthProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const STATUS_CONFIG = {
  pending: {
    icon: (
      <svg className="w-10 h-10" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "#fb923c",
    bg: "rgba(251,146,60,0.1)",
    border: "rgba(251,146,60,0.25)",
    title: "Menunggu Konfirmasi Pembayaran",
    desc: "Pendaftaran Anda berhasil. Tim kami akan memverifikasi pembayaran Anda dan mengaktifkan akses dalam 1×24 jam.",
  },
  expired: {
    icon: (
      <svg className="w-10 h-10" style={{ color: "#64748b" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "#64748b",
    bg: "rgba(100,116,139,0.1)",
    border: "rgba(100,116,139,0.25)",
    title: "Membership Anda Telah Berakhir",
    desc: "Masa berlaku membership Anda sudah habis. Silakan hubungi admin untuk memperpanjang membership.",
  },
  rejected: {
    icon: (
      <svg className="w-10 h-10" style={{ color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    title: "Pembayaran Ditolak",
    desc: "Pembayaran Anda tidak dapat dikonfirmasi. Silakan hubungi admin untuk informasi lebih lanjut.",
  },
  suspended: {
    icon: (
      <svg className="w-10 h-10" style={{ color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    title: "Akun Anda Ditangguhkan",
    desc: "Akun Anda telah ditangguhkan oleh admin. Silakan hubungi kami untuk informasi lebih lanjut.",
  },
};

interface PaymentMethod {
  name: string;
  type: "bank" | "emoney";
  accountNumber: string;
  accountName: string;
}

interface Settings {
  membershipPrices: { "3months": number; "6months": number; "1year": number };
  paymentMethods: PaymentMethod[];
}

const DURATION_LABEL: Record<string, string> = {
  "3months": "3 Bulan",
  "6months": "6 Bulan",
  "1year": "1 Tahun",
};

export default function PendingPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.membershipStatus === "active") router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const status = (user.membershipStatus || "pending") as keyof typeof STATUS_CONFIG;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isPending = status === "pending";

  // Find price for user's chosen duration
  const duration = (user as unknown as { membershipDuration?: string }).membershipDuration;
  const price = settings?.membershipPrices?.[duration as keyof typeof settings.membershipPrices];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-10 space-y-6 max-w-lg mx-auto">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-2">
        <Image src="/logo-CS.png" alt="Cerita Saham" width={44} height={44} className="rounded-full" />
        <span className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair), Georgia, serif", color: "#e2e8f0" }}>
          Cerita <span style={{ background: "linear-gradient(135deg,#D4AF37,#F5D876,#B8860B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontStyle: "italic" }}>Saham</span>
        </span>
      </div>

      {/* Status Card */}
      <div className="w-full rounded-2xl p-6 text-center space-y-3"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <div className="flex justify-center">{cfg.icon}</div>
        <h2 className="text-lg font-bold" style={{ color: cfg.color }}>{cfg.title}</h2>
        <p className="text-sm" style={{ color: "#94a3b8" }}>{cfg.desc}</p>
      </div>

      {/* Payment Instructions — only show for pending */}
      {isPending && settings && (
        <div className="w-full space-y-4">
          {/* Membership info */}
          <div className="rounded-2xl p-4 space-y-2"
            style={{ background: "rgba(6,20,14,0.85)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Detail Pesanan</p>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "#94a3b8" }}>Paket</span>
              <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
                {duration ? DURATION_LABEL[duration] || duration : "-"}
              </span>
            </div>
            {price && (
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: "#94a3b8" }}>Total Bayar</span>
                <span className="text-base font-bold" style={{ color: "#10b981" }}>
                  Rp {price.toLocaleString("id-ID")}
                </span>
              </div>
            )}
          </div>

          {/* Payment methods */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(6,20,14,0.85)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Cara Pembayaran</p>
            <p className="text-xs" style={{ color: "#64748b" }}>Transfer sejumlah yang tertera ke salah satu rekening / e-wallet berikut:</p>

            {settings.paymentMethods.map((pm, i) => (
              <div key={i} className="rounded-xl p-3 flex items-center justify-between gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.07)" }}>
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: pm.type === "emoney" ? "rgba(139,92,246,0.15)" : "rgba(16,185,129,0.12)", color: pm.type === "emoney" ? "#a78bfa" : "#10b981" }}>
                    {pm.name.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "#e2e8f0" }}>{pm.name}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: "#cbd5e1" }}>{pm.accountNumber}</p>
                    <p className="text-[11px]" style={{ color: "#64748b" }}>a.n. {pm.accountName}</p>
                  </div>
                </div>
                <button
                  onClick={() => copy(pm.accountNumber, `${i}`)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex-shrink-0"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: copied === `${i}` ? "#10b981" : "#64748b" }}>
                  {copied === `${i}` ? "✓ Disalin" : "Salin"}
                </button>
              </div>
            ))}

            <div className="rounded-xl p-3 flex gap-2"
              style={{ background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.15)" }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#fb923c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] leading-relaxed" style={{ color: "#94a3b8" }}>
                Setelah transfer, konfirmasi pembayaran via WhatsApp dengan menyertakan <strong>bukti transfer</strong> dan <strong>email</strong> yang didaftarkan. Akses akan diaktifkan dalam <strong>1×24 jam</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full flex flex-col gap-2">
        <Link href="/"
          className="w-full text-center py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
          ← Kembali ke Dashboard
        </Link>
        <button onClick={logout}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171" }}>
          Keluar
        </button>
      </div>
    </div>
  );
}

