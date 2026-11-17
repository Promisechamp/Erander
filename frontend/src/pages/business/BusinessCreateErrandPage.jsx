import BusinessWorkspaceNav from "@/components/layout/BusinessWorkspaceNav";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useBusinessAuth } from "@/contexts/BusinessAuthContext";
import BusinessErrandForm from "@/features/errands/creation/components/BusinessErrandForm";
import { createBusinessErrand } from "@/services/business/businessErrandsApi";

export default function BusinessCreateErrandPage() {
  const navigate = useNavigate();
  const { business, user } = useBusinessAuth();
  const verified = business?.verification_status === "verified";
  const canCreate = verified && ["owner", "admin", "manager"].includes(String(business?.membership_role || "").toLowerCase());

  async function handleSubmit(payload) {
    if (!canCreate) throw new Error("Your business account is not currently authorised to create errands.");
    const response = await createBusinessErrand(payload);
    toast.success(response?.message || "Business Errand created successfully.");
    const errand = response?.data?.errand;
    navigate("/business/errands", { replace: true, state: { createdErrandId: errand?.id } });
  }

  return (
    <>
    <BusinessWorkspaceNav />
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate("/business/errands")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Back to Business Errands</button>
        <header className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">{business?.name || "Business workspace"}</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Create a Business Errand</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">This errand will be created under your business profile and remain associated with this business.</p>
        </header>

        {!verified ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">Your business must be verified before you can create Business Errands. Current status: <strong>{business?.verification_status || "pending"}</strong>.</div>
        ) : !canCreate ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">Your membership role ({business?.membership_role || "member"}) does not have permission to create Business Errands.</div>
        ) : (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 sm:p-7">
            <BusinessErrandForm
              businessMode
              mode="create"
              initialValues={{
                form: {
                  category: "business_support",
                  category_details: { business_name: business?.name || "" },
                },
                items: [],
              }}
              onSubmit={handleSubmit}
              onCancel={() => navigate("/business/errands")}
              backLabel="Back to Business Errands"
            />
          </section>
        )}
      </div>
    </main>
    </> 
  );
}
