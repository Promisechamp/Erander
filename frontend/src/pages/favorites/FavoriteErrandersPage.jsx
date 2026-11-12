import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Heart,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Modal from "@/components/Modal";
import {
  getFavoriteErranders,
  addFavoriteEranderByEmail,
  removeFavoriteErander,
} from "@/services/favorites/favoriteErrandersApi";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "unavailable", label: "Unavailable" },
];

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GREEN = `${BTN} bg-brand-green text-brand hover:brightness-95`;
const BTN_NAVY = `${BTN} bg-brand text-content-inverse hover:opacity-90`;
const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface-muted hover:text-content`;
const BTN_DANGER = `${BTN} bg-rose-600 text-white hover:bg-rose-700`;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const unwrap = (value) => value?.data ?? value ?? {};

function initials(name) {
  return (
    String(name || "E")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E"
  );
}

/* -------------------------------------------------------------------------- */
/*                               SMALL COMPONENTS                             */
/* -------------------------------------------------------------------------- */

function Bone({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-full bg-line ${className}`}
    />
  );
}

function ListSkeleton() {
  return (
    <ul
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="divide-y divide-line-soft"
    >
      <span className="sr-only">Loading your favorite erranders</span>
      {[0, 1, 2, 3].map((item) => (
        <li key={item} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <Bone className="h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Bone className="h-4 w-40" />
            <Bone className="h-3 w-56 max-w-full" />
          </div>
          <Bone className="h-9 w-24" />
        </li>
      ))}
    </ul>
  );
}

function StatCard({ label, value, icon: Icon, loading }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-content-muted">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-pale text-success-dark">
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-12 animate-pulse rounded-lg bg-line" />
      ) : (
        <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-content">
          {value}
        </p>
      )}
    </div>
  );
}

function FavoriteRow({ favorite, onRemove }) {
  const name = favorite.name || "ERANDER member";

  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition hover:bg-surface-muted/50 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {favorite.avatar_url ? (
          <img
            src={favorite.avatar_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-brand-mint"
          >
            {initials(name)}
          </span>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-extrabold text-content sm:text-base">
              {name}
            </h3>

            {favorite.is_assignable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                <ShieldCheck size={11} aria-hidden="true" />
                Active erander
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-100">
                Currently unavailable
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-content-muted">
            {favorite.is_assignable
              ? "Saved to your personal favorites"
              : "This account can't currently receive new assignments"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(favorite)}
        aria-label={`Remove ${name} from favorites`}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-line bg-surface-white px-4 py-2 text-xs font-bold text-content-muted transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 sm:self-auto"
      >
        <Trash2 size={14} aria-hidden="true" />
        Remove
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function FavoriteErrandersPage() {
  const [favorites, setFavorites] = useState([]);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removingId, setRemovingId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadFavorites = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    setLoadError("");

    try {
      const result = await getFavoriteErranders();
      setFavorites(unwrap(result).favorites || []);
    } catch (error) {
      const message =
        error.message || "Unable to load your favorite erranders.";

      if (quiet) toast.error(message);
      else setLoadError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const counts = useMemo(
    () => ({
      total: favorites.length,
      active: favorites.filter((item) => item.is_assignable).length,
      unavailable: favorites.filter((item) => !item.is_assignable).length,
    }),
    [favorites]
  );

  const filteredFavorites = useMemo(() => {
    const query = search.trim().toLowerCase();

    return favorites.filter((item) => {
      if (filter === "active" && !item.is_assignable) return false;
      if (filter === "unavailable" && item.is_assignable) return false;

      return (
        !query || String(item.name || "").toLowerCase().includes(query)
      );
    });
  }, [favorites, search, filter]);

  const hasFilters = Boolean(search) || filter !== "all";

  async function handleAddByEmail(event) {
    event.preventDefault();

    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      toast.error("Enter the erander's registered email address.");
      return;
    }

    setAdding(true);

    try {
      const result = await addFavoriteEranderByEmail(normalized);
      toast.success(result?.message || "Erander added to your favorites.");
      setEmail("");
      await loadFavorites({ quiet: true });
    } catch (error) {
      toast.error(
        error.message || "We couldn't add an eligible erander with those details."
      );
    } finally {
      setAdding(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;

    const eranderId = removeTarget.erander_id;

    setRemovingId(eranderId);

    try {
      const result = await removeFavoriteErander(eranderId);

      toast.success(result?.message || "Erander removed from your favorites.");

      setFavorites((current) =>
        current.filter((item) => item.erander_id !== eranderId)
      );
      setRemoveTarget(null);
    } catch (error) {
      toast.error(error.message || "Unable to remove this erander.");
    } finally {
      setRemovingId("");
    }
  }

  function clearFilters() {
    setSearch("");
    setFilter("all");
  }

  const removing = Boolean(removingId);

  return (
    <DashboardLayout
      title="Favorite Erranders"
      description="Keep the people you prefer close at hand when you need an errand done."
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-success">
              Your personal list
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
              Favorite erranders
            </h1>
            <p className="mt-1 max-w-xl text-sm text-content-muted">
              Save eranders you know and prefer. Your list is private, and saving
              someone here doesn't assign them to an errand.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadFavorites({ quiet: true })}
            disabled={refreshing || loading}
            aria-label="Refresh favorites"
            className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-line bg-surface-white px-4 text-sm font-bold text-brand transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 sm:self-auto"
          >
            {refreshing ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={16} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        {/* Stats */}
        <section
          aria-label="Favorites summary"
          className="grid grid-cols-3 gap-3"
        >
          <StatCard label="Saved" value={counts.total} icon={Heart} loading={loading} />
          <StatCard label="Active" value={counts.active} icon={ShieldCheck} loading={loading} />
          <StatCard label="Unavailable" value={counts.unavailable} icon={AlertCircle} loading={loading} />
        </section>

        {/* Add by email */}
        <section
          aria-label="Add an erander"
          className="rounded-3xl border border-line bg-surface-white p-5 sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-pale text-success-dark">
              <UserPlus size={19} aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <h2 className="text-base font-extrabold tracking-tight text-content">
                Add an erander by email
              </h2>
              <p className="mt-0.5 text-sm leading-6 text-content-muted">
                Enter the email the erander uses on ERANDER. You can add someone
                even if you haven't worked together before.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleAddByEmail}
            className="mt-5 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative min-w-0 flex-1">
              <label htmlFor="favorite-email" className="sr-only">
                Erander email address
              </label>

              <Mail
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-subtle"
              />

              <input
                id="favorite-email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="erander@example.com"
                autoComplete="email"
                disabled={adding}
                className="h-12 w-full rounded-full border border-line bg-surface-white pl-11 pr-4 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={adding || !email.trim()}
              className={`${BTN_GREEN} h-12 shrink-0 !px-6`}
            >
              {adding ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus size={16} aria-hidden="true" />
              )}
              {adding ? "Checking account" : "Add to favorites"}
            </button>
          </form>

          <p className="mt-3 text-xs leading-5 text-content-muted">
            Only active accounts with an erander role can be added. We don't
            reveal whether an email belongs to another type of account.
          </p>
        </section>

        {/* List */}
        <section
          aria-label="Your saved erranders"
          className="overflow-hidden rounded-3xl border border-line bg-surface-white"
        >
          <div className="space-y-4 border-b border-line-soft p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-content">
                Your saved erranders
              </h2>
              <p className="mt-0.5 text-sm text-content-muted">
                Choose from this list when you want to work with someone you
                already know.
              </p>
            </div>

            {favorites.length > 0 ? (
              <>
                <div className="relative">
                  <label htmlFor="favorite-search" className="sr-only">
                    Search your favorites
                  </label>

                  <Search
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-content-subtle"
                  />

                  <input
                    id="favorite-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search your favorites"
                    className="h-11 w-full rounded-full border border-line bg-surface-white pl-11 pr-10 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale"
                  />

                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div
                  role="group"
                  aria-label="Filter favorites"
                  className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {FILTERS.map((item) => {
                    const active = filter === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilter(item.value)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          active
                            ? "bg-brand text-content-inverse"
                            : "bg-surface-muted text-content-muted hover:text-content"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          {loading ? (
            <ListSkeleton />
          ) : loadError ? (
            <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                <AlertCircle size={26} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-extrabold text-content">
                Unable to load your favorites
              </h3>
              <p className="mt-1 max-w-md break-words text-sm leading-6 text-content-muted">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => loadFavorites()}
                className={`${BTN_NAVY} mt-5`}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : filteredFavorites.length ? (
            <>
              <ul className="divide-y divide-line-soft">
                {filteredFavorites.map((favorite) => (
                  <FavoriteRow
                    key={favorite.erander_id}
                    favorite={favorite}
                    onRemove={setRemoveTarget}
                  />
                ))}
              </ul>

              <p className="border-t border-line-soft px-5 py-3.5 text-xs font-semibold tabular-nums text-content-muted sm:px-6">
                Showing {filteredFavorites.length} of {favorites.length}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
                <UserRound size={24} aria-hidden="true" />
              </span>

              <h3 className="mt-4 text-base font-extrabold text-content">
                {favorites.length
                  ? "No matching erranders"
                  : "Your favorites list is empty"}
              </h3>

              <p className="mt-1 max-w-md text-sm leading-6 text-content-muted">
                {favorites.length
                  ? "Try another name or clear your filters."
                  : "Add an erander by email to start your personal list. You can also save an erander from their profile when that option is available."}
              </p>

              {hasFilters && favorites.length ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${BTN_GHOST} mt-5`}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {/* Remove confirmation */}
      <Modal
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        dismissible={!removing}
        loading={removing}
        icon={Trash2}
        tone="danger"
        title="Remove from favorites?"
        subtitle="Favorite erander"
        size="sm"
        position="bottom"
        resizable={false}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setRemoveTarget(null)}
              disabled={removing}
              className={BTN_GHOST}
            >
              Keep
            </button>

            <button
              type="button"
              onClick={confirmRemove}
              disabled={removing}
              className={BTN_DANGER}
            >
              {removing ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Removing
                </>
              ) : (
                <>
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </>
              )}
            </button>
          </div>
        }
      >
        {removeTarget ? (
          <p className="pb-1 text-sm leading-6 text-content-muted">
            <b className="text-content">{removeTarget.name || "This erander"}</b>{" "}
            will be removed from your personal list. You can add them again by
            email at any time.
          </p>
        ) : null}
      </Modal>
    </DashboardLayout>
  );
}