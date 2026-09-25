import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { canEditRecords, hasAdminAccess, normaliseRole } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

const COOKIE_NAME = "upec_session";
const SESSION_LENGTH = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [method, salt, expected] = stored.split(":");
  if (method !== "scrypt" || !salt || !expected) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db.select({
    id: users.id,
    fullName: users.fullName,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
  }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  const user = rows[0];
  if (!user?.isActive) return null;
  return { id: user.id, fullName: user.fullName, email: user.email, role: normaliseRole(user.role) };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_LENGTH) });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LENGTH / 1000,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  cookieStore.delete(COOKIE_NAME);
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    return originUrl.host === requestUrl.host || (!!forwardedHost && originUrl.host === forwardedHost);
  } catch {
    return false;
  }
}

export function canWrite(user: SessionUser) {
  return canEditRecords(user.role);
}

/** Administrators and Directors: team management plus the oversight area. */
export function isAdmin(user: SessionUser) {
  return hasAdminAccess(user.role);
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
