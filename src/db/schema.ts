import { relations, sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("viewer"),
  isActive: boolean("is_active").notNull().default(true),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("users_role_check", sql`${table.role} in ('admin', 'director', 'finance_officer', 'viewer')`),
  check("users_failed_attempts_check", sql`${table.failedLoginAttempts} >= 0`),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 20 }).notNull(),
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("accounts_category_check", sql`${table.category} in ('asset', 'liability', 'equity', 'income', 'expense')`),
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: varchar("reference", { length: 40 }).notNull().unique(),
  date: date("date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  payee: varchar("payee", { length: 200 }).notNull().default(""),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull().default("Bank transfer"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  reversedById: uuid("reversed_by_id"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("transactions_date_idx").on(table.date),
  index("transactions_status_idx").on(table.status),
  check("transactions_type_check", sql`${table.type} in ('income', 'expense', 'transfer', 'journal', 'reversal')`),
  check("transactions_status_check", sql`${table.status} in ('draft', 'posted', 'reversed')`),
]);

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  debit: numeric("debit", { precision: 16, scale: 2 }).notNull().default("0.00"),
  credit: numeric("credit", { precision: 16, scale: 2 }).notNull().default("0.00"),
  memo: text("memo").notNull().default(""),
}, (table) => [
  index("journal_transaction_idx").on(table.transactionId),
  index("journal_account_idx").on(table.accountId),
  check("journal_single_side_check", sql`(${table.debit} > 0 and ${table.credit} = 0) or (${table.credit} > 0 and ${table.debit} = 0)`),
]);

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  fiscalYear: integer("fiscal_year").notNull(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  allocated: numeric("allocated", { precision: 16, scale: 2 }).notNull().default("0.00"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("budgets_year_account_idx").on(table.fiscalYear, table.accountId),
  check("budgets_allocated_nonnegative_check", sql`${table.allocated} >= 0`),
]);

export const auditLogs = pgTable("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 60 }).notNull(),
  entity: varchar("entity", { length: 60 }).notNull(),
  entityId: varchar("entity_id", { length: 80 }).notNull().default(""),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_created_at_idx").on(table.createdAt)]);

export const usersRelations = relations(users, ({ many }) => ({ sessions: many(sessions), transactions: many(transactions) }));
export const transactionsRelations = relations(transactions, ({ many, one }) => ({ lines: many(journalLines), creator: one(users, { fields: [transactions.createdBy], references: [users.id] }) }));
export const journalLinesRelations = relations(journalLines, ({ one }) => ({ transaction: one(transactions, { fields: [journalLines.transactionId], references: [transactions.id] }), account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }) }));
