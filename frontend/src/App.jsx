import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Toaster from "@/components/Toaster";
import LandingPage from "@/LandingPage";
import { LoginPage, RegisterPage } from "@/pages/auth/AuthPages";
import AdminLoginPage from "@/pages/admin/auth/AdminLoginPage";
import { BusinessLoginPage, BusinessRegisterPage } from "@/pages/business/auth/BusinessAuthPages";
import BusinessHomePage from "@/pages/business/BusinessHomePage";
import BusinessErrandsPage from "@/pages/business/BusinessErrandsPage";
import BusinessCreateErrandPage from "@/pages/business/BusinessCreateErrandPage";
import BusinessSettingsPage from "@/pages/business/BusinessSettingsPage";
import BusinessFavoriteErrandersPage from "@/pages/business/BusinessFavoriteErrandersPage";
import BusinessRoute from "@/routes/BusinessRoute";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import FavoriteErrandersPage from "@/pages/favorites/FavoriteErrandersPage";
import WalletPage from "@/pages/dashboard/wallet/WalletPage";
import AvailableErrandsPage from "@/features/errands/erander/available/AvailableErrandsPage";
import PlaceRequestPage from "@/features/errands/creation/PlaceRequestPage";
import MyErrandsPage from "@/features/errands/customer/MyErrandsPage";
import MyErrandOffers from "@/features/errands/customer/offers-received/ErrandOffers";
import ErrandDetailsPage from "@/features/errands/details/ErrandDetails";
import OfferSubmissionPage from "@/features/offers/erander/submission/OfferSubmissionPage";
import OfferDetailsPage from "@/features/offers/erander/details/OfferDetails";
import MyOffersPage from "@/features/offers/erander/my-offers/MyOffersPage";
import PaymentCallbackPage from "@/components/PaymentCallbackPage";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { BusinessAuthProvider } from "@/contexts/BusinessAuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import ChatPage from "@/pages/chat/ChatPage";
import ProtectedRoute from "@/routes/ProtectedRoute";
import SupportCenter from "@/pages/support/SupportCenter";
import CreateSupportTicket from "@/pages/support/CreateSupportTicket";
import SupportTicketDetails from "@/pages/support/SupportTicketDetails";


//Admin
import AdminRoute from "@/routes/AdminRoute";
import AdminLayout from "@/components/layout/AdminLayout";
import AdminDashboardPage from "@/pages/admin/DashboardPage";
import UsersPage from "@/pages/admin/users/UsersPage";
import VerificationPage from "@/pages/admin/users/VerificationPage";
import ErrandsPage from "@/pages/admin/errands/ErrandsPage";
import DisputesPage from "@/pages/admin/errands/DisputesPage";
import AdminWalletPage from "@/pages/admin/wallet/WalletPage";
import FinancePage from "@/pages/admin/wallet/FinancePage";
import WithdrawalsPage from "@/pages/admin/wallet/WithdrawalsPage";
import SecurityDepositsPage from "@/pages/admin/wallet/SecurityDepositsPage";
import FundReleaseManagementPage from "@/pages/admin/fundRelease/FundReleasePage";
import ReconciliationPage from "@/pages/admin/wallet/ReconciliationPage";
import AuditLogsPage from "@/pages/admin/audit-logs/AuditLogsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import AdminChatsPage from "@/pages/admin/chat/AdminChatsPage";
import AdminSupportTickets from "@/pages/admin/support/AdminSupportTickets";
import AdminSupportTicketDetails from "@/pages/admin/support/AdminSupportTicketDetails";

export default function App() {
return (
<BrowserRouter>
<AuthProvider>
<AdminAuthProvider>
<BusinessAuthProvider>
<ChatProvider>
<Toaster />
<Routes>
<Route path="/" element={<LandingPage />} />
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/business/login" element={<BusinessLoginPage />} />
          <Route path="/business/register" element={<BusinessRegisterPage />} />
          <Route element={<BusinessRoute />}>
            <Route path="/business" element={<BusinessHomePage />} />
            <Route path="/business/errands" element={<BusinessErrandsPage />} />
            <Route path="/business/errands/new" element={<BusinessCreateErrandPage />} />
            <Route path="/business/settings" element={<BusinessSettingsPage />} />
            <Route path="/business/favorites" element={<BusinessFavoriteErrandersPage />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="errands" element={<ErrandsPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="wallets" element={<AdminWalletPage />} />
              <Route path="withdrawals" element={<WithdrawalsPage />} />
              <Route path="fund-releases" element={<FundReleaseManagementPage />} />
              <Route path="security-deposits" element={<SecurityDepositsPage />} />
              <Route path="disputes" element={<DisputesPage />} />
              <Route path="verification" element={<VerificationPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="chats" element={<AdminChatsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="support" element={<AdminSupportTickets />} />
              <Route path="support/:ticketId" element={<AdminSupportTicketDetails />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/payment/callback" element={<PaymentCallbackPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/dashboard/profile" element={<ProfilePage />} />
            <Route path="/dashboard/favorite-erranders" element={<FavoriteErrandersPage />} />
            <Route path="/dashboard/wallet" element={<WalletPage />} />
            <Route path="/dashboard/available-errands" element={<AvailableErrandsPage />} />
            <Route path="/dashboard/erands" element={<MyErrandsPage />} />
            <Route path="/dashboard/erands/:errandId/offers" element={<MyErrandOffers />} />
            <Route path="/dashboard/erands/new" element={<PlaceRequestPage />} />
            <Route path="/dashboard/erands/:errandId" element={<ErrandDetailsPage />} />
            { /*<Route path="/dashboard/erands/:errandId/edit" element={<EditErrandPage />} /> */ }
            <Route path="/dashboard/available-errands/:errandId/offer" element={<OfferSubmissionPage />} />
            <Route path="/dashboard/my-offers/:offerId" element={<OfferDetailsPage />} />
            <Route path="/dashboard/my-offers" element={<MyOffersPage />} />
            <Route path="/dashboard/support" element={<SupportCenter />} />
            <Route path="/dashboard/support/new" element={<CreateSupportTicket />} />
            <Route path="/dashboard/support/:ticketId" element={<SupportTicketDetails />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ChatProvider>
    </BusinessAuthProvider>
    </AdminAuthProvider>
  </AuthProvider>
</BrowserRouter>

);
}