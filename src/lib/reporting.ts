import type { Snapshot, TransactionItem } from "@/lib/types";

export type ReportType = "income" | "budget" | "ledger" | "trial" | "transactions";
export interface ReportResult {
  title: string;
  subtitle: string;
  columns: string[];
  rows: (string | number)[][];
  numericColumns: number[];
  total: number;
}

const round = (value: number) => Math.round(value * 100) / 100;
const included = (txn: TransactionItem) => txn.status === "posted" || txn.status === "reversed";

export function buildReport(snapshot: Snapshot, report: ReportType, from: string, to: string): ReportResult {
  const filtered = snapshot.transactions.filter((txn) => included(txn) && txn.date >= from && txn.date <= to);
  const period = `${from} to ${to}`;
  if (report === "transactions") {
    const rows = snapshot.transactions.filter((txn) => txn.date >= from && txn.date <= to).map((txn) => [
      txn.date, txn.reference, txn.description, txn.type, txn.status, txn.amount,
    ]);
    return { title: "Transaction register", subtitle: period, columns: ["Date", "Reference", "Description", "Type", "Status", "Amount (NGN)"], rows, numericColumns: [5], total: rows.length };
  }
  if (report === "budget") {
    const rows = snapshot.budgets.map((item) => [
      item.accountCode, item.accountName, item.allocated, item.spent, item.remaining, `${item.utilization.toFixed(1)}%`,
    ]);
    rows.push(["", "TOTAL", round(snapshot.budgets.reduce((a, b) => a + b.allocated, 0)), round(snapshot.budgets.reduce((a, b) => a + b.spent, 0)), round(snapshot.budgets.reduce((a, b) => a + b.remaining, 0)), ""]);
    return { title: "Budget versus actual", subtitle: `Vote Head 520 · Financial year ${snapshot.fiscalYear}`, columns: ["Code", "Expense account", "Approved (NGN)", "Actual (NGN)", "Variance (NGN)", "Utilization"], rows, numericColumns: [2, 3, 4], total: snapshot.budgets.length };
  }
  if (report === "ledger") {
    const rows: (string | number)[][] = [];
    for (const txn of filtered) {
      for (const line of txn.lines) {
        rows.push([txn.date, txn.reference, `${line.accountCode} · ${line.accountName}`, txn.description, line.debit, line.credit]);
      }
    }
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
    rows.push(["", "", "TOTAL", "", round(filtered.flatMap((t) => t.lines).reduce((sum, line) => sum + line.debit, 0)), round(filtered.flatMap((t) => t.lines).reduce((sum, line) => sum + line.credit, 0))]);
    return { title: "General ledger", subtitle: period, columns: ["Date", "Reference", "Account", "Narration", "Debit (NGN)", "Credit (NGN)"], rows, numericColumns: [4, 5], total: rows.length - 1 };
  }
  if (report === "trial") {
    const balances = new Map<string, number>();
    for (const txn of filtered) {
      for (const line of txn.lines) balances.set(line.accountId, (balances.get(line.accountId) || 0) + Math.round((line.debit - line.credit) * 100));
    }
    const rows: (string | number)[][] = snapshot.accounts.map((account) => {
      const net = balances.get(account.id) || 0;
      return [account.code, account.name, net > 0 ? net / 100 : 0, net < 0 ? -net / 100 : 0];
    }).filter((row) => Number(row[2]) !== 0 || Number(row[3]) !== 0);
    const debits = round(rows.reduce((sum, row) => sum + Number(row[2]), 0));
    const credits = round(rows.reduce((sum, row) => sum + Number(row[3]), 0));
    rows.push(["", "TOTAL", debits, credits]);
    return { title: "Trial balance", subtitle: period, columns: ["Code", "Account", "Debit (NGN)", "Credit (NGN)"], rows, numericColumns: [2, 3], total: rows.length - 1 };
  }
  const totals = new Map<string, number>();
  for (const txn of filtered) for (const line of txn.lines) {
    const value = line.category === "income" ? line.credit - line.debit : line.debit - line.credit;
    totals.set(line.accountId, (totals.get(line.accountId) || 0) + Math.round(value * 100));
  }
  const incomeAccounts = snapshot.accounts.filter((account) => account.category === "income");
  const expenseAccounts = snapshot.accounts.filter((account) => account.category === "expense");
  const incomeTotal = incomeAccounts.reduce((sum, account) => sum + (totals.get(account.id) || 0), 0) / 100;
  const expenseTotal = expenseAccounts.reduce((sum, account) => sum + (totals.get(account.id) || 0), 0) / 100;
  const rows: (string | number)[][] = [
    ["", "OPERATING INCOME", ""],
    ...incomeAccounts.map((account) => [account.code, account.name, round((totals.get(account.id) || 0) / 100)]),
    ["", "Total operating income", round(incomeTotal)],
    ["", "OPERATING EXPENDITURE", ""],
    ...expenseAccounts.map((account) => [account.code, account.name, round((totals.get(account.id) || 0) / 100)]),
    ["", "Total operating expenditure", round(expenseTotal)],
    ["", "NET OPERATING SURPLUS / (DEFICIT)", round(incomeTotal - expenseTotal)],
  ];
  return { title: "Income & expenditure statement", subtitle: period, columns: ["Code", "Account / particulars", "Amount (NGN)"], rows, numericColumns: [2], total: incomeAccounts.length + expenseAccounts.length };
}
