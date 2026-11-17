import { useState } from "react";
import {
NavLink,
useNavigate,
Outlet,
} from "react-router-dom";
import { toast } from "sonner";

import {
LayoutDashboard,
ClipboardList,
ShoppingCart,
Search,
Plus,
UserRound,
Menu,
X,
LogOut,
ChevronDown,
ShieldCheck,
MessageCircle,
Wallet,
Shield,
Heart,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";

const navigationItems = [
{
label: "Dashboard",
path: "/dashboard",
icon: LayoutDashboard,
end: true,
},
{
label: "Available errands",
path: "/dashboard/available-errands",
icon: Search,
},
{
label: "My errands",
path: "/dashboard/erands",
icon: ClipboardList,
},
{
label: "My offers",
path: "/dashboard/my-offers",
icon: ShoppingCart,
},
{
label: "Favorite erranders",
path: "/dashboard/favorite-erranders",
icon: Heart,
},
{
label: "Messages",
path: "/chat",
icon: MessageCircle,
},
{
label: "My wallet",
path: "/dashboard/wallet",
icon: Wallet,
},
{
label: "Place an errand",
path: "/dashboard/erands/new",
icon: Plus,
},
{
label: "My profile",
path: "/dashboard/profile",
icon: UserRound,
},
];

export default function DashboardLayout({ children, title = "Dashboard", description = "Manage your activities on ERANDER." }) {
const navigate = useNavigate();
const { user, signOut } = useAuth();

const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const [accountMenuOpen, setAccountMenuOpen] = useState(false);
const [signingOut, setSigningOut] = useState(false);

const firstName =
user?.user_metadata?.first_name ||
user?.first_name ||
user?.email?.split("@")[0] ||
"there";

const roles = [
...(Array.isArray(user?.app_metadata?.roles)
? user.app_metadata.roles
: []),
...(Array.isArray(user?.user_metadata?.roles)
? user.user_metadata.roles
: []),
user?.app_metadata?.role,
user?.user_metadata?.role,
].filter(Boolean);

const admin = roles.some((role) =>
[
"super_admin",
"admin",
"finance_admin",
"support_admin",
"trust_safety_admin",
"verification_admin",
"operations_admin",
"read_only_auditor",
].includes(String(role).toLowerCase())
);

async function handleLogout() {
if (signingOut) return;

setSigningOut(true);

try {
  await signOut();

  toast.success("You've signed out successfully.");

  navigate("/login", { replace: true });
} catch (error) {
  toast.error(
    error?.message || "Unable to sign out successfully."
  );
} finally {
  setSigningOut(false);
}

}

function closeMobileMenu() {
setMobileMenuOpen(false);
}

function renderNavigation() {
return navigationItems.map((item) => {
const Icon = item.icon;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.end}
      onClick={closeMobileMenu}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
          isActive
            ? "bg-[#E9FBF3] text-[#14213D]"
            : "text-slate-500 hover:bg-slate-50 hover:text-[#14213D]"
        }`
      }
    >
      <Icon size={19} />

      <span>{item.label}</span>

      {item.path === "/dashboard/erands/new" && (
        <span className="ml-auto rounded-lg bg-[#20CC88] px-2 py-1 text-xs font-bold text-[#14213D]">
          New
        </span>
      )}
    </NavLink>
  );
});

}

return (
<div className="min-h-screen bg-[#F8FAFC] text-[#14213D]">
{/* Desktop sidebar */}
<aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
<NavLink
to="/"
className="flex h-20 items-center border-b border-slate-100 px-7"
>
<img
src="/images/erander-logo.png"
alt="ERANDER"
className="h-10 w-auto object-contain"
/>
</NavLink>

    <div className="px-5 pt-7">
      <p className="mb-3 px-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
        Workspace
      </p>

      <nav className="space-y-1">
        {renderNavigation()}
      </nav>

      {admin && (
        <div className="mt-7 border-t border-slate-100 pt-5">
          <p className="mb-3 px-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
            Administration
          </p>

          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-[#14213D] hover:bg-[#E9FBF3]"
          >
            <Shield
              size={18}
              className="text-[#16864B]"
            />

            Admin workspace
          </button>
        </div>
      )}
    </div>

    <div className="mt-auto p-5">
      <div className="rounded-2xl bg-[#14213D] p-5 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#35D07F]">
          <ShieldCheck size={21} />
        </div>

        <h3 className="mt-4 text-sm font-bold">
          Errands made simpler
        </h3>

        <p className="mt-2 text-xs leading-5 text-slate-300">
          Manage your requests and keep track of your errand
          activity in one place.
        </p>
      </div>

      <p className="mt-5 px-2 text-[11px] text-slate-400">
        ERANDER · Get things done.
      </p>
    </div>
  </aside>

  {/* Main workspace */}
  <div className="min-h-screen lg:pl-64">
    {/* Header */}
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label={
              mobileMenuOpen
                ? "Close navigation"
                : "Open navigation"
            }
            aria-expanded={mobileMenuOpen}
            onClick={() =>
              setMobileMenuOpen((open) => !open)
            }
            className="rounded-xl border border-slate-200 p-2.5 text-[#14213D] hover:bg-slate-50 lg:hidden"
          >
            {mobileMenuOpen ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold text-[#14213D] sm:text-xl">
              {title}
            </h1>

            <p className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">
              {description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationBell />

          <div className="relative">
            <button
              type="button"
              aria-expanded={accountMenuOpen}
              onClick={() =>
                setAccountMenuOpen((open) => !open)
              }
              className="flex items-center gap-2 rounded-xl border border-slate-200 p-1.5 pr-2.5 transition hover:bg-slate-50 sm:gap-3 sm:pr-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E9FBF3] text-sm font-extrabold text-[#16864B]">
                {firstName.charAt(0).toUpperCase()}
              </span>

              <span className="hidden max-w-28 truncate text-left text-sm font-bold sm:block">
                {firstName}
              </span>

              <ChevronDown
                size={15}
                className="text-slate-400"
              />
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="truncate text-sm font-bold">
                    {firstName}
                  </p>

                  <p className="mt-1 truncate text-xs text-slate-500">
                    {user?.email || "Your ERANDER account"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    navigate("/dashboard/profile");
                  }}
                  className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <UserRound size={17} />
                  My profile
                </button>

                <button
                  type="button"
                  disabled={signingOut}
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  <LogOut size={17} />

                  {signingOut
                    ? "Signing out..."
                    : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* Mobile navigation */}
    {mobileMenuOpen && (
      <div className="fixed inset-0 top-20 z-30 lg:hidden">
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileMenu}
          className="absolute inset-0 bg-[#14213D]/30"
        />

        <aside className="relative h-full w-[min(19rem,85vw)] overflow-y-auto border-r border-slate-200 bg-white p-5 shadow-xl">
          <p className="mb-4 px-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {renderNavigation()}
          </nav>

          {admin && (
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                navigate("/admin");
              }}
              className="mt-5 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold"
            >
              <Shield size={18} />
              Admin workspace
            </button>
          )}

          <button
            type="button"
            disabled={signingOut}
            onClick={handleLogout}
            className="mt-8 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut size={19} />

            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </aside>
      </div>
    )}

    {/* Nested dashboard pages render here */}
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
				  {children ?? <Outlet />}
    </main>
  </div>
</div>

);
}