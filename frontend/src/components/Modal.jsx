import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import { X } from "lucide-react";

/* =========================================================
   ERANDER MODAL SYSTEM
   Uses the brand tokens: brand-navy, brand-green, brand-mint,
   brand-pale, surface-*, line-*, content-*.
========================================================= */

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  /* "2xl" is used by the review dialogs across the app */
  "2xl": "max-w-3xl",
  xl: "max-w-4xl",
  full: "max-w-none",
};

const HEIGHTS = {
  auto: "",
  sm: "h-[40dvh] sm:h-[42dvh]",
  medium: "h-[60dvh] sm:h-[65dvh]",
  lg: "h-[80dvh] sm:h-[82dvh]",
  full: "h-[calc(100dvh-2.75rem)] sm:h-[calc(100dvh-3rem)]",
  screen: "h-dvh",
};

const POSITIONS = {
  bottom: {
    container:
      "fixed inset-x-0 bottom-4 flex items-end justify-center sm:p-6",
    panel: "rounded-3xl",
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
    enterTransition: {
      type: "spring",
      stiffness: 420,
      damping: 34,
      mass: 0.8,
    },
    exitTransition: {
      duration: 0.24,
      ease: [0.32, 0.72, 0, 1],
    },
  },

  top: {
    container: "fixed inset-x-0 top-5 flex items-start justify-center sm:p-6",
    panel: "rounded-b-3xl rounded-t-none sm:rounded-3xl",
    initial: { y: "-100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "-100%", opacity: 0 },
    enterTransition: {
      type: "spring",
      stiffness: 420,
      damping: 34,
      mass: 0.8,
    },
    exitTransition: {
      duration: 0.24,
      ease: [0.32, 0.72, 0, 1],
    },
  },

  left: {
    container:
      "fixed inset-y-0 left-0 flex items-center justify-start p-3 sm:p-6",
    panel: "h-full max-h-[min(100dvh,760px)] rounded-3xl",
    initial: { x: "-100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "-100%", opacity: 0 },
    enterTransition: {
      type: "spring",
      stiffness: 400,
      damping: 34,
      mass: 0.85,
    },
    exitTransition: {
      duration: 0.25,
      ease: [0.32, 0.72, 0, 1],
    },
  },

  right: {
    container:
      "fixed inset-y-0 right-0 flex items-center justify-end p-3 sm:p-6",
    panel: "h-full max-h-[min(100dvh,760px)] rounded-3xl",
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "100%", opacity: 0 },
    enterTransition: {
      type: "spring",
      stiffness: 400,
      damping: 34,
      mass: 0.85,
    },
    exitTransition: {
      duration: 0.25,
      ease: [0.32, 0.72, 0, 1],
    },
  },

  center: {
    container: "fixed inset-0 flex items-center justify-center p-3 sm:p-6",
    panel: "rounded-3xl",
    initial: { scale: 0.96, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.97, opacity: 0 },
    enterTransition: {
      type: "spring",
      stiffness: 420,
      damping: 32,
      mass: 0.8,
    },
    exitTransition: {
      duration: 0.2,
      ease: [0.32, 0.72, 0, 1],
    },
  },
};

const BACKDROP_TRANSITION = {
  duration: 0.22,
  ease: [0.32, 0.72, 0, 1],
};

const FOCUSABLE_SELECTOR = `
  a[href],
  area[href],
  button:not([disabled]),
  input:not([disabled]),
  select:not([disabled]),
  textarea:not([disabled]),
  iframe,
  object,
  embed,
  [contenteditable="true"],
  [tabindex]:not([tabindex="-1"])
`;

/* =========================================================
   MODAL
========================================================= */

const Modal = ({
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

  showCloseButton = true,
  showHandle = true,

  closeOnOutsideClick = true,
  /* Alias for closeOnOutsideClick. If both are given, this one wins. */
  closeOnOverlayClick,
  closeOnEscape = true,
  closeOnDrag = true,

  /* "navy" matches the page heroes. "light" gives a plain white header. */
  headerTone = "navy",

  initialFocusRef,

  className = "",
  zIndex = 50,

  portal = true,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();

  const panelRef = useRef(null);
  const previousActiveElement = useRef(null);

  const scrollPositionRef = useRef(0);
  const wasOpenRef = useRef(false);
  const isClosingRef = useRef(false);

  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);

  const titleId = useId();
  const descriptionId = useId();
  const dialogId = useId();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const config = POSITIONS[position] || POSITIONS.bottom;
  const modalSize = SIZES[size] || SIZES.md;
  const modalHeight = HEIGHTS[height] ?? HEIGHTS.auto;

  const allowOutsideClose = closeOnOverlayClick ?? closeOnOutsideClick;

  const darkHeader = headerTone !== "light";

  /* =======================================================
     KEEP CALLBACKS CURRENT
  ======================================================= */

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    initialFocusRefRef.current = initialFocusRef;
  }, [initialFocusRef]);

  const handleClose = useCallback(() => {
    onCloseRef.current?.();
  }, []);

  /* =======================================================
     SCROLL LOCK, KEYBOARD & FOCUS MANAGEMENT
  ======================================================= */

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return undefined;
    }

    if (wasOpenRef.current) {
      return undefined;
    }

    wasOpenRef.current = true;
    isClosingRef.current = false;

    const body = document.body;
    const html = document.documentElement;

    const scrollY = window.scrollY;

    scrollPositionRef.current = scrollY;
    previousActiveElement.current = document.activeElement;

    const previousBodyOverflow = body.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const previousHtmlOverscrollBehavior = html.style.overscrollBehavior;

    
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();

        handleClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter(
        (element) =>
          element instanceof HTMLElement && element.offsetParent !== null
      );

      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panelRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;

      if (!panel) return;

      const requestedFocus = initialFocusRefRef.current?.current;

      if (requestedFocus && typeof requestedFocus.focus === "function") {
        requestedFocus.focus({ preventScroll: true });
        return;
      }

      const active = document.activeElement;

      const activeIsInside = active && panel.contains(active);

      const activeIsFormControl =
        active instanceof HTMLElement &&
        active.matches("input, textarea, select, [contenteditable='true']");

      if (!activeIsInside && !activeIsFormControl) {
        panel.focus({ preventScroll: true });
      }
    }, 50);

    return () => {
      window.clearTimeout(focusTimer);

      body.style.overflow = previousBodyOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
      html.style.overscrollBehavior = previousHtmlOverscrollBehavior;

      const savedScrollY = scrollPositionRef.current;

      requestAnimationFrame(() => {
        if (Math.abs(window.scrollY - savedScrollY) > 1) {
          window.scrollTo({
            top: savedScrollY,
            left: 0,
          });
        }
      });

      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeOnEscape, handleClose]);

  /* =======================================================
     RESTORE FOCUS WHEN CLOSED
  ======================================================= */

  const restoreFocus = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;

    const previous = previousActiveElement.current;

    if (
      previous &&
      typeof previous.focus === "function" &&
      document.contains(previous)
    ) {
      requestAnimationFrame(() => {
        try {
          previous.focus({ preventScroll: true });
        } catch {
          previous.focus();
        }
      });
    }

    wasOpenRef.current = false;
  }, []);

  /* =======================================================
     ANIMATION
  ======================================================= */

  const animation = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        enterTransition: { duration: 0.12 },
        exitTransition: { duration: 0.1 },
      };
    }

    return {
      initial: config.initial,
      animate: config.animate,
      exit: config.exit,
      enterTransition: config.enterTransition,
      exitTransition: config.exitTransition,
    };
  }, [config, prefersReducedMotion]);

  /* =======================================================
     DRAG-TO-DISMISS
  ======================================================= */

  const enableDrag =
    position === "bottom" && closeOnDrag && !prefersReducedMotion;

  const handleDragEnd = useCallback(
    (_, info) => {
      if (!enableDrag) return;

      const distance = info.offset.y;
      const velocity = info.velocity.y;

      if (distance > 110 || velocity > 650) {
        handleClose();
      }
    },
    [enableDrag, handleClose]
  );

  /* =======================================================
     ACCESSIBILITY
  ======================================================= */

  const ariaLabelledBy = title ? titleId : undefined;
  const ariaDescribedBy = description ? descriptionId : undefined;
  const dialogLabel = title ? undefined : "ERANDER dialog";

  const hasHeader = Boolean(
    title || subtitle || description || showCloseButton
  );

  /* =======================================================
     RENDER
  ======================================================= */

  const content = (
    <AnimatePresence
      initial={false}
      mode="wait"
      onExitComplete={restoreFocus}
    >
      {isOpen && (
        <motion.div
          key="erander-modal-root"
          className="fixed inset-0"
          style={{ zIndex }}
        >
          {/* BACKDROP */}

          <motion.div
            className="fixed inset-0 bg-brand-navy/60 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BACKDROP_TRANSITION}
            onClick={allowOutsideClose ? handleClose : undefined}
            aria-hidden="true"
          />

          {/* POSITION CONTAINER */}

          <div
            className={`
              ${config.container}
              z-10
              w-full
              min-h-0
              pointer-events-none
            `}
          >
            {/* MODAL PANEL */}

            <motion.div
              ref={panelRef}
              id={dialogId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              aria-label={dialogLabel}
              tabIndex={-1}
              className={`
                ${modalSize}
                ${modalHeight}

                relative
                mx-0.5
                flex
                min-h-0
                w-full
                flex-col
                overflow-hidden
                pointer-events-auto

                border
                border-line
                bg-surface-white
                text-content

                shadow-[0_28px_90px_-20px_rgba(9,20,38,0.45)]

                outline-none

                max-h-[calc(100dvh-2.75rem)]
                sm:mx-0
                sm:max-h-[calc(100dvh-3rem)]

                ${config.panel}
                ${className}
              `}
              initial={animation.initial}
              animate={animation.animate}
              exit={animation.exit}
              transition={
                isOpen
                  ? animation.enterTransition
                  : animation.exitTransition
              }
              onClick={(event) => event.stopPropagation()}
              drag={enableDrag ? "y" : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={enableDrag ? { top: 0, bottom: 0 } : undefined}
              dragElastic={
                enableDrag ? { top: 0, bottom: 0.32 } : undefined
              }
              onDragEnd={handleDragEnd}
            >
              {/* MOBILE SHEET HANDLE */}

              {position === "bottom" && showHandle && (
                <div
                  className={`flex shrink-0 touch-none justify-center pb-1 pt-3 sm:hidden ${
                    darkHeader && hasHeader
                      ? "bg-brand-navy"
                      : "bg-surface-white"
                  }`}
                  onPointerDown={(event) => {
                    if (enableDrag) {
                      dragControls.start(event);
                    }
                  }}
                  aria-hidden="true"
                >
                  <div
                    className={`h-1 w-10 rounded-full ${
                      darkHeader && hasHeader
                        ? "bg-white/30"
                        : "bg-line-strong"
                    }`}
                  />
                </div>
              )}

              {/* HEADER */}

              {hasHeader && (
                <header
                  className={`flex shrink-0 items-start gap-4 px-5 pb-5 pt-4 sm:px-7 sm:pb-6 sm:pt-6 ${
                    darkHeader
                      ? "bg-brand-navy text-content-inverse"
                      : "border-b border-line-soft bg-surface-white"
                  }`}
                >
                  <div className="min-w-0 flex-1 pt-0.5">
                    {subtitle && (
                      <p
                        className={`mb-1 text-sm font-semibold ${
                          darkHeader ? "text-brand-mint" : "text-success"
                        }`}
                      >
                        {subtitle}
                      </p>
                    )}

                    {title && (
                      <h2
                        id={titleId}
                        className={`text-xl font-extrabold leading-7 tracking-tight sm:text-2xl ${
                          darkHeader ? "text-white" : "text-brand-navy"
                        }`}
                      >
                        {title}
                      </h2>
                    )}

                    {description && (
                      <p
                        id={descriptionId}
                        className={`mt-1.5 max-w-2xl text-sm leading-6 ${
                          darkHeader ? "text-white/70" : "text-content-muted"
                        }`}
                      >
                        {description}
                      </p>
                    )}
                  </div>

                  {showCloseButton && (
                    <motion.button
                      type="button"
                      aria-label="Close dialog"
                      onClick={handleClose}
                      whileHover={
                        prefersReducedMotion ? undefined : { scale: 1.06 }
                      }
                      whileTap={
                        prefersReducedMotion ? undefined : { scale: 0.92 }
                      }
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        darkHeader
                          ? "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-brand-mint focus-visible:ring-offset-brand-navy"
                          : "bg-surface-muted text-content-muted hover:bg-line hover:text-content focus-visible:ring-brand-navy focus-visible:ring-offset-surface-white"
                      }`}
                    >
                      <X size={18} strokeWidth={2.2} aria-hidden="true" />
                    </motion.button>
                  )}
                </header>
              )}

              {/* CONTENT */}

              <main
                className="
                  min-h-0
                  flex-1
                  touch-pan-y
                  overflow-y-auto
                  overscroll-contain
                  bg-surface-white
                  px-5
                  py-5
                  pb-[max(1.25rem,env(safe-area-inset-bottom))]
                  sm:px-7
                  sm:py-6
                "
              >
                {children}
              </main>

              {/* FOOTER */}

              {footer && (
                <footer
                  className="
                    shrink-0
                    border-t
                    border-line
                    bg-surface
                    px-5
                    py-4
                    pb-[max(1rem,env(safe-area-inset-bottom))]
                    sm:px-7
                  "
                >
                  {footer}
                </footer>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* =======================================================
     PORTAL
  ======================================================= */

  if (!portal) {
    return content;
  }

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
};

export default Modal;
