import React, {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  Check,
  LoaderCircle,
  MoreVertical,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------
// Utilities
// ---------------------------------------------------------

const cn = (...classes) => classes.flat(Infinity).filter(Boolean).join(" ");

const VIEWPORT_PADDING = 12;
const MENU_GAP = 10;
const POSITION_EPSILON = 1;
const EASE = [0.22, 1, 0.36, 1];

const VALID_PLACEMENTS = ["auto", "top", "bottom", "left", "right", "center"];

const VALID_ALIGNMENTS = [
  "start", "center", "end", "left", "right",
  "top-left", "top-right", "bottom-left", "bottom-right",
];

const VALID_TONES = ["light", "dark"];

// Item state helpers — supports `loading` (canonical) and `busy` (alias).
const isItemLoading = (item) => Boolean(item?.loading || item?.busy);
const isItemDisabled = (item) => Boolean(item?.disabled || isItemLoading(item));

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const getViewportSize = () => ({
  width: window.visualViewport?.width ?? window.innerWidth,
  height: window.visualViewport?.height ?? window.innerHeight,
});

const getViewportOffset = () => ({
  left: window.visualViewport?.offsetLeft ?? 0,
  top: window.visualViewport?.offsetTop ?? 0,
});

// ---------------------------------------------------------
// Alignment normalization
// ---------------------------------------------------------

const normalizeAlign = (align) =>
  VALID_ALIGNMENTS.includes(align) ? align : "bottom-right";

const getOppositePlacement = (placement) => {
  const opposites = { top: "bottom", bottom: "top", left: "right", right: "left" };
  return opposites[placement] ?? placement;
};

const getPlacementOrder = (preferredPlacement) => {
  if (
    preferredPlacement &&
    preferredPlacement !== "auto" &&
    preferredPlacement !== "center"
  ) {
    return [
      preferredPlacement,
      getOppositePlacement(preferredPlacement),
      "bottom", "top", "right", "left",
    ].filter(
      (placement, index, list) =>
        VALID_PLACEMENTS.includes(placement) &&
        placement !== "auto" &&
        list.indexOf(placement) === index
    );
  }
  return ["bottom", "top", "right", "left"];
};

const getAvailableSpace = (placement, rect, viewport) => {
  switch (placement) {
    case "top": return rect.top - viewport.top - VIEWPORT_PADDING;
    case "bottom": return viewport.top + viewport.height - rect.bottom - VIEWPORT_PADDING;
    case "left": return rect.left - viewport.left - VIEWPORT_PADDING;
    case "right": return viewport.left + viewport.width - rect.right - VIEWPORT_PADDING;
    default: return 0;
  }
};

const getMotionOffset = (placement) => {
  switch (placement) {
    case "top": return { x: 0, y: 7 };
    case "left": return { x: 7, y: 0 };
    case "right": return { x: -7, y: 0 };
    case "center": return { x: 0, y: 5 };
    case "bottom":
    default: return { x: 0, y: -7 };
  }
};

// ---------------------------------------------------------
// Corner alignment helpers
// ---------------------------------------------------------

const CORNER_ALIGNMENTS = {
  "top-left": { vertical: "top", horizontal: "left" },
  "top-right": { vertical: "top", horizontal: "right" },
  "bottom-left": { vertical: "bottom", horizontal: "left" },
  "bottom-right": { vertical: "bottom", horizontal: "right" },
};

const getCornerAlignment = (align) => CORNER_ALIGNMENTS[align] ?? null;

// ---------------------------------------------------------
// Positioning
// ---------------------------------------------------------

function calculateMenuPosition({
  triggerRect,
  menuRect,
  preferredPlacement,
  align,
}) {
  const viewportSize = getViewportSize();
  const viewportOffset = getViewportOffset();

  const viewport = {
    left: viewportOffset.left,
    top: viewportOffset.top,
    width: viewportSize.width,
    height: viewportSize.height,
  };

  const availableWidth = Math.max(120, viewport.width - VIEWPORT_PADDING * 2);
  const availableHeight = Math.max(120, viewport.height - VIEWPORT_PADDING * 2);

  const menuWidth = Math.min(menuRect.width || 208, availableWidth);
  const menuHeight = Math.min(menuRect.height || 240, availableHeight);

  const cornerAlignment = getCornerAlignment(align);

  if (preferredPlacement === "center") {
    return {
      placement: "center",
      top: clamp(
        triggerRect.top + triggerRect.height / 2 - menuHeight / 2,
        viewport.top + VIEWPORT_PADDING,
        viewport.top + viewport.height - menuHeight - VIEWPORT_PADDING
      ),
      left: clamp(
        triggerRect.left + triggerRect.width / 2 - menuWidth / 2,
        viewport.left + VIEWPORT_PADDING,
        viewport.left + viewport.width - menuWidth - VIEWPORT_PADDING
      ),
      maxHeight: availableHeight,
      maxWidth: availableWidth,
      menuWidth,
    };
  }

  const placements = getPlacementOrder(preferredPlacement);

  const spaceCandidates = placements.map((placement, index) => ({
    placement, index,
    space: getAvailableSpace(placement, triggerRect, viewport),
  }));

  const firstCandidate = spaceCandidates[0];
  const bestCandidate = spaceCandidates.reduce(
    (best, current) => (current.space > best.space ? current : best),
    firstCandidate
  );

  let placement = bestCandidate.placement;

  if (
    firstCandidate.space >= menuHeight + MENU_GAP &&
    ["top", "bottom"].includes(firstCandidate.placement)
  ) {
    placement = firstCandidate.placement;
  } else if (
    firstCandidate.space >= menuWidth + MENU_GAP &&
    ["left", "right"].includes(firstCandidate.placement)
  ) {
    placement = firstCandidate.placement;
  }

  let top = triggerRect.bottom + MENU_GAP;
  let left = triggerRect.left;

  switch (placement) {
    case "top": top = triggerRect.top - menuHeight - MENU_GAP; break;
    case "left":
      top = triggerRect.top + triggerRect.height / 2 - menuHeight / 2;
      left = triggerRect.left - menuWidth - MENU_GAP;
      break;
    case "right":
      top = triggerRect.top + triggerRect.height / 2 - menuHeight / 2;
      left = triggerRect.right + MENU_GAP;
      break;
    case "bottom":
    default: top = triggerRect.bottom + MENU_GAP; break;
  }

  if (cornerAlignment) {
    top =
      cornerAlignment.vertical === "top"
        ? triggerRect.top
        : triggerRect.bottom - menuHeight;
    left =
      cornerAlignment.horizontal === "left"
        ? triggerRect.left
        : triggerRect.right - menuWidth;
  } else {
    if (placement === "top" || placement === "bottom") {
      switch (align) {
        case "start":
        case "left": left = triggerRect.left; break;
        case "center": left = triggerRect.left + triggerRect.width / 2 - menuWidth / 2; break;
        case "end":
        case "right":
        default: left = triggerRect.right - menuWidth; break;
      }
    }
    if (placement === "left" || placement === "right") {
      switch (align) {
        case "start": top = triggerRect.top; break;
        case "end": top = triggerRect.bottom - menuHeight; break;
        case "center":
        case "left":
        case "right":
        default: top = triggerRect.top + triggerRect.height / 2 - menuHeight / 2; break;
      }
    }
  }

  top = clamp(
    top,
    viewport.top + VIEWPORT_PADDING,
    viewport.top + viewport.height - menuHeight - VIEWPORT_PADDING
  );
  left = clamp(
    left,
    viewport.left + VIEWPORT_PADDING,
    viewport.left + viewport.width - menuWidth - VIEWPORT_PADDING
  );

  return {
    placement, top, left,
    maxHeight: availableHeight,
    maxWidth: availableWidth,
    menuWidth,
  };
}

// ---------------------------------------------------------
// ActionMenu
// ---------------------------------------------------------

/**
 * ActionMenu
 *
 * Controlled mode (optional):
 *   <ActionMenu open={bool} onOpenChange={setBool} … />
 * When `open` is provided, the parent owns the state and `onOpenChange`
 * is called whenever the menu wants to open/close (trigger click, item
 * select, Escape, outside click). The parent must update `open` in
 * response. When `open` is omitted, the menu is uncontrolled and manages
 * its own state internally.
 *
 * Item shape:
 *   { label, icon, onClick, to, danger, disabled,
 *     loading | busy,        // spinner; keeps item focusable (no native disable)
 *     closeOnSelect,         // per-item override of the menu-level closeOnSelect
 *     checked, description, hidden, divider, className, id, key }
 */
export default function ActionMenu({
  items = [],
  placement = "auto",
  align = "bottom-right",
  triggerIcon: TriggerIcon = MoreVertical,
  triggerSize = 18,
  triggerLabel,
  trigger = null,
  tone = "light",
  buttonClassName = "",
  menuClassName = "",
  ariaLabel = "Open actions",
  direction,
  disabled = false,
  hidden = false,
  menuWidth = 208,
  closeOnSelect = true,
  open: openProp,          // ← controlled (optional)
  onOpenChange,
}) {
  const generatedId = useId();
  const menuId = `action-menu-${generatedId.replace(/:/g, "")}`;

  const shouldReduceMotion = useReducedMotion();

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const firstOpenRef = useRef(false);
  const animationFrameRef = useRef(null);

  // ── Controlled / uncontrolled open state ─────────────────
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;

  const [position, setPosition] = useState(null);
  const [positionReady, setPositionReady] = useState(false);

  const normalizedAlign = normalizeAlign(align);
  const requestedPlacement = direction ?? placement;
  const normalizedTone = VALID_TONES.includes(tone) ? tone : "light";

  const safePlacement = VALID_PLACEMENTS.includes(requestedPlacement)
    ? requestedPlacement
    : "auto";

  /**
   * Filter hidden / falsy items, then clean up orphan dividers so we never
   * render a leading, trailing, or consecutive separator when hidden items
   * disappear from the list.
   */
  const normalizedItems = useMemo(() => {
    const visible = items.filter((item) => item && !item.hidden);
    const cleaned = [];
    for (const item of visible) {
      if (item.divider) {
        if (!cleaned.length) continue;
        if (cleaned[cleaned.length - 1].divider) continue;
        cleaned.push(item);
      } else {
        cleaned.push(item);
      }
    }
    while (cleaned.length && cleaned[cleaned.length - 1].divider) {
      cleaned.pop();
    }
    return cleaned;
  }, [items]);

  const navigableItems = useMemo(
    () =>
      normalizedItems.filter(
        (item) => !item.divider && !isItemDisabled(item)
      ),
    [normalizedItems]
  );

  // A loading item still counts as "actionable" so the menu doesn't
  // auto-close while work is in flight.
  const hasActionableItems = useMemo(
    () =>
      normalizedItems.some(
        (item) => !item.divider && (isItemLoading(item) || !isItemDisabled(item))
      ),
    [normalizedItems]
  );

  // ── Open state bridge ──────────────────────────────────────
  // In uncontrolled mode we set internal state directly.
  // In controlled mode we only notify; the parent updates `open`.
  const setMenuOpen = useCallback(
    (nextOpen) => {
      if (!isControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
      if (!nextOpen) {
        setPositionReady(false);
        setPosition(null);
      }
    },
    [isControlled, onOpenChange]
  );

  useEffect(() => {
    if (open && (hidden || disabled || !hasActionableItems)) {
      setMenuOpen(false);
    }
  }, [open, hidden, disabled, hasActionableItems, setMenuOpen]);

  // -------------------------------------------------------
  // Position updates
  // -------------------------------------------------------

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    const nextPosition = calculateMenuPosition({
      triggerRect,
      menuRect,
      preferredPlacement: safePlacement,
      align: normalizedAlign,
    });

    setPosition((current) => {
      if (
        current &&
        current.placement === nextPosition.placement &&
        Math.abs(current.top - nextPosition.top) < POSITION_EPSILON &&
        Math.abs(current.left - nextPosition.left) < POSITION_EPSILON &&
        current.maxHeight === nextPosition.maxHeight &&
        current.maxWidth === nextPosition.maxWidth &&
        current.menuWidth === nextPosition.menuWidth
      ) {
        return current;
      }
      return nextPosition;
    });

    setPositionReady(true);
  }, [safePlacement, normalizedAlign]);

  const schedulePositionUpdate = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    updatePosition();

    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return undefined;

    window.addEventListener("scroll", schedulePositionUpdate, true);
    window.addEventListener("resize", schedulePositionUpdate);
    window.visualViewport?.addEventListener("resize", schedulePositionUpdate);
    window.visualViewport?.addEventListener("scroll", schedulePositionUpdate);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedulePositionUpdate)
        : null;

    resizeObserver?.observe(trigger);
    resizeObserver?.observe(menu);

    let previousRect = null;
    let trackingFrame = null;
    let cancelled = false;

    const trackTrigger = () => {
      if (cancelled || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const nextRect = {
        top: rect.top, left: rect.left,
        width: rect.width, height: rect.height,
      };
      const moved =
        !previousRect ||
        Math.abs(previousRect.top - nextRect.top) > 0.5 ||
        Math.abs(previousRect.left - nextRect.left) > 0.5 ||
        Math.abs(previousRect.width - nextRect.width) > 0.5 ||
        Math.abs(previousRect.height - nextRect.height) > 0.5;
      if (moved) {
        previousRect = nextRect;
        schedulePositionUpdate();
      }
      trackingFrame = requestAnimationFrame(trackTrigger);
    };

    trackingFrame = requestAnimationFrame(trackTrigger);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", schedulePositionUpdate, true);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.visualViewport?.removeEventListener("resize", schedulePositionUpdate);
      window.visualViewport?.removeEventListener("scroll", schedulePositionUpdate);
      resizeObserver?.disconnect();
      if (trackingFrame !== null) cancelAnimationFrame(trackingFrame);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [open, schedulePositionUpdate, updatePosition]);

  // -------------------------------------------------------
  // Close on outside click and Escape
  // -------------------------------------------------------

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(false);
        requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
        return;
      }

      if (event.key === "Tab") {
        setMenuOpen(false);
        return;
      }

      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        return;
      }

      const menu = menuRef.current;
      if (!menu) return;

      const elements = Array.from(
        menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')
      ).filter((element) => !element.hasAttribute("data-menu-divider"));

      if (!elements.length) return;

      const activeIndex = elements.indexOf(document.activeElement);
      let nextIndex = activeIndex;

      if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = elements.length - 1;
      } else if (event.key === "ArrowDown") {
        nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % elements.length;
      } else if (event.key === "ArrowUp") {
        nextIndex =
          activeIndex < 0
            ? elements.length - 1
            : (activeIndex - 1 + elements.length) % elements.length;
      }

      event.preventDefault();
      elements[nextIndex]?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setMenuOpen]);

  // -------------------------------------------------------
  // Focus management
  // -------------------------------------------------------

  useEffect(() => {
    if (!open) {
      firstOpenRef.current = false;
      return undefined;
    }
    if (firstOpenRef.current) return undefined;
    firstOpenRef.current = true;

    const focusFirstItem = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const firstItem = menu.querySelector(
        '[role="menuitem"]:not([aria-disabled="true"])'
      );
      firstItem?.focus({ preventScroll: true });
    };

    const frame = requestAnimationFrame(focusFirstItem);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // -------------------------------------------------------
  // Action handling
  // -------------------------------------------------------

  const handleItemSelect = useCallback(
    (item, event) => {
      if (isItemDisabled(item) || item.divider) {
        event?.preventDefault();
        return;
      }

      // Per-item closeOnSelect wins over the component-level default.
      const shouldClose = item.closeOnSelect ?? closeOnSelect;
      if (shouldClose) {
        setMenuOpen(false);
      }

      item.onClick?.(event);
    },
    [closeOnSelect, setMenuOpen]
  );

  // -------------------------------------------------------
  // Animation variants
  // -------------------------------------------------------

  const motionOffset = getMotionOffset(position?.placement ?? safePlacement);

  const menuVariants = {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.97,
      x: shouldReduceMotion ? 0 : motionOffset.x,
      y: shouldReduceMotion ? 0 : motionOffset.y,
    },
    visible: {
      opacity: 1, scale: 1, x: 0, y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.16,
        ease: EASE,
      },
    },
    exit: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.98,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.11,
        ease: "easeOut",
      },
    },
  };

  // -------------------------------------------------------
  // Menu item rendering
  // -------------------------------------------------------

  const renderMenuItem = (item, index) => {
    if (item.divider) {
      return (
        <div
          key={item.id ?? `divider-${index}`}
          data-menu-divider=""
          role="separator"
          className={cn("mx-2 my-1.5 border-t border-line-soft", item.className)}
        />
      );
    }

    const Icon = item.icon;
    const isLoading = isItemLoading(item);
    const isDanger = Boolean(item.danger);
    const isDisabled = isItemDisabled(item);
    const isLink = Boolean(item.to && !isDisabled);

    const itemClassName = cn(
      "group relative flex w-full items-start gap-3",
      "rounded-xl px-3 py-2.5 text-left",
      "text-sm font-semibold leading-5",
      "outline-none select-none",
      "transition-[background-color,color,transform] duration-150 ease-out",
      "focus-visible:ring-2 focus-visible:ring-inset",
      isDanger
        ? ["text-rose-700", "hover:bg-rose-50", "focus-visible:bg-rose-50 focus-visible:ring-rose-300"]
        : ["text-content", "hover:bg-surface", "focus-visible:bg-brand-pale focus-visible:ring-brand-navy"],
      !isDisabled && "active:scale-[0.99]",
      isDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      item.className
    );

    const iconClassName = cn(
      "mt-0.5 shrink-0 transition-colors duration-150",
      isDanger
        ? "text-rose-600"
        : "text-content-subtle group-hover:text-brand-navy group-focus-visible:text-brand-navy"
    );

    const content = (
      <>
        {(isLoading || Icon) && (
          <span className={iconClassName} aria-hidden="true">
            {isLoading ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Icon size={18} strokeWidth={1.9} />
            )}
          </span>
        )}

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate" aria-live="polite" aria-atomic="true">
            {item.label}
          </span>

          {item.description && (
            <span
              className={cn(
                "mt-0.5 line-clamp-2 text-xs font-normal leading-5",
                isDanger ? "text-rose-600/80" : "text-content-muted"
              )}
            >
              {item.description}
            </span>
          )}
        </span>

        {item.checked && (
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-green text-brand-navy"
            aria-hidden="true"
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}

        {item.external && (
          <ChevronRight
            size={15}
            className="mt-1 shrink-0 text-content-subtle"
            aria-hidden="true"
          />
        )}
      </>
    );

    const commonProps = {
      // Stable, index-based key so a label change doesn't remount the node
      // (which would restart the spinner and drop focus mid-action).
      key: item.id ?? item.key ?? `item-${index}`,
      className: itemClassName,
      role: "menuitem",
      tabIndex: isDisabled ? -1 : 0,
      "aria-disabled": isDisabled ? "true" : undefined,
      "aria-busy": isLoading ? "true" : undefined,
      onClick: (event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        handleItemSelect(item, event);
      },
      onKeyDown: (event) => {
        if (isDisabled && ["Enter", " "].includes(event.key)) {
          event.preventDefault();
        }
        item.onKeyDown?.(event);
      },
    };

    if (isLink) {
      return (
        <Link
          {...commonProps}
          to={item.to}
          target={item.target}
          rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        {...commonProps}
        type="button"
        // Loading items stay focusable; only true disables use native disabled.
        disabled={Boolean(item.disabled) && !isLoading}
      >
        {content}
      </button>
    );
  };

  // -------------------------------------------------------
  // Trigger
  // -------------------------------------------------------

  const toneClasses =
    normalizedTone === "dark"
      ? open
        ? "border-white bg-white text-brand-navy"
        : "border-transparent bg-white/10 text-white hover:bg-white/20 focus-visible:ring-brand-mint focus-visible:ring-offset-brand-navy"
      : open
        ? "border-brand-navy bg-brand-navy text-content-inverse"
        : "border-line bg-surface-white text-content-muted hover:border-line-strong hover:bg-surface hover:text-brand-navy focus-visible:ring-brand-navy focus-visible:ring-offset-surface-white";

  const triggerClasses = cn(
    "relative inline-flex shrink-0 items-center justify-center",
    triggerLabel ? "gap-2 rounded-2xl px-4" : "rounded-xl",
    "border transition-[background-color,border-color,color,transform] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.96]",
    toneClasses,
    buttonClassName
  );

  const defaultTrigger = (
    <button
      ref={triggerRef}
      type="button"
      className={triggerClasses}
      style={{ minWidth: 40, minHeight: 40 }}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      title={ariaLabel}
      onClick={() => {
        if (disabled) return;
        setMenuOpen(!open);
      }}
    >
      <TriggerIcon
        size={triggerSize}
        strokeWidth={1.9}
        className={cn("transition-transform duration-200", open && "rotate-90")}
        aria-hidden="true"
      />

      {triggerLabel && <span className="text-sm font-semibold">{triggerLabel}</span>}

      <span className="sr-only">
        {open ? "Close actions menu" : ariaLabel}
      </span>
    </button>
  );

  const customTrigger =
    trigger && React.isValidElement(trigger)
      ? cloneElement(trigger, {
          ref: triggerRef,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": open ? menuId : undefined,
          "aria-label": trigger.props?.["aria-label"] ?? ariaLabel,
          onClick: (event) => {
            trigger.props?.onClick?.(event);
            if (event.defaultPrevented) return;
            if (disabled) return;
            setMenuOpen(!open);
          },
        })
      : null;

  // -------------------------------------------------------
  // Menu
  // -------------------------------------------------------

  const menu = (
    <AnimatePresence
      onExitComplete={() => {
        setPosition(null);
        setPositionReady(false);
      }}
    >
      {open && (
        <motion.div
          key="action-menu"
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Available actions"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={menuVariants}
          style={{
            position: "fixed",
            top: position?.top ?? -10000,
            left: position?.left ?? -10000,
            width: position?.menuWidth ?? menuWidth,
            maxWidth: position?.maxWidth ?? "calc(100vw - 24px)",
            maxHeight: position?.maxHeight ?? "calc(100vh - 24px)",
            visibility: positionReady ? "visible" : "hidden",
            zIndex: 9999,
            transformOrigin: "center center",
          }}
          className={cn(
            "overflow-y-auto overscroll-contain",
            "rounded-2xl border border-line bg-surface-white p-2",
            "shadow-[0_22px_60px_-18px_rgba(9,20,38,0.35)]",
            "[scrollbar-width:thin]",
            menuClassName
          )}
        >
          {normalizedItems.length > 0 ? (
            normalizedItems.map(renderMenuItem)
          ) : (
            <div className="px-3 py-6 text-center">
              <p className="text-sm font-medium text-content-muted">
                No actions available
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (hidden) return null;

  return (
    <>
      {customTrigger ?? defaultTrigger}
      {typeof document !== "undefined" && createPortal(menu, document.body)}
    </>
  );
}