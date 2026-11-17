export const ERRAND_CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "NGN", label: "NGN — Nigerian Naira" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
];

const ERRAND_CURRENCY_CODES = new Set(
  ERRAND_CURRENCIES.map(({ value }) => value)
);

export function normalizeErrandCurrency(value, fallback = "USD") {
  const normalized = String(value || "").trim().toUpperCase();
  if (ERRAND_CURRENCY_CODES.has(normalized)) return normalized;

  const normalizedFallback = String(fallback || "").trim().toUpperCase();
  return ERRAND_CURRENCY_CODES.has(normalizedFallback)
    ? normalizedFallback
    : "USD";
}
