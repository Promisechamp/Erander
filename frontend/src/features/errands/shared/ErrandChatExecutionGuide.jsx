import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  MessageCircle,
  ReceiptText,
} from "lucide-react";

const CATEGORY_GUIDANCE = {
  shopping: {
    title: "Shopping updates and receipts",
    description:
      "Keep the customer informed about item availability, substitutions and purchases. Share receipt images and relevant item photos directly in this errand chat.",
    items: [
      "Confirm any material substitution or price change with the customer before proceeding.",
      "Share purchase receipts and relevant item photos in the conversation.",
    ],
  },
  delivery: {
    title: "Pickup and delivery updates",
    description:
      "Use this conversation for pickup progress, delivery updates and handover confirmation. Share relevant package or handover photos here when appropriate.",
    items: [
      "Keep both parties informed when the item is collected and delivered.",
      "Confirm the handover in chat; share only photos that are appropriate to the item.",
    ],
  },
  confidential: {
    title: "Confidential handover updates",
    description:
      "Use this conversation to coordinate the authorised handover and record confirmation from the recipient.",
    items: [
      "Confirm the authorised recipient and handover through the conversation.",
      "Do not photograph or upload confidential document contents, identity details or sensitive pages as proof.",
    ],
    sensitive: true,
  },
  pickup: {
    title: "Pickup and handover updates",
    description:
      "Keep the customer informed about collection and handover. Share relevant receipt or item photos directly in this errand chat.",
    items: [
      "Confirm collection and delivery progress in the conversation.",
      "Share relevant receipt or handover images here when appropriate.",
    ],
  },
  home_help: {
    title: "Home task progress",
    description:
      "Use this conversation to coordinate progress, materials and any decisions that need the customer's approval.",
    items: [
      "Discuss changes to the agreed task or materials before proceeding.",
      "Share progress or before-and-after photos in chat only when appropriate and agreed.",
    ],
  },
  personal_assistance: {
    title: "Task progress updates",
    description:
      "Use this conversation to coordinate the task and keep the other party informed about progress and decisions.",
    items: [
      "Confirm any change to the agreed scope before proceeding.",
      "Share relevant receipts or photos in chat when appropriate.",
    ],
  },
  business_support: {
    title: "Business errand updates",
    description:
      "Keep the authorised business contact informed about progress, approvals and purchases. Share relevant receipt images in this errand chat.",
    items: [
      "Obtain the required approval before making an unapproved purchase or changing the agreed scope.",
      "Share relevant receipts in chat, and do not disclose unrelated confidential business information.",
    ],
  },
  other: {
    title: "Errand progress updates",
    description:
      "Use this conversation to keep the other party informed and record important decisions about the agreed errand.",
    items: [
      "Confirm changes to the agreed scope before proceeding.",
      "Share relevant receipts, photos or handover confirmation in chat when appropriate.",
    ],
  },
};

export default function ErrandChatExecutionGuide({
  errand,
  role = "customer",
  onOpenChat,
}) {
  if (!errand || typeof onOpenChat !== "function") return null;

  const category = String(errand.category || "other").toLowerCase();
  const guidance = CATEGORY_GUIDANCE[category] || CATEGORY_GUIDANCE.other;
  const isErander = role === "erander";

  return (
    <section className="rounded-2xl border border-line bg-surface-white p-5 shadow-erander-card sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand-green">
          <MessageCircle size={21} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-content-subtle">
            Execution and completion
          </p>
          <h2 className="mt-1 text-base font-extrabold text-content">
            {guidance.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-content-muted">
            {guidance.description}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {guidance.items.map((item, index) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-content">
            {guidance.sensitive && index === 1 ? (
              <AlertTriangle
                size={17}
                className="mt-1 shrink-0 text-amber-600"
                aria-hidden="true"
              />
            ) : index === 1 && category === "shopping" ? (
              <ReceiptText
                size={17}
                className="mt-1 shrink-0 text-brand-green"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                size={17}
                className="mt-1 shrink-0 text-brand-green"
                aria-hidden="true"
              />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-muted p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-xs leading-5 text-content-muted">
          <Camera size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {isErander
              ? "Send progress updates and any appropriate receipt or image through the existing errand chat."
              : "Receipts, images and progress updates are shared in the existing errand chat."}
            {" "}There is no separate evidence-upload area.
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenChat}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-brand shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Open errand chat
        </button>
      </div>
    </section>
  );
}
