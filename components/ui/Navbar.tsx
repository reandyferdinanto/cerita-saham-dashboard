"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/ui/AuthProvider";
import BrandMark from "@/components/ui/BrandMark";

// Icon helpers
const HomeIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={1.8}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
		/>
	</svg>
);
const SearchIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={1.8}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
		/>
	</svg>
);
const WatchlistIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={1.8}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
		/>
	</svg>
);
const ToolsIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={1.8}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.082 3.331a1 1 0 00.95.69h3.502c.969 0 1.371 1.24.588 1.81l-2.833 2.058a1 1 0 00-.364 1.118l1.082 3.332c.3.921-.755 1.688-1.538 1.118l-2.833-2.058a1 1 0 00-1.176 0l-2.833 2.058c-.783.57-1.838-.197-1.539-1.118l1.083-3.332a1 1 0 00-.364-1.118L2.93 8.758c-.783-.57-.38-1.81.588-1.81H7.02a1 1 0 00.951-.69l1.078-3.331z"
		/>
	</svg>
);
const GuidanceIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={1.8}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
		/>
	</svg>
);
const AdminIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={1.8}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
		/>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
		/>
	</svg>
);
const UsersIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={1.8}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
		/>
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
	{ href: "/search", label: "Cari Saham", icon: <SearchIcon />, minRole: "user" },
	{ href: "/watchlist", label: "Watchlist", icon: <WatchlistIcon />, minRole: "user" },
	{ href: "/investor-tools", label: "Tools", icon: <ToolsIcon />, minRole: "user" },
	{ href: "/guidance", label: "Panduan", icon: <GuidanceIcon />, minRole: "user" },
	{ href: "/admin", label: "Pengaturan", icon: <AdminIcon />, minRole: "admin" },
];

function roleRank(role?: string | null): number {
	if (role === "superadmin") return 3;
	if (role === "admin") return 2;
	if (role === "user") return 1;
	return 0;
}

interface NavbarProps {
	delayMinutes?: number | null;
}

export default function Navbar({ delayMinutes }: NavbarProps) {
	const pathname = usePathname();
	const { user, loading, logout } = useAuth();
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const [pendingCount, setPendingCount] = useState(0);

	// Fetch pending membership count for admin/superadmin
	useEffect(() => {
		if (user?.role === "admin" || user?.role === "superadmin") {
			fetch("/api/admin/membership")
				.then((r) => r.json())
				.then((d) => {
					const count = (d.users || []).filter((u: { membershipStatus: string }) => u.membershipStatus === "pending").length;
					setPendingCount(count);
				})
				.catch(() => {});
		}
	}, [user]);

	// Close dropdown on outside click
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setUserMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const rank = roleRank(user?.role);

	// Links visible for this user
	const visibleLinks = ALL_LINKS.filter((l) => {
		if (!l.minRole) return true;
		return rank >= roleRank(l.minRole);
	});

	// For mobile bottom nav
	const mobileLinks: NavLink[] = user
		? visibleLinks
		: [
				{ href: "/", label: "Dashboard", icon: <HomeIcon /> },
				{ href: "/login", label: "Cari Saham", icon: <SearchIcon /> },
				{ href: "/login", label: "Watchlist", icon: <WatchlistIcon /> },
				{ href: "/login", label: "Panduan", icon: <GuidanceIcon /> },
		  ];

	const renderUserButton = () => {
		if (loading) {
			return (
				<div
					className="w-8 h-8 rounded-full animate-pulse"
					style={{ background: "rgba(255,255,255,0.05)" }}
				/>
			);
		}
		if (!user) {
			return (
				<Link
					href="/login"
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
					style={{
						background: "linear-gradient(135deg,#ea580c,#fb923c)",
						color: "#fff",
					}}
				>
					<svg
						className="w-3.5 h-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
						/>
					</svg>
					Masuk
				</Link>
			);
		}

		const initials = (user.email?.[0] || "U").toUpperCase();
		const roleBadgeColor =
			user.role === "superadmin"
				? "#D4AF37"
				: user.role === "admin"
				? "#fb923c"
				: "#10b981";

		return (
			<div className="relative" ref={menuRef}>
				<button
					onClick={() => setUserMenuOpen((v) => !v)}
					className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all"
					style={{
						background: userMenuOpen ? "rgba(251,146,60,0.1)" : "transparent",
					}}
				>
					{/* Avatar */}
					<div
						className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0"
						style={{
							background: "rgba(251,146,60,0.2)",
							color: "#fb923c",
						}}
					>
						{user.avatarUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={user.avatarUrl}
								alt={user.email}
								className="w-full h-full object-cover"
							/>
						) : (
							initials
						)}
					</div>
					<div className="hidden sm:block text-left">
						<div
							className="text-xs font-medium leading-none"
							style={{ color: "#e2e8f0" }}
						>
							{user.email.split("@")[0]}
						</div>
						<div
							className="text-[9px] mt-0.5 font-semibold capitalize"
							style={{ color: roleBadgeColor }}
						>
							{user.role}
						</div>
					</div>
					<svg
						className="w-3 h-3"
						style={{ color: "#64748b" }}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>

				{/* Dropdown */}
				{userMenuOpen && (
					<div
						className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl overflow-hidden z-50"
						style={{
							background: "rgba(6,20,14,0.97)",
							border: "1px solid rgba(16,185,129,0.15)",
							boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
						}}
					>
						<div
							className="px-4 py-3"
							style={{
								borderBottom: "1px solid rgba(226,232,240,0.06)",
							}}
						>
							<div
								className="text-xs font-medium truncate"
								style={{ color: "#e2e8f0" }}
							>
								{user.email}
							</div>
							<div
								className="text-[10px] mt-0.5 capitalize font-semibold"
								style={{ color: roleBadgeColor }}
							>
								{user.role}
							</div>
						</div>
						{(user.role === "superadmin" || user.role === "admin") && (
							<Link
								href="/admin?tab=members"
								onClick={() => setUserMenuOpen(false)}
								className="flex items-center gap-2.5 px-4 py-3 text-sm transition-all hover:bg-white/5"
								style={{
									color: "#94a3b8",
									borderBottom: "1px solid rgba(226,232,240,0.04)",
								}}
							>
								<UsersIcon />
								Pengaturan Admin
								{pendingCount > 0 && (
									<span
										className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
										style={{ background: "#fb923c", color: "#fff" }}
									>
										{pendingCount}
									</span>
								)}
							</Link>
						)}
						<button
							onClick={() => {
								setUserMenuOpen(false);
								logout();
							}}
							className="w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-all hover:bg-white/5"
							style={{ color: "#f87171" }}
						>
							<svg
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.8}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
								/>
							</svg>
							Keluar
						</button>
					</div>
				)}
			</div>
		);
	};

	return (
		<>
			{/* Ã¢â€â‚¬Ã¢â€â‚¬ Top bar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
			<nav className="glass-nav sticky top-0 z-50 px-4 sm:px-6 py-3">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-2.5">
						<BrandMark
							size="sm"
							subtitle="radar anomali smart money"
							showTagline={false}
						/>
					</Link>

					{/* Nav links Ã¢â‚¬â€ desktop */}
					<div className="hidden md:flex items-center gap-1">
						{visibleLinks.map((link) => {
							const isActive =
								pathname === link.href ||
								(link.href !== "/" && pathname.startsWith(link.href));
							const showBadge = link.href === "/admin" && pendingCount > 0;
							return (
								<Link
									key={link.href + link.label}
									href={link.href}
									className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
										isActive
											? "bg-green-800/50 text-orange-400 border border-orange-500/20"
											: "text-silver-400 hover:text-silver-200 hover:bg-green-800/30"
									}`}
								>
									<span className={isActive ? "text-orange-400" : "text-silver-500"}>
										{link.icon}
									</span>
									{link.label}
									{showBadge && (
										<span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
											style={{ background: "#fb923c", color: "#fff" }}>
											{pendingCount}
										</span>
									)}
								</Link>
							);
						})}
					</div>

					{/* Right side: delay badge + user menu */}
					<div className="flex items-center gap-2">
						{/* Delay badge */}
						<div
							className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
							style={{
								background: "rgba(6,78,59,0.3)",
								border: "1px solid rgba(16,185,129,0.12)",
							}}
						>
							<svg
								className="w-3.5 h-3.5 flex-shrink-0"
								style={{ color: "#64748b" }}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{delayMinutes != null ? (
								<span
									className="text-xs font-medium"
									style={{
										color:
											delayMinutes === 0
												? "#10b981"
												: "#fb923c",
									}}
								>
									{delayMinutes === 0
										? "Real-time"
										: `Delay ${delayMinutes}m`}
								</span>
							) : (
								<span
									className="text-xs"
									style={{ color: "#475569" }}
								>
									Delay Ã¢â‚¬â€
								</span>
							)}
						</div>

						{renderUserButton()}
					</div>
				</div>
			</nav>

			{/* Ã¢â€â‚¬Ã¢â€â‚¬ Bottom nav Ã¢â‚¬â€ mobile only Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
			<nav
				className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1 py-1"
				style={{
					background: "rgba(6,20,14,0.95)",
					borderTop: "1px solid rgba(16,185,129,0.12)",
					backdropFilter: "blur(20px)",
					WebkitBackdropFilter: "blur(20px)",
				}}
			>
				{mobileLinks.map((link, idx) => {
					const isActive =
						link.href !== "/login" &&
						(pathname === link.href ||
							(link.href !== "/" && pathname.startsWith(link.href)));
					const isLocked = link.href === "/login" && !user;
					return (
						<Link
							key={link.href + link.label + idx}
							href={link.href}
							className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px] relative"
							style={{
								color: isActive ? "#fb923c" : "#475569",
								background: isActive
									? "rgba(249,115,22,0.1)"
									: "transparent",
							}}
						>
							<span
								style={{
									color: isActive
										? "#fb923c"
										: isLocked
										? "#2d3748"
										: "#475569",
								}}
							>
								{link.icon}
							</span>
							<span className="text-[9px] font-medium leading-none">
								{link.label}
							</span>
							{isLocked && (
								<span className="absolute top-1 right-1">
									<svg className="w-2.5 h-2.5" style={{ color: "#374151" }} fill="currentColor" viewBox="0 0 24 24">
										<path d="M17 9V7a5 5 0 00-10 0v2H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-2zm-7-2a3 3 0 016 0v2h-6V7z" />
									</svg>
								</span>
							)}
							{link.href === "/admin" && pendingCount > 0 && (
								<span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center"
									style={{ background: "#fb923c", color: "#fff" }}>
									{pendingCount}
								</span>
							)}
						</Link>
					);
				})}
				{/* Login icon slot for mobile when not logged in */}
				{!user && !loading && (
					<Link
						href="/login"
						className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px]"
						style={{
							color: pathname === "/login" ? "#fb923c" : "#475569",
							background:
								pathname === "/login"
									? "rgba(249,115,22,0.1)"
									: "transparent",
						}}
					>
						<svg
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={1.8}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
							/>
						</svg>
						<span className="text-[9px] font-medium leading-none">
							Masuk
						</span>
					</Link>
				)}
				{user && (
					<button
						onClick={logout}
						className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px]"
						style={{ color: "#475569" }}
					>
						{user.avatarUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={user.avatarUrl}
								alt="me"
								className="w-5 h-5 rounded-full object-cover"
							/>
						) : (
							<div
								className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
								style={{
									background: "rgba(251,146,60,0.2)",
									color: "#fb923c",
								}}
							>
								{(user.email?.[0] || "U").toUpperCase()}
							</div>
						)}
						<span className="text-[9px] font-medium leading-none">
							Akun
						</span>
					</button>
				)}
			</nav>
		</>
	);
}

