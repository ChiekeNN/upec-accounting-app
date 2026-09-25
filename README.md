# UPEC Accounting Software

A responsive, installable financial-management web app for the **University of Port Harcourt Entrepreneurial Centre (UPEC)**, Choba, Port Harcourt. Accounting / Vote Head **520**. Built with Next.js App Router, Neon Postgres, Drizzle ORM and a Progressive Web App shell.

## Deploy to Vercel with Neon (recommended)

You need only **one secret**, the database connection string, and Vercel's Neon integration creates it for you. There is **no auth secret key**: sessions are random 256-bit tokens stored (hashed) in the database.

1. **Import the repo:** Vercel → **Add New… → Project** → pick `upec-accounting-app` → **Deploy**. The first deploy will fail with "DATABASE_URL is not set". That's expected.
2. **Add Neon:** open the project → **Storage** tab → **Create Database** → **Neon** → accept the defaults (choose the region closest to your users) → **Connect** it to the project for all environments. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically.
3. **Set the first admin:** **Settings → Environment Variables**, add for *Production*:
   - `BOOTSTRAP_ADMIN_EMAIL` — defaults to `chiekenn@gmail.com`
   - `BOOTSTRAP_ADMIN_PASSWORD` — a strong password (`npm run gen:password` makes one). Without it the site runs in **public demo mode**.
   - Optionally `DIRECTOR_EMAIL` + `DIRECTOR_PASSWORD` and `FINANCE_OFFICER_EMAIL` + `FINANCE_OFFICER_PASSWORD` to create those accounts during the same first request. Leave them out and add those people later from **Team & access**.
4. **Redeploy:** **Deployments** → ⋯ on the latest → **Redeploy**. The build (`vercel-build`) runs database migrations first, creating the tables, then builds the app.
5. Open the site, sign in with the admin email and password, and **change the password in Settings**.

Future schema changes deploy the same way: migrations in `drizzle/` run automatically on every deploy.

## Local development

1. Get a Neon connection string: from the Neon Console (**Connect** button), with `vercel env pull .env` after the Vercel steps above, or temporarily with `npm run db:new` (expires in 72 h unless claimed).
2. `cp .env.example .env` (skip if already created) and fill it in.
3. `npm install`, `npm run db:migrate`, `npm run dev`.

After editing `src/db/schema.ts`, run `npm run db:generate` to create a migration in `drizzle/`, commit it, and it will be applied on the next deploy.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** connection string used by the app. |
| `DATABASE_URL_UNPOOLED` / `DATABASE_URL_DIRECT` | No | Neon **direct** connection string for migrations. Falls back to `DATABASE_URL`. |
| `BOOTSTRAP_ADMIN_EMAIL` | No | Administrator email. Defaults to `chiekenn@gmail.com`. |
| `BOOTSTRAP_ADMIN_NAME` | No | Administrator display name. Defaults to `Chieke Nnadi`. |
| `BOOTSTRAP_ADMIN_PASSWORD` | For real use | Administrator password. Setting it turns demo mode **off**. |
| `DIRECTOR_EMAIL` / `DIRECTOR_NAME` | No | Director account. Defaults to `director@upec.edu.ng`. |
| `DIRECTOR_PASSWORD` | No | Creates the Director at bootstrap. In demo mode it defaults to the demo password. |
| `FINANCE_OFFICER_EMAIL` / `FINANCE_OFFICER_NAME` | No | Finance Officer account. Defaults to `fo@upec.edu.ng`. |
| `FINANCE_OFFICER_PASSWORD` | No | Creates the Finance Officer at bootstrap. In demo mode it defaults to the demo password. |

The first request initializes the chart of accounts and the configured accounts. To initialize a **real, empty financial workspace**, set these environment variables **before the first request**:

- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` — the Administrator. When the password is set, no illustrative transactions or budget allocations are inserted. Change the password in Settings after sign-in.
- `DIRECTOR_PASSWORD` / `FINANCE_OFFICER_PASSWORD` — only set these if you want those accounts created automatically. Without them the Administrator creates those people from **Team & access** with individual passwords.

Account creation is **idempotent and non-destructive**: an email that already exists is never modified, so a name corrected in Settings or a password rotated by a user survives every later deploy.

If `BOOTSTRAP_ADMIN_PASSWORD` is **not** set, the app runs in an **illustrative demo mode** with sample transactions, budgets, and one-click demo sign-ins for every role. **Never expose that demo mode with real financial records.** Use a new database and configure the administrator password for a real deployment. The sign-in page clearly identifies demo access.

## Roles and permissions

| Role | Records | Budgets & accounts | Team | Director Admin |
| --- | --- | --- | --- | --- |
| **Administrator** | Create, correct, post, reverse | Full | Full, including other Administrators | Yes |
| **Director** | Create, correct, post, reverse | Full | Add and manage members, except Administrators | Yes |
| **Finance Officer** | Create, correct, post, reverse | Full | No | No |
| **Viewer** | Read only | Read only | No | No |

The **Finance Officer** can correct mistakes without escalating: budget allocations and chart-of-accounts details are editable, and **draft** entries can be edited or deleted. **Posted** entries can never be edited or deleted — they are reversed with a compensating journal so the ledger keeps its history. An account that already carries ledger lines has its category locked, because reports classify income and expenditure by it. Every correction is written to the audit trail.

**Director Admin** is a separate oversight area for Directors and Administrators: entries awaiting approval (approvable in place), budget lines at or above 85% utilisation, team composition and recent governance activity.

Only an Administrator may create, promote or deactivate another Administrator; a Director cannot alter the Administrator accounts.

### Demo sign-ins

Demo mode only, all with the password `UpecDemo@2026!`:

| Role | Email |
| --- | --- |
| Administrator | `chiekenn@gmail.com` |
| Director | `director@upec.edu.ng` |
| Finance Officer | `fo@upec.edu.ng` |


## Capabilities

- HTTP-only cookie sessions, scrypt password hashes, account lockout, role-based access (Administrator, Director, Finance Officer, Viewer), self-service profile and password change, and session revocation.
- Chart of accounts with assets, liabilities, equity, income and expenses.
- Atomic double-entry transactions: income, expense, transfer and manual journal; balanced-line validation; drafts that can be edited or discarded, posting, and compensating reversals rather than deletion of posted entries.
- Financial-year budgeting by expense head, utilization warnings, and actuals calculated only from posted journal lines.
- Income and expenditure statement, general ledger, trial balance, budget versus actual, transaction register; printable reports and safe CSV exports.
- Searchable transaction register, audit history, access management, responsive mobile navigation and installable PWA.

## Operational safeguards

Run behind HTTPS, provide regular encrypted PostgreSQL backups, restrict database access, rotate administrator credentials, and set strong deployment secrets. All accounting API routes require authentication; writes verify same-origin requests and user permissions. Authenticated pages, API responses, and financial records are **never cached by the service worker**. Only public static assets are available offline; accounting requires connectivity.

The illustrative records are examples, not University of Port Harcourt financial statements. Reports are denominated in Nigerian Naira (NGN) and use the server's current calendar financial year.
