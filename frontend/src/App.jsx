import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import LandingPage from "@/LandingPage";
import { LoginPage, RegisterPage } from "@/pages/auth/AuthPages";
import AdminLoginPage from "@/pages/admin/auth/AdminLoginPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import WalletPage from "@/pages/dashboard/WalletPage";
import AvailableErrandsPage from "@/pages/erands&offers/errands/AvailableErrandsPage";
import PlaceRequestPage from "@/pages/erands&offers/errands/create&edit-erand/PlaceRequestPage";
import MyErrandsPage from "@/pages/erands&offers/errands/MyErrandsPage";
import MyErrandOffers from "@/pages/erands&offers/errands/erand-offers/ErrandOffers";
import ErrandDetailsPage from "@/pages/erands&offers/errands/errand-details/ErrandDetails";
import EditErrandPage from "@/pages/erands&offers/errands/create&edit-erand/EditErrandPage";
import OfferSubmissionPage from "@/pages/erands&offers/offers/OfferSubmissionPage";
import OfferDetailsPage from "@/pages/erands&offers/offers/offer-details/OfferDetails";
import MyOffersPage from "@/pages/erands&offers/offers/MyOffersPage";
import PaymentCallbackPage from "@/components/PaymentCallbackPage";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import ProtectedRoute from "@/routes/ProtectedRoute";


//ADMIN LAYOUTS

import AdminRoute from "@/routes/AdminRoute";
import AdminLayout from "@/components/layout/AdminLayout";
import AdminDashboardPage from "@/pages/admin/DashboardPage";
import UsersPage from "@/pages/admin/UsersPage";
import ErrandsPage from "@/pages/admin/ErrandsPage";
import FinancePage from "@/pages/admin/FinancePage";
import WalletsPage from "@/pages/admin/WalletsPage";
import Withdrawals from "@/pages/admin/WithdrawalsPage";
import SecurityDepositsPage from "@/pages/admin/SecurityDepositsPage";
import DisputesPage from "@/pages/admin/DisputesPage";
import VerificationPage from "@/pages/admin/VerificationPage";
import ReconciliationPage from "@/pages/admin/ReconciliationPage";
import AuditLogsPage from "@/pages/admin/AuditLogsPage";
import SettingsPage from "@/pages/admin/SettingsPage";

export default function App() {
  return <BrowserRouter>
    <AuthProvider>
      <AdminAuthProvider>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="errands" element={<ErrandsPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="wallets" element={<WalletsPage />} />
              <Route path="withdrawals" element={<Withdrawals />} />
              <Route path="security-deposits" element={<SecurityDepositsPage />} />
              <Route path="disputes" element={<DisputesPage />} />
              <Route path="verification" element={<VerificationPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/payment/callback" element={<PaymentCallbackPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/profile" element={<ProfilePage />} />
            <Route path="/dashboard/wallet" element={<WalletPage />} />
            <Route path="/dashboard/available-errands" element={<AvailableErrandsPage />} />
            <Route path="/dashboard/erands" element={<MyErrandsPage />} />
            <Route path="/dashboard/erands/:errandId/offers" element={<MyErrandOffers />} />
            <Route path="/dashboard/erands/new" element={<PlaceRequestPage />} />
            <Route path="/dashboard/erands/:errandId" element={<ErrandDetailsPage />} />
            <Route path="/dashboard/erands/:errandId/edit" element={<EditErrandPage />} />
            <Route path="/dashboard/available-errands/:errandId/offer" element={<OfferSubmissionPage />} />
            <Route path="/dashboard/my-offers/:offerId" element={<OfferDetailsPage />} />
            <Route path="/dashboard/my-offers" element={<MyOffersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminAuthProvider>
    </AuthProvider>
  </BrowserRouter>;
}
