"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/ui/AuthProvider";
import BrandMark from "@/components/ui/BrandMark";

interface Settings {
  membershipPrices: { "3months": number; "6months": number; "1year": number };
  paymentMethods: { name: string; type: string; accountNumber: string; accountName: string }[];
}

const DURATIONS = [
  { key: "3months", label: "3 Bulan",  sublabel: "Cocok untuk coba" },
  { key: "6months", label: "6 Bulan",  sublabel: "Paling populer",  badge: "POPULER" },
  { key: "1year",   label: "1 Tahun",  sublabel: "Hemat maksimal",  badge: "HEMAT" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();

  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [name,  setName]        = useState("");
  const [duration, setDuration] = useState("3months");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!loading && user) {
      if (user.membershipStatus === "active") router.replace("/");
      else router.replace("/pending");
    }
  }, [user, loading, router]);

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json()).then(setSettings).catch(() => {});
  }, []);

  const selectedPrice = settings?.membershipPrices?.[duration as keyof typeof settings.membershipPrices];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, name, membershipDuration: duration }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Pendaftaran gagal"); return; }
      await refresh();
      router.replace("/pending");
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <BrandMark size="md" align="center" subtitle="daftar untuk membuka radar akumulasi" />
          <p className="text-sm text-center" style={{ color: "#64748b" }}>Pilih paket, daftar, dan transfer sesuai nominal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duration selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>Pilih Durasi Membership *</label>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => {
                const price = settings?.membershipPrices?.[d.key as keyof typeof settings.membershipPrices];
                const isActive = duration === d.key;
                return (
                  <button key={d.key} type="button" onClick={() => setDuration(d.key)}
                    className="relative rounded-xl p-3 text-center transition-all"
                    style={{
                      background: isActive ? "rgba(251,146,60,0.12)" : "rgba(6,20,14,0.8)",
                      border: isActive ? "1.5px solid rgba(251,146,60,0.5)" : "1px solid rgba(226,232,240,0.07)",
                    }}>
                    {d.badge && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                        style={{ background: "#fb923c", color: "#fff" }}>{d.badge}</span>
                    )}
                    <p className="text-xs font-bold" style={{ color: isActive ? "#fb923c" : "#e2e8f0" }}>{d.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>{d.sublabel}</p>
                    {price && (
                      <p className="text-xs font-bold mt-1" style={{ color: isActive ? "#fb923c" : "#94a3b8" }}>
                        Rp{(price / 1000).toFixed(0)}rb
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedPrice && (
              <div className="flex items-center justify-between rounded-xl px-4 py-2.5"
                style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <span className="text-xs" style={{ color: "#64748b" }}>Total yang harus dibayar</span>
                <span className="text-base font-bold" style={{ color: "#10b981" }}>
                  Rp {selectedPrice.toLocaleString("id-ID")}
                </span>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#94a3b8" }}>Nama (opsional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(6,20,14,0.85)", border: "1px solid rgba(16,185,129,0.15)", color: "#e2e8f0" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#94a3b8" }}>Email *</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="email@contoh.com"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(6,20,14,0.85)", border: "1px solid rgba(16,185,129,0.15)", color: "#e2e8f0" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#94a3b8" }}>No. HP (sebagai password) *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" required placeholder="08xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(6,20,14,0.85)", border: "1px solid rgba(16,185,129,0.15)", color: "#e2e8f0" }} />
              <p className="text-[10px] mt-1" style={{ color: "#475569" }}>No. HP digunakan sebagai password untuk login</p>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
            style={{ background: submitting ? "rgba(251,146,60,0.4)" : "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}>
            {submitting ? "Mendaftar..." : "Daftar & Lanjutkan →"}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: "#475569" }}>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium" style={{ color: "#fb923c" }}>Masuk</Link>
        </p>
      </div>
    </div>
  );
}
