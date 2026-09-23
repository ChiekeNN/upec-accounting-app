import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { accounts, auditLogs, budgets, journalLines, sessions, transactions, users } from "@/db/schema";
import { canWrite, errorResponse, getCurrentUser, hashPassword, isAdmin, isSameOrigin, verifyPassword } from "@/lib/auth";
import { getSnapshot } from "@/lib/ledger";
import { ensureSeed } from "@/lib/seed";
import { and, eq } from "drizzle-orm";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

class ActionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const assert = (condition: unknown, message: string, status = 400): asserts condition => {
  if (!condition) throw new ActionError(message, status);
};
function text(value: unknown, max: number, label: string, required = true) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new ActionError(`${label} is required.`);
  if (result.length > max) throw new ActionError(`${label} must be ${max} characters or fewer.`);
  return result;
}
function moneyCents(value: unknown, label: string, allowZero = false) {
  const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(raw)) throw new ActionError(`${label} must be a valid amount with at most two decimal places.`);
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents) || (!allowZero && cents <= 0)) throw new ActionError(`${label} must be greater than zero.`);
  return cents;
}
const asMoney = (value: number) => (value / 100).toFixed(2);
function validDate(value: unknown) {
  const date = text(value, 10, "Date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new ActionError("Enter a valid transaction date.");
  }
  return date;
}
function reference(date: string) { return `UPEC-${date.slice(0, 4)}-${randomBytes(5).toString("hex").toUpperCase()}`; }
function requireWriter(user: SessionUser) { if (!canWrite(user)) throw new ActionError("You do not have permission to modify financial records.", 403); }
function requireAdmin(user: SessionUser) { if (!isAdmin(user)) throw new ActionError("Administrator access is required.", 403); }

type NewLine = { accountId: string; debit: number; credit: number; memo: string };

async function createTransaction(body: Record<string, unknown>, user: SessionUser) {
  requireWriter(user);
  const type = text(body.type, 20, "Transaction type");
  if (!["income", "expense", "transfer", "journal"].includes(type)) throw new ActionError("Invalid transaction type.");
  const date = validDate(body.date);
  const description = text(body.description, 500, "Description");
  const payee = text(body.payee, 200, "Payee / source", false);
  const paymentMethod = text(body.paymentMethod || "Bank transfer", 50, "Payment method");
  const status = body.saveAsDraft === true ? "draft" : "posted";
  const accountRows = await db.select().from(accounts);
  const accountMap = new Map(accountRows.map((account) => [account.id, account]));
  const useAccount = (id: unknown, category: string | string[], label: string) => {
    const account = accountMap.get(String(id));
    if (!account?.isActive || !(Array.isArray(category) ? category : [category]).includes(account.category)) {
      throw new ActionError(`Select a valid ${label}.`);
    }
    return account.id;
  };
  let lines: NewLine[];
  if (type === "journal") {
    const input = body.lines;
    if (!Array.isArray(input) || input.length < 2 || input.length > 20) throw new ActionError("A journal entry requires 2 to 20 lines.");
    lines = input.map((item: unknown, index: number) => {
      const row = item as Record<string, unknown>;
      const accountId = useAccount(row?.accountId, ["asset", "liability", "equity", "income", "expense"], `account on line ${index + 1}`);
      const debit = moneyCents(row?.debit || "0", `Debit on line ${index + 1}`, true);
      const credit = moneyCents(row?.credit || "0", `Credit on line ${index + 1}`, true);
      if ((debit === 0) === (credit === 0)) throw new ActionError(`Enter either a debit or a credit on line ${index + 1}.`);
      return { accountId, debit, credit, memo: text(row?.memo, 250, "Memo", false) };
    });
  } else {
    const value = moneyCents(body.amount, "Amount");
    if (type === "income") {
      const categoryId = useAccount(body.categoryAccountId, "income", "income account");
      const cashId = useAccount(body.cashAccountId, "asset", "deposit account");
      lines = [{ accountId: cashId, debit: value, credit: 0, memo: "Funds received" }, { accountId: categoryId, debit: 0, credit: value, memo: description }];
    } else if (type === "expense") {
      const categoryId = useAccount(body.categoryAccountId, "expense", "expense account");
      const cashId = useAccount(body.cashAccountId, "asset", "payment account");
      lines = [{ accountId: categoryId, debit: value, credit: 0, memo: description }, { accountId: cashId, debit: 0, credit: value, memo: "Payment made" }];
    } else {
      const fromId = useAccount(body.fromAccountId, "asset", "source account");
      const toId = useAccount(body.toAccountId, "asset", "destination account");
      if (fromId === toId) throw new ActionError("Source and destination accounts must differ.");
      lines = [{ accountId: toId, debit: value, credit: 0, memo: "Transfer in" }, { accountId: fromId, debit: 0, credit: value, memo: "Transfer out" }];
    }
  }
  const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0);
  const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0);
  if (debitTotal !== creditTotal || debitTotal <= 0) throw new ActionError("Journal entry must balance: total debits must equal total credits.");
  const result = await db.transaction(async (tx) => {
    const [record] = await tx.insert(transactions).values({
      reference: reference(date), date, description, type, status, payee, paymentMethod,
      createdBy: user.id, postedAt: status === "posted" ? new Date() : null,
    }).returning({ id: transactions.id, reference: transactions.reference });
    await tx.insert(journalLines).values(lines.map((line) => ({
      transactionId: record.id, accountId: line.accountId,
      debit: asMoney(line.debit), credit: asMoney(line.credit), memo: line.memo,
    })));
    await tx.insert(auditLogs).values({
      actorId: user.id, action: status === "draft" ? "transaction.drafted" : "transaction.posted",
      entity: "transaction", entityId: record.id,
      details: `${record.reference} · ${description} · NGN ${asMoney(debitTotal)}`,
    });
    return record;
  });
  return { message: status === "draft" ? "Transaction saved as draft." : "Transaction posted to the ledger.", ...result };
}

async function postTransaction(body: Record<string, unknown>, user: SessionUser) {
  requireWriter(user);
  const id = text(body.id, 50, "Transaction ID");
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(transactions).where(eq(transactions.id, id)).for("update").limit(1);
    if (!record || record.status !== "draft") throw new ActionError("Only draft transactions can be posted.");
    const lines = await tx.select().from(journalLines).where(eq(journalLines.transactionId, id));
    const debits = lines.reduce((sum, line) => sum + moneyCents(line.debit, "Debit", true), 0);
    const credits = lines.reduce((sum, line) => sum + moneyCents(line.credit, "Credit", true), 0);
    if (debits <= 0 || debits !== credits) throw new ActionError("The journal entry is not balanced.");
    await tx.update(transactions).set({ status: "posted", postedAt: new Date() }).where(eq(transactions.id, id));
    await tx.insert(auditLogs).values({ actorId: user.id, action: "transaction.posted", entity: "transaction", entityId: id, details: `${record.reference} approved and posted` });
    return { message: "Draft approved and posted to the ledger." };
  });
}

async function reverseTransaction(body: Record<string, unknown>, user: SessionUser) {
  requireWriter(user);
  const id = text(body.id, 50, "Transaction ID");
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(transactions).where(eq(transactions.id, id)).for("update").limit(1);
    if (!record || record.status !== "posted") throw new ActionError("Only posted transactions can be reversed.");
    const originalLines = await tx.select().from(journalLines).where(eq(journalLines.transactionId, id));
    const [reversal] = await tx.insert(transactions).values({
      reference: reference(record.date), date: record.date,
      description: `Reversal: ${record.description}`, type: "reversal", status: "posted",
      payee: record.payee, paymentMethod: record.paymentMethod,
      createdBy: user.id, postedAt: new Date(),
    }).returning({ id: transactions.id, reference: transactions.reference });
    await tx.insert(journalLines).values(originalLines.map((line) => ({
      transactionId: reversal.id, accountId: line.accountId,
      debit: line.credit, credit: line.debit, memo: `Reversal of ${record.reference}`,
    })));
    await tx.update(transactions).set({ status: "reversed", reversedById: reversal.id }).where(eq(transactions.id, id));
    await tx.insert(auditLogs).values({ actorId: user.id, action: "transaction.reversed", entity: "transaction", entityId: id, details: `${record.reference} reversed by ${reversal.reference}; original journal preserved` });
    return { message: "Transaction reversed with a compensating journal entry." };
  });
}

async function saveBudget(body: Record<string, unknown>, user: SessionUser) {
  requireAdmin(user);
  const accountId = text(body.accountId, 50, "Expense account");
  const allocated = moneyCents(body.allocated, "Allocation", true);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account || account.category !== "expense") throw new ActionError("Select an expense account.");
  const year = new Date().getUTCFullYear();
  await db.transaction(async (tx) => {
    await tx.insert(budgets).values({ fiscalYear: year, accountId, allocated: asMoney(allocated), updatedBy: user.id })
      .onConflictDoUpdate({ target: [budgets.fiscalYear, budgets.accountId], set: { allocated: asMoney(allocated), updatedBy: user.id, updatedAt: new Date() } });
    await tx.insert(auditLogs).values({ actorId: user.id, action: "budget.updated", entity: "budget", entityId: accountId, details: `${account.code} ${account.name}: FY ${year} allocation NGN ${asMoney(allocated)}` });
  });
  return { message: "Budget allocation updated." };
}

async function createAccount(body: Record<string, unknown>, user: SessionUser) {
  requireAdmin(user);
  const code = text(body.code, 12, "Account code");
  if (!/^\d{3,12}$/.test(code)) throw new ActionError("Account code must contain 3 to 12 digits.");
  const name = text(body.name, 160, "Account name");
  const category = text(body.category, 20, "Category");
  if (!["asset", "liability", "equity", "income", "expense"].includes(category)) throw new ActionError("Invalid account category.");
  const description = text(body.description, 500, "Description", false);
  const duplicate = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, code)).limit(1);
  if (duplicate.length) throw new ActionError("This account code is already in use.");
  await db.transaction(async (tx) => {
    const [created] = await tx.insert(accounts).values({ code, name, category, description }).returning({ id: accounts.id });
    await tx.insert(auditLogs).values({ actorId: user.id, action: "account.created", entity: "account", entityId: created.id, details: `${code} · ${name} (${category})` });
  });
  return { message: "Account added to the chart of accounts." };
}

function validatePassword(password: string) {
  if (password.length < 10 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new ActionError("Password must be 10+ characters and include uppercase, lowercase, a number and a symbol.");
  }
}

async function createUser(body: Record<string, unknown>, user: SessionUser) {
  requireAdmin(user);
  const fullName = text(body.fullName, 160, "Full name");
  const email = text(body.email, 255, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ActionError("Enter a valid email address.");
  const role = text(body.role, 20, "Role");
  if (!["admin", "accountant", "viewer"].includes(role)) throw new ActionError("Invalid role.");
  const password = text(body.password, 128, "Password");
  validatePassword(password);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) throw new ActionError("A user with this email already exists.");
  await db.transaction(async (tx) => {
    const [created] = await tx.insert(users).values({ fullName, email, role, passwordHash: hashPassword(password) }).returning({ id: users.id });
    await tx.insert(auditLogs).values({ actorId: user.id, action: "user.created", entity: "user", entityId: created.id, details: `${fullName} · ${email} · ${role}` });
  });
  return { message: "Team member added successfully." };
}

async function toggleUser(body: Record<string, unknown>, user: SessionUser) {
  requireAdmin(user);
  const id = text(body.id, 50, "User ID");
  if (id === user.id) throw new ActionError("You cannot deactivate your own account.");
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new ActionError("User not found.", 404);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive: !target.isActive }).where(eq(users.id, id));
    if (target.isActive) await tx.delete(sessions).where(eq(sessions.userId, id));
    await tx.insert(auditLogs).values({ actorId: user.id, action: target.isActive ? "user.deactivated" : "user.activated", entity: "user", entityId: id, details: `${target.fullName} (${target.email})` });
  });
  return { message: `User ${target.isActive ? "deactivated" : "activated"}.` };
}

async function changePassword(body: Record<string, unknown>, user: SessionUser) {
  const currentPassword = text(body.currentPassword, 128, "Current password");
  const newPassword = text(body.newPassword, 128, "New password");
  validatePassword(newPassword);
  const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!record || !verifyPassword(currentPassword, record.passwordHash)) throw new ActionError("Current password is incorrect.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.insert(auditLogs).values({ actorId: user.id, action: "user.password_changed", entity: "user", entityId: user.id, details: "Password updated; all sessions revoked" });
  });
  return { message: "Password changed. Please sign in again.", signOut: true };
}

export async function GET() {
  try {
    await ensureSeed();
    const user = await getCurrentUser();
    if (!user) return errorResponse("Please sign in to continue.", 401);
    return Response.json(await getSnapshot(user), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Ledger read failed:", error);
    return errorResponse("Unable to load accounting data right now.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return errorResponse("Please sign in to continue.", 401);
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ActionError("Invalid request body.");
    const body = input as Record<string, unknown>;
    let result;
    switch (body.action) {
      case "createTransaction": result = await createTransaction(body, user); break;
      case "postTransaction": result = await postTransaction(body, user); break;
      case "reverseTransaction": result = await reverseTransaction(body, user); break;
      case "saveBudget": result = await saveBudget(body, user); break;
      case "createAccount": result = await createAccount(body, user); break;
      case "createUser": result = await createUser(body, user); break;
      case "toggleUser": result = await toggleUser(body, user); break;
      case "changePassword": result = await changePassword(body, user); break;
      default: throw new ActionError("Unknown action.");
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ActionError) return errorResponse(error.message, error.status);
    console.error("Ledger action failed:", error);
    return errorResponse("Unable to complete the request. Please try again.", 500);
  }
}
