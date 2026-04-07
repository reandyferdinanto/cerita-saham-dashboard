"use client";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  align?: "left" | "center";
  showTagline?: boolean;
};

const SIZE_MAP = {
  sm: {
    orb: "h-10 w-10",
    text: "text-base sm:text-lg",
    caption: "text-[10px]",
    tagline: "text-[10px]",
  },
  md: {
    orb: "h-14 w-14",
    text: "text-2xl",
    caption: "text-xs",
    tagline: "text-xs",
  },
  lg: {
    orb: "h-16 w-16",
    text: "text-[28px]",
    caption: "text-sm",
    tagline: "text-sm",
  },
} as const;

export default function BrandMark({
  size = "md",
  subtitle,
  align = "left",
  showTagline = true,
}: BrandMarkProps) {
  const styles = SIZE_MAP[size];
  const isCenter = align === "center";

  return (
    <div className={`flex items-center gap-3 ${isCenter ? "justify-center text-center" : ""}`}>
      <div className={`relative flex flex-shrink-0 items-center justify-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/anomali-saham-logo.png"
          alt="Anomali Saham Logo"
          className={`${styles.orb} object-contain mix-blend-screen drop-shadow-md`}
        />
      </div>

      <div className={isCenter ? "text-center" : ""}>
        <p
          className={`${styles.text} font-black leading-none tracking-[0.02em] text-slate-100`}
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          anomali
          <span
            style={{
              background: "linear-gradient(135deg, #fbbf24 0%, #fb923c 55%, #f97316 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            saham
          </span>
        </p>
        {subtitle ? (
          <p className={`${styles.caption} mt-1 font-medium text-slate-400`}>{subtitle}</p>
        ) : null}
        {showTagline ? (
          <p className={`${styles.tagline} mt-1 text-slate-500`}>
            membaca akumulasi senyap, support terkunci, dan gerak yang belum banyak dilihat
          </p>
        ) : null}
      </div>
    </div>
  );
}
