import AdminRecordsPage from "./RecordsPage";

export default function AdminWalletsPage() {
	return (
		<AdminRecordsPage
			section="wallets"
			title="Wallet administration"
			description="Inspect every user's wallet balances, linked bank and withdrawal accounts, and the immutable wallet transaction history. Open a user to see their full wallet and bank-account profile."
			datasets={[
				{ value: "wallets", label: "Wallet balances" },
				{ value: "accounts", label: "Bank / withdrawal accounts" },
				{ value: "transactions", label: "Wallet transactions" },
			]}
			initialDataset="wallets"
			statusOptions={[
				"active",
				"pending",
				"verified",
				"failed",
				"suspended",
				"closed",
				"successful",
				"completed",
				"reversed",
			]}
			// note="Wallet balances are stored in minor units and displayed using each wallet's currency. Bank account numbers are intentionally masked to the last four digits; full bank credentials are not exposed to the admin read model. Withdrawal requests are managed on the separate Withdrawal Requests page."
		/>
	);
}
