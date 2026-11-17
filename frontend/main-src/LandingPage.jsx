import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ClipboardList,
  Handshake,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  PackageCheck,
  Plus,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wallet,
  X,
  Zap,
  CircleHelp,
  MoveUpRight,
  Globe2,
} from "lucide-react";

/* =========================================================
   NAVIGATION & CONTENT
========================================================= */

const navigation = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Explore services", href: "#services" },
  { label: "Earn with us", href: "#earn" },
  { label: "FAQs", href: "#faqs" },
];

const categories = [
  {
    number: "01",
    icon: Truck,
    title: "Pickup & delivery",
    description:
      "From parcels and purchases to documents and everyday essentials.",
  },
  {
    number: "02",
    icon: Banknote,
    title: "Shopping assistance",
    description:
      "Need something sourced or purchased? Let someone handle the details.",
  },
  {
    number: "03",
    icon: Clock3,
    title: "Everyday errands",
    description:
      "Delegate the little tasks that keep taking time out of your day.",
  },
  {
    number: "04",
    icon: PackageCheck,
    title: "Returns & drop-offs",
    description:
      "Get packages returned and important items delivered where they belong.",
  },
  {
    number: "05",
    icon: MapPin,
    title: "Local assistance",
    description:
      "Find practical help from people who know your neighbourhood.",
  },
  {
    number: "06",
    icon: Sparkles,
    title: "Something different",
    description:
      "Describe what you need. Find someone whose time and skills fit.",
  },
];

const steps = [
  {
    number: "01",
    icon: ClipboardList,
    title: "Describe the task",
    description:
      "Tell us what needs doing, where it needs to happen, and when you need it done.",
  },
  {
    number: "02",
    icon: Users,
    title: "Compare your options",
    description:
      "Review offers from Eranders and choose the person who fits your needs.",
  },
  {
    number: "03",
    icon: Handshake,
    title: "Agree on the details",
    description:
      "Confirm the price, timing, and expectations before work begins.",
  },
  {
    number: "04",
    icon: CheckCircle2,
    title: "Consider it done",
    description:
      "Follow progress, confirm completion, and get on with your day.",
  },
];

const faqs = [
  {
    question: "What exactly is ERANDER?",
    answer:
      "ERANDER is an errands marketplace that connects people who need tasks completed with people willing to do them. Customers describe their needs, Eranders can submit offers, and both parties agree on the details before work begins.",
  },
  {
    question: "How much does it cost to use ERANDER?",
    answer:
      "The cost of an errand depends on the task and the agreement between the customer and the Erander. Applicable platform fees and payment terms should be clearly disclosed before a transaction is confirmed.",
  },
  {
    question: "How does ERANDER handle payments?",
    answer:
      "The platform is designed around clear agreements and accountable transactions. Specific payment-provider integrations, fund-handling arrangements, fees, and dispute procedures must be confirmed in the live product before they are advertised as available.",
  },
  {
    question: "Can I become an Erander?",
    answer:
      "Yes. The marketplace is designed to let people offer their time and skills, find suitable errands, submit offers, and earn by completing agreed tasks. Any onboarding and verification requirements will be communicated during registration.",
  },
  {
    question: "Where will ERANDER be available?",
    answer:
      "ERANDER is being developed with Nigeria as an initial market, with an architecture intended to support additional countries, languages, and currencies as the platform expands.",
  },
];

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function Logo({ light = false }) {
  return (
    <a
      href="#home"
      aria-label="ERANDER homepage"
      className="inline-flex shrink-0 items-center"
    >
      <img
        src="/images/erander-logo.png"
        alt="ERANDER"
        className={`h-9 w-auto max-w-[190px] object-contain sm:h-10 ${
          light ? "brightness-0 invert" : ""
        }`}
      />
    </a>
  );
}

function PrimaryButton({
  children,
  href = "#get-started",
  light = false,
  className = "",
}) {
  return (
    <a
      href={href}
      className={`group inline-flex min-h-[50px] items-center justify-center gap-3 rounded-full px-6 py-3 text-sm font-bold transition-all duration-200 ${
        light
          ? "bg-white text-[#14213D] hover:bg-[#E9FBF3]"
          : "bg-[#20CC88] text-[#102C28] hover:bg-[#35D07F]"
      } ${className}`}
    >
      {children}
      <ArrowUpRight
        size={17}
        className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </a>
  );
}

function TextLink({ children, href = "#", light = false }) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-2 text-sm font-bold ${
        light
          ? "text-white hover:text-[#35D07F]"
          : "text-[#14213D] hover:text-emerald-700"
      }`}
    >
      {children}
      <ArrowRight
        size={16}
        className="transition-transform group-hover:translate-x-1"
      />
    </a>
  );
}

function Eyebrow({ children, light = false }) {
  return (
    <div
      className={`mb-5 inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] ${
        light ? "text-[#35D07F]" : "text-emerald-700"
      }`}
    >
      <span
        className={`h-px w-8 ${
          light ? "bg-[#35D07F]" : "bg-emerald-700"
        }`}
      />
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  light = false,
  className = "",
}) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <Eyebrow light={light}>{eyebrow}</Eyebrow>

      <h2
        className={`text-3xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-4xl lg:text-[3.35rem] ${
          light ? "text-white" : "text-[#14213D]"
        }`}
      >
        {title}
      </h2>

      {description && (
        <p
          className={`mt-5 max-w-xl text-base leading-7 sm:text-lg sm:leading-8 ${
            light ? "text-white/65" : "text-slate-600"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   HERO MARKETPLACE PREVIEW
========================================================= */

function MarketplacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* Decorative backdrop */}
      <div className="absolute -right-8 top-10 h-64 w-64 rounded-full bg-[#20CC88]/10 blur-[80px]" />

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#101E34] shadow-2xl shadow-[#091426]/20">
        {/* Preview header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Marketplace preview
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">
              Your errands, organised.
            </h3>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#35D07F]">
            <ClipboardList size={20} />
          </div>
        </div>

        {/* Search panel */}
        <div className="px-5 pt-6 sm:px-7">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
            <MapPin size={17} className="shrink-0 text-[#35D07F]" />

            <span className="flex-1 text-sm text-white/75">
              What do you need help with?
            </span>

            <ArrowRight size={16} className="text-white/45" />
          </div>
        </div>

        {/* Task preview */}
        <div className="px-5 py-6 sm:px-7">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold text-white/55">
              AN EXAMPLE ERRAND
            </p>

            <span className="rounded-full border border-[#35D07F]/20 bg-[#35D07F]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#35D07F]">
              Illustration
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#20CC88]/10 text-[#35D07F]">
                <Package size={23} />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-white">
                  Pick up and deliver a parcel
                </h4>
                <p className="mt-1.5 text-xs leading-5 text-white/45">
                  Local delivery · Example task
                </p>
              </div>

              <ArrowUpRight
                size={17}
                className="shrink-0 text-white/35"
              />
            </div>

            <div className="my-5 h-px bg-white/10" />

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin
                  size={17}
                  className="mt-0.5 shrink-0 text-[#35D07F]"
                />

                <div>
                  <p className="text-xs font-semibold text-white">
                    Pickup and destination
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Details shared with the selected Erander
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0 text-[#35D07F]"
                />

                <div>
                  <p className="text-xs font-semibold text-white">
                    Agree before work begins
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Confirm scope, timing, and price
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle
                  size={17}
                  className="mt-0.5 shrink-0 text-[#35D07F]"
                />

                <div>
                  <p className="text-xs font-semibold text-white">
                    Keep updates together
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Follow the task from start to finish
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom action */}
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#20CC88] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#102C28]/65">
                The next step
              </p>
              <p className="mt-1 text-sm font-bold text-[#102C28]">
                Review offers from Eranders
              </p>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#102C28] text-white">
              <ArrowRight size={17} />
            </div>
          </div>
        </div>

        {/* Preview footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/50">
            <ShieldCheck size={14} className="text-[#35D07F]" />
            Built around clear agreements
          </div>

          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
            ERANDER
          </span>
        </div>
      </div>

      {/* Floating label */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="absolute -right-2 top-[22%] hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:block lg:-right-7"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E9FBF3] text-emerald-800">
            <CheckCircle2 size={19} />
          </span>

          <div>
            <p className="text-xs font-bold text-[#14213D]">
              Clear expectations
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Before the task begins
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* =========================================================
   LANDING PAGE
========================================================= */

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-[#14213D]">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Logo />

          <nav className="hidden items-center gap-8 lg:flex">
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[13px] font-semibold text-slate-600 transition-colors hover:text-[#14213D]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-6 lg:flex">
            <a
              href="/login"
              className="text-sm font-bold text-[#14213D] transition-colors hover:text-emerald-700"
            >
              Log in
            </a>

            <PrimaryButton href="/register">
              Get started
            </PrimaryButton>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((previous) => !previous)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-[#14213D] lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-slate-200 bg-white lg:hidden"
            >
              <nav className="mx-auto flex max-w-[1440px] flex-col px-5 py-4 sm:px-8">
                {navigation.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="border-b border-slate-100 py-4 text-sm font-semibold text-slate-700"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="flex gap-3 pt-5">
                  <a
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-slate-200 text-sm font-bold"
                  >
                    Log in
                  </a>

                  <PrimaryButton
                    href="/register"
                    className="flex-1"
                  >
                    Get started
                  </PrimaryButton>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* ===================================================
            HERO
        =================================================== */}

        <section
          id="home"
          className="relative overflow-hidden bg-[#F7F8F6]"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-0 top-0 h-full w-[42%] bg-[#EEF2ED]" />
            <div className="absolute -right-24 top-20 h-80 w-80 rounded-full border border-[#DDE5DD]" />
            <div className="absolute -right-12 top-32 h-56 w-56 rounded-full border border-[#DDE5DD]" />
          </div>

          <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.95fr] lg:gap-12 lg:px-12 lg:py-24 xl:gap-20 xl:py-28">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="relative z-10 max-w-2xl"
            >
              <Eyebrow>Make time for what matters</Eyebrow>

              <h1 className="text-[3.25rem] font-semibold leading-[1.02] tracking-[-0.065em] text-[#14213D] sm:text-6xl lg:text-[4.5rem] xl:text-[5.25rem]">
                Your day.
                <br />
                Your priorities.
                <br />
                <span className="text-emerald-700">
                  Our next move.
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-8">
                Life doesn't slow down. From local deliveries to everyday
                tasks, ERANDER connects you with people who can help you
                get things done.
              </p>

              <div
                id="get-started"
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <PrimaryButton href="/register">
                  Post an errand
                </PrimaryButton>

                <TextLink href="#how-it-works">
                  Discover how it works
                </TextLink>
              </div>

              <div className="mt-12 border-t border-slate-200 pt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  A better way to handle the everyday
                </p>

                <div className="mt-5 grid grid-cols-3 gap-4">
                  <div>
                    <ShieldCheck
                      size={19}
                      className="text-emerald-700"
                    />
                    <p className="mt-3 text-xs font-bold text-[#14213D] sm:text-sm">
                      Clear agreements
                    </p>
                  </div>

                  <div>
                    <MessageCircle
                      size={19}
                      className="text-emerald-700"
                    />
                    <p className="mt-3 text-xs font-bold text-[#14213D] sm:text-sm">
                      Connected updates
                    </p>
                  </div>

                  <div>
                    <Handshake
                      size={19}
                      className="text-emerald-700"
                    />
                    <p className="mt-3 text-xs font-bold text-[#14213D] sm:text-sm">
                      Better coordination
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.12 }}
              className="relative z-10"
            >
              <MarketplacePreview />
            </motion.div>
          </div>

          <div className="relative border-t border-slate-200 bg-white">
            <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-x-6 gap-y-7 px-5 py-8 sm:px-8 md:grid-cols-4 lg:px-12">
              {[
                {
                  number: "01",
                  title: "Save your time",
                  description: "Focus on what matters.",
                },
                {
                  number: "02",
                  title: "Find practical help",
                  description: "For everyday needs.",
                },
                {
                  number: "03",
                  title: "Agree with clarity",
                  description: "Know the plan upfront.",
                },
                {
                  number: "04",
                  title: "Create opportunity",
                  description: "Put your skills to work.",
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="flex items-start gap-3 sm:gap-4"
                >
                  <span className="pt-0.5 text-xs font-bold text-emerald-700">
                    {item.number}
                  </span>

                  <div>
                    <p className="text-sm font-bold text-[#14213D]">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================
            SERVICES
        =================================================== */}

        <section
          id="services"
          className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32"
        >
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <SectionHeading
                eyebrow="What we can help with"
                title={
                  <>
                    Less running around.
                    <br />
                    More living.
                  </>
                }
                description="Some things take minutes. Others take an entire afternoon. Find practical help for the errands that get in the way."
              />

              <div className="pb-2">
                <TextLink href="/register">
                  Find your next step
                </TextLink>
              </div>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => {
                const Icon = category.icon;

                return (
                  <motion.a
                    key={category.number}
                    href="/register"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.4, delay: index * 0.04 }}
                    className="group flex min-h-[240px] flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:bg-[#F7F8F6] sm:p-8 lg:min-h-[260px] lg:p-9"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-emerald-800 transition-colors group-hover:border-emerald-700 group-hover:bg-emerald-700 group-hover:text-white">
                        <Icon size={20} strokeWidth={1.7} />
                      </span>

                      <span className="text-xs font-semibold text-slate-400">
                        {category.number}
                      </span>
                    </div>

                    <h3 className="mt-8 text-lg font-semibold tracking-tight text-[#14213D]">
                      {category.title}
                    </h3>

                    <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                      {category.description}
                    </p>

                    <div className="mt-auto flex justify-end pt-5">
                      <ArrowUpRight
                        size={18}
                        className="text-slate-400 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-700"
                      />
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================
            HOW IT WORKS
        =================================================== */}

        <section
          id="how-it-works"
          className="scroll-mt-24 bg-[#14213D] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-12 lg:py-32"
        >
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
              <div>
                <SectionHeading
                  eyebrow="A simpler process"
                  title={
                    <>
                      Four steps.
                      <br />
                      One less
                      <br />
                      thing to worry about.
                    </>
                  }
                  description="A straightforward process designed to help customers and Eranders understand what's expected at every stage."
                  light
                />

                <div className="mt-9">
                  <PrimaryButton href="/register" light>
                    Get started
                  </PrimaryButton>
                </div>
              </div>

              <div className="border-t border-white/15">
                {steps.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <motion.div
                      key={step.number}
                      initial={{ opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.07 }}
                      className="grid grid-cols-[42px_1fr] gap-4 border-b border-white/15 py-7 sm:grid-cols-[56px_1fr] sm:gap-6 sm:py-8"
                    >
                      <span className="pt-1 text-sm font-semibold text-[#35D07F]">
                        {step.number}
                      </span>

                      <div>
                        <div className="flex items-center gap-3">
                          <Icon
                            size={19}
                            className="shrink-0 text-[#35D07F]"
                            strokeWidth={1.7}
                          />

                          <h3 className="text-lg font-semibold tracking-tight sm:text-xl">
                            {step.title}
                          </h3>
                        </div>

                        <p className="mt-3 max-w-lg text-sm leading-7 text-white/60">
                          {step.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            TWO AUDIENCES
        =================================================== */}

        <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1440px]">
            <SectionHeading
              eyebrow="One marketplace, two opportunities"
              title={
                <>
                  Help when you need it.
                  <br />
                  Opportunity when you give it.
                </>
              }
              description="Whether you're looking for an extra pair of hands or ready to put your time and skills to work, there's a place for you."
            />

            <div className="mt-14 grid gap-5 lg:grid-cols-2">
              {/* Customers */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 lg:p-12">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                    For customers
                  </span>

                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9FBF3] text-emerald-800">
                    <Zap size={20} />
                  </span>
                </div>

                <h3 className="mt-9 max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                  Your time is valuable. Spend it well.
                </h3>

                <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
                  Get the help you need without having to do everything
                  yourself. Describe your task, compare offers, and choose
                  the arrangement that works for you.
                </p>

                <ul className="mt-8 space-y-4">
                  {[
                    "Describe tasks in your own words",
                    "Compare offers before choosing",
                    "Keep important details together",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm font-medium text-[#14213D]"
                    >
                      <Check
                        size={17}
                        className="mt-0.5 shrink-0 text-emerald-700"
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  <TextLink href="/register">
                    Post an errand
                  </TextLink>
                </div>
              </div>

              {/* Eranders */}
              <div
                id="earn"
                className="scroll-mt-24 flex flex-col rounded-2xl border border-slate-200 bg-[#F7F8F6] p-7 sm:p-10 lg:p-12"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                    For Eranders
                  </span>

                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#14213D] text-[#35D07F]">
                    <Wallet size={20} />
                  </span>
                </div>

                <h3 className="mt-9 max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                  Put your time and skills to work.
                </h3>

                <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
                  Find tasks that suit your availability, make offers
                  that reflect the work, and build a record of completed
                  errands.
                </p>

                <ul className="mt-8 space-y-4">
                  {[
                    "Explore suitable requests",
                    "Make offers with clear pricing",
                    "Build a record of completed work",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm font-medium text-[#14213D]"
                    >
                      <Check
                        size={17}
                        className="mt-0.5 shrink-0 text-emerald-700"
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  <TextLink href="/register">
                    Become an Erander
                  </TextLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            TRUST
        =================================================== */}

        <section
          id="trust"
          className="scroll-mt-24 border-y border-slate-200 bg-[#F7F8F6] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
        >
          <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="Built around clarity"
                title={
                  <>
                    Good work
                    <br />
                    starts with
                    <br />
                    clear expectations.
                  </>
                }
                description="A better experience depends on everyone understanding the task, the agreement, and what happens next."
              />

              <p className="mt-7 max-w-md text-sm leading-7 text-slate-600">
                ERANDER is being designed to bring task details,
                communication, and completion steps into a more organised
                experience.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: "Clarity upfront",
                  description:
                    "Make the scope, timing, and agreed price clear before work starts.",
                },
                {
                  icon: MessageCircle,
                  title: "Connected communication",
                  description:
                    "Keep important messages and task updates connected to the errand.",
                },
                {
                  icon: BadgeCheck,
                  title: "Accountability",
                  description:
                    "Keep a record of what was agreed and how the task progresses.",
                },
                {
                  icon: CircleHelp,
                  title: "Room to resolve issues",
                  description:
                    "Establish clear ways to raise concerns when things don't go to plan.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9FBF3] text-emerald-700">
                      <Icon size={21} strokeWidth={1.6} />
                    </span>

                    <h3 className="mt-6 text-base font-semibold text-[#14213D]">
                      {item.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================
            FAQ
        =================================================== */}

        <section
          id="faqs"
          className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32"
        >
          <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24">
            <div>
              <SectionHeading
                eyebrow="Frequently asked questions"
                title={
                  <>
                    Before you
                    <br />
                    get started.
                  </>
                }
                description="A few useful details about the marketplace, how it works, and the opportunities it offers."
              />

              <div className="mt-8">
                <TextLink href="mailto:hello@erander.com">
                  Contact our team
                </TextLink>
              </div>
            </div>

            <div className="border-t border-slate-200">
              {faqs.map((item, index) => {
                const isOpen = activeFaq === index;

                return (
                  <div
                    key={item.question}
                    className="border-b border-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setActiveFaq(isOpen ? -1 : index)
                      }
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-5 py-6 text-left sm:py-7"
                    >
                      <span className="pr-3 text-base font-semibold leading-6 text-[#14213D] sm:text-lg">
                        {item.question}
                      </span>

                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isOpen
                            ? "border-[#14213D] bg-[#14213D] text-white"
                            : "border-slate-200 text-slate-500"
                        }`}
                      >
                        {isOpen ? (
                          <X size={15} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <p className="max-w-2xl pb-7 pr-8 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                            {item.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================
            FINAL CTA
        =================================================== */}

        <section className="px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12 lg:pb-28">
          <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-3xl bg-[#14213D] px-6 py-14 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
            <div className="pointer-events-none absolute right-0 top-0 h-full w-[45%] overflow-hidden">
              <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border border-white/10" />
              <div className="absolute -right-8 -top-12 h-64 w-64 rounded-full border border-white/10" />
              <div className="absolute bottom-[-130px] right-10 h-72 w-72 rounded-full bg-[#20CC88]/10 blur-3xl" />
            </div>

            <div className="relative grid items-end gap-9 lg:grid-cols-[1fr_auto] lg:gap-12">
              <div className="max-w-3xl">
                <Eyebrow light>Make room for what matters</Eyebrow>

                <h2 className="text-3xl font-semibold leading-[1.1] tracking-[-0.045em] text-white sm:text-4xl lg:text-[3.5rem]">
                  You have enough on your plate.
                  <span className="block text-[#35D07F]">
                    Let's get things done.
                  </span>
                </h2>

                <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base sm:leading-8">
                  Find the help you need or put your skills to work.
                  Start with one errand and see what's possible.
                </p>
              </div>

              <div className="flex flex-col items-start gap-5 lg:items-end">
                <PrimaryButton href="/register">
                  Join ERANDER
                </PrimaryButton>

                <a
                  href="/login"
                  className="text-sm font-semibold text-white/70 transition-colors hover:text-white"
                >
                  Already have an account? Log in
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="border-t border-slate-200 bg-white px-5 pb-8 pt-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-12">
            <div>
              <Logo />

              <p className="mt-5 max-w-xs text-sm leading-7 text-slate-600">
                A better way to handle everyday errands, connect with
                people, and make time for what matters.
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-500">
                <Globe2 size={15} className="text-emerald-700" />
                Built for everyday life
              </div>
            </div>

            {[
              {
                title: "Explore",
                links: [
                  ["How it works", "#how-it-works"],
                  ["Services", "#services"],
                  ["Become an Erander", "#earn"],
                ],
              },
              {
                title: "Information",
                links: [
                  ["Frequently asked questions", "#faqs"],
                  ["Safety & trust", "#trust"],
                  ["Contact", "mailto:hello@erander.com"],
                ],
              },
              {
                title: "Your account",
                links: [
                  ["Create an account", "/register"],
                  ["Log in", "/login"],
                ],
              },
            ].map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[#14213D]">
                  {group.title}
                </h3>

                <div className="mt-5 space-y-4">
                  {group.links.map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      className="block text-sm text-slate-600 transition-colors hover:text-emerald-700"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} ERANDER. All rights reserved.
            </p>

            <div className="flex gap-6">
              <a
                href="/privacy"
                className="transition-colors hover:text-[#14213D]"
              >
                Privacy
              </a>

              <a
                href="/terms"
                className="transition-colors hover:text-[#14213D]"
              >
                Terms
              </a>
            </div>

            <a
              href="#home"
              className="inline-flex items-center gap-2 font-semibold transition-colors hover:text-emerald-700"
            >
              Back to top
              <ArrowDownRight size={14} className="-rotate-45" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}