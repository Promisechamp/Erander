/* -------------------------------------------------------------------------- */
/*                          FUND RELEASE UTILITIES                            */
/* -------------------------------------------------------------------------- */

export const RELEASE_STATUS_VALUES = [
	"pending",
	"approved",
	"processing",
	"released",
	"rejected",
	"failed",
];

export const RELEASE_STATUS_OPTIONS = [
	{ label: "All statuses", value: "" },
	{ label: "Pending", value: "pending" },
	{ label: "Approved", value: "approved" },
	{ label: "Processing", value: "processing" },
	{ label: "Released", value: "released" },
	{ label: "Rejected", value: "rejected" },
	{ label: "Failed", value: "failed" },
];

export function getFundReleaseStatusLabel(value) {
	return String(value || "unknown")
		.replaceAll("_", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatMoney(value, currency = "NGN") {
	if (value === null || value === undefined || value === "") return "—";
	const number = Number(value);
	if (!Number.isFinite(number)) return "—";
	try {
		return new Intl.NumberFormat("en-NG", {
			style: "currency",
			currency: currency || "NGN",
			maximumFractionDigits: 2,
		}).format(number);
	} catch {
		return `${currency} ${number.toFixed(2)}`;
	}
}

export function formatMinor(value, currency = "NGN") {
	if (value === null || value === undefined) return "—";
	return formatMoney(Number(value) / 100, currency);
}

export function formatDate(value, short = false) {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return short
		? date.toLocaleString(undefined, {
				year: "numeric",
				month: "short",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
		  })
		: date.toLocaleString();
}

export function getRequester(item) {
	return item?.erander ?? item?.requester ?? item?.user ?? {};
}

export function getEranderName(item) {
	const erander = getRequester(item);
	return erander.name || erander.displayName || erander.email || "Unknown";
}

export function getCustomer(item) {
	return item?.customer ?? item?.errand?.customer ?? {};
}

export function displayName(person) {
	return person?.name || person?.displayName || person?.email || "Unknown";
}

export function getErrorMessage(error, fallback = "Something went wrong.") {
	if (!error) return fallback;
	if (typeof error === "string") return error;
	if (error?.message) return error.message;
	if (error?.response?.data?.message) return error.response.data.message;
	if (error?.error) return error.error;
	return fallback;
}

export function normalizeFundRelease(row) {
	if (!row) return null;
	const payload = row?.data ?? row;
	return payload?.request ? payload : payload;
}

export function extractItems(response) {
	const payload = response?.data ?? response ?? {};
	if (Array.isArray(payload)) return payload;
	if (Array.isArray(payload.items)) return payload.items;
	if (Array.isArray(payload.rows)) return payload.rows;
	if (Array.isArray(payload.requests)) return payload.requests;
	if (Array.isArray(payload.results)) return payload.results;
	return [];
}

export function extractCounts(response) {
	const payload = response?.data ?? response ?? {};
	return payload?.counts ?? {};
}

export function extractPagination(response, fallbackPage = 1, fallbackPageSize = 20) {
	const payload = response?.data ?? response ?? {};
	const total =
		payload?.total ??
		payload?.totalCount ??
		payload?.total_count ??
		payload?.meta?.total ??
		null;

	const totalPages =
		payload?.totalPages ??
		payload?.total_pages ??
		payload?.lastPage ??
		payload?.last_page ??
		payload?.meta?.totalPages ??
		(total !== null ? Math.ceil(Number(total) / fallbackPageSize) : null);

	return {
		page: Number(payload?.page ?? payload?.currentPage ?? payload?.current_page ?? fallbackPage),
		pageSize: Number(payload?.pageSize ?? payload?.page_size ?? fallbackPageSize),
		total: total !== null ? Number(total) : null,
		totalPages: totalPages !== null ? Number(totalPages) : null,
	};
}