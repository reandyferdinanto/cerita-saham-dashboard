import type { Metadata } from "next";
import "./globals.css";
import NavbarWrapper from "@/components/ui/NavbarWrapper";
import { AuthProvider } from "@/components/ui/AuthProvider";
import AdminAssistantPopup from "@/components/ui/AdminAssistantPopup";

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
    <html lang="en">
      <body
        className="antialiased bg-gradient-animated min-h-screen"
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
