import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
  X,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  CircleHelp,
} from "lucide-react";

import { toast } from "sonner";
import { useAdminAuth } from "@/contexts/AdminAuthContext";


/* =========================================================
   NAVIGATION CONFIGURATION
========================================================= */

const NAVIGATION = [
  {
    title: "MAIN",
    items: [
      {
        label: "Overview",
        path: "/admin",
        icon: LayoutDashboard,
        permission: "dashboard:read",
        exact: true,
      },
    ],
  },

  {
    title: "MARKETPLACE",
    items: [
      {
        label: "Users",
        path: "/admin/users",
        icon: Users,
        permission: "users:read",
      },
      {
        label: "Errand monitoring",
        path: "/admin/errands",
        icon: ClipboardList,
        permission: "errands:read",
      },
      {
        label: "Disputes & support",
        path: "/admin/disputes",
        icon: AlertTriangle,
        permission: "disputes:read",
      },
      {
        label: "Verification",
        path: "/admin/verification",
        icon: BadgeCheck,
        permission: "verification:read",
      },
    ],
  },

  {
    title: "FINANCIAL OPERATIONS",
    items: [
      {
        label: "Finance",
        path: "/admin/finance",
        icon: CreditCard,
        permission: "finance:read",
      },
      {
        label: "Wallets",
        path: "/admin/wallets",
        icon: Wallet,
        permission: "wallets:read",
      },
      {
        label: "Withdrawal requests",
        path: "/admin/withdrawals",
        icon: Building2,
        permission: "withdrawals:read",
      },
      {
        label: "Security deposits",
        path: "/admin/security-deposits",
        icon: ShieldCheck,
        permission: "security_deposits:read",
      },
      {
        label: "Reconciliation",
        path: "/admin/reconciliation",
        icon: Activity,
        permission: "reconciliation:read",
      },
    ],
  },

  {
    title: "ADMINISTRATION",
    items: [
      {
        label: "Audit activity",
        path: "/admin/audit-logs",
        icon: Shield,
        permission: "audit_logs:read",
      },
      {
        label: "Settings",
        path: "/admin/settings",
        icon: Settings,
        permission: "settings:manage",
      },
    ],
  },
];


/* =========================================================
   HELPERS
========================================================= */

function canAccess(admin, permission) {
  const permissions = admin?.permissions || [];

  return (
    permission === "dashboard:read" ||
    permissions.includes("*") ||
    permissions.includes(permission)
  );
}


function readableRole(role = "administrator") {
  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}


function getAdminName(admin) {
  return (
    admin?.profile?.display_name ||
    [
      admin?.profile?.first_name,
      admin?.profile?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    admin?.email ||
    "Administrator"
  );
}


function getAdminRole(admin) {
  const roles = admin?.roles || [];

  if (!roles.length) {
    return "Administrator";
  }

  if (roles.length > 1) {
    return `${readableRole(roles[0])} +${roles.length - 1}`;
  }

  return readableRole(roles[0]);
}


function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}


/* =========================================================
   SIDEBAR NAVIGATION ITEM
========================================================= */

function SidebarItem({
  item,
  collapsed,
  onNavigate,
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.exact}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `
          group relative flex items-center
          ${collapsed ? "justify-center px-2" : "gap-3 px-3"}
          h-[43px] rounded-lg
          text-[13px] font-medium
          transition-all duration-200
          ${
            isActive
              ? "bg-[#35D07F]/15 text-white"
              : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
          }
        `
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#35D07F]" />
          )}

          <Icon
            className={`
              h-[18px] w-[18px] shrink-0
              transition-colors
              ${
                isActive
                  ? "text-[#35D07F]"
                  : "text-slate-400 group-hover:text-white"
              }
            `}
            strokeWidth={1.8}
          />

          {!collapsed && (
            <span className="flex-1 truncate">
              {item.label}
            </span>
          )}

          {!collapsed && isActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#35D07F]" />
          )}
        </>
      )}
    </NavLink>
  );
}


/* =========================================================
   SIDEBAR
========================================================= */

function AdminSidebar({
  collapsed,
  setCollapsed,
  mobile,
  closeMobile,
  admin,
  name,
  role,
  onLogout,
  loggingOut,
  navigate,
}) {
  const initials = getInitials(name);

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40
        flex flex-col
        bg-[#14213D]
        border-r border-white/[0.06]
        transition-all duration-300 ease-in-out
        ${
          mobile
            ? "w-[280px]"
            : collapsed
              ? "w-[82px]"
              : "w-[270px]"
        }
      `}
    >

      {/* BRAND */}

      <div
        className={`
          flex h-[76px] shrink-0 items-center
          border-b border-white/[0.08]
          ${
            collapsed && !mobile
              ? "justify-center px-2"
              : "justify-between px-6"
          }
        `}
      >
        <div className="flex items-center gap-3 min-w-0">

          <img
            src="/images/erander-logo.png"
            alt="ERANDER"
            className="h-9 max-w-[145px] object-contain"
          />

          {(!collapsed || mobile) && (
            <span className="rounded-md border border-[#35D07F]/20 bg-[#35D07F]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#35D07F]">
              ADMIN
            </span>
          )}

        </div>

        {mobile ? (
          <button
            onClick={closeMobile}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`
              rounded-lg p-2 text-slate-500
              hover:bg-white/10 hover:text-white
              ${collapsed ? "hidden" : ""}
            `}
            title="Collapse sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        )}

      </div>


      {/* WORKSPACE LABEL */}

      {(!collapsed || mobile) && (
        <div className="px-6 pb-2 pt-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            ADMIN WORKSPACE
          </p>
        </div>
      )}

      {!mobile && collapsed && (
        <div className="flex justify-center py-5">
          <button
            onClick={() => setCollapsed(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={18} />
          </button>
        </div>
      )}


      {/* NAVIGATION */}

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-5 pt-3 custom-scrollbar">

        {NAVIGATION.map((group) => {
          const visibleItems = group.items.filter((item) =>
            canAccess(admin, item.permission)
          );

          if (!visibleItems.length) return null;

          return (
            <div key={group.title}>

              {(!collapsed || mobile) && (
                <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  {group.title}
                </p>
              )}

              <div className="space-y-1">

                {visibleItems.map((item) => (
                  <SidebarItem
                    key={item.path}
                    item={item}
                    collapsed={collapsed && !mobile}
                    onNavigate={mobile ? closeMobile : undefined}
                  />
                ))}

              </div>

            </div>
          );
        })}

      </nav>


      {/* SIDEBAR FOOTER */}

      <div className="shrink-0 border-t border-white/[0.08] p-3">

        {(!collapsed || mobile) && (
          <div className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">

            <div className="flex items-center gap-2.5">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#35D07F]/15 text-[#35D07F]">
                <ShieldCheck size={16} />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white">
                  Secure workspace
                </p>

                <p className="mt-0.5 text-[10px] text-slate-500">
                  Restricted access
                </p>
              </div>

            </div>

          </div>
        )}

        <div
          className={`
            flex items-center gap-3 rounded-xl p-2
            ${collapsed && !mobile ? "justify-center" : ""}
          `}
        >

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-xs font-bold text-white">
            {initials}
          </div>

          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {name}
              </p>

              <p className="mt-0.5 truncate text-[10px] text-slate-400">
                {role}
              </p>
            </div>
          )}

        </div>

        <button
          onClick={() => {
            navigate("/dashboard");
            closeMobile?.();
          }}
          className={`
            mt-2 flex h-10 w-full items-center gap-3
            rounded-lg px-3 text-xs font-medium
            text-slate-400 transition
            hover:bg-white/[0.06] hover:text-white
            ${collapsed && !mobile ? "justify-center px-2" : ""}
          `}
          title="Return to user workspace"
        >
          <ArrowLeft size={17} />

          {(!collapsed || mobile) && (
            <span>Return to user workspace</span>
          )}
        </button>

      </div>

    </aside>
  );
}


/* =========================================================
   ADMIN LAYOUT
========================================================= */

export default function AdminLayout() {

  const { admin, signOut } = useAdminAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const name = getAdminName(admin);
  const role = getAdminRole(admin);
  const initials = getInitials(name);


  /* CURRENT PAGE */

  const currentPage = useMemo(() => {
    const allItems = NAVIGATION.flatMap((group) => group.items);

    return (
      allItems.find((item) =>
        item.exact
          ? location.pathname === item.path
          : location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`)
      ) || {
        label: "Administration",
        path: "/admin",
      }
    );
  }, [location.pathname]);


  /* LOGOUT */

  async function logout() {
    setLoggingOut(true);

    try {
      await signOut();

      toast.success("Signed out of the admin workspace.");

      navigate("/admin/login", {
        replace: true,
      });

    } catch (error) {
      toast.error(error.message || "Unable to sign out.");

    } finally {
      setLoggingOut(false);
      setAccountOpen(false);
    }
  }


  return (

    <div className="min-h-screen bg-[#F5F7FA] text-slate-800">

      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}

      <div className="hidden lg:block">

        <AdminSidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobile={false}
          admin={admin}
          name={name}
          role={role}
          navigate={navigate}
          onLogout={logout}
          loggingOut={loggingOut}
        />

      </div>


      {/* =====================================================
          MOBILE SIDEBAR
      ===================================================== */}

      {mobileOpen && (

        <div className="fixed inset-0 z-50 lg:hidden">

          <button
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            aria-label="Close navigation"
          />

          <AdminSidebar
            collapsed={false}
            setCollapsed={() => {}}
            mobile={true}
            closeMobile={() => setMobileOpen(false)}
            admin={admin}
            name={name}
            role={role}
            navigate={navigate}
            onLogout={logout}
            loggingOut={loggingOut}
          />

        </div>

      )}


      {/* =====================================================
          MAIN APPLICATION
      ===================================================== */}

      <div
        className={`
          min-h-screen transition-[padding] duration-300
          ${collapsed ? "lg:pl-[82px]" : "lg:pl-[270px]"}
        `}
      >

        {/* ===================================================
            TOPBAR
        =================================================== */}

        <header className="sticky top-0 z-30 h-[76px] border-b border-slate-200/80 bg-white">

          <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">

            {/* LEFT */}

            <div className="flex min-w-0 items-center gap-3">

              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={21} />
              </button>

              <div className="min-w-0">

                <div className="mb-1 hidden items-center gap-2 text-[10px] font-medium text-slate-400 sm:flex">

                  <span>ERANDER</span>

                  <ChevronRight size={12} />

                  <span>Admin</span>

                  <ChevronRight size={12} />

                  <span className="text-slate-600">
                    {currentPage.label}
                  </span>

                </div>

                <h1 className="truncate text-[15px] font-bold tracking-tight text-[#14213D] sm:text-base">
                  {currentPage.label}
                </h1>

              </div>

            </div>


            {/* RIGHT */}

            <div className="flex items-center gap-2 sm:gap-4">

              {/* ENVIRONMENT STATUS */}

              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 md:flex">

                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>

                <span className="text-[10px] font-semibold text-emerald-700">
                  Admin workspace
                </span>

              </div>


              {/* NOTIFICATIONS */}

              <button
                onClick={() =>
                  toast.info("You are all caught up.")
                }
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-[#14213D]"
              >
                <Bell size={19} strokeWidth={1.8} />

                <span className="absolute right-[9px] top-[9px] h-2 w-2 rounded-full border-2 border-white bg-[#35D07F]" />
              </button>


              <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />


              {/* ADMIN ACCOUNT */}

              <div className="relative">

                <button
                  onClick={() => setAccountOpen((value) => !value)}
                  className="flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-slate-50 sm:gap-3 sm:px-2"
                >

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#14213D] text-xs font-bold text-white shadow-sm">
                    {initials}
                  </div>

                  <div className="hidden min-w-0 text-left sm:block">

                    <p className="max-w-[150px] truncate text-xs font-semibold text-slate-800">
                      {name}
                    </p>

                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {role}
                    </p>

                  </div>

                  <ChevronDown
                    size={15}
                    className="hidden text-slate-400 sm:block"
                  />

                </button>


                {/* ACCOUNT DROPDOWN */}

                {accountOpen && (

                  <>
                    <button
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setAccountOpen(false)}
                      aria-label="Close account menu"
                    />

                    <div className="absolute right-0 top-full z-50 mt-3 w-[270px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">

                      <div className="border-b border-slate-100 bg-slate-50/70 p-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14213D] text-sm font-bold text-white">
                            {initials}
                          </div>

                          <div className="min-w-0">

                            <p className="truncate text-sm font-semibold text-slate-800">
                              {name}
                            </p>

                            <p className="truncate text-[11px] text-slate-500">
                              {admin?.email}
                            </p>

                          </div>

                        </div>

                        <div className="mt-3">

                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">

                            <ShieldCheck size={12} />

                            {role}

                          </span>

                        </div>

                      </div>


                      <div className="p-2">

                        <button
                          onClick={() => {
                            setAccountOpen(false);
                            navigate("/admin/settings");
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#14213D]"
                        >
                          <Settings size={16} />
                          Account settings
                        </button>

                        <button
                          onClick={() => {
                            setAccountOpen(false);
                            toast.info("Contact your system administrator for assistance.");
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#14213D]"
                        >
                          <CircleHelp size={16} />
                          Help & support
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        <button
                          disabled={loggingOut}
                          onClick={logout}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          <LogOut size={16} />

                          {loggingOut
                            ? "Signing out..."
                            : "Sign out"}
                        </button>

                      </div>

                    </div>

                  </>
                )}

              </div>

            </div>

          </div>

        </header>


        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <main className="min-h-[calc(100vh-76px)]">

          <div className="mx-auto w-full max-w-[1800px] p-4 sm:p-6 lg:p-8">

            <Outlet />

          </div>

        </main>


        {/* ===================================================
            FOOTER
        =================================================== */}

        <footer className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8">

          <div className="flex flex-col items-center justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">

            <p>
              © {new Date().getFullYear()} ERANDER. All rights reserved.
            </p>

            <p className="font-medium">
              Administrative Control Panel
            </p>

          </div>

        </footer>

      </div>

    </div>

  );
}