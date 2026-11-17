import AdminSettingsPage from "./SettingsPage";
import UsersPage from "./users/UsersPage";
import VerificationPage from "./users/VerificationPage";
import ErrandsPage from "./errands/ErrandsPage";
import DisputesPage from "./errands/DisputesPage";
import WalletPage from "./wallet/WalletPage";
import FinancePage from "./wallet/FinancePage";
import WithdrawalsPage from "./wallet/WithdrawalsPage";
import SecurityDepositsPage from "./wallet/SecurityDepositsPage";
import ReconciliationPage from "./wallet/ReconciliationPage";
import AuditLogsPage from "./audit-logs/AuditLogsPage";

const pages = {
	users: UsersPage,
	verification: VerificationPage,
	errands: ErrandsPage,
	disputes: DisputesPage,
	wallets: WalletPage,
	finance: FinancePage,
	withdrawals: WithdrawalsPage,
	"security-deposits": SecurityDepositsPage,
	reconciliation: ReconciliationPage,
	"audit-logs": AuditLogsPage,
};

export default function AdminSectionPage({ section }) {
	if (section === "settings") return <AdminSettingsPage />;
	const Page = pages[section];
	if (!Page)
		return (
			<div className="rounded-2xl border border-slate-200 bg-white p-8">
				<h2 className="text-xl font-extrabold text-[#14213D]">
					Admin page not found
				</h2>
				<p className="mt-2 text-sm text-slate-500">
					The requested administration section is not configured.
				</p>
			</div>
		);
	return <Page />;
}
