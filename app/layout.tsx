import type { Metadata } from "next";
import { Alegreya_Sans, Bodoni_Moda } from "next/font/google";
import "./globals.css";
import NavbarWrapper from "@/components/ui/NavbarWrapper";
import { AuthProvider } from "@/components/ui/AuthProvider";
import AdminAssistantPopup from "@/components/ui/AdminAssistantPopup";

const premiumBody = Alegreya_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-premium-body",
});

const premiumDisplay = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-premium-display",
});

export const metadata: Metadata = {
  title: "anomalisaham - Radar Akumulasi dan Bandarmology IDX",
  description: "Radar saham IDX untuk membaca akumulasi senyap, support yang dijaga, dan bandarmology berbasis price-volume.",
  icons: {
    icon: [
      { url: "/anomali-saham-logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/anomali-saham-logo.png", type: "image/png" },
    ],
    shortcut: "/anomali-saham-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${premiumBody.variable} ${premiumDisplay.variable} antialiased bg-gradient-animated min-h-screen`}
      >
        <AuthProvider>
          <NavbarWrapper />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
            {children}
          </main>
          <AdminAssistantPopup />
        </AuthProvider>
      </body>
    </html>
  );
}
