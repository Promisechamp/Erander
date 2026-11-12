import { CheckCircle2, Clock3, MessageCircle, CircleDot } from "lucide-react";
import { getStatusLabel } from "./supportUtils";

const statusStyles = {
  open: {
    className: "bg-blue-50 text-blue-700 border-blue-100",
    icon: CircleDot,
  },
  in_progress: {
    className: "bg-amber-50 text-amber-700 border-amber-100",
    icon: Clock3,
  },
  awaiting_user: {
    className: "bg-violet-50 text-violet-700 border-violet-100",
    icon: MessageCircle,
  },
  resolved: {
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: CheckCircle2,
  },
  closed: {
    className: "bg-slate-100 text-slate-600 border-slate-200",
    icon: CheckCircle2,
  },
};

export default function SupportStatusBadge({ status = "open" }) {
  const config = statusStyles[status] ?? statusStyles.open;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${config.className}`}
    >
      <Icon size={13} strokeWidth={2.2} />
      {getStatusLabel(status)}
    </span>
  );
}