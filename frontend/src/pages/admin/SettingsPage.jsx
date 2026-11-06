import { AlertTriangle, Database, ShieldCheck } from "lucide-react";
export default function AdminSettingsPage() {
	return (
		<div className="space-y-6">
			<header>
				<p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">
					ERANDER administration
				</p>
				<h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#14213D] sm:text-3xl">
					Platform settings
				</h1>
				<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
					Platform-wide configuration and operational policy.
				</p>
			</header>
			<section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
				<div className="flex items-start gap-3">
					<AlertTriangle className="mt-0.5 shrink-0 text-amber-700" />
					<div>
						<h2 className="font-extrabold text-amber-950">
							Settings storage is not present in the supplied schema
						</h2>
						<p className="mt-2 text-sm leading-6 text-amber-900">
							There is no versioned platform-settings table or settings API in the
							current ERANDER database export. I have not added fake browser-only
							controls that would appear to save settings but would not persist them.
						</p>
					</div>
				</div>
			</section>
			<div className="grid gap-4 md:grid-cols-2">
				<article className="rounded-2xl border border-slate-200 bg-white p-5">
					<Database size={20} className="text-slate-500" />
					<h3 className="mt-3 font-extrabold text-[#14213D]">
						Versioned configuration
					</h3>
					<p className="mt-2 text-sm leading-6 text-slate-500">
						Platform fees, category availability, limits, currencies and country-level
						configuration need a validated versioned data model.
					</p>
				</article>
				<article className="rounded-2xl border border-slate-200 bg-white p-5">
					<ShieldCheck size={20} className="text-slate-500" />
					<h3 className="mt-3 font-extrabold text-[#14213D]">
						Approval and audit trail
					</h3>
					<p className="mt-2 text-sm leading-6 text-slate-500">
						Settings changes that affect live transactions need validation, change
						preview, actor attribution and immutable audit history.
					</p>
				</article>
			</div>
		</div>
	);
}
