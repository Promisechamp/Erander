import {
  AlignJustify,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LayoutGrid,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";

import { Popover } from "./RecordsUI";
import { INPUT } from "./recordsStyles";
import { MAX_CARD_FIELDS, humanize } from "./recordsUtils";

const CHECKBOX = "h-4 w-4 rounded border-line accent-[#14213d]";

export default function RecordsToolbar({
  title,
  subtitle,
  searchInput,
  onSearchInput,
  searchRef,
  statusOptions,
  status,
  onStatus,
  search,
  hasFilters,
  onClearFilters,
  view,
  onView,
  dense,
  onDense,
  columns,
  hiddenColumns,
  onToggleColumn,
  onShowAllColumns,
  cardFields,
  onToggleCardField,
  onResetCardFields,
  sortKey,
  sortDir,
  onSort,
  onClearSort,
  onResetView,
}) {
  const isCards = view === "cards";
  const statusChips = [{ value: "", label: "All statuses" }].concat(
    statusOptions.map((value) => ({ value, label: humanize(value) }))
  );

  return (
    <div className="space-y-3 border-b border-line-soft p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold tracking-tight text-content">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-content-muted">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block min-w-0 flex-1 sm:flex-none">
            <span className="sr-only">Search records</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle"
            />
            <input
              ref={searchRef}
              value={searchInput}
              onChange={(event) => onSearchInput(event.target.value)}
              placeholder="Search records"
              className={`${INPUT} !h-10 !rounded-full pl-10 pr-12 sm:w-72`}
            />

            {searchInput ? (
              <button
                type="button"
                onClick={() => onSearchInput("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content"
              >
                <X size={15} aria-hidden="true" />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-content-muted sm:block"
              >
                /
              </kbd>
            )}
          </label>

          <Popover
            icon={SlidersHorizontal}
            label={isCards ? "Card fields" : "Columns"}
            badge={
              isCards
                ? `${cardFields.length}/${MAX_CARD_FIELDS}`
                : hiddenColumns.length
                  ? `-${hiddenColumns.length}`
                  : ""
            }
            width="w-72"
          >
            <div className="flex items-center justify-between px-2 pb-1 pt-1">
              <p className="text-xs font-bold text-content">
                {isCards
                  ? `Fields on cards (max ${MAX_CARD_FIELDS})`
                  : "Visible columns"}
              </p>
              <button
                type="button"
                onClick={isCards ? onResetCardFields : onShowAllColumns}
                className="text-xs font-bold text-brand underline underline-offset-2"
              >
                {isCards ? "Reset" : "Show all"}
              </button>
            </div>

            <ul className="max-h-72 overflow-y-auto">
              {columns.map((column) => {
                const checked = isCards
                  ? cardFields.includes(column)
                  : !hiddenColumns.includes(column);
                const locked =
                  isCards && !checked && cardFields.length >= MAX_CARD_FIELDS;

                return (
                  <li key={column}>
                    <label
                      className={`flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition ${
                        locked
                          ? "cursor-not-allowed text-content-subtle"
                          : "cursor-pointer text-content hover:bg-surface-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() =>
                          isCards
                            ? onToggleCardField(column)
                            : onToggleColumn(column)
                        }
                        className={CHECKBOX}
                      />
                      {humanize(column)}
                    </label>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={onResetView}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-t border-line-soft px-2 pb-1.5 pt-2.5 text-xs font-bold text-content-muted transition hover:text-content"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Reset view settings
            </button>
          </Popover>

          {isCards ? (
            <Popover
              icon={ArrowUpDown}
              label="Sort"
              badge={sortKey ? "1" : ""}
              width="w-64"
            >
              <div className="flex items-center justify-between px-2 pb-1 pt-1">
                <p className="text-xs font-bold text-content">Sort this page by</p>
                {sortKey ? (
                  <button
                    type="button"
                    onClick={onClearSort}
                    className="text-xs font-bold text-brand underline underline-offset-2"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <ul className="max-h-72 overflow-y-auto">
                {columns.map((column) => {
                  const active = sortKey === column;
                  const Icon = !active
                    ? null
                    : sortDir === "asc"
                      ? ArrowUp
                      : ArrowDown;

                  return (
                    <li key={column}>
                      <button
                        type="button"
                        onClick={() => onSort(column)}
                        className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm transition hover:bg-surface-muted ${
                          active ? "font-bold text-brand" : "text-content"
                        }`}
                      >
                        {humanize(column)}
                        {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Popover>
          ) : (
            <button
              type="button"
              onClick={() => onDense(!dense)}
              aria-pressed={dense}
              title="Compact rows"
              className={`hidden h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex ${
                dense
                  ? "border-brand bg-brand text-content-inverse"
                  : "border-line bg-surface-white text-content-muted hover:bg-surface-muted"
              }`}
            >
              <AlignJustify size={16} aria-hidden="true" />
              <span className="sr-only">Compact rows</span>
            </button>
          )}

          <div
            role="group"
            aria-label="Choose layout"
            className="inline-flex rounded-full bg-surface-muted p-1"
          >
            {[
              { value: "table", icon: Table2, label: "Table" },
              { value: "cards", icon: LayoutGrid, label: "Cards" },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onView(value)}
                aria-pressed={view === value}
                className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  view === value
                    ? "bg-surface-white text-content shadow-sm"
                    : "text-content-muted hover:text-content"
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {statusOptions.length > 0 ? (
        <div
          role="group"
          aria-label="Filter by status"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {statusChips.map((option) => {
            const active = option.value === status;

            return (
              <button
                key={option.value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => onStatus(option.value)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active
                    ? "bg-brand text-content-inverse"
                    : "bg-surface-muted text-content-muted hover:text-content"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-content-muted">Filters:</span>

          {search ? (
            <span className="max-w-full truncate rounded-full bg-brand-pale px-2.5 py-1 font-bold text-brand">
              “{search}”
            </span>
          ) : null}

          {status ? (
            <span className="rounded-full bg-brand-pale px-2.5 py-1 font-bold text-brand">
              {humanize(status)}
            </span>
          ) : null}

          <button
            type="button"
            onClick={onClearFilters}
            className="font-bold text-brand underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}