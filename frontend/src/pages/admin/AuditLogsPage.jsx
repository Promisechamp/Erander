import AdminRecordsPage from "./RecordsPage";
export default function AdminAuditLogsPage() {
	return (
		<AdminRecordsPage
			section="audit-logs"
			title="Administrator audit logs"
			description="Review immutable administrator action records and administrator-role assignment history."
			datasets={[
				{ value: "admin_actions", label: "Admin actions" },
				{ value: "role_changes", label: "Admin role changes" },
			]}
			initialDataset="admin_actions"
			statusOptions={[]}
			//note="This audit workspace includes the general action audit trail introduced by the v3 migration and the existing immutable role-assignment audit log."
		/>
	);
}
