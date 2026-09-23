import AccountingApp from "@/components/accounting-app";
import LoginScreen from "@/components/login-screen";
import { getCurrentUser } from "@/lib/auth";
import { getSnapshot } from "@/lib/ledger";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) {
    return <LoginScreen demoEnabled={!process.env.BOOTSTRAP_ADMIN_PASSWORD} demoEmail={(process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@upec.edu.ng").toLowerCase()} />;
  }
  const snapshot = await getSnapshot(user);
  return <AccountingApp initialData={snapshot} />;
}
