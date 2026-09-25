"use client";

import { ArrowRight, BadgeCheck, Check, CircleAlert, Clock3, FileBarChart2, Landmark, Target, Users, Wallet } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { EmptyState, formatDate, formatDateTime, formatMoney, PageIntro, StatusPill, TypeIcon, typeLabel } from "@/components/finance-ui";
import { roleLabel, type Role } from "@/lib/roles";

type Action = (payload: Record<string, unknown>) => Promise<boolean>;
type Navigate = (section: "transactions" | "budgets" | "reports" | "audit" | "team") => void;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Director Admin — the executive oversight area shown to Directors and
 * Administrators. Collects everything needing a decision: entries awaiting
 * approval, budget lines at risk, team composition and recent governance
 * activity, with the ability to approve a draft straight from here.
 */
export default function DirectorView({ data, onAction, onNavigate, working }: {
  data: Snapshot;
  onAction: Action;
  onNavigate: Navigate;
  working: boolean;
}) {
  const { dashboard } = data;
  const drafts = data.transactions.filter((txn) => txn.status === "draft");
  const draftValue = drafts.reduce((sum, txn) => sum + txn.amount, 0);
  const atRisk = data.budgets.filter((item) => item.utilization >= 85);
  const overBudget = data.budgets.filter((item) => item.utilization > 100);
  const utilization = dashboard.allocated ? Math.round((dashboard.spent / dashboard.allocated) * 1000) / 10 : 0;
  const available = dashboard.allocated - dashboard.spent;
  const activeTeam = data.users.filter((member) => member.isActive);
  const recent = data.audits.slice(0, 8);
  const firstName = data.user.fullName.split(" ")[0];
  const roleCounts = (["admin", "director", "finance_officer", "viewer"] as Role[])
    .map((role) => ({ role, count: data.users.filter((member) => member.role === role && member.isActive).length }))
    .filter((entry) => entry.count > 0);

  return <div>
    <PageIntro eyebrow="OVERSIGHT  /  DIRECTOR ADMIN" title="Director Admin" subtitle="Approvals, budget exposure and team accountability in one executive view." actions={<>
      <button className="btn btn-secondary" onClick={() => onNavigate("reports")}><FileBarChart2 size={17} /> Financial reports</button>
      <button className="btn btn-primary" onClick={() => onNavigate("transactions")}><ArrowRight size={17} /> Open transactions</button>
    </>} />

    <div className="budget-hero director-hero"><div className="budget-hero-copy"><span>DIRECTOR ADMIN · VOTE HEAD 520 · FY {data.fiscalYear}</span><h2>{greeting()}, {firstName}.</h2>
      <p>{drafts.length
        ? `${drafts.length} ${drafts.length === 1 ? "entry awaits" : "entries await"} your approval, worth ${formatMoney(draftValue, 2)}.`
        : "Nothing is waiting on you. Every recorded entry has been approved and posted."}
        {overBudget.length > 0 && ` ${overBudget.length} budget ${overBudget.length === 1 ? "line is" : "lines are"} over allocation.`}</p></div>
      <div className="budget-hero-stat"><span>Net operating position</span><strong className={dashboard.balance < 0 ? "text-danger" : ""}>{dashboard.balance < 0 ? "−" : ""}{formatMoney(dashboard.balance)}</strong>
        <div><span style={{ width: `${Math.min(utilization, 100)}%` }} /></div><small>{utilization.toFixed(1)}% of the approved budget utilised</small></div></div>

    <div className="metric-grid">
      <article className="metric-card"><div className="metric-top"><span>Total income</span><div className="metric-icon metric-icon-green"><Wallet size={20} /></div></div><div className="metric-value">{formatMoney(dashboard.income)}</div><div className="metric-foot">Posted revenue this financial year</div></article>
      <article className="metric-card"><div className="metric-top"><span>Total expenditure</span><div className="metric-icon metric-icon-orange"><Target size={20} /></div></div><div className="metric-value">{formatMoney(dashboard.expenses)}</div><div className="metric-foot">Posted spending this financial year</div></article>
      <article className="metric-card"><div className="metric-top"><span>Awaiting approval</span><div className="metric-icon metric-icon-blue"><Clock3 size={20} /></div></div><div className="metric-value">{drafts.length}</div><div className="metric-foot">{drafts.length ? `${formatMoney(draftValue, 2)} held in draft` : "No drafts pending"}</div></article>
      <article className="metric-card"><div className="metric-top"><span>Budget lines to watch</span><div className="metric-icon metric-icon-purple"><CircleAlert size={20} /></div></div><div className={`metric-value ${overBudget.length ? "text-danger" : ""}`}>{atRisk.length}</div><div className="metric-foot">{overBudget.length} over allocation · {atRisk.length - overBudget.length} above 85%</div></article>
    </div>

    <section className="panel table-panel"><div className="table-toolbar"><div className="table-toolbar-heading"><h2>Awaiting your approval</h2><span className="count-badge">{drafts.length}</span></div>
      <span className="table-subtle"><BadgeCheck size={16} /> Drafts do not affect reports until posted</span></div>
      <div className="table-scroll"><table className="data-table ledger-table"><thead><tr><th>Reference / Description</th><th>Type</th><th>Date</th><th>Recorded by</th><th className="align-right">Amount</th><th>Status</th><th className="align-right">Action</th></tr></thead>
        <tbody>{drafts.map((txn) => <tr key={txn.id}><td><div className="transaction-cell"><span className={`type-icon type-${txn.type}`}><TypeIcon type={txn.type} /></span><span><strong>{txn.description}</strong><small>{txn.reference}</small></span></div></td>
          <td><span className="type-text">{typeLabel(txn.type)}</span></td><td className="muted-cell">{formatDate(txn.date)}</td><td className="muted-cell">{txn.createdBy}</td>
          <td className={`align-right amount-cell ${txn.type === "income" ? "income-text" : txn.type === "expense" ? "expense-text" : ""}`}>{txn.type === "income" ? "+" : txn.type === "expense" ? "−" : ""}{formatMoney(txn.amount)}</td>
          <td><StatusPill status={txn.status} /></td>
          <td className="align-right"><button className="table-link" disabled={working} onClick={() => onAction({ action: "postTransaction", id: txn.id })}><Check size={14} /> Approve &amp; post</button></td></tr>)}</tbody></table>
        {!drafts.length && <EmptyState icon={<BadgeCheck size={25} />} title="Nothing awaiting approval" description="Draft entries recorded by the Finance Officer appear here for your sign-off." />}</div></section>

    <div className="director-grid">
      <section className="panel budget-lines-panel"><div className="panel-heading"><div><h2>Budget watchlist</h2><p>Allocation lines at or above 85% utilisation</p></div><span className="panel-tag">FY {data.fiscalYear}</span></div>
        <div className="budget-lines">{atRisk.map((item) => <div className="budget-line" key={item.accountId}><div className="budget-line-main"><div className="budget-line-icon"><Target size={19} /></div>
          <div className="budget-line-info"><div className="budget-line-title"><strong>{item.accountName}</strong><span>{item.accountCode}</span></div>
            <div className="budget-line-sub">{formatMoney(item.spent)} spent of {formatMoney(item.allocated)} allocated</div>
            <div className="budget-bar"><span className={item.utilization > 100 ? "over" : "warning"} style={{ width: `${Math.min(item.utilization, 100)}%` }} /></div></div></div>
          <div className="budget-line-end"><strong className={item.utilization > 100 ? "text-danger" : "text-warning"}>{item.utilization.toFixed(1)}%</strong><small>{item.remaining < 0 ? `${formatMoney(item.remaining)} over` : `${formatMoney(item.remaining)} left`}</small></div>
          <button className="budget-edit" onClick={() => onNavigate("budgets")}>Review <ArrowRight size={14} /></button></div>)}
          {!atRisk.length && <EmptyState icon={<Target size={25} />} title="Every line is within budget" description={`No allocation has reached 85% utilisation. ${formatMoney(Math.max(available, 0))} remains available.`} />}</div></section>

      <section className="panel director-team-panel"><div className="panel-heading"><div><h2>Team composition</h2><p>Who holds access to the workspace</p></div><span className="panel-tag">{activeTeam.length} ACTIVE</span></div>
        <div className="director-team">{roleCounts.map((entry) => <div className="director-team-row" key={entry.role}><span className={`team-role-icon ${entry.role}`}><Users size={17} /></span><div><strong>{roleLabel[entry.role]}</strong><small>{entry.count} {entry.count === 1 ? "member" : "members"}</small></div></div>)}
          {!roleCounts.length && <EmptyState icon={<Users size={25} />} title="No active members" description="Add team members from Team &amp; access." />}</div>
        <div className="director-team-footer"><Landmark size={16} /><span>Signed in as {roleLabel[data.user.role]} · {data.user.email}</span><button className="table-link" onClick={() => onNavigate("team")}>Manage access <ArrowRight size={13} /></button></div></section>
    </div>

    <section className="panel table-panel"><div className="table-toolbar"><div className="table-toolbar-heading"><h2>Recent governance activity</h2><span className="count-badge">{recent.length}</span></div>
      <button className="table-link" onClick={() => onNavigate("audit")}>Open full audit trail <ArrowRight size={13} /></button></div>
      <div className="table-scroll"><table className="data-table audit-table"><thead><tr><th>Event</th><th>Details</th><th>Performed by</th><th>Date &amp; time</th></tr></thead>
        <tbody>{recent.map((item) => <tr key={item.id}><td><strong className="audit-event-text">{item.action.replaceAll(".", " · ").replaceAll("_", " ")}</strong></td><td className="muted-cell audit-detail-cell">{item.details || "—"}</td><td className="muted-cell">{item.actorName}</td><td className="muted-cell">{formatDateTime(item.createdAt)}</td></tr>)}</tbody></table>
        {!recent.length && <EmptyState icon={<FileBarChart2 size={25} />} title="No activity recorded yet" description="Actions taken across the workspace will appear here." />}</div></section>
  </div>;
}
