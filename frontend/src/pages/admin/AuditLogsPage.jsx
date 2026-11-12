import AdminRecordsPage from "./RecordsPage";

export default function AdminAuditLogsPage() {
  return (
    <AdminRecordsPage
      section="audit-logs"
      title="Audit logs"
      //description="Review immutable administrator actions, role assignments and other recorded administrative events in one chronological audit trail."
      datasets={[{ value: "audit_logs", label: "All audit activity" }]}
      initialDataset="audit_logs"
      statusOptions={[]}
    />
  );
}
