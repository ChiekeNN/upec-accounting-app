import { db } from "@/db";
import { accounts, auditLogs, budgets, journalLines, transactions, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { normaliseRole } from "@/lib/roles";
import type { AccountCategory, AccountItem, AuditItem, BudgetItem, DashboardItem, JournalLineItem, MonthItem, SessionUser, Snapshot, TransactionItem, TransactionStatus, TransactionType, UserItem } from "@/lib/types";

const cents = (value: string | number) => Math.round(Number(value) * 100);
const amount = (value: number) => Math.round(value) / 100;
const activeStatuses = new Set(["posted", "reversed"]);

export async function getSnapshot(user: SessionUser): Promise<Snapshot> {
  const fiscalYear = new Date().getUTCFullYear();
  const [accountRows, transactionRows, lineRows, budgetRows, auditRows, userRows] = await Promise.all([
    db.select().from(accounts).orderBy(accounts.code),
    db.select({
      id: transactions.id, reference: transactions.reference, date: transactions.date,
      description: transactions.description, type: transactions.type, status: transactions.status,
      payee: transactions.payee, paymentMethod: transactions.paymentMethod,
      createdBy: users.fullName, reversedById: transactions.reversedById,
      createdAt: transactions.createdAt,
    }).from(transactions).leftJoin(users, eq(transactions.createdBy, users.id))
      .orderBy(desc(transactions.date), desc(transactions.createdAt)),
    db.select({
      id: journalLines.id, transactionId: journalLines.transactionId, accountId: journalLines.accountId,
      accountCode: accounts.code, accountName: accounts.name, category: accounts.category,
      debit: journalLines.debit, credit: journalLines.credit, memo: journalLines.memo,
    }).from(journalLines).innerJoin(accounts, eq(journalLines.accountId, accounts.id)),
    db.select().from(budgets).where(eq(budgets.fiscalYear, fiscalYear)),
    db.select({
      id: auditLogs.id, actorName: users.fullName, action: auditLogs.action,
      entity: auditLogs.entity, entityId: auditLogs.entityId,
      details: auditLogs.details, createdAt: auditLogs.createdAt,
    }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.createdAt)).limit(150),
    db.select({
      id: users.id, fullName: users.fullName, email: users.email,
      role: users.role, isActive: users.isActive, createdAt: users.createdAt,
    }).from(users).orderBy(users.fullName),
  ]);

  const linesByTransaction = new Map<string, JournalLineItem[]>();
  for (const row of lineRows) {
    const line: JournalLineItem = {
      id: row.id, accountId: row.accountId, accountCode: row.accountCode,
      accountName: row.accountName, category: row.category as AccountCategory,
      debit: Number(row.debit), credit: Number(row.credit), memo: row.memo,
    };
    const existing = linesByTransaction.get(row.transactionId) || [];
    existing.push(line);
    linesByTransaction.set(row.transactionId, existing);
  }

  const allTransactions: TransactionItem[] = transactionRows.map((row) => {
    const lines = linesByTransaction.get(row.id) || [];
    const category = row.type === "income" ? "income" : row.type === "expense" ? "expense" : null;
    const selected = category ? lines.filter((line) => line.category === category) : lines;
    const total = category === "income"
      ? selected.reduce((sum, line) => sum + cents(line.credit), 0)
      : selected.reduce((sum, line) => sum + cents(line.debit), 0);
    return {
      id: row.id, reference: row.reference, date: row.date, description: row.description,
      type: row.type as TransactionType, status: row.status as TransactionStatus,
      payee: row.payee, paymentMethod: row.paymentMethod,
      createdBy: row.createdBy || "System", reversedById: row.reversedById,
      amount: amount(total), lines, createdAt: row.createdAt.toISOString(),
    };
  });

  const accountBalance = new Map<string, number>();
  const spentByAccount = new Map<string, number>();
  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthly: MonthItem[] = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + i, 1));
    return { month: date.toISOString().slice(0, 7), label: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), income: 0, expenses: 0 };
  });
  const monthlyMap = new Map(monthly.map((entry) => [entry.month, entry]));
  let incomeCents = 0;
  let expenseCents = 0;
  let transactionCount = 0;
  let draftCount = 0;
  let priorMonthIncome = 0;
  let priorMonthExpenses = 0;
  const previousMonth = monthly[4]?.month;

  for (const transaction of allTransactions) {
    if (transaction.status === "draft") { draftCount++; continue; }
    if (!activeStatuses.has(transaction.status)) continue;
    const inYear = Number(transaction.date.slice(0, 4)) === fiscalYear;
    if (inYear) transactionCount++;
    const monthEntry = monthlyMap.get(transaction.date.slice(0, 7));
    for (const line of transaction.lines) {
      const difference = cents(line.debit) - cents(line.credit);
      accountBalance.set(line.accountId, (accountBalance.get(line.accountId) || 0) + difference);
      if (line.category === "income") {
        const value = -difference;
        if (inYear) incomeCents += value;
        if (monthEntry) monthEntry.income += amount(value);
        if (transaction.date.slice(0, 7) === previousMonth) priorMonthIncome += value;
      } else if (line.category === "expense") {
        if (inYear) {
          expenseCents += difference;
          spentByAccount.set(line.accountId, (spentByAccount.get(line.accountId) || 0) + difference);
        }
        if (monthEntry) monthEntry.expenses += amount(difference);
        if (transaction.date.slice(0, 7) === previousMonth) priorMonthExpenses += difference;
      }
    }
  }

  const accountsWithEntries = new Set(lineRows.map((row) => row.accountId));
  const accountItems: AccountItem[] = accountRows.map((row) => {
    const balance = accountBalance.get(row.id) || 0;
    return {
      id: row.id, code: row.code, name: row.name,
      category: row.category as AccountCategory, description: row.description,
      isActive: row.isActive, hasEntries: accountsWithEntries.has(row.id),
      balance: amount(["asset", "expense"].includes(row.category) ? balance : -balance),
    };
  });
  const budgetsByAccount = new Map(budgetRows.map((row) => [row.accountId, row]));
  const budgetItems: BudgetItem[] = accountItems.filter((item) => item.category === "expense").map((item) => {
    const row = budgetsByAccount.get(item.id);
    const allocatedCents = cents(row?.allocated || 0);
    const spentCents = spentByAccount.get(item.id) || 0;
    return {
      id: row?.id || null, accountId: item.id, accountCode: item.code,
      accountName: item.name, allocated: amount(allocatedCents),
      spent: amount(spentCents), remaining: amount(allocatedCents - spentCents),
      utilization: allocatedCents > 0 ? Math.round((spentCents / allocatedCents) * 1000) / 10 : 0,
    };
  });
  const allocated = budgetItems.reduce((sum, item) => sum + cents(item.allocated), 0);
  const spent = budgetItems.reduce((sum, item) => sum + cents(item.spent), 0);
  const dashboard: DashboardItem = {
    income: amount(incomeCents), expenses: amount(expenseCents),
    balance: amount(incomeCents - expenseCents), allocated: amount(allocated),
    spent: amount(spent), transactionCount, draftCount, monthly,
    priorMonthIncome: amount(priorMonthIncome), priorMonthExpenses: amount(priorMonthExpenses),
  };
  const audits: AuditItem[] = auditRows.map((row) => ({
    id: row.id, actorName: row.actorName || "System", action: row.action,
    entity: row.entity, entityId: row.entityId, details: row.details,
    createdAt: row.createdAt.toISOString(),
  }));
  const userItems: UserItem[] = userRows.map((row) => ({
    id: row.id, fullName: row.fullName, email: row.email, role: normaliseRole(row.role),
    isActive: row.isActive, createdAt: row.createdAt.toISOString(),
  }));
  // The complete journal remains available to authenticated users for statements and exports.
  return { user, fiscalYear, accounts: accountItems, transactions: allTransactions,
    budgets: budgetItems, audits, users: userItems, dashboard };
}
