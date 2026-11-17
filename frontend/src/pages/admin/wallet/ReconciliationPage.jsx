import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function ReconciliationPage() {
  return <AdminRecordsPage section="reconciliation" title="Financial reconciliation" description="Run wallet/ledger reconciliation and manage detected reconciliation issues." datasets={[{ value: "runs", label: "Reconciliation runs" }, { value: "issues", label: "Reconciliation issues" }]} initialDataset="issues" statusOptions={["open", "investigating", "resolved", "ignored", "pending", "running", "completed", "completed_with_issues", "failed"]} />;
}
