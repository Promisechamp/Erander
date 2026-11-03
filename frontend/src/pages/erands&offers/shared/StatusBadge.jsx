import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  XCircle,
  CircleDashed,
  PlayCircle,
  Wallet,
  Ban,
} from "lucide-react";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    color: "bg-surface-muted text-content-muted",
    icon: CircleDashed,
  },
  pending: {
    label: "Pending",
    color: "bg-amber-50 text-amber-700",
    icon: Clock3,
  },
  open: {
    label: "Open",
    color: "bg-sky-50 text-sky-700",
    icon: CircleDashed,
  },
  assigned: {
    label: "Assigned",
    color: "bg-brand-pale text-brand-navy",
    icon: CheckCircle2,
  },
  offer_selected: {
    label: "Erander assigned",
    color: "bg-brand-pale text-brand-navy",
    icon: CheckCircle2,
  },
  awaiting_funding: {
    label: "Awaiting funding",
    color: "bg-amber-50 text-amber-700",
    icon: Wallet,
  },
  funded: {
    label: "Funded",
    color: "bg-success-soft text-success-dark",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "In progress",
    color: "bg-sky-50 text-sky-700",
    icon: PlayCircle,
  },
  completion_submitted: {
    label: "Completion submitted",
    color: "bg-violet-50 text-violet-700",
    icon: Clock3,
  },
  completed: {
    label: "Completed",
    color: "bg-success-soft text-success-dark",
    icon: CheckCircle2,
  },
  disputed: {
    label: "Disputed",
    color: "bg-orange-50 text-orange-700",
    icon: AlertTriangle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    color: "bg-surface-muted text-content-muted",
    icon: Ban,
  },
  accepted: {
    label: "Accepted",
    color: "bg-success-soft text-success-dark",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  withdrawn: {
    label: "Withdrawn",
    color: "bg-surface-muted text-content-muted",
    icon: Ban,
  },
  superseded: {
    label: "Superseded",
    color: "bg-surface-muted text-content-muted",
    icon: CircleDashed,
  },
};

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-[10px] gap-1.5",
  md: "px-3 py-1.5 text-xs gap-1.5",
  lg: "px-3.5 py-2 text-sm gap-2",
};

export function getStatusConfig(status) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  return (
    STATUS_CONFIG[normalizedStatus] || {
      label: normalizedStatus
        ? normalizedStatus.replaceAll("_", " ")
        : "Unknown",
      color: "bg-surface-muted text-content-muted",
      icon: CircleDashed,
    }
  );
}

export default function StatusBadge({
  status,
  size = "md",
  showIcon = true,
  className = "",
  label,
}) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={[
        "inline-flex w-fit items-center whitespace-nowrap rounded-full font-bold tracking-tight",
        "border border-transparent",
        config.color,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className,
      ].join(" ")}
      role="status"
      aria-label={label || config.label}
    >
      {showIcon && (
        <Icon
          size={size === "lg" ? 16 : size === "sm" ? 11 : 13}
          strokeWidth={2.3}
          aria-hidden="true"
        />
      )}

      <span>{label || config.label}</span>
    </span>
  );
}

export function StatusLegend({ statuses = [] }) {
  if (!statuses.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {statuses.map((status) => (
        <StatusBadge
          key={status}
          status={status}
          size="sm"
          showIcon={false}
        />
      ))}
    </div>
  );
}

export function StatusIndicator({
  status,
  title,
  description,
  className = "",
}) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border border-line bg-surface-white p-4",
        "shadow-erander-card",
        className,
      ].join(" ")}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.color}`}
      >
        <Icon
          size={19}
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-content-subtle">
          {title || "Current status"}
        </p>

        <p className="mt-1.5 text-sm font-extrabold capitalize tracking-tight text-content">
          {config.label}
        </p>

        {description && (
          <p className="mt-1.5 text-xs leading-relaxed text-content-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}