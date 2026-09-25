import { DEMO_PASSWORD, type DemoAccount } from "@/lib/demo";
import { roleSummary, type Role } from "@/lib/roles";

/**
 * Server-only. Resolves which sign-in accounts the workspace should have from
 * environment variables, and which password (if any) each one gets.
 *
 * Demo mode — BOOTSTRAP_ADMIN_PASSWORD unset — creates all three accounts with
 * the shared demo password so the workspace can be explored with one click.
 *
 * A real deployment sets BOOTSTRAP_ADMIN_PASSWORD, and the Director and Finance
 * Officer accounts are only created when their own password variables are set.
 * Accounts with no password are skipped rather than created with a guessable
 * one; an Administrator can add those people through Team & permissions.
 */

export interface BootstrapAccount {
  email: string;
  fullName: string;
  role: Role;
  password: string;
}

/** True when the workspace runs on illustrative demo data. */
export function isDemoMode(): boolean {
  return !process.env.BOOTSTRAP_ADMIN_PASSWORD;
}

function env(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

/** Accounts to create, in creation order. Administrator first. */
export function bootstrapAccounts(): BootstrapAccount[] {
  const demo = isDemoMode();
  const candidates: (Omit<BootstrapAccount, "password"> & { password?: string })[] = [
    {
      email: env("BOOTSTRAP_ADMIN_EMAIL", "chiekenn@gmail.com").toLowerCase(),
      fullName: env("BOOTSTRAP_ADMIN_NAME", "Chieke Nnadi"),
      role: "admin",
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD || DEMO_PASSWORD,
    },
    {
      email: env("DIRECTOR_EMAIL", "director@upec.edu.ng").toLowerCase(),
      fullName: env("DIRECTOR_NAME", "UPEC Director"),
      role: "director",
      password: process.env.DIRECTOR_PASSWORD || (demo ? DEMO_PASSWORD : undefined),
    },
    {
      email: env("FINANCE_OFFICER_EMAIL", "fo@upec.edu.ng").toLowerCase(),
      fullName: env("FINANCE_OFFICER_NAME", "UPEC Finance Officer"),
      role: "finance_officer",
      password: process.env.FINANCE_OFFICER_PASSWORD || (demo ? DEMO_PASSWORD : undefined),
    },
  ];
  return candidates.flatMap((account) =>
    account.password ? [{ ...account, password: account.password }] : [],
  );
}

/** Demo accounts for the sign-in screen. Empty when demo mode is off. */
export function demoAccounts(): DemoAccount[] {
  if (!isDemoMode()) return [];
  return bootstrapAccounts().map((account) => ({
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    blurb: roleSummary[account.role],
  }));
}
