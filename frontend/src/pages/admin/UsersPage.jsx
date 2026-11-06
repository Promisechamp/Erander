import AdminRecordsPage from "./RecordsPage";
export default function AdminUsersPage() {
	return (
		<AdminRecordsPage
			section="users"
			title="User management"
			description="Search customer and erander profiles, inspect account status and apply audited account restrictions. Super administrators can also assign or revoke administrator roles."
			datasets={[{ value: "profiles", label: "User profiles" }]}
			initialDataset="profiles"
			statusOptions={["active", "suspended", "deactivated"]}
			//note="Account restrictions require a reason and are recorded in the immutable administrator action audit trail. Administrator role changes use the database role-management function and protect the last active super administrator."
		/>
	);
}
