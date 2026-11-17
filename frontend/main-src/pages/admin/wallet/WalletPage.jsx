import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function WalletPage() {
  return <AdminRecordsPage section="wallets" title="Wallet administration" datasets={[{ value: "wallets", label: "Wallet balances" }, { value: "accounts", label: "Bank / withdrawal accounts" }, { value: "transactions", label: "Wallet transactions" }]} initialDataset="wallets" statusOptions={["active", "pending", "verified", "failed", "suspended", "closed", "successful", "completed", "reversed"]} />;
}
