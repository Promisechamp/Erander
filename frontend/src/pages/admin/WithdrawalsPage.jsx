import AdminRecordsPage from "./RecordsPage";

export default function AdminWithdrawalsPage() {
	return (
		<AdminRecordsPage
			section="withdrawals"
			title="Withdrawal requests"
			//description="Review every withdrawal request independently from wallet balances. Approve or reject requests, initiate the Paystack transfer after approval, and verify the provider's transfer status."
			datasets={[{ value: "requests", label: "All withdrawal requests" }]}
			initialDataset="requests"
			statusOptions={[
				"pending",
				"approved",
				"processing",
				"successful",
				"completed",
				"failed",
				"rejected",
				"cancelled",
			]}
			enableWithdrawalActions
			// note="Approving a request does not send money. Initiating a Paystack transfer can move real money when live credentials are configured. The request, bank-account snapshot, and wallet transaction are shown together for review."
		/>
	);
}
