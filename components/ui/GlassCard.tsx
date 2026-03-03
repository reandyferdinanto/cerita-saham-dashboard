import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({ children, className = "", hover = true }: GlassCardProps) {
  return (
    <div className={`${hover ? "glass-card" : "glass-card [&]:hover:transform-none"} p-6 ${className}`}>
      {children}
    </div>
  );
}

