import { LoaderCircle } from "lucide-react";

import Modal from "@/components/Modal";
import Select from "@/components/Select";

import { Banner, CopyButton, StatusPill } from "./RecordsUI";
import {
  BTN_DANGER_SOFT,
  BTN_NAVY,
  TEXTAREA,
} from "./recordsStyles";
import { ROLE_LABELS, fullName, humanize } from "./recordsUtils";

export default function RoleManagerModal({
  open,
  busy,
  data,
  target,
  error,
  code,
  setCode,
  reason,
  setReason,
  onChange,
  onClose,
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Manage administrator roles"
      subtitle="Super administrator access"
      description={target ? fullName(target) : "Profile"}
      size="lg"
      position="bottom"
      height="auto"
      headerTone="navy"
      zIndex={100}
    >
      {busy && !data ? (
        <div role="status" className="flex items-center gap-2 py-8 text-sm text-content-muted">
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
          Loading role assignments
        </div>
      ) : data ? (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-line">
            <p className="border-b border-line-soft bg-surface-muted px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-content-muted">
              Current assignments
            </p>

            <ul className="divide-y divide-line-soft">
              {data.assignments?.length ? (
                data.assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-content">
                          {ROLE_LABELS[assignment.role_code] ||
                            humanize(assignment.role_code)}
                        </p>
                        <StatusPill value={assignment.assignment_status} />
                      </div>
                      <p className="mt-1 text-xs text-content-muted">
                        {assignment.reason || "No reason recorded"}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <code className="break-all text-[11px] text-content-subtle">
                          {assignment.id}
                        </code>
                        <CopyButton value={assignment.id} />
                      </div>
                    </div>

                    {assignment.assignment_status === "active" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setCode(assignment.role_code);
                          setReason("");
                        }}
                        className={`${BTN_DANGER_SOFT} !px-3.5 !py-1.5 text-xs`}
                      >
                        Select to revoke
                      </button>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 text-center text-sm text-content-muted">
                  No administrator roles assigned.
                </li>
              )}
            </ul>
          </div>

          <Select
            label="Role to assign or revoke"
            options={(data.availableRoles || Object.keys(ROLE_LABELS)).map(
              (role) => ({
                value: role,
                label: ROLE_LABELS[role] || humanize(role),
              })
            )}
            value={code}
            onChange={setCode}
            searchable={false}
            clearable={false}
          />

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor="role-reason" className="text-sm font-bold text-content">
                Reason
              </label>
              <span className="text-xs tabular-nums text-content-subtle">
                {reason.trim().length}/5 min
              </span>
            </div>
            <textarea
              id="role-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={TEXTAREA}
            />
          </div>

          {error ? <Banner tone="danger">{error}</Banner> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy || reason.trim().length < 5}
              onClick={() => onChange(false)}
              className={BTN_DANGER_SOFT}
            >
              Revoke selected role
            </button>

            <button
              type="button"
              disabled={busy || reason.trim().length < 5}
              onClick={() => onChange(true)}
              className={BTN_NAVY}
            >
              {busy ? (
                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              ) : null}
              Assign selected role
            </button>
          </div>

          <p className="text-xs leading-5 text-content-muted">
            The database function prevents revoking the last active super
            administrator and writes to the immutable role audit log.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}