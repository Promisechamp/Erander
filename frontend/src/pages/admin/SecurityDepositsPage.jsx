import AdminRecordsPage from "./RecordsPage";

export default function AdminSecurityDepositsPage() {
	return (
		<AdminRecordsPage
			section="security-deposits"
			title="Security Deposits "
			//description="Inspect active erander deposit accounts, errand-specific reserved amounts, deposit transactions and claims. Open the linked errand to see the customer, assigned erander, agreement, items, offers and financial history."
			datasets={[
				{ value: "reservations", label: "Errand deposit reservations" },
				{ value: "accounts", label: "Erander deposit accounts" },
				{ value: "transactions", label: "Deposit transactions" },
				{ value: "claims", label: "Deposit claims" },
			]}
			initialDataset="accounts"
			statusOptions={[
				"pending",
				"active",
				"restricted",
				"suspended",
				"reserved",
				"under_review",
				"released",
				"deducted",
				"submitted",
				"approved",
				"rejected",
				"settled",
				"failed",
				"cancelled",
			]}
			// note="An errand-specific reservation is the record that links a security deposit to an errand. Account records show an erander's deposit account, while transaction records show funding and ledger movements. ERANDER v1 continues to reserve 100% of the required security deposit; no tier-based percentage variation is introduced."
		/>
	);
}
