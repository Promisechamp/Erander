import { ChevronRight } from "lucide-react";

import RecordCell from "./RecordCell";
import { Avatar, StatusPill } from "./RecordsUI";
import {
  STATUS_COLUMNS,
  getRowTitle,
  humanize,
} from "./recordsUtils";

const CHECKBOX = "h-4 w-4 shrink-0 rounded border-line accent-[#14213d]";

export default function RecordsCards({
  rows,
  fields,
  section,
  selectedIds,
  onToggleRow,
  onOpen,
  ctx,
}) {
  return (
    <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((row) => {
        const checked = selectedIds.includes(row.id);
        const title = getRowTitle(row, section);
        const statusColumn = STATUS_COLUMNS.find((column) => row[column]);
        const person = section === "users" ? row : row.wallet_owner || row.erander_owner;

        return (
          <li key={row.id} className="min-w-0">
            <article
              role="button"
              tabIndex={0}
              onClick={() => onOpen(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onOpen(row);
              }}
              className={`group flex h-full cursor-pointer flex-col rounded-2xl border p-4 transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                checked
                  ? "border-brand bg-brand-pale/50"
                  : "border-line bg-surface-white hover:border-line-strong"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleRow(row.id)}
                  onClick={(event) => event.stopPropagation()}
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

                {statusColumn ? <StatusPill value={row[statusColumn]} /> : null}
              </div>

              {fields.length > 0 ? (
                <dl className="mt-3 flex-1 space-y-2">
                  {fields.map((column) => (
                    <div
                      key={column}
                      className="flex items-center justify-between gap-3"
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