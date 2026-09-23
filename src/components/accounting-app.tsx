"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Bell, BookOpen, ChevronDown, ChevronRight, CircleHelp, FileBarChart2, LayoutDashboard, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, Target, Users, WalletCards, X } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { initials } from "@/components/finance-ui";
import DashboardView from "@/components/dashboard-view";
import { AccountsView, BudgetsView, TransactionsView } from "@/components/records-views";
import { AuditView, ReportsView, SettingsView, TeamView } from "@/components/admin-views";
import ActionModal from "@/components/action-modals";

type Section = "dashboard" | "transactions" | "accounts" | "budgets" | "reports" | "audit" | "team" | "settings";
type ModalKind = "transaction" | "account" | "budget" | "user";
const primaryNav: { key: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "transactions", label: "Transactions", icon: WalletCards },
  { key: "accounts", label: "Chart of accounts", icon: BookOpen },
  { key: "budgets", label: "Budget monitoring", icon: Target },
  { key: "reports", label: "Financial reports", icon: FileBarChart2 },
];
const governanceNav: { key: Section; label: string; icon: typeof Activity }[] = [
  { key: "audit", label: "Audit trail", icon: Activity },
  { key: "team", label: "Team & access", icon: Users },
  { key: "settings", label: "Settings", icon: Settings2 },
];
const sectionNames: Record<Section, string> = { dashboard: "Overview", transactions: "Transactions", accounts: "Chart of accounts", budgets: "Budget monitoring", reports: "Financial reports", audit: "Audit trail", team: "Team & access", settings: "Settings" };

export default function AccountingApp({ initialData }: { initialData: Snapshot }) {
  const [data, setData] = useState(initialData);
  const [section, setSection] = useState<Section>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [budgetAccountId, setBudgetAccountId] = useState<string | undefined>();
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace(/^#\/?/, "") as Section;
      if (hash in sectionNames && !(hash === "team" && data.user.role !== "admin")) setSection(hash);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [data.user.role]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 5000); return () => window.clearTimeout(timer); }, [toast]);

  function navigate(next: Section) {
    if (next === "team" && data.user.role !== "admin") return;
    setSection(next); setMobileOpen(false); setShowNotifications(false); setShowUserMenu(false);
    if (next !== "transactions") setGlobalSearch("");
    window.history.pushState(null, "", next === "dashboard" ? "/" : `/#/${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openTransaction() {
    if (data.user.role === "viewer") { setToast({ message: "Your role has read-only access.", error: true }); return; }
    setModal("transaction");
  }
  const runAction = useCallback(async (payload: Record<string, unknown>): Promise<boolean> => {
    setWorking(true);
    try {
      const response = await fetch("/api/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (response.status === 401) { window.location.assign("/"); return false; }
      if (!response.ok) throw new Error(result.error || "The action could not be completed.");
      setToast({ message: result.message || "Changes saved successfully.", error: false });
      if (result.signOut) { window.location.assign("/"); return true; }
      const refreshed = await fetch("/api/ledger", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Saved, but couldn't refresh the page. Please reload.");
      setData(await refreshed.json());
      return true;
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Something went wrong. Please try again.", error: true });
      return false;
    } finally { setWorking(false); }
  }, []);
  async function signOut() {
    setShowUserMenu(false);
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.assign("/");
  }
  const budgetAlerts = data.budgets.filter((item) => item.utilization >= 85);
  const alertCount = budgetAlerts.length + (data.dashboard.draftCount ? 1 : 0);
  const navItem = (item: (typeof primaryNav)[number]) => <button key={item.key} className={`sidebar-link ${section === item.key ? "active" : ""}`} onClick={() => navigate(item.key)}><item.icon size={19} strokeWidth={1.85} /><span>{item.label}</span>{item.key === "transactions" && data.dashboard.draftCount > 0 && <span className="sidebar-count">{data.dashboard.draftCount}</span>}</button>;

  return <div className="app-shell">
    {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><div className="sidebar-brand-mark"><img src="/icons/upec-mark.svg" alt="UPEC emblem" /></div><div><strong>UPEC<span>.</span></strong><small>ACCOUNTING SOFTWARE</small></div><button className="sidebar-mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <div className="sidebar-org"><span className="sidebar-org-icon"><ShieldCheck size={16} /></span><div><strong>UNIPORT</strong><small>Entrepreneurial Centre</small></div><ChevronDown size={14} /></div>
      <div className="sidebar-nav-scroll"><nav aria-label="Main navigation"><div className="sidebar-group-label">WORKSPACE</div>{primaryNav.map(navItem)}<div className="sidebar-group-label governance-label">GOVERNANCE</div>{governanceNav.filter((item) => item.key !== "team" || data.user.role === "admin").map(navItem)}</nav></div>
      <div className="sidebar-bottom"><div className="sidebar-help"><span className="sidebar-help-icon"><CircleHelp size={19} /></span><strong>Finance desk</strong><p>Working with UPEC numbers? Your records are right here.</p><button onClick={() => navigate("reports")}>Explore reports <ChevronRight size={14} /></button></div><div className="sidebar-bottom-footer"><span className="sidebar-status-dot" /> VOTE HEAD 520 <span>·</span> FY {data.fiscalYear}</div></div>
    </aside>

    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={22} /></button><div className="breadcrumbs"><span>UPEC Finance</span><ChevronRight size={15} /><strong>{sectionNames[section]}</strong></div></div><div className="topbar-right"><div className="global-search"><Search size={18} /><input aria-label="Search all transactions" placeholder="Search transactions..." value={globalSearch} onFocus={() => { if (section !== "transactions") navigate("transactions"); }} onChange={(event) => { setGlobalSearch(event.target.value); if (section !== "transactions") navigate("transactions"); }} />{globalSearch ? <button aria-label="Clear search" onClick={() => setGlobalSearch("")}><X size={15} /></button> : <kbd>⌘ K</kbd>}</div><div className="topbar-divider" /><span className="topbar-fy">FY {data.fiscalYear}</span><div className="topbar-popover-anchor"><button className={`topbar-icon-button ${showNotifications ? "pressed" : ""}`} aria-label="Notifications" onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}><Bell size={20} />{alertCount > 0 && <span className="notification-dot" />}</button>{showNotifications && <div className="header-popover notification-popover"><div className="popover-title">Notifications <span>{alertCount}</span></div>{budgetAlerts.length ? budgetAlerts.slice(0, 4).map((item) => <button key={item.accountId} onClick={() => navigate("budgets")}><span className="popover-icon warning"><Target size={17} /></span><span><strong>{item.accountName}</strong><small>{item.utilization.toFixed(0)}% of allocation used</small></span></button>) : null}{data.dashboard.draftCount > 0 && <button onClick={() => navigate("transactions")}><span className="popover-icon blue"><FileBarChart2 size={17} /></span><span><strong>{data.dashboard.draftCount} draft {data.dashboard.draftCount === 1 ? "entry" : "entries"}</strong><small>Ready for review and posting</small></span></button>}{!alertCount && <div className="popover-empty">You're all caught up. No new alerts.</div>}</div>}</div><div className="topbar-popover-anchor"><button className="profile-button" onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }} aria-label="Open profile menu"><span className="profile-avatar">{initials(data.user.fullName)}</span><span className="profile-info"><strong>{data.user.fullName}</strong><small>{data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1)}</small></span><ChevronDown size={15} /></button>{showUserMenu && <div className="header-popover user-popover"><div className="popover-user"><strong>{data.user.fullName}</strong><span>{data.user.email}</span></div><button onClick={() => navigate("settings")}><Settings2 size={17} /> Account settings</button><button onClick={signOut}><LogOut size={17} /> Sign out</button></div>}</div></div></header>
      <main className="content-area"><div className="content-inner">{section === "dashboard" && <DashboardView data={data} onNavigate={navigate} onNewTransaction={openTransaction} />}{section === "transactions" && <TransactionsView data={data} searchTerm={globalSearch} onNew={openTransaction} onAction={runAction} working={working} />}{section === "accounts" && <AccountsView data={data} onAdd={() => setModal("account")} />}{section === "budgets" && <BudgetsView data={data} onEdit={(accountId) => { setBudgetAccountId(accountId); setModal("budget"); }} />}{section === "reports" && <ReportsView data={data} />}{section === "audit" && <AuditView data={data} />}{section === "team" && data.user.role === "admin" && <TeamView data={data} onAdd={() => setModal("user")} onAction={runAction} working={working} />}{section === "settings" && <SettingsView data={data} onAction={runAction} working={working} />}<footer className="workspace-footer"><span>© {data.fiscalYear} UPEC Accounting Software</span><span>University of Port Harcourt Entrepreneurial Centre · Choba, Port Harcourt</span></footer></div></main></div>
    {modal && <ActionModal kind={modal} data={data} budgetAccountId={budgetAccountId} onClose={() => setModal(null)} onAction={runAction} working={working} />}
    {toast && <div className={`app-toast ${toast.error ? "toast-error" : ""}`} role="status"><span>{toast.error ? <X size={18} /> : <ShieldCheck size={18} />}</span>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>;
}
