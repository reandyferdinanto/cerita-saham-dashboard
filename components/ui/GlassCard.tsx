import { ReactNode, CSSProperties } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  style?: CSSProperties;
}

export default function GlassCard({ children, className = "", hover = true, style }: GlassCardProps) {
  return (
    <div 
      className={`${hover ? "glass-card" : "glass-card [&]:hover:transform-none"} p-6 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

