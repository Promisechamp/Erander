import AdminRecordsPage from "./RecordsPage";
export default function AdminVerificationPage() {
	return (
		<AdminRecordsPage
			section="verification"
			title="Verification review"
			description="Review business profiles and update their verification decisions with a mandatory reason and audit record."
			datasets={[{ value: "businesses", label: "Business verification" }]}
			initialDataset="businesses"
			statusOptions={["pending", "verified", "rejected"]}
			//note="The supplied database contains business verification status but no identity-document verification table. This page supports business verification decisions only; it does not claim to review identity documents that are not stored in the supplied schema."
		/>
	);
}
