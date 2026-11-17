import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Compass,
  Inbox,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getMyErrands } from "@/services/errands/errandsApi";
import { getMyErandOffers } from "@/services/offers/offersApi";
import { getMyProfile } from "@/services/profiles/profilesApi";
import { getWalletOverview } from "@/services/wallet/walletApi";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const ACTIVE_ERRAND_STATUSES = new Set([
  "open",
  "offer_selected",
  "assigned",
  "awaiting_funding",
  "funded",
  "in_progress",
  "completion_submitted",
  "disputed",
]);

const ACTIVE_JOB_STATUSES = new Set([
  "awaiting_funding",
  "funded",
  "in_progress",
  "completion_submitted",
  "disputed",
]);

const ENDED_STATUSES = new Set(["completed", "cancelled", "canceled", "expired"]);

const SUPPORTED_CURRENCIES = ["USD", "NGN", "GBP", "EUR"];

const CURRENCY_LOCALES = {
  NGN: "en-NG",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "de-DE",
};

const FEED_FILTERS = [
  { value: "all", label: "All" },
  { value: "errand", label: "My requests" },
  { value: "offer", label: "My offers" },
];

const SHORTCUTS = [
  { icon: Compass, title: "Find errands", path: "/dashboard/available-errands" },
  { icon: ClipboardList, title: "My errands", path: "/dashboard/erands" },
  { icon: BriefcaseBusiness, title: "My offers", path: "/dashboard/my-offers" },
  { icon: MessageCircle, title: "Messages", path: "/chat" },
];

const STATUS_TONE = {
  open: "success",
  completed: "success",
  accepted: "success",
  funded: "info",
  in_progress: "info",
  pending: "attention",
  awaiting_funding: "attention",
  completion_submitted: "attention",
  disputed: "danger",
  rejected: "neutral",
  cancelled: "neutral",
  canceled: "neutral",
  expired: "neutral",
  withdrawn: "neutral",
};

const TONE_CLASS = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
  attention: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  neutral: "bg-surface-muted text-content-muted ring-line",
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const cn = (...values) => values.filter(Boolean).join(" ");

const unwrap = (result) => result?.data ?? result ?? {};

function getErrands(result) {
  const data = unwrap(result);
  return Array.isArray(data.errands) ? data.errands : [];
}

function getOffers(result) {
  const data = unwrap(result);
  return Array.isArray(data.offers) ? data.offers : [];
}

function getProfile(result) {
  const data = unwrap(result);
  return data.profile ?? data.user?.profile ?? {};
}

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const humanize = (value) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function formatMoney(value, currency = "USD") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  try {
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency] || "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatRelative(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const getErrandFromOffer = (offer) =>
  offer?.errand || offer?.erand || offer?.errands || offer?.erands || {};

const errandStatusOfOffer = (offer) =>
  normalizeStatus(getErrandFromOffer(offer).status || offer?.errand_status);

const offerLabel = (status) =>
  ({
    pending: "Awaiting response",
    accepted: "Accepted",
    rejected: "Not selected",
    withdrawn: "Withdrawn",
    expired: "Expired",
    superseded: "Superseded",
  })[normalizeStatus(status)] || humanize(status) || "Offer";

function resolveCurrency(preferred) {
  const value = String(preferred || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(value) ? value : "USD";
}

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function StatusPill({ status, label }) {
  const value = normalizeStatus(status);

  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset",
        TONE_CLASS[STATUS_TONE[value] || "neutral"]
      )}
    >
      {label || humanize(value) || "Unknown"}
    </span>
  );
}

function Panel({ title, description, action, children, className = "" }) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-3xl border border-line bg-surface-white",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-tight text-content">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-content-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, hint, loading, onClick }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-content-muted">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-pale text-success-dark">
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-surface-muted" />
      ) : (
        <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-content">
          {value}
        </p>
      )}

      <p className="mt-1 truncate text-xs text-content-subtle">{hint}</p>
    </>
  );

  const className =
    "block min-w-0 rounded-2xl border border-line bg-surface-white p-4 text-left sm:p-5";

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "transition hover:border-line-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      )}
    >
      {body}
    </button>
  ) : (
    <article className={className}>{body}</article>
  );
}

function AttentionRow({ item, onClick }) {
  const Icon = item.icon;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-surface-muted/60 focus:outline-none focus-visible:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-6"
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            item.tone === "danger"
              ? "bg-rose-50 text-rose-600"
              : "bg-amber-50 text-amber-700"
          )}
        >
          <Icon size={17} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-content">{item.title}</span>
          <span className="block truncate text-xs text-content-muted">{item.detail}</span>
        </span>

        <span className="hidden shrink-0 text-xs font-bold text-brand sm:block">
          {item.action}
        </span>
        <ChevronRight size={15} className="shrink-0 text-content-subtle" aria-hidden="true" />
      </button>
    </li>
  );
}

function ActivityRow({ item, onClick }) {
  const Icon = item.kind === "offer" ? BriefcaseBusiness : Package;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-surface-muted/60 focus:outline-none focus-visible:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-6"
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            item.kind === "offer"
              ? "bg-surface-muted text-brand"
              : "bg-brand-pale text-success-dark"
          )}
        >
          <Icon size={17} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-content">{item.title}</span>
          <span className="block truncate text-xs text-content-muted">
            {item.subtitle} · {formatRelative(item.date)}
          </span>
        </span>

        <span className="hidden sm:block">
          <StatusPill status={item.status} label={item.statusLabel} />
        </span>
        <ChevronRight size={15} className="shrink-0 text-content-subtle" aria-hidden="true" />
      </button>
    </li>
  );
}

function ListSkeleton({ rows = 4 }) {
  return (
    <div role="status" aria-live="polite" className="px-5 py-4 sm:px-6">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-surface-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-surface-muted" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

function Empty({ icon: Icon = Package, title, text, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-extrabold text-content">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-content-muted">{text}</p>
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* Currency is taken from user.preferred_currency first, then profile, then metadata. */
  const [profile, setProfile] = useState({});

  const walletCurrency = resolveCurrency(
    user?.preferred_currency ||
      profile?.preferred_currency ||
      user?.user_metadata?.preferred_currency
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadErrors, setLoadErrors] = useState([]);
  const [errands, setErrands] = useState([]);
  const [offers, setOffers] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [feedFilter, setFeedFilter] = useState("all");

  const firstName =
    profile.first_name ||
    user?.user_metadata?.first_name ||
    user?.first_name ||
    user?.email?.split("@")[0] ||
    "there";

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [errandsResult, offersResult, walletResult, profileResult] =
        await Promise.allSettled([
          getMyErrands({ page: 1, limit: 50 }),
          getMyErandOffers(),
          getWalletOverview({ currency: walletCurrency, page: 1, limit: 1 }),
          getMyProfile(),
        ]);

      const errors = [];

      if (errandsResult.status === "fulfilled")
        setErrands(getErrands(errandsResult.value));
      else errors.push("Customer activity could not be loaded.");

      if (offersResult.status === "fulfilled")
        setOffers(getOffers(offersResult.value));
      else errors.push("Erander activity could not be loaded.");

      if (walletResult.status === "fulfilled")
        setWallets(
          Array.isArray(walletResult.value?.wallets) ? walletResult.value.wallets : []
        );
      else errors.push("Wallet information is temporarily unavailable.");

      if (profileResult.status === "fulfilled")
        setProfile(getProfile(profileResult.value));
      else errors.push("Some profile details could not be loaded.");

      setLoadErrors(errors);
      setLoading(false);
      setRefreshing(false);
    },
    [walletCurrency]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const customerUnavailable = loadErrors.some((m) => m.startsWith("Customer activity"));
  const eranderUnavailable = loadErrors.some((m) => m.startsWith("Erander activity"));
  const walletUnavailable = loadErrors.some((m) => m.startsWith("Wallet information"));

  /* ------------------------------- Statistics ------------------------------ */
  const customerStats = useMemo(() => {
    const active = errands.filter((item) => {
      const status = normalizeStatus(item.status);
      return ACTIVE_ERRAND_STATUSES.has(status) && !ENDED_STATUSES.has(status);
    });

    return {
      active: active.length,
      completed: errands.filter((item) => normalizeStatus(item.status) === "completed").length,
    };
  }, [errands]);

  const eranderStats = useMemo(() => {
    const pending = offers.filter((offer) => normalizeStatus(offer.status) === "pending");
    const accepted = offers.filter((offer) => normalizeStatus(offer.status) === "accepted");

    return {
      pending: pending.length,
      active: accepted.filter((offer) => ACTIVE_JOB_STATUSES.has(errandStatusOfOffer(offer)))
        .length,
    };
  }, [offers]);

  /* ---------------------------- Needs attention ---------------------------- */
  const attention = useMemo(() => {
    const items = [];

    errands.forEach((errand) => {
      const status = normalizeStatus(errand.status);
      const path = errand.id
        ? `/dashboard/erands/${encodeURIComponent(errand.id)}`
        : "/dashboard/erands";
      const title = errand.title || "Your errand";

      if (status === "completion_submitted")
        items.push({
          key: `review-${errand.id}`,
          icon: CheckCircle2,
          tone: "attention",
          title,
          detail: "Your erander says the work is done. Review it.",
          action: "Review",
          path,
        });
      else if (status === "awaiting_funding")
        items.push({
          key: `fund-${errand.id}`,
          icon: Wallet,
          tone: "attention",
          title,
          detail: "Fund this errand so your erander can start.",
          action: "Fund",
          path,
        });
      else if (status === "disputed")
        items.push({
          key: `dispute-${errand.id}`,
          icon: AlertCircle,
          tone: "danger",
          title,
          detail: "This errand is under dispute.",
          action: "View",
          path,
        });
      else if (status === "open" && Number(errand.offers_count || 0) > 0)
        items.push({
          key: `offers-${errand.id}`,
          icon: Inbox,
          tone: "attention",
          title,
          detail: `${errand.offers_count} ${
            Number(errand.offers_count) === 1 ? "offer" : "offers"
          } waiting for your decision.`,
          action: "Compare",
          path: errand.id
            ? `/dashboard/erands/${encodeURIComponent(errand.id)}/offers`
            : path,
        });
    });

    offers.forEach((offer) => {
      if (normalizeStatus(offer.status) !== "accepted") return;

      const errandStatus = errandStatusOfOffer(offer);
      const offerId = offer.id || offer.offer_id;

      if (["funded", "in_progress"].includes(errandStatus))
        items.push({
          key: `job-${offerId}`,
          icon: BriefcaseBusiness,
          tone: "attention",
          title: getErrandFromOffer(offer).title || offer.errand_title || "Your assignment",
          detail:
            errandStatus === "funded"
              ? "Funded and ready. You can start the work."
              : "In progress. Submit it when you're done.",
          action: "Open",
          path: offerId
            ? `/dashboard/my-offers/${encodeURIComponent(offerId)}`
            : "/dashboard/my-offers",
        });
    });

    return items;
  }, [errands, offers]);

  /* ------------------------------ Recent activity ------------------------------ */
  const activity = useMemo(() => {
    const customerItems = errands.map((errand) => ({
      id: `errand-${errand.id}`,
      kind: "errand",
      title: errand.title || "Your errand request",
      subtitle: `Request ${errand.reference_code || ""}`.trim(),
      status: errand.status,
      date: errand.updated_at || errand.created_at,
      path: errand.id
        ? `/dashboard/erands/${encodeURIComponent(errand.id)}`
        : "/dashboard/erands",
    }));

    const offerItems = offers.map((offer) => {
      const errand = getErrandFromOffer(offer);
      const offerId = offer.id || offer.offer_id;

      return {
        id: `offer-${offerId || `${offer.erand_id}-${offer.created_at}`}`,
        kind: "offer",
        title: errand.title || offer.errand_title || "Your submitted offer",
        subtitle: "Offer sent",
        status: offer.status,
        statusLabel: offerLabel(offer.status),
        date: offer.updated_at || offer.created_at,
        path: offerId
          ? `/dashboard/my-offers/${encodeURIComponent(offerId)}`
          : "/dashboard/my-offers",
      };
    });

    return [...customerItems, ...offerItems]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [errands, offers]);

  const visibleActivity = activity
    .filter((item) => feedFilter === "all" || item.kind === feedFilter)
    .slice(0, 7);

  /* --------------------------------- Wallet -------------------------------- */
  const mainWallet = wallets.find(
    (wallet) => String(wallet.currency || "").toUpperCase() === walletCurrency
  );
  const otherWallets = wallets.filter(
    (wallet) => String(wallet.currency || "").toUpperCase() !== walletCurrency
  );

  return (
    <DashboardLayout
      title="Dashboard"
      description="Your errands, offers and wallet in one place."
    >
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
              Overview
            </p>
            <h1 className="mt-1 break-words text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-content-muted">
              Here's what's happening across your requests and offers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadDashboard({ silent: true })}
              disabled={refreshing || loading}
              aria-label="Refresh dashboard"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-white text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={refreshing ? "animate-spin" : ""}
              />
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard/available-errands")}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface-white px-4 text-sm font-bold text-brand transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Compass size={16} aria-hidden="true" />
              Find errands
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard/erands/new")}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-green px-5 text-sm font-extrabold text-brand transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <Plus size={16} aria-hidden="true" />
              Post an errand
            </button>
          </div>
        </header>

        {loadErrors.length ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-r-2xl border-l-4 border-amber-400 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm leading-6 text-amber-900">
              Some information couldn't be loaded. {loadErrors.join(" ")}
            </p>
            <button
              type="button"
              onClick={() => loadDashboard({ silent: true })}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-extrabold text-amber-950 underline underline-offset-2 disabled:opacity-50"
            >
              <RefreshCw size={13} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
              Try again
            </button>
          </div>
        ) : null}

        {/* Stats */}
        <section
          aria-label="Key figures"
          className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
          <StatCard
            icon={Clock3}
            label="Active requests"
            value={customerUnavailable ? "—" : customerStats.active}
            hint="Errands you posted"
            loading={loading}
            onClick={() => navigate("/dashboard/erands")}
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed requests"
            value={customerUnavailable ? "—" : customerStats.completed}
            hint="Finished errands"
            loading={loading}
            onClick={() => navigate("/dashboard/erands")}
          />
          <StatCard
            icon={Inbox}
            label="Offers awaiting reply"
            value={eranderUnavailable ? "—" : eranderStats.pending}
            hint="Offers you sent"
            loading={loading}
            onClick={() => navigate("/dashboard/my-offers")}
          />
          <StatCard
            icon={BriefcaseBusiness}
            label="Active assignments"
            value={eranderUnavailable ? "—" : eranderStats.active}
            hint="Work you accepted"
            loading={loading}
            onClick={() => navigate("/dashboard/my-offers")}
          />
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left column */}
          <div className="min-w-0 space-y-6">
            <Panel
              title="Needs your attention"
              description="Things waiting on you right now."
              action={
                !loading && attention.length ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                    {attention.length} to do
                  </span>
                ) : null
              }
            >
              <div className="mt-3 border-t border-line-soft">
                {loading ? (
                  <ListSkeleton rows={2} />
                ) : attention.length ? (
                  <ul className="divide-y divide-line-soft">
                    {attention.slice(0, 5).map((item) => (
                      <AttentionRow
                        key={item.key}
                        item={item}
                        onClick={() => navigate(item.path)}
                      />
                    ))}
                  </ul>
                ) : (
                  <Empty
                    icon={CheckCircle2}
                    title="You're all caught up"
                    text="Nothing needs your action right now. New offers, funding requests and reviews will show up here."
                  />
                )}
              </div>
            </Panel>

            <Panel
              title="Recent activity"
              description="Your latest requests and offers."
            >
              <div className="px-5 pt-3 sm:px-6">
                <div
                  role="group"
                  aria-label="Filter activity"
                  className="inline-flex rounded-full bg-surface-muted p-1"
                >
                  {FEED_FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={feedFilter === item.value}
                      onClick={() => setFeedFilter(item.value)}
                      className={cn(
                        "h-8 rounded-full px-3.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                        feedFilter === item.value
                          ? "bg-surface-white text-content shadow-sm"
                          : "text-content-muted hover:text-content"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 border-t border-line-soft">
                {loading ? (
                  <ListSkeleton />
                ) : visibleActivity.length ? (
                  <ul className="divide-y divide-line-soft">
                    {visibleActivity.map((item) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                        onClick={() => navigate(item.path)}
                      />
                    ))}
                  </ul>
                ) : customerUnavailable && eranderUnavailable ? (
                  <Empty
                    icon={AlertCircle}
                    title="Activity is unavailable"
                    text="Refresh the dashboard to try loading your recent activity again."
                  />
                ) : (
                  <Empty
                    title="Nothing here yet"
                    text="Post your first errand or send an offer on an available request to get started."
                  >
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard/erands/new")}
                      className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-content-inverse transition hover:opacity-90"
                    >
                      Post an errand
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard/available-errands")}
                      className="rounded-full border border-line bg-surface-white px-4 py-2 text-xs font-bold text-brand transition hover:bg-surface-muted"
                    >
                      Browse errands
                    </button>
                  </Empty>
                )}
              </div>
            </Panel>
          </div>

          {/* Right column */}
          <aside className="min-w-0 space-y-6">
            <section
              aria-label="Wallet"
              className="relative overflow-hidden rounded-3xl bg-brand p-5 text-content-inverse sm:p-6"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-brand-mint/20 blur-3xl"
              />

              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
                    <Wallet size={16} className="text-brand-mint" aria-hidden="true" />
                    Available balance · {walletCurrency}
                  </p>
                </div>

                <p className="mt-3 break-words text-3xl font-extrabold tracking-tight tabular-nums">
                  {loading
                    ? "—"
                    : walletUnavailable
                      ? "Unavailable"
                      : mainWallet
                        ? formatMoney(mainWallet.availableBalance, walletCurrency)
                        : `No ${walletCurrency} wallet`}
                </p>

                {!walletUnavailable && otherWallets.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {otherWallets.map((wallet) => (
                      <span
                        key={wallet.id}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/85 ring-1 ring-inset ring-white/10"
                      >
                        {formatMoney(wallet.availableBalance, wallet.currency)}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="mt-3 text-[11px] leading-5 text-white/50">
                  Balances stay separate by currency. Nothing is converted.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/wallet")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-mint px-3 py-2.5 text-xs font-extrabold text-brand transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Wallet size={14} aria-hidden="true" />
                    Open wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/wallet")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 py-2.5 text-xs font-bold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                  >
                    <ArrowUpRight size={14} aria-hidden="true" />
                    Transactions
                  </button>
                </div>
              </div>
            </section>

            <Panel title="Shortcuts">
              <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft">
                {SHORTCUTS.map(({ icon: Icon, title, path }) => (
                  <li key={path}>
                    <button
                      type="button"
                      onClick={() => navigate(path)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-surface-muted/60 focus:outline-none focus-visible:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-6"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-brand">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-content">
                        {title}
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-content-subtle" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}