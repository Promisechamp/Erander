import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function ErrandsPage() {
	return (
		<AdminRecordsPage
			section="errands"
			title="Errand operations"
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
		/>
	);
}
