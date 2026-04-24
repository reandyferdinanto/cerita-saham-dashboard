"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function NavbarWrapper() {
  const pathname = usePathname();
  const [delayMinutes, setDelayMinutes] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (pathname?.includes("/bot-view")) return;

    const fetchDelay = async () => {
      try {
        const res = await fetch("/api/stocks/quote/%5EJKSE"); // ^JKSE encoded
        const data = await res.json();
        if (data && !data.error) {
          setDelayMinutes(data.delayMinutes ?? null);
        }
      } catch {
        setDelayMinutes(null);
      }
    };

    fetchDelay();
    // Refresh every 60s
    const interval = setInterval(fetchDelay, 60_000);
    return () => clearInterval(interval);
  }, [pathname]);

  if (pathname?.includes("/bot-view")) return null;

  return <Navbar delayMinutes={delayMinutes} />;
}
