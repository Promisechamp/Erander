import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function VerificationPage() {
  return <AdminRecordsPage section="verification" title="Verification review" description="Review business profiles and update their verification decisions with a mandatory reason and audit record." datasets={[{ value: "businesses", label: "Business verification" }]} initialDataset="businesses" statusOptions={["pending", "verified", "rejected"]} />;
}
