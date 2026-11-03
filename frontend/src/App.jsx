import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import LandingPage from "@/LandingPage";
import { LoginPage, RegisterPage } from "@/pages/auth/AuthPages";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import AvailableErrandsPage from "@/pages/erands&offers/errands/AvailableErrandsPage";
import PlaceRequestPage from "@/pages/erands&offers/errands/create&edit-erand/PlaceRequestPage";
import MyErrandsPage from "@/pages/erands&offers/errands/MyErrandsPage";
import MyErrandOffers from "@/pages/erands&offers/errands/MyErrandOffers";
import ErrandDetailsPage from "@/pages/erands&offers/errands/errand-details/ErrandDetails";
import ErrandOffersPage from "@/pages/erands&offers/errands/ErrandOffersPage";
import EditErrandPage from "@/pages/erands&offers/errands/create&edit-erand/EditErrandPage";
import OfferSubmissionPage from "@/pages/erands&offers/offers/OfferSubmissionPage";
import OfferDetailsPage from "@/pages/erands&offers/offers/offer-details/OfferDetails";
import MyOffersPage from "@/pages/erands&offers/offers/MyOffersPage";
import PaymentCallbackPage from "@/components/PaymentCallbackPage";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/routes/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";

function ComingSoonPage({ title }) {
return (
<section className="rounded-2xl border border-slate-200 bg-white p-8 text-center sm:p-12">
<h2 className="text-xl font-extrabold text-[#14213D]">
{title}
</h2>

  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
    This page is part of the ERANDER roadmap and will be connected
    as the feature is implemented.
  </p>
</section>

);
}

export default function App() {
return (
<BrowserRouter>
<AuthProvider>
<Toaster richColors position="top-right" />

    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/payment/callback"
          element={<PaymentCallbackPage />}
        />

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />
								
        <Route
          path="/dashboard/profile"
          element={<ProfilePage />}
        />

        <Route
          path="/dashboard/available-errands"
          element={<AvailableErrandsPage />}
        />

        <Route
          path="/dashboard/erands"
          element={<MyErrandsPage />}
        />
								
								<Route
          path="/dashboard/erands/:errandId/offers"
          element={<MyErrandOffers />}
        />

        <Route
          path="/dashboard/erands/new"
          element={<PlaceRequestPage />}
        />

        <Route
          path="/dashboard/erands/:errandId"
          element={<ErrandDetailsPage />}
        />

        <Route
          path="/dashboard/erands/:errandId/offers"
          element={<ErrandOffersPage />}
        />

        <Route
          path="/dashboard/erands/:errandId/edit"
          element={<EditErrandPage />}
        />

        <Route
          path="/dashboard/available-errands/:errandId/offer"
          element={<OfferSubmissionPage />}
        />
								
							 <Route
           path="/dashboard/my-offers/:offerId"
           element={<OfferDetailsPage />}
        />
								
								<Route
          path="/dashboard/my-offers"
          element={<MyOffersPage />}
        />
								


      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AuthProvider>
</BrowserRouter>

);
}