import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AlertCircle,
	ArrowDownToLine,
	Banknote,
	ChevronLeft,
	ChevronRight,
	Copy,
	FileJson,
	FileSpreadsheet,
	FileText,
	Filter,
	LoaderCircle,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { listAdminFundReleaseRequests } from "@/services/admin/fundReleasesApi";

import RecordsCards from "../shared/data-table/RecordsCards";
import {
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
import { BTN_GHOST, BTN_NAVY } from "../shared/data-table/recordsStyles";
import useViewPrefs from "../shared/data-table/useViewPrefs";
import {
	MAX_CARD_FIELDS,
	PAGE_SIZES,
	compareValues,
	copyText,
	exportRows,
	humanize,
} from "../shared/data-table/recordsUtils";

import FundReleaseDetails from "./FundReleaseDetails";
import {
	RELEASE_STATUS_VALUES,
	extractCounts,
	extractItems,
	extractPagination,
	formatDate,
	formatMoney,
	getCustomer,
	getEranderName,
	getErrorMessage,
	getFundReleaseStatusLabel,
	getRequester,
} from "./fundReleaseUtils";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const STATUS_VALUES = RELEASE_STATUS_VALUES;

const STATUS_TONE = {
	pending: "bg-amber-50 text-amber-800 ring-amber-200",
	approved: "bg-sky-50 text-sky-800 ring-sky-200",
	processing: "bg-blue-50 text-blue-800 ring-blue-200",
	released: "bg-emerald-50 text-emerald-800 ring-emerald-200",
	rejected: "bg-rose-50 text-rose-800 ring-rose-200",
	failed: "bg-rose-50 text-rose-800 ring-rose-200",
};

const ALL_COLUMNS = [
	"errand",
	"erander",
	"customer",
	"amount",
	"status",
	"requested_at",
	"reference",
	"id",
];

const DEFAULT_CARD_FIELDS = [
	"erander",
	"customer",
	"amount",
	"status",
	"requested_at",
];

const EXPORT_COLUMNS = [
	"id",
	"errand_title",
	"errand_reference",
	"erander_name",
	"erander_email",
	"customer_name",
	"customer_email",
	"amount",
	"currency",
	"status",
	"provider_reference",
	"requested_at",
	"released_at",
	"rejection_reason",
];

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
		<Badge className={STATUS_TONE[status] || STATUS_TONE.pending}>
			{getFundReleaseStatusLabel(status)}
		</Badge>
	);
}

/* -------------------------------------------------------------------------- */
/*                              COLUMN HELPERS                                */
/* -------------------------------------------------------------------------- */

function getColumnValue(item, column) {
	const errand = item?.errand ?? item?.errand_details ?? {};
	const erander = getRequester(item);
	const customer = getCustomer(item);

	switch (column) {
		case "errand":
			return [errand.title, errand.referenceCode, item.errandId, item.id]
				.filter(Boolean)
				.join(" ");
		case "erander":
			return [erander.name, erander.email, item.eranderId]
				.filter(Boolean)
				.join(" ");
		case "customer":
			return [customer.name, customer.email]
				.filter(Boolean)
				.join(" ");
		case "amount":
			return item.errand?.total ?? item.amount ?? "";
		case "status":
			return getFundReleaseStatusLabel(item.status);
		case "requested_at":
			return formatDate(item.requestedAt ?? item.createdAt, true);
		case "reference":
			return item.providerReference ?? "";
		case "id":
			return item.id ?? "";
		default:
			return item?.[column] ?? "";
	}
}

/* -------------------------------------------------------------------------- */
/*                             FUND RELEASE CELL                              */
/* -------------------------------------------------------------------------- */

function FundReleaseCell({ item, column, onExpand }) {
	const errand = item.errand || {};
	const erander = getRequester(item);
	const customer = getCustomer(item);

	if (column === "errand") {
		return (
			<div className="max-w-[220px]">
				<div className="flex items-center gap-1">
					<span className="text-[11px] font-extrabold tracking-wide text-brand">
						{errand.referenceCode || "Errand"}
					</span>
					<CopyButton
						value={errand.referenceCode || item.id}
						label="Errand reference copied"
					/>
				</div>
				<div className="mt-1 flex max-w-full items-center gap-1">
					<TruncatedText
						text={errand.title || "Untitled errand"}
						title="Errand title"
						limit={38}
						className="text-sm font-bold text-content"
						onExpand={onExpand}
					/>
				</div>
			</div>
		);
	}

	if (column === "erander") {
		return (
			<div className="min-w-[170px]">
				<p className="max-w-[200px] truncate text-xs font-bold text-content">
					{getEranderName(item)}
				</p>
				<div className="mt-0.5 flex max-w-[200px] items-center gap-1">
					<TruncatedText
						text={erander.email || "Email unavailable"}
						title="Erander email"
						limit={30}
						className="text-[11px] text-content-subtle"
						onExpand={onExpand}
					/>
					<CopyButton
						value={erander.email}
						label="Erander email copied"
					/>
				</div>
			</div>
		);
	}

	if (column === "customer") {
		return (
			<div className="min-w-[150px]">
				<p className="max-w-[180px] truncate text-xs font-bold text-content">
					{customer.name || "Unknown"}
				</p>
				<div className="mt-0.5 flex max-w-[180px] items-center gap-1">
					<TruncatedText
						text={customer.email || "Email unavailable"}
						title="Customer email"
						limit={28}
						className="text-[11px] text-content-subtle"
						onExpand={onExpand}
					/>
					<CopyButton
						value={customer.email}
						label="Customer email copied"
					/>
				</div>
			</div>
		);
	}

	if (column === "amount") {
		return (
			<span className="whitespace-nowrap text-sm font-extrabold tabular-nums text-content">
				{formatMoney(
					errand.total ?? item.amount,
					errand.currencyCode ?? item.currencyCode ?? "NGN",
				)}
			</span>
		);
	}

	if (column === "status") {
		return <StatusBadge status={item.status} />;
	}

	if (column === "requested_at") {
		return (
			<span className="whitespace-nowrap text-xs font-semibold text-content-muted">
				{formatDate(item.requestedAt ?? item.createdAt, true)}
			</span>
		);
	}

	if (column === "reference") {
		return (
			<span className="inline-flex max-w-[120px] items-center gap-1">
				<TruncatedText
					text={item.providerReference || "No reference"}
					title="Provider reference"
					limit={16}
					mono
					onExpand={onExpand}
				/>
				<CopyButton
					value={item.providerReference}
					label="Provider reference copied"
				/>
			</span>
		);
	}

	if (column === "id") {
		return (
			<span className="inline-flex max-w-[100px] items-center gap-1">
				<TruncatedText
					text={item.id || "—"}
					title="Request ID"
					limit={10}
					mono
					onExpand={onExpand}
				/>
				<CopyButton value={item.id} label="Request ID copied" />
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
				<Banknote size={24} />
			</span>

			<h3 className="mt-4 text-base font-extrabold text-brand">
				No fund-release requests found
			</h3>

			<p className="mt-1 max-w-sm text-sm leading-6 text-content-muted">
				{hasFilters
					? "Try adjusting your search or filters."
					: "Requests submitted by assigned eranders will appear here."}
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
/*                              MAIN PAGE                                     */
/* -------------------------------------------------------------------------- */

export default function FundReleasePage() {
	const { admin } = useAdminAuth();
	const permissions = admin?.permissions || [];
	const canManage =
		permissions.includes("*") || permissions.includes("finance:manage");

	const [items, setItems] = useState([]);
	const [counts, setCounts] = useState({});

	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("pending");

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

	const [selectedId, setSelectedId] = useState(null);
	const [selectedIds, setSelectedIds] = useState([]);
	const [lastUpdated, setLastUpdated] = useState(null);

	const prefs = useViewPrefs("finance", "fund-releases");
	const searchRef = useRef(null);

	/* ---------------------- Responsive card column state ---------------------- */

	const cardColumnsStorageKey =
		"erander-admin-card-columns:finance:fund-releases";

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
			/* non-fatal */
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

	/* ------------------------------- Load list ------------------------------- */

	const loadList = useCallback(
		async ({ silent = false } = {}) => {
			if (silent) setRefreshing(true);
			else setLoading(true);

			setError("");

			try {
				const response = await listAdminFundReleaseRequests({
					status,
					search,
					page,
					limit: pageSize,
				});

				setItems(extractItems(response));
				setCounts(extractCounts(response));
				setPagination(extractPagination(response, page, pageSize));
				setLastUpdated(new Date());
			} catch (requestError) {
				const message = getErrorMessage(
					requestError,
					"Unable to load fund-release requests.",
				);
				setError(message);
				if (silent) toast.error(message);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[status, search, page, pageSize],
	);

	useEffect(() => {
		loadList();
	}, [loadList]);

	/* Reset page/selection on filter changes */

	useEffect(() => {
		setPage(1);
		setSelectedIds([]);
	}, [search, status]);

	useEffect(() => {
		setSelectedIds([]);
	}, [page, pageSize, columnFilters]);

	/* --------------------------------- Filters --------------------------------- */

	const clearFilters = useCallback(() => {
		setSearchInput("");
		setSearch("");
		setStatus("pending");
		setColumnFilters({});
		setPage(1);
		setSelectedIds([]);
	}, []);

	const hasFilters = Boolean(
		searchInput ||
			search ||
			(status && status !== "pending") ||
			Object.values(columnFilters).some(Boolean),
	);

	/* -------------------------------- Statistics -------------------------------- */

	const pendingCount = Number(counts.pending || 0);
	const processingCount = Number(counts.processing || 0);
	const releasedCount = Number(counts.released || 0);
	const failedCount = Number(counts.failed || 0);

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
			prefs.setHiddenColumns(hidden.filter((item) => item !== column));
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
		prefs.setCardFields(baseColumns.filter((item) => next.includes(item)));
	}

	/* ------------------------------ Column filtering ------------------------------ */

	const filteredRows = useMemo(() => {
		const activeFilters = Object.entries(columnFilters).filter(([, value]) =>
			String(value || "").trim(),
		);
		if (!activeFilters.length) return items;
		return items.filter((item) =>
			activeFilters.every(([column, value]) =>
				String(getColumnValue(item, column))
					.toLowerCase()
					.includes(String(value).trim().toLowerCase()),
			),
		);
	}, [items, columnFilters]);

	function updateColumnFilter(column, value) {
		setColumnFilters((previous) => ({ ...previous, [column]: value }));
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
		filteredRows.every((item) => selectedIds.includes(item.id));

	const selectedRows = sortedRows.filter((item) =>
		selectedIds.includes(item.id),
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
			allSelected ? [] : filteredRows.map((item) => item.id),
		);
	}

	/* -------------------------------- Export -------------------------------- */

	const normalizedRows = useCallback(
		(rowsToNormalize) =>
			rowsToNormalize.map((item) => {
				const errand = item.errand || {};
				const erander = getRequester(item);
				const customer = getCustomer(item);
				return {
					id: item.id ?? null,
					errand_title: errand.title ?? null,
					errand_reference: errand.referenceCode ?? null,
					erander_name: erander.name ?? null,
					erander_email: erander.email ?? null,
					customer_name: customer.name ?? null,
					customer_email: customer.email ?? null,
					amount: errand.total ?? item.amount ?? null,
					currency:
						errand.currencyCode ?? item.currencyCode ?? "NGN",
					status: item.status ?? null,
					provider_reference: item.providerReference ?? null,
					requested_at: item.requestedAt ?? null,
					released_at: item.releasedAt ?? null,
					rejection_reason: item.rejectionReason ?? null,
				};
			}),
		[],
	);

	function handleExport(format) {
		const rowsToExport = selectedRows.length ? selectedRows : sortedRows;
		exportRows(format, {
			section: "finance",
			dataset: "fund-releases",
			columns: EXPORT_COLUMNS,
			rows: normalizedRows(rowsToExport),
			scope: selectedRows.length ? "selected" : `page-${page}`,
		});
	}

	/* ------------------------------ Details modal ------------------------------ */

	const closeDetails = useCallback(() => {
		setSelectedId(null);
		loadList({ silent: true });
	}, [loadList]);

	/* -------------------------------- Pagination -------------------------------- */

	const totalRecords =
		pagination.total !== null && pagination.total !== undefined
			? Number(pagination.total)
			: items.length;

	const totalPages =
		pagination.totalPages !== null && pagination.totalPages !== undefined
			? Number(pagination.totalPages)
			: Math.max(1, Math.ceil(items.length / pageSize));

	const currentPage = Number(pagination.page ?? page);

	const rangeFrom = items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
	const rangeTo =
		items.length > 0 ? (currentPage - 1) * pageSize + items.length : 0;

	/* ------------------------------ Card context ------------------------------ */

	const cardContext = {
		openDetails: (item) => setSelectedId(item.id),
	};

	/* --------------------------------- Render --------------------------------- */

	return (
		<div className="space-y-6 pb-8">
			{/* Header */}

			<header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
				<div className="min-w-0">
					<p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
						ERANDER finance
					</p>

					<h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
						Errand fund releases
					</h1>

					<p className="mt-2 max-w-3xl text-sm leading-6 text-content-muted">
						Review erander requests, verify customer funding and
						security, then initiate the full execution-fund
						transfer. Security-deposit releases are managed
						separately.
					</p>
				</div>

				<div className="flex flex-col gap-2 lg:items-end">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => loadList({ silent: true })}
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
											? `${selectedRows.length} selected requests`
											: "Filtered requests on this page"}
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
					label="Awaiting review"
					value={loading ? "—" : pendingCount}
					hint="Pending requests"
					tone={pendingCount ? "amber" : "default"}
				/>

				<StatCard
					label="Transfer processing"
					value={loading ? "—" : processingCount}
					hint="Awaiting Paystack confirmation"
				/>

				<StatCard
					label="Released"
					value={loading ? "—" : releasedCount}
					hint="Completed transfers"
				/>

				<StatCard
					label="Failed transfers"
					value={loading ? "—" : failedCount}
					hint="Require manual review"
					tone={failedCount ? "rose" : "default"}
				/>
			</div>

			{/* Records */}

			<section className="overflow-hidden rounded-3xl border border-line bg-surface-white">
				<RecordsToolbar
					title="Fund-release queue"
					subtitle="Errand full-execution-fund requests awaiting review"
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

				{/* Policy notice + clear filters */}

				<div className="grid gap-3 border-b border-line-soft bg-surface-muted/40 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
					<div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
						<div className="flex items-start gap-2">
							<ShieldCheck size={14} className="mt-0.5 shrink-0" />
							<p>
								Every release is full-only. A transfer remains
								processing until Paystack confirms its exact
								reference, currency and amount. If a provider
								response is uncertain, verify the existing
								transfer; do not submit a second transfer.
							</p>
						</div>
					</div>

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
											.map((item) => item.id)
											.filter(Boolean)
											.join("\n"),
										"Request IDs copied",
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
										"Selected requests copied as JSON",
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
							Unable to load fund-release queue
						</p>

						<p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
							{error}
						</p>

						<button
							type="button"
							onClick={() => loadList()}
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
						section="finance"
						selectedIds={selectedIds}
						onToggleRow={toggleRow}
						onOpen={(item) => setSelectedId(item.id)}
						ctx={cardContext}
						cardColumnsByBreakpoint={cardColumnsByBreakpoint}
					/>
				) : (
					<RecordsTable
						rows={sortedRows}
						columns={tableColumns}
						section="finance"
						dense={prefs.dense}
						selectedIds={selectedIds}
						allSelected={allSelected}
						onToggleRow={toggleRow}
						onToggleAll={toggleAll}
						sortKey={sortKey}
						sortDir={sortDir}
						onSort={toggleSort}
						onOpen={(item) => setSelectedId(item.id)}
						columnFilters={columnFilters}
						renderCell={(item, column) => (
							<FundReleaseCell
								item={item}
								column={column}
								onExpand={null}
							/>
						)}
					/>
				)}

				{/* Pagination */}

				<footer className="flex flex-col gap-3 border-t border-line-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
					<p className="text-xs text-content-muted">
						{items.length
							? `${rangeFrom}–${rangeTo} of ${Number(
									totalRecords || items.length,
							  ).toLocaleString()} records`
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
									setPage((value) => Math.max(1, value - 1))
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
									loading || !totalPages || page >= totalPages
								}
								onClick={() => setPage((value) => value + 1)}
								className={`${BTN_GHOST} !px-3.5 !py-2 text-xs`}
							>
								<span className="hidden sm:inline">Next</span>
								<ChevronRight size={14} aria-hidden="true" />
							</button>
						</div>
					</div>
				</footer>
			</section>

			{/* Details modal */}

			{selectedId ? (
				<FundReleaseDetails
					requestId={selectedId}
					canManage={canManage}
					onClose={closeDetails}
					onChanged={() => loadList({ silent: true })}
				/>
			) : null}
		</div>
	);
}