import type { Role } from "@/lib/roles";

export type { Role };
export type AccountCategory = "asset" | "liability" | "equity" | "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer" | "journal" | "reversal";
export type TransactionStatus = "draft" | "posted" | "reversed";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface AccountItem {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  description: string;
  isActive: boolean;
  balance: number;
  /** True once the account carries journal lines, which locks its category. */
  hasEntries: boolean;
}

export interface JournalLineItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  category: AccountCategory;
  debit: number;
  credit: number;
  memo: string;
}

export interface TransactionItem {
  id: string;
  reference: string;
  date: string;
  description: string;
  type: TransactionType;
  status: TransactionStatus;
  payee: string;
  paymentMethod: string;
  createdBy: string;
  reversedById: string | null;
  amount: number;
  lines: JournalLineItem[];
  createdAt: string;
}

export interface BudgetItem {
  id: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  allocated: number;
  spent: number;
  remaining: number;
  utilization: number;
}

export interface AuditItem {
  id: number;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface MonthItem {
  month: string;
  label: string;
  income: number;
  expenses: number;
}

export interface DashboardItem {
  income: number;
  expenses: number;
  balance: number;
  allocated: number;
  spent: number;
  transactionCount: number;
  draftCount: number;
  monthly: MonthItem[];
  priorMonthIncome: number;
  priorMonthExpenses: number;
}

export interface Snapshot {
  user: SessionUser;
  fiscalYear: number;
  accounts: AccountItem[];
  transactions: TransactionItem[];
  budgets: BudgetItem[];
  audits: AuditItem[];
  users: UserItem[];
  dashboard: DashboardItem;
}
