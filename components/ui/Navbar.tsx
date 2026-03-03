"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
	{
		href: "/",
		label: "Dashboard",
		icon: (
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
		),
	},
	{
		href: "/search",
		label: "Cari Saham",
		icon: (
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
		),
	},
	{
		href: "/watchlist",
		label: "Watchlist",
		icon: (
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
		),
	},
	{
		href: "/admin",
		label: "Admin",
		icon: (
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
		),
	},
];

interface NavbarProps {
	delayMinutes?: number | null;
}

export default function Navbar({ delayMinutes }: NavbarProps) {
	const pathname = usePathname();

	return (
		<>
			{/* ── Top bar ───────────────────────────────────────────── */}
			<nav className="glass-nav sticky top-0 z-50 px-4 sm:px-6 py-3">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-2.5">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src="/logo-CS.png"
							alt="Cerita Saham"
							className="rounded-full object-cover flex-shrink-0"
							style={{
								width: 40,
								height: 40,
								boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
							}}
						/>
						<div>
							<h1
								className="text-base sm:text-lg font-bold leading-none"
								style={{ color: "#e2e8f0" }}
							>
								Cerita{" "}
								<span style={{ color: "#fb923c" }}>Saham</span>
							</h1>
							<p
								className="text-[10px] mt-0.5 hidden sm:block"
								style={{ color: "#64748b" }}
							>
								Financial Dashboard
							</p>
						</div>
					</Link>

					{/* Nav links — hidden on mobile, shown on md+ */}
					<div className="hidden md:flex items-center gap-1">
						{navLinks.map((link) => {
							const isActive = pathname === link.href;
							return (
								<Link
									key={link.href}
									href={link.href}
									className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
										isActive
											? "bg-green-800/50 text-orange-400 border border-orange-500/20"
											: "text-silver-400 hover:text-silver-200 hover:bg-green-800/30"
									}`}
								>
									<span
										className={
											isActive
												? "text-orange-400"
												: "text-silver-500"
										}
									>
										{link.icon}
									</span>
									{link.label}
								</Link>
							);
						})}
					</div>

					{/* Data delay badge */}
					<div
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
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
								Delay —
							</span>
						)}
					</div>
				</div>
			</nav>

			{/* ── Bottom nav — mobile only ──────────────────────────── */}
			<nav
				className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 py-2"
				style={{
					background: "rgba(6,20,14,0.92)",
					borderTop: "1px solid rgba(16,185,129,0.12)",
					backdropFilter: "blur(20px)",
					WebkitBackdropFilter: "blur(20px)",
				}}
			>
				{navLinks.map((link) => {
					const isActive = pathname === link.href;
					return (
						<Link
							key={link.href}
							href={link.href}
							className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[60px]"
							style={{
								color: isActive ? "#fb923c" : "#475569",
								background: isActive ? "rgba(249,115,22,0.1)" : "transparent",
							}}
						>
							<span style={{ color: isActive ? "#fb923c" : "#475569" }}>
								{link.icon}
							</span>
							<span className="text-[10px] font-medium leading-none">
								{link.label}
							</span>
						</Link>
					);
				})}
			</nav>
		</>
	);
}
