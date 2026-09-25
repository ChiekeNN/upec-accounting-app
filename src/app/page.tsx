import AccountingApp from "@/components/accounting-app";
import LoginScreen from "@/components/login-screen";
import { getCurrentUser } from "@/lib/auth";
import { demoAccounts } from "@/lib/bootstrap";
import { getSnapshot } from "@/lib/ledger";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) {
    return <LoginScreen demoAccounts={demoAccounts()} />;
  }
  const snapshot = await getSnapshot(user);
  return <AccountingApp initialData={snapshot} />;
}
