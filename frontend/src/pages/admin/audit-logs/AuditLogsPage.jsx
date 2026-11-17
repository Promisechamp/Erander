import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function AuditLogsPage() {
  return <AdminRecordsPage section="audit-logs" title="Audit logs" datasets={[{ value: "audit_logs", label: "All audit activity" }]} initialDataset="audit_logs" statusOptions={[]} />;
}
