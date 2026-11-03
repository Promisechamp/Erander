import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardList,
  Package,
  Plus,
  ShieldCheck,
  Wallet,
  MapPin,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";

function OverviewCard({ icon: Icon, label, value, description }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
        <Icon size={21} />
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-extrabold text-[#14213D]">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </article>
  );
}

function ComingSoonCard({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
        <Icon size={23} />
      </div>

      <h2 className="mt-5 text-lg font-extrabold text-[#14213D]">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <button
        type="button"
        onClick={onClick}
        className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#16864B] transition hover:text-[#14213D]"
      >
        {action}
        <ArrowRight size={16} />
      </button>
    </article>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const firstName =
    user?.user_metadata?.first_name ||
    user?.first_name ||
    user?.email?.split("@")[0] ||
    "there";

  function goToPlaceRequest() {
    navigate("/dashboard/erands/new");
  }

  function goToMyErrands() {
    navigate("/dashboard/erands");
  }

  return (
    <DashboardLayout
      title="Dashboard"
      description="Your personal overview of ERANDER."
    >
      <section className="relative overflow-hidden rounded-3xl bg-[#14213D] p-7 text-white sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[35px] border-white/[0.04]" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-[#20CC88]/10 blur-2xl" />

        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#8CF0B5]">
            <ShieldCheck size={14} />
            Your errands, simplified
          </span>

          <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.7rem]">
            Welcome, {firstName}!
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            Get things done more easily by connecting with people ready
            to help with your everyday and business errands.
          </p>

          <button
            type="button"
            onClick={goToPlaceRequest}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#35D07F] px-5 py-3.5 text-sm font-extrabold text-[#14213D] transition hover:bg-[#63E69D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Request an errand
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#14213D]">
              Your overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your activity at a glance.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            <Clock3 size={14} />
            Live statistics coming next
          </span>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            icon={ClipboardList}
            label="Active errands"
            value="—"
            description="Errands currently in progress"
          />

          <OverviewCard
            icon={CheckCircle2}
            label="Completed"
            value="—"
            description="Successfully completed errands"
          />

          <OverviewCard
            icon={Package}
            label="Open requests"
            value="—"
            description="Requests awaiting offers"
          />

          <OverviewCard
            icon={Wallet}
            label="Wallet balance"
            value="Not available"
            description="Wallet information is not connected yet"
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#14213D]">
              Quick actions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Get started with your next errand.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
              <Package size={23} />
            </div>

            <h3 className="mt-5 text-lg font-extrabold text-[#14213D]">
              Your errands
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              View and manage the requests you create, including their
              status, budget and offers.
            </p>

            <button
              type="button"
              onClick={goToMyErrands}
              className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#16864B] transition hover:text-[#14213D]"
            >
              View errands
              <ArrowRight size={16} />
            </button>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E9FBF3] text-[#16864B]">
              <Plus size={23} />
            </div>

            <h3 className="mt-5 text-lg font-extrabold text-[#14213D]">
              Need a hand?
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Create a request for shopping, pickups, deliveries,
              everyday tasks or business support.
            </p>

            <button
              type="button"
              onClick={goToPlaceRequest}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#14213D] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#203658]"
            >
              Place an errand
              <ArrowRight size={16} />
            </button>
          </article>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <ComingSoonCard
          icon={MapPin}
          title="Saved locations"
          description="Saved pickup and delivery locations will be available when location management is implemented."
          action="Coming soon"
          onClick={() =>
            toast.info("Saved locations are not available yet.")
          }
        />

        <ComingSoonCard
          icon={ShieldCheck}
          title="Your account and safety"
          description="Your account is protected by ERANDER's authentication system. We'll introduce more account-management tools as the platform develops."
          action="Learn more"
          onClick={() =>
            toast.info("Account and safety tools are being developed.")
          }
        />
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
        ERANDER · Get things done.
      </footer>
    </DashboardLayout>
  );
}