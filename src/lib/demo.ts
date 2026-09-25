import type { Role } from "@/lib/roles";

/**
 * Shared password for the illustrative demo workspace.
 *
 * Client-safe: this module holds no environment variables, so the sign-in
 * screen can offer one-click demo access without exposing any real secret.
 * A genuine deployment sets BOOTSTRAP_ADMIN_PASSWORD, which disables demo
 * mode entirely and means this password is never seeded.
 */
export const DEMO_PASSWORD = "UpecDemo@2026!";

export interface DemoAccount {
  email: string;
  fullName: string;
  role: Role;
  /** One-line explanation shown under the account on the sign-in screen. */
  blurb: string;
}
