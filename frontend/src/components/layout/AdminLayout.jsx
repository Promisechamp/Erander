import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CornerDownLeft,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
		Ticket,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAdminAuth } from "@/contexts/AdminAuthContext";

/* -------------------------------------------------------------------------- */
/*                                 NAVIGATION                                 */
/* -------------------------------------------------------------------------- */

const NAVIGATION = [
  {
    title: "Main",
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
    title: "Marketplace",
    items: [
      { label: "Users", path: "/admin/users", icon: Users, permission: "users:read" },
      {
        label: "Errand monitoring",
        path: "/admin/errands",
        icon: ClipboardList,
        permission: "errands:read",
      },
      {
        label: "Chat monitoring", path: "/admin/chats", icon: MessageCircle, permission: "chats:read",
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
    title: "Financial operations",
    items: [
      { label: "Finance", path: "/admin/finance", icon: CreditCard, permission: "finance:read" },
      { label: "Wallets", path: "/admin/wallets", icon: Wallet, permission: "wallets:read" },
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
						
						{
        label: "Supports",
        path: "/admin/support",
        icon: Ticket,
        permission: "support:read",
      },
						
    ],
  },
  {
    title: "Administration",
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

const SIDEBAR_KEY = "erander.admin.sidebarRail";
const GROUPS_KEY = "erander.admin.sidebarClosedGroups";

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getAdminName(admin) {
  return (
    admin?.profile?.display_name ||
    [admin?.profile?.first_name, admin?.profile?.last_name]
      .filter(Boolean)
      .join(" ") ||
    admin?.email ||
    "Administrator"
  );
}

function getAdminRole(admin) {
  const roles = admin?.roles || [];

  if (!roles.length) return "Administrator";
  if (roles.length > 1) return `${readableRole(roles[0])} +${roles.length - 1}`;

  return readableRole(roles[0]);
}

function getInitials(name) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A"
  );
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

function useIsDesktop() {
  const query = "(min-width: 1024px)";

  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : true
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const media = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    setMatches(media.matches);

    if (media.addEventListener) media.addEventListener("change", handler);
    else media.addListener(handler);

    return () => {
      if (media.removeEventListener) media.removeEventListener("change", handler);
      else media.removeListener(handler);
    };
  }, []);

  return matches;
}

function useOutsideClose(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, open, onClose]);
}

/* -------------------------------------------------------------------------- */
/*                                SIDEBAR PARTS                               */
/* -------------------------------------------------------------------------- */

function SidebarItem({ item, compact, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.exact}
      onClick={onNavigate}
      title={compact ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex h-10 items-center rounded-lg text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          compact ? "justify-center px-0" : "gap-3 px-3"
        } ${
          isActive
            ? "bg-surface-muted text-content"
            : "text-content-muted hover:bg-surface-muted hover:text-content"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span
              aria-hidden="true"
              className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-brand"
            />
          ) : null}

          <Icon
            size={18}
            strokeWidth={1.9}
            aria-hidden="true"
            className={`shrink-0 transition-colors ${
              isActive
                ? "text-brand"
                : "text-content-subtle group-hover:text-content-muted"
            }`}
          />

          {!compact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
        </>
      )}
    </NavLink>
  );
}

function SidebarBody({
  compact,
  mobile,
  admin,
  name,
  role,
  initials,
  onClose,
  onToggleRail,
  onNavigate,
  onReturn,
  onLogout,
}) {
  const [closedGroups, setClosedGroups] = useState(() => readJson(GROUPS_KEY, []));

  const toggleGroup = (title) =>
    setClosedGroups((previous) => {
      const next = previous.includes(title)
        ? previous.filter((item) => item !== title)
        : [...previous, title];

      writeJson(GROUPS_KEY, next);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Brand */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-line ${
          compact ? "justify-center px-2" : "justify-between px-5"
        }`}
      >
        {compact ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-extrabold text-white">
            E
          </span>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            {/* Note: swap for a dark-on-light logo variant if the current
                image is designed for the previous dark sidebar. */}
            <img
              src="/images/erander-logo.png"
              alt="ERANDER"
              className="h-8 max-w-[130px] object-contain"
            />
            <span className="rounded-md bg-brand-pale px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-brand">
              Admin
            </span>
          </div>
        )}

        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X size={19} aria-hidden="true" />
          </button>
        ) : !compact ? (
          <button
            type="button"
            onClick={onToggleRail}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="rounded-lg p-2 text-content-subtle transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <PanelLeftClose size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Admin navigation"
        className={`min-h-0 flex-1 space-y-5 overflow-y-auto py-4 [scrollbar-width:thin] ${
          compact ? "px-3" : "px-4"
        }`}
      >
        {NAVIGATION.map((group) => {
          const visible = group.items.filter((item) =>
            canAccess(admin, item.permission)
          );

          if (!visible.length) return null;

          const collapsed = !compact && closedGroups.includes(group.title);

          return (
            <div key={group.title}>
              {compact ? (
                <div aria-hidden="true" className="mx-2 mb-2 h-px bg-line" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={!collapsed}
                  className="mb-1.5 flex w-full items-center justify-between rounded-md px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-content-subtle transition hover:text-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {group.title}
                  <ChevronDown
                    size={12}
                    aria-hidden="true"
                    className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
                  />
                </button>
              )}

              {!collapsed ? (
                <div className="space-y-1">
                  {visible.map((item) => (
                    <SidebarItem
                      key={item.path}
                      item={item}
                      compact={compact}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`shrink-0 border-t border-line ${compact ? "p-3" : "p-4"}`}>
        <div
          className={`flex items-center rounded-xl ${
            compact ? "justify-center" : "gap-3 bg-surface-muted p-2.5"
          }`}
        >
          <span
            title={compact ? name : undefined}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-xs font-extrabold text-brand"
          >
            {initials}
          </span>

          {!compact ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-content">{name}</p>
                <p className="truncate text-[11px] text-content-muted">{role}</p>
              </div>

              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign out"
                title="Sign out"
                className="rounded-lg p-2 text-content-subtle transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onReturn}
          title={compact ? "Return to user workspace" : undefined}
          className={`mt-2 flex h-10 w-full items-center rounded-lg text-xs font-semibold text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            compact ? "justify-center" : "gap-3 px-3"
          }`}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {!compact ? (
            "Return to user workspace"
          ) : (
            <span className="sr-only">Return to user workspace</span>
          )}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              COMMAND PALETTE                               */
/* -------------------------------------------------------------------------- */

function CommandPalette({ open, onClose, items, onSelect }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();

    return items.filter(
      (item) =>
        !text ||
        item.label.toLowerCase().includes(text) ||
        item.group.toLowerCase().includes(text)
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 5000);
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((value) => (results.length ? (value + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((value) =>
        results.length ? (value - 1 + results.length) % results.length : 0
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (results[index]) onSelect(results[index]);
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search admin pages"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-surface-white shadow-[0_24px_70px_rgba(9,20,38,0.35)]"
      >
        <div className="flex items-center gap-3 border-b border-line-soft px-4">
          <Search size={17} className="shrink-0 text-content-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page"
            aria-label="Search pages"
            className="h-14 min-w-0 flex-1 bg-transparent text-sm font-medium text-content outline-none placeholder:text-content-subtle"
          />
          <kbd className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-content-muted">
            Esc
          </kbd>
        </div>

        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-content-muted">
              No pages match “{query}”.
            </li>
          ) : (
            results.map((item, position) => {
              const Icon = item.icon;
              const active = position === index;

              return (
                <li key={item.path} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    ref={(element) => {
                      if (active) element?.scrollIntoView?.({ block: "nearest" });
                    }}
                    onMouseEnter={() => setIndex(position)}
                    onClick={() => onSelect(item)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      active ? "bg-brand text-white" : "text-content hover:bg-surface-muted"
                    }`}
                  >
                    <Icon
                      size={17}
                      aria-hidden="true"
                      className={active ? "text-brand-mint" : "text-content-muted"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{item.label}</span>
                      <span
                        className={`block text-[11px] ${
                          active ? "text-white/70" : "text-content-subtle"
                        }`}
                      >
                        {item.group}
                      </span>
                    </span>
                    {active ? (
                      <CornerDownLeft size={14} aria-hidden="true" className="text-white/70" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   LAYOUT                                   */
/* -------------------------------------------------------------------------- */

export default function AdminLayout() {
  const { admin, signOut } = useAdminAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  const [rail, setRail] = useState(() => readJson(SIDEBAR_KEY, false));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const accountRef = useRef(null);

  const name = getAdminName(admin);
  const role = getAdminRole(admin);
  const initials = getInitials(name);

  const closeAccount = useCallback(() => setAccountOpen(false), []);
  useOutsideClose(accountRef, accountOpen, closeAccount);

  const toggleRail = useCallback(() => {
    setRail((previous) => {
      const next = !previous;
      writeJson(SIDEBAR_KEY, next);
      return next;
    });
  }, []);

  /* Pages the signed-in admin can open */
  const pages = useMemo(
    () =>
      NAVIGATION.flatMap((group) =>
        group.items
          .filter((item) => canAccess(admin, item.permission))
          .map((item) => ({ ...item, group: group.title }))
      ),
    [admin]
  );

  /* Longest matching path wins, so /admin/users/123 maps to Users */
  const currentPage = useMemo(() => {
    const matches = pages.filter((item) =>
      item.exact
        ? location.pathname === item.path
        : location.pathname === item.path ||
          location.pathname.startsWith(`${item.path}/`)
    );

    return (
      matches.sort((a, b) => b.path.length - a.path.length)[0] || {
        label: "Administration",
        path: "/admin",
        group: "Admin",
      }
    );
  }, [pages, location.pathname]);

  /* Route changes: close drawer, reset scroll, update tab title */
  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    document.title = `${currentPage.label} · ERANDER Admin`;
  }, [currentPage.label]);

  /* Lock page scroll while the mobile drawer is open */
  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  /* Leaving the phone layout closes the drawer */
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  /* Shortcuts: Ctrl/Cmd+K opens search, [ toggles the sidebar */
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }

      if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey)
        return;

      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (event.target?.isContentEditable) return;

      if (window.matchMedia?.("(min-width: 1024px)").matches) toggleRail();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleRail]);

  async function logout() {
    setLoggingOut(true);

    try {
      await signOut();
      toast.success("Signed out of the admin workspace.");
      navigate("/admin/login", { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to sign out.");
    } finally {
      setLoggingOut(false);
      setAccountOpen(false);
    }
  }

  const sidebarProps = {
    admin,
    name,
    role,
    initials,
    onToggleRail: toggleRail,
    onReturn: () => navigate("/dashboard"),
    onLogout: logout,
  };

  return (
    <div className="min-h-screen bg-surface-muted/40 text-content">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar: part of the layout, pushes the page */}
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-white transition-[width] duration-300 ease-in-out lg:block ${
          rail ? "w-[76px]" : "w-[272px]"
        }`}
      >
        <SidebarBody {...sidebarProps} compact={rail} mobile={false} />
      </aside>

      {/* Mobile drawer overlay */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-label="Navigation drawer"
        aria-hidden={!mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[288px] max-w-[85vw] bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-in-out lg:hidden ${
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <SidebarBody
          {...sidebarProps}
          compact={false}
          mobile
          onClose={() => setMobileOpen(false)}
          onNavigate={() => setMobileOpen(false)}
          onReturn={() => {
            setMobileOpen(false);
            navigate("/dashboard");
          }}
        />
      </aside>

      {/* Content column: padding follows the sidebar width */}
      <div
        className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-in-out ${
          rail ? "lg:pl-[76px]" : "lg:pl-[272px]"
        }`}
      >
        <header className="sticky top-0 z-30 h-16 border-b border-line bg-surface-white/85 backdrop-blur">
          <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="rounded-xl p-2 text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
              >
                <Menu size={21} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={toggleRail}
                aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
                title={`${rail ? "Expand" : "Collapse"} sidebar  [`}
                className="hidden rounded-xl p-2 text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:inline-flex"
              >
                {rail ? (
                  <PanelLeftOpen size={19} aria-hidden="true" />
                ) : (
                  <PanelLeftClose size={19} aria-hidden="true" />
                )}
              </button>

              <div className="min-w-0">
                <nav
                  aria-label="Breadcrumb"
                  className="hidden items-center gap-1.5 text-[11px] font-medium text-content-subtle sm:flex"
                >
                  <span>ERANDER</span>
                  <ChevronRight size={11} aria-hidden="true" />
                  <span>Admin</span>
                  {currentPage.path !== "/admin" ? (
                    <>
                      <ChevronRight size={11} aria-hidden="true" />
                      <span className="text-content-muted">{currentPage.group}</span>
                    </>
                  ) : null}
                </nav>

                <h1 className="truncate text-[15px] font-extrabold tracking-tight text-content sm:text-base">
                  {currentPage.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search pages"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface-white px-3 text-sm text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:w-56 md:justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <Search size={16} aria-hidden="true" />
                  <span className="hidden md:inline">Search pages</span>
                </span>
                <kbd className="hidden rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold md:inline">
                  Ctrl K
                </kbd>
              </button>

              <div className="hidden items-center gap-2 rounded-full bg-brand-pale px-3 py-2 xl:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                <span className="text-[11px] font-bold text-success-dark">
                  Secure session
                </span>
              </div>

              <button
                type="button"
                onClick={() => toast.info("You are all caught up.")}
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-content-muted transition hover:bg-surface-muted hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Bell size={19} strokeWidth={1.8} aria-hidden="true" />
              </button>

              <div className="mx-1 hidden h-7 w-px bg-line sm:block" />

              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((value) => !value)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2.5 rounded-full p-1 transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:pr-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-brand-mint">
                    {initials}
                  </span>

                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block max-w-[140px] truncate text-xs font-bold text-content">
                      {name}
                    </span>
                    <span className="block text-[10px] text-content-muted">{role}</span>
                  </span>

                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className="hidden text-content-subtle sm:block"
                  />
                </button>

                {accountOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-[270px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface-white shadow-[0_16px_45px_rgba(9,20,38,0.16)]"
                  >
                    <div className="border-b border-line-soft bg-surface-muted/60 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-brand-mint">
                          {initials}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-content">{name}</p>
                          <p className="truncate text-[11px] text-content-muted">
                            {admin?.email}
                          </p>
                        </div>
                      </div>

                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-pale px-2.5 py-1 text-[10px] font-bold text-success-dark">
                        <ShieldCheck size={12} aria-hidden="true" />
                        {role}
                      </span>
                    </div>

                    <div className="p-2">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate("/admin/settings");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-content-muted transition hover:bg-surface-muted hover:text-content"
                      >
                        <Settings size={16} aria-hidden="true" />
                        Account settings
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          toast.info("Contact your system administrator for assistance.");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-content-muted transition hover:bg-surface-muted hover:text-content"
                      >
                        <CircleHelp size={16} aria-hidden="true" />
                        Help & support
                      </button>

                      <div className="my-1 border-t border-line-soft" />

                      <button
                        type="button"
                        role="menuitem"
                        disabled={loggingOut}
                        onClick={logout}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        <LogOut size={16} aria-hidden="true" />
                        {loggingOut ? "Signing out" : "Sign out"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1800px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-line bg-surface-white px-5 py-4 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-content-subtle sm:flex-row">
            <p>© {new Date().getFullYear()} ERANDER. All rights reserved.</p>
            <p className="font-semibold">Administrative control panel</p>
          </div>
        </footer>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={pages}
        onSelect={(item) => {
          setPaletteOpen(false);
          navigate(item.path);
        }}
      />
    </div>
  );
}