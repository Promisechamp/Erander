import { useEffect, useMemo, useRef, useState } from "react";
import {
	AlertCircle,
	ArrowDownToLine,
	ChevronLeft,
	ChevronRight,
	Copy,
	FileJson,
	FileSpreadsheet,
	FileText,
	Play,
	RefreshCw,
	LoaderCircle,
	ShieldCheck,
} from "lucide-react";

import ActionModal from "./records/ActionModal";
import ErrandDetailsModal from "./records/ErrandDetailsModal";
import RecordDetailsModal from "./records/RecordDetailsModal";
import TransactionDetailsModal from "./records/TransactionDetailsModal";
import RecordsCards from "./records/RecordsCards";
import RecordsStats from "./records/RecordsStats";
import RecordsTable from "./records/RecordsTable";
import RecordsToolbar from "./records/RecordsToolbar";
import RoleManagerModal from "./records/RoleManagerModal";
import TextDialog from "./records/TextDialog";
import UserProfileModal from "./records/UserProfileModal";
import WithdrawalConfirmModal from "./records/WithdrawalConfirmModal";
import {
	Banner,
	LastUpdated,
	Popover,
	SkeletonCards,
	SkeletonRows,
} from "./records/RecordsUI";
import { BTN_GHOST, BTN_GREEN, BTN_NAVY } from "./records/recordsStyles";
import useAdminRecords from "./records/useAdminRecords";
import { getAdminTransactionDetails } from "@/services/admin/adminRecordsApi";
import useEntityDetails from "./records/useEntityDetails";
import useRecordActions from "./records/useRecordActions";
import useViewPrefs from "./records/useViewPrefs";
import {
	EXCLUDED_USER_COLUMNS,
	MAX_CARD_FIELDS,
	PAGE_SIZES,
	can,
	compareValues,
	copyText,
	exportRows,
	getDefaultCardColumns,
	humanize,
} from "./records/recordsUtils";

export default function AdminRecordsPage({
	section,
	title,
	description,
	datasets,
	initialDataset,
	statusOptions = [
		"pending",
		"active",
		"approved",
		"processing",
		"completed",
		"successful",
		"failed",
		"rejected",
		"cancelled",
		"disputed",
		"resolved",
	],
	note,
	enableWithdrawalActions = false,
}) {
	const records = useAdminRecords({ section, datasets, initialDataset });
	const {
		dataset,
		page,
		pageSize,
		rows,
		columns,
		payload,
		loading,
		refreshing,
		error,
		permissions,
	} = records;

	const prefs = useViewPrefs(section, dataset);
	const entities = useEntityDetails();

	const [selectedRow, setSelectedRow] = useState(null);
	const [selectedIds, setSelectedIds] = useState([]);
	const [sortKey, setSortKey] = useState("");
	const [sortDir, setSortDir] = useState("asc");
	const [textDialog, setTextDialog] = useState(null);
	const [transactionModal, setTransactionModal] = useState({ open: false, row: null, kind: "wallet", result: null, loading: false, error: "" });

	const searchRef = useRef(null);

	const actions = useRecordActions({
		reload: records.reload,
		onDone: () => setSelectedRow(null),
		reopenErrand: entities.openErrand,
	});

	/* ------------------------------ Permissions ------------------------------ */
	const perms = {
		wallets: can(permissions, "wallets:manage"),
		roles: can(permissions, "admin_roles:manage"),
		users: can(permissions, "users:restrict"),
		errands: can(permissions, "errands:manage"),
		verification: can(permissions, "verification:manage"),
		reviewDeposits: can(permissions, "security_deposits:review"),
		settleDeposits: can(permissions, "security_deposits:settle"),
		reconciliation: can(permissions, "reconciliation:manage"),
	};

	/* -------------------------------- Columns -------------------------------- */
	const baseColumns = useMemo(
		() =>
			columns.filter(
				(column) =>
					!(section === "users" && EXCLUDED_USER_COLUMNS.includes(column)),
			),
		[columns, section],
	);

	const tableColumns = useMemo(
		() => baseColumns.filter((column) => !prefs.hiddenColumns.includes(column)),
		[baseColumns, prefs.hiddenColumns],
	);

	const defaultCardFields = useMemo(
		() => getDefaultCardColumns(baseColumns, section, rows[0]),
		[baseColumns, section, rows],
	);

	const cardFields = useMemo(
		() =>
			prefs.cardFields
				? prefs.cardFields.filter((column) => baseColumns.includes(column))
				: defaultCardFields,
		[prefs.cardFields, baseColumns, defaultCardFields],
	);

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

	/* --------------------------------- Sorting -------------------------------- */
	const sortedRows = useMemo(() => {
		if (!sortKey) return rows;

		const direction = sortDir === "asc" ? 1 : -1;

		return [...rows].sort(
			(first, second) =>
				direction * compareValues(sortKey, first[sortKey], second[sortKey]),
		);
	}, [rows, sortKey, sortDir]);

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

	/* -------------------------------- Selection ------------------------------- */
	useEffect(() => {
		setSelectedIds([]);
	}, [dataset, page, pageSize, records.search, records.status]);

	useEffect(() => {
		setSortKey("");
	}, [dataset]);

	const allSelected =
		rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

	const toggleRow = (id) =>
		setSelectedIds((previous) =>
			previous.includes(id)
				? previous.filter((item) => item !== id)
				: [...previous, id],
		);

	const toggleAll = () =>
		setSelectedIds(allSelected ? [] : rows.map((row) => row.id));

	const selectedRows = sortedRows.filter((row) => selectedIds.includes(row.id));

	/* ------------------------------- Shortcuts -------------------------------- */
	useEffect(() => {
		const onKeyDown = (event) => {
			if (event.key !== "/" || event.metaKey || event.ctrlKey) return;

			const tag = event.target?.tagName;
			if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
			if (event.target?.isContentEditable) return;

			event.preventDefault();
			searchRef.current?.focus();
		};

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	/* --------------------------------- Handlers ------------------------------- */
	const openTransaction = async (row, kind) => {
		setSelectedRow(null);
		setTransactionModal({ open: true, row, kind, result: null, loading: true, error: "" });
		try {
			const response = await getAdminTransactionDetails(row.id, kind);
			setTransactionModal((current) => current.row?.id === row.id ? { ...current, result: response?.data || null, loading: false } : current);
		} catch (requestError) {
			setTransactionModal((current) => current.row?.id === row.id ? { ...current, loading: false, error: requestError?.message || "Unable to load the complete transaction." } : current);
		}
	};

	const openRow = (row) => {
		if (["errands", "disputes"].includes(section)) { entities.openErrand(row.id); return; }
		const transactionKinds = {
			"wallets:transactions": "wallet",
			"security-deposits:transactions": "security-deposit",
			"security-deposits:reservations": "reservation",
			"security-deposits:claims": "claim",
			"finance:payments": "payment",
			"finance:refunds": "refund",
			"finance:settlements": "settlement",
			"withdrawals:requests": "withdrawal",
		};
		const kind = transactionKinds[`${section}:${dataset}`];
		if (kind) { openTransaction(row, kind); return; }
		setSelectedRow(row);
	};

	const ctx = {
		openProfile: entities.openProfile,
		openErrand: entities.openErrand,
		expandText: setTextDialog,
	};

	function handleExport(format) {
		exportRows(format, {
			section,
			dataset,
			columns: tableColumns.length ? tableColumns : baseColumns,
			rows: selectedRows.length ? selectedRows : sortedRows,
			scope: selectedRows.length ? "selected" : `page-${page}`,
		});
	}

	const selectedDataset = datasets?.find((item) => item.value === dataset);
	const sectionTitle = selectedDataset?.label || humanize(dataset);
	const view = prefs.view;

	const from = payload && rows.length ? (page - 1) * pageSize + 1 : 0;
	const to = payload && rows.length ? (page - 1) * pageSize + rows.length : 0;

	/* ---------------------------------- Render -------------------------------- */
	return (
		<div className="space-y-6">
			{/* Header */}
			<header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
				<div className="min-w-0">
					<p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
						ERANDER administration
					</p>
					<h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
						{title}
					</h1>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-content-muted">
						{description}
					</p>
				</div>

				<div className="flex flex-col gap-2 lg:items-end">
					<div className="flex flex-wrap items-center gap-2">
						{section === "reconciliation" && perms.reconciliation ? (
							<button
								type="button"
								onClick={() => actions.openAction("reconciliation-run", null)}
								className={BTN_GREEN}
							>
								<Play size={15} aria-hidden="true" />
								Run reconciliation
							</button>
						) : null}

						<button
							type="button"
							onClick={() => records.setAutoRefresh(!records.autoRefresh)}
							aria-pressed={records.autoRefresh}
							title="Refresh every 30 seconds"
							className={`inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
								records.autoRefresh
									? "bg-brand-pale text-success-dark ring-1 ring-inset ring-success"
									: "border border-line bg-surface-white text-content-muted hover:bg-surface-muted"
							}`}
						>
							<span
								aria-hidden="true"
								className={`h-2 w-2 rounded-full ${
									records.autoRefresh ? "animate-pulse bg-success" : "bg-content-subtle"
								}`}
							/>
							Live
						</button>

						<button
							type="button"
							onClick={records.reload}
							disabled={loading || refreshing}
							className={`${BTN_GHOST} h-10 !px-3.5 !py-0`}
						>
							{loading || refreshing ? (
								<LoaderCircle size={15} aria-hidden="true" className="animate-spin" />
							) : (
								<RefreshCw size={15} aria-hidden="true" />
							)}

							<span className="hidden sm:inline">Refresh</span>
						</button>

						<Popover
							icon={ArrowDownToLine}
							label={selectedRows.length ? `Export ${selectedRows.length}` : "Export"}
							disabled={!rows.length || loading}
							width="w-60"
						>
							{(close) => (
								<div>
									<p className="px-2 pb-1.5 pt-1 text-xs text-content-muted">
										{selectedRows.length
											? `${selectedRows.length} selected rows`
											: "This page"}
										, visible columns
									</p>

									{[
										{ value: "csv", label: "CSV", icon: FileSpreadsheet },
										{ value: "json", label: "JSON", icon: FileJson },
										{ value: "tsv", label: "TSV", icon: FileText },
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
											<Icon size={16} className="text-content-muted" aria-hidden="true" />
											Export as {label}
										</button>
									))}
								</div>
							)}
						</Popover>
					</div>

					<LastUpdated date={records.lastUpdated} />
				</div>
			</header>

			{note ? (
				<Banner tone="info" icon={ShieldCheck}>
					{note}
				</Banner>
			) : null}

			{actions.message ? (
				<Banner tone="success" onDismiss={actions.clearMessage}>
					{actions.message}
				</Banner>
			) : null}

			{/* Dataset tabs */}
			{datasets?.length > 1 ? (
				<div
					role="group"
					aria-label="Record type"
					className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{datasets.map((item) => {
						const active = item.value === dataset;

						return (
							<button
								key={item.value}
								type="button"
								aria-pressed={active}
								onClick={() => records.changeDataset(item.value)}
								className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
									active
										? "bg-brand text-content-inverse shadow-sm"
										: "border border-line bg-surface-white text-content-muted hover:text-content"
								}`}
							>
								{item.label}
							</button>
						);
					})}
				</div>
			) : null}

			{/* Stats */}
			<RecordsStats
				payload={payload}
				rows={rows}
				columns={baseColumns}
				loading={loading}
				status={records.status}
				hasFilters={records.hasFilters}
				onFilterStatus={records.setStatus}
			/>

			{/* Records */}
			<section
				aria-label={`${sectionTitle} records`}
				className="overflow-hidden rounded-3xl border border-line bg-surface-white"
			>
				<RecordsToolbar
					title={sectionTitle}
					subtitle="Live records from the ERANDER database"
					searchInput={records.searchInput}
					onSearchInput={records.setSearchInput}
					searchRef={searchRef}
					statusOptions={statusOptions}
					status={records.status}
					onStatus={records.setStatus}
					search={records.search}
					hasFilters={records.hasFilters}
					onClearFilters={records.clearFilters}
					view={view}
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
				/>

				{selectedIds.length > 0 ? (
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-brand-pale px-4 py-2.5 text-sm sm:px-5">
						<p className="font-bold text-brand">{selectedIds.length} selected</p>

						<div className="flex flex-wrap items-center gap-3 text-xs font-bold text-brand">
							<button
								type="button"
								onClick={() =>
									copyText(selectedRows.map((row) => row.id).join("\n"), "IDs copied")
								}
								className="inline-flex items-center gap-1 underline underline-offset-2"
							>
								<Copy size={12} aria-hidden="true" />
								Copy IDs
							</button>
							<button
								type="button"
								onClick={() =>
									copyText(selectedRows, "Selected records copied as JSON")
								}
								className="underline underline-offset-2"
							>
								Copy JSON
							</button>
							<button
								type="button"
								onClick={() => handleExport("csv")}
								className="underline underline-offset-2"
							>
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

				{/* Body */}
				{loading ? (
					view === "cards" ? (
						<SkeletonCards />
					) : (
						<SkeletonRows />
					)
				) : error ? (
					<div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
						<span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
							<AlertCircle size={26} aria-hidden="true" />
						</span>
						<p className="mt-4 font-extrabold text-content">Unable to load records</p>
						<p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">
							{error}
						</p>
						<button
							type="button"
							onClick={records.retry}
							className={`${BTN_NAVY} mt-5`}
						>
							<RefreshCw size={15} aria-hidden="true" />
							Try again
						</button>
					</div>
				) : rows.length === 0 ? (
					<div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
						<span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
							<ShieldCheck size={26} aria-hidden="true" />
						</span>
						<p className="mt-4 font-extrabold text-content">No records found</p>
						<p className="mt-1 max-w-sm text-sm leading-6 text-content-muted">
							Try changing the search or status filter. No sample records are shown.
						</p>
						{records.hasFilters ? (
							<button
								type="button"
								onClick={records.clearFilters}
								className={`${BTN_GHOST} mt-5`}
							>
								Clear filters
							</button>
						) : null}
					</div>
				) : view === "cards" ? (
					<RecordsCards
						rows={sortedRows}
						fields={cardFields}
						section={section}
						selectedIds={selectedIds}
						onToggleRow={toggleRow}
						onOpen={openRow}
						ctx={ctx}
					/>
				) : (
					<RecordsTable
						rows={sortedRows}
						columns={tableColumns}
						section={section}
						dense={prefs.dense}
						selectedIds={selectedIds}
						allSelected={allSelected}
						onToggleRow={toggleRow}
						onToggleAll={toggleAll}
						sortKey={sortKey}
						sortDir={sortDir}
						onSort={toggleSort}
						onOpen={openRow}
						ctx={ctx}
					/>
				)}

				{/* Footer */}
				<footer className="flex flex-col gap-3 border-t border-line-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
					<p className="text-xs text-content-muted">
						{payload && rows.length
							? `${from}–${to} of ${Number(payload.total || 0).toLocaleString()} records`
							: "Live database records"}
						{sortKey && view === "table"
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
									onClick={() => records.changePageSize(size)}
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
								onClick={() => records.setPage((value) => Math.max(1, value - 1))}
								className={`${BTN_GHOST} !px-3.5 !py-2 text-xs`}
							>
								<ChevronLeft size={14} aria-hidden="true" />
								<span className="hidden sm:inline">Previous</span>
							</button>

							<span className="px-1 text-xs font-semibold tabular-nums text-content-muted">
								{payload ? `${payload.page} / ${payload.totalPages}` : "—"}
							</span>

							<button
								type="button"
								disabled={loading || !payload || page >= payload.totalPages}
								onClick={() => records.setPage((value) => value + 1)}
								className={`${BTN_GHOST} !px-3.5 !py-2 text-xs`}
							>
								<span className="hidden sm:inline">Next</span>
								<ChevronRight size={14} aria-hidden="true" />
							</button>
						</div>
					</div>
				</footer>
			</section>

			{/* Dialogs */}
			<TransactionDetailsModal
				open={transactionModal.open}
				loading={transactionModal.loading}
				error={transactionModal.error}
				result={transactionModal.result}
				onClose={() => setTransactionModal({ open: false, row: null, kind: "wallet", result: null, loading: false, error: "" })}
				onOpenAdminControls={["withdrawal", "reservation", "claim"].includes(transactionModal.kind) ? () => { setSelectedRow(transactionModal.row); setTransactionModal({ open: false, row: null, kind: "wallet", result: null, loading: false, error: "" }); } : undefined}
			/>

			<RecordDetailsModal
				row={selectedRow}
				section={section}
				dataset={dataset}
				columns={columns}
				pageTitle={title}
				perms={perms}
				enableWithdrawalActions={enableWithdrawalActions}
				onClose={() => setSelectedRow(null)}
				onAction={actions.openAction}
				onRoles={actions.openRoleManager}
				onWithdrawal={actions.openWithdrawalConfirm}
				openProfile={entities.openProfile}
				openErrand={entities.openErrand}
			/>

			<UserProfileModal
				loading={entities.profileLoading}
				details={entities.profileDetails}
				error={entities.profileError}
				onClose={entities.closeProfile}
				onOpenTransaction={(transaction) => openTransaction(transaction, "wallet")}
			/>

			<ErrandDetailsModal
				loading={entities.errandLoading}
				errand={entities.errand}
				error={entities.errandError}
				canManage={perms.errands}
				onToggleOffers={(errand) => actions.openAction("errand-offers", errand)}
				onClose={entities.closeErrand}
				openProfile={entities.openProfile}
			/>

			<ActionModal
				type={actions.actionType}
				row={actions.target}
				form={actions.form}
				setForm={actions.setForm}
				busy={actions.busy}
				error={actions.error}
				onClose={actions.closeAction}
				onConfirm={actions.runAction}
			/>

			<WithdrawalConfirmModal
				confirm={actions.withdrawalConfirm}
				reason={actions.confirmReason}
				setReason={actions.setConfirmReason}
				error={actions.confirmError}
				busy={actions.withdrawalBusy}
				onClose={actions.closeWithdrawalConfirm}
				onConfirm={actions.confirmWithdrawal}
			/>

			<RoleManagerModal
				open={!!actions.roleData || actions.roleBusy}
				busy={actions.roleBusy}
				data={actions.roleData}
				target={actions.roleTarget}
				error={actions.roleError}
				code={actions.roleCode}
				setCode={actions.setRoleCode}
				reason={actions.roleReason}
				setReason={actions.setRoleReason}
				onChange={actions.changeRole}
				onClose={actions.closeRoles}
			/>

			<TextDialog data={textDialog} onClose={() => setTextDialog(null)} />
		</div>
	);
}
