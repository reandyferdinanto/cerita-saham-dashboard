import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import NavbarWrapper from "@/components/ui/NavbarWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Cerita Saham - Financial Dashboard",
  description: "Stock watchlist dashboard with bandarmology analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased bg-gradient-animated min-h-screen`}
      >
        <NavbarWrapper />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
          {children}
        </main>
      </body>
    </html>
  );
}
