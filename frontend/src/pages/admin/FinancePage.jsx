import AdminRecordsPage from "./RecordsPage";
export default function AdminFinancePage() {
	return (
		<AdminRecordsPage
			section="finance"
			title="Finance operations"
			description="Inspect recorded customer payments, refunds and erander settlements. Values remain separated by transaction currency."
			datasets={[
				{ value: "payments", label: "Payments" },
				{ value: "refunds", label: "Refunds" },
				{ value: "settlements", label: "Settlements" },
			]}
			initialDataset="payments"
			statusOptions={[
				"pending",
				"confirmed",
				"failed",
				"cancelled",
				"reversed",
				"requested",
				"processing",
				"succeeded",
				"approved",
			]}
			//note="This finance workspace is not a generic database editor. Existing provider confirmation, refund and settlement records are protected by payment-provider verification and immutable ledger rules. Wallet balances and bank accounts are managed in Wallets; withdrawal requests and Paystack transfer actions are managed separately in Withdrawal Requests; reconciliation can be started from Reconciliation. Refund initiation and settlement payout controls need their provider-specific workflows before they can safely change money."
		/>
	);
}
