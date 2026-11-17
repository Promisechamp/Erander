import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import { Check, ChevronDown, Maximize2, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const SIZE_WIDTH = {
  sm: "24rem",
  md: "32rem",
  lg: "42rem",
  "2xl": "48rem",
  xl: "56rem",
  full: "100vw",
};

const SIZE_LABEL = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  "2xl": "Large",
  xl: "Extra large",
  full: "Full screen",
};

const SIZE_OPTIONS = [
  { value: "sm", label: "Small", hint: "Compact" },
  { value: "md", label: "Medium", hint: "Standard" },
  { value: "lg", label: "Large", hint: "Wide" },
  { value: "xl", label: "Extra large", hint: "Extra wide" },
  { value: "full", label: "Full screen", hint: "Fills the whole screen" },
];

const HEIGHTS = {
  auto: "",
  sm: "h-[40dvh] sm:h-[42dvh]",
  medium: "h-[60dvh] sm:h-[65dvh]",
  lg: "h-[80dvh] sm:h-[82dvh]",
  full: "h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-3rem)]",
  screen: "h-dvh",
};

const TONES = {
  default: "bg-brand-pale text-success-dark",
  success: "bg-brand-pale text-success-dark",
  info: "bg-sky-50 text-sky-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-600",
};

const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };
const EXIT = { duration: 0.22, ease: [0.32, 0.72, 0, 1] };

/* Each modal stacked above another one is 2% smaller, so the one below peeks out. */
const STACK_STEP = 0.05;

const MOTION = {
  bottom: {
    container: "fixed inset-x-0 bottom-0 flex items-end justify-center",
    radius: "rounded-t-[1.75rem] rounded-b-none",
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
  },
  top: {
    container:
      "fixed inset-x-0 top-0 flex items-start justify-center p-3 sm:p-6",
    radius: "rounded-3xl",
    initial: { y: "-40%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "-40%", opacity: 0 },
  },
  left: {
    container: "fixed inset-y-0 left-0 flex items-stretch justify-start p-2 sm:p-4",
    radius: "rounded-3xl",
    initial: { x: "-100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "-100%", opacity: 0 },
  },
  right: {
    container: "fixed inset-y-0 right-0 flex items-stretch justify-end p-2 sm:p-4",
    radius: "rounded-3xl",
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "100%", opacity: 0 },
  },
  center: {
    container: "fixed inset-0 flex items-center justify-center p-3 sm:p-6",
    radius: "rounded-3xl",
    initial: { scale: 0.97, y: 8, opacity: 0 },
    animate: { scale: 1, y: 0, opacity: 1 },
    exit: { scale: 0.98, y: 4, opacity: 0 },
  },
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/* -------------------------------------------------------------------------- */
/*                         SHARED STACK + SCROLL LOCK                         */
/* -------------------------------------------------------------------------- */

/**
 * Open modals are tracked in order. Only the top one reacts to Esc and Tab,
 * each one knows its depth for the stacked look, and the page only unlocks
 * when the last one closes.
 */
const modalStack = [];
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => modalStack.join("|");
const getServerSnapshot = () => "";
const getTop = () => modalStack[modalStack.length - 1] ?? null;

function registerModal(id) {
  if (!modalStack.includes(id)) {
    modalStack.push(id);
    notify();
  }

  return () => {
    const index = modalStack.indexOf(id);

    if (index > -1) {
      modalStack.splice(index, 1);
      notify();
    }
  };
}

let lockCount = 0;
let savedBody = null;

function lockScroll() {
  lockCount += 1;
  if (lockCount > 1) return;

  const { body, documentElement } = document;
  const scrollbar = window.innerWidth - documentElement.clientWidth;

  savedBody = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
  };

  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0 || !savedBody) return;

  document.body.style.overflow = savedBody.overflow;
  document.body.style.paddingRight = savedBody.paddingRight;
  savedBody = null;
}

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const media = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    setMatches(media.matches);
    media.addEventListener("change", handler);

    return () => media.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

function readStored(key) {
  if (!key) return null;

  try {
    const value = window.localStorage.getItem(key);
    return SIZE_OPTIONS.some((option) => option.value === value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  if (!key) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

/* -------------------------------------------------------------------------- */
/*                                  SIZE MENU                                 */
/* -------------------------------------------------------------------------- */

/**
 * Size dropdown. The list is rendered in a portal with fixed positioning, so
 * a small modal's own edges can never clip it.
 */
function SizeMenu({ value, onChange, zIndex }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();

    setPosition({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      )
        return;

      setOpen(false);
    };
    const onResize = () => setOpen(false);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("resize", onResize);

    const selected = menuRef.current?.querySelector("[aria-checked='true']");
    window.setTimeout(() => selected?.focus({ preventScroll: true }), 0);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const onMenuKeyDown = (event) => {
    // Nothing typed inside the menu should reach the modal underneath.
    event.stopPropagation();

    const items = [...menuRef.current.querySelectorAll("[role='menuitemradio']")];
    const index = items.indexOf(document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      close(true);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Window size: ${SIZE_LABEL[value] || "Medium"}`}
        title="Window size"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface-white px-3 text-xs font-bold text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Maximize2 size={14} aria-hidden="true" />
        <span className="hidden md:inline">{SIZE_LABEL[value] || "Medium"}</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Window size"
              onKeyDown={onMenuKeyDown}
              style={{
                position: "fixed",
                top: position.top,
                right: position.right,
                zIndex: zIndex + 10,
              }}
              className="w-60 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-line bg-surface-white p-1.5 shadow-[0_16px_45px_rgba(9,20,38,0.18)]"
            >
              {SIZE_OPTIONS.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onChange(option.value);
                      close(true);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      selected ? "bg-brand-pale" : "hover:bg-surface-muted"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-content">
                        {option.label}
                      </span>
                      <span className="block text-[11px] text-content-muted">
                        {option.hint}
                      </span>
                    </span>

                    {selected ? (
                      <Check
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-success-dark"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    MODAL                                   */
/* -------------------------------------------------------------------------- */

/**
 * Props
 * - isOpen, onClose, title, subtitle, description, children, footer
 * - size: sm | md | lg | 2xl | xl | full (starting size, the user can change it)
 * - position: bottom | center | top | left | right
 *   (bottom is a sheet on phones and a centered dialog on larger screens)
 * - height: auto | sm | medium | lg | full | screen
 * - icon: a lucide icon component, tone: default | success | info | warning | danger
 * - badge: node shown next to the title, headerActions: node shown before the controls
 * - resizable: show the size dropdown (default: on, hidden on phones)
 * - sizeStorageKey: remember the chosen size in this browser under this key
 * - showEscHint: show the "Esc" key next to the close button (default: on)
 * - dismissible: false blocks Esc, backdrop, drag and the close button (use while saving)
 * - loading: thin progress bar along the top edge
 * - padded: false removes body padding (for tables or full-bleed content)
 * - bodyClassName, className, zIndex, portal, initialFocusRef
 * - closeOnOutsideClick / closeOnOverlayClick, closeOnEscape, closeOnDrag
 * - showCloseButton, showHandle, headerTone (accepted, ignored: always light)
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  children,
  footer = null,

  size = "md",
  position = "bottom",
  height = "auto",

  icon: Icon,
  tone = "default",
  badge = null,
  headerActions = null,

  resizable = true,
  sizeStorageKey,
  showEscHint = true,

  dismissible = true,
  loading = false,
  padded = true,
  bodyClassName = "",

  showCloseButton = true,
  showHandle = true,

  closeOnOutsideClick = true,
  closeOnOverlayClick,
  closeOnEscape = true,
  closeOnDrag = true,

  // eslint-disable-next-line no-unused-vars
  headerTone,

  initialFocusRef,
  className = "",
  zIndex = 50,
  portal = true,
}) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const isMobile = useMediaQuery("(max-width: 639px)");

  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  const panelRef = useRef(null);
  const previousActive = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentSize, setCurrentSize] = useState(
    () => readStored(sizeStorageKey) || size
  );

  // Re-render whenever the stack changes, then read this modal's depth.
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const depth = modalStack.indexOf(id);
  const stackDepth = Math.max(0, depth);
  const isTop = depth === -1 || depth === modalStack.length - 1;

  // Latest props for the keyboard handler, so it never re-subscribes.
  const latest = useRef({});
  latest.current = { onClose, dismissible, closeOnEscape, initialFocusRef };

  useEffect(() => setMounted(true), []);

  // Follow the page's size prop (or the saved size) while closed or on change.
  useEffect(() => {
    setCurrentSize(readStored(sizeStorageKey) || size);
  }, [size, sizeStorageKey]);

  const allowBackdropClose = closeOnOverlayClick ?? closeOnOutsideClick;

  const requestClose = useCallback(() => {
    const { onClose: close, dismissible: allowed } = latest.current;
    if (allowed) close?.();
  }, []);

  /* ------------------------ Open: stack, lock, keys, focus ------------------------ */
  useEffect(() => {
    if (!isOpen) return undefined;

    const unregister = registerModal(id);
    lockScroll();

    previousActive.current = document.activeElement;

    const onKeyDown = (event) => {
      if (getTop() !== id) return;

      if (event.key === "Escape") {
        // Let an open dropdown or popover close itself first.
        if (event.defaultPrevented) return;

        const active = document.activeElement;
        if (active?.getAttribute?.("aria-expanded") === "true") return;

        const { closeOnEscape: allowed, dismissible: canClose, onClose: close } =
          latest.current;

        if (allowed && canClose) {
          event.preventDefault();
          event.stopPropagation();
          close?.();
        }
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll(FOCUSABLE)
      ).filter((element) => element.offsetParent !== null);

      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const requested = latest.current.initialFocusRef?.current;

      if (requested && typeof requested.focus === "function") {
        requested.focus({ preventScroll: true });
        return;
      }

      const active = document.activeElement;
      const insidePanel = active && panel.contains(active);
      const isField =
        active instanceof HTMLElement &&
        active.matches("input, textarea, select, [contenteditable='true']");

      if (!insidePanel && !isField) panel.focus({ preventScroll: true });
    }, 50);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      unregister();
      unlockScroll();
    };
  }, [isOpen, id]);

  useEffect(() => {
    if (isOpen) setScrolled(false);
  }, [isOpen]);

  // After the close animation: give focus back, and reset any size the user picked.
  const handleExitComplete = useCallback(() => {
    const previous = previousActive.current;

    if (previous && typeof previous.focus === "function" && document.contains(previous)) {
      requestAnimationFrame(() => {
        try {
          previous.focus({ preventScroll: true });
        } catch {
          previous.focus();
        }
      });
    }

    setCurrentSize(readStored(sizeStorageKey) || size);
  }, [sizeStorageKey, size]);

  function changeSize(next) {
    setCurrentSize(next);
    writeStored(sizeStorageKey, next);
  }

  /* ----------------------------------- Layout ----------------------------------- */
  const isFull = currentSize === "full";

  const effectivePosition =
    position === "bottom" && !isMobile ? "center" : position;

  const isSheet = effectivePosition === "bottom";
  const isDrawer = effectivePosition === "left" || effectivePosition === "right";
  const config = MOTION[effectivePosition] || MOTION.center;

  const showSizeMenu = resizable && !isMobile;

  const maxWidth = SIZE_WIDTH[currentSize] || SIZE_WIDTH.md;

  const containerClass = isFull ? "fixed inset-0 flex" : config.container;

  const radiusClass = isFull
    ? stackDepth > 0
      ? "rounded-2xl"
      : "rounded-none"
    : config.radius;

  const borderClass = isFull && stackDepth === 0 ? "border-0" : "border border-line";

  const heightClass = isFull
    ? "h-[100dvh]"
    : isDrawer
      ? "h-full"
      : HEIGHTS[height] ?? "";

  const maxHeightClass = isFull
    ? "max-h-[100dvh]"
    : isDrawer
      ? ""
      : isSheet
        ? "max-h-[calc(100dvh-1rem)]"
        : "max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]";

  const stackScale = Math.max(0.9, 1 - stackDepth * STACK_STEP);

  const motionProps = useMemo(
    () =>
      reduceMotion
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            enter: { duration: 0.12 },
            leave: { duration: 0.1 },
          }
        : {
            initial: config.initial,
            animate: { ...config.animate, scale: stackScale },
            exit: config.exit,
            enter: SPRING,
            leave: EXIT,
          },
    [config, reduceMotion, stackScale]
  );

  const enableDrag = isSheet && !isFull && closeOnDrag && dismissible && !reduceMotion;

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 110 || info.velocity.y > 650) requestClose();
  };

  const hasHeader = Boolean(
    title || subtitle || description || showCloseButton || headerActions || showSizeMenu
  );

  const showEsc = showEscHint && showCloseButton && closeOnEscape && dismissible;

  /* ----------------------------------- Render ----------------------------------- */
  const content = (
    <AnimatePresence initial={false} onExitComplete={handleExitComplete}>
      {isOpen ? (
        <motion.div
          key="erander-modal"
          className="fixed inset-0"
          style={{ zIndex }}
        >
          {/* Backdrop: only the first modal dims the page, so the one below stays readable */}
          <motion.div
            aria-hidden="true"
            className={`fixed inset-0 ${
              stackDepth > 0
                ? "bg-transparent"
                : "bg-brand-navy/25 backdrop-blur-[3px]"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={allowBackdropClose ? requestClose : undefined}
          />

          <div className={`${containerClass} pointer-events-none z-10 w-full min-h-0`}>
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descriptionId : undefined}
              aria-label={title ? undefined : "Dialog"}
              aria-busy={loading || undefined}
              tabIndex={-1}
              style={{
                maxWidth,
                transition: "max-width 320ms cubic-bezier(0.32, 0.72, 0, 1)",
              }}
              className={`pointer-events-auto relative flex min-h-0 w-full flex-col overflow-hidden bg-surface-white text-content shadow-[0_24px_70px_-16px_rgba(9,20,38,0.28)] outline-none ${borderClass} ${heightClass} ${maxHeightClass} ${radiusClass} ${className}`}
              initial={motionProps.initial}
              animate={motionProps.animate}
              exit={motionProps.exit}
              transition={isOpen ? motionProps.enter : motionProps.leave}
              drag={enableDrag ? "y" : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={enableDrag ? { top: 0, bottom: 0 } : undefined}
              dragElastic={enableDrag ? { top: 0, bottom: 0.32 } : undefined}
              onDragEnd={handleDragEnd}
              onClick={(event) => event.stopPropagation()}
            >
              {/* Loading bar */}
              {loading ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-brand-pale"
                >
                  {reduceMotion ? (
                    <span className="block h-full w-full bg-brand-green/70" />
                  ) : (
                    <motion.span
                      className="block h-full w-1/3 rounded-full bg-brand-green"
                      animate={{ x: ["-100%", "320%"] }}
                      transition={{
                        duration: 1.1,
                        ease: "easeInOut",
                        repeat: Infinity,
                      }}
                    />
                  )}
                </div>
              ) : null}

              {/* Sheet handle */}
              {isSheet && showHandle && !isFull ? (
                <div
                  aria-hidden="true"
                  onPointerDown={(event) => enableDrag && dragControls.start(event)}
                  className="flex shrink-0 touch-none justify-center bg-surface-white pb-1 pt-2.5"
                >
                  <span className="h-1 w-10 rounded-full bg-line-strong" />
                </div>
              ) : null}

              {/* Header */}
              {hasHeader ? (
                <header
                  className={`flex shrink-0 items-start gap-3 border-b bg-surface-white px-5 pb-4 pt-4 transition-colors duration-200 sm:gap-4 sm:px-7 sm:pt-6 ${
                    scrolled ? "border-line" : "border-transparent"
                  }`}
                >
                  {Icon ? (
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        TONES[tone] || TONES.default
                      }`}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </span>
                  ) : null}

                  <div className="min-w-0 flex-1 pt-0.5">
                    {subtitle ? (
                      <p className="mb-1 truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-success-dark">
                        {subtitle}
                      </p>
                    ) : null}

                    {title || badge ? (
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {title ? (
                          <h2
                            id={titleId}
                            className="min-w-0 break-words text-lg font-extrabold leading-7 tracking-tight text-content sm:text-xl"
                          >
                            {title}
                          </h2>
                        ) : null}
                        {badge}
                      </div>
                    ) : null}

                    {description ? (
                      <p
                        id={descriptionId}
                        className="mt-1 max-w-2xl break-words text-sm leading-6 text-content-muted"
                      >
                        {description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {headerActions}

                    {showSizeMenu ? (
                      <SizeMenu
                        value={currentSize}
                        onChange={changeSize}
                        zIndex={zIndex}
                      />
                    ) : null}

                    {showEsc ? (
                      <kbd
                        aria-hidden="true"
                        title="Press Esc to close"
                        className="hidden h-7 items-center rounded-lg border border-line border-b-2 bg-surface-muted px-2 text-[11px] font-extrabold text-content-muted sm:inline-flex"
                      >
                        Esc
                      </kbd>
                    ) : null}

                    {showCloseButton ? (
                      <button
                        type="button"
                        onClick={requestClose}
                        disabled={!dismissible}
                        aria-label="Close dialog"
                        title="Close"
                        className="flex h-9 w-9 items-center justify-center rounded-xl box-shadow-md border border-gray bg-surface-muted text-content-muted transition hover:bg-line hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X size={17} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </header>
              ) : null}

              {/* Body */}
              <div
                onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
                className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-surface-white ${
                  padded
                    ? `px-5 pt-4 sm:px-7 ${
                        footer
                          ? "pb-5"
                          : "pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                      }`
                    : ""
                } ${bodyClassName}`}
              >
                {children}
              </div>

              {/* Footer */}
              {footer ? (
                <footer className="shrink-0 border-t border-line-soft bg-surface-muted/50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
                  {footer}
                </footer>
              ) : null}

              {/* Light veil while another modal sits on top of this one */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 z-30 bg-white/45 transition-opacity duration-200 ${
                  isTop ? "opacity-0" : "opacity-100"
                }`}
              />
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (!portal) return content;
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(content, document.body);
}