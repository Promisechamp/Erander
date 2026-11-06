import AdminRecordsPage from "./RecordsPage";
export default function AdminDisputesPage() {
	return (
		<AdminRecordsPage
			section="disputes"
			title="Dispute monitoring"
			description="Inspect errands currently marked as disputed and their recorded parties, status and amount."
			datasets={[{ value: "disputed_errands", label: "Disputed errands" }]}
			initialDataset="disputed_errands"
			statusOptions={["disputed"]}
			//note="The supplied schema has no dedicated dispute case, evidence, decision or resolution table. This page therefore monitors disputed errands but does not fabricate a dispute-resolution control. A complete resolution workflow needs a case model and explicit evidence/decision records."
		/>
	);
}
