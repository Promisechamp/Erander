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
  Check,
  ChevronDown,
  Search,
  X,
  Loader2,
} from "lucide-react";


import Modal from "./Modal";

const cn = (...classes) => classes.filter(Boolean).join(" ");

/* =========================================================
   ERANDER SELECT
   Brand palette:
   Navy       #14213D
   Green      #20CC88
   Mint       #35D07F
   Pale Mint  #E9FBF3
   White      #FFFFFF
   Off-white  #F8FAFC
   Slate      #64748B
========================================================= */

/* --------------------------------------------------
   Option accessors
-------------------------------------------------- */

const getRawValue = (option, valueKey) => {
  if (option == null) return "";
  if (typeof option !== "object") return option;

  return (
    option[valueKey] ??
    option.value ??
    option.id ??
    option.label ??
    ""
  );
};

const getLabel = (option, labelKey) => {
  if (option == null) return "";
  if (typeof option !== "object") return String(option);

  return String(
    option[labelKey] ??
      option.label ??
      option.name ??
      option.title ??
      option.value ??
      ""
  );
};

const getDescription = (option, descriptionKey) => {
  if (!option || typeof option !== "object") return "";

  return String(
    option[descriptionKey] ??
      option.description ??
      option.subtitle ??
      ""
  );
};

/* --------------------------------------------------
   Component
-------------------------------------------------- */

function Select({
  options = [],
  value,
  defaultValue,
  onChange,

  label,
  description,
  placeholder = "Choose an option",
  searchPlaceholder = "Search options",
  emptyMessage = "No matching options",

  error,
  hint,

  disabled = false,
  loading = false,
  required = false,

  multiple = false,
  searchable = true,
  clearable = true,
  closeOnSelect = !multiple,

  labelKey = "label",
  valueKey = "value",
  descriptionKey = "description",

  name,
  id,
  className = "",

  maxHeight = 320,
  maxDisplayed = 2,
  showIcon = true,
  mobileBreakpoint = 768,

  autoFocusSearch = false,
  onSearch,
  onOpen,
  onClose,

  renderOption,
  renderValue,
}) {
  const uid = useId();
  const selectId = id || `select-${uid}`;
  const listId = `${selectId}-listbox`;
  const optionId = (index) => `${selectId}-option-${index}`;

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);

  const onSearchRef = useRef(onSearch);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSearchRef.current = onSearch;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  }, [onSearch, onOpen, onClose]);

  const controlled = value !== undefined;

  const [internalValue, setInternalValue] = useState(
    defaultValue ?? (multiple ? [] : "")
  );

  const currentValue = controlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  /* --------------------------------------------------
     Mobile detection
  -------------------------------------------------- */

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    check();

    window.addEventListener("resize", check);

    return () => {
      window.removeEventListener("resize", check);
    };
  }, [mobileBreakpoint]);

  /* --------------------------------------------------
     Normalised options
  -------------------------------------------------- */

  const items = useMemo(() => {
    return (Array.isArray(options) ? options : [])
      .filter((option) => option != null)
      .map((original) => {
        const raw = getRawValue(original, valueKey);

        return {
          original,
          raw,
          value: String(raw),
          label: getLabel(original, labelKey),
          description: getDescription(original, descriptionKey),
          icon:
            original && typeof original === "object"
              ? original.icon
              : undefined,
          color:
            original && typeof original === "object"
              ? original.color
              : undefined,
          disabled: Boolean(
            original &&
              typeof original === "object" &&
              original.disabled
          ),
        };
      });
  }, [options, valueKey, labelKey, descriptionKey]);

  /* --------------------------------------------------
     Selected values
  -------------------------------------------------- */

  const selectedValues = useMemo(() => {
    if (multiple) {
      const values = Array.isArray(currentValue)
        ? currentValue
        : currentValue == null || currentValue === ""
          ? []
          : [currentValue];

      return values.map((item) =>
        typeof item === "object"
          ? String(getRawValue(item, valueKey))
          : String(item)
      );
    }

    if (currentValue == null || currentValue === "") {
      return [];
    }

    if (typeof currentValue === "object") {
      return [String(getRawValue(currentValue, valueKey))];
    }

    return [String(currentValue)];
  }, [currentValue, multiple, valueKey]);

  const selectedSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues]
  );

  const selectedItems = useMemo(
    () =>
      selectedValues
        .map((selected) =>
          items.find((item) => item.value === selected)
        )
        .filter(Boolean),
    [selectedValues, items]
  );

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return items;

    return items.filter((item) =>
      `${item.label} ${item.description} ${item.value}`
        .toLowerCase()
        .includes(term)
    );
  }, [items, query]);

  const toRaw = useCallback(
    (str) => items.find((item) => item.value === str)?.raw ?? str,
    [items]
  );

  const setValue = useCallback(
    (nextValue, meta = {}) => {
      if (!controlled) {
        setInternalValue(nextValue);
      }

      onChange?.(nextValue, meta);
    },
    [controlled, onChange]
  );

  /* --------------------------------------------------
     Open and close
  -------------------------------------------------- */

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    setPosition(null);

    onCloseRef.current?.();

    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  const show = useCallback(() => {
    if (disabled || loading) return;

    setOpen(true);
    setQuery("");
    setActiveIndex(-1);

    onOpenRef.current?.();
  }, [disabled, loading]);

  /* --------------------------------------------------
     Desktop positioning
  -------------------------------------------------- */

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger || !open || isMobile) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.min(
      Math.max(rect.width, 250),
      viewportWidth - 24
    );

    const left = Math.max(
      12,
      Math.min(rect.left, viewportWidth - width - 12)
    );

    const below = viewportHeight - rect.bottom - 12;
    const above = rect.top - 12;

    const openAbove = below < 220 && above > below;
    const available = Math.max(
      120,
      openAbove ? above : below
    );

    setPosition({
      left,
      width,
      maxHeight: Math.min(maxHeight, available),
      openAbove,
      anchor: openAbove ? rect.top - 6 : rect.bottom + 6,
    });
  }, [open, isMobile, maxHeight]);

  useEffect(() => {
    if (!open || isMobile) return;

    updatePosition();

    const handleOutside = (event) => {
      if (
        rootRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }

      close();
    };

    document.addEventListener("pointerdown", handleOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, isMobile, updatePosition, close]);

  useEffect(() => {
    if (open) {
      close();
    }
    // Close the menu when switching between desktop and mobile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  /* --------------------------------------------------
     Focus management
  -------------------------------------------------- */

  useEffect(() => {
    if (!open) return undefined;

    const frame = requestAnimationFrame(() => {
      if (autoFocusSearch && searchable) {
        searchRef.current?.focus();
      } else if (!isMobile) {
        triggerRef.current?.focus();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [open, isMobile, autoFocusSearch, searchable]);

  useEffect(() => {
    if (activeIndex < 0) return;

    optionRefs.current[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex]);

  /* --------------------------------------------------
     Selection
  -------------------------------------------------- */

  const selectItem = useCallback(
    (item) => {
      if (!item || item.disabled) return;

      const isSelected = selectedSet.has(item.value);

      if (multiple) {
        const nextStrings = isSelected
          ? selectedValues.filter((itemValue) => itemValue !== item.value)
          : [...selectedValues, item.value];

        setValue(nextStrings.map(toRaw), {
          option: item.original,
          selected: !isSelected,
        });

        if (closeOnSelect) {
          close(true);
        }

        return;
      }

      setValue(item.raw, {
        option: item.original,
        selected: true,
      });

      close(true);
    },
    [
      multiple,
      selectedSet,
      selectedValues,
      setValue,
      toRaw,
      closeOnSelect,
      close,
    ]
  );

  const clear = useCallback(
    (event) => {
      event?.stopPropagation();

      setValue(multiple ? [] : "", {
        cleared: true,
      });
    },
    [multiple, setValue]
  );

  const removeItem = useCallback(
    (event, item) => {
      event.stopPropagation();

      if (disabled) return;

      setValue(
        selectedValues
          .filter((selected) => selected !== item.value)
          .map(toRaw),
        {
          removed: item.original,
        }
      );
    },
    [disabled, selectedValues, setValue, toRaw]
  );

  /* --------------------------------------------------
     Keyboard navigation
  -------------------------------------------------- */

  const moveActive = useCallback(
    (direction) => {
      const enabled = filteredItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.disabled);

      if (!enabled.length) {
        setActiveIndex(-1);
        return;
      }

      const current = enabled.findIndex(
        ({ index }) => index === activeIndex
      );

      const next =
        current === -1
          ? direction > 0
            ? 0
            : enabled.length - 1
          : (current + direction + enabled.length) % enabled.length;

      setActiveIndex(enabled[next].index);
    },
    [filteredItems, activeIndex]
  );

  const jumpActive = useCallback(
    (toEnd) => {
      const enabled = filteredItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.disabled);

      if (!enabled.length) return;

      setActiveIndex(
        toEnd
          ? enabled[enabled.length - 1].index
          : enabled[0].index
      );
    },
    [filteredItems]
  );

  const handleTriggerKeyDown = (event) => {
    if (disabled || loading) return;

    switch (event.key) {
      case "Enter":
      case " ": {
        event.preventDefault();

        if (!open) {
          show();
        } else if (activeIndex >= 0) {
          selectItem(filteredItems[activeIndex]);
        }

        break;
      }

      case "ArrowDown": {
        event.preventDefault();

        if (!open) {
          show();
        } else {
          moveActive(1);
        }

        break;
      }

      case "ArrowUp": {
        event.preventDefault();

        if (!open) {
          show();
        } else {
          moveActive(-1);
        }

        break;
      }

      case "Home": {
        if (!open) return;

        event.preventDefault();
        jumpActive(false);
        break;
      }

      case "End": {
        if (!open) return;

        event.preventDefault();
        jumpActive(true);
        break;
      }

      case "Escape": {
        if (!open) return;

        event.preventDefault();
        close(true);
        break;
      }

      case "Backspace": {
        if (multiple && !open && selectedValues.length) {
          setValue(selectedValues.slice(0, -1).map(toRaw));
        }

        break;
      }

      default:
        break;
    }
  };

  const handleSearchKeyDown = (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;

      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;

      case "Home":
        event.preventDefault();
        jumpActive(false);
        break;

      case "End":
        event.preventDefault();
        jumpActive(true);
        break;

      case "Enter":
        event.preventDefault();

        if (activeIndex >= 0) {
          selectItem(filteredItems[activeIndex]);
        }

        break;

      case "Escape":
        event.preventDefault();
        close(true);
        break;

      default:
        break;
    }
  };

  /* --------------------------------------------------
     Display value
  -------------------------------------------------- */

  const displayValue = renderValue
    ? renderValue(
        multiple
          ? selectedItems.map((item) => item.original)
          : selectedItems[0]?.original
      )
    : multiple
      ? null
      : selectedItems[0]?.label;

  const singleSelected = !multiple ? selectedItems[0] : null;

  /* --------------------------------------------------
     Option row
  -------------------------------------------------- */

  const renderRow = (item, index) => {
    const selected = selectedSet.has(item.value);
    const active = activeIndex === index;
    const hasIcon = showIcon && item.icon;

    return (
      <button
        key={`${item.value}-${index}`}
        id={optionId(index)}
        ref={(element) => {
          optionRefs.current[index] = element;
        }}
        type="button"
        role="option"
        tabIndex={-1}
        aria-selected={selected}
        aria-disabled={item.disabled || undefined}
        disabled={item.disabled}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectItem(item)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 text-left",
          "transition-colors duration-150",
          isMobile ? "min-h-[52px] py-2.5" : "min-h-[46px] py-2",
          selected
            ? active
              ? "bg-brand-pale"
              : "bg-brand-pale/70"
            : active
              ? "bg-surface-muted"
              : "bg-transparent",
          item.disabled && "cursor-not-allowed opacity-40"
        )}
      >
        {multiple && (
          <span
            className={cn(
              "flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-brand-green bg-brand-green text-white"
                : "border-line-strong bg-white"
            )}
            aria-hidden="true"
          >
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
        )}

        {hasIcon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              selected
                ? "bg-white text-brand-navy"
                : "bg-surface-muted text-content-muted"
            )}
          >
            
          </span>
        )}

        <span className="min-w-0 flex-1">
          {renderOption ? (
            renderOption({
              option: item.original,
              selected,
              active,
            })
          ) : (
            <>
              <span
                className={cn(
                  "block truncate text-sm",
                  selected
                    ? "font-extrabold text-brand-navy"
                    : "font-bold text-content"
                )}
              >
                {item.label}
              </span>

              {item.description && (
                <span className="mt-0.5 block truncate text-xs font-medium leading-5 text-content-muted">
                  {item.description}
                </span>
              )}
            </>
          )}
        </span>

        {!multiple && selected && (
          <Check
            size={17}
            strokeWidth={2.5}
            className="shrink-0 text-success"
            aria-hidden="true"
          />
        )}
      </button>
    );
  };

  /* --------------------------------------------------
     Shared option panel body
  -------------------------------------------------- */

  const renderPanelBody = () => (
    <>
      {searchable && (
        <div className="shrink-0 p-3 pb-2">
          <div
            className="
              flex items-center gap-2.5
              rounded-xl border border-line
              bg-surface px-3
              transition-colors
              focus-within:border-brand-green
              focus-within:ring-2
              focus-within:ring-brand-pale
            "
          >
            <Search
              size={16}
              className="shrink-0 text-content-muted"
              aria-hidden="true"
            />

            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                const next = event.target.value;

                setQuery(next);
                setActiveIndex(-1);
                onSearchRef.current?.(next);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label="Search options"
              aria-controls={listId}
              aria-activedescendant={
                activeIndex >= 0
                  ? optionId(activeIndex)
                  : undefined
              }
              className={cn(
                "min-w-0 flex-1 bg-transparent text-content outline-none",
                "placeholder:font-medium placeholder:text-content-subtle",
                isMobile ? "h-11 text-base" : "h-10 text-sm",
                "font-semibold"
              )}
            />

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveIndex(-1);
                  onSearchRef.current?.("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="
                  flex h-7 w-7 items-center justify-center
                  rounded-lg text-content-muted
                  transition-colors
                  hover:bg-brand-pale hover:text-brand-navy
                  focus-visible:outline-none
                  focus-visible:ring-2 focus-visible:ring-brand-green
                "
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {multiple && selectedValues.length > 0 && (
        <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-2">
          <span className="text-xs font-extrabold text-content-muted">
            {selectedValues.length} selected
          </span>

          <button
            type="button"
            onClick={clear}
            className="
              rounded-md px-1 py-0.5
              text-xs font-extrabold text-success
              transition-colors hover:text-brand-navy
              focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-brand-green
            "
          >
            Clear all
          </button>
        </div>
      )}

      <div
        id={listId}
        role="listbox"
        aria-label={label || placeholder}
        aria-multiselectable={multiple || undefined}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
        style={
          isMobile
            ? undefined
            : {
                maxHeight:
                  (position?.maxHeight ?? maxHeight) -
                  (searchable ? 68 : 0),
              }
        }
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2.5 px-4 py-9 text-sm font-semibold text-content-muted">
            <Loader2
              size={17}
              className="animate-spin text-success"
              aria-hidden="true"
            />
            Loading options…
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-9 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-pale text-brand-navy">
              <Search size={19} />
            </span>

            <p className="text-sm font-extrabold text-brand-navy">
              {emptyMessage}
            </p>

            <p className="mt-1 text-xs font-medium leading-5 text-content-muted">
              {query
                ? "Try a different search term."
                : "There are no options to display."}
            </p>
          </div>
        ) : (
          filteredItems.map(renderRow)
        )}
      </div>
    </>
  );

  /* --------------------------------------------------
     Desktop popover
  -------------------------------------------------- */

  const desktopMenu =
    !isMobile && open && position
      ? createPortal(
          <div
            ref={menuRef}
            className="
              fixed z-[1000]
              flex flex-col overflow-hidden
              rounded-2xl border border-line
              bg-surface-white text-content
              shadow-[0_16px_48px_rgba(20,33,61,0.16)]
              animate-in fade-in-0 zoom-in-[0.98] duration-100
            "
            style={{
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              ...(position.openAbove
                ? {
                    bottom: window.innerHeight - position.anchor,
                    transformOrigin: "bottom center",
                  }
                : {
                    top: position.anchor,
                    transformOrigin: "top center",
                  }),
            }}
          >
            {renderPanelBody()}
          </div>,
          document.body
        )
      : null;

  /* --------------------------------------------------
     Mobile bottom sheet
  -------------------------------------------------- */

  const mobileSheet = isMobile ? (
    <Modal
      isOpen={open}
      onClose={() => close(true)}
      position="bottom"
      size="full"
      closeOnOutsideClick
      showCloseButton={false}
      className="
        !mb-0
        !max-h-[85vh]
        !max-w-[calc(100vw-24px)]
        !overflow-hidden
        !rounded-3xl
        !border-line
        !shadow-[0_24px_80px_rgba(9,20,38,0.22)]
      "
    >
      <div
        ref={menuRef}
        className="flex max-h-[85vh] flex-col bg-surface-white text-content"
      >
        <div className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-brand-navy">
              {label || placeholder}
            </p>

            {description && (
              <p className="mt-0.5 truncate text-xs font-medium text-content-muted">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => close(true)}
            aria-label="Close options"
            className="
              flex h-10 w-10 shrink-0 items-center justify-center
              rounded-xl border border-line
              bg-surface-muted text-content-muted
              transition-colors
              hover:border-brand-green hover:bg-brand-pale
              hover:text-brand-navy
              focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-brand-green
            "
          >
            <X size={17} />
          </button>
        </div>

        {renderPanelBody()}

        {multiple && (
          <div className="shrink-0 border-t border-line bg-surface p-3">
            <button
              type="button"
              onClick={() => close(true)}
              className="
                flex h-12 w-full items-center justify-center gap-2
                rounded-xl bg-brand-green px-4
                text-sm font-extrabold text-brand-navy
                shadow-sm transition-colors
                hover:bg-brand-mint
                active:scale-[0.99]
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-brand-green
                focus-visible:ring-offset-2
              "
            >
              <Check size={17} strokeWidth={2.5} />

              {selectedValues.length > 0
                ? `Done (${selectedValues.length})`
                : "Done"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  ) : null;

  /* --------------------------------------------------
     Trigger
  -------------------------------------------------- */

  return (
    <div
      ref={rootRef}
      className={cn("w-full min-w-0", className)}
    >
      {label && (
        <div className="mb-1.5">
          <label
            htmlFor={selectId}
            className="text-sm font-extrabold text-brand-navy"
          >
            {label}

            {required && (
              <span
                className="ml-1 text-red-600"
                aria-hidden="true"
              >
                *
              </span>
            )}
          </label>

          {description && (
            <p className="mt-0.5 text-xs font-medium leading-5 text-content-muted">
              {description}
            </p>
          )}
        </div>
      )}

      <button
        ref={triggerRef}
        id={selectId}
        name={name}
        type="button"
        disabled={disabled || loading}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && !isMobile && activeIndex >= 0
            ? optionId(activeIndex)
            : undefined
        }
        aria-invalid={Boolean(error)}
        aria-required={required || undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "group flex min-h-[48px] w-full items-center gap-2.5",
          "rounded-full border bg-surface-white pl-3.5 pr-2.5",
          "text-left outline-none transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-offset-1",
          error
            ? "border-red-500 focus-visible:ring-red-200"
            : open
              ? "border-brand-green ring-2 ring-brand-pale"
              : "border-line hover:border-brand-green focus-visible:border-brand-green focus-visible:ring-brand-pale",
          (disabled || loading) && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5">
          {multiple && selectedItems.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {selectedItems.slice(0, maxDisplayed).map((item) => (
                <span
                  key={item.value}
                  className="
                    inline-flex max-w-full items-center gap-1.5
                    rounded-lg border border-brand-green
                    bg-brand-pale py-1 pl-2 pr-1
                    text-xs font-bold text-brand-navy
                  "
                >
                  {showIcon && item.icon && (
                    <span className="shrink-0">

                    </span>
                  )}

                  <span className="max-w-[110px] truncate">
                    {item.label}
                  </span>

                  <button
                    type="button"
                    aria-label={`Remove ${item.label}`}
                    disabled={disabled}
                    onClick={(event) => removeItem(event, item)}
                    className="
                      flex h-5 w-5 shrink-0 items-center justify-center
                      rounded-md text-content-muted
                      transition-colors
                      hover:bg-white hover:text-brand-navy
                      focus-visible:outline-none
                      focus-visible:ring-2 focus-visible:ring-brand-green
                      disabled:cursor-not-allowed
                    "
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              ))}

              {selectedItems.length > maxDisplayed && (
                <span className="rounded-lg bg-surface-muted px-2 py-1 text-xs font-extrabold text-content-muted">
                  +{selectedItems.length - maxDisplayed}
                </span>
              )}
            </span>
          ) : displayValue ? (
            <>
              {showIcon && singleSelected?.icon && !renderValue && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pale text-brand-navy">
                </span>
              )}

              <span className="block min-w-0 flex-1 truncate text-sm font-bold text-content">
                {displayValue}
              </span>
            </>
          ) : (
            <span className="block truncate text-sm font-medium text-content-subtle">
              {placeholder}
            </span>
          )}
        </span>

        {clearable && selectedValues.length > 0 && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clear}
            className="
              flex h-7 w-7 shrink-0 items-center justify-center
              rounded-full text-content-muted
              transition-colors
              hover:bg-brand-pale hover:text-brand-navy
              focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-brand-green
            "
          >
            <X size={14} />
          </button>
        )}

        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center",
            "rounded-lg text-content-muted transition-colors",
            open && "bg-brand-pale text-brand-navy"
          )}
          aria-hidden="true"
        >
          <ChevronDown
            size={17}
            strokeWidth={2}
            className={cn(
              "transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </span>
      </button>

      {(error || hint) && (
        <p
          role={error ? "alert" : undefined}
          className={cn(
            "mt-1.5 text-xs leading-5",
            error
              ? "font-bold text-red-600"
              : "font-medium text-content-muted"
          )}
        >
          {error || hint}
        </p>
      )}

      {desktopMenu}
      {mobileSheet}
    </div>
  );
}

export default Select;