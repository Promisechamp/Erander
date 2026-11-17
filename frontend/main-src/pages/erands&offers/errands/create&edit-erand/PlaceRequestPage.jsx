import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ClipboardList } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { createErrand } from "@/services/errands/errandsApi";
import CreateErrandModal from "./components/CreateErrandModal";

export default function PlaceRequestPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(payload) {
    if (submitting) return;

    setSubmitting(true);
    try {
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout
      title="Create an errand"
      description="Choose the kind of help you need to get started."
    >
      <div className="mx-auto w-full max-w-3xl px-0 py-8 sm:px-2 lg:py-12">
        <div className="rounded-3xl border border-line bg-surface-white p-8 text-center sm:p-12">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-pale text-brand-navy">
            <ClipboardList size={26} aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
            Let’s get your errand started
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-content-muted">
            Choose the type of help you need. We’ll open a form designed for that errand.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-green px-8 py-3 text-sm font-extrabold text-brand-navy transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          >
            Create Errand
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <CreateErrandModal
        isOpen={modalOpen}
        onClose={() => navigate("/dashboard")}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </DashboardLayout>
  );
}
