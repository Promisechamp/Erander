import { ERRAND_CURRENCIES } from "../../shared/currency.js";

export default function ErrandCurrencySelector({
  value,
  onChange,
  disabled = false,
}) {
  return (
    <div className="sm:max-w-sm">
      <label
        htmlFor="errand-transaction-currency"
        className="mb-2 block text-sm font-semibold text-content"
      >
        Transaction currency
      </label>
      <select
        id="errand-transaction-currency"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {ERRAND_CURRENCIES.map((currency) => (
          <option key={currency.value} value={currency.value}>
            {currency.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs leading-5 text-content-muted">
        Your preferred currency is selected by default. The chosen currency
        applies to this errand and all proposals. Current Paystack checkout
        supports NGN only; other currencies cannot be funded until their
        payment rails are configured.
      </p>
    </div>
  );
}
