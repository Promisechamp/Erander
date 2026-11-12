import AdminRecordsPage from "./RecordsPage";
export default function AdminErrandsPage() {
	return (
		<AdminRecordsPage
			section="errands"
			title="Errand operations"
			//description="Monitor marketplace errands and control whether new offers can be submitted before an agreement is locked."
			datasets={[{ value: "erands", label: "Errands" }]}
			initialDataset="erands"
			statusOptions={[
				"draft",
				"open",
				"offer_selected",
				"awaiting_funding",
				"funded",
				"in_progress",
				"completion_submitted",
				"completed",
				"cancelled",
				"disputed",
				"expired",
			]}
		//	note="The available administrative control pauses or resumes new offers only while an errand is in draft/open state and before its agreement is locked. It does not rewrite a customer-erander agreement or bypass the errand lifecycle."
		/>
	);
}
