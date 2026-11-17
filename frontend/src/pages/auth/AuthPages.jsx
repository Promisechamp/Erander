import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/services/api";
import {
	ArrowLeft,
	ArrowRight,
	Eye,
	EyeOff,
	Check,
	CheckCircle2,
	LockKeyhole,
	Mail,
	UserRound,
	Phone,
	BriefcaseBusiness,
	Building2,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

/*

* ERANDER authentication pages
* Uses the existing /images/erander-logo.png asset.
* Does not create a second logo or redraw the brand mark.
* 
* Design system:
* Navy:       #14213D
* Green:      #20CC88
* Mint:       #35D07F
* Soft mint:  #E8FBF0
* Background: #F8FAFC
* Body:       #17202E
* Muted:      #64748B
* Border:     #E2E8F0
* 
* Routes:
* /login
* /register
  */

const AUTH = {
	navy: "var(--erander-navy, #14213D)",
	green: "var(--erander-green, #20CC88)",
	mint: "var(--erander-mint, #35D07F)",
	pale: "var(--erander-pale, #E8FBF0)",
	background: "var(--erander-off-white, #F8FAFC)",
	white: "var(--erander-white, #FFFFFF)",
	text: "var(--erander-text, #17202E)",
	muted: "var(--erander-muted, #64748B)",
	border: "var(--erander-border, #E2E8F0)",
};

const inputClass =
	"block w-full rounded-xl border bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

function BrandLogo() {
	return (
		<Link
			to="/"
			aria-label="ERANDER home"
			className="inline-flex rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
			style={{ outlineColor: AUTH.green }}
		>
			<img
				src="/images/erander-logo.png"
				alt="ERANDER"
				width="160"
				height="48"
				className="h-11 w-auto max-w-[180px] object-contain object-left"
			/>
		</Link>
	);
}

function AuthInput({
	label,
	name,
	type = "text",
	placeholder,
	icon: Icon,
	autoComplete,
	value,
	onChange,
	required = true,
	suffix,
	error,
}) {
	return (
		<div>
			<label
				htmlFor={name}
				className="mb-2 block text-sm font-bold"
				style={{ color: AUTH.navy }}
			>
				{label}
			</label>

			<div className="relative">
				<Icon
					size={18}
					aria-hidden="true"
					className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
					style={{ color: AUTH.muted }}
				/>

				<input
					id={name}
					name={name}
					type={type}
					placeholder={placeholder}
					autoComplete={autoComplete}
					value={value}
					onChange={onChange}
					required={required}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? `${name}-error` : undefined}
					className={`${inputClass} ${suffix ? "pr-12" : ""}`}
					style={{
						borderColor: error ? "#DC2626" : AUTH.border,
						color: AUTH.text,
					}}
				/>

				{suffix}
			</div>

			{error && (
				<p
					id={`${name}-error`}
					role="alert"
					className="mt-1.5 text-xs text-red-600"
				>
					{error}
				</p>
			)}
		</div>
	);
}

function PasswordInput({
	label = "Password",
	name = "password",
	value,
	onChange,
	autoComplete = "current-password",
	error,
	hint,
}) {
	const [visible, setVisible] = useState(false);

	return (
		<AuthInput
			label={label}
			name={name}
			type={visible ? "text" : "password"}
			placeholder="Enter your password"
			icon={LockKeyhole}
			autoComplete={autoComplete}
			value={value}
			onChange={onChange}
			error={error}
			suffix={
				<button
					type="button"
					onClick={() => setVisible((current) => !current)}
					aria-label={visible ? "Hide password" : "Show password"}
					aria-pressed={visible}
					className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2"
					style={{ color: AUTH.muted, outlineColor: AUTH.green }}
				>
					{visible ? (
						<EyeOff size={18} aria-hidden="true" />
					) : (
						<Eye size={18} aria-hidden="true" />
					)}
				</button>
			}
		/>
	);
}

function AuthButton({ children, loading = false }) {
	return (
		<button
			type="submit"
			disabled={loading}
			className="group flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-extrabold transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
			style={{
				backgroundColor: AUTH.green,
				color: AUTH.navy,
				outlineColor: AUTH.green,
			}}
		>
			{loading ? "Please wait..." : children}

			{!loading && (
				<ArrowRight
					size={17}
					aria-hidden="true"
					className="transition-transform group-hover:translate-x-1"
				/>
			)}
		</button>
	);
}

function AuthLayout({ children, variant = "login" }) {
	const reduceMotion = useReducedMotion();
	const isRegister = variant === "register";

	return (
		<main
			className="min-h-screen"
			style={{
				backgroundColor: AUTH.background,
				color: AUTH.text,
				fontFamily: "var(--font-erander, 'Manrope', sans-serif)",
			}}
		>
			<div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
				{/* Brand panel */}
				<aside
					className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
					style={{ backgroundColor: AUTH.navy }}
				>
					<div
						className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full blur-3xl"
						style={{ backgroundColor: "rgba(53,208,127,0.12)" }}
						aria-hidden="true"
					/>

					<div
						className="pointer-events-none absolute -bottom-36 -left-24 h-96 w-96 rounded-full blur-3xl"
						style={{ backgroundColor: "rgba(32,204,136,0.10)" }}
						aria-hidden="true"
					/>

					<div className="relative z-10">
						<BrandLogo />
					</div>

					<motion.div
						initial={reduceMotion ? false : { opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45 }}
						className="relative z-10 my-12 max-w-xl"
					>
						<div
							className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold"
							style={{
								borderColor: "rgba(255,255,255,0.16)",
								backgroundColor: "rgba(255,255,255,0.05)",
								color: AUTH.mint,
							}}
						>
							<Sparkles size={15} aria-hidden="true" />
							{isRegister ? "Your next chapter starts here" : "Good to have you back"}
						</div>

						<h1 className="text-4xl font-extrabold leading-[1.12] tracking-[-0.055em] text-white xl:text-6xl">
							{isRegister ? (
								<>
									Make room for
									<br />
									<span style={{ color: AUTH.mint }}>what matters.</span>
								</>
							) : (
								<>
									Your day.
									<br />
									Your priorities.
									<br />
									<span style={{ color: AUTH.mint }}>Let’s get moving.</span>
								</>
							)}
						</h1>

						<p className="mt-6 max-w-md text-base leading-8 text-slate-300">
							{isRegister
								? "Join a marketplace that connects people who need a hand with people ready to help."
								: "Pick up where you left off. Your errands and next steps are waiting for you."}
						</p>

						<div className="mt-10 space-y-4">
							{[
								"Everyday errands, one platform",
								"Clear expectations before you commit",
								"A marketplace built around people",
							].map((item) => (
								<div key={item} className="flex items-center gap-3">
									<span
										className="flex h-6 w-6 items-center justify-center rounded-full"
										style={{
											backgroundColor: "rgba(53,208,127,0.14)",
											color: AUTH.mint,
										}}
									>
										<Check size={14} aria-hidden="true" />
									</span>

									<span className="text-sm font-semibold text-slate-200">{item}</span>
								</div>
							))}
						</div>
					</motion.div>

					<div className="relative z-10 border-t border-white/10 pt-6">
						<p className="text-xs text-slate-400">
							© {new Date().getFullYear()} ERANDER. Get things done.
						</p>
					</div>
				</aside>

				{/* Form panel */}
				<section className="flex min-h-screen flex-col">
					<div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end lg:px-12">
						<div className="lg:hidden">
							<BrandLogo />
						</div>

						<Link
							to="/"
							className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
							style={{ color: AUTH.muted, outlineColor: AUTH.green }}
						>
							<ArrowLeft size={16} aria-hidden="true" />
							<span className="hidden sm:inline">Back to home</span>
							<span className="sm:hidden">Home</span>
						</Link>
					</div>

					<div className="flex flex-1 items-center justify-center px-5 pb-12 pt-5 sm:px-8 lg:px-12 lg:py-10">
						<motion.div
							initial={reduceMotion ? false : { opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.35 }}
							className="w-full max-w-[440px]"
						>
							{children}
						</motion.div>
					</div>

					<div className="px-5 pb-6 text-center sm:px-8">
						<p className="text-xs leading-5" style={{ color: AUTH.muted }}>
							By continuing, you agree to ERANDER’s{" "}
							<Link
								to="/terms"
								className="font-bold underline underline-offset-4"
								style={{ color: AUTH.navy }}
							>
								Terms
							</Link>{" "}
							and{" "}
							<Link
								to="/privacy"
								className="font-bold underline underline-offset-4"
								style={{ color: AUTH.navy }}
							>
								Privacy Policy
							</Link>
							.
						</p>
					</div>
				</section>
			</div>
		</main>
	);
}

function FormHeading({ eyebrow, title, description }) {
	return (
		<div className="mb-8">
			<p
				className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em]"
				style={{ color: "#159B65" }}
			>
				{eyebrow}
			</p>

			<h2
				className="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
				style={{ color: AUTH.navy }}
			>
				{title}
			</h2>

			<p className="mt-3 text-sm leading-6" style={{ color: AUTH.muted }}>
				{description}
			</p>
		</div>
	);
}

/* ---------------------------------------------
LOGIN PAGE
---------------------------------------------- */

export function LoginPage() {
	const { signIn } = useAuth();
	const [form, setForm] = useState({
		email: "",
		password: "",
		remember: true,
	});

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();

	function updateField(event) {
		const { name, value, checked, type } = event.target;

		setForm((current) => ({
			...current,
			[name]: type === "checkbox" ? checked : value,
		}));
	}

	async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (loading) return;
    setLoading(true);

    try {
      await signIn({
        email: form.email.trim(),
        password: form.password,
        remember: form.remember,
      });

      toast.success("Welcome back to ERANDER!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = err.message || "Unable to sign in. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }



	return (
		<AuthLayout variant="login">
			<FormHeading
				eyebrow="Welcome back"
				title="Sign in to ERANDER"
				description="Enter your details to continue to your account."
			/>

			{error && (
				<div
					role="alert"
					className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
				>
					{error}
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-5">
				<AuthInput
					label="Email address"
					name="email"
					type="email"
					placeholder="you@example.com"
					icon={Mail}
					autoComplete="email"
					value={form.email}
					onChange={updateField}
				/>

				<div>
					<PasswordInput
						name="password"
						value={form.password}
						onChange={updateField}
					/>

					<div className="mt-3 flex items-center justify-between gap-3">
						<label className="flex cursor-pointer items-center gap-2.5 text-sm">
							<input
								type="checkbox"
								name="remember"
								checked={form.remember}
								onChange={updateField}
								className="h-4 w-4 rounded accent-emerald-600"
							/>
							<span style={{ color: AUTH.muted }}>Remember me</span>
						</label>

						<Link
							to="/forgot-password"
							className="text-sm font-extrabold hover:underline"
							style={{ color: "#159B65" }}
						>
							Forgot password?
						</Link>
					</div>
				</div>

				<div className="pt-2">
					<AuthButton loading={loading}>Sign in</AuthButton>
				</div>
			</form>

			<div className="my-7 flex items-center gap-4">
				<div className="h-px flex-1" style={{ backgroundColor: AUTH.border }} />
				<span className="text-xs font-semibold" style={{ color: AUTH.muted }}>
					NEW TO ERANDER?
				</span>
				<div className="h-px flex-1" style={{ backgroundColor: AUTH.border }} />
			</div>

			<Link
				to="/register"
				className="flex min-h-12 w-full items-center justify-center rounded-xl border bg-white px-5 py-3 text-sm font-extrabold transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
				style={{
					borderColor: AUTH.border,
					color: AUTH.navy,
					outlineColor: AUTH.green,
				}}
			>
				Create an account
			</Link>

			<div
				className="mt-8 flex items-start gap-3 rounded-2xl p-4"
				style={{ backgroundColor: AUTH.pale }}
			>
				<ShieldCheck
					size={19}
					className="mt-0.5 shrink-0"
					style={{ color: AUTH.navy }}
					aria-hidden="true"
				/>
				<p className="text-xs leading-5" style={{ color: AUTH.muted }}>
					Keep your account credentials private. ERANDER will never ask you to share
					your password with another user.
				</p>
			</div>
		</AuthLayout>
	);
}

/* ---------------------------------------------
REGISTER PAGE
---------------------------------------------- */

export function RegisterPage() {
	const navigate = useNavigate();
	const [form, setForm] = useState({
		firstName: "",
		lastName: "",
		email: "",
		phone: "",
		password: "",
		role: "customer",
		acceptTerms: false,
	});

	const [loading, setLoading] = useState(false);

	function updateField(event) {
		const { name, value, checked, type } = event.target;

		setForm((current) => ({
			...current,
			[name]: type === "checkbox" ? checked : value,
		}));
	}

	async function handleSubmit(event) {
  event.preventDefault();

  if (!form.acceptTerms) {
    toast.error("Please agree to the Terms and Privacy Policy to continue.");
    return;
  }

  if (loading) return;

  setLoading(true);

  try {
    const result = await apiRequest("/auth/register", {
      method: "POST",
      body: {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: form.role,
      },
    });

    toast.success(
      result.message || "Registration successful. Please check your email.",
    );
  } catch (error) {
    toast.error(error.message || "Registration failed. Please try again.");
  } finally {
    setLoading(false);
  }
}




	return (
		<AuthLayout variant="register">
			<FormHeading
				eyebrow="Join the marketplace"
				title="Create your account"
				description="Choose whether you want to post errands, perform errands, or do both with one personal account."
			/>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<AuthInput
						label="First name"
						name="firstName"
						placeholder="First name"
						icon={UserRound}
						autoComplete="given-name"
						value={form.firstName}
						onChange={updateField}
					/>

					<AuthInput
						label="Last name"
						name="lastName"
						placeholder="Last name"
						icon={UserRound}
						autoComplete="family-name"
						value={form.lastName}
						onChange={updateField}
					/>
				</div>

				<AuthInput
					label="Email address"
					name="email"
					type="email"
					placeholder="you@example.com"
					icon={Mail}
					autoComplete="email"
					value={form.email}
					onChange={updateField}
				/>

				<AuthInput
					label="Phone number"
					name="phone"
					type="tel"
					placeholder="e.g. 080 1234 5678"
					icon={Phone}
					autoComplete="tel"
					value={form.phone}
					onChange={updateField}
				/>

				<PasswordInput
					label="Create password"
					name="password"
					value={form.password}
					onChange={updateField}
					autoComplete="new-password"
				/>

				<fieldset>
					<legend className="mb-3 text-sm font-bold" style={{ color: AUTH.navy }}>
						Choose your personal account access
					</legend>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{[
							{
								value: "customer",
								title: "I need help",
								description: "Post and manage errands",
								icon: UserRound,
							},
							{
								value: "erander",
								title: "I want to help",
								description: "Apply to perform errands",
								icon: BriefcaseBusiness,
							},
							{
								value: "both",
								title: "Both customer and erander",
								description: "Post errands and perform errands with one account",
								icon: Check,
							},
						].map(({ value, title, description, icon: Icon }) => {
							const selected = form.role === value;

							return (
								<label
									key={value}
									className="relative flex cursor-pointer flex-col rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-emerald-500/10"
									style={{
										borderColor: selected ? AUTH.green : AUTH.border,
										backgroundColor: selected ? AUTH.pale : AUTH.white,
									}}
								>
									<input
										type="radio"
										name="role"
										value={value}
										checked={selected}
										onChange={updateField}
										className="sr-only"
									/>
									<div className="flex items-center justify-between gap-2">
										<Icon size={21} style={{ color: AUTH.navy }} aria-hidden="true" />
										{selected && <CheckCircle2 size={18} style={{ color: "#159B65" }} aria-hidden="true" />}
									</div>
									<span className="mt-4 text-sm font-extrabold" style={{ color: AUTH.navy }}>{title}</span>
									<span className="mt-1 text-xs leading-5" style={{ color: AUTH.muted }}>{description}</span>
								</label>
							);
						})}
						<button
							type="button"
							onClick={() => navigate("/business/register")}
							className="relative flex cursor-pointer flex-col rounded-2xl border p-4 text-left transition hover:border-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
							style={{ borderColor: AUTH.border, backgroundColor: AUTH.white, outlineColor: AUTH.green }}
						>
							<div className="flex items-center justify-between gap-2">
								<Building2 size={21} style={{ color: AUTH.navy }} aria-hidden="true" />
								<ArrowRight size={17} style={{ color: AUTH.green }} aria-hidden="true" />
							</div>
							<span className="mt-4 text-sm font-extrabold" style={{ color: AUTH.navy }}>Register a business</span>
							<span className="mt-1 text-xs leading-5" style={{ color: AUTH.muted }}>Create a separate business identity and register its owner.</span>
						</button>
					</div>
				</fieldset>

				<label className="flex cursor-pointer items-start gap-3 py-1">
					<input
						type="checkbox"
						name="acceptTerms"
						checked={form.acceptTerms}
						onChange={updateField}
						className="mt-1 h-4 w-4 shrink-0 rounded accent-emerald-600"
					/>

					<span className="text-xs leading-5" style={{ color: AUTH.muted }}>
						I agree to the{" "}
						<Link
							to="/terms"
							className="font-extrabold underline underline-offset-4"
							style={{ color: AUTH.navy }}
						>
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link
							to="/privacy"
							className="font-extrabold underline underline-offset-4"
							style={{ color: AUTH.navy }}
						>
							Privacy Policy
						</Link>
						.
					</span>
				</label>

				<div className="pt-1">
					<AuthButton loading={loading}>Create account</AuthButton>
				</div>
			</form>

			<p className="mt-6 text-center text-sm" style={{ color: AUTH.muted }}>
				Already have an account?{" "}
				<Link
					to="/login"
					className="font-extrabold hover:underline"
					style={{ color: "#159B65" }}
				>
					Sign in
				</Link>
			</p>
		</AuthLayout>
	);
}
