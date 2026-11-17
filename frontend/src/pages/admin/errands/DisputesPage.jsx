import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function DisputesPage() {
  return <AdminRecordsPage section="disputes" title="Dispute monitoring" description="Inspect errands currently marked as disputed and their recorded parties, status and amount." datasets={[{ value: "disputed_errands", label: "Disputed errands" }]} initialDataset="disputed_errands" statusOptions={["disputed"]} />;
}
