import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Copy, UserRound, X } from "lucide-react";

import { BTN_GHOST } from "./recordsStyles";
import {
  COPYABLE_REFERENCE_KEYS,
  GROUP_TONE,
  ID_KEYS,
  STATUS_COLUMNS,
  copyText,
  formatRelative,
  formatValue,
  fullName,
  humanize,
  shortId,
  statusGroup,
} from "./recordsUtils";

export function StatusPill({ value }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
        GROUP_TONE[statusGroup(value)]
      }`}
    >
      {humanize(value) || "—"}
    </span>
  );
}

export function CopyButton({ value, label = "Copied", className = "" }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <button
      type="button"
      title="Copy"
      aria-label="Copy"
      onClick={(event) => {
        event.stopPropagation();
        copyText(value, label);
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full p-1 text-content-subtle transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
    >
      <Copy size={12} aria-hidden="true" />
    </button>
  );
}

export function Avatar({ profile, size = "md" }) {
  const dimension =
    size === "sm"
      ? "h-7 w-7 text-[10px]"
      : size === "lg"
        ? "h-14 w-14 text-base"
        : "h-9 w-9 text-xs";

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  if (profile?.avatar_url)
    return (
      <img
        src={profile.avatar_url}
        alt={fullName(profile)}
        className={`${dimension} shrink-0 rounded-full border border-line object-cover`}
      />
    );

  return (
    <span
      className={`${dimension} inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-extrabold text-brand-mint`}
    >
      {initials || <UserRound size={size === "lg" ? 22 : 14} aria-hidden="true" />}
    </span>
  );
}

export function PersonButton({ profile, fallbackId, onClick }) {
  const label = profile ? fullName(profile) : shortId(fallbackId);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(profile, fallbackId);
      }}
      className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full text-left transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Avatar profile={profile} size="sm" />
      <span className="block max-w-[170px] truncate text-xs font-bold text-content">
        {label}
      </span>
    </button>
  );
}

/** Long text is cut off and opens in a dialog when clicked. */
export function TruncatedText({
  text,
  display,
  title,
  onExpand,
  limit = 34,
  mono = false,
  className = "",
}) {
  const full = String(text ?? "");
  const shown = display ?? full;
  const tone = `${mono ? "font-mono text-[11px]" : "text-xs"} ${className}`;

  if (full.length <= limit)
    return <span className={`${tone} text-content-muted`}>{shown}</span>;

  return (
    <button
      type="button"
      title="Click to read the full text"
      onClick={(event) => {
        event.stopPropagation();
        onExpand?.({ title, text: full });
      }}
      className={`${tone} block max-w-full truncate text-left text-content-muted underline decoration-line-strong decoration-dotted underline-offset-4 transition hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
    >
      {shown}
    </button>
  );
}

export function StructuredValue({ value, depth = 0 }) {
  if (value === null || value === undefined) return <span>—</span>;

  if (Array.isArray(value))
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div
            key={item?.id || index}
            className="rounded-xl bg-surface-white p-2.5"
          >
            <StructuredValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );

  if (typeof value === "object") {
    if (depth > 4)
      return <span className="break-all">{JSON.stringify(value)}</span>;

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-content-muted">
              {humanize(key)}
            </p>

            {key === "id" || key.endsWith("_id") ? (
              <div className="flex items-center gap-1">
                <code className="break-all text-[11px] text-content">
                  {String(item ?? "—")}
                </code>
                <CopyButton value={item} />
              </div>
            ) : typeof item === "object" && item !== null ? (
              <div className="mt-1">
                <StructuredValue value={item} depth={depth + 1} />
              </div>
            ) : (
              <p className="break-words text-xs text-content">
                {String(item ?? "—")}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return <span className="break-words">{String(value)}</span>;
}

/** A labelled value in a detail dialog. Full text, never truncated. */
export function DetailField({ label, value, row, field, className = "" }) {
  if (value === null || value === undefined || value === "") return null;

  const isId =
    ID_KEYS.has(field) ||
    field.endsWith("_id") ||
    COPYABLE_REFERENCE_KEYS.has(field);

  const isObject = typeof value === "object";

  return (
    <div
      className={`min-w-0 rounded-2xl bg-surface-muted/60 p-3.5 ${
        isObject ? "sm:col-span-2" : ""
      } ${className}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-content-muted">
        {label}
      </p>

      {STATUS_COLUMNS.includes(field) ? (
        <div className="mt-1.5">
          <StatusPill value={value} />
        </div>
      ) : isId ? (
        <div className="mt-1 flex items-center gap-1">
          <code className="min-w-0 break-all text-xs text-content">
            {String(value)}
          </code>
          <CopyButton value={value} />
        </div>
      ) : isObject ? (
        <div className="mt-2">
          <StructuredValue value={value} />
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-content">
          {formatValue(field, value, row)}
        </p>
      )}
    </div>
  );
}

export function Banner({ tone = "success", children, onDismiss, icon: Icon }) {
  const styles =
    tone === "success"
      ? "border-success bg-brand-pale text-success-dark"
      : tone === "danger"
        ? "border-rose-500 bg-rose-50 text-rose-900"
        : tone === "warning"
          ? "border-amber-400 bg-amber-50 text-amber-900"
          : "border-sky-400 bg-sky-50 text-sky-900";

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-r-2xl border-l-4 p-4 text-sm leading-6 ${styles}`}
    >
      {Icon ? <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">{children}</div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 opacity-70 transition hover:opacity-100"
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "amber"
      ? "text-amber-700"
      : tone === "rose"
        ? "text-rose-700"
        : "text-content";

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface-white px-4 py-3.5">
      <p className="truncate text-xs font-semibold text-content-muted">{label}</p>
      <p
        className={`mt-1 truncate text-2xl font-extrabold tracking-tight tabular-nums ${toneClass}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-content-subtle">{hint}</p>
      ) : null}
    </div>
  );
}













export function Popover({
  icon: Icon,
  label,
  badge,
  children,
  width = "w-64",
  align = "right",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, left } in viewport coords
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  // Measure the trigger + panel and place the panel in the viewport.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const GAP = 8;
    const MARGIN = 8;

    // Horizontal: align=right => panel's left edge lines up with trigger's left edge.
    let left = align === "right" ? rect.left : rect.right - panelWidth;
    left = Math.min(
      Math.max(MARGIN, left),
      window.innerWidth - panelWidth - MARGIN
    );

    // Vertical: below by default, flip above if it would overflow.
    let top = rect.bottom + GAP;
    const overflowsBottom =
      top + panelHeight + MARGIN > window.innerHeight;
    const fitsAbove = rect.top - GAP - panelHeight >= MARGIN;
    if (overflowsBottom && fitsAbove) top = rect.top - GAP - panelHeight;

    setPos({ top, left });
  }, [align]);

  // Place before paint so it never flashes at 0,0.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, place]);

  // Reposition when the panel's size changes (async children, images, etc.)
  useEffect(() => {
    if (!open || !panelRef.current) return undefined;
    const observer = new ResizeObserver(() => place());
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [open, place]);

  // Outside-click, Escape, and reflow handling.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReflow = () => place();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReflow);
    // capture=true so scroll on any inner container also repositions
    window.addEventListener("scroll", onReflow, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`${BTN_GHOST} h-10 !px-3.5 !py-0`}
      >
        <Icon size={15} aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
        {badge ? (
          <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-content-inverse">
            {badge}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              style={{
                top: pos ? pos.top : -9999,
                left: pos ? pos.left : -9999,
                visibility: pos ? "visible" : "hidden",
              }}
              className={`fixed z-[99999] ${width} max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-surface-white p-2 shadow-[0_16px_45px_rgba(9,20,38,0.16)]`}
            >
              {typeof children === "function"
                ? children(() => setOpen(false))
                : children}
            </div>,
            document.body
          )
        : null}
    </>
  );
}












export function SkeletonRows() {
  return (
    <div role="status" aria-live="polite" className="space-y-px">
      <span className="sr-only">Loading live records</span>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-4 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-1/5 animate-pulse rounded-full bg-surface-muted" />
          <div className="h-4 w-1/4 animate-pulse rounded-full bg-surface-muted" />
          <div className="h-4 w-1/6 animate-pulse rounded-full bg-surface-muted" />
          <div className="ml-auto h-6 w-20 animate-pulse rounded-full bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3"
    >
      <span className="sr-only">Loading live records</span>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="space-y-3 rounded-2xl border border-line p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-surface-muted" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-surface-muted" />
          </div>
          <div className="h-3 w-full animate-pulse rounded-full bg-surface-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-surface-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function LastUpdated({ date }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  if (!date) return null;

  return (
    <span className="text-xs text-content-muted">
      Updated {formatRelative(date)}
    </span>
  );
}