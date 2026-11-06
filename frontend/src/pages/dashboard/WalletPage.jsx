import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  LockKeyhole,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Wallet as WalletIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";
import Select from "@/components/Select";

import * as walletApi from "@/services/wallet/walletApi";
import {
  addWithdrawalAccount,
  cancelWithdrawal,
  createWithdrawalRequest,
  getMyWithdrawals,
  getWalletOverview,
  getWithdrawalAccounts,
  getWithdrawalBanks,
  initializeWalletDeposit,
  resolveWithdrawalAccount,
  setDefaultWithdrawalAccount,
  verifyWalletDeposit,
} from "@/services/wallet/walletApi";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const SUPPORTED_CURRENCIES = ["USD", "NGN", "GBP", "EUR"];

const CURRENCY_META = {
  USD: { symbol: "$", name: "US Dollar" },
  NGN: { symbol: "₦", name: "Nigerian Naira" },
  GBP: { symbol: "£", name: "British Pound" },
  EUR: { symbol: "€", name: "Euro" },
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Deposits", value: "deposit" },
  { label: "Payments", value: "errand_payment" },
  { label: "Earnings", value: "errand_earning" },
  { label: "Withdrawals", value: "withdrawal" },
  { label: "Refunds", value: "refund" },
  { label: "Reservations", value: "reservation" },
];

const TYPE_ICONS = {
  deposit: ArrowDownLeft,
  errand_payment: Package,
  errand_earning: Banknote,
  withdrawal: ArrowUpRight,
  refund: RotateCcw,
  reservation: LockKeyhole,
};

const TYPE_LABELS = {
  deposit: "Deposit",
  errand_payment: "Errand payment",
  errand_earning: "Errand earning",
  withdrawal: "Withdrawal",
  refund: "Refund",
  reservation: "Reservation",
};

const REPORT_REASONS = [
  { value: "not_recognised", label: "I don't recognise this transaction" },
  { value: "wrong_amount", label: "The amount is wrong" },
  { value: "duplicate", label: "I was charged twice" },
  { value: "not_reflected", label: "Payment is not reflected" },
  { value: "refund_missing", label: "Refund not received" },
  { value: "other", label: "Something else" },
];

const QUICK_DEPOSITS = [1000, 5000, 10000, 20000];

const errandPath = (id) => `/dashboard/erands/${encodeURIComponent(id)}`;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const currencyLocale = (currency) => (currency === "NGN" ? "en-NG" : "en-US");

const formatMoney = (value, currency) =>
  new Intl.NumberFormat(currencyLocale(currency), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
};

function dayLabel(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Earlier";

  const startOfDay = (input) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();

  const diff = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86400000
  );

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

const makeIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `erd-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function resolveInitialCurrency(preferred) {
  const normalized = String(preferred || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized) ? normalized : "USD";
}

const INPUT_CLASS =
  "w-full rounded-2xl border border-line bg-surface-white px-4 py-3.5 text-sm font-semibold text-content outline-none transition placeholder:font-medium placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale";

const PRIMARY_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3.5 text-sm font-extrabold text-brand transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface-white px-6 py-3.5 text-sm font-bold text-brand transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50";

/* -------------------------------------------------------------------------- */
/*                              SMALL COMPONENTS                              */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();
  const styles = {
    successful: "bg-success-soft text-success-dark",
    active: "bg-success-soft text-success-dark",
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-sky-50 text-sky-700",
    processing: "bg-sky-50 text-sky-700",
    failed: "bg-rose-50 text-rose-700",
    rejected: "bg-rose-50 text-rose-700",
    cancelled: "bg-surface-muted text-content-muted",
    reversed: "bg-rose-50 text-rose-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
        styles[normalized] || "bg-surface-muted text-content-muted"
      }`}
    >
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ icon: Icon = WalletIcon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
        <Icon size={24} aria-hidden="true" />
      </span>
      <p className="mt-4 font-extrabold text-content">{title}</p>
      <p className="mt-1 max-w-xs text-sm leading-6 text-content-muted">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function LoadingRows() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-1 px-5 py-4 sm:px-6"
    >
      <span className="sr-only">Loading wallet activity</span>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex items-center gap-3 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-surface-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-surface-muted" />
          </div>
          <div className="h-3.5 w-20 animate-pulse rounded-full bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

function CurrencySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleListKeyDown = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();

    const items = [...event.currentTarget.querySelectorAll('[role="option"]')];
    const index = items.indexOf(document.activeElement);
    const nextIndex =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;

    items[nextIndex]?.focus();
  };

  const current = CURRENCY_META[value];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Wallet currency: ${value}`}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 pl-1.5 pr-3 text-sm font-bold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-mint text-sm font-extrabold text-brand">
          {current?.symbol}
        </span>
        {value}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Choose wallet currency"
          onKeyDown={handleListKeyDown}
          className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface-white p-1.5 shadow-[0_16px_45px_rgba(9,20,38,0.18)]"
        >
          {options.map((code) => {
            const meta = CURRENCY_META[code];
            const selected = code === value;

            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    selected ? "bg-brand-pale" : "hover:bg-surface-muted"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-brand-mint">
                    {meta?.symbol}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-content">
                      {code}
                    </span>
                    <span className="block truncate text-xs text-content-muted">
                      {meta?.name}
                    </span>
                  </span>

                  {selected ? (
                    <Check
                      size={16}
                      className="shrink-0 text-success-dark"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, disabled, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center gap-2 rounded-2xl px-2 py-1 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full transition group-enabled:group-hover:scale-105 group-enabled:group-active:scale-95 ${
          primary
            ? "bg-brand-mint text-brand"
            : "bg-white/10 text-white ring-1 ring-inset ring-white/15"
        }`}
      >
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function TransactionRow({ transaction, currency, onOpen, hidden }) {
  const incoming = transaction.direction === "credit";
  const reserved = transaction.direction === "reserved";

  const Icon =
    TYPE_ICONS[transaction.type] ||
    (incoming ? ArrowDownLeft : reserved ? LockKeyhole : ArrowUpRight);

  const tone = incoming
    ? "bg-success-soft text-success-dark"
    : reserved
      ? "bg-amber-50 text-amber-700"
      : "bg-surface-muted text-brand";

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(transaction)}
        aria-label={`${transaction.description}. Open details`}
        className="flex w-full items-center gap-2.5 px-5 py-3 text-left transition hover:bg-surface-muted/60 focus:outline-none focus-visible:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-6"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}
        >
          <Icon size={16} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-content">
            {transaction.description}
          </span>

          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-content-muted">
            <span className="shrink-0">{formatTime(transaction.createdAt)}</span>

            {transaction.relatedErandId ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-pale px-1.5 py-0.5 text-[9.5px] font-bold text-brand">
                <Package size={9} aria-hidden="true" />
                Errand
              </span>
            ) : null}

            <span className="truncate">{transaction.reference}</span>
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`whitespace-nowrap text-[13px] font-extrabold tabular-nums ${
              incoming ? "text-success-dark" : "text-content"
            }`}
          >
            {hidden ? (
              "••••••"
            ) : (
              <>
                {incoming ? "+" : reserved ? "" : "−"}
                {formatMoney(transaction.amount, currency)}
              </>
            )}
          </span>

          <StatusBadge status={transaction.status} />
        </span>

        <ChevronRight
          size={14}
          className="shrink-0 text-content-subtle"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

function DetailLine({ label, children }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd className="min-w-0 max-w-[65%] break-words text-right text-sm font-semibold text-content">
        {children}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const preferredCurrency =
    user?.user_metadata?.preferred_currency || user?.preferred_currency;

  const [currency, setCurrency] = useState(() =>
    resolveInitialCurrency(preferredCurrency)
  );
  const [filter, setFilter] = useState("");
  const [overview, setOverview] = useState({
    wallets: [],
    selectedWallet: null,
    transactions: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  const [accounts, setAccounts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedAccount, setResolvedAccount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [balanceHidden, setBalanceHidden] = useState(false);

  const [activeTransaction, setActiveTransaction] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const selectedWallet = overview.selectedWallet;
  const isNgn = currency === "NGN";

  const prevPreferredRef = useRef(preferredCurrency);
  useEffect(() => {
    if (preferredCurrency === prevPreferredRef.current) return;
    prevPreferredRef.current = preferredCurrency;
    const next = resolveInitialCurrency(preferredCurrency);
    setCurrency(next);
    setPage(1);
  }, [preferredCurrency]);

  const hasAutoSwitchedRef = useRef(false);
  useEffect(() => {
    if (loading || hasAutoSwitchedRef.current) return;
    if (!overview.wallets?.length) return;
    const hasWallet = overview.wallets.some((w) => w.currency === currency);
    if (hasWallet) return;
    const fallback = overview.wallets[0]?.currency;
    if (fallback && SUPPORTED_CURRENCIES.includes(fallback)) {
      hasAutoSwitchedRef.current = true;
      setCurrency(fallback);
      setPage(1);
    }
  }, [loading, overview.wallets, currency]);

  const refresh = useCallback(
    async ({ quiet = false } = {}) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const [walletData, bankAccounts, withdrawalData] = await Promise.all([
          getWalletOverview({ currency, page, limit: 20, type: filter }),
          getWithdrawalAccounts(),
          getMyWithdrawals(),
        ]);
        setOverview(walletData);
        setAccounts(bankAccounts);
        setWithdrawals(withdrawalData);
        if (bankAccounts.length) {
          const preferred =
            bankAccounts.find(
              (item) => item.is_default && item.status === "active"
            ) || bankAccounts.find((item) => item.status === "active");
          if (preferred)
            setSelectedAccount((current) => current || preferred.id);
        }
      } catch (error) {
        toast.error(error.message || "Unable to load your wallet.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currency, page, filter]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("wallet_deposit_reference");
    if (!reference) return;
    let active = true;
    (async () => {
      try {
        toast.message("Verifying your wallet deposit…");
        const result = await verifyWalletDeposit(reference);
        if (!active) return;
        toast.success(result?.message || "Wallet deposit verified.");
        params.delete("wallet_deposit_reference");
        const query = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}${
            window.location.hash
          }`
        );
        await refresh({ quiet: true });
      } catch (error) {
        if (active)
          toast.error(
            error.message ||
              "Deposit verification is pending. You can refresh and retry."
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const balance = useMemo(
    () => ({
      available: selectedWallet?.availableBalance || "0.00",
      pending: selectedWallet?.pendingBalance || "0.00",
      reserved: selectedWallet?.reservedBalance || "0.00",
    }),
    [selectedWallet]
  );

  const groupedTransactions = useMemo(() => {
    const groups = [];

    overview.transactions.forEach((transaction) => {
      const label = dayLabel(transaction.createdAt);
      const last = groups[groups.length - 1];

      if (last && last.label === label) last.items.push(transaction);
      else groups.push({ label, items: [transaction] });
    });

    return groups;
  }, [overview.transactions]);

  function handleCurrencyChange(value) {
    const next = resolveInitialCurrency(value);
    setCurrency(next);
    setPage(1);
  }

  function openTransaction(transaction) {
    setActiveTransaction(transaction);
    setModal("transaction");
  }

  function closeTransaction() {
    setModal("");
    setActiveTransaction(null);
  }

  function goToErrand(errandId) {
    if (!errandId) return;
    closeTransaction();
    navigate(errandPath(errandId));
  }

  function openReport() {
    setReportReason("");
    setReportDetails("");
    setModal("report");
  }

  async function copyReference(reference) {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(String(reference));
      toast.success("Reference copied");
    } catch {
      toast.error("Couldn't copy the reference");
    }
  }

  async function verifyPendingDeposit(reference) {
    if (!reference) return;
    setVerifying(true);
    try {
      const result = await verifyWalletDeposit(reference);
      toast.success(result?.message || "Deposit verification completed.");
      closeTransaction();
      await refresh({ quiet: true });
    } catch (error) {
      toast.error(
        error.message ||
          "Paystack has not confirmed this deposit yet. Try again shortly."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!activeTransaction) return;

    const submit = walletApi.reportWalletTransaction;

    if (typeof submit !== "function") {
      toast.info("Transaction reporting is not connected yet.");
      return;
    }

    setReporting(true);
    try {
      await submit({
        transactionId: activeTransaction.id,
        reference: activeTransaction.reference,
        relatedErandId: activeTransaction.relatedErandId || null,
        reason: reportReason,
        details: reportDetails.trim(),
        idempotencyKey: makeIdempotencyKey(),
      });

      toast.success("Report sent. Our team will review this transaction.");
      closeTransaction();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to send your report."
      );
    } finally {
      setReporting(false);
    }
  }

  async function submitDeposit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await initializeWalletDeposit({
        amount,
        currency: "NGN",
        idempotencyKey: makeIdempotencyKey(),
      });
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      toast.success(result.message || "Deposit already completed.");
      setModal("");
      await refresh({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Unable to start wallet funding.");
    } finally {
      setSaving(false);
    }
  }

  async function loadBanks() {
    try {
      if (!banks.length) setBanks(await getWithdrawalBanks());
    } catch (error) {
      toast.error(error.message || "Unable to load banks.");
    }
  }

  function openAddAccount() {
    setModal("account");
    setResolvedAccount(null);
    setAccountNumber("");
    setBankCode("");
    setBankName("");
    loadBanks();
  }

  async function verifyBankDetails(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await resolveWithdrawalAccount({
        accountNumber,
        bankCode,
      });
      setResolvedAccount(result);
      toast.success(
        "Bank account verified. Check the account name before saving."
      );
    } catch (error) {
      toast.error(error.message || "Unable to verify bank account.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBankAccount() {
    if (!resolvedAccount) return;
    setSaving(true);
    try {
      await addWithdrawalAccount({
        accountNumber,
        bankCode,
        bankName,
        isDefault: accounts.length === 0,
      });
      toast.success("Verified bank account saved.");
      setModal("");
      await refresh({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Unable to save bank account.");
    } finally {
      setSaving(false);
    }
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await createWithdrawalRequest({
        amount,
        withdrawalAccountId: selectedAccount,
        idempotencyKey: makeIdempotencyKey(),
      });
      toast.success(
        "Withdrawal request submitted for finance review. The amount is reserved until the request is resolved."
      );
      setModal("");
      setAmount("");
      await refresh({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Unable to submit withdrawal request.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelPendingWithdrawal(id) {
    try {
      await cancelWithdrawal(id);
      toast.success(
        "Withdrawal cancelled. Reserved funds have been returned to your available balance."
      );
      await refresh({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Unable to cancel withdrawal.");
    }
  }

  async function makeDefault(id) {
    try {
      await setDefaultWithdrawalAccount(id);
      toast.success("Default bank account updated.");
      await refresh({ quiet: true });
    } catch (error) {
      toast.error(error.message || "Unable to update default account.");
    }
  }

  const activeAccounts = accounts.filter((item) => item.status === "active");

  const openDeposit = () => {
    setAmount("");
    setModal("deposit");
  };

  const openWithdrawal = () => {
    setAmount("");
    setModal("withdrawal");
  };

  const mask = (value) =>
    balanceHidden ? "••••••" : formatMoney(value, currency);

  const tx = activeTransaction;
  const txIncoming = tx?.direction === "credit";
  const txReserved = tx?.direction === "reserved";
  const txCanVerify =
    tx?.type === "deposit" && tx?.status === "pending" && tx?.providerReference;
  const reportValid = Boolean(reportReason) && reportDetails.trim().length >= 10;

  /* Defensive: prevent any parent/global keydown or pointer handler from
     intercepting interaction inside modals. */
  const stopModalPropagation = {
    onKeyDown: (e) => e.stopPropagation(),
    onPointerDown: (e) => e.stopPropagation(),
  };

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-surface-muted/40 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-erander space-y-6">
          {/* HEADER */}
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
                Your finances
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
                Wallet
              </h1>
            </div>

            <button
              type="button"
              onClick={() => refresh({ quiet: true })}
              disabled={refreshing || loading}
              aria-label="Refresh wallet"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface-white px-4 text-sm font-bold text-brand transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </header>

          {/* BALANCE CARD */}
          <section
            aria-label="Wallet balance"
            className="relative rounded-[2rem] bg-brand text-white shadow-xl shadow-brand/20"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
            >
              <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-brand-mint/20 blur-3xl" />
              <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  backgroundSize: "22px 22px",
                }}
              />
            </div>

            <div className="relative px-6 pb-6 pt-6 sm:px-9 sm:pb-8 sm:pt-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
                  <WalletIcon
                    size={16}
                    className="text-brand-mint"
                    aria-hidden="true"
                  />
                  Available balance
                </div>

                <CurrencySelect
                  value={currency}
                  onChange={handleCurrencyChange}
                  options={SUPPORTED_CURRENCIES}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <p className="min-w-0 break-words text-4xl font-extrabold leading-none tracking-tight tabular-nums sm:text-6xl">
                  {loading ? (
                    <Loader2
                      className="h-9 w-9 animate-spin text-brand-mint sm:h-12 sm:w-12"
                      aria-label="Loading balance"
                    />
                  ) : (
                    mask(balance.available)
                  )}
                </p>

                <button
                  type="button"
                  onClick={() => setBalanceHidden((previous) => !previous)}
                  aria-label={balanceHidden ? "Show balances" : "Hide balances"}
                  aria-pressed={balanceHidden}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                >
                  {balanceHidden ? (
                    <EyeOff size={17} aria-hidden="true" />
                  ) : (
                    <Eye size={17} aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                    <Clock3 size={13} aria-hidden="true" />
                    Pending
                  </div>
                  <p className="mt-1.5 break-words text-base font-extrabold tabular-nums sm:text-lg">
                    {mask(balance.pending)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                    <LockKeyhole size={13} aria-hidden="true" />
                    Reserved
                  </div>
                  <p className="mt-1.5 break-words text-base font-extrabold tabular-nums sm:text-lg">
                    {mask(balance.reserved)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 sm:mx-auto sm:max-w-md">
                <QuickAction
                  icon={Plus}
                  label="Add money"
                  primary
                  disabled={!isNgn}
                  onClick={openDeposit}
                />
                <QuickAction
                  icon={ArrowUpRight}
                  label="Withdraw"
                  disabled={!isNgn || !activeAccounts.length}
                  onClick={openWithdrawal}
                />
                <QuickAction
                  icon={Building2}
                  label="Add bank"
                  onClick={openAddAccount}
                />
              </div>

              <p className="mt-4 text-center text-xs text-white/50">
                NGN funding and payouts are processed via Paystack
              </p>
            </div>
          </section>

          {!isNgn ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-r-2xl border-l-4 border-sky-400 bg-sky-50 p-4 text-sm leading-6 text-sky-900"
            >
              <ShieldCheck
                className="mt-0.5 shrink-0"
                size={18}
                aria-hidden="true"
              />
              <p>
                NGN wallet funding and bank withdrawals are currently available
                through Paystack. Your {currency} balance remains separate; NGN
                actions are not available from this currency view.
              </p>
            </div>
          ) : null}

          {/* GRID */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* TRANSACTIONS */}
            <section
              aria-label="Transaction history"
              className="overflow-hidden rounded-3xl border border-line bg-surface-white"
            >
              <div className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                <h2 className="text-lg font-extrabold tracking-tight text-content">
                  Transactions
                </h2>
                <p className="mt-0.5 text-sm text-content-muted">
                  Tap a transaction to see its details, open its errand, or
                  report a problem.
                </p>

                <div
                  role="group"
                  aria-label="Filter transactions"
                  className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6"
                >
                  {FILTERS.map((item) => {
                    const active = item.value === filter;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setFilter(item.value);
                          setPage(1);
                        }}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          active
                            ? "bg-brand text-white"
                            : "bg-surface-muted text-content-muted hover:text-content"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loading ? (
                <LoadingRows />
              ) : overview.transactions.length === 0 ? (
                <EmptyState
                  title="No transactions yet"
                  description="Your wallet activity will appear here once transactions are recorded."
                />
              ) : (
                <>
                  <div>
                    {groupedTransactions.map((group) => (
                      <div key={group.label}>
                        <p className="bg-surface-muted/60 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-content-muted sm:px-6">
                          {group.label}
                        </p>

                        <ul className="divide-y divide-line-soft">
                          {group.items.map((transaction) => (
                            <TransactionRow
                              key={transaction.id}
                              transaction={transaction}
                              currency={currency}
                              hidden={balanceHidden}
                              onOpen={openTransaction}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-4 text-xs text-content-muted sm:px-6">
                    <span>{overview.pagination.total} transaction(s)</span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() =>
                          setPage((value) => Math.max(1, value - 1))
                        }
                        className="rounded-full border border-line px-4 py-2 font-bold text-brand transition hover:bg-surface-muted disabled:opacity-40"
                      >
                        Previous
                      </button>

                      <span className="px-1 font-semibold tabular-nums">
                        {page} / {Math.max(overview.pagination.totalPages, 1)}
                      </span>

                      <button
                        type="button"
                        disabled={page >= overview.pagination.totalPages}
                        onClick={() => setPage((value) => value + 1)}
                        className="rounded-full border border-line px-4 py-2 font-bold text-brand transition hover:bg-surface-muted disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </footer>
                </>
              )}
            </section>

            {/* SIDEBAR */}
            <aside className="min-w-0 space-y-6">
              <section
                aria-label="Withdrawal accounts"
                className="rounded-3xl border border-line bg-surface-white p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-content">
                      Bank accounts
                    </h2>
                    <p className="mt-0.5 text-sm text-content-muted">
                      Verified accounts saved for payouts.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openAddAccount}
                    aria-label="Add a bank account"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <Plus size={17} aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {accounts.length === 0 ? (
                    <EmptyState
                      icon={Building2}
                      title="No bank account yet"
                      description="Add a verified Nigerian bank account to receive withdrawals."
                      action={
                        <button
                          type="button"
                          onClick={openAddAccount}
                          className="rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
                        >
                          Add your first account
                        </button>
                      }
                    />
                  ) : (
                    accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center gap-3 rounded-2xl bg-surface-muted/60 p-3.5"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-mint">
                          <Building2 size={18} aria-hidden="true" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-content">
                            {account.bank_name}
                          </p>
                          <p className="truncate text-xs text-content-muted">
                            {account.account_name} · ••••{" "}
                            {account.account_number_last4}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <StatusBadge status={account.status} />

                          {account.is_default ? (
                            <span className="text-[11px] font-bold text-success-dark">
                              Default
                            </span>
                          ) : account.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => makeDefault(account.id)}
                              className="text-[11px] font-bold text-brand underline underline-offset-2"
                            >
                              Make default
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section
                aria-label="Withdrawal requests"
                className="rounded-3xl border border-line bg-surface-white p-5 sm:p-6"
              >
                <h2 className="text-lg font-extrabold tracking-tight text-content">
                  Withdrawals
                </h2>
                <p className="mt-0.5 text-sm text-content-muted">
                  Reviewed by ERANDER Finance before a transfer starts.
                </p>

                <div className="mt-4">
                  {withdrawals.length === 0 ? (
                    <EmptyState
                      icon={CreditCard}
                      title="No withdrawals yet"
                      description="Withdrawal requests will appear here once you submit one."
                      action={
                        <button
                          type="button"
                          disabled={!isNgn || !activeAccounts.length}
                          onClick={openWithdrawal}
                          className="rounded-full border border-line bg-surface-white px-5 py-2.5 text-xs font-bold text-brand transition hover:bg-surface-muted disabled:opacity-40"
                        >
                          Request withdrawal
                        </button>
                      }
                    />
                  ) : (
                    <ul className="divide-y divide-line-soft">
                      {withdrawals.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-brand">
                              <ArrowUpRight size={17} aria-hidden="true" />
                            </span>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold tabular-nums text-content">
                                {formatMoney(item.amount, item.currency_code)}
                              </p>
                              <p className="truncate text-xs text-content-muted">
                                {item.bank_name_snapshot} · ••••{" "}
                                {item.account_number_last4_snapshot}
                              </p>
                              <p className="mt-0.5 text-[11px] text-content-subtle">
                                {formatDate(item.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <StatusBadge status={item.status} />

                            {item.status === "pending" ? (
                              <button
                                type="button"
                                onClick={() => cancelPendingWithdrawal(item.id)}
                                className="text-[11px] font-bold text-rose-600 underline underline-offset-2"
                              >
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <div className="flex items-start gap-3 rounded-r-2xl border-l-4 border-brand-green bg-brand-pale p-4">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-success-dark"
                  size={18}
                  aria-hidden="true"
                />
                <p className="text-xs leading-5 text-success-dark">
                  Wallet movements are recorded against the transaction ledger.
                  Withdrawal requests reserve funds while they await review. Do
                  not share your bank details or account credentials with
                  anyone claiming to be ERANDER support.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* TRANSACTION DETAILS MODAL */}
      <Modal
        isOpen={modal === "transaction" && Boolean(tx)}
        onClose={closeTransaction}
        title="Transaction details"
        description={tx ? tx.description : ""}
        size="sm"
      >
        {tx ? (
          <div className="space-y-5" {...stopModalPropagation}>
            <div className="rounded-2xl bg-brand px-5 py-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white/70">
                  {TYPE_LABELS[tx.type] || "Transaction"}
                </p>
                <StatusBadge status={tx.status} />
              </div>

              <p className="mt-2 break-words text-3xl font-extrabold tracking-tight tabular-nums">
                {txIncoming ? "+" : txReserved ? "" : "−"}
                {formatMoney(tx.amount, tx.currency || currency)}
              </p>
            </div>

            <dl className="divide-y divide-line-soft border-y border-line-soft">
              <DetailLine label="Date">{formatDate(tx.createdAt)}</DetailLine>

              {tx.completedAt ? (
                <DetailLine label="Completed">
                  {formatDate(tx.completedAt)}
                </DetailLine>
              ) : null}

              <DetailLine label="Direction">
                {txIncoming
                  ? "Money in"
                  : txReserved
                    ? "Held in reserve"
                    : "Money out"}
              </DetailLine>

              {tx.paymentProvider ? (
                <DetailLine label="Provider">
                  <span className="capitalize">{tx.paymentProvider}</span>
                </DetailLine>
              ) : null}

              <DetailLine label="Reference">
                <span className="inline-flex max-w-full items-center gap-2">
                  <span className="min-w-0 break-all">{tx.reference}</span>
                  <button
                    type="button"
                    onClick={() => copyReference(tx.reference)}
                    aria-label="Copy reference"
                    className="shrink-0 rounded-full p-1.5 text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Copy size={14} aria-hidden="true" />
                  </button>
                </span>
              </DetailLine>
            </dl>

            {tx.relatedErandId ? (
              <div className="flex items-start gap-3 rounded-r-2xl border-l-4 border-brand-green bg-brand-pale p-4">
                <Package
                  size={18}
                  className="mt-0.5 shrink-0 text-success-dark"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-brand">
                    Linked to an errand
                  </p>
                  <p className="mt-1 text-xs leading-5 text-success-dark">
                    This transaction is part of an errand. Open it to see the
                    offer, items and activity.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {tx.relatedErandId ? (
                <button
                  type="button"
                  onClick={() => goToErrand(tx.relatedErandId)}
                  className={PRIMARY_BUTTON}
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  View errand
                </button>
              ) : null}

              {txCanVerify ? (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => verifyPendingDeposit(tx.providerReference)}
                  className={tx.relatedErandId ? SECONDARY_BUTTON : PRIMARY_BUTTON}
                >
                  {verifying ? (
                    <Loader2
                      className="animate-spin"
                      size={16}
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw size={16} aria-hidden="true" />
                  )}
                  Verify with Paystack
                </button>
              ) : null}

              <button
                type="button"
                onClick={openReport}
                className={SECONDARY_BUTTON}
              >
                <Flag size={16} aria-hidden="true" />
                Report a problem
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* REPORT MODAL */}
      <Modal
        isOpen={modal === "report" && Boolean(tx)}
        onClose={() => {
          if (!reporting) setModal("transaction");
        }}
        title="Report a transaction"
        description="Tell us what looks wrong. Our team will review it."
        size="sm"
      >
        {tx ? (
          <form
            onSubmit={submitReport}
            className="space-y-5"
            {...stopModalPropagation}
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted/60 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-content">
                  {tx.description}
                </p>
                <p className="mt-0.5 truncate text-xs text-content-muted">
                  {tx.reference}
                </p>
              </div>

              <p className="shrink-0 whitespace-nowrap text-sm font-extrabold tabular-nums text-content">
                {formatMoney(tx.amount, tx.currency || currency)}
              </p>
            </div>

            <div>
              <span className="mb-2 block text-sm font-bold text-content">
                What's the problem?
              </span>
              <Select
                value={reportReason}
                onChange={setReportReason}
                options={REPORT_REASONS}
                placeholder="Choose a reason"
                ariaLabel="Report reason"
              />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label
                  htmlFor="report-details"
                  className="text-sm font-bold text-content"
                >
                  Details
                </label>
                <span className="text-xs tabular-nums text-content-subtle">
                  {reportDetails.trim().length}/10 min
                </span>
              </div>

              <textarea
                id="report-details"
                required
                rows={4}
                maxLength={1000}
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder="Explain what happened and what you expected."
                className={`${INPUT_CLASS} resize-none font-medium leading-6`}
              />
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={reporting || !reportValid}
                className={PRIMARY_BUTTON}
              >
                {reporting ? (
                  <Loader2
                    className="animate-spin"
                    size={16}
                    aria-hidden="true"
                  />
                ) : (
                  <Flag size={16} aria-hidden="true" />
                )}
                Send report
              </button>

              <button
                type="button"
                disabled={reporting}
                onClick={() => setModal("transaction")}
                className={SECONDARY_BUTTON}
              >
                Back
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* DEPOSIT MODAL */}
      <Modal
        isOpen={modal === "deposit"}
        onClose={() => setModal("")}
        title="Add money to wallet"
        description="Fund your NGN wallet securely through Paystack."
        size="sm"
      >
        <form
          onSubmit={submitDeposit}
          className="space-y-5"
          {...stopModalPropagation}
        >
          <div>
            <label
              htmlFor="deposit-amount"
              className="mb-2 block text-sm font-bold text-content"
            >
              Amount
            </label>

            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-extrabold text-content-muted"
              >
                ₦
              </span>

              <input
                id="deposit-amount"
                required
                min="1"
                step="0.01"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="w-full rounded-2xl border border-line bg-surface-white py-4 pl-11 pr-4 text-2xl font-extrabold tabular-nums text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_DEPOSITS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className={`rounded-full px-4 py-2 text-xs font-bold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    Number(amount) === value
                      ? "bg-brand text-white"
                      : "bg-surface-muted text-content-muted hover:text-content"
                  }`}
                >
                  ₦{value.toLocaleString("en-NG")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-r-2xl border-l-4 border-brand-green bg-brand-pale p-4">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-success-dark"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-success-dark">
              You will be redirected to Paystack to complete payment. Your
              wallet is credited only after Paystack confirms the exact amount,
              currency and reference.
            </p>
          </div>

          <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
            {saving ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : null}
            Continue to Paystack
          </button>
        </form>
      </Modal>

      {/* ADD ACCOUNT MODAL */}
      <Modal
        isOpen={modal === "account"}
        onClose={() => setModal("")}
        title="Add a bank account"
        description="Verify the account with Paystack before saving it."
        size="sm"
      >
        <form
          onSubmit={verifyBankDetails}
          className="space-y-5"
          {...stopModalPropagation}
        >
          <div>
            <span className="mb-2 block text-sm font-bold text-content">
              Bank
            </span>
            <Select
              value={bankCode}
              onChange={(value) => {
                const bank = banks.find((item) => item.code === value);
                setBankCode(value);
                setBankName(bank?.name || "");
                setResolvedAccount(null);
              }}
              options={banks.map((bank) => ({
                value: bank.code,
                label: bank.name,
              }))}
              placeholder="Select your bank"
              ariaLabel="Bank"
            />
          </div>

          <div>
            <label
              htmlFor="account-number"
              className="mb-2 block text-sm font-bold text-content"
            >
              10-digit account number
            </label>
            <input
              id="account-number"
              required
              maxLength={10}
              minLength={10}
              inputMode="numeric"
              value={accountNumber}
              onChange={(event) => {
                setAccountNumber(
                  event.target.value.replace(/\D/g, "").slice(0, 10)
                );
                setResolvedAccount(null);
              }}
              placeholder="0123456789"
              className={`${INPUT_CLASS} tracking-widest tabular-nums`}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !bankCode || accountNumber.length !== 10}
            className={SECONDARY_BUTTON}
          >
            {saving && !resolvedAccount ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : null}
            Verify account
          </button>
        </form>

        {resolvedAccount ? (
          <div className="mt-5 rounded-2xl bg-brand-pale p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-success-dark">
              <CheckCircle2 size={17} aria-hidden="true" />
              Account verified
            </div>

            <p className="mt-3 text-base font-extrabold text-brand">
              {resolvedAccount.accountName}
            </p>
            <p className="mt-0.5 text-xs text-content-muted">
              {bankName} · •••• {resolvedAccount.accountNumberLast4}
            </p>

            <button
              type="button"
              onClick={saveBankAccount}
              disabled={saving}
              className={`${PRIMARY_BUTTON} mt-4`}
            >
              {saving ? (
                <Loader2
                  className="animate-spin"
                  size={16}
                  aria-hidden="true"
                />
              ) : null}
              Save verified account
            </button>
          </div>
        ) : null}
      </Modal>

      {/* WITHDRAWAL MODAL */}
      <Modal
        isOpen={modal === "withdrawal"}
        onClose={() => setModal("")}
        title="Request a withdrawal"
        description="Your request will be reviewed before a bank transfer is initiated."
        size="sm"
      >
        <form
          onSubmit={submitWithdrawal}
          className="space-y-5"
          {...stopModalPropagation}
        >
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label
                htmlFor="withdrawal-amount"
                className="text-sm font-bold text-content"
              >
                Amount
              </label>

              <button
                type="button"
                onClick={() => setAmount(String(balance.available))}
                className="text-xs font-bold text-brand underline underline-offset-2"
              >
                Use full balance
              </button>
            </div>

            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-extrabold text-content-muted"
              >
                ₦
              </span>

              <input
                id="withdrawal-amount"
                required
                min="0.01"
                step="0.01"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="w-full rounded-2xl border border-line bg-surface-white py-4 pl-11 pr-4 text-2xl font-extrabold tabular-nums text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale"
              />
            </div>

            <p className="mt-2 text-xs text-content-muted">
              Available:{" "}
              <span className="font-bold tabular-nums text-content">
                {formatMoney(balance.available, currency)}
              </span>
            </p>
          </div>

          <div>
            <span className="mb-2 block text-sm font-bold text-content">
              Destination bank account
            </span>
            <Select
              value={selectedAccount}
              onChange={setSelectedAccount}
              options={activeAccounts.map((account) => ({
                value: account.id,
                label: `${account.bank_name} · •••• ${
                  account.account_number_last4
                }${account.is_default ? " (Default)" : ""}`,
              }))}
              placeholder="Choose a verified account"
              ariaLabel="Destination bank account"
            />
          </div>

          <div className="flex items-start gap-3 rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 p-4">
            <LockKeyhole
              size={18}
              className="mt-0.5 shrink-0 text-amber-800"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-amber-900">
              The requested amount will move from available balance to reserved
              balance immediately. It will return to your available balance if
              the request is cancelled, rejected, or the transfer fails.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !selectedAccount}
            className={PRIMARY_BUTTON}
          >
            {saving ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : null}
            Submit withdrawal request
          </button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}