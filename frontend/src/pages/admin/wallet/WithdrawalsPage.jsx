import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function WithdrawalsPage() {
  return <AdminRecordsPage section="withdrawals" title="Withdrawal requests" datasets={[{ value: "requests", label: "All withdrawal requests" }]} initialDataset="requests" statusOptions={["pending", "approved", "processing", "successful", "completed", "failed", "rejected", "cancelled"]} enableWithdrawalActions />;
}
