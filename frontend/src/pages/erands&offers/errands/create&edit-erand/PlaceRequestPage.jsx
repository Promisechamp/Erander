import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { createErrand } from "@/services/errands/errandsApi";

import ErrandRequestForm from "./ErrandRequestForm";

export default function PlaceRequestPage() {
  const navigate = useNavigate();

  async function handleSubmit(payload) {
    const result = await createErrand(payload);

    toast.success(
      result?.message || "Your errand request has been submitted."
    );

    const createdErrand =
      result?.data?.errand ?? result?.data?.erand ?? result?.data;

    const errandId =
      createdErrand?.id ??
      createdErrand?.errand?.id ??
      createdErrand?.erand?.id;

    navigate(
      errandId
        ? `/dashboard/erands/${encodeURIComponent(errandId)}`
        : "/dashboard/erands",
      { replace: true }
    );
  }

  return (
    <DashboardLayout
      title="Place an errand"
      description="Tell us what you need help with."
    >
      <ErrandRequestForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={() => navigate("/dashboard")}
        backLabel="Back to dashboard"
      />
    </DashboardLayout>
  );
}