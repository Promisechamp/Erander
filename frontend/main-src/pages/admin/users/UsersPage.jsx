import AdminRecordsPage from "../shared/data-table/AdminRecordsPage";

export default function UsersPage() {
	return (
		<AdminRecordsPage
			section="users"
			title="User management"
			datasets={[{ value: "profiles", label: "User profiles" }]}
			initialDataset="profiles"
			statusOptions={["active", "suspended", "deactivated"]}
		/>
	);
}
