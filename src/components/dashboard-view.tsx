"use client";

import { ArrowDownLeft, ArrowRight, ArrowUpRight, ArrowUpRight as TrendUp, Banknote, CalendarDays, ChevronRight, CircleAlert, FileBarChart2, Landmark, Plus, ReceiptText, Target, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Snapshot } from "@/lib/types";
import { formatDate, formatMoney, PageIntro, reportUrl, StatusPill, TypeIcon, typeLabel } from "@/components/finance-ui";

function Trend({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (!previous) return <span className="metric-trend neutral">This financial year</span>;
  const difference = Math.round(((current - previous) / Math.abs(previous)) * 10) / 10;
  const good = inverse ? difference <= 0 : difference >= 0;
  return <span className={`metric-trend ${good ? "positive" : "negative"}`}>{difference >= 0 ? "↗" : "↘"} {Math.abs(difference)}% <span>vs last month</span></span>;
}

export default function DashboardView({ data, onNavigate, onNewTransaction }: {
  data: Snapshot;
  onNavigate: (section: "transactions" | "budgets" | "reports" | "accounts") => void;
  onNewTransaction: () => void;
}) {
  const { dashboard, fiscalYear } = data;
  const utilization = dashboard.allocated ? Math.round((dashboard.spent / dashboard.allocated) * 1000) / 10 : 0;
  const available = Math.max(0, dashboard.allocated - dashboard.spent);
  const overBudget = data.budgets.filter((item) => item.utilization > 100).length;
  const warnings = data.budgets.filter((item) => item.utilization >= 85).length;
  const currentMonth = dashboard.monthly[5] || { income: 0, expenses: 0 };
  const pieData = [{ name: "Utilised", value: Math.max(dashboard.spent, 0) }, { name: "Available", value: available }];
  const reportFrom = `${fiscalYear}-01-01`;
  const reportTo = new Date().toISOString().slice(0, 10);
  const recent = data.transactions.slice(0, 5);
  const budgetHighlights = [...data.budgets].sort((a, b) => b.utilization - a.utilization).slice(0, 3);

  return <div className="dashboard-view">
    <PageIntro eyebrow={`OVERVIEW  /  FINANCIAL YEAR ${fiscalYear}`} title="Financial overview" subtitle="A clear view of UPEC’s financial performance, all in one place." actions={<>
      <a className="btn btn-secondary" href={reportUrl("income", reportFrom, reportTo)}><FileBarChart2 size={17} /> Download report</a>
      <button className="btn btn-primary" onClick={onNewTransaction}><Plus size={18} /> New transaction</button>
    </>} />

    <div className={`overview-notice ${overBudget ? "notice-warning" : ""}`}>
      <div className="notice-icon">{overBudget ? <CircleAlert size={19} /> : <Landmark size={19} />}</div>
      <div><strong>{overBudget ? `${overBudget} budget ${overBudget === 1 ? "line needs" : "lines need"} attention` : "Your finances at a glance"}</strong><span>{overBudget ? "Review overspent budget lines and take action." : `Tracking Vote Head 520 for the ${fiscalYear} financial year. All figures are in Nigerian Naira (NGN).`}</span></div>
      <button onClick={() => onNavigate("budgets")}>View budget <ArrowRight size={15} /></button>
    </div>

    <div className="metric-grid">
      <article className="metric-card"><div className="metric-top"><span>Total income</span><div className="metric-icon metric-icon-green"><ArrowDownLeft size={20} /></div></div><div className="metric-value">{formatMoney(dashboard.income)}</div><Trend current={currentMonth.income} previous={dashboard.priorMonthIncome} /><div className="metric-foot">Revenue received this year</div></article>
      <article className="metric-card"><div className="metric-top"><span>Total expenditure</span><div className="metric-icon metric-icon-orange"><ArrowUpRight size={20} /></div></div><div className="metric-value">{formatMoney(dashboard.expenses)}</div><Trend current={currentMonth.expenses} previous={dashboard.priorMonthExpenses} inverse /><div className="metric-foot">Operating expenses this year</div></article>
      <article className="metric-card"><div className="metric-top"><span>Net operating balance</span><div className="metric-icon metric-icon-blue"><Wallet size={20} /></div></div><div className={`metric-value ${dashboard.balance < 0 ? "text-danger" : ""}`}>{dashboard.balance < 0 ? "−" : ""}{formatMoney(dashboard.balance)}</div><span className={`metric-trend ${dashboard.balance >= 0 ? "positive" : "negative"}`}>{dashboard.balance >= 0 ? "● Healthy position" : "● Operating deficit"}</span><div className="metric-foot">Income less expenditure</div></article>
      <article className="metric-card"><div className="metric-top"><span>Budget utilisation</span><div className="metric-icon metric-icon-purple"><Target size={20} /></div></div><div className="metric-value">{utilization.toFixed(1)}<span className="metric-percent">%</span></div><div className="metric-progress"><span style={{ width: `${Math.min(utilization, 100)}%`, background: utilization > 100 ? "#df715b" : "#4d80d6" }} /></div><div className="metric-foot">{formatMoney(available)} of {formatMoney(dashboard.allocated)} remaining</div></article>
    </div>

    <div className="dashboard-chart-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Income & expenditure</h2><p>Financial activity over the last 6 months</p></div><div className="chart-legend"><span><i className="legend-swatch legend-income" /> Income</span><span><i className="legend-swatch legend-expense" /> Expenditure</span></div></div>
        <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.monthly} barGap={5} barCategoryGap="27%" margin={{ top: 14, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eaf0f6" strokeDasharray="4 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8a98ac", fontSize: 12 }} dy={12} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#8a98ac", fontSize: 11 }} tickFormatter={(value: number) => `${Math.round(value / 1000000)}m`} /><Tooltip cursor={{ fill: "#f4f7fb" }} contentStyle={{ border: "1px solid #e6ebf2", borderRadius: 12, boxShadow: "0 12px 30px rgba(18,40,72,.1)", fontSize: 12 }} formatter={(value) => formatMoney(Number(value))} /><Bar dataKey="income" fill="#3974d0" radius={[5, 5, 0, 0]} maxBarSize={26} name="Income" /><Bar dataKey="expenses" fill="#9dc1f2" radius={[5, 5, 0, 0]} maxBarSize={26} name="Expenditure" /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel budget-chart-panel"><div className="panel-heading"><div><h2>Budget overview</h2><p>FY {fiscalYear} allocation</p></div><button className="small-icon-button" aria-label="View budgets" onClick={() => onNavigate("budgets")}><ChevronRight size={19} /></button></div>
        <div className="donut-wrap"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" innerRadius={72} outerRadius={93} startAngle={90} endAngle={-270} stroke="none" paddingAngle={pieData[0].value && pieData[1].value ? 2 : 0}>{pieData.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? "#3974d0" : "#e8f0fa"} />)}</Pie></PieChart></ResponsiveContainer><div className="donut-center"><strong>{utilization.toFixed(0)}%</strong><span>utilised</span></div></div></div>
        <div className="budget-legend-row"><div><span className="legend-dot blue" /> Spent <strong>{formatMoney(dashboard.spent)}</strong></div><div><span className="legend-dot pale" /> Available <strong>{formatMoney(available)}</strong></div></div>
      </section>
    </div>

    <div className="dashboard-bottom-grid">
      <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest recorded financial activity</p></div><button className="text-action" onClick={() => onNavigate("transactions")}>View all <ArrowRight size={16} /></button></div>
        <div className="table-scroll"><table className="data-table recent-table"><thead><tr><th>Transaction</th><th>Date</th><th>Type</th><th className="align-right">Amount</th><th>Status</th></tr></thead><tbody>{recent.map((txn) => <tr key={txn.id} onClick={() => onNavigate("transactions")} className="clickable-row"><td><div className="transaction-cell"><span className={`type-icon type-${txn.type}`}><TypeIcon type={txn.type} /></span><span><strong>{txn.description}</strong><small>{txn.reference}</small></span></div></td><td className="muted-cell">{formatDate(txn.date)}</td><td className="muted-cell">{typeLabel(txn.type)}</td><td className={`align-right amount-cell ${txn.type === "income" ? "income-text" : ""}`}>{txn.type === "income" ? "+" : txn.type === "expense" ? "−" : ""}{formatMoney(txn.amount)}</td><td><StatusPill status={txn.status} /></td></tr>)}</tbody></table></div>
      </section>
      <div className="dashboard-side-stack"><section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Jump back into your workflow</p></div></div><button onClick={onNewTransaction}><span className="quick-icon quick-blue"><Plus size={19} /></span><span>Record a transaction<small>Income, expense or journal</small></span><ChevronRight size={18} /></button><button onClick={() => onNavigate("budgets")}><span className="quick-icon quick-green"><Target size={19} /></span><span>Review budgets<small>Track allocations and spend</small></span><ChevronRight size={18} /></button><button onClick={() => onNavigate("reports")}><span className="quick-icon quick-purple"><FileBarChart2 size={19} /></span><span>Generate a report<small>Statements and exports</small></span><ChevronRight size={18} /></button></section>
        <section className="insight-card"><div className="insight-icon"><Banknote size={20} /></div><div><span>FINANCE PULSE</span><h3>{warnings ? `${warnings} budget ${warnings === 1 ? "line" : "lines"} to watch` : "Looking good this year"}</h3><p>{warnings ? "Keep an eye on allocations approaching their approved limits." : `${dashboard.transactionCount} posted transactions recorded in FY ${fiscalYear}.`}</p></div><CalendarDays size={20} className="insight-watermark" /></section></div>
    </div>
  </div>;
}
