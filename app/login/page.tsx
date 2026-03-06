"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/ui/AuthProvider";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirect);
    }
  }, [user, loading, router, redirect]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login gagal");
        return;
      }
      await refresh();
      router.replace(redirect);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: "rgba(6,20,14,0.85)",
          border: "1px solid rgba(16,185,129,0.15)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo-CS.png"
            alt="Cerita Saham"
            width={64}
            height={64}
            className="rounded-full mb-3"
            style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
          />
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif", color: "#e2e8f0" }}
          >
            Cerita{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #D4AF37 0%, #F5D876 50%, #B8860B 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontStyle: "italic",
              }}
            >
              Saham
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            Masuk ke akun Anda
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
              Alamat Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@contoh.com"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "rgba(15,30,20,0.8)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#e2e8f0",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(251,146,60,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(16,185,129,0.2)")}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
              Nomor Telepon (sebagai password)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="08xxxxxxxxxx"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "rgba(15,30,20,0.8)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#e2e8f0",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(251,146,60,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(16,185,129,0.2)")}
            />
          </div>

          {error && (
            <div
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2"
            style={{
              background: submitting
                ? "rgba(251,146,60,0.3)"
                : "linear-gradient(135deg, #ea580c 0%, #fb923c 100%)",
              color: "#fff",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Masuk...
              </span>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "#64748b" }}>
          Belum punya akun?{" "}
          <Link href="/register" className="font-medium" style={{ color: "#fb923c" }}>
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

