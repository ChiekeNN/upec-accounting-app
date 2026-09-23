import { errorResponse, getCurrentUser } from "@/lib/auth";
import { getSnapshot } from "@/lib/ledger";
import { buildReport, type ReportType } from "@/lib/reporting";

export const dynamic = "force-dynamic";

function cell(value: string | number): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  // Neutralize spreadsheet formulas in user-entered descriptions and names.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("Please sign in to export reports.", 401);
    const params = new URL(request.url).searchParams;
    const report = params.get("report") || "income";
    if (!["income", "budget", "ledger", "trial", "transactions"].includes(report)) return errorResponse("Invalid report type.");
    const year = new Date().getUTCFullYear();
    const from = params.get("from") || `${year}-01-01`;
    const to = params.get("to") || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return errorResponse("Invalid report date range.");
    const snapshot = await getSnapshot(user);
    const result = buildReport(snapshot, report as ReportType, from, to);
    const csv = [
      ["University of Port Harcourt Entrepreneurial Centre (UPEC)"],
      [result.title],
      [result.subtitle, "Vote Head 520"],
      [],
      result.columns,
      ...result.rows,
    ].map((row) => row.map(cell).join(",")).join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="UPEC_${report}_${from}_${to}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Report export failed:", error);
    return errorResponse("Unable to export report right now.", 500);
  }
}
