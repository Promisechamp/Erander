import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function SecurityDepositsPage() {
  return <AdminRecordsPage section="security-deposits" title="Security Deposits" datasets={[{ value: "reservations", label: "Errand deposit reservations" }, { value: "accounts", label: "Erander deposit accounts" }, { value: "transactions", label: "Deposit transactions" }, { value: "claims", label: "Deposit claims" }]} initialDataset="accounts" statusOptions={["pending", "active", "restricted", "suspended", "reserved", "under_review", "released", "deducted", "submitted", "approved", "rejected", "settled", "failed", "cancelled"]} />;
}
