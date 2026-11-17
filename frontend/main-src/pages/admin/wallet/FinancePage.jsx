import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function FinancePage() {
  return <AdminRecordsPage section="finance" title="Finance operations" description="Inspect recorded customer payments, refunds and erander settlements. Values remain separated by transaction currency." datasets={[{ value: "payments", label: "Payments" }, { value: "refunds", label: "Refunds" }, { value: "settlements", label: "Settlements" }]} initialDataset="payments" statusOptions={["pending", "confirmed", "failed", "cancelled", "reversed", "requested", "processing", "succeeded", "approved"]} />;
}
