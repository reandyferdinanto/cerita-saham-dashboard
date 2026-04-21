"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/ui/AuthProvider";
import BrandMark from "@/components/ui/BrandMark";

// --- PROFESSIONAL ICONS (IMPECCABLE STYLE) ---
const HomeIcon = () => (
	<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
	</svg>
);
const WatchlistIcon = () => (
	<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
	</svg>
);
const InsightsIcon = () => (
	<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
	</svg>
);
const ToolsIcon = () => (
	<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.082 3.331a1 1 0 00.95.69h3.502c.969 0 1.371 1.24.588 1.81l-2.833 2.058a1 1 0 00-.364 1.118l1.082 3.332c.3.921-.755 1.688-1.538 1.118l-2.833-2.058a1 1 0 00-1.176 0l-2.833 2.058c-.783.57-1.838-.197-1.539-1.118l1.083-3.332a1 1 0 00-.364-1.118L2.93 8.758c-.783-.57-.38-1.81.588-1.81H7.02a1 1 0 00.951-.69l1.078-3.331z" />
	</svg>
);
const GuidanceIcon = () => (
	<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
	</svg>
);
const AdminIcon = () => (
	<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
		<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
	</svg>
);

interface NavLink {
	href: string;
	label: string;
	icon: React.ReactNode;
	minRole?: "user" | "admin" | "superadmin";
}

const ALL_LINKS: NavLink[] = [
	{ href: "/", label: "Dashboard", icon: <HomeIcon /> },
	{ href: "/watchlist", label: "Watchlist", icon: <WatchlistIcon />, minRole: "user" },
	{ href: "/insights", label: "Insights", icon: <InsightsIcon />, minRole: "user" },
	{ href: "/investor-tools", label: "Tools", icon: <ToolsIcon />, minRole: "user" },
	{ href: "/guidance", label: "Panduan", icon: <GuidanceIcon />, minRole: "user" },
	{ href: "/admin", label: "Admin", icon: <AdminIcon />, minRole: "admin" },
];

function roleRank(role?: string | null): number {
	if (role === "superadmin") return 3;
	if (role === "admin") return 2;
	if (role === "user") return 1;
	return 0;
}

export default function Navbar({ delayMinutes }: { delayMinutes?: number | null }) {
	const pathname = usePathname();
	const { user, loading, logout } = useAuth();
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const rank = roleRank(user?.role);
	const visibleLinks = ALL_LINKS.filter((l) => !l.minRole || rank >= roleRank(l.minRole));

	const renderUserButton = (isMobile = false) => {
		if (loading) return <div className="w-8 h-8 rounded-full animate-pulse bg-white/5" />;
		if (!user) {
			return (
				<Link href="/login" className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all bg-gradient-to-r from-orange-600 to-orange-400 shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95">
					Masuk
				</Link>
			);
		}

		return (
			<div className="relative" ref={menuRef}>
				<button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 p-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
					<div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-black text-xs">
						{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : user.email[0].toUpperCase()}
					</div>
				</button>
				{userMenuOpen && (
					<div className={`absolute right-0 w-48 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 ${isMobile ? "bottom-full mb-3" : "mt-3"}`}>
						<div className="px-4 py-3 border-b border-white/5"><p className="text-[10px] font-bold text-silver-500 truncate uppercase tracking-widest">{user.email}</p></div>
						{user.role === "admin" || user.role === "superadmin" ? (
                            <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="block w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors font-bold">Admin Panel</Link>
                        ) : null}
						<button onClick={() => { logout(); setUserMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors font-bold">Keluar</button>
					</div>
				)}
			</div>
		);
	};

	return (
		<>
			{/* DESKTOP NAV */}
			<nav className="sticky top-0 z-[60] w-full border-b border-white/5 bg-slate-950/50 backdrop-blur-xl hidden md:block">
				<div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
					<div className="flex items-center gap-10">
						<Link href="/" className="flex items-center gap-2 group">
							<img src="/anomali-saham-logo.png" alt="Logo" className="w-8 h-8 group-hover:rotate-12 transition-transform" />
							<span className="text-xl font-black tracking-tighter text-white">anomali<span className="text-silver-500 font-light">saham</span></span>
						</Link>
						<div className="flex items-center gap-1">
							{visibleLinks.map((link) => (
								<Link key={link.href} href={link.href} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${pathname === link.href ? "bg-orange-500/10 text-orange-400" : "text-silver-400 hover:text-white hover:bg-white/5"}`}>
									{link.label}
								</Link>
							))}
						</div>
					</div>
					<div className="flex items-center gap-4">
						{delayMinutes !== undefined && (
							<div className="px-3 py-1.5 rounded-full border border-white/5 bg-white/2 flex items-center gap-2">
								<div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
								<span className="text-[10px] font-black text-silver-500 uppercase tracking-widest">IDX LIVE</span>
							</div>
						)}
						{renderUserButton()}
					</div>
				</div>
			</nav>

			{/* MOBILE BOTTOM NAV - IMPECCABLE REDESIGN */}
			<nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/80 backdrop-blur-3xl border-t border-white/10 pb-safe">
				<div className="flex justify-around items-center h-16 px-2">
					{visibleLinks.slice(0, 5).map((link) => {
						const isActive = pathname === link.href;
						return (
							<Link key={link.href} href={link.href} className={`flex flex-col items-center gap-1 flex-1 py-2 transition-all ${isActive ? "text-orange-400" : "text-silver-500 hover:text-silver-300"}`}>
								<div className={`p-2 rounded-2xl transition-all duration-500 ${isActive ? "bg-orange-500/15 scale-110 shadow-[0_0_20px_rgba(249,115,22,0.2)]" : ""}`}>
									{link.icon}
								</div>
								<span className={`text-[9px] font-black uppercase tracking-tighter transition-all ${isActive ? "opacity-100 translate-y-0" : "opacity-60"}`}>
									{link.label}
								</span>
							</Link>
						);
					})}
					{/* User Profile on Mobile */}
					<div className="flex-1 flex flex-col items-center">
						{renderUserButton(true)}
					</div>
				</div>
			</nav>

			{/* Top Spacer for Mobile so content isn't under status bar if needed, 
			    but here we use sticky top for desktop and fixed bottom for mobile */}
			<div className="md:hidden h-14 bg-slate-950/50 backdrop-blur-lg border-b border-white/5 flex items-center px-4 sticky top-0 z-50">
				<Link href="/" className="flex items-center gap-2">
					<img src="/anomali-saham-logo.png" alt="Logo" className="w-6 h-6" />
					<span className="text-sm font-black text-white tracking-tighter">anomalisaham</span>
				</Link>
			</div>
		</>
	);
}
