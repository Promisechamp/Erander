/* -------------------------------------------------------
   CONSTANTS
------------------------------------------------------- */

export const PAGE_SIZE = 8;
export const MAX_COMPARE = 3;
export const HIGH_FEE_SHARE = 0.4;

/* A card body taller than this collapses behind a "Show full offer" toggle. */
export const COLLAPSED_HEIGHT = 230;

export const SORT_OPTIONS = [
  { value: "price_low", label: "Lowest price" },
  { value: "price_high", label: "Highest price" },
  { value: "fees_low", label: "Lowest fees" },
  { value: "closest", label: "Closest to your estimate" },
  { value: "newest", label: "Newest first" },
];

export const FEE_PARTS = [
  { key: "proposed_item_total", label: "Items", className: "bg-brand-navy" },
  {
    key: "proposed_service_fee",
    label: "Service fee",
    className: "bg-brand-green",
  },
  {
    key: "proposed_delivery_fee",
    label: "Delivery fee",
    className: "bg-brand-mint",
  },
  {
    key: "proposed_other_fees",
    label: "Other fees",
    className: "bg-line-strong",
  },
];

export const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-line bg-surface-white px-5 py-2.5 text-sm font-bold text-content-muted transition hover:bg-surface hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy";

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

export const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const getName = (offer) => {
  const displayName =
    offer.erander_display_name || offer.display_name || offer.erander_name;

  if (displayName) return displayName;

  return (
    [
      offer.erander_first_name || offer.first_name,
      offer.erander_last_name || offer.last_name,
    ]
      .filter(Boolean)
      .join(" ") || "Erander"
  );
};

export const getInitials = (name) =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "E";

export const getOfferItems = (offer) =>
  Array.isArray(offer.items) ? offer.items : [];

export const getProposalTotal = (offer) => {
  const total = Number(offer.proposed_total);

  return Number.isFinite(total) ? total : null;
};

export const getExpiry = (offer) =>
  offer.expires_at || offer.expiry_date || offer.expiresAt || null;

export const getOfferStatus = (offer) => {
  const raw = String(offer.status || "pending").toLowerCase();

  if (raw === "expired") return "expired";
  if (raw === "withdrawn") return "withdrawn";
  if (raw !== "pending") return raw;

  const expiry = getExpiry(offer);

  if (expiry) {
    const expiresAt = new Date(expiry).getTime();

    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return "expired";
    }
  }

  return "pending";
};

export const getOfferTime = (offer) =>
  new Date(offer.created_at || offer.createdAt || 0).getTime();

/** Service + delivery + other fees (everything except the items). */
export const getExtraFees = (offer) =>
  ["proposed_service_fee", "proposed_delivery_fee", "proposed_other_fees"].reduce(
    (sum, key) => sum + Math.max(0, Number(offer[key]) || 0),
    0
  );

export const getFeeShare = (offer) => {
  const total = getProposalTotal(offer);

  if (!total || total <= 0) return 0;

  return getExtraFees(offer) / total;
};

export const getExpiryText = (offer) => {
  const expiry = getExpiry(offer);

  if (!expiry) return null;

  const remaining = new Date(expiry).getTime() - Date.now();

  if (!Number.isFinite(remaining) || remaining <= 0) return null;

  const hours = Math.floor(remaining / 3_600_000);

  if (hours < 1) return "Expires in under an hour";
  if (hours < 24) return `Expires in ${hours} ${hours === 1 ? "hour" : "hours"}`;

  const days = Math.floor(hours / 24);

  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
};

export const unwrapErrand = (response) =>
  response?.data?.errand ??
  response?.errand ??
  response?.data?.erand ??
  response?.erand ??
  null;

export function extractOffersFromResponse(response) {
  const firstLevel = response?.data ?? response;
  const secondLevel = firstLevel?.data ?? firstLevel;

  const possibleArrays = [
    secondLevel?.offers,
    secondLevel?.erandOffers,
    secondLevel?.erand_offers,
    secondLevel?.results,
    secondLevel?.data?.offers,
    firstLevel?.offers,
    firstLevel?.erandOffers,
    firstLevel?.erand_offers,
    response?.offers,
  ];

  if (Array.isArray(secondLevel)) return secondLevel;
  if (Array.isArray(firstLevel)) return firstLevel;

  return possibleArrays.find(Array.isArray) || [];
}