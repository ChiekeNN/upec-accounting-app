import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { createSession, destroySession, errorResponse, getCurrentUser, hashPassword, isSameOrigin, verifyPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const dummyHash = hashPassword("NotTheCorrectPassword@123");
const unknownAttempts = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  try {
    const body = await request.json();
    if (body?.action === "logout") {
      const user = await getCurrentUser();
      if (user) await db.insert(auditLogs).values({ actorId: user.id, action: "user.signed_out", entity: "user", entityId: user.id, details: "Session ended" });
      await destroySession();
      return Response.json({ message: "Signed out." }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body?.action !== "login") return errorResponse("Invalid authentication action.");
    await ensureSeed();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 255) : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password || password.length > 256) return errorResponse("Enter your email and password.");
    const remoteAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const attemptKey = `${remoteAddress}:${email}`;
    const ipAttempt = unknownAttempts.get(attemptKey);
    if (ipAttempt && ipAttempt.until > Date.now()) return errorResponse("Too many sign-in attempts. Try again in 15 minutes.", 429);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user?.lockedUntil && user.lockedUntil > new Date()) return errorResponse("Too many sign-in attempts. Try again in 15 minutes.", 429);
    const valid = verifyPassword(password, user?.passwordHash || dummyHash);
    if (!user || !user.isActive || !valid) {
      if (user?.isActive) {
        const failures = user.failedLoginAttempts + 1;
        await db.update(users).set({ failedLoginAttempts: failures >= 5 ? 0 : failures, lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null }).where(eq(users.id, user.id));
      }
      const nextCount = (ipAttempt?.count || 0) + 1;
      unknownAttempts.set(attemptKey, { count: nextCount >= 8 ? 0 : nextCount, until: nextCount >= 8 ? Date.now() + 15 * 60 * 1000 : 0 });
      return errorResponse("Invalid email or password.", 401);
    }
    unknownAttempts.delete(attemptKey);
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
    await createSession(user.id);
    await db.insert(auditLogs).values({ actorId: user.id, action: "user.signed_in", entity: "user", entityId: user.id, details: "Successful sign-in" });
    return Response.json({ message: "Welcome back." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Authentication failed:", error);
    return errorResponse("Unable to sign in right now. Please try again.", 500);
  }
}
