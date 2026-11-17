import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
MoreHorizontal,
X,
AlertCircle,
LifeBuoy,
ChevronRight,
Loader2,
CheckCircle2,
AlertTriangle,
Check,
} from "lucide-react";

/* -------------------------------------------------------
SHARED HELPERS
------------------------------------------------------- */

const DANGER_STYLES = {
container: "border-red-200 bg-red-50 text-red-700",
hover: "hover:bg-red-100",
icon: "text-red-600",
};

function getActionKey(action, index) {
return action.id || `${action.label || "action"}-${index}`;
}

function useBodyScrollLock(active) {
useEffect(() => {
if (!active) return;

const previousOverflow = document.body.style.overflow;
document.body.style.overflow = "hidden";

return () => {
  document.body.style.overflow = previousOverflow;
};

}, [active]);
}

/* -------------------------------------------------------
ACTION MENU
------------------------------------------------------- */

export function ActionMenu({
actions = [],
label = "More actions",
align = "right",
disabled = false,
}) {
const [open, setOpen] = useState(false);
const menuRef = useRef(null);
const triggerRef = useRef(null);
const firstItemRef = useRef(null);

const availableActions = actions.filter(
(action) => action && action.hidden !== true
);

useEffect(() => {
if (!open) return;

const handleOutsideClick = (event) => {
  if (
    menuRef.current &&
    !menuRef.current.contains(event.target)
  ) {
    setOpen(false);
  }
};

const handleEscape = (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
  }
};

document.addEventListener("mousedown", handleOutsideClick);
document.addEventListener("keydown", handleEscape);

return () => {
  document.removeEventListener("mousedown", handleOutsideClick);
  document.removeEventListener("keydown", handleEscape);
};

}, [open]);

useEffect(() => {
if (open) {
firstItemRef.current?.focus();
}
}, [open]);

if (!availableActions.length) return null;

const handleMenuKeyDown = (event) => {
const menuItems = Array.from(
menuRef.current?.querySelectorAll(
'[role="menuitem"]:not(:disabled)'
) || []
);

const currentIndex = menuItems.indexOf(document.activeElement);

if (event.key === "ArrowDown") {
  event.preventDefault();
  menuItems[(currentIndex + 1) % menuItems.length]?.focus();
}

if (event.key === "ArrowUp") {
  event.preventDefault();
  menuItems[
    (currentIndex - 1 + menuItems.length) % menuItems.length
  ]?.focus();
}

if (event.key === "Home") {
  event.preventDefault();
  menuItems[0]?.focus();
}

if (event.key === "End") {
  event.preventDefault();
  menuItems[menuItems.length - 1]?.focus();
}

};

return (
<div className="relative inline-block" ref={menuRef}>
<button
ref={triggerRef}
type="button"
disabled={disabled}
onClick={() => setOpen((previous) => !previous)}
aria-label={label}
aria-expanded={open}
aria-haspopup="menu"
className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-white text-content-muted transition hover:border-line-strong hover:bg-surface hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
>
<MoreHorizontal size={21} />
</button>

  {open && (
    <div
      role="menu"
      aria-label={label}
      onKeyDown={handleMenuKeyDown}
      className={`absolute top-12 z-50 w-60 overflow-hidden rounded-2xl border border-line bg-surface-white p-1.5 shadow-erander-card ${
        align === "left" ? "left-0" : "right-0"
      }`}
    >
      {availableActions.map((action, index) => {
        const Icon = action.icon || ChevronRight;
        const isDanger = action.danger === true;

        return (
          <button
            key={getActionKey(action, index)}
            ref={index === 0 ? firstItemRef : null}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            onClick={() => {
              setOpen(false);
              action.onClick?.();
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint disabled:cursor-not-allowed disabled:opacity-40 ${
              isDanger
                ? "text-red-600 hover:bg-red-50"
                : "text-content hover:bg-surface"
            }`}
          >
            <Icon size={16} className="shrink-0" />

            <span className="min-w-0 flex-1">
              {action.label}
            </span>

            {action.description && (
              <span className="text-[10px] font-medium text-content-subtle">
                {action.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  )}
</div>

);
}

/* -------------------------------------------------------
RAISE TICKET BUTTON
------------------------------------------------------- */

export function RaiseTicketButton({
onClick,
disabled = false,
loading = false,
variant = "secondary",
label = "Raise a ticket",
className = "",
}) {
const variants = {
primary:
"border-transparent bg-brand-navy text-white hover:bg-brand-navy",
secondary:
"border-line bg-surface-white text-content hover:border-line-strong hover:bg-surface",
danger:
"border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

return (
<button
type="button"
onClick={onClick}
disabled={disabled || loading}
aria-busy={loading}
className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${ variants[variant] || variants.secondary } ${className}`}
>
{loading ? (
<Loader2 size={16} className="animate-spin" />
) : (
<LifeBuoy size={16} />
)}

  {loading ? "Please wait..." : label}
</button>

);
}

/* -------------------------------------------------------
CONFIRMATION DIALOG
------------------------------------------------------- */

export function ConfirmationDialog({
open,
title = "Are you sure?",
description,
confirmLabel = "Confirm",
cancelLabel = "Cancel",
onConfirm,
onCancel,
loading = false,
danger = false,
icon,
}) {
const cancelRef = useRef(null);
const confirmRef = useRef(null);
const previousFocusRef = useRef(null);
const titleId = useId();
const descriptionId = useId();

useBodyScrollLock(open);

useEffect(() => {
if (!open) return;

previousFocusRef.current = document.activeElement;
cancelRef.current?.focus();

const handleEscape = (event) => {
  if (event.key === "Escape" && !loading) {
    event.preventDefault();
    onCancel?.();
  }
};

const handleTab = (event) => {
  if (event.key !== "Tab") return;

  const focusableElements = [
    cancelRef.current,
    confirmRef.current,
  ].filter(Boolean).filter((element) => !element.disabled);

  if (!focusableElements.length) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (
    event.shiftKey &&
    document.activeElement === firstElement
  ) {
    event.preventDefault();
    lastElement.focus();
  } else if (
    !event.shiftKey &&
    document.activeElement === lastElement
  ) {
    event.preventDefault();
    firstElement.focus();
  }
};

document.addEventListener("keydown", handleEscape);
document.addEventListener("keydown", handleTab);

return () => {
  document.removeEventListener("keydown", handleEscape);
  document.removeEventListener("keydown", handleTab);

  previousFocusRef.current?.focus?.();
};

}, [open, loading, onCancel]);

if (!open) return null;

const Icon = icon || (danger ? AlertTriangle : AlertCircle);

const dialog = (
<div
className="fixed inset-0 z-[100] flex items-center justify-center bg-[#091426]/60 p-4 backdrop-blur-sm"
role="presentation"
onMouseDown={(event) => {
if (
event.target === event.currentTarget &&
!loading
) {
onCancel?.();
}
}}
>
<div
role="alertdialog"
aria-modal="true"
aria-labelledby={titleId}
aria-describedby={description ? descriptionId : undefined}
className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface-white shadow-2xl"
>
<div className="p-6 sm:p-7">
<div
className={`flex h-14 w-14 items-center justify-center rounded-2xl ${ danger ? "bg-red-50 text-red-600" : "bg-brand-pale text-brand-navy" }`}
>
<Icon size={24} />
</div>

      <h3
        id={titleId}
        className="mt-5 text-lg font-extrabold tracking-tight text-content"
      >
        {title}
      </h3>

      {description && (
        <p
          id={descriptionId}
          className="mt-2 text-sm leading-6 text-content-muted"
        >
          {description}
        </p>
      )}
    </div>

    <div className="flex flex-col-reverse gap-2 border-t border-line-soft bg-surface p-4 sm:flex-row sm:justify-end">
      <button
        ref={cancelRef}
        type="button"
        disabled={loading}
        onClick={onCancel}
        className="rounded-xl border border-line bg-surface-white px-4 py-2.5 text-xs font-bold text-content-muted transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint disabled:opacity-50"
      >
        {cancelLabel}
      </button>

      <button
        ref={confirmRef}
        type="button"
        disabled={loading}
        onClick={onConfirm}
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          danger
            ? "bg-red-600 hover:bg-red-700"
            : "bg-brand-navy hover:bg-brand-navy"
        }`}
      >
        {loading && (
          <Loader2 size={15} className="animate-spin" />
        )}

        {loading ? "Processing..." : confirmLabel}
      </button>
    </div>
  </div>
</div>

);

return createPortal(dialog, document.body);
}

/* -------------------------------------------------------
ACTION FEEDBACK
------------------------------------------------------- */

export function ActionFeedback({
type = "success",
title,
message,
onClose,
}) {
const isSuccess = type === "success";
const isWarning = type === "warning";

const Icon = isSuccess
? CheckCircle2
: isWarning
? AlertTriangle
: AlertCircle;

const styles = isSuccess
? {
container: "border-green-200 bg-green-50",
icon: "text-success",
title: "text-green-800",
message: "text-green-700",
}
: isWarning
? {
container: "border-amber-200 bg-amber-50",
icon: "text-amber-600",
title: "text-amber-800",
message: "text-amber-700",
}
: {
container: "border-red-200 bg-red-50",
icon: "text-red-600",
title: "text-red-800",
message: "text-red-700",
};

return (
<div
role={isSuccess ? "status" : "alert"}
className={`flex items-start gap-3 rounded-2xl border p-4 ${styles.container}`}
>
<Icon
size={19}
className={`mt-0.5 shrink-0 ${styles.icon}`}
/>

  <div className="min-w-0 flex-1">
    <p className={`text-sm font-bold ${styles.title}`}>
      {title ||
        (isSuccess
          ? "Successful"
          : isWarning
            ? "Attention required"
            : "Something went wrong")}
    </p>

    {message && (
      <p className={`mt-1 text-xs leading-5 ${styles.message}`}>
        {message}
      </p>
    )}
  </div>

  {onClose && (
    <button
      type="button"
      onClick={onClose}
      aria-label="Dismiss notification"
      className="shrink-0 rounded-lg p-1 text-content-subtle transition hover:bg-surface-white hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
    >
      <X size={17} />
    </button>
  )}
</div>

);
}

/* -------------------------------------------------------
INLINE SUCCESS FEEDBACK
------------------------------------------------------- */

export function ActionSuccess({
message = "Action completed successfully.",
className = "",
}) {
return (
<div
role="status"
className={`inline-flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-xs font-semibold text-success-dark ${className}`}
>
<Check size={15} className="shrink-0" />
<span>{message}</span>
</div>
);
}

/* -------------------------------------------------------
SHARED ACTIONS EXPORT
------------------------------------------------------- */

export default function ErandSharedActions({
actions = [],
onRaiseTicket,
ticketLoading = false,
ticketDisabled = false,
menuAlign = "right",
ticketLabel = "Raise a ticket",
ticketVariant = "secondary",
className = "",
}) {
return (
<div className={`flex items-center gap-2 ${className}`}>
{onRaiseTicket && (
<RaiseTicketButton
onClick={onRaiseTicket}
loading={ticketLoading}
disabled={ticketDisabled}
label={ticketLabel}
variant={ticketVariant}
/>
)}

  <ActionMenu
    actions={actions}
    align={menuAlign}
  />
</div>

);
}