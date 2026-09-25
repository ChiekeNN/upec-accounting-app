"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowDownToLine, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, CircleAlert, ClipboardList, Download, FileBarChart2, FileSpreadsheet, FileText, Fingerprint, KeyRound, Landmark, LockKeyhole, MonitorSmartphone, PencilLine, Plus, Printer, Search, Shield, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import type { Role, Snapshot } from "@/lib/types";
import { roleDescription, roleLabel, roleSummary } from "@/lib/roles";
import { buildReport, type ReportType } from "@/lib/reporting";
import { EmptyState, formatDateTime, formatMoney, initials, PageIntro, reportUrl } from "@/components/finance-ui";
import type { InstallWindow } from "@/components/pwa-register";

type Action = (payload: Record<string, unknown>) => Promise<boolean>;
const reportOptions: { key: ReportType; label: string; description: string; icon: typeof FileText }[] = [
  { key: "income", label: "Income statement", description: "Revenue and expenditure", icon: FileBarChart2 },
  { key: "budget", label: "Budget vs actual", description: "Allocation performance", icon: Wallet },
  { key: "trial", label: "Trial balance", description: "Account balances", icon: FileSpreadsheet },
  { key: "ledger", label: "General ledger", description: "Every journal line", icon: BookOpen },
  { key: "transactions", label: "Transaction register", description: "All recorded entries", icon: ClipboardList },
];

export function ReportsView({ data }: { data: Snapshot }) {
  const [kind, setKind] = useState<ReportType>("income");
  const [from, setFrom] = useState(`${data.fiscalYear}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const validRange = !!from && !!to && from <= to;
  const result = useMemo(() => buildReport(data, kind, from, to), [data, kind, from, to]);
  return <div className="reports-page"><PageIntro eyebrow="INSIGHTS  /  FINANCIAL REPORTS" title="Financial reports" subtitle="Turn your financial records into clear, decision-ready insight." actions={<><button className="btn btn-secondary" onClick={() => window.print()}><Printer size={17} /> Print report</button><a className={`btn btn-primary ${!validRange ? "disabled-link" : ""}`} href={validRange ? reportUrl(kind, from, to) : undefined} aria-disabled={!validRange}><Download size={17} /> Export CSV</a></>} />
    <div className="report-picker">{reportOptions.map((option) => <button className={`report-choice ${kind === option.key ? "selected" : ""}`} key={option.key} onClick={() => setKind(option.key)}><span className="report-choice-icon"><option.icon size={21} /></span><strong>{option.label}</strong><small>{option.description}</small></button>)}</div>
    <section className="panel report-controls"><div><CalendarDays size={19} /><div><strong>Reporting period</strong><span>{kind === "budget" ? `Budget figures cover FY ${data.fiscalYear}` : "Select dates to filter posted journal entries"}</span></div></div><div className="date-controls"><label>From <input aria-label="Report start date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={kind === "budget"} /></label><span>to</span><label>To <input aria-label="Report end date" type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={kind === "budget"} /></label></div></section>
    {!validRange && kind !== "budget" && <div className="form-alert">End date must be on or after the start date.</div>}
    <section className="panel report-document print-report"><div className="report-letterhead"><div className="report-letterhead-left"><img src="/icons/upec-mark.svg" alt="UPEC" /><div><strong>UNIVERSITY OF PORT HARCOURT</strong><span>ENTREPRENEURIAL CENTRE · UPEC</span></div></div><span className="report-vote">VOTE HEAD<br /><strong>520</strong></span></div><div className="report-title-block"><div><span>FINANCIAL REPORT</span><h2>{result.title}</h2><p>{result.subtitle}</p></div><div className="report-generated"><span>PREPARED ON</span><strong>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</strong><small>All amounts in Nigerian Naira (NGN)</small></div></div><div className="report-table-wrap"><table className="report-table"><thead><tr>{result.columns.map((column, index) => <th className={result.numericColumns.includes(index) ? "align-right" : ""} key={`${column}-${index}`}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => { const isHeading = row[1] === "OPERATING INCOME" || row[1] === "OPERATING EXPENDITURE"; const isTotal = ["TOTAL", "Total operating income", "Total operating expenditure", "NET OPERATING SURPLUS / (DEFICIT)"].includes(String(row[1])) || row[2] === "TOTAL"; return <tr key={index} className={isHeading ? "report-section-row" : isTotal ? "report-total-row" : ""}>{row.map((value, cellIndex) => <td key={cellIndex} className={result.numericColumns.includes(cellIndex) ? "align-right" : ""}>{typeof value === "number" && result.numericColumns.includes(cellIndex) ? formatMoney(value, 2) : String(value || (value === 0 ? "0" : ""))}</td>)}</tr>; })}</tbody></table>{result.total === 0 && <EmptyState icon={<FileText size={24} />} title="No records in this period" description="Try a wider date range or record a transaction first." />}</div><div className="report-document-footer"><span>Generated by UPEC Accounting Software</span><span>Confidential · For authorised use only</span></div></section>
    <div className="report-bottom-hint"><ShieldCheck size={18} /> Reports are generated from posted ledger entries. Draft transactions are excluded from financial statements.</div>
  </div>;
}

export function AuditView({ data }: { data: Snapshot }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = data.audits.filter((item) => (filter === "all" || item.entity === filter) && (!search || `${item.actorName} ${item.action} ${item.details} ${item.entityId}`.toLowerCase().includes(search.toLowerCase())));
  return <div><PageIntro eyebrow="GOVERNANCE  /  AUDIT TRAIL" title="Audit trail" subtitle="An accountable, timestamped record of important actions across the workspace." />
    <div className="audit-intro"><span><Fingerprint size={22} /></span><div><strong>Every important action, accounted for.</strong><p>Entries are immutable in the application. Posted transactions are reversed—not deleted—to preserve financial history.</p></div><span className="audit-intro-tag"><ShieldCheck size={15} /> MONITORED</span></div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-toolbar-heading"><h2>Activity history</h2><span className="count-badge">{filtered.length}</span></div><div className="table-filters"><div className="search-field"><Search size={17} /><input aria-label="Search audit history" placeholder="Search activity..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="select-wrap"><select aria-label="Filter audit entity" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All activity</option><option value="transaction">Transactions</option><option value="budget">Budgets</option><option value="account">Accounts</option><option value="user">Users</option><option value="system">System</option></select><ChevronDown size={14} /></div></div></div><div className="table-scroll"><table className="data-table audit-table"><thead><tr><th>Event</th><th>Details</th><th>Performed by</th><th>Date & time</th><th>Entity</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><div className="audit-event"><span><Activity size={17} /></span><strong>{item.action.replaceAll(".", " · ").replaceAll("_", " ")}</strong></div></td><td className="muted-cell audit-detail-cell">{item.details || "—"}</td><td><span className="audit-actor"><span>{initials(item.actorName)}</span>{item.actorName}</span></td><td className="muted-cell">{formatDateTime(item.createdAt)}</td><td><span className="entity-tag">{item.entity}</span></td></tr>)}</tbody></table>{!filtered.length && <EmptyState icon={<Activity size={25} />} title="No activity found" description="Try a different keyword or activity filter." />}</div></section>
  </div>;
}

const roleCards: { role: Role; icon: typeof ShieldCheck }[] = [
  { role: "admin", icon: ShieldCheck },
  { role: "director", icon: Landmark },
  { role: "finance_officer", icon: FileSpreadsheet },
  { role: "viewer", icon: UserRound },
];
export function TeamView({ data, onAdd, onAction, working }: { data: Snapshot; onAdd: () => void; onAction: Action; working: boolean }) {
  return <div><PageIntro eyebrow="ADMINISTRATION  /  TEAM ACCESS" title="Team & permissions" subtitle="The right access for the right people, with clear accountability." actions={<button className="btn btn-primary" onClick={onAdd}><Plus size={18} /> Add team member</button>} />
    <div className="team-roles">{roleCards.map(({ role, icon: Icon }) => <div key={role}><span className={`team-role-icon ${role}`}><Icon size={20} /></span><strong>{roleLabel[role]}</strong><p>{roleSummary[role]}</p></div>)}</div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-toolbar-heading"><h2>Workspace members</h2><span className="count-badge">{data.users.length}</span></div><span className="table-subtle"><Users size={16} /> Role-based access</span></div><div className="table-scroll"><table className="data-table team-table"><thead><tr><th>Team member</th><th>Role</th><th>Access</th><th>Joined</th><th>Status</th><th className="align-right">Action</th></tr></thead><tbody>{data.users.map((member) => <tr key={member.id}><td><div className="team-person"><span>{initials(member.fullName)}</span><div><strong>{member.fullName}{member.id === data.user.id && <em>you</em>}</strong><small>{member.email}</small></div></div></td><td><span className={`role-pill role-${member.role}`}>{roleLabel[member.role]}</span></td><td className="muted-cell role-description">{roleDescription[member.role]}</td><td className="muted-cell">{new Date(member.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td><td><span className={`member-status ${member.isActive ? "enabled" : "disabled"}`}><span />{member.isActive ? "Active" : "Inactive"}</span></td><td className="align-right">{member.id !== data.user.id && <button disabled={working} className="table-link" onClick={() => onAction({ action: "toggleUser", id: member.id })}>{member.isActive ? "Deactivate" : "Activate"}</button>}</td></tr>)}</tbody></table></div></section>
    <div className="team-note"><LockKeyhole size={17} /> Deactivating a member immediately revokes their active sessions. All historical entries retain their attribution.</div>
  </div>;
}

/**
 * Self-service name correction. Rendered with `key={currentName}` by its parent so
 * a successful save remounts the card with the stored value instead of syncing
 * local state inside an effect.
 */
function ProfileDetailsCard({ currentName, onAction, working }: { currentName: string; onAction: Action; working: boolean }) {
  const [fullName, setFullName] = useState(currentName);
  const unchanged = !fullName.trim() || fullName.trim() === currentName;
  async function updateProfile(event: FormEvent) {
    event.preventDefault();
    await onAction({ action: "updateProfile", fullName: fullName.trim() });
  }
  return <section className="panel settings-card"><div className="settings-card-header"><span className="settings-header-icon green"><PencilLine size={21} /></span><div><h2>Your details</h2><p>Correct your name as it appears on records and in the audit trail</p></div></div><form className="settings-password-form" onSubmit={updateProfile}><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={160} placeholder="Your full name" required /></label><p>Your email address and access role are managed by an Administrator under Team &amp; access.</p><button className="btn btn-primary" type="submit" disabled={working || unchanged}>{working ? "Saving..." : "Save details"}<ArrowRight size={17} /></button></form></section>;
}

export function SettingsView({ data, onAction, working }: { data: Snapshot; onAction: Action; working: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [installable, setInstallable] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  useEffect(() => {
    const update = () => setInstallable(!!(window as InstallWindow).upecInstallPrompt);
    update(); window.addEventListener("upec:installable", update);
    return () => window.removeEventListener("upec:installable", update);
  }, []);
  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (await onAction({ action: "changePassword", currentPassword, newPassword })) { setCurrentPassword(""); setNewPassword(""); }
  }

  async function installApp() {
    const prompt = (window as InstallWindow).upecInstallPrompt;
    if (prompt) { await prompt.prompt(); const choice = await prompt.userChoice; setInstallMessage(choice.outcome === "accepted" ? "App installation started." : "You can install later from your browser menu."); (window as InstallWindow).upecInstallPrompt = undefined; setInstallable(false); }
    else setInstallMessage("Use your browser menu and choose ‘Install app’ or ‘Add to Home Screen’. On iPhone, tap Share then Add to Home Screen.");
  }
  return <div><PageIntro eyebrow="WORKSPACE  /  SETTINGS" title="Settings" subtitle="Manage your profile, security and institutional workspace details." />
    <div className="settings-grid"><div className="settings-main"><section className="panel settings-card"><div className="settings-card-header"><span className="settings-header-icon blue"><UserRound size={21} /></span><div><h2>Your profile</h2><p>Your identity in the UPEC accounting workspace</p></div></div><div className="settings-profile"><span className="settings-avatar">{initials(data.user.fullName)}</span><div><strong>{data.user.fullName}</strong><span>{data.user.email}</span><small>{roleLabel[data.user.role]} access</small></div></div></section>
      <ProfileDetailsCard key={data.user.fullName} currentName={data.user.fullName} onAction={onAction} working={working} />
      <section className="panel settings-card"><div className="settings-card-header"><span className="settings-header-icon purple"><KeyRound size={21} /></span><div><h2>Change password</h2><p>Keep your account protected with a strong password</p></div></div><form className="settings-password-form" onSubmit={updatePassword}><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Enter current password" required /></label><label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Create a strong password" minLength={10} required /></label><p>Use at least 10 characters with uppercase, lowercase, a number and a symbol. You will sign in again after updating.</p><button className="btn btn-primary" type="submit" disabled={working}>{working ? "Updating..." : "Update password"}<ArrowRight size={17} /></button></form></section></div>
      <div className="settings-side"><section className="panel settings-card"><div className="settings-card-header"><span className="settings-header-icon green"><Landmark size={21} /></span><div><h2>Institution</h2><p>Workspace information</p></div></div><div className="settings-details"><div><span>Organisation</span><strong>UPEC</strong></div><div><span>Parent institution</span><strong>University of Port Harcourt</strong></div><div><span>Location</span><strong>Choba, Port Harcourt, Rivers State</strong></div><div><span>Accounting / Vote Head</span><strong>520</strong></div><div><span>Financial year</span><strong>{data.fiscalYear}</strong></div><div><span>Base currency</span><strong>Nigerian Naira (NGN)</strong></div></div></section>
      <section className="panel settings-card install-card"><div className="settings-card-header"><span className="settings-header-icon blue"><MonitorSmartphone size={21} /></span><div><h2>Install on your device</h2><p>Access UPEC from your home screen</p></div></div><p>Install this secure web app on desktop, tablet or mobile for a focused, app-like experience.</p><button className="btn btn-secondary full-width" onClick={installApp}><ArrowDownToLine size={17} /> {installable ? "Install UPEC Accounting" : "How to install"}</button>{installMessage && <div className="install-message">{installMessage}</div>}</section>
      <div className="settings-security-note"><Shield size={18} /><span>Financial records require an internet connection and are never cached for offline viewing.</span></div></div></div>
  </div>;
}
