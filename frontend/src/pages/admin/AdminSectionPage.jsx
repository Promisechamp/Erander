import AdminUsersPage from "./UsersPage";
import AdminErrandsPage from "./ErrandsPage";
import AdminFinancePage from "./FinancePage";
import AdminWalletsPage from "./WalletsPage";
import AdminWithdrawalsPage from "./WithdrawalsPage";
import AdminSecurityDepositsPage from "./SecurityDepositsPage";
import AdminVerificationPage from "./VerificationPage";
import AdminDisputesPage from "./DisputesPage";
import AdminReconciliationPage from "./ReconciliationPage";
import AdminAuditLogsPage from "./AuditLogsPage";
import AdminSettingsPage from "./SettingsPage";

const pages = {
  users: AdminUsersPage,
  errands: AdminErrandsPage,
  finance: AdminFinancePage,
  wallets: AdminWalletsPage,
  withdrawals: AdminWithdrawalsPage,
  "security-deposits": AdminSecurityDepositsPage,
  verification: AdminVerificationPage,
  disputes: AdminDisputesPage,
  reconciliation: AdminReconciliationPage,
  "audit-logs": AdminAuditLogsPage,
  settings: AdminSettingsPage,
};

export default function AdminSectionPage({ section }) {
  const Page = pages[section];
  if (!Page) return <div className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-xl font-extrabold text-[#14213D]">Admin page not found</h2><p className="mt-2 text-sm text-slate-500">The requested administration section is not configured.</p></div>;
  return <Page />;
}
