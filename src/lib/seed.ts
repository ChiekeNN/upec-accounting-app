import { db } from "@/db";
import { accounts, auditLogs, budgets, journalLines, transactions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { bootstrapAccounts, isDemoMode } from "@/lib/bootstrap";
import type { Role } from "@/lib/roles";
import { roleLabel } from "@/lib/roles";
import { eq, sql } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const chartOfAccounts = [
  ["1000", "Cash on Hand", "asset", "Petty cash and cash equivalents"],
  ["1010", "UPEC Operating Bank", "asset", "Primary operating bank account"],
  ["1100", "Accounts Receivable", "asset", "Amounts owed to the centre"],
  ["2000", "Accounts Payable", "liability", "Outstanding supplier obligations"],
  ["3000", "Accumulated Fund", "equity", "Retained institutional funds"],
  ["4000", "Training Programme Fees", "income", "Entrepreneurship and skills training fees"],
  ["4010", "Consultancy & Advisory", "income", "Consultancy engagements and advisory services"],
  ["4020", "Facility Hire Revenue", "income", "Event and facility rental income"],
  ["4030", "Grants & Support", "income", "Institutional and external support"],
  ["4040", "Other Income", "income", "Other operating income"],
  ["5000", "Personnel & Facilitators", "expense", "Facilitator honoraria and personnel costs"],
  ["5010", "Programme Delivery", "expense", "Training materials and programme execution"],
  ["5020", "Administration", "expense", "Administrative and office expenses"],
  ["5030", "Facility Maintenance", "expense", "Repairs and facility upkeep"],
  ["5040", "Marketing & Outreach", "expense", "Publicity and community engagement"],
  ["5050", "Utilities & Operations", "expense", "Power, connectivity and operational utilities"],
  ["5060", "ICT & Software", "expense", "Software licensing and ICT services"],
] as const;

const allocations: Record<string, number> = {
  "5000": 8_000_000, "5010": 6_000_000, "5020": 2_500_000,
  "5030": 2_000_000, "5040": 1_500_000, "5050": 2_500_000, "5060": 2_100_000,
};

function money(value: number) { return value.toFixed(2); }
function isoDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

interface Person { email: string; fullName: string; role: Role; id: string }

/**
 * Creates the configured sign-in accounts.
 *
 * Runs on every request but is idempotent and deliberately non-destructive: an
 * email that already exists is left completely alone, so a password somebody
 * changed through Settings survives every later deploy. Only missing accounts
 * are inserted, which is how the Director and Finance Officer sign-ins appear
 * on a workspace that was seeded by an earlier build.
 */
async function ensurePeople(tx: Tx): Promise<Person[]> {
  const people: Person[] = [];
  for (const account of bootstrapAccounts()) {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, account.email)).limit(1);
    if (existing) {
      people.push({ email: account.email, fullName: account.fullName, role: account.role, id: existing.id });
      continue;
    }
    const [created] = await tx.insert(users).values({
      fullName: account.fullName,
      email: account.email,
      passwordHash: hashPassword(account.password),
      role: account.role,
    }).returning({ id: users.id });
    people.push({ email: account.email, fullName: account.fullName, role: account.role, id: created.id });
    await tx.insert(auditLogs).values({
      actorId: created.id, action: "user.created", entity: "user", entityId: created.id,
      details: `${account.fullName} · ${account.email} · ${roleLabel[account.role]} (workspace bootstrap)`,
    });
  }
  return people;
}

/** The person holding a role, or the first account as a fallback. */
function personFor(people: Person[], role: Role): Person | undefined {
  return people.find((person) => person.role === role) || people[0];
}

/** Creates the chart of accounts once, plus illustrative records in demo mode. */
async function seedWorkspace(tx: Tx, people: Person[]) {
  const administrator = personFor(people, "admin");
  const director = personFor(people, "director") || administrator;
  const financeOfficer = personFor(people, "finance_officer") || administrator;
  if (!administrator) return;

  const inserted = await tx.insert(accounts).values(chartOfAccounts.map(([code, name, category, description]) => ({
    code, name, category, description,
  }))).returning({ id: accounts.id, code: accounts.code });
  const ids = Object.fromEntries(inserted.map((item) => [item.code, item.id]));
  const year = new Date().getUTCFullYear();
  const demoMode = isDemoMode();

  // Allocations are illustrative, so they belong to demo mode only. A real
  // deployment starts with no approved budget: the Director or Finance Officer
  // enters the institution's actual figures in Budget monitoring.
  if (demoMode) {
    await tx.insert(budgets).values(Object.entries(allocations).map(([code, allocated]) => ({
      fiscalYear: year, accountId: ids[code], allocated: money(allocated), updatedBy: director?.id ?? null,
    })));
  }

  if (demoMode && financeOfficer) {
    const incomeAmounts = [3_200_000, 4_150_000, 3_650_000, 4_900_000, 5_600_000, 6_950_000];
    const expenseAmounts = [1_850_000, 2_425_000, 2_675_000, 2_850_000, 3_100_000, 3_925_000];
    const incomeDescriptions = [
      ["Entrepreneurship bootcamp registration", "Business advisory engagement"],
      ["Digital skills programme fees", "Innovation hub facility booking"],
      ["Small business accelerator cohort", "Enterprise consultancy retainer"],
      ["Women in enterprise programme", "University conference facility hire"],
      ["Professional development workshops", "MSME advisory services"],
      ["Youth enterprise training fees", "Entrepreneurship support grant"],
    ];
    const expenseDescriptions = [
      ["Facilitator honoraria - January cohort", "Training materials and supplies"],
      ["Programme facilitator payments", "Administrative supplies and printing"],
      ["Entrepreneurship workshop delivery", "Facility repairs and servicing"],
      ["Facilitator and mentor stipends", "Community outreach campaign"],
      ["Programme delivery and logistics", "Power and internet services"],
      ["Training facilitator honoraria", "Learning platform and software"],
    ];
    const expenseAccounts = [["5000", "5010"], ["5000", "5020"], ["5010", "5030"], ["5000", "5040"], ["5010", "5050"], ["5000", "5060"]];
    const incomeAccounts = ["4010", "4020", "4010", "4020", "4010", "4030"];
    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
      const txnYear = month.getUTCFullYear();
      const txnMonth = month.getUTCMonth();
      const incomeSplit = Math.round(incomeAmounts[i] * 0.68);
      const expenseSplit = Math.round(expenseAmounts[i] * 0.62);
      const entries = [
        { kind: "income", seq: 1, day: 7, amount: incomeSplit, account: "4000", description: incomeDescriptions[i][0], payee: "Programme participants" },
        { kind: "income", seq: 2, day: 19, amount: incomeAmounts[i] - incomeSplit, account: incomeAccounts[i], description: incomeDescriptions[i][1], payee: i === 5 ? "Enterprise Development Fund" : "Institutional client" },
        { kind: "expense", seq: 3, day: 12, amount: expenseSplit, account: expenseAccounts[i][0], description: expenseDescriptions[i][0], payee: "Programme facilitators" },
        { kind: "expense", seq: 4, day: 23, amount: expenseAmounts[i] - expenseSplit, account: expenseAccounts[i][1], description: expenseDescriptions[i][1], payee: "Approved service provider" },
      ];
      for (const entry of entries) {
        const lastAllowedDay = txnYear === now.getUTCFullYear() && txnMonth === now.getUTCMonth()
          ? now.getUTCDate()
          : new Date(Date.UTC(txnYear, txnMonth + 1, 0)).getUTCDate();
        const [transaction] = await tx.insert(transactions).values({
          reference: `UPEC-${txnYear}-${String(txnMonth + 1).padStart(2, "0")}${String(entry.seq).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`,
          date: isoDate(txnYear, txnMonth, Math.min(entry.day, lastAllowedDay)),
          description: entry.description,
          type: entry.kind,
          status: "posted",
          payee: entry.payee,
          paymentMethod: "Bank transfer",
          createdBy: financeOfficer.id,
          postedAt: new Date(),
        }).returning({ id: transactions.id });
        await tx.insert(journalLines).values(entry.kind === "income" ? [
          { transactionId: transaction.id, accountId: ids["1010"], debit: money(entry.amount), credit: "0.00" },
          { transactionId: transaction.id, accountId: ids[entry.account], debit: "0.00", credit: money(entry.amount) },
        ] : [
          { transactionId: transaction.id, accountId: ids[entry.account], debit: money(entry.amount), credit: "0.00" },
          { transactionId: transaction.id, accountId: ids["1010"], debit: "0.00", credit: money(entry.amount) },
        ]);
      }
    }

    // A draft left for the Director to approve, so the oversight area has content.
    const [draft] = await tx.insert(transactions).values({
      reference: `UPEC-${year}-DEMO-DRAFT`,
      date: isoDate(now.getUTCFullYear(), now.getUTCMonth(), Math.min(9, now.getUTCDate())),
      description: "Facilitator honoraria - pending Director approval",
      type: "expense",
      status: "draft",
      payee: "Programme facilitators",
      paymentMethod: "Bank transfer",
      createdBy: financeOfficer.id,
      postedAt: null,
    }).returning({ id: transactions.id });
    await tx.insert(journalLines).values([
      { transactionId: draft.id, accountId: ids["5000"], debit: money(450_000), credit: "0.00", memo: "Facilitator honoraria" },
      { transactionId: draft.id, accountId: ids["1010"], debit: "0.00", credit: money(450_000), memo: "Payment made" },
    ]);
  }

  await tx.insert(auditLogs).values({
    actorId: administrator.id, action: "workspace.initialized", entity: "system",
    details: demoMode
      ? "Chart of accounts, FY budget and illustrative opening records created"
      : "Institutional chart of accounts created; no illustrative financial records or budget figures loaded",
  });
}

/** Seeds the workspace once. Set BOOTSTRAP_ADMIN_PASSWORD before a real deployment. */
export async function ensureSeed() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(5202026)`);
    const people = await ensurePeople(tx);
    const existing = await tx.select({ id: accounts.id }).from(accounts).limit(1);
    if (existing.length) return;
    await seedWorkspace(tx, people);
  });
}
