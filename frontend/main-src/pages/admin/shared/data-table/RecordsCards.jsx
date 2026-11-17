import { ChevronRight } from "lucide-react";

import RecordCell from "./RecordCell";
import { Avatar } from "./RecordsUI";
import { getRowTitle, humanize } from "./recordsUtils";

const CHECKBOX = "h-4 w-4 shrink-0 rounded border-line accent-[#14213d]";

const DEFAULT_CARD_COLUMNS = {
  phone: 1,
  tablet: 3,
  pc: 6,
  desktop: 8,
};

function normalizeCardColumns(values = {}) {
  const settings = {
    phone: { min: 1, max: 8 },
    tablet: { min: 1, max: 8 },
    pc: { min: 1, max: 8 },
    desktop: { min: 1, max: 8 },
  };

  return Object.fromEntries(
    Object.entries(settings).map(([key, limits]) => {
      const value = Number(values[key] ?? DEFAULT_CARD_COLUMNS[key]);

      return [
        key,
        Math.min(
          limits.max,
          Math.max(
            limits.min,
            Number.isFinite(value)
              ? Math.round(value)
              : DEFAULT_CARD_COLUMNS[key]
          )
        ),
      ];
    })
  );
}

export default function RecordsCards({
  rows,
  fields,
  section,
  selectedIds,
  onToggleRow,
  onOpen,
  ctx,
  cardColumnsByBreakpoint = DEFAULT_CARD_COLUMNS,
}) {
  const cardColumns = normalizeCardColumns(cardColumnsByBreakpoint);

  return (
    <ul
      className="
        grid gap-3 p-4 sm:p-5
        grid-cols-[repeat(var(--phone-columns),minmax(0,1fr))]
        sm:grid-cols-[repeat(var(--tablet-columns),minmax(0,1fr))]
        lg:grid-cols-[repeat(var(--pc-columns),minmax(0,1fr))]
        xl:grid-cols-[repeat(var(--desktop-columns),minmax(0,1fr))]
      "
      style={{
        "--phone-columns": cardColumns.phone,
        "--tablet-columns": cardColumns.tablet,
        "--pc-columns": cardColumns.pc,
        "--desktop-columns": cardColumns.desktop,
      }}
    >
      {rows.map((row) => {
        const checked = selectedIds.includes(row.id);
        const title =
        section === "support"
        ? row.ticket_number || row.subject || row.id || "Support ticket"
        : getRowTitle(row, section);

        const person =
          section === "users"
            ? row
            : row.wallet_owner || row.erander_owner;

        return (
          <li key={row.id} className="min-w-0">
            <article
              role="button"
              tabIndex={0}
              onClick={() => onOpen(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(row);
                }
              }}
              className={`group flex h-full min-w-0 cursor-pointer flex-col rounded-2xl border p-4 transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                checked
                  ? "border-brand bg-brand-pale/50"
                  : "border-line bg-surface-white hover:border-line-strong"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleRow(row.id)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  aria-label={`Select ${title}`}
                  className={`${CHECKBOX} mt-1`}
                />

                {person ? <Avatar profile={person} size="sm" /> : null}

                <div className="min-w-0 flex-1">
                  <p
                    title={title}
                    className="truncate text-sm font-extrabold text-content"
                  >
                    {title}
                  </p>

                  {row.created_at ? (
                    <p className="mt-0.5 text-[11px] text-content-subtle">
                      {new Date(row.created_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
              </div>

              {fields.length > 0 ? (
                <dl className="mt-3 min-w-0 flex-1 space-y-2">
                  {fields.map((column) => (
                    <div
                      key={column}
                      className="flex min-w-0 items-center justify-between gap-3"
                    >
                      <dt className="shrink-0 text-xs text-content-muted">
                        {humanize(column)}
                      </dt>

                      <dd className="min-w-0 max-w-[62%] text-right text-xs font-semibold text-content">
                        <RecordCell
                          row={row}
                          column={column}
                          section={section}
                          ctx={ctx}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="flex-1" />
              )}

              <div className="mt-3 flex items-center justify-end border-t border-line-soft pt-3">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                  {["errands", "disputes"].includes(section)
                    ? "Open errand"
                    : "View details"}

                  <ChevronRight
                    size={14}
                    aria-hidden="true"
                    className="transition group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}