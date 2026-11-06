import AdminRecordsPage from "./RecordsPage";
export default function AdminReconciliationPage() {
	return (
		<AdminRecordsPage
			section="reconciliation"
			title="Financial reconciliation"
			description="Run wallet/ledger reconciliation and manage detected reconciliation issues."
			datasets={[
				{ value: "runs", label: "Reconciliation runs" },
				{ value: "issues", label: "Reconciliation issues" },
			]}
			initialDataset="issues"
			statusOptions={[
				"open",
				"investigating",
				"resolved",
				"ignored",
				"pending",
				"running",
				"completed",
				"completed_with_issues",
				"failed",
			]}
			//note="Reconciliation runs use the existing SECURITY DEFINER function with the authenticated administrator's JWT. Issue status changes require resolution notes and retain the acting administrator in the audit log. Reconciliation does not automatically correct balances."
		/>
	);
}
