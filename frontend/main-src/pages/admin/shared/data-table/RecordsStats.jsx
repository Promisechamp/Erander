import { useMemo } from "react";

import { StatCard } from "./RecordsUI";
import {
  GROUP_BAR,
  currencyValue,
  getPageTotals,
  getRowStatus,
  humanize,
  statusGroup,
} from "./recordsUtils";

export default function RecordsStats({
  payload,
  rows,
  columns,
  loading,
  status,
  hasFilters,
  onFilterStatus,
}) {
  const counts = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const value = getRowStatus(row);
      if (value) map.set(value, (map.get(value) || 0) + 1);
    });

    return [...map.entries()]
      .map(([value, count]) => ({ value, count, group: statusGroup(value) }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const sumGroup = (group) =>
    counts
      .filter((item) => item.group === group)
      .reduce((sum, item) => sum + item.count, 0);

  const attention = sumGroup("attention");
  const danger = sumGroup("danger");
  const totalWithStatus = counts.reduce((sum, item) => sum + item.count, 0);

  const totals = useMemo(() => getPageTotals(rows, columns), [rows, columns]);

  const ready = Boolean(payload) && !loading;
  const first = totals?.totals?.[0];

  return (
    <div className="space-y-3">
      <div
        className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${
          totals ? "xl:grid-cols-5" : ""
        }`}
      >
        <StatCard
          label="Matching records"
          value={ready ? Number(payload.total || 0).toLocaleString() : "—"}
          hint={hasFilters ? "Filters applied" : "All records"}
        />
        <StatCard
          label="On this page"
          value={ready ? rows.length : "—"}
          hint={ready ? `Page ${payload.page} of ${payload.totalPages}` : ""}
        />
        <StatCard
          label="Needs attention"
          value={ready ? attention : "—"}
          hint="Pending or in review, this page"
          tone={attention ? "amber" : "default"}
        />
        <StatCard
          label="Failed or blocked"
          value={ready ? danger : "—"}
          hint="Rejected, failed or suspended, this page"
          tone={danger ? "rose" : "default"}
        />

        {totals ? (
          <div className="col-span-2 lg:col-span-4 xl:col-span-1">
            <StatCard
              label="Page value"
              value={ready && first ? currencyValue(first.amount, first.currency) : "—"}
              hint={
                ready
                  ? totals.totals.length > 1
                    ? totals.totals
                        .slice(1)
                        .map((item) => currencyValue(item.amount, item.currency))
                        .join(" · ")
                    : `Sum of ${humanize(totals.key)}`
                  : ""
              }
            />
          </div>
        ) : null}
      </div>

      {ready && totalWithStatus > 0 ? (
        <div className="rounded-2xl border border-line bg-surface-white px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-content-muted">
              Status breakdown (this page)
            </p>
            <p className="text-[11px] text-content-subtle">Tap to filter</p>
          </div>

          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
            {counts.map((item) => (
              <button
                key={item.value}
                type="button"
                title={`${humanize(item.value)}: ${item.count}`}
                aria-label={`Filter by ${humanize(item.value)}`}
                onClick={() =>
                  onFilterStatus(item.value === status ? "" : item.value)
                }
                style={{ width: `${(item.count / totalWithStatus) * 100}%` }}
                className={`${GROUP_BAR[item.group]} h-full transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {counts.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  onFilterStatus(item.value === status ? "" : item.value)
                }
                className="inline-flex items-center gap-1.5 text-xs text-content-muted transition hover:text-content"
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${GROUP_BAR[item.group]}`}
                />
                {humanize(item.value)}
                <span className="font-bold tabular-nums text-content">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}