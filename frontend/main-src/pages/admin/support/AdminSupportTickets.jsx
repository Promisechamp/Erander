import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AlertCircle,
	ArrowDownToLine,
	ChevronLeft,
	ChevronRight,
	Copy,
	FileJson,
	FileSpreadsheet,
	FileText,
	Filter,
	LoaderCircle,
	MessageCircle,
	RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import Select from "@/components/Select";
import { listAdminSupportTickets } from "@/services/support/supportApi";
import UserProfileModal from "../users/UserProfileModal";
import RecordsCards from "../shared/data-table/RecordsCards";
import {
	Avatar,
	CopyButton,
	LastUpdated,
	Popover,
	SkeletonCards,
	SkeletonRows,
	StatCard,
	TruncatedText,
} from "../shared/data-table/RecordsUI";
import RecordsTable from "../shared/data-table/RecordsTable";
import RecordsToolbar from "../shared/data-table/RecordsToolbar";
import TextDialog from "../shared/data-table/TextDialog";
import { BTN_GHOST, BTN_NAVY } from "../shared/data-table/recordsStyles";
import useEntityDetails from "../shared/data-table/useEntityDetails";
import useViewPrefs from "../shared/data-table/useViewPrefs";
import {
	MAX_CARD_FIELDS,
	PAGE_SIZES,
	compareValues,
	copyText,
	exportRows,
	humanize,
} from "../shared/data-table/recordsUtils";
import AdminSupportTicketDetails from "./AdminSupportTicketDetails";
import {
	extractPagination,
	extractTickets,
	formatDate,
	getCategoryLabel,
	getErrorMessage,
	getPriorityLabel,
	getStatusLabel,
	getUserName,
} from "./adminSupportUtils";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const STATUS_VALUES = [
	"open",
	"in_progress",
	"awaiting_user",
	"resolved",
	"closed",
];

const PRIORITY_OPTIONS = [
	{ label: "All priorities", value: "" },
	{ label: "Low", value: "low" },
	{ label: "Normal", value: "normal" },
	{ label: "High", value: "high" },
	{ label: "Urgent", value: "urgent" },
];

const TYPE_OPTIONS = [
	{ label: "All ticket types", value: "" },
	{ label: "General support", value: "support" },
	{ label: "Errand issue", value: "issue" },
];

const ALL_COLUMNS = [
	"ticket",
	"customer",
	"category",
	"ticket_type",
	"status",
	"priority",
	"updated_at",
	"created_at",
	"errand_id",
	"id",
];

const DEFAULT_CARD_FIELDS = [
	"customer",
	"category",
	"status",
	"priority",
	"updated_at",
];

const EXPORT_COLUMNS = [
	"id",
	"ticket_number",
	"subject",
	"description",
	"user_id",
	"customer_name",
	"customer_email",
	"customer_phone",
	"category",
	"ticket_type",
	"status",
	"priority",
	"errand_id",
	"created_at",
	"updated_at",
];

const STATUS_TONE = {
	open: "bg-amber-50 text-amber-800 ring-amber-200",
	in_progress: "bg-sky-50 text-sky-800 ring-sky-200",
	awaiting_user: "bg-violet-50 text-violet-800 ring-violet-200",
	resolved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
	closed: "bg-surface-muted text-content-muted ring-line",
};

const PRIORITY_TONE = {
	low: "bg-surface-muted text-content-muted",
	normal: "bg-sky-50 text-sky-800",
	high: "bg-amber-50 text-amber-800",
	urgent: "bg-rose-50 text-rose-800",
};

/* ------------------------ Responsive card columns ------------------------ */

const DEFAULT_CARD_COLUMNS = {
	phone: 1,
	tablet: 3,
	pc: 6,
	desktop: 8,
};

const CARD_COLUMN_LIMITS = {
	phone: { min: 1, max: 8 },
	tablet: { min: 1, max: 8 },
	pc: { min: 1, max: 8 },
	desktop: { min: 1, max: 8 },
};

function normalizeCardColumns(values = {}) {
	return Object.fromEntries(
		Object.entries(DEFAULT_CARD_COLUMNS).map(([screen, defaultValue]) => {
			const limits = CARD_COLUMN_LIMITS[screen];
			const value = Number(values[screen] ?? defaultValue);

			return [
				screen,
				Math.min(
					limits.max,
					Math.max(
						limits.min,
						Number.isFinite(value)
							? Math.floor(value)
							: defaultValue,
					),
				),
			];
		}),
	);
}

function getSavedCardColumns(key) {
	try {
		const saved = localStorage.getItem(key);

		return saved
			? normalizeCardColumns(JSON.parse(saved))
			: { ...DEFAULT_CARD_COLUMNS };
	} catch {
		return { ...DEFAULT_CARD_COLUMNS };
	}
}

/* -------------------------------------------------------------------------- */
/*                                  BADGES                                    */
/* -------------------------------------------------------------------------- */

function Badge({ children, className = "" }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${className}`}
		>
			{children}
		</span>
	);
}

function StatusBadge({ status }) {
	return (
		<Badge className={STATUS_TONE[status] || STATUS_TONE.closed}>
			{getStatusLabel(status)}
		</Badge>
	);
}

function PriorityBadge({ priority }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
				PRIORITY_TONE[priority] || PRIORITY_TONE.normal
			}`}
		>
			{getPriorityLabel(priority)} priority
		</span>
	);
}

/* -------------------------------------------------------------------------- */
/*                                TICKET HELPERS                              */
/* -------------------------------------------------------------------------- */

function getCustomer(ticket) {
	return ticket?.user ?? ticket?.profile ?? ticket?.customer ?? null;
}

function getColumnValue(ticket, column) {
	const customer = getCustomer(ticket);

	switch (column) {
		case "ticket":
	return [
		ticket.ticket_number,
		ticket.subject,
		ticket.description,
		ticket.id,
	]
		.filter(Boolean)
		.join(" ");
		case "customer":
			return [
				getUserName(customer),
				customer?.email,
				customer?.phone,
				ticket.user_id,
			]
				.filter(Boolean)
				.join(" ");

		case "category":
			return getCategoryLabel(ticket.category);

		case "ticket_type":
			return ticket.ticket_type === "issue"
				? "Errand issue"
				: "General support";

		case "status":
			return getStatusLabel(ticket.status);

		case "priority":
			return getPriorityLabel(ticket.priority);

		case "updated_at":
			return formatDate(ticket.updated_at ?? ticket.created_at, true);

		case "created_at":
			return formatDate(ticket.created_at, true);

		case "errand_id":
			return ticket.errand_id ?? ticket.related_erand_id ?? "";

		case "id":
			return ticket.id ?? "";

		default:
			return ticket?.[column] ?? "";
	}
}

/* -------------------------------------------------------------------------- */
/*                             SUPPORT TABLE CELL                             */
/* -------------------------------------------------------------------------- */

function TicketCell({
	ticket,
	column,
	onExpand,
	onOpenCustomer,
}) {
	const customer = getCustomer(ticket);
	const customerName = getUserName(customer);

	if (column === "ticket") {
		return (
			<div className="max-w-[200px]">
				<div className="flex items-center gap-1">
					<span className="text-[11px] font-extrabold tracking-wide text-brand">
						{ticket.ticket_number || "Support ticket"}
					</span>

					<CopyButton
						value={ticket.ticket_number || ticket.id}
						label="Ticket reference copied"
					/>
				</div>

				<div className="mt-1 flex max-w-full items-center gap-1">
					<TruncatedText
						text={ticket.subject || "Untitled ticket"}
						title="Ticket subject"
						limit={38}
						className="text-sm font-bold text-content"
						onExpand={onExpand}
					/>
				</div>
			</div>
		);
	}

	if (column === "customer") {
		return (
			<div className="flex min-w-[190px] items-center gap-2.5">
				<Avatar profile={customer} size="md" />

				<div className="min-w-0">
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onOpenCustomer(
								customer,
								customer?.id ?? ticket.user_id,
							);
						}}
						title="Open customer profile"
						className="block max-w-[190px] truncate text-left text-xs font-bold text-content underline decoration-dotted decoration-line-strong underline-offset-4 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
					>
						{customerName}
					</button>

					<div className="mt-0.5 flex max-w-[200px] items-center gap-1">
						<TruncatedText
							text={
								customer?.email ||
								"Customer email unavailable"
							}
							title="Customer contact"
							limit={30}
							className="text-[11px] text-content-subtle"
							onExpand={onExpand}
						/>

						<CopyButton
							value={customer?.email}
							label="Customer email copied"
						/>
					</div>
				</div>
			</div>
		);
	}

	if (column === "category") {
		return (
			<span className="text-xs font-semibold text-content">
				{getCategoryLabel(ticket.category)}
			</span>
		);
	}

	if (column === "ticket_type") {
		return (
			<span className="text-xs text-content-muted">
				{ticket.ticket_type === "issue"
					? "Errand issue"
					: "General support"}
			</span>
		);
	}

	if (column === "status") {
		return <StatusBadge status={ticket.status} />;
	}

	if (column === "priority") {
		return <PriorityBadge priority={ticket.priority} />;
	}

	if (column === "updated_at" || column === "created_at") {
		const value =
			column === "updated_at"
				? ticket.updated_at ?? ticket.created_at
				: ticket.created_at;

		return (
			<span className="whitespace-nowrap text-xs font-semibold text-content-muted">
				{formatDate(value, true)}
			</span>
		);
	}

	if (column === "errand_id") {
		const value = ticket.errand_id ?? ticket.related_erand_id;

		return (
			<span className="inline-flex max-w-[100px] items-center gap-1">
				<TruncatedText
					text={value || "No id provided"}
					title="Related errand ID"
					limit={18}
					mono
					onExpand={onExpand}
				/>

				<CopyButton value={value} label="Errand ID copied" />
			</span>
		);
	}

	if (column === "id") {
		return (
			<span className="inline-flex max-w-[100px] items-center gap-1">
				<TruncatedText
					text={ticket.id || "—"}
					title="Ticket ID"
					limit={10}
					mono
					onExpand={onExpand}
				/>

				<CopyButton value={ticket.id} label="Ticket ID copied" />
			</span>
		);
	}

	return <span className="text-xs text-content-muted">—</span>;
}

/* -------------------------------------------------------------------------- */
/*                                  EMPTY STATE                               */
/* -------------------------------------------------------------------------- */

function EmptyState({ onClear, hasFilters }) {
	return (
		<div className="flex flex-col items-center justify-center px-6 py-16 text-center">
			<span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
				<MessageCircle size={24} />
			</span>

			<h3 className="mt-4 text-base font-extrabold text-brand">
				No support tickets found
			</h3>

			<p className="mt-1 max-w-sm text-sm leading-6 text-content-muted">
				{hasFilters
					? "Try adjusting your search or filters."
					: "New customer support requests will appear here."}
			</p>

			{hasFilters ? (
				<button
					type="button"
					onClick={onClear}
					className="mt-4 text-xs font-bold text-success underline underline-offset-4"
				>
					Clear filters
				</button>
			) : null}
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                              MAIN SUPPORT PAGE                             */
/* -------------------------------------------------------------------------- */

export default function AdminSupportTickets() {
	const [tickets, setTickets] = useState([]);

	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");

	const [status, setStatus] = useState("");
	const [priority, setPriority] = useState("");
	const [ticketType, setTicketType] = useState("");

	const [columnFilters, setColumnFilters] = useState({});

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);

	const [pagination, setPagination] = useState({
		page: 1,
		pageSize: 20,
		total: 0,
		totalPages: 1,
	});

	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");

	const [selectedTicketId, setSelectedTicketId] = useState(null);
	const [selectedIds, setSelectedIds] = useState([]);

	const [lastUpdated, setLastUpdated] = useState(null);
	const [textDialog, setTextDialog] = useState(null);

	const entities = useEntityDetails();
	const prefs = useViewPrefs("support", "tickets");
	const searchRef = useRef(null);

	/* ---------------------- Responsive card column state ---------------------- */

	const cardColumnsStorageKey =
		"erander-admin-card-columns:support:tickets";

	const [cardColumnsPreferences, setCardColumnsPreferences] = useState({});

	const cardColumnsByBreakpoint =
		cardColumnsPreferences[cardColumnsStorageKey] ??
		getSavedCardColumns(cardColumnsStorageKey);

	function updateCardColumnsByBreakpoint(nextColumns) {
		const normalized = normalizeCardColumns(nextColumns);

		try {
			localStorage.setItem(
				cardColumnsStorageKey,
				JSON.stringify(normalized),
			);
		} catch {
			// The setting remains available during the current session.
		}

		setCardColumnsPreferences((previous) => ({
			...previous,
			[cardColumnsStorageKey]: normalized,
		}));
	}

	/* ------------------------------- Search debounce ------------------------------- */

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setSearch(searchInput.trim());
		}, 250);

		return () => window.clearTimeout(timer);
	}, [searchInput]);

	/* -------------------------------- Load tickets -------------------------------- */

	const loadTickets = useCallback(
		async ({ silent = false } = {}) => {
			if (silent) setRefreshing(true);
			else setLoading(true);

			setError("");

			try {
				const response = await listAdminSupportTickets({
					search,
					status,
					priority,
					ticket_type: ticketType,
					page,
					limit: pageSize,
				});

				setTickets(extractTickets(response));
				setPagination(extractPagination(response));
				setLastUpdated(new Date());
			} catch (requestError) {
				const message = getErrorMessage(
					requestError,
					"Unable to load support tickets.",
				);

				setError(message);

				if (silent) toast.error(message);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[search, status, priority, ticketType, page, pageSize],
	);

	useEffect(() => {
		loadTickets();
	}, [loadTickets]);

	/* Reset page and selection when filters change */

	useEffect(() => {
		setPage(1);
		setSelectedIds([]);
	}, [search, status, priority, ticketType]);

	/* Reset selection when page, page size or column filters change */

	useEffect(() => {
		setSelectedIds([]);
	}, [page, pageSize, columnFilters]);

	/* --------------------------------- Filters --------------------------------- */

	const clearFilters = useCallback(() => {
		setSearchInput("");
		setSearch("");
		setStatus("");
		setPriority("");
		setTicketType("");
		setColumnFilters({});
		setPage(1);
		setSelectedIds([]);
	}, []);

	const hasFilters = Boolean(
		searchInput ||
			search ||
			status ||
			priority ||
			ticketType ||
			Object.values(columnFilters).some(Boolean),
	);

	/* -------------------------------- Statistics -------------------------------- */

	const counts = useMemo(
		() => ({
			open: tickets.filter((ticket) => ticket.status === "open").length,
			inProgress: tickets.filter(
				(ticket) => ticket.status === "in_progress",
			).length,
			awaiting: tickets.filter(
				(ticket) => ticket.status === "awaiting_user",
			).length,
			urgent: tickets.filter(
				(ticket) => ticket.priority === "urgent",
			).length,
		}),
		[tickets],
	);

	const statusBreakdown = useMemo(
		() =>
			[
				{
					key: "open",
					label: "Open",
					count: counts.open,
					bar: "bg-amber-400",
				},
				{
					key: "in_progress",
					label: "In progress",
					count: counts.inProgress,
					bar: "bg-sky-500",
				},
				{
					key: "awaiting_user",
					label: "Awaiting user",
					count: counts.awaiting,
					bar: "bg-violet-500",
				},
				{
					key: "resolved",
					label: "Resolved",
					count: tickets.filter(
						(ticket) => ticket.status === "resolved",
					).length,
					bar: "bg-emerald-500",
				},
			].filter((item) => item.count > 0),
		[counts, tickets],
	);

	const statusTotal = statusBreakdown.reduce(
		(sum, item) => sum + item.count,
		0,
	);

	/* Normalize pagination values from the API */

	const totalRecordsValue =
		pagination.total ??
		pagination.totalRecords ??
		pagination.total_records ??
		pagination.totalCount ??
		pagination.total_count ??
		null;

	const totalRecords =
		totalRecordsValue !== null && totalRecordsValue !== undefined
			? Number(totalRecordsValue)
			: null;

	const totalPagesValue =
		pagination.totalPages ??
		pagination.total_pages ??
		pagination.lastPage ??
		pagination.last_page ??
		(totalRecords !== null
			? Math.ceil(totalRecords / pageSize)
			: null);

	const totalPages =
		totalPagesValue !== null && totalPagesValue !== undefined
			? Number(totalPagesValue)
			: null;

	const currentPage = Number(
		pagination.page ??
			pagination.currentPage ??
			pagination.current_page ??
			page,
	);

	/* ------------------------------ View preferences ------------------------------ */

	const baseColumns = ALL_COLUMNS;

	const tableColumns = baseColumns.filter(
		(column) => !prefs.hiddenColumns.includes(column),
	);

	const defaultCardFields = DEFAULT_CARD_FIELDS.filter((column) =>
		baseColumns.includes(column),
	);

	const cardFields = prefs.cardFields
		? prefs.cardFields.filter((column) => baseColumns.includes(column))
		: defaultCardFields;

	function toggleColumn(column) {
		const hidden = prefs.hiddenColumns;

		if (hidden.includes(column)) {
			prefs.setHiddenColumns(
				hidden.filter((item) => item !== column),
			);
		} else if (tableColumns.length > 1) {
			prefs.setHiddenColumns([...hidden, column]);
		}
	}

	function toggleCardField(column) {
		const next = cardFields.includes(column)
			? cardFields.filter((item) => item !== column)
			: cardFields.length < MAX_CARD_FIELDS
				? [...cardFields, column]
				: cardFields;

		prefs.setCardFields(
			baseColumns.filter((item) => next.includes(item)),
		);
	}

	/* ------------------------------ Column filtering ------------------------------ */

	const filteredRows = useMemo(() => {
		const activeFilters = Object.entries(columnFilters).filter(
			([, value]) => String(value || "").trim(),
		);

		if (!activeFilters.length) return tickets;

		return tickets.filter((ticket) =>
			activeFilters.every(([column, value]) =>
				String(getColumnValue(ticket, column))
					.toLowerCase()
					.includes(String(value).trim().toLowerCase()),
			),
		);
	}, [tickets, columnFilters]);

	function updateColumnFilter(column, value) {
		setColumnFilters((previous) => ({
			...previous,
			[column]: value,
		}));
	}

	/* --------------------------------- Sorting --------------------------------- */

	const [sortKey, setSortKey] = useState("");
	const [sortDir, setSortDir] = useState("asc");

	const sortedRows = useMemo(() => {
		if (!sortKey) return filteredRows;

		const direction = sortDir === "asc" ? 1 : -1;

		return [...filteredRows].sort(
			(first, second) =>
				direction *
				compareValues(
					sortKey,
					getColumnValue(first, sortKey),
					getColumnValue(second, sortKey),
				),
		);
	}, [filteredRows, sortKey, sortDir]);

	function toggleSort(column) {
		if (sortKey !== column) {
			setSortKey(column);
			setSortDir("asc");
		} else if (sortDir === "asc") {
			setSortDir("desc");
		} else {
			setSortKey("");
			setSortDir("asc");
		}
	}

	/* -------------------------------- Selection -------------------------------- */

	const allSelected =
		filteredRows.length > 0 &&
		filteredRows.every((ticket) => selectedIds.includes(ticket.id));

	const selectedRows = sortedRows.filter((ticket) =>
		selectedIds.includes(ticket.id),
	);

	function toggleRow(id) {
		setSelectedIds((previous) =>
			previous.includes(id)
				? previous.filter((item) => item !== id)
				: [...previous, id],
		);
	}

	function toggleAll() {
		setSelectedIds(
			allSelected ? [] : filteredRows.map((ticket) => ticket.id),
		);
	}

	/* -------------------------------- Export data -------------------------------- */

	const normalizedRows = useCallback(
		(rowsToNormalize) =>
			rowsToNormalize.map((ticket) => {
				const customer = getCustomer(ticket);

				return {
					id: ticket.id ?? null,
					ticket_number: ticket.ticket_number ?? null,
					subject: ticket.subject ?? null,
					description: ticket.description ?? null,
					user_id: customer?.id ?? ticket.user_id ?? null,
					customer_name: getUserName(customer),
					customer_email: customer?.email ?? null,
					customer_phone: customer?.phone ?? null,
					category: getCategoryLabel(ticket.category),
					ticket_type: ticket.ticket_type ?? "support",
					status: ticket.status ?? null,
					priority: ticket.priority ?? null,
					errand_id:
						ticket.errand_id ??
						ticket.related_erand_id ??
						null,
					created_at: ticket.created_at ?? null,
					updated_at: ticket.updated_at ?? null,
				};
			}),
		[],
	);

	function handleExport(format) {
		const rowsToExport = selectedRows.length
			? selectedRows
			: sortedRows;

		exportRows(format, {
			section: "support",
			dataset: "tickets",
			columns: EXPORT_COLUMNS,
			rows: normalizedRows(rowsToExport),
			scope: selectedRows.length ? "selected" : `page-${page}`,
		});
	}

	/* ------------------------------ Customer profile ------------------------------ */

	const openCustomerProfile = useCallback(
		(profile, fallbackId) => {
			setSelectedTicketId(null);
			entities.openProfile(profile, fallbackId);
		},
		[entities.openProfile],
	);

	/* ------------------------------ Ticket details ------------------------------ */

	const closeDetails = useCallback(() => {
		setSelectedTicketId(null);
		loadTickets({ silent: true });
	}, [loadTickets]);

	/* -------------------------------- Pagination -------------------------------- */

	const rangeFrom =
		tickets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;

	const rangeTo =
		tickets.length > 0
			? (currentPage - 1) * pageSize + tickets.length
			: 0;

	/* ------------------------------- Shared card context ------------------------------- */

	const cardContext = {
		openProfile: openCustomerProfile,
		openErrand: entities.openErrand,
		expandText: setTextDialog,
	};

	/* --------------------------------- Render --------------------------------- */

	return (
		<div className="space-y-6 pb-8">
			{/* Page heading */}

			<header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
				<div className="min-w-0">
					<p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
						ERANDER administration
					</p>

					<h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
						Support management
					</h1>

					<p className="mt-2 max-w-3xl text-sm leading-6 text-content-muted">
						Review customer requests, manage issues and monitor
						support conversations.
					</p>
				</div>

				<div className="flex flex-col gap-2 lg:items-end">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => loadTickets({ silent: true })}
							disabled={loading || refreshing}
							className={`${BTN_GHOST} h-10 !px-3.5 !py-0`}
						>
							{refreshing || loading ? (
								<LoaderCircle
									size={15}
									className="animate-spin"
								/>
							) : (
								<RefreshCw size={15} />
							)}
							<span>Refresh queue</span>
						</button>

						<Popover
							icon={ArrowDownToLine}
							label={
								selectedRows.length
									? `Export ${selectedRows.length}`
									: "Export"
							}
							disabled={!sortedRows.length || loading}
							width="w-60"
						>
							{(close) => (
								<div>
									<p className="px-2 pb-1.5 pt-1 text-xs text-content-muted">
										{selectedRows.length
											? `${selectedRows.length} selected tickets`
											: "Filtered tickets on this page"}
									</p>

									{[
										{
											value: "csv",
											label: "CSV",
											icon: FileSpreadsheet,
										},
										{
											value: "json",
											label: "JSON",
											icon: FileJson,
										},
										{
											value: "tsv",
											label: "TSV",
											icon: FileText,
										},
									].map(({ value, label, icon: Icon }) => (
										<button
											key={value}
											type="button"
											onClick={() => {
												handleExport(value);
												close();
											}}
											className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold text-content transition hover:bg-surface-muted"
										>
											<Icon
												size={16}
												className="text-content-muted"
											/>
											Export as {label}
										</button>
									))}
								</div>
							)}
						</Popover>
					</div>

					<LastUpdated date={lastUpdated} />
				</div>
			</header>

			{/* Statistics */}

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					label="Open tickets"
					value={loading ? "—" : counts.open}
					hint="On this page"
					tone={counts.open ? "amber" : "default"}
				/>

				<StatCard
					label="In progress"
					value={loading ? "—" : counts.inProgress}
					hint="Currently being handled"
				/>

				<StatCard
					label="Awaiting user"
					value={loading ? "—" : counts.awaiting}
					hint="Waiting for a reply"
				/>

				<StatCard
					label="Urgent tickets"
					value={loading ? "—" : counts.urgent}
					hint="Priority requires attention"
					tone={counts.urgent ? "rose" : "default"}
				/>
			</div>

			{/* Status breakdown */}

			{statusTotal > 0 && !loading ? (
				<section className="rounded-2xl border border-line bg-surface-white px-4 py-3.5">
					<div className="flex items-baseline justify-between gap-3">
						<p className="text-xs font-semibold text-content-muted">
							Ticket status breakdown (this page)
						</p>

						<p className="text-[11px] text-content-subtle">
							Select a status to filter
						</p>
					</div>

					<div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
						{statusBreakdown.map((item) => (
							<button
								key={item.key}
								type="button"
								title={`${item.label}: ${item.count}`}
								onClick={() =>
									setStatus((current) =>
										current === item.key ? "" : item.key,
									)
								}
								style={{
									width: `${(item.count / statusTotal) * 100}%`,
								}}
								className={`${item.bar} h-full transition hover:opacity-80`}
							/>
						))}
					</div>

					<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
						{statusBreakdown.map((item) => (
							<button
								key={item.key}
								type="button"
								onClick={() =>
									setStatus((current) =>
										current === item.key ? "" : item.key,
									)
								}
								className="inline-flex items-center gap-1.5 text-xs text-content-muted transition hover:text-content"
							>
								<span
									className={`h-2 w-2 rounded-full ${item.bar}`}
								/>
								{item.label}
								<span className="font-bold tabular-nums text-content">
									{item.count}
								</span>
							</button>
						))}
					</div>
				</section>
			) : null}

			{/* Support records */}

			<section className="overflow-hidden rounded-3xl border border-line bg-surface-white">
				<RecordsToolbar
					title="Support ticket queue"
					subtitle="Live support requests from ERANDER customers"
					searchInput={searchInput}
					onSearchInput={setSearchInput}
					searchRef={searchRef}
					statusOptions={STATUS_VALUES}
					status={status}
					onStatus={setStatus}
					search={search}
					hasFilters={hasFilters}
					onClearFilters={clearFilters}
					view={prefs.view}
					onView={prefs.setView}
					dense={prefs.dense}
					onDense={prefs.setDense}
					columns={baseColumns}
					hiddenColumns={prefs.hiddenColumns}
					onToggleColumn={toggleColumn}
					onShowAllColumns={() => prefs.setHiddenColumns([])}
					cardFields={cardFields}
					onToggleCardField={toggleCardField}
					onResetCardFields={() => prefs.setCardFields(null)}
					sortKey={sortKey}
					sortDir={sortDir}
					onSort={toggleSort}
					onClearSort={() => setSortKey("")}
					onResetView={prefs.reset}
					cardColumnsByBreakpoint={cardColumnsByBreakpoint}
					onCardColumnsByBreakpointChange={
						updateCardColumnsByBreakpoint
					}
				/>

				{/* Additional filters */}

				<div className="grid gap-3 border-b border-line-soft bg-surface-muted/40 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[repeat(2,minmax(0,1fr))_auto] xl:items-end">
					<Select
						label="Priority"
						options={PRIORITY_OPTIONS}
						value={priority}
						onChange={setPriority}
						searchable={false}
						clearable={false}
					/>

					<Select
						label="Ticket type"
						options={TYPE_OPTIONS}
						value={ticketType}
						onChange={setTicketType}
						searchable={false}
						clearable={false}
					/>

					<button
						type="button"
						onClick={clearFilters}
						disabled={!hasFilters}
						className={`${BTN_GHOST} h-11 shrink-0 !py-0`}
					>
						<Filter size={14} />
						Clear all filters
					</button>
				</div>

				{/* Bulk actions */}

				{selectedIds.length > 0 ? (
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-brand-pale px-4 py-2.5 text-sm sm:px-5">
						<p className="font-bold text-brand">
							{selectedIds.length} selected
						</p>

						<div className="flex flex-wrap items-center gap-3 text-xs font-bold text-brand">
							<button
								type="button"
								onClick={() =>
									copyText(
										selectedRows
											.map((ticket) => ticket.id)
											.filter(Boolean)
											.join("\n"),
										"Ticket IDs copied",
									)
								}
								className="inline-flex items-center gap-1 underline underline-offset-2"
							>
								<Copy size={12} />
								Copy IDs
							</button>

							<button
								type="button"
								onClick={() =>
									copyText(
										normalizedRows(selectedRows),
										"Selected tickets copied as JSON",
									)
								}
								className="inline-flex items-center gap-1 underline underline-offset-2"
							>
								<FileJson size={12} />
								Copy JSON
							</button>

							<button
								type="button"
								onClick={() => handleExport("csv")}
								className="inline-flex items-center gap-1 underline underline-offset-2"
							>
								<FileSpreadsheet size={12} />
								Export CSV
							</button>

							<button
								type="button"
								onClick={() => setSelectedIds([])}
								className="underline underline-offset-2"
							>
								Clear selection
							</button>
						</div>
					</div>
				) : null}

				{/* Loading, error and data */}

				{loading ? (
					prefs.view === "cards" ? (
						<SkeletonCards />
					) : (
						<SkeletonRows />
					)
				) : error ? (
					<div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
						<span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
							<AlertCircle size={26} />
						</span>

						<p className="mt-4 font-extrabold text-content">
							Unable to load support queue
						</p>

						<p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
							{error}
						</p>

						<button
							type="button"
							onClick={() => loadTickets()}
							className={`${BTN_NAVY} mt-5`}
						>
							<RefreshCw size={15} />
							Try again
						</button>
					</div>
				) : sortedRows.length === 0 ? (
					<EmptyState
						onClear={clearFilters}
						hasFilters={hasFilters}
					/>
				) : prefs.view === "cards" ? (
					<RecordsCards
						rows={sortedRows}
						fields={cardFields}
						section="support"
						selectedIds={selectedIds}
						onToggleRow={toggleRow}
						onOpen={(ticket) => setSelectedTicketId(ticket.id)}
						ctx={cardContext}
						cardColumnsByBreakpoint={cardColumnsByBreakpoint}
					/>
				) : (
					<RecordsTable
						rows={sortedRows}
						columns={tableColumns}
						section="support"
						dense={prefs.dense}
						selectedIds={selectedIds}
						allSelected={allSelected}
						onToggleRow={toggleRow}
						onToggleAll={toggleAll}
						sortKey={sortKey}
						sortDir={sortDir}
						onSort={toggleSort}
						onOpen={(ticket) => setSelectedTicketId(ticket.id)}
						columnFilters={columnFilters}
						renderCell={(ticket, column) => (
							<TicketCell
								ticket={ticket}
								column={column}
								onExpand={setTextDialog}
								onOpenCustomer={openCustomerProfile}
							/>
						)}
					/>
				)}

				{/* Pagination */}

				<footer className="flex flex-col gap-3 border-t border-line-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
					<p className="text-xs text-content-muted">
						{tickets.length
							? `${rangeFrom}–${rangeTo} of ${
									totalRecords !== null
										? totalRecords.toLocaleString()
										: tickets.length.toLocaleString()
								} records`
							: "Live database records"}

						{sortKey && prefs.view === "table"
							? ` · sorted by ${humanize(sortKey)} (this page)`
							: ""}
					</p>

					<div className="flex flex-wrap items-center gap-3">
						<div
							role="group"
							aria-label="Rows per page"
							className="flex items-center gap-1 rounded-full bg-surface-muted p-1"
						>
							{PAGE_SIZES.map((size) => (
								<button
									key={size}
									type="button"
									aria-pressed={pageSize === size}
									onClick={() => {
										setPageSize(size);
										setPage(1);
									}}
									className={`h-7 min-w-9 rounded-full px-2 text-xs font-bold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
										pageSize === size
											? "bg-surface-white text-content shadow-sm"
											: "text-content-muted hover:text-content"
									}`}
								>
									{size}
								</button>
							))}
						</div>

						<div className="flex items-center gap-2">
							<button
								type="button"
								disabled={loading || page <= 1}
								onClick={() =>
									setPage((value) =>
										Math.max(1, value - 1),
									)
								}
								className={`${BTN_GHOST} !px-3.5 !py-2 text-xs`}
							>
								<ChevronLeft size={14} aria-hidden="true" />
								<span className="hidden sm:inline">
									Previous
								</span>
							</button>

							<span className="px-1 text-xs font-semibold tabular-nums text-content-muted">
								{totalPages
									? `${currentPage} / ${totalPages}`
									: "—"}
							</span>

							<button
								type="button"
								disabled={
									loading ||
									!totalPages ||
									page >= totalPages
								}
								onClick={() =>
									setPage((value) => value + 1)
								}
								className={`${BTN_GHOST} !px-3.5 !py-2 text-xs`}
							>
								<span className="hidden sm:inline">Next</span>
								<ChevronRight size={14} aria-hidden="true" />
							</button>
						</div>
					</div>
				</footer>
			</section>

			{/* Ticket details, customer profile and text dialogs */}

			{selectedTicketId ? (
				<AdminSupportTicketDetails
					ticketId={selectedTicketId}
					onClose={closeDetails}
					onOpenCustomer={openCustomerProfile}
				/>
			) : null}

			<UserProfileModal
				loading={entities.profileLoading}
				details={entities.profileDetails}
				error={entities.profileError}
				onClose={entities.closeProfile}
			/>

			<TextDialog
				data={textDialog}
				onClose={() => setTextDialog(null)}
			/>
		</div>
	);
}