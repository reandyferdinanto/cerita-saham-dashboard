# Design System: Cerita Saham (UI-UX-PRO-MAX + Impeccable)

## Vision
A high-end, precise, and data-driven financial dashboard that avoids generic "AI slop". It feels like a boutique Bloomberg terminal—professional, deep, and trustworthy.

## Core Principles (Impeccable)
1. **No AI Slop:** No default Inter font, no neon purple gradients, no gray-on-color text.
2. **Precision:** Use OKLCH for color harmony.
3. **Spatial Design:** Bold use of whitespace and clear visual hierarchy.

## 1. Colors (OKLCH)
- **Background:** `oklch(14% 0.02 160)` (Deep Emerald Black)
- **Surface:** `oklch(20% 0.03 160)` (Emerald Surface)
- **Primary (Accent):** `oklch(70% 0.15 45)` (Golden Orange)
- **Secondary (Success):** `oklch(65% 0.2 150)` (Vibrant Teal)
- **Critical (Error):** `oklch(60% 0.2 25)` (Coral Red)
- **Text Primary:** `oklch(95% 0.01 160)` (Silver White)
- **Text Secondary:** `oklch(75% 0.02 160)` (Muted Silver)

## 2. Typography
- **Primary Font:** Geist Sans or System Serif (Avoid Inter)
- **Scale:**
  - Display: 2rem (32px) / Bold
  - Heading: 1.25rem (20px) / Semibold
  - Body: 0.875rem (14px) / Regular
  - Detail: 0.75rem (12px) / Medium (Tabular nums)

## 3. Components
### GlassCard (Enhanced)
- **Background:** `rgba(6, 78, 59, 0.15)`
- **Border:** `1px solid rgba(255, 255, 255, 0.08)`
- **Backdrop Blur:** `12px`
- **Shadow:** `0 10px 30px rgba(0, 0, 0, 0.25)`

### Navigation (The "Insights" Update)
- **New Menu:** "Insights" (News & Articles)
- **Location:** Desktop Sidebar/TopNav, Mobile Bottom Nav.
- **Icon:** Book/Newsletter style.

## 4. Interaction & Motion
- **Transitions:** `200ms cubic-bezier(0.4, 0, 0.2, 1)`
- **Hover:** Subtle scale (1.01x) and border illumination.
- **Loading:** Minimalist shimmer, no harsh spinners.
