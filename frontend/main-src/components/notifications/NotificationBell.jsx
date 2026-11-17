import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	Bell,
	BellOff,
	CheckCheck,
	ChevronRight,
	Info,
	RefreshCw,
	X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
	getNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/services/notifications/notificationsApi";

const POLL_INTERVAL = 30000;

const TABS = [
	{ value: "all", label: "All" },
	{ value: "unread", label: "Unread" },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

function relativeTime(value) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return "";

	const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

	if (seconds < 60) return "Just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

	return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

function isToday(value) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) return false;

	return date.toDateString() === new Date().toDateString();
}

/* -------------------------------------------------------------------------- */
/*                                  PIECES                                    */
/* -------------------------------------------------------------------------- */

function NotificationRow({ item, onSelect }) {
	const unread = !item.read_at;

	return (
		<li>
			<button
				type="button"
				onClick={() => onSelect(item)}
				className={cn(
					"group flex w-full items-start gap-3 border-l-4 px-4 py-4 text-left transition focus:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-navy",
					unread
						? "border-brand-green bg-brand-pale/60 hover:bg-brand-pale"
						: "border-transparent bg-surface-white hover:bg-surface"
				)}
			>
				<span
					className={cn(
						"mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
						unread
							? "bg-brand-navy text-brand-mint"
							: "bg-surface-muted text-content-subtle"
					)}
				>
					<Bell size={15} aria-hidden="true" />
				</span>

				<span className="min-w-0 flex-1">
					<span className="flex items-start justify-between gap-2">
						<span
							className={cn(
								"block break-words text-sm leading-5 text-content",
								unread ? "font-extrabold" : "font-semibold"
							)}
						>
							{item.title}
						</span>

						{unread ? (
							<span
								className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-green"
								aria-label="Unread"
							/>
						) : null}
					</span>

					{item.body ? (
						<span className="mt-1 line-clamp-2 block break-words text-xs leading-5 text-content-muted">
							{item.body}
						</span>
					) : null}

					<span className="mt-1.5 block text-xs font-medium text-content-subtle">
						{relativeTime(item.created_at)}
					</span>
				</span>

				{item.action_url ? (
					<ChevronRight
						size={16}
						className="mt-2 shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				) : null}
			</button>
		</li>
	);
}

function GroupHeading({ children }) {
	return (
		<li
			aria-hidden="true"
			className="bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-content-muted"
		>
			{children}
		</li>
	);
}

function RowSkeleton() {
	return (
		<div className="flex items-start gap-3 border-l-4 border-transparent px-4 py-4">
			<div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-muted" />

			<div className="flex-1 space-y-2.5">
				<div className="h-3.5 w-2/3 animate-pulse rounded-full bg-surface-muted" />
				<div className="h-3 w-full animate-pulse rounded-full bg-surface-muted" />
				<div className="h-3 w-16 animate-pulse rounded-full bg-surface-muted" />
			</div>
		</div>
	);
}

function EmptyPanel({ icon: Icon, title, description }) {
	return (
		<div className="px-6 py-12 text-center">
			<span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-pale text-brand-navy">
				<Icon size={21} aria-hidden="true" />
			</span>

			<p className="mt-3 text-sm font-extrabold text-content">{title}</p>
			<p className="mx-auto mt-1 max-w-[16rem] text-xs leading-5 text-content-muted">
				{description}
			</p>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                             PORTAL PANEL                                   */
/* -------------------------------------------------------------------------- */

function NotificationPanel({
	open,
	onClose,
	loading,
	error,
	markingAll,
	unreadCount,
	tab,
	setTab,
	rows,
	visible,
	onRefresh,
	onMarkAllRead,
	onSelect,
}) {
	/* Lock body scroll while the panel is open (mobile-friendly). */
	useEffect(() => {
		if (!open) return undefined;

		const original = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = original;
		};
	}, [open]);

	/* Escape closes. */
	useEffect(() => {
		if (!open) return undefined;

		const handler = (event) => {
			if (event.key === "Escape") onClose();
		};

		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open, onClose]);

	if (!open) return null;

	const badge = unreadCount > 99 ? "99+" : unreadCount;

	return createPortal(
		<div
			role="presentation"
			className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-navy/40 px-3 pt-20 backdrop-blur-sm sm:items-center sm:px-6 sm:py-8"
			onMouseDown={(event) => {
				/* Only close when clicking the backdrop, not the panel. */
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Notifications"
				className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-line bg-surface-white shadow-[0_24px_70px_rgba(9,20,38,0.28)]"
			>
				{/* Header */}
				<div className="flex items-start justify-between gap-3 bg-brand-navy px-5 py-4 text-content-inverse">
					<div className="min-w-0">
						<h2 className="text-base font-extrabold tracking-tight">
							Notifications
						</h2>

						<p
							className="mt-0.5 text-xs text-white/70"
							aria-live="polite"
						>
							{unreadCount
								? `${unreadCount} unread ${
										unreadCount === 1
											? "update"
											: "updates"
								  }`
								: "You're all caught up"}
						</p>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<button
							type="button"
							onClick={onMarkAllRead}
							disabled={!unreadCount || markingAll}
							className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint disabled:cursor-not-allowed disabled:opacity-40"
						>
							<CheckCheck size={14} aria-hidden="true" />
							Mark all read
						</button>

						<button
							type="button"
							onClick={onClose}
							aria-label="Close notifications"
							className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
						>
							<X size={16} aria-hidden="true" />
						</button>
					</div>
				</div>

				{/* Tabs */}
				<div
					role="tablist"
					aria-label="Filter notifications"
					className="flex gap-1 border-b border-line px-2"
				>
					{TABS.map((option) => {
						const active = option.value === tab;
						const count =
							option.value === "unread" ? unreadCount : 0;

						return (
							<button
								key={option.value}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setTab(option.value)}
								className={cn(
									"relative inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
									active
										? "text-content"
										: "text-content-muted hover:text-content"
								)}
							>
								{option.label}

								{count > 0 ? (
									<span
										className={cn(
											"rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
											active
												? "bg-brand-navy text-content-inverse"
												: "bg-surface-muted text-content-muted"
										)}
									>
										{count}
									</span>
								) : null}

								{active ? (
									<span
										aria-hidden="true"
										className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-navy"
									/>
								) : null}
							</button>
						);
					})}
				</div>

				{/* Body */}
				<div className="min-h-0 flex-1 overflow-y-auto">
					{loading && !rows.length ? (
						<div role="status" aria-label="Loading notifications">
							<RowSkeleton />
							<RowSkeleton />
							<RowSkeleton />
						</div>
					) : error && !rows.length ? (
						<div className="px-6 py-10 text-center">
							<span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
								<Info size={21} aria-hidden="true" />
							</span>

							<p className="mt-3 text-sm font-extrabold text-content">
								Couldn't load notifications
							</p>
							<p className="mx-auto mt-1 max-w-[16rem] break-words text-xs leading-5 text-content-muted">
								{error}
							</p>

							<button
								type="button"
								onClick={onRefresh}
								className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-xs font-bold text-content-inverse transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
							>
								<RefreshCw size={13} aria-hidden="true" />
								Try again
							</button>
						</div>
					) : visible.length === 0 ? (
						tab === "unread" ? (
							<EmptyPanel
								icon={CheckCheck}
								title="No unread notifications"
								description="You've read everything. Switch to All to see earlier updates."
							/>
						) : (
							<EmptyPanel
								icon={BellOff}
								title="You're all caught up"
								description="New activity on your errands and offers will appear here."
							/>
						)
					) : (
						<ul className="divide-y divide-line-soft">
							{rows.map((row) =>
								row.type === "heading" ? (
									<GroupHeading key={row.key}>
										{row.label}
									</GroupHeading>
								) : (
									<NotificationRow
										key={row.item.id}
										item={row.item}
										onSelect={onSelect}
									/>
								)
							)}
						</ul>
					)}
				</div>

				{/* Footer */}
				<div className="border-t border-line-soft bg-surface/60 px-5 py-3 text-center text-xs text-content-muted">
					Notifications refresh automatically.
				</div>
			</div>

			{/* Visually-hidden badge parity (not rendered) */}
			<span className="sr-only">{badge}</span>
		</div>,
		document.body
	);
}

/* -------------------------------------------------------------------------- */
/*                                   BELL                                     */
/* -------------------------------------------------------------------------- */

export default function NotificationBell({ basePath = "/notifications" }) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [markingAll, setMarkingAll] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [tab, setTab] = useState("all");

	const requestRef = useRef(0);

	const navigate = useNavigate();

	const refresh = useCallback(
		async (showLoading = false) => {
			const request = ++requestRef.current;

			if (showLoading) {
				setLoading(true);
				setError("");
			}

			try {
				const data = await getNotifications({ limit: 25, basePath });

				if (request !== requestRef.current) return;

				setNotifications(data.notifications || []);
				setUnreadCount(data.unreadCount || 0);
				setError("");
			} catch (requestError) {
				if (request !== requestRef.current) return;

				if (showLoading) {
					setError(
						requestError?.message || "Unable to load notifications."
					);
				}
			} finally {
				if (showLoading && request === requestRef.current) {
					setLoading(false);
				}
			}
		},
		[basePath]
	);

	/* Poll quietly, and not while the tab is in the background. */
	useEffect(() => {
		refresh(false);

		const interval = window.setInterval(() => {
			if (!document.hidden) refresh(false);
		}, POLL_INTERVAL);

		return () => window.clearInterval(interval);
	}, [refresh]);

	const togglePanel = () => {
		const next = !open;

		setOpen(next);

		if (next) refresh(true);
	};

	const handleMarkAllRead = async () => {
		if (markingAll || !unreadCount) return;

		setMarkingAll(true);

		try {
			await markAllNotificationsRead(basePath);

			const now = new Date().toISOString();

			setNotifications((items) =>
				items.map((item) => ({
					...item,
					read_at: item.read_at || now,
				}))
			);
			setUnreadCount(0);
		} catch (requestError) {
			toast.error(
				requestError?.message || "Unable to update notifications."
			);
		} finally {
			setMarkingAll(false);
		}
	};

	const handleSelect = async (item) => {
		if (!item.read_at) {
			try {
				await markNotificationRead(item.id, basePath);

				setNotifications((items) =>
					items.map((entry) =>
						entry.id === item.id
							? { ...entry, read_at: new Date().toISOString() }
							: entry
					)
				);
				setUnreadCount((count) => Math.max(0, count - 1));
			} catch {
				/* Navigation should still work if marking as read fails. */
			}
		}

		setOpen(false);

		if (item.action_url) navigate(item.action_url);
	};

	const visible = useMemo(
		() =>
			tab === "unread"
				? notifications.filter((item) => !item.read_at)
				: notifications,
		[notifications, tab]
	);

	/* Group by day only on the "All" tab, where the list can be long. */
	const rows = useMemo(() => {
		if (tab === "unread") {
			return visible.map((item) => ({ type: "item", item }));
		}

		const today = visible.filter((item) => isToday(item.created_at));
		const earlier = visible.filter((item) => !isToday(item.created_at));

		return [
			...(today.length && earlier.length
				? [{ type: "heading", key: "today", label: "Today" }]
				: []),
			...today.map((item) => ({ type: "item", item })),
			...(earlier.length && today.length
				? [{ type: "heading", key: "earlier", label: "Earlier" }]
				: []),
			...earlier.map((item) => ({ type: "item", item })),
		];
	}, [visible, tab]);

	const badge = unreadCount > 99 ? "99+" : unreadCount;

	return (
		<>
			<button
				type="button"
				aria-label={`Notifications${
					unreadCount ? `, ${unreadCount} unread` : ""
				}`}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={togglePanel}
				className={cn(
					"relative flex h-11 w-11 items-center justify-center text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2",
					open ? "border-brand-navy text-content" : "border-line"
				)}
			>
				<Bell size={19} aria-hidden="true" />

				{unreadCount > 0 ? (
					<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-green px-1 text-xs font-extrabold tabular-nums text-brand-navy ring-2 ring-surface-white">
						{badge}
					</span>
				) : null}
			</button>

			<NotificationPanel
				open={open}
				onClose={() => setOpen(false)}
				loading={loading}
				error={error}
				markingAll={markingAll}
				unreadCount={unreadCount}
				tab={tab}
				setTab={setTab}
				rows={rows}
				visible={visible}
				onRefresh={() => refresh(true)}
				onMarkAllRead={handleMarkAllRead}
				onSelect={handleSelect}
			/>
		</>
	);
}