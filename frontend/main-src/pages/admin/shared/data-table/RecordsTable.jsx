import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
} from "lucide-react";

import RecordCell from "./RecordCell";
import { getRowTitle, humanize, isMoneyColumn } from "./recordsUtils";

const CHECKBOX = "h-4 w-4 rounded border-line accent-[#14213d]";

function HeaderCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label="Select all rows on this page"
      className={CHECKBOX}
    />
  );
}

function ColumnFilterInput({ value, onChange, label }) {
  return (
    <input
      type="search"
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      aria-label={`Filter ${label}`}
      placeholder="Filter…"
      className="mt-2 h-8 w-full min-w-[90px] rounded-lg border border-line bg-surface-white px-2.5 text-[11px] font-medium text-content outline-none placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale"
    />
  );
}

export default function RecordsTable({
  rows,
  columns,
  section,
  dense,
  selectedIds,
  allSelected,
  onToggleRow,
  onToggleAll,
  sortKey,
  sortDir,
  onSort,
  onOpen,
  ctx,

  // Optional extensions. Existing records pages can omit these.
  columnFilters = {},
  onColumnFilter,
  renderCell,
}) {
  const pad = dense ? "py-2" : "py-3.5";

  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-max border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th
              scope="col"
              rowSpan={onColumnFilter ? 2 : 1}
              className="sticky left-0 top-0 z-30 w-12 border-b border-line bg-surface-muted px-4 py-3"
            >
              <HeaderCheckbox
                checked={allSelected}
                indeterminate={selectedIds.length > 0 && !allSelected}
                onChange={onToggleAll}
              />
            </th>

            {columns.map((column) => {
              const active = sortKey === column;

              const SortIcon = !active
                ? ArrowUpDown
                : sortDir === "asc"
                  ? ArrowUp
                  : ArrowDown;

              return (
                <th
                  key={column}
                  scope="col"
                  rowSpan={onColumnFilter ? undefined : 1}
                  aria-sort={
                    active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`sticky top-0 z-20 whitespace-nowrap border-b border-line bg-surface-muted px-4 py-3 ${
                    isMoneyColumn(column) ? "text-right" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? "text-brand"
                        : "text-content-muted hover:text-content"
                    }`}
                  >
                    {humanize(column)}
                    <SortIcon size={12} aria-hidden="true" />
                  </button>

                  {onColumnFilter ? (
                    <ColumnFilterInput
                      value={columnFilters[column]}
                      onChange={(value) => onColumnFilter(column, value)}
                      label={humanize(column)}
                    />
                  ) : null}
                </th>
              );
            })}

            <th
              scope="col"
              rowSpan={onColumnFilter ? 2 : 1}
              className="sticky right-0 top-0 z-30 w-12 border-b border-line bg-surface-muted px-4 py-3"
            >
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const checked = selectedIds.includes(row.id);

            const stickyBg = checked
              ? "bg-brand-pale"
              : "bg-surface-white group-hover:bg-surface-muted";

            return (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onOpen(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onOpen(row);
                  }
                }}
                className={`group cursor-pointer align-middle transition focus:outline-none focus-visible:bg-surface-muted ${
                  checked
                    ? "bg-brand-pale/60"
                    : "hover:bg-surface-muted/60"
                }`}
              >
                <td
                  className={`sticky left-0 z-10 border-b border-line-soft px-4 ${pad} ${stickyBg}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleRow(row.id)}
                    aria-label={`Select ${getRowTitle(row, section)}`}
                    className={CHECKBOX}
                  />
                </td>

                {columns.map((column) => (
                  <td
                    key={column}
                    className={`max-w-[300px] whitespace-nowrap border-b border-line-soft px-4 ${pad} ${
                      isMoneyColumn(column)
                        ? "text-right font-semibold tabular-nums"
                        : ""
                    }`}
                  >
                    {renderCell ? (
                      renderCell(row, column)
                    ) : (
                      <RecordCell
                        row={row}
                        column={column}
                        section={section}
                        ctx={ctx}
                      />
                    )}
                  </td>
                ))}

                <td
                  className={`sticky right-0 z-10 border-b border-line-soft px-4 ${pad} ${stickyBg}`}
                >
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="ml-auto text-content-subtle transition group-hover:translate-x-0.5 group-hover:text-content"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}